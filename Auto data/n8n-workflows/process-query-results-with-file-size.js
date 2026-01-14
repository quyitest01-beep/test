// n8n Code 节点：整合原始查询、批量查询与文件大小信息，实现“每个 SQL 输出一个 item”

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const BINARY_FIELD = 'data';       // S3 下载节点默认字段
const OUTPUT_BINARY_FIELD = 'csv'; // 后续节点用到的字段名
const LIMIT_MB = 5;

const fileInfoMap = new Map();   // queryId -> 文件大小信息
const sqlRecords = [];           // 需要保留的 SQL 记录

items.forEach((item) => {
  const json = item.json || {};

  if (json.success === true && Array.isArray(json.data)) {
    // 批量文件大小接口的响应
    json.data.forEach(entry => {
      if (!entry.queryId) return;
      fileInfoMap.set(entry.queryId, {
        queryId: entry.queryId,
        fileSize: entry.fileSize || null,
        recommendation: entry.recommendation || null,
        fileKey: entry.fileKey || entry.fileSize?.fileKey || null,
        bucket: entry.bucket || entry.fileSize?.bucket || null,
      });
    });
    return;
  }

  if (json.queryId && json.sql) {
    sqlRecords.push({
      json: { ...json },
      binary: item.binary?.[BINARY_FIELD] || null,
    });
  }
});

if (!sqlRecords.length) {
  throw new Error('未找到包含 SQL 的 query 记录');
}

const classifyRole = (resultText = '') => {
  if (/批量/.test(resultText)) return 'batch';
  if (/拆分|文件过大|需拆分处理/.test(resultText)) return 'split_source';
  return 'original';
};

const buildNormalizedFileInfo = (raw) => {
  if (!raw) return null;

  const size = raw.fileSize || {};
  const recommendation = raw.recommendation || null;

  return {
    totalSizeBytes: size.totalSizeBytes ?? null,
    totalSizeMB: size.totalSizeMB ?? null,
    totalSizeGB: size.totalSizeGB ?? null,
    fileCount: size.fileCount ?? null,
    formattedSize: size.formattedSize || null,
    contentType: size.contentType || null,
    lastModified: size.lastModified || null,
    bucket: raw.bucket || size.bucket || null,
    fileKey: raw.fileKey || size.fileKey || null,
    recommendation,
  };
};

const buildBinaryFileInfo = (queryId, binary) => {
  if (!binary?.data) return null;

  const buf = Buffer.from(binary.data, 'base64');
  const sizeBytes = buf.byteLength;
  const sizeMB = sizeBytes / 1024 / 1024;
  const formattedSize = sizeMB >= 1
    ? `${sizeMB.toFixed(2)} MB`
    : `${(sizeMB * 1024).toFixed(2)} KB`;

  return {
    totalSizeBytes: sizeBytes,
    totalSizeMB: Number(sizeMB.toFixed(4)),
    totalSizeGB: Number((sizeMB / 1024).toFixed(4)),
    fileCount: 1,
    formattedSize,
    contentType: binary.mimeType || 'application/octet-stream',
    fileKey: binary.fileName || `${queryId}.csv`,
    bucket: null,
    recommendation: sizeMB > LIMIT_MB
      ? {
          action: 'split_process',
          message: `文件大小 ${sizeMB.toFixed(2)} MB，超过 ${LIMIT_MB} MB 限制，建议拆分`,
        }
      : {
          action: 'direct_process',
          message: `文件大小 ${sizeMB.toFixed(2)} MB，可直接下载处理`,
        },
  };
};

const groupKey = (json) => {
  return [
    json.chatid || '',
    json.senderid || '',
    json.messageid || '',
  ].join('::');
};

const groups = new Map();
sqlRecords.forEach(record => {
  const key = groupKey(record.json);
  if (!groups.has(key)) {
    groups.set(key, []);
  }
  groups.get(key).push(record);
});

const outputs = [];

groups.forEach((records) => {
  const splitCount = records.filter(r => classifyRole(r.json.result) !== 'batch').length || 0;
  const batchCount = records.filter(r => classifyRole(r.json.result) === 'batch').length || 0;
  const relationSummary = `${splitCount} 条拆分 → ${batchCount} 条批量`;

  records.forEach((record, idx) => {
    const { json, binary } = record;
    const queryId = json.queryId;
    const queryRole = classifyRole(json.result);

    let fileInfo = buildNormalizedFileInfo(fileInfoMap.get(queryId));
    if (!fileInfo) {
      fileInfo = buildBinaryFileInfo(queryId, binary);
    }

    const filePresent = !!fileInfo;
    const recommendationAction = fileInfo?.recommendation?.action;
    let normalizedResult = json.result;

    if (recommendationAction === 'split_process') {
      normalizedResult = '查询完成（文件过大，需拆分处理）';
    } else if (
      recommendationAction === 'direct_process' ||
      recommendationAction === 'export_or_batch'
    ) {
      normalizedResult = '查询完成';
    }

    const fileStatus = filePresent
      ? (fileInfo?.recommendation?.message || '文件可直接处理')
      : '尚未生成文件';

    const output = {
      json: {
        ...json,
        queryRole,
        relationSummary,
        result: normalizedResult,
        filePresent,
        fileStatus,
        fileInfo,
      },
    };

    if (binary) {
      output.binary = {
        [OUTPUT_BINARY_FIELD]: binary,
      };
    }

    outputs.push(output);
  });
});

return outputs;

