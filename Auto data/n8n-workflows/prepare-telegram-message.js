const buildReplyPayloads = (items) => {
  const tokens = items
    .map(item => item.json?.tenant_access_token)
    .filter(Boolean);
  const latestToken = tokens.length ? tokens[tokens.length - 1] : '';

  return items
    .map(item => item.json || {})
    .filter(json => json.chatid && json.messageid && json.messageText)
    .map(json => {
      if (!json.tenant_access_token && latestToken) {
        json.tenant_access_token = latestToken;
      }
      const messageText = json.messageText || json.message || json.text || '查询结果已完成';
      const url = `https://open.larksuite.com/open-apis/im/v1/messages/${encodeURIComponent(json.messageid || '')}/reply`;
      const headers = {
        Authorization: `Bearer ${json.tenant_access_token || ''}`,
        'Content-Type': 'application/json; charset=utf-8'
      };
      const body = {
        msg_type: 'text',
        content: JSON.stringify({ text: messageText }),
        reply_in_thread: true
      };

      return {
        json: {
          url,
          headers,
          body,
          original: json
        }
      };
    });
};

// n8n Code 节点：生成简短的 TG 文案（不重命名文件）

// 输入：上一节点的单条/多条查询结果（携带 json + binary）
// 输出：json携带 messageText、fileName 等信息，binary 保持原文件但保留上游文件名

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

// 兼容不同的 binary 字段名
const POSSIBLE_BINARY_FIELDS = ['csv', 'data', 'file', 'document'];
const OUTPUT_BINARY_FIELD = 'csv';

const pickBinary = (binary = {}) => {
  for (const field of POSSIBLE_BINARY_FIELDS) {
    const payload = binary?.[field];
    if (!payload) continue;
    if (typeof payload === 'string' && payload) {
      return { data: payload };
    }
    if (payload.data) return payload;
  }
  return null;
};

// 从原始 text 里提取关键信息（支持多个值）
const parseInfo = (text = '') => {
  const info = {
    merchantIds: new Set(),
    uids: new Set(),
    betIds: new Set(),
    time: ''
  };

  // 提取商户ID（支持多个，如"商户：1716179958、1718444707"）
  const merchantMatch = text.match(/商户(?:号|id)?[:：]?\s*([0-9、，,\s]+)/i);
  if (merchantMatch) {
    const merchants = merchantMatch[1]
      .split(/[、，,\s]+/)
      .map(m => m.trim())
      .filter(m => /^\d+$/.test(m));
    merchants.forEach(m => info.merchantIds.add(m));
  }

  // 提取用户ID（支持多个）
  const uidMatch = text.match(/用户(?:id)?[:：]?\s*([\w\-_.、，,\s]+)/i);
  if (uidMatch) {
    const uids = uidMatch[1]
      .split(/[、，,\s]+/)
      .map(u => u.trim())
      .filter(u => u);
    uids.forEach(u => info.uids.add(u));
  }

  // 提取投注ID（支持多个）
  const betIdMatch = text.match(/投注(?:id|号)?[:：]?\s*([0-9、，,\s]+)/i);
  if (betIdMatch) {
    const betIds = betIdMatch[1]
      .split(/[、，,\s]+/)
      .map(b => b.trim())
      .filter(b => /^\d+$/.test(b));
    betIds.forEach(b => info.betIds.add(b));
  }

  // 提取时间范围
  const timeMatch = text.match(/时间[:：]?\s*([0-9.\-\/年月至日]+)/i);
  if (timeMatch) {
    info.time = timeMatch[1].trim();
  }

  return info;
};

// 生成简短文案（支持多个ID）
const buildMessage = (info = {}, fileName, fileSizeText) => {
  const header = '📄 查数结果已生成，请查收附件：';
  const lines = [];

  // 显示商户ID（支持多个）
  if (info.merchantIds && info.merchantIds.size > 0) {
    const merchantIds = Array.from(info.merchantIds);
    if (merchantIds.length === 1) {
      lines.push(`• 商户：${merchantIds[0]}`);
    } else if (merchantIds.length <= 3) {
      lines.push(`• 商户：${merchantIds.join('、')}`);
    } else {
      lines.push(`• 商户：${merchantIds.slice(0, 3).join('、')}等${merchantIds.length}个`);
    }
  }

  // 显示用户ID（支持多个）
  if (info.uids && info.uids.size > 0) {
    const uids = Array.from(info.uids);
    if (uids.length === 1) {
      lines.push(`• 用户：${uids[0]}`);
    } else if (uids.length <= 3) {
      lines.push(`• 用户：${uids.join('、')}`);
    } else {
      lines.push(`• 用户：${uids.slice(0, 3).join('、')}等${uids.length}个`);
    }
  }

  // 显示投注ID（支持多个）
  if (info.betIds && info.betIds.size > 0) {
    const betIds = Array.from(info.betIds);
    if (betIds.length === 1) {
      lines.push(`• 投注ID：${betIds[0]}`);
    } else if (betIds.length <= 3) {
      lines.push(`• 投注ID：${betIds.join('、')}`);
    } else {
      lines.push(`• 投注ID：${betIds.slice(0, 3).join('、')}等${betIds.length}个`);
    }
  }

  // 显示时间范围
  if (info.time) {
    lines.push(`• 时间：${info.time}`);
  }

  const body = lines.filter(Boolean).join('\n');
  const fileLine = fileName ? `• 文件：${fileName}${fileSizeText ? `（${fileSizeText}）` : ''}` : '';
  const segments = [header, body, fileLine].filter(Boolean);
  return segments.join('\n');
};

const detectDateLabel = (info, text = '') => {
  const normalizeFromInfo = (value = '') => {
    const cleaned = value.replace(/[^\d]/g, '');
    if (cleaned.length >= 8) return cleaned.slice(0, 8);
    if (cleaned.length >= 6) return cleaned.slice(0, 6);
    return '';
  };

  if (info.time) {
    const fromTime = normalizeFromInfo(info.time);
    if (fromTime) return fromTime;
  }

  if (!text) return '';

  const explicitDate = [...text.matchAll(/(20\d{2})[年\/\.-]?(\d{1,2})[月\/\.-]?(\d{1,2})/g)];
  if (explicitDate.length) {
    const [, y, m, d] = explicitDate[0];
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }

  const monthOnly = [...text.matchAll(/(20\d{2})[年\/\.-]?(\d{1,2})/g)];
  if (monthOnly.length) {
    const [, y, m] = monthOnly[0];
    return `${y}${m.padStart(2, '0')}`;
  }

  const pureDigits = [...text.matchAll(/20\d{6}/g)];
  if (pureDigits.length) {
    return pureDigits[0][0];
  }

  return '';
};

const detectMetricLabel = (text = '') => {
  const map = [
    { key: /投注记录/, label: '投注记录' },
    { key: /累计投注/, label: '累计投注' },
    { key: /累计派奖/, label: '累计派奖' },
    { key: /活跃用户|日活|月活/, label: '活跃用户' },
    { key: /留存/, label: '留存数据' },
  ];
  const hit = map.find(entry => entry.key.test(text));
  return hit ? hit.label : '';
};

const ensureUniqueFileName = (baseName, usageMap) => {
  const safeName = baseName.replace(/\//g, '-');
  const count = usageMap.get(safeName) || 0;
  usageMap.set(safeName, count + 1);
  if (count === 0) return safeName;

  const dot = safeName.lastIndexOf('.');
  const ext = dot >= 0 ? safeName.slice(dot) : '.csv';
  const nameOnly = dot >= 0 ? safeName.slice(0, dot) : safeName;
  return `${nameOnly}_${count + 1}${ext}`;
};

const buildFriendlyFileName = (info, json, index, usageMap) => {
  const merchantIds = info.merchantIds ? Array.from(info.merchantIds) : [];
  const merchantLabel =
    merchantIds.length === 1
      ? merchantIds[0]
      : merchantIds.length > 1
      ? `${merchantIds[0]}等`
      : '';
  const text = json.text || json.messageText || json.originalText || '';
  const dateLabel = detectDateLabel(info, text);
  const metricLabel = detectMetricLabel(text);

  const parts = [];
  if (merchantLabel) parts.push(merchantLabel);
  if (dateLabel) parts.push(dateLabel);
  if (metricLabel) parts.push(metricLabel);

  let proposed = parts.length ? `${parts.join('-')}.csv` : null;
  if (!proposed) {
    const fallback = json.fileName || json.fileInfo?.fileName || '查询结果.csv';
    return ensureUniqueFileName(fallback, usageMap);
  }
  return ensureUniqueFileName(proposed, usageMap);
};

const fileNameUsage = new Map();

const uniqueMap = new Map();
items.forEach((item) => {
  const json = item.json || {};
  const key = [
    json.queryId || '',
    json.fileInfo?.fileKey || json.fileName || '',
    json.chatid || ''
  ].join('::');
  const hasBinary = !!(item.binary && Object.values(item.binary).some(b => b?.data));

  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, { item, hasBinary });
    return;
  }

  const existing = uniqueMap.get(key);
  if (!existing.hasBinary && hasBinary) {
    uniqueMap.set(key, { item, hasBinary });
  }
});

const filteredItems = Array.from(uniqueMap.values()).map((entry) => entry.item);

const replyPayloadMap = new Map();
buildReplyPayloads(items).forEach(entry => {
  const original = entry.json.original || {};
  const key = original.messageid || original.messageId || '';
  if (key) {
    replyPayloadMap.set(key, entry.json);
  }
});

const outputs = filteredItems.map((item, index) => {
  const json = item.json || {};
  const binaryPayload = pickBinary(item.binary);

  // 从多个可能的字段中提取文本
  const text = json.text || json.messageText || json.originalText || '';
  
  // 如果json中有gameRecords，也从其中提取商户ID等信息
  const info = parseInfo(text);
  
  // 从gameRecords中补充商户ID等信息
  if (Array.isArray(json.gameRecords)) {
    json.gameRecords.forEach(record => {
      const merchant = record.merchant || record.merchant_id;
      if (merchant && /^\d+$/.test(String(merchant))) {
        info.merchantIds.add(String(merchant));
      }
      
      if (record.uid) {
        info.uids.add(String(record.uid));
      }
      
      if (record.id && /^\d+$/.test(String(record.id))) {
        info.betIds.add(String(record.id));
      }
    });
  }

  // 如果json中有queryRecords，也从其中提取信息
  if (Array.isArray(json.queryRecords)) {
    json.queryRecords.forEach(record => {
      if (record.text) {
        const recordInfo = parseInfo(record.text);
        recordInfo.merchantIds.forEach(m => info.merchantIds.add(m));
        recordInfo.uids.forEach(u => info.uids.add(u));
        recordInfo.betIds.forEach(b => info.betIds.add(b));
        if (recordInfo.time && !info.time) {
          info.time = recordInfo.time;
        }
      }
    });
  }

  const friendlyFileName = buildFriendlyFileName(info, json, index, fileNameUsage);
  const fileName = friendlyFileName.replace(/\//g, '-');
  const fileSizeText = json.fileInfo?.formattedSize || '';
  const messageText = buildMessage(info, fileName, fileSizeText);

  const replyBody = {
    msg_type: 'text',
    content: JSON.stringify({ text: messageText }),
    reply_in_thread: true,
  };

  const output = {
    json: {
      ...json,
      messageText,
      fileName: fileName,
      outputType: 'file_with_text',
      fileIndex: index + 1,
      totalFiles: filteredItems.length,
      replyRequest: replyPayloadMap.get(json.messageid || '') || {
        url: `https://open.larksuite.com/open-apis/im/v1/messages/${encodeURIComponent(json.messageid || '')}/reply`,
        headers: {
          Authorization: `Bearer ${json.tenant_access_token || ''}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: replyBody,
      },
    },
  };

  if (binaryPayload) {
    // 确保文件名中的 / 被替换为 -，避免被系统当作路径分隔符
    binaryPayload.fileName = fileName;
    if (!binaryPayload.fileExtension) {
      binaryPayload.fileExtension = '.csv';
    }
    if (!binaryPayload.mimeType) {
      binaryPayload.mimeType = 'text/csv';
    }
    output.binary = {
      [OUTPUT_BINARY_FIELD]: binaryPayload,
    };
  }

  return output;
});

return outputs;
