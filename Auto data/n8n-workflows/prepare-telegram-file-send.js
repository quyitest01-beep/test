// n8n Code 节点：解析查数结果（兼容 queryRecords + gameRecords 聚合结构）

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const BINARY_FIELD = 'data';
const OUTPUT_BINARY_FIELD = 'csv';

const statusRecords = [];
const resultRecords = [];

const normalize = (v) => String(v || '').trim();
const norm = (v) => normalize(v).toLowerCase();

function parseQueryText(text = '') {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const info = {
    merchants: new Set(), // 支持多个商户ID
  };

  lines.forEach((line) => {
    const lower = line.toLowerCase();

    if (/商户/.test(line)) {
      // 提取所有商户ID（支持"商户：1716179958、1718444707、1747302129"格式）
      const merchantMatch = line.match(/商户(?:号|id)?[:：]?\s*([0-9、，,\s]+)/i);
      if (merchantMatch) {
        const merchants = merchantMatch[1]
          .split(/[、，,\s]+/)
          .map(m => m.trim())
          .filter(m => /^\d+$/.test(m));
        merchants.forEach(m => info.merchants.add(m));
        // 为了兼容性，保留第一个商户ID作为merchant字段
        if (merchants.length > 0 && !info.merchant) {
          info.merchant = normalize(merchants[0]);
        }
      } else {
        const merchant = normalize(line.replace(/商户(?:号|id)?[:：]?/i, ''));
        if (merchant && /^\d+$/.test(merchant)) {
          info.merchants.add(merchant);
          if (!info.merchant) {
            info.merchant = merchant;
          }
        }
      }
    } else if (/投注/.test(line) || lower.includes('bet')) {
      // 提取投注ID：支持"投注记录：1973176029411737600"格式
      const betIdMatch = line.match(/投注(?:记录|id)?[:：]?\s*([0-9]+)/i);
      if (betIdMatch) {
        info.betId = normalize(betIdMatch[1]);
      } else {
        info.betId = normalize(line.replace(/投注(?:记录|id)?[:：]?/i, ''));
      }
    } else if (/玩家id/i.test(line)) {
      info.uid = normalize(line.replace(/玩家id[:：]?/i, ''));
    } else if (/游戏id/i.test(line)) {
      info.gameId = normalize(line.replace(/游戏id[:：]?/i, ''));
    } else if (/游戏名称/.test(line)) {
      info.gameName = normalize(line.replace(/游戏名称[:：]?/i, ''));
    } else if (/游戏代码|game code/i.test(line)) {
      info.gameCode = normalize(line.replace(/游戏(?:代码)?[:：]?/i, ''));
    } else if (/时间/.test(line)) {
      info.timeRange = normalize(line.replace(/时间[:：]?/i, ''));
    } else if (/回合id/.test(line) || /round/.test(lower)) {
      info.roundId = normalize(line.replace(/回合id[:：]?/i, ''));
    }
  });

  const merchantList = Array.from(info.merchants);
  info.merchants = merchantList.length ? merchantList : [];
  info.text = normalize(text);
  return info;
}

function pushStatus(payload, record, fallbackText, binary) {
  const text = record.text || fallbackText || '';
  const hasRecordCount = typeof payload.recordCount === 'number' && payload.recordCount > 0;
  const allowFile = Boolean(record.filePresent && (payload.outputType === 'file_with_text' || hasRecordCount));
  statusRecords.push({
    meta: {
      ...record,
      text,
      chatid: record.chatid || payload.chatid || '',
      senderid: record.senderid || payload.senderid || '',
      messageid: record.messageid || payload.messageid || '',
      filePresent: allowFile,
      dataAvailable: allowFile,
      queryInfo: parseQueryText(text),
    },
    binary: allowFile ? binary : null,
  });
}

items.forEach((item) => {
  const payload = item.json || {};
  const binary = item.binary?.[BINARY_FIELD] || null;

  const queryRecords = Array.isArray(payload.queryRecords) ? payload.queryRecords : [];
  const gameRecords = Array.isArray(payload.gameRecords) ? payload.gameRecords : [];

  const fallbackText = payload.messageText || payload.text || '';
  const baseContext = {
    chatid: payload.chatid || '',
    senderid: payload.senderid || '',
    messageid: payload.messageid || '',
    text: fallbackText,
    queryInfo: parseQueryText(fallbackText),
  };

  if (queryRecords.length) {
    queryRecords.forEach((record) => pushStatus(payload, record, fallbackText, binary));
  } else if (payload.text || payload.chatid || payload.senderid) {
    pushStatus(payload, payload, fallbackText, binary);
  }

  const pushResultRecord = (record) => {
    resultRecords.push({
      record,
      context: { ...baseContext },
    });
  };

  if (gameRecords.length) {
    gameRecords.forEach(pushResultRecord);
  } else if (payload.record && typeof payload.record === 'object') {
    pushResultRecord(payload.record);
  }
});

// 检查是否有查询成功且有文件的情况（统计类查询，如日活、累计投注等）
// 这些查询的结果在文件中，不在gameRecords中
const queriesWithFiles = statusRecords.filter(({ meta, binary }) => {
  // 查询已完成且有文件（即使没有binary数据，只要有filePresent标记也应该返回）
  const isCompleted = meta.result === '查询完成' || meta.result === '查询已启动，正在执行中...';
  const hasFile = meta.filePresent === true;
  return isCompleted && hasFile;
});

// 如果没有gameRecords，但有查询成功且有文件的情况，应该返回文件
if (!resultRecords.length && queriesWithFiles.length > 0) {
  return queriesWithFiles.map(({ meta, binary }) => {
    const info = meta.queryInfo || {};
    const headerLines = [];
    
    if (info.merchant) headerLines.push(`- 商户：${info.merchant}`);
    if (info.timeRange) headerLines.push(`- 时间：${info.timeRange}`);
    
    const queryHeader = headerLines.length ? `📝 **查询条件**\n${headerLines.join('\n')}\n\n` : '';
    
    // 根据查询类型生成不同的消息
    let resultMessage = '';
    const text = meta.text || '';
    
    if (/日活|活跃用户|DAU/i.test(text)) {
      resultMessage = `📊 **日活统计结果**\n\n查询已完成，结果文件已生成。\n\n`;
    } else if (/累计投注|累计派奖|投注额|派奖额/i.test(text)) {
      resultMessage = `💰 **累计投注/派奖统计结果**\n\n查询已完成，结果文件已生成。\n\n`;
    } else {
      resultMessage = `📄 **查询结果**\n\n查询已完成，结果文件已生成。\n\n`;
    }
    
    const message = `${queryHeader}${resultMessage}✅ 查询完成\n\n📎 文件：${meta.fileInfo?.fileName || '查询结果.csv'}\n📏 大小：${meta.fileInfo?.formattedSize || 'N/A'}`;
    
    const output = {
      json: {
        success: true,
        message,
        chatid: meta.chatid || '',
        senderid: meta.senderid || '',
        messageid: meta.messageid || '',
        text: meta.text || '',
        queryInfo: meta.queryInfo || {},
        filePresent: meta.filePresent ?? false,
        fileInfo: meta.fileInfo || null,
        queryType: 'statistical', // 标记为统计类查询
      },
    };
    
    // 如果有binary数据，添加到输出中
    if (binary?.data) {
      output.binary = {
        [OUTPUT_BINARY_FIELD]: binary,
      };
    }
    
    return output;
  });
}

if (!resultRecords.length) {
  const message =
    '⚠️ 未查询到相关数据，请核对查询条件（如投注/用户/时间）后再尝试。' +
    '如有需要，请补充更准确的编号或时间范围。';

  const targets = statusRecords.length
    ? statusRecords
    : [{ meta: { chatid: '', senderid: '', messageid: '', text: '', queryInfo: {} }, binary: null }];

  return targets.map(({ meta }) => ({
    json: {
      success: false,
      message,
      chatid: meta.chatid || '',
      senderid: meta.senderid || '',
      messageid: meta.messageid || '',
      text: meta.text || '',
      queryInfo: meta.queryInfo || {},
    },
  }));
}

function matchStatusForResult(result) {
  return (
    statusRecords.find(({ meta }) => {
      const info = meta.queryInfo || {};

      // 投注记录匹配
      if (info.betId && norm(result.id) === norm(info.betId)) return true;
      if (info.roundId && norm(result.round_id) === norm(info.roundId)) return true;
      if (info.uid && norm(result.uid) === norm(info.uid)) return true;

      // 商户匹配（支持统计类查询结果）
      const merchant = norm(result.merchant_id || result.merchant);
      if (info.merchant && merchant && merchant.includes(norm(info.merchant))) return true;

      // 游戏信息匹配
      if (info.gameCode && result.game_code && norm(result.game_code).includes(norm(info.gameCode))) return true;
      if (info.gameId && result.game_id && norm(String(result.game_id)).includes(norm(String(info.gameId)))) return true;

      // 时间匹配（支持统计类查询结果的date_str字段）
      if (info.timeRange) {
        if (result.created_at) {
          const timeLower = norm(result.created_at).replace(/[-:]/g, ' ').replace(/\s+/g, ' ');
          if (timeLower.includes(norm(info.timeRange).replace(/[-:]/g, ' '))) return true;
        }
        // 匹配date_str字段（统计类查询结果）
        if (result.date_str) {
          const dateStr = String(result.date_str).replace(/[-:]/g, '');
          const timeRangeNorm = norm(info.timeRange).replace(/[^\d]/g, '');
          if (dateStr.includes(timeRangeNorm) || timeRangeNorm.includes(dateStr)) return true;
        }
      }

      // 文本匹配
      if (info.text && norm(JSON.stringify(result)).includes(norm(info.text))) return true;
      
      // 统计类查询结果匹配：如果有date_str和merchant，且查询文本包含相关关键词
      if (result.date_str && result.merchant) {
        const text = meta.text || '';
        if (/日活|活跃用户|DAU/i.test(text) && result.daily_active_users !== undefined) return true;
        if (/月活|MAU/i.test(text) && result.monthly_active_users !== undefined) return true;
        if (/累计投注|累计派奖/i.test(text) && (result.total_amount !== undefined || result.total_pay_out !== undefined)) return true;
      }
      
      return false;
    }) || null
  );
}

function formatMessage(result, meta, idx) {
  const headerLines = [];
  const info = meta?.queryInfo || {};

  if (info.merchant) headerLines.push(`- 商户：${info.merchant}`);
  if (info.betId) headerLines.push(`- 投注ID：${info.betId}`);
  if (info.uid) headerLines.push(`- 玩家ID：${info.uid}`);
  if (info.gameCode) headerLines.push(`- 游戏代码：${info.gameCode}`);
  if (info.timeRange) headerLines.push(`- 时间：${info.timeRange}`);

  const queryHeader = headerLines.length ? `📝 **查询条件**\n${headerLines.join('\n')}\n\n` : '';

  // 判断记录类型并生成相应的消息格式
  // 1. 统计类查询结果（日活、月活等）
  if (result.daily_active_users !== undefined || result.monthly_active_users !== undefined || 
      result.active_users !== undefined || result.retention_rate !== undefined) {
    let resultSection = `📊 **统计结果 ${idx}**\n\n`;
    
    if (result.date_str) {
      // 格式化日期：20251001 -> 2025-10-01
      const dateStr = String(result.date_str);
      if (dateStr.length === 8) {
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        resultSection += `📅 **日期**: ${formattedDate}\n`;
      } else {
        resultSection += `📅 **日期**: ${result.date_str}\n`;
      }
    }
    
    if (result.merchant || result.merchant_id) {
      resultSection += `🏢 **商户ID**: \`${result.merchant || result.merchant_id}\`\n`;
    }
    
    if (result.daily_active_users !== undefined) {
      resultSection += `👥 **日活用户数**: \`${result.daily_active_users}\`\n`;
    }
    
    if (result.monthly_active_users !== undefined) {
      resultSection += `👥 **月活用户数**: \`${result.monthly_active_users}\`\n`;
    }
    
    if (result.active_users !== undefined) {
      resultSection += `👥 **活跃用户数**: \`${result.active_users}\`\n`;
    }
    
    if (result.retention_rate !== undefined) {
      resultSection += `📈 **留存率**: \`${result.retention_rate}\`\n`;
    }
    
    return `${queryHeader}${resultSection}\n✅ 查询完成`;
  }

  // 2. 聚合汇总记录（累计投注、派奖等）
  if (result.total_amount !== undefined || result.total_pay_out !== undefined) {
    let resultSection = `💰 **汇总结果 ${idx}**\n\n`;
    
    if (result.merchant || result.merchant_id) {
      resultSection += `🏢 **商户ID**: \`${result.merchant || result.merchant_id}\`\n`;
    }
    
    if (result.currency) {
      resultSection += `💱 **币种**: \`${result.currency}\`\n`;
    }
    
    if (result.game_id) {
      resultSection += `🎮 **游戏ID**: \`${result.game_id}\`\n`;
    }
    
    if (result.total_amount !== undefined) {
      resultSection += `💵 **累计投注**: \`${result.total_amount}\`\n`;
    }
    
    if (result.total_pay_out !== undefined) {
      resultSection += `💸 **累计派奖**: \`${result.total_pay_out}\`\n`;
    }
    
    return `${queryHeader}${resultSection}\n✅ 查询完成`;
  }

  // 3. 投注记录（原有格式）
  return (
    `${queryHeader}🔍 **查询结果 ${idx}**\n\n` +
    `📋 **基本信息**\n- 投注ID: \`${result.id || 'N/A'}\`\n- 用户UID: \`${result.uid || 'N/A'}\`\n- 商户ID: \`${result.merchant_id || result.merchant || 'N/A'}\`\n- 游戏ID: \`${result.game_id || 'N/A'}\`\n\n` +
    `🎯 **游戏信息**\n- 游戏代码: \`${result.game_code || 'N/A'}\`\n- 游戏结果: ${result.result === '1' ? '✅ 获胜' : result.result === '0' ? '❌ 失败' : result.result || 'N/A'}\n- 倍数: \`${result.multiplier || 'N/A'}x\`\n\n` +
    `💰 **金额信息**\n- 投注金额: \`${result.amount || 'N/A'} ${result.currency || ''}\`\n- 派奖金额: \`${result.pay_out || 'N/A'} ${result.currency || ''}\`\n- 余额: \`${result.balance || 'N/A'} ${result.currency || ''}\`\n\n` +
    `⏰ **时间信息**\n- 创建时间: \`${result.created_at || 'N/A'}\`\n- 更新时间: \`${result.updated_at || 'N/A'}\`\n\n` +
    `✅ 查询完成`
  );
}

const outputs = [];

// 收集所有已处理的商户ID（用于检查缺失的商户）
const processedMerchants = new Set();

resultRecords.forEach(({ record: res, context }, idx) => {
  const matched = matchStatusForResult(res);
  const meta = matched?.meta || context || {};
  const message = formatMessage(res, meta, idx + 1);

  // 记录已处理的商户ID
  const merchant = res.merchant || res.merchant_id;
  if (merchant) {
    processedMerchants.add(String(merchant));
  }

  const json = {
    success: true,
    message,
    queryData: res,
    chatid: meta.chatid || '',
    senderid: meta.senderid || '',
    messageid: meta.messageid || '',
    text: meta.text || '',
    queryInfo: meta.queryInfo || {},
    filePresent: meta.filePresent ?? false,
    fileInfo: meta.fileInfo || null,
    resultIndex: idx + 1,
    totalCount: resultRecords.length,
  };

  outputs.push(
    matched?.binary?.data
      ? { json, binary: { [OUTPUT_BINARY_FIELD]: matched.binary } }
      : { json }
  );
});

// 检查是否有缺失的商户ID（查询了多个商户，但某些商户没有数据）
statusRecords.forEach(({ meta }) => {
  const queryInfo = meta.queryInfo || {};
  // 从queryInfo中获取商户ID集合（可能是Set或数组）
  let requestedMerchants = new Set();
  
  if (queryInfo.merchants) {
    // 如果merchants是Set，直接使用；如果是数组，转换为Set
    if (queryInfo.merchants instanceof Set) {
      requestedMerchants = queryInfo.merchants;
    } else if (Array.isArray(queryInfo.merchants)) {
      requestedMerchants = new Set(queryInfo.merchants.map(m => String(m)));
    }
  } else if (queryInfo.merchant) {
    // 如果只有一个商户，也添加到集合中
    requestedMerchants.add(String(queryInfo.merchant));
  }
  
  // 如果查询了多个商户，检查哪些商户没有数据
  if (requestedMerchants.size > 1) {
    requestedMerchants.forEach(merchantId => {
      if (!processedMerchants.has(String(merchantId))) {
        // 这个商户没有数据，生成提示消息
        const headerLines = [];
        if (queryInfo.timeRange) headerLines.push(`- 时间：${queryInfo.timeRange}`);
        
        const queryHeader = headerLines.length ? `📝 **查询条件**\n${headerLines.join('\n')}\n\n` : '';
        
        // 根据查询类型生成不同的消息
        let resultMessage = '';
        const text = meta.text || '';
        
        if (/日活|活跃用户|DAU/i.test(text)) {
          resultMessage = `📊 **日活统计结果**\n\n⚠️ 商户 \`${merchantId}\` 在指定时间范围内未查询到相关数据。\n\n`;
        } else if (/月活|MAU/i.test(text)) {
          resultMessage = `📊 **月活统计结果**\n\n⚠️ 商户 \`${merchantId}\` 在指定时间范围内未查询到相关数据。\n\n`;
        } else if (/累计投注|累计派奖|投注额|派奖额/i.test(text)) {
          resultMessage = `💰 **累计投注/派奖统计结果**\n\n⚠️ 商户 \`${merchantId}\` 在指定时间范围内未查询到相关数据。\n\n`;
        } else {
          resultMessage = `📄 **查询结果**\n\n⚠️ 商户 \`${merchantId}\` 未查询到相关数据。\n\n`;
        }
        
        const message = `${queryHeader}${resultMessage}✅ 查询完成`;
        
        // 检查是否已经为这个商户生成过输出
        const alreadyAdded = outputs.some(o => 
          o.json.messageid === meta.messageid &&
          o.json.chatid === meta.chatid &&
          o.json.senderid === meta.senderid &&
          o.json.missingMerchant === merchantId &&
          o.json.success === false
        );
        
        if (!alreadyAdded) {
          // 创建新的queryInfo对象，避免修改原始对象
          const newQueryInfo = { ...queryInfo };
          // 将Set转换为数组以便JSON序列化
          if (newQueryInfo.merchants instanceof Set) {
            newQueryInfo.merchants = Array.from(newQueryInfo.merchants);
          }
          newQueryInfo.merchant = merchantId;
          
          outputs.push({
            json: {
              success: false,
              message,
              chatid: meta.chatid || '',
              senderid: meta.senderid || '',
              messageid: meta.messageid || '',
              text: meta.text || '',
              queryInfo: newQueryInfo,
              missingMerchant: merchantId,
            },
          });
        }
      }
    });
  }
});

statusRecords.forEach(({ meta, binary }) => {
  // 检查是否已经被resultRecords覆盖
  // 使用更精确的匹配条件：主要基于messageid、chatid、senderid
  const alreadyCovered = outputs.some((o) => {
    // 精确匹配：messageid、chatid、senderid都相同（这是最可靠的匹配方式）
    if (o.json.messageid === meta.messageid && 
        o.json.chatid === meta.chatid && 
        o.json.senderid === meta.senderid &&
        o.json.success === true) {
      return true;
    }
    
    // 如果messageid相同，且输出是成功的，也视为已覆盖
    if (o.json.messageid === meta.messageid && o.json.success === true) {
      return true;
    }
    
    // 检查queryInfo中的betId是否匹配（对于投注记录查询）
    const metaBetId = meta.queryInfo?.betId;
    const outputQueryData = o.json.queryData;
    if (metaBetId && outputQueryData?.id && norm(metaBetId) === norm(outputQueryData.id) && o.json.success === true) {
      return true;
    }
    
    return false;
  });
  
  if (!alreadyCovered) {
    const json = {
      success: false,
      message: '未匹配到对应结果',
      chatid: meta.chatid || '',
      senderid: meta.senderid || '',
      messageid: meta.messageid || '',
      text: meta.text || '',
      queryInfo: meta.queryInfo,
    };
    outputs.push(
      binary?.data
        ? { json, binary: { [OUTPUT_BINARY_FIELD]: binary } }
        : { json }
    );
  }
});

return outputs;

