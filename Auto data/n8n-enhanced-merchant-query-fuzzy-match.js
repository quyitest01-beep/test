// n8n Code节点：增强版Lark消息查询处理器 - 智能模糊匹配版
// 支持 togame 匹配 "To game" 等高级模糊匹配

const items = $input.all();
const results = [];

// 分析输入数据结构
let merchantData = [];
let larkEventData = null;
console.log(`=== 处理 ${items.length} 个输入项 ===`);

// 1. 从所有输入项中提取数据
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(`\n项目 ${i + 1} 的字段:`, Object.keys(item.json));
  
  // 检查是否包含Lark事件数据
  if (item.json.messageId || item.json.rawEvent || item.json.chatId) {
    larkEventData = item.json;
    console.log(`✅ 找到Lark事件数据 (项目 ${i + 1})`);
  }
  
  // 检查是否包含商户数据
  if (item.json.filtered_merchants && Array.isArray(item.json.filtered_merchants)) {
    merchantData = item.json.filtered_merchants;
    console.log(`✅ 找到商户数据 (项目 ${i + 1}): ${merchantData.length} 条`);
  }
}

console.log(`\n数据汇总:`);
console.log(`- 商户数据: ${merchantData.length} 条`);
console.log(`- Lark事件: ${larkEventData ? '已找到' : '未找到'}`);

// 2. 提取消息文本
let messageText = '';
if (larkEventData) {
  // 优先从Lark事件数据中提取
  messageText = larkEventData.messageText || '';
  
  // 如果没有，尝试从rawEvent中提取
  if (!messageText && larkEventData.rawEvent && larkEventData.rawEvent.event && larkEventData.rawEvent.event.message) {
    const content = larkEventData.rawEvent.event.message.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        messageText = parsed.text || '';
      } catch (e) {
        messageText = content;
      }
    }
  }
}

// 增强的文本清理函数
function cleanText(text) {
  if (!text) return '';
  
  return String(text)
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // 各种Unicode空格
    .replace(/[\t\r\n]/g, ' ') // 制表符、回车、换行
    .replace(/\s+/g, ' ') // 多个连续空格合并为一个
    .trim(); // 去除首尾空格
}

// 智能字符串标准化函数 - 用于模糊匹配
function normalizeForMatching(text) {
  if (!text) return '';
  
  return cleanText(text)
    .toLowerCase()
    .replace(/\s+/g, '') // 移除所有空格
    .replace(/[^\w\u4e00-\u9fff]/g, ''); // 只保留字母、数字、中文字符
}

// 计算编辑距离（Levenshtein Distance）
function calculateEditDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // 创建矩阵
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  // 初始化第一行和第一列
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // 删除
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }
  
  return matrix[len1][len2];
}

// 计算相似度分数
function calculateSimilarity(query, target) {
  const normalizedQuery = normalizeForMatching(query);
  const normalizedTarget = normalizeForMatching(target);
  
  if (!normalizedQuery || !normalizedTarget) return 0;
  
  // 1. 完全匹配
  if (normalizedQuery === normalizedTarget) return 100;
  
  // 2. 包含匹配
  if (normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget)) {
    return 90;
  }
  
  // 3. 编辑距离匹配
  const editDistance = calculateEditDistance(normalizedQuery, normalizedTarget);
  const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);
  
  if (maxLength === 0) return 0;
  
  const similarity = ((maxLength - editDistance) / maxLength) * 100;
  
  // 4. 额外的模糊匹配规则
  let bonus = 0;
  
  // 首字母匹配加分
  if (normalizedQuery[0] === normalizedTarget[0]) {
    bonus += 10;
  }
  
  // 长度相似加分
  const lengthRatio = Math.min(normalizedQuery.length, normalizedTarget.length) / 
                     Math.max(normalizedQuery.length, normalizedTarget.length);
  if (lengthRatio > 0.7) {
    bonus += 5;
  }
  
  return Math.min(100, similarity + bonus);
}

// 智能商户匹配函数
function findBestMatches(query, merchants, threshold = 60) {
  const matches = [];
  
  for (const merchant of merchants) {
    const merchantName = cleanText(merchant.sub_merchant_name || merchant.name || '');
    if (!merchantName) continue;
    
    const similarity = calculateSimilarity(query, merchantName);
    
    if (similarity >= threshold) {
      matches.push({
        merchant: merchant,
        similarity: similarity,
        name: merchantName
      });
    }
  }
  
  // 按相似度排序
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}

const cleanedText = cleanText(messageText);
console.log(`\n原始消息文本: "${messageText}"`);
console.log(`清理后文本: "${cleanedText}"`);

// 3. 提取Lark回复参数
let larkParams = {};
if (larkEventData) {
  // 从直接字段提取
  if (larkEventData.messageId) larkParams.message_id = larkEventData.messageId;
  if (larkEventData.chatId) larkParams.chat_id = larkEventData.chatId;
  
  // 从rawEvent中提取更多参数
  if (larkEventData.rawEvent) {
    const rawEvent = larkEventData.rawEvent;
    
    // 从header提取
    if (rawEvent.header) {
      if (rawEvent.header.tenant_key) larkParams.tenant_key = rawEvent.header.tenant_key;
    }
    
    // 从event提取
    if (rawEvent.event) {
      if (rawEvent.event.message) {
        const msg = rawEvent.event.message;
        if (msg.message_id) larkParams.message_id = msg.message_id;
        if (msg.chat_id) larkParams.chat_id = msg.chat_id;
      }
      if (rawEvent.event.sender) {
        larkParams.sender = rawEvent.event.sender;
      }
    }
  }
}

console.log(`\n提取的Lark参数:`, Object.keys(larkParams));

// 4. 智能查询处理
let replyMessage = '';
let queryKeyword = '';
let searchType = 'unknown';

if (!cleanedText) {
  replyMessage = '请输入要查询的商户名称或ID';
} else if (merchantData.length === 0) {
  replyMessage = '抱歉，当前没有可用的商户数据';
} else {
  // 检查是否为"全部商户"指令
  const listAllPatterns = [
    /^(全部|所有|全体|列出|显示)(商户|商家)(列表|信息)?$/,
    /^商户(列表|清单|名单)$/,
    /^(list|show|all)\s*(merchants?|商户)$/i,
    /^查看(全部|所有)商户$/
  ];
  
  let isListAllCommand = false;
  for (const pattern of listAllPatterns) {
    if (pattern.test(cleanedText)) {
      isListAllCommand = true;
      searchType = 'list_all';
      console.log(`✅ 识别到"全部商户"指令: ${pattern.source}`);
      break;
    }
  }
  
  if (isListAllCommand) {
    // 返回全部商户列表 - 结构化数据格式
    console.log(`执行全部商户列表查询，共 ${merchantData.length} 个商户`);
    
    // 按商户ID排序
    const sortedMerchants = [...merchantData].sort((a, b) => {
      const idA = parseInt(a.merchant_id || a.id || 0);
      const idB = parseInt(b.merchant_id || b.id || 0);
      return idA - idB;
    });
    
    // 构建结构化数据数组
    const merchantList = sortedMerchants.map(merchant => ({
      sub_merchant_name: cleanText(merchant.sub_merchant_name || merchant.name || '未知'),
      main_merchant_name: cleanText(merchant.main_merchant_name || merchant.main_name || ''),
      merchant_id: parseInt(merchant.merchant_id || merchant.id || 0)
    }));
    
    // 生成简单的文本提示消息
    replyMessage = `📋 已获取商户列表，共 ${merchantData.length} 个商户\n正在生成表格...`;
    
    console.log(`✅ 返回商户列表: ${merchantList.length} 个`);
    
    // 将商户列表数据添加到输出
    searchType = 'list_all';
    queryKeyword = 'list_all';
  } else {
    // 提取查询关键词
    queryKeyword = cleanedText;
  
  // 处理各种中文格式
  const patterns = [
    /商户\s*([^的\s]+)/,
    /ID\s*([0-9]+)/i,
    /id\s*([0-9]+)/,
    /([0-9]+)\s*的\s*商户/,
    /([0-9]+)\s*对应\s*的\s*商户/,
    /查询\s*([^的\s]+)/,
    /查找\s*([^的\s]+)/,
    /搜索\s*([^的\s]+)/,
    /找\s*([^的\s]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      queryKeyword = cleanText(match[1]);
      console.log(`✅ 匹配到模式: ${pattern.source}, 提取关键词: "${queryKeyword}"`);
      break;
    }
  }
  
  // 如果没有匹配到特定模式，进行通用清理
  if (queryKeyword === cleanedText) {
    queryKeyword = cleanedText
      .replace(/^(查询|查找|搜索|找)\s*/i, '')
      .replace(/\s*(的|的id|的ID|id|ID|信息|详情|商户|名称)$/i, '')
      .trim();
    queryKeyword = cleanText(queryKeyword);
  }
  
  console.log(`\n最终查询关键词: "${queryKeyword}"`);
  
  // 执行查询
  let matchResult = null;
  
  // 检查是否为数字ID查询
  if (/^\d+$/.test(queryKeyword)) {
    searchType = 'id_search';
    const queryId = queryKeyword;
    console.log(`执行ID查询: ${queryId}`);
    
    for (const merchant of merchantData) {
      const merchantId = String(merchant.merchant_id || merchant.id || '').trim();
      if (merchantId === queryId) {
        const merchantName = cleanText(merchant.sub_merchant_name || merchant.name || '');
        const mainName = cleanText(merchant.main_merchant_name || merchant.main_name || '');
        replyMessage = `✅ 通过ID找到商户信息：\n` +
                      `📋 商户名称：${merchantName}\n` +
                      `🏢 主商户：${mainName}\n` +
                      `🆔 商户ID：${merchantId}`;
        matchResult = true;
        console.log(`✅ ID查询成功: ${merchantName}`);
        break;
      }
    }
    
    if (!matchResult) {
      replyMessage = `❌ 未找到ID为 ${queryKeyword} 的商户\n\n💡 提示：\n` +
                    `• 请检查商户ID是否正确\n` +
                    `• 当前数据库共有 ${merchantData.length} 个商户`;
      console.log(`❌ ID查询失败`);
    }
  } else {
    searchType = 'name_search';
    console.log(`执行智能商户名查询: "${queryKeyword}"`);
    
    // 使用智能匹配算法
    const matches = findBestMatches(queryKeyword, merchantData, 60);
    
    console.log(`智能匹配结果: ${matches.length} 个`);
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.name} (相似度: ${match.similarity.toFixed(1)}%)`);
    });
    
    if (matches.length > 0) {
      if (matches.length === 1 || matches[0].similarity >= 85) {
        // 单个结果或高相似度结果
        searchType = matches[0].similarity >= 85 ? 'exact_match' : 'fuzzy_match';
        const bestMatch = matches[0];
        const merchantName = bestMatch.name;
        const merchantId = String(bestMatch.merchant.merchant_id || bestMatch.merchant.id || '').trim();
        const mainName = cleanText(bestMatch.merchant.main_merchant_name || bestMatch.merchant.main_name || '');
        
        const matchTypeText = bestMatch.similarity >= 85 ? '找到商户信息' : '找到相似商户';
        replyMessage = `✅ ${matchTypeText}（相似度: ${bestMatch.similarity.toFixed(1)}%）：\n` +
                      `📋 商户名称：${merchantName}\n` +
                      `🏢 主商户：${mainName}\n` +
                      `🆔 商户ID：${merchantId}`;
        matchResult = true;
        console.log(`✅ 智能匹配成功: ${merchantName} (${bestMatch.similarity.toFixed(1)}%)`);
      } else {
        // 多个结果
        searchType = 'multiple_matches';
        replyMessage = `🔍 找到 ${matches.length} 个相似商户：\n`;
        matches.slice(0, 5).forEach((match, index) => {
          const id = String(match.merchant.merchant_id || match.merchant.id || '').trim();
          replyMessage += `${index + 1}. ${match.name} (ID: ${id}, 相似度: ${match.similarity.toFixed(1)}%)\n`;
        });
        if (matches.length > 5) {
          replyMessage += `... 还有 ${matches.length - 5} 个结果`;
        }
        matchResult = true;
      }
    } else {
      searchType = 'not_found';
      replyMessage = `❌ 未找到商户："${queryKeyword}"\n\n💡 建议：\n` +
                    `• 检查商户名称拼写\n` +
                    `• 尝试使用商户ID查询\n` +
                    `• 使用部分关键词搜索\n` +
                    `• 当前数据库共有 ${merchantData.length} 个商户`;
    }
  }
  }
}

console.log(`\n生成的回复消息: ${replyMessage}`);

// 5. 输出结果
// 如果是"全部商户"查询，返回多个items（每个商户一行）
if (searchType === 'list_all') {
  const sortedMerchants = [...merchantData].sort((a, b) => {
    const idA = parseInt(a.merchant_id || a.id || 0);
    const idB = parseInt(b.merchant_id || b.id || 0);
    return idA - idB;
  });
  
  console.log(`\n=== 输出全部商户列表 ===`);
  console.log(`商户数量: ${sortedMerchants.length}`);
  
  // 为每个商户创建一个独立的item（每个商户一行）
  sortedMerchants.forEach(merchant => {
    results.push({
      json: {
        sub_merchant_name: cleanText(merchant.sub_merchant_name || merchant.name || '未知'),
        main_merchant_name: cleanText(merchant.main_merchant_name || merchant.main_name || ''),
        merchant_id: parseInt(merchant.merchant_id || merchant.id || 0)
      }
    });
  });
  
  console.log(`✅ 已输出 ${results.length} 个商户items（每个商户一行）`);
  
} else {
  // 其他查询类型，返回单个item
  const outputData = {
    // 回复消息（格式化文本）
    replyMessage: replyMessage,
    
    // Lark消息格式（用于HTTP Request）
    larkMessage: {
      msg_type: "text",
      content: {
        text: replyMessage
      }
    },
    
    // Lark回复参数（从事件数据中提取）
    larkParams: larkParams,
    
    // 完整的回复消息体（包含回复参数）
    larkReply: {
      msg_type: "text",
      content: {
        text: replyMessage
      },
      ...larkParams
    },
    
    // 数据来源信息
    dataSource: {
      merchantCount: merchantData.length,
      hasLarkEvent: !!larkEventData,
      paramCount: Object.keys(larkParams).length,
      queryText: cleanedText,
      originalText: messageText,
      queryKeyword: queryKeyword,
      searchType: searchType
    }
  };

  console.log(`\n=== 最终输出 ===`);
  console.log(`输出字段: ${Object.keys(outputData).join(', ')}`);
  console.log(`Lark参数数量: ${Object.keys(larkParams).length}`);
  console.log(`商户数据数量: ${merchantData.length}`);
  console.log(`查询关键词: "${queryKeyword}"`);
  console.log(`搜索类型: ${searchType}`);

  results.push({json: outputData});
}
return results;

// 智能模糊匹配版特点：
// 1. 新增编辑距离算法（Levenshtein Distance）
// 2. 智能字符串标准化，移除空格和特殊字符
// 3. 多层次相似度计算：完全匹配 > 包含匹配 > 编辑距离匹配
// 4. 相似度加分机制：首字母匹配、长度相似等
// 5. 可配置的匹配阈值（默认60%）
// 6. 显示匹配相似度百分比
// 7. 支持"全部商户"指令，返回结构化数据数组
// 8. 支持的匹配示例：
//    - "togame" 匹配 "To game" (高相似度)
//    - "betfiry" 匹配 "betfiery" (编辑距离匹配)
//    - "tgame" 匹配 "To game" (部分匹配)
//    - "togam" 匹配 "To game" (编辑距离匹配)
// 9. 支持的"全部商户"指令：
//    - "全部商户"、"所有商户"、"商户列表"
//    - "list merchants"、"show all merchants"
// 10. "全部商户"输出格式：
//    - 返回多个items，每个商户一个item（CSV中每个商户一行）
//    - 每个item格式: {sub_merchant_name, main_merchant_name, merchant_id}
//    - 按merchant_id排序
//    - Convert to File会生成竖向表格：
//      sub_merchant_name,main_merchant_name,merchant_id
//      betfiery,RD1,1698202251
//      aajogo,RD1,1698202662
//      rico100,RD1,1698202814