// n8n Code 节点：处理上游数据，整合文件大小信息和状态（包含下载链接）
const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const BINARY_FIELD = 'data';  // S3 下载节点默认的 binary 字段
const OUTPUT_BINARY_FIELD = 'csv'; // 后续节点要用的字段名
const LIMIT_MB = 5;

// 第一步：分离数据库记录和批量查询结果
const dbRecords = []; // 数据库记录（有 queryId 的原始记录）
const batchResults = new Map(); // 批量查询结果 key = queryId -> fileSize info

items.forEach(item => {
  const json = item.json;
  
  // 检查是否是批量查询结果
  if (json.success === true && json.data && Array.isArray(json.data)) {
    // 这是批量查询的响应
    json.data.forEach(result => {
      if (result.queryId && result.success) {
        batchResults.set(result.queryId, {
          fileSize: result.fileSize,
          recommendation: result.recommendation,
          fileKey: result.fileKey,
          bucket: result.bucket,
          downloadUrl: result.downloadUrl  // ✅ 保存下载链接
        });
      }
    });
  } else if (json.queryId) {
    // 这是数据库记录
    dbRecords.push({
      json: json,
      binary: item.binary || null
    });
  }
});

// 第二步：合并数据，构建输出
const map = new Map(); // key = queryId -> 汇总数据

// 处理数据库记录
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
      fileSizeInfo: null, // 从批量查询结果获取的文件大小信息
      downloadUrl: null   // ✅ 新增：下载链接
    });
  }

  const entry = map.get(queryId);
  entry.meta = { ...entry.meta, ...item.json }; // 更新最新字段

  // 检查是否有二进制文件（S3 下载的文件）
  const binary = item.binary?.[BINARY_FIELD];
  if (binary?.data) {
    const buf = Buffer.from(binary.data, 'base64');
    const sizeBytes = buf.byteLength;
    const sizeKB = sizeBytes / 1024;
    const sizeMB = sizeKB / 1024;

    entry.hasFile = true;
    entry.fileBinary = binary;
    entry.fileInfo = {
      fileName: binary.fileName || `${queryId}_${idx + 1}`,
      fileExtension: binary.fileExtension || '',
      mimeType: binary.mimeType || '',
      fileSizeBytes: sizeBytes,
      fileSizeKB: Number(sizeKB.toFixed(2)),
      fileSizeMB: Number(sizeMB.toFixed(2)),
      isOversize: sizeMB > LIMIT_MB,
      limitMB: LIMIT_MB,
    };
  }

  // 从批量查询结果中获取文件大小信息
  const batchResult = batchResults.get(queryId);
  if (batchResult) {
    entry.fileSizeInfo = {
      fileSize: batchResult.fileSize,
      recommendation: batchResult.recommendation,
      fileKey: batchResult.fileKey,
      bucket: batchResult.bucket
    };
    
    // ✅ 新增：保存下载链接
    entry.downloadUrl = batchResult.downloadUrl;

    // 根据文件大小信息判断状态
    if (batchResult.fileSize) {
      const sizeMB = batchResult.fileSize.totalSizeMB || 0;
      
      // 如果文件大小超过限制，标记为超大
      if (sizeMB > LIMIT_MB) {
        entry.fileInfo = {
          fileName: batchResult.fileKey || `${queryId}.csv`,
          fileExtension: '.csv',
          mimeType: batchResult.fileSize.contentType || 'text/csv',
          fileSizeBytes: batchResult.fileSize.totalSizeBytes,
          fileSizeKB: Number((sizeMB * 1024).toFixed(2)),
          fileSizeMB: Number(sizeMB.toFixed(2)),
          isOversize: true,
          limitMB: LIMIT_MB,
          formattedSize: batchResult.fileSize.formattedSize,
          recommendation: batchResult.recommendation
        };
      } else {
        // 文件大小在限制内，可以下载
        entry.fileInfo = {
          fileName: batchResult.fileKey || `${queryId}.csv`,
          fileExtension: '.csv',
          mimeType: batchResult.fileSize.contentType || 'text/csv',
          fileSizeBytes: batchResult.fileSize.totalSizeBytes,
          fileSizeKB: Number((sizeMB * 1024).toFixed(2)),
          fileSizeMB: Number(sizeMB.toFixed(2)),
          isOversize: false,
          limitMB: LIMIT_MB,
          formattedSize: batchResult.fileSize.formattedSize,
          recommendation: batchResult.recommendation
        };
      }

      // 如果有文件大小信息，认为文件存在（即使还没下载）
      entry.hasFile = true;
    }
  }
});

// 第三步：生成输出（保持原有格式 + 新增下载链接）
return Array.from(map.values()).map(({ queryId, meta, hasFile, fileInfo, fileBinary, downloadUrl }) => {
  const baseJson = {
    ...meta,
    queryId,
    // 根据文件大小信息判断结果状态
    result: hasFile ? 
      (fileInfo?.isOversize ? '查询完成（文件过大，需拆分处理）' : '查询完成') : 
      '查询未完成',
    filePresent: hasFile,
    fileInfo: fileInfo || null,
    downloadUrl: downloadUrl || null  // ✅ 新增：输出下载链接
  };

  // 如果没有文件，只返回 JSON
  if (!hasFile || !fileBinary) {
    return { json: baseJson };
  }

  // 如果有文件，返回 JSON 和 Binary
  return {
    json: baseJson,
    binary: {
      [OUTPUT_BINARY_FIELD]: fileBinary,
    },
  };
});