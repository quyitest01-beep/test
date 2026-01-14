// 修复版查询完成检查器
// 专门处理CSV文件元数据格式

const inputData = $input.all();
console.log('=== 检查查询是否完成 (修复版) ===');
console.log('输入数据数量:', inputData.length);

const results = [];

// 处理每个输入项
for (let i = 0; i < inputData.length; i++) {
  const resp = inputData[i].json;
  console.log(`处理第${i+1}个输入项:`, JSON.stringify(resp, null, 2));
  
  // 检查是否是CSV文件元数据格式
  if (resp.data && resp.data.fileName && resp.data.fileName.endsWith('.csv')) {
    const fileName = resp.data.fileName;
    const fileSize = resp.data.fileSize || '0 kB';
    const mimeType = resp.data.mimeType || 'application/octet-stream';
    
    // 从文件名提取queryId（去掉.csv后缀）
    const queryId = fileName.replace('.csv', '');
    
    console.log(`✅ 识别到CSV文件: ${fileName}, 大小: ${fileSize}`);
    
    results.push({
      json: {
        queryId: queryId,
        isCompleted: true,
        hasResults: true,
        rowCount: 0, // 元数据中没有行数信息
        executionTime: 0,
        files: [{
          filename: fileName,
          size: fileSize,
          mimeType: mimeType
        }],
        downloadUrls: [],
        firstDownloadUrl: '',
        firstFilename: fileName,
        message: '查询执行成功！',
        errorMessage: undefined
      }
    });
  }
  // 兼容API响应格式
  else if (resp.data && resp.data.results) {
    console.log(`📊 处理API响应格式数据`);
    const batchResults = resp.data.results;
    if (Array.isArray(batchResults) && batchResults.length > 0) {
      const items = batchResults.map(r => {
        const files = r?.data?.files || [];
        const downloadUrls = r?.data?.downloadUrls || [];
        const totalRows = r?.data?.totalRows ?? files.reduce((s,f)=>s+(f.rows||0), 0);
        const execTime = r?.data?.result?.executionTime || 0;

        const hasCsvFile = files.some(file => 
          file.filename && file.filename.endsWith('.csv')
        );
        
        const isCompleted = hasCsvFile;
        const hasResults = isCompleted && totalRows > 0;

        return {
          json: {
            queryId: r.queryId,
            isCompleted: isCompleted,
            hasResults: hasResults,
            rowCount: totalRows,
            executionTime: execTime,
            files,
            downloadUrls,
            firstDownloadUrl: downloadUrls[0]?.url || '',
            firstFilename: files[0]?.filename || '',
            message: isCompleted ? '查询执行成功！' : '查询执行失败！',
            errorMessage: isCompleted ? undefined : 'No CSV file generated'
          }
        };
      });
      
      results.push(...items);
    }
  }
  // 其他格式的数据
  else {
    console.log(`⚠️ 第${i+1}个输入项无法识别:`, {
      hasData: !!resp.data,
      dataKeys: resp.data ? Object.keys(resp.data) : [],
      fileName: resp.data?.fileName,
      fileExtension: resp.data?.fileExtension,
      mimeType: resp.data?.mimeType
    });
  }
}

console.log('=== 处理完成 ===');
console.log('总共处理了', results.length, '个文件/查询结果');

// 如果没有结果，返回一个默认项
if (results.length === 0) {
  console.log('❌ 没有找到任何结果，返回默认值');
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

console.log('✅ 成功处理', results.length, '个结果');
return results;
