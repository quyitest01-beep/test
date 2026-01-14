// 准备发送到Telegram的数据
const inputData = $input.all();

console.log('=== 准备Telegram数据 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据长度:', inputData.length);

// 检查输入数据
if (!inputData || !Array.isArray(inputData) || inputData.length < 2) {
  return {
    success: false,
    error: '输入数据格式不正确，需要格式化消息和导出结果',
    debugInfo: {
      inputType: typeof inputData,
      isArray: Array.isArray(inputData),
      length: inputData ? inputData.length : 'undefined'
    }
  };
}

// 获取格式化消息和导出结果
let formattedMessage = inputData[0].json;
let exportResult = inputData[1].json;

console.log('格式化消息类型:', typeof formattedMessage);
console.log('导出结果类型:', typeof exportResult);

// 如果数据是数组，取第一个元素
if (Array.isArray(formattedMessage)) {
  formattedMessage = formattedMessage[0];
}
if (Array.isArray(exportResult)) {
  exportResult = exportResult[0];
}

console.log('处理后的格式化消息:', formattedMessage);
console.log('处理后的导出结果:', exportResult);

// 检查必要字段
if (!formattedMessage || !formattedMessage.message) {
  return {
    success: false,
    error: '格式化消息数据不正确',
    debugInfo: {
      hasMessage: !!formattedMessage?.message,
      formattedMessageKeys: formattedMessage ? Object.keys(formattedMessage) : 'undefined'
    }
  };
}

if (!exportResult || !exportResult.data || !exportResult.data.downloadUrls) {
  return {
    success: false,
    error: '导出结果数据不正确',
    debugInfo: {
      hasData: !!exportResult?.data,
      hasDownloadUrls: !!exportResult?.data?.downloadUrls,
      exportResultKeys: exportResult ? Object.keys(exportResult) : 'undefined'
    }
  };
}

// 获取下载URL
const downloadUrl = exportResult.data.downloadUrls[0];
if (!downloadUrl) {
  return {
    success: false,
    error: '没有找到下载链接',
    debugInfo: {
      downloadUrls: exportResult.data.downloadUrls
    }
  };
}

// 构建完整的文件URL
const baseUrl = 'https://ebooks-life-point-interactions.trycloudflare.com';
const fullFileUrl = baseUrl + downloadUrl.url;

console.log('完整文件URL:', fullFileUrl);

// 准备Telegram发送数据
const telegramData = {
  // Telegram配置 - 这些值需要从环境变量或配置中获取
  telegramBotToken: 'YOUR_BOT_TOKEN', // 需要替换为实际的Bot Token
  chatId: -1003129050838, // 从查询结果中获取的chatId
  
  // 消息内容
  message: formattedMessage.message,
  
  // 文件信息
  fileUrl: fullFileUrl,
  fileName: downloadUrl.filename,
  fileSize: downloadUrl.size,
  fileRows: downloadUrl.rows,
  
  // 查询摘要
  summary: formattedMessage.summary,
  
  // 导出信息
  exportInfo: {
    queryId: exportResult.data.queryId,
    format: exportResult.data.format,
    totalRows: exportResult.data.totalRows,
    files: exportResult.data.files
  }
};

console.log('准备完成的Telegram数据:', {
  messageLength: telegramData.message.length,
  fileName: telegramData.fileName,
  fileSize: telegramData.fileSize,
  fileRows: telegramData.fileRows
});

// 返回结果
const result = {
  success: true,
  telegramData: telegramData,
  message: `准备完成！将发送${telegramData.fileRows}行数据到Telegram群组`,
  debugInfo: {
    messageLength: telegramData.message.length,
    fileName: telegramData.fileName,
    fileSize: telegramData.fileSize,
    fileRows: telegramData.fileRows,
    downloadUrl: fullFileUrl
  }
};

console.log('数据准备完成:', result.message);
return result;









