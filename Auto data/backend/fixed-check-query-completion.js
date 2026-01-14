// 适配 /api/export/batch-query-result 的返回
// 输入: HTTP Request 的响应 $json
// 输出: 每个 query 一条 item，包含完成状态/行数/下载信息等

const inputData = $input.all();
console.log('=== 检查查询是否完成 ===');
console.log('输入数据数量:', inputData.length);

const results = [];

// 处理每个输入项
for (let i = 0; i < inputData.length; i++) {
  const resp = inputData[i].json;
  console.log(`处理第${i+1}个响应:`, resp);
  
  const batchResults = resp?.data?.results || [];
  if (!Array.isArray(batchResults) || batchResults.length === 0) {
    console.log(`第${i+1}个响应没有结果，跳过`);
    continue;
  }

  // 将每个查询结果展开为 item
  const items = batchResults.map(r => {
    const ok = !!r.success;
    const files = r?.data?.files || [];
    const downloadUrls = r?.data?.downloadUrls || [];
    const totalRows = r?.data?.totalRows ?? files.reduce((s,f)=>s+(f.rows||0), 0);
    const execTime = r?.data?.result?.executionTime || 0;

    // 包装在json键下，避免保留字段冲突
    return {
      json: {
        queryId: r.queryId,
        isCompleted: ok,
        hasResults: ok && totalRows > 0,
        rowCount: totalRows,
        executionTime: execTime,
        files,               // [{filename, size, rows, ...}]
        downloadUrls,        // [{filename, url, size, rows}]
        // 便于后续直接取第一个下载链接
        firstDownloadUrl: downloadUrls[0]?.url || '',
        firstFilename: files[0]?.filename || '',
        message: ok ? 'success' : (r.error || 'failed'),
        errorMessage: ok ? undefined : r.error  // 使用errorMessage而不是error
      }
    };
  });
  
  results.push(...items);
}

console.log('总共处理了', results.length, '个查询结果');

// 如果没有结果，返回一个默认项
if (results.length === 0) {
  return [{
    json: {
      isCompleted: false,
      rowCount: 0,
      executionTime: 0,
      hasResults: false,
      message: 'No results',
      errorMessage: 'No results'
    }
  }];
}

// 返回所有结果，每个结果作为单独的输出项
return results;









