// 批量下载处理器 - 替换"获取下载文件"HTTP Request节点
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

const allDownloadResults = [];

// 处理每个输入项（每个查询结果）
for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i].json;
  console.log(`处理第${i+1}项查询结果:`, item);
  
  // 检查是否有下载URL
  if (item.data && item.data.results && Array.isArray(item.data.results)) {
    for (const result of item.data.results) {
      if (result.success && result.data && result.data.downloadUrls) {
        console.log(`查询 ${result.queryId} 有 ${result.data.downloadUrls.length} 个下载URL`);
        
        for (const downloadUrl of result.data.downloadUrls) {
          const downloadResult = {
            queryId: result.queryId,
            filename: downloadUrl.filename,
            url: downloadUrl.url,
            size: downloadUrl.size,
            rows: downloadUrl.rows,
            fullUrl: `https://ebooks-life-point-interactions.trycloudflare.com${downloadUrl.url}`,
            success: true,
            downloadReady: true,
            message: `准备下载文件: ${downloadUrl.filename} (${downloadUrl.size} 字节, ${downloadUrl.rows} 行)`
          };
          
          allDownloadResults.push(downloadResult);
          console.log(`添加下载URL: ${downloadResult.fullUrl}`);
        }
      } else {
        console.log(`查询 ${result.queryId} 没有下载URL或查询失败`);
      }
    }
  } else {
    console.log(`第${i+1}项没有有效的查询结果数据`);
  }
}

console.log('总共提取到的下载URL数量:', allDownloadResults.length);
console.log('所有下载URL列表:', allDownloadResults.map(r => r.fullUrl));

if (allDownloadResults.length === 0) {
  return {
    success: false,
    error: '没有找到可下载的文件',
    downloadResults: [],
    totalFiles: 0,
    totalSize: 0,
    totalRows: 0
  };
}

// 计算统计信息
const totalSize = allDownloadResults.reduce((sum, r) => sum + (r.size || 0), 0);
const totalRows = allDownloadResults.reduce((sum, r) => sum + (r.rows || 0), 0);

// 返回所有下载信息
const result = {
  success: true,
  message: `成功提取 ${allDownloadResults.length} 个下载文件`,
  totalFiles: allDownloadResults.length,
  totalSize: totalSize,
  totalRows: totalRows,
  downloadResults: allDownloadResults,
  // 为每个下载文件创建一个单独的输出项
  files: allDownloadResults.map((result, index) => ({
    ...result,
    index: index + 1,
    downloadUrl: result.fullUrl,
    readyForDownload: true
  }))
};

console.log('批量下载处理完成:', {
  totalFiles: result.totalFiles,
  totalSize: result.totalSize,
  totalRows: result.totalRows
});

return result;
