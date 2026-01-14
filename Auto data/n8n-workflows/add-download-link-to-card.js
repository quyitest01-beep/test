// n8n Code 节点：为 Lark 消息卡片添加文件下载链接

// 输入：上传文件节点的输出（包含 file_key）和原始卡片数据
// 输出：更新后的卡片内容，包含下载按钮

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

// 从所有 items 中收集数据（处理 Merge 节点合并后的数据）
let cardContentString = null;
let fileKey = null;
let messageData = null;
let fileData = null;
let globalTenantAccessToken = null;

items.forEach(item => {
  const json = item.json || {};
  
  // 收集 tenant_access_token（从所有 items 中查找）
  if (!globalTenantAccessToken) {
    globalTenantAccessToken = json.tenant_access_token 
      || json.tenantAccessToken 
      || json.data?.tenant_access_token
      || '';
  }
  
  // 查找卡片内容（支持多种路径）
  if (!cardContentString) {
    // 1. 从 data.body.content 获取（Lark 消息响应格式）
    if (json.data?.body?.content) {
      cardContentString = json.data.body.content;
      messageData = json.data;
    }
    // 2. 从 requestBodyJson 解析
    else if (json.requestBodyJson) {
      try {
        const requestBody = JSON.parse(json.requestBodyJson);
        if (requestBody.content) {
          cardContentString = requestBody.content;
        }
      } catch (e) {
        console.warn('解析 requestBodyJson 失败:', e.message);
      }
    }
    // 3. 从 cardContent 字段获取
    else if (json.cardContent) {
      cardContentString = json.cardContent;
    }
  }
  
  // 查找 file_key（支持多种路径）
  if (!fileKey) {
    fileKey = json.file_key 
      || json.file_token 
      || json.data?.file_key 
      || json.data?.file_token
      || json.response?.data?.file_key
      || json.response?.data?.file_token;
    
    if (fileKey) {
      fileData = json.data || json;
    }
  }
});

// 检查必要数据
if (!cardContentString) {
  console.error('❌ 未找到卡片内容');
  console.error('可用字段:', items.map((item, idx) => ({
    index: idx,
    keys: Object.keys(item.json || {}),
    hasDataBody: !!item.json?.data?.body,
    hasRequestBodyJson: !!item.json?.requestBodyJson
  })));
  throw new Error('未找到卡片内容。请检查上游数据是否包含 data.body.content 或 requestBodyJson');
}

if (!fileKey) {
  console.warn('⚠️ 未找到 file_key，无法添加下载链接');
  // 如果没有 file_key，直接返回原始数据
  return items.map(item => ({
    json: {
      ...item.json,
      hasDownloadLink: false
    }
  }));
}

console.log('✅ 找到 file_key:', fileKey);
console.log('✅ 找到卡片内容字符串');

// 构建下载链接
// Lark 文件下载 API：https://open.feishu.cn/open-apis/drive/v1/medias/{file_key}/download
const downloadUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/${fileKey}/download`;

// 解析卡片内容
let card;
let isTwoDimensional = false; // 在外部定义，确保作用域正确

try {
  // cardContentString 可能是 JSON 字符串，需要解析
  if (typeof cardContentString === 'string') {
    card = JSON.parse(cardContentString);
  } else {
    card = cardContentString;
  }
  
  // 检查卡片格式（Lark 卡片可能是数组格式或对象格式）
  if (Array.isArray(card)) {
    // 如果是数组格式，需要转换为对象格式
    card = {
      title: "📊 查数结果",
      elements: card
    };
  }
  
  // 确保卡片符合 Lark 标准格式
  // 如果只有 title 和 elements，需要添加 config 和 header
  if (!card.config) {
    card.config = {
      wide_screen_mode: true
    };
  }
  if (!card.header) {
    card.header = {
      template: "blue",
      title: {
        content: card.title || "📊 查数结果",
        tag: "plain_text"
      }
    };
  }
  
  // 确保 elements 存在
  if (!card.elements || !Array.isArray(card.elements)) {
    throw new Error('卡片格式错误：缺少 elements 数组');
  }
  
  // 检查 elements 是否是二维数组（Lark 卡片格式）
  isTwoDimensional = card.elements.length > 0 && Array.isArray(card.elements[0]);
  
  // 如果是二维数组，需要转换为一维数组（Lark API 更新消息时需要标准格式）
  if (isTwoDimensional) {
    console.log('⚠️ 检测到二维数组格式，转换为标准 Lark 卡片格式');
    // 将二维数组转换为一维数组
    // 根据 Lark 卡片规范，elements 应该是一维数组，每个元素是一个对象
    const flattenedElements = [];
    card.elements.forEach(row => {
      if (Array.isArray(row)) {
        // 遍历这一行的所有元素
        row.forEach(element => {
          if (element && typeof element === 'object' && !Array.isArray(element)) {
            // 确保元素是对象，不是数组或其他类型
            flattenedElements.push(element);
          }
        });
      } else if (row && typeof row === 'object' && !Array.isArray(row)) {
        // 如果这一行本身就是对象，直接添加
        flattenedElements.push(row);
      }
    });
    card.elements = flattenedElements;
    isTwoDimensional = false; // 转换后不再是一维数组
    console.log('✅ 已转换为一维数组格式，元素数量:', flattenedElements.length);
    
    // 验证转换后的格式
    const invalidElements = flattenedElements.filter(el => !el || typeof el !== 'object' || Array.isArray(el));
    if (invalidElements.length > 0) {
      console.warn('⚠️ 发现无效元素:', invalidElements.length);
    }
  }
  
  console.log('✅ 卡片解析成功，elements 格式:', isTwoDimensional ? '二维数组' : '一维数组');
} catch (e) {
  console.error('❌ 解析卡片内容失败:', e.message);
  console.error('卡片内容字符串:', cardContentString?.substring(0, 200));
  throw new Error('解析卡片内容失败: ' + e.message);
}

// 查找并更新按钮（转换后 elements 已经是一维数组）
let buttonFound = false;
let buttonIndex = -1;

// 在一维数组中查找按钮
for (let i = 0; i < card.elements.length; i++) {
  const element = card.elements[i];
  if (element && element.tag === 'button' && element.text && element.text.includes('下载')) {
    buttonFound = true;
    buttonIndex = i;
    break;
  }
}

// 创建下载按钮对象
const downloadButton = {
  "tag": "button",
  "text": "📥 下载文件",
  "type": "primary",
  "url": downloadUrl
};

// 更新或添加按钮（转换后 elements 已经是一维数组）
if (buttonFound) {
  // 更新现有按钮的 URL
  card.elements[buttonIndex].url = downloadUrl;
  console.log('✅ 更新现有下载按钮，索引:', buttonIndex);
} else {
  // 未找到按钮，需要添加
  // 找到文件信息元素的位置
  let insertIndex = -1;
  for (let i = 0; i < card.elements.length; i++) {
    const element = card.elements[i];
    if (element && element.text && typeof element.text === 'string' && element.text.includes('查询结果文件')) {
      insertIndex = i + 1;
      break;
    }
  }
  
  // 在一维数组中添加按钮
  if (insertIndex < 0) insertIndex = card.elements.length;
  card.elements.splice(insertIndex, 0, downloadButton);
  console.log('✅ 添加新下载按钮，索引:', insertIndex);
}

// 重新构建卡片内容字符串
const updatedCardContent = JSON.stringify(card);

// 处理每个输入项
const outputs = items.map(item => {
  const json = item.json || {};
  
  // 构建输出对象
  const output = {
    ...json
  };
  
  // 如果原始数据是 data.body.content 格式，更新它
  if (json.data && json.data.body && json.data.body.content) {
    output.data = {
      ...json.data,
      body: {
        ...json.data.body,
        content: updatedCardContent
      }
    };
  }
  
  // 如果原始数据有 requestBodyJson，更新它
  if (json.requestBodyJson) {
    try {
      const requestBody = JSON.parse(json.requestBodyJson);
      requestBody.content = updatedCardContent;
      output.requestBodyJson = JSON.stringify(requestBody);
    } catch (e) {
      console.warn('更新 requestBodyJson 失败:', e.message);
    }
  }
  
  // 添加通用字段
  output.card = card;
  output.cardContent = updatedCardContent;
  output.file_key = fileKey;
  output.downloadUrl = downloadUrl;
  output.hasDownloadLink = true;
  
  // 构建更新消息的请求对象（用于 PATCH 请求）
  // 从原始数据中获取 message_id 和 chat_id
  const messageId = json.data?.message_id || json.message_id || json.messageId || messageData?.message_id || '';
  const chatId = json.data?.chat_id || json.chatid || json.chat_id || json.chatId || messageData?.chat_id || '';
  const tenantAccessToken = json.tenant_access_token || globalTenantAccessToken || '';
  
  // 调试信息
  console.log('🔍 构建 update_request 所需字段:', {
    messageId: messageId || '未找到',
    chatId: chatId || '未找到',
    tenantAccessToken: tenantAccessToken ? `${tenantAccessToken.substring(0, 20)}...` : '未找到',
    hasMessageData: !!messageData,
    hasGlobalToken: !!globalTenantAccessToken
  });
  
  if (messageId && chatId && tenantAccessToken) {
    // Lark API 更新消息的 URL
    // https://open.larksuite.com/open-apis/im/v1/messages/{message_id}
    const updateUrl = `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}?receive_id_type=chat_id`;
    
    // 构建更新请求体
    // Lark API 更新消息时，content 字段应该是 JSON 字符串
    // 根据 Lark API 文档：PATCH /open-apis/im/v1/messages/{message_id}
    // 请求体格式：{ "content": "JSON字符串" }
    const updateBody = {
      content: updatedCardContent  // updatedCardContent 已经是 JSON 字符串
    };
    
    // 构建完整的更新请求对象
    output.update_request = {
      url: updateUrl,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${tenantAccessToken}`
      },
      body: updateBody,
      // 同时提供 JSON 字符串格式，以防需要
      bodyJson: JSON.stringify(updateBody),
      // 调试信息
      _debug: {
        messageId: messageId,
        chatId: chatId,
        contentLength: updatedCardContent.length,
        contentPreview: updatedCardContent.substring(0, 100) + '...'
      }
    };
    
    console.log('✅ 构建更新请求对象成功:', {
      url: updateUrl,
      hasHeaders: !!output.update_request.headers,
      hasBody: !!output.update_request.body,
      bodyContent: updateBody.content.substring(0, 200) + '...'
    });
  } else {
    console.error('❌ 缺少必要字段，无法构建更新请求:', {
      messageId: messageId || '缺失',
      chatId: chatId || '缺失',
      tenantAccessToken: tenantAccessToken ? '存在' : '缺失'
    });
    console.error('可用字段:', Object.keys(json));
    
    // 即使缺少字段，也输出一个空的 update_request 结构，方便调试
    output.update_request = {
      url: messageId ? `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}?receive_id_type=chat_id` : '',
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": tenantAccessToken ? `Bearer ${tenantAccessToken}` : ''
      },
      body: {
        content: updatedCardContent
      },
      _error: '缺少必要字段',
      _missing: {
        messageId: !messageId,
        chatId: !chatId,
        tenantAccessToken: !tenantAccessToken
      }
    };
  }
  
  return {
    json: output
  };
});

return outputs;

