// n8n Code 节点：构建 Lark 消息卡片内容

// 输入：上游查询结果数据（包含 fileInfo、messageText 等）
// 输出：Lark 消息卡片 JSON 字符串，用于 HTTP Request 节点发送

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

// 从所有 items 中收集必要字段（处理 Merge 节点合并后的数据）
let globalChatId = '';
let globalTenantAccessToken = '';

items.forEach(item => {
  const json = item.json || {};
  if (!globalChatId && (json.chatid || json.receive_id || json.chat_id || json.chatId)) {
    globalChatId = json.chatid || json.receive_id || json.chat_id || json.chatId;
  }
  if (!globalTenantAccessToken && json.tenant_access_token) {
    globalTenantAccessToken = json.tenant_access_token;
  }
});

// 处理每个输入项（只处理包含查询结果的 items）
const outputs = items
  .filter(item => {
    const json = item.json || {};
    // 只处理包含查询相关字段的 items（跳过只有 token 的 items）
    return json.queryId || json.text || json.result || json.chatid;
  })
  .map(item => {
    const json = item.json || {};
    
    // 提取关键信息
    const queryText = json.text || '查询请求';
    const queryId = json.queryId || '';
    const result = json.result || '查询完成';
    const recordCount = json.recordCount || 0;
    const fileInfo = json.fileInfo || {};
    const fileName = json.fileName || fileInfo.fileName || '查询结果.csv';
    const fileSize = fileInfo.formattedSize || (fileInfo.fileSizeKB ? `${fileInfo.fileSizeKB} KB` : '');
    const messageText = json.messageText || '';
    
    // 构建 Lark 消息卡片（使用简单的 plain_text 展示）
    const card = {
      config: {
        wide_screen_mode: false
      },
      header: {
        template: 'blue',
        title: { content: '📊 查数结果', tag: 'plain_text' }
      },
      elements: []
    };
    
    const addPlainBlock = (content) => {
      card.elements.push({
        tag: 'div',
        text: {
          tag: 'plain_text',
          content
        }
      });
    };
    
    addPlainBlock(`查询内容\n${queryText}`);
    card.elements.push({ tag: 'hr' });
    card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'plain_text',
            content: `查询状态\n${result === '查询完成' ? '✅ 已完成' : result}`
          }
        },
        {
          is_short: true,
          text: {
            tag: 'plain_text',
            content: `记录数\n${recordCount.toLocaleString()} 条`
          }
        }
      ]
    });
    
    // 检查是否有二进制文件数据
    const binaryData = item.binary || {};
    const possibleBinaryFields = ['csv', 'data', 'file', 'document'];
    let hasBinaryFile = false;
    let binaryFieldName = null;
    
    for (const field of possibleBinaryFields) {
      if (binaryData[field] && binaryData[field].data) {
        hasBinaryFile = true;
        binaryFieldName = field;
        break;
      }
    }
    
    if (messageText && String(messageText).trim()) {
      card.elements.push({ tag: 'hr' });
      addPlainBlock(String(messageText).replace(/\n/g, '\n'));
    }
    
    // 添加查询ID（用于追踪）
    if (queryId) {
      card.elements.push(
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: `查询ID: ${queryId}`
            }
          ]
        }
      );
    }
    
    // 将卡片对象转换为 JSON 字符串（Lark API 要求 content 字段是 JSON 字符串）
    const cardContent = JSON.stringify(card);
    
    // 确保 receive_id 不为空（优先使用当前 item，否则使用全局值）
    const receiveId = json.chatid || json.receive_id || json.chat_id || json.chatId || globalChatId || '';
    if (!receiveId) {
      console.error('❌ receive_id 为空！');
      console.error('当前 item 字段:', Object.keys(json));
      console.error('所有 items 中的 chatid 相关字段:', 
        items.map((item, idx) => ({
          index: idx,
          chatid: item.json?.chatid,
          receive_id: item.json?.receive_id,
          chat_id: item.json?.chat_id,
          chatId: item.json?.chatId
        }))
      );
      throw new Error('receive_id 为空，无法发送消息。请确保上游数据包含 chatid 字段。');
    }
    
    console.log('✅ receive_id 提取成功:', receiveId);
    
    // 确保 tenant_access_token 存在（优先使用当前 item，否则使用全局值）
    const tenantAccessToken = json.tenant_access_token || globalTenantAccessToken || '';
    
    if (!tenantAccessToken) {
      console.warn('⚠️ tenant_access_token 为空，请检查上游数据');
    }
    
    // 提取 messageid（用于回复消息）
    const messageId = json.messageid || json.message_id || '';
    
    // 构建完整的 Lark API 请求体对象
    const requestBody = {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: cardContent // JSON 字符串
    };
    
    // 将请求体转换为 JSON 字符串（用于 HTTP Request 节点的表达式模式）
    const requestBodyJson = JSON.stringify(requestBody);
    
    // 构建 HTTP Request 节点可直接使用的字段
    const httpRequest = {
      url: messageId 
        ? `https://open.larksuite.com/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/reply`
        : 'https://open.larksuite.com/open-apis/im/v1/messages',
      method: messageId ? 'POST' : 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: requestBody
    };
    
    const output = {
      json: {
        ...json,
        // Lark API 请求体对象（用于 "Using JSON" 模式）
        ...requestBody,
        // 完整的请求体 JSON 字符串（用于 "Using Expression" 模式，推荐）
        requestBodyJson: requestBodyJson,
        // HTTP Request 节点可直接使用的配置（推荐使用这个）
        httpRequest: httpRequest,
        // 保留原始数据用于调试
        card: card,
        cardContent: cardContent,
        // 确保 tenant_access_token 存在
        tenant_access_token: tenantAccessToken,
        // 保留 receive_id_type 用于 URL 查询参数
        receive_id_type: 'chat_id',
        // 保留 messageid 用于回复消息
        messageid: messageId,
        // 文件上传相关标记
        hasBinaryFile: hasBinaryFile,
        binaryFieldName: binaryFieldName,
        fileName: fileName,
        needsFileUpload: hasBinaryFile && json.filePresent,
        // 云盘 API 所需字段
        size: fileInfo.fileSizeBytes || 0,
        binaryProperty: binaryFieldName || 'csv' // 用于 formBinaryData 的 inputDataFieldName
      }
    };
    
    // 如果有二进制文件数据，保留在输出中
    if (hasBinaryFile && binaryFieldName) {
      output.binary = {
        [binaryFieldName]: binaryData[binaryFieldName]
      };
    }
    
    return output;
  });

return outputs;

