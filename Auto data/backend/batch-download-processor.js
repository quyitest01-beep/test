// 批量下载处理器 - 处理多个下载URL
const inputData = $input.all();

console.log('=== 批量下载处理器 ===');
console.log('输入数据数量:', inputData.length);

if (!inputData || inputData.length === 0) {
  return {
    success: false,
    error: '没有输入数据',
    downloadResults: []
  };
}

const downloadResults = [];

// 处理每个输入项
for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i].json;
  console.log(`处理第${i+1}项:`, item);
  
  // 检查是否有下载URL
  if (item.data && item.data.results && Array.isArray(item.data.results)) {
    for (const result of item.data.results) {
      if (result.success && result.data && result.data.downloadUrls) {
        for (const downloadUrl of result.data.downloadUrls) {
          downloadResults.push({
            queryId: result.queryId,
            filename: downloadUrl.filename,
            url: downloadUrl.url,
            size: downloadUrl.size,
            rows: downloadUrl.rows,
            fullUrl: `https://ebooks-life-point-interactions.trycloudflare.com${downloadUrl.url}`,
            success: true
          });
        }
      }
    }
  }
}

console.log('提取到的下载URL数量:', downloadResults.length);
console.log('下载URL列表:', downloadResults);

if (downloadResults.length === 0) {
  return {
    success: false,
    error: '没有找到可下载的文件',
    downloadResults: []
  };
}

// 返回所有下载信息
return downloadResults.map(result => ({
  ...result,
  message: `准备下载文件: ${result.filename}`,
  downloadReady: true
}));









