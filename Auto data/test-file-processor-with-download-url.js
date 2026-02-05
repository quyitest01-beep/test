// 测试修复后的文件处理器是否正确处理downloadUrl
const testData = [
  // 数据库记录
  {
    json: {
      queryId: "81556de6-88db-4122-84e8-44c926f82054",
      result: "查询已启动，正在执行中...",
      senderid: "g7492aa2",
      chatid: "oc_da0ab0d3b6a104f72f3a4c8f00ecddaa",
      messageid: "om_x100b571fafd358a4e1046b7c646e9aa",
      text: "查一下用户 ydb3626-ded703379f4c462981ca4ee8f5c838d0 在20260128-0203的全部投注记录",
      sql: "SELECT * FROM gmp.game_records WHERE uid = 'ydb3626-ded703379f4c462981ca4ee8f5c838d0'",
      id: 252,
      createdAt: "2026-02-04T03:36:32.291Z",
      updatedAt: "2026-02-04T03:53:26.577Z"
    }
  },
  // 批量查询结果（包含downloadUrl）
  {
    json: {
      success: true,
      data: [
        {
          queryId: "81556de6-88db-4122-84e8-44c926f82054",
          success: true,
          fileSize: {
            totalSizeBytes: 8800172,
            totalSizeMB: 8.3925,
            totalSizeGB: 0.0082,
            fileCount: 1,
            formattedSize: "8.39 MB",
            contentType: "application/octet-stream",
            lastModified: "2026-02-04T03:38:38.000Z"
          },
          recommendation: {
            action: "direct_process",
            message: "文件较小，建议直接处理",
            reason: "文件大小 8.39 MB，可以直接下载并处理",
            threshold: "small",
            maxSize: 10
          },
          bucket: "aws-athena-query-results-us-west-2-034986963036",
          fileKey: "81556de6-88db-4122-84e8-44c926f82054.csv",
          downloadUrl: "https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/81556de6-88db-4122-84e8-44c926f82054.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAQQJLCWBOOKC7J6ZI%2F20260204%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20260204T054401Z&X-Amz-Expires=900&X-Amz-Signature=d3a416c14491128146e57329c9852cde18dcd3ef42834f4546ee23a150b79a89&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
        }
      ],
      totalQueries: 1,
      successfulQueries: 1,
      failedQueries: 0,
      requestId: "req_1770183839937_6faevufxm"
    }
  }
];

// 模拟n8n环境
const $input = {
  all: () => testData
};

// 执行修复后的文件处理器代码
console.log('=== 测试修复后的文件处理器 ===');

try {
  // 这里应该包含修复后的文件处理器代码
  const items = $input.all();

  if (!items.length) {
    throw new Error('未收到上游数据');
  }

  const BINARY_FIELD = 'data';
  const OUTPUT_BINARY_FIELD = 'csv';
  const LIMIT_MB = 5;

  const dbRecords = [];
  const batchResults = new Map();

  items.forEach(item => {
    const json = item.json;
    
    if (json.success === true && json.data && Array.isArray(json.data)) {
      json.data.forEach(result => {
        if (result.queryId && result.success) {
          batchResults.set(result.queryId, {
            fileSize: result.fileSize,
            recommendation: result.recommendation,
            fileKey: result.fileKey,
            bucket: result.bucket,
            downloadUrl: result.downloadUrl  // ✅ 修复：保存下载链接
          });
        }
      });
    } else if (json.queryId) {
      dbRecords.push({
        json: json,
        binary: item.binary || null
      });
    }
  });

  const map = new Map();

  dbRecords.forEach((item, idx) => {
    const queryId = item.json.queryId;
    if (!queryId) return;

    if (!map.has(queryId)) {
      map.set(queryId, {
        queryId,
        meta: { ...item.json },
        hasFile: false,
        fileBinary: null,
        fileInfo: null,
        fileSizeInfo: null,
        downloadUrl: null   // ✅ 修复：添加下载链接字段
      });
    }

    const entry = map.get(queryId);
    entry.meta = { ...entry.meta, ...item.json };

    const batchResult = batchResults.get(queryId);
    if (batchResult) {
      entry.fileSizeInfo = {
        fileSize: batchResult.fileSize,
        recommendation: batchResult.recommendation,
        fileKey: batchResult.fileKey,
        bucket: batchResult.bucket
      };
      
      // ✅ 修复：保存下载链接
      entry.downloadUrl = batchResult.downloadUrl;

      if (batchResult.fileSize) {
        const sizeMB = batchResult.fileSize.totalSizeMB || 0;
        
        entry.fileInfo = {
          fileName: batchResult.fileKey || `${queryId}.csv`,
          fileExtension: '.csv',
          mimeType: batchResult.fileSize.contentType || 'text/csv',
          fileSizeBytes: batchResult.fileSize.totalSizeBytes,
          fileSizeKB: Number((sizeMB * 1024).toFixed(2)),
          fileSizeMB: Number(sizeMB.toFixed(2)),
          isOversize: sizeMB > LIMIT_MB,
          limitMB: LIMIT_MB,
          formattedSize: batchResult.fileSize.formattedSize,
          recommendation: batchResult.recommendation
        };

        entry.hasFile = true;
      }
    }
  });

  const result = Array.from(map.values()).map(({ queryId, meta, hasFile, fileInfo, fileBinary, downloadUrl }) => {
    const baseJson = {
      ...meta,
      queryId,
      result: hasFile ? 
        (fileInfo?.isOversize ? '查询完成（文件过大，需拆分处理）' : '查询完成') : 
        '查询未完成',
      filePresent: hasFile,
      fileInfo: fileInfo || null,
      downloadUrl: downloadUrl || null  // ✅ 修复：输出下载链接
    };

    if (!hasFile || !fileBinary) {
      return { json: baseJson };
    }

    return {
      json: baseJson,
      binary: {
        [OUTPUT_BINARY_FIELD]: fileBinary,
      },
    };
  });

  console.log('✅ 处理成功！');
  console.log('结果数量:', result.length);
  
  result.forEach((item, index) => {
    console.log(`\n--- 结果 ${index + 1} ---`);
    console.log('QueryID:', item.json.queryId);
    console.log('Result:', item.json.result);
    console.log('FilePresent:', item.json.filePresent);
    console.log('DownloadUrl存在:', !!item.json.downloadUrl);
    if (item.json.downloadUrl) {
      console.log('DownloadUrl前50字符:', item.json.downloadUrl.substring(0, 50) + '...');
    }
    console.log('FileInfo:', item.json.fileInfo ? {
      fileName: item.json.fileInfo.fileName,
      fileSizeMB: item.json.fileInfo.fileSizeMB,
      isOversize: item.json.fileInfo.isOversize
    } : null);
  });

} catch (error) {
  console.error('❌ 处理失败:', error.message);
}

console.log('\n=== 测试完成 ===');