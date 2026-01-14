// n8n Code 节点：根据上游数据行数决定输出格式
// 1行数据：只返回消息文本
// 大于1行数据：返回文件+文案（结合 text 字段整理回复文案）

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const POSSIBLE_BINARY_FIELDS = ['csv', 'data', 'file', 'document'];
const OUTPUT_BINARY_FIELD = 'csv';

const pickBinaryAttachment = (binary = {}) => {
  for (const field of POSSIBLE_BINARY_FIELDS) {
    const candidate = binary?.[field];
    if (!candidate) continue;

    if (typeof candidate === 'string' && candidate) {
      return { data: candidate };
    }

    if (candidate.data) {
      return candidate;
    }
  }
  return null;
};

// 统计数据行数（去重，基于 queryId 或 id）
const uniqueRecords = new Map();
const gameRecords = []; // 游戏记录或聚合结果
const queryRecords = []; // 查询记录

items.forEach(item => {
  const json = item.json;
  
  // 判断是游戏记录还是查询记录
  if (json.queryId) {
    // 查询记录
    const queryId = json.queryId;
    if (!uniqueRecords.has(`query_${queryId}`)) {
      uniqueRecords.set(`query_${queryId}`, true);
      queryRecords.push({
        json: json,
        binary: item.binary || null
      });
    }
  } else if (
    // 投注记录：有id且有以下字段之一
    (json.id && (json.uid || json.merchant_id || json.game_id)) ||
    // 聚合汇总记录：有total_amount或total_pay_out（可能有merchant/platform，也可能没有，如按游戏、币种维度分组的结果）
    (json.total_amount !== undefined || json.total_pay_out !== undefined) ||
    // 统计类查询结果：有统计字段（如日活、月活等）
    (json.daily_active_users !== undefined || json.monthly_active_users !== undefined || 
     json.retention_rate !== undefined || json.active_users !== undefined) ||
    // 统计类查询结果：有date_str和merchant（日活/月活统计的典型结构）
    (json.date_str && json.merchant && (json.daily_active_users !== undefined || json.monthly_active_users !== undefined)) ||
    // 留存分析数据：有cohort_date和留存相关字段
    (json.cohort_date && (json.d0_users !== undefined || json.d1_users !== undefined || json.d3_users !== undefined || json.d7_users !== undefined || json.d1_retention_rate !== undefined))
  ) {
    // 投注记录、聚合汇总记录或统计类查询结果
    let recordKey;
    if (json.id) {
      recordKey = `game_${json.id}`;
    } else if (json.cohort_date) {
      // 留存分析数据：基于cohort_date、merchant和game_id
      recordKey = `retention_${json.cohort_date}_${json.merchant || 'unknown'}_${json.game_id || 'ALL'}`;
    } else if (json.daily_active_users !== undefined || json.monthly_active_users !== undefined) {
      // 统计类查询结果：基于date_str、merchant和统计类型
      const statType = json.daily_active_users !== undefined ? 'dau' : 'mau';
      recordKey = `stat_${json.date_str || 'unknown'}_${json.merchant || 'unknown'}_${statType}`;
    } else if (json.total_amount !== undefined || json.total_pay_out !== undefined) {
      // 聚合汇总记录：基于currency、game_code等维度（可能没有merchant）
      const merchant = json.merchant || json.platform || 'ALL';
      const currency = json.currency || 'ALL';
      const gameCode = json.game_id || json.game_code || 'ALL';
      recordKey = `summary_${merchant}_${currency}_${gameCode}`;
    } else {
      // 其他情况，使用JSON字符串作为key
      recordKey = `other_${JSON.stringify(json).slice(0, 100)}`;
    }

    if (!uniqueRecords.has(recordKey)) {
      uniqueRecords.set(recordKey, true);
      gameRecords.push({
        json,
        binary: item.binary || null
      });
    }
  }
});

// 计算去重后的总记录数
const totalCount = gameRecords.length + queryRecords.length;
const metaInfo = extractQueryMeta(queryRecords, gameRecords);
const fallbackFileName = buildFallbackFileName(queryRecords, gameRecords);

// 调试日志
console.log(`📊 元信息提取结果:`, JSON.stringify(metaInfo));
console.log(`📊 查询记录数: ${queryRecords.length}, 游戏记录数: ${gameRecords.length}`);

// 生成友好的文件名
function extractQueryMeta(queryRecords, gameRecords) {
  const meta = {
    gameCode: '',
    timeLabel: '',
    metricLabel: '',
  };

  const normalizeMetric = (raw = '') => {
    const cleaned = raw.replace(/[\s，,。、]/g, '');
    if (!cleaned) return '';
    if (cleaned.includes('累计') && cleaned.includes('派奖') && cleaned.includes('投注')) {
      return '派奖投注额';
    }
    return cleaned;
  };

  const normalizeTime = (text = '') => {
    // 匹配多种时间格式：2025/11月、2025/11、2025年11月、2025-11等
    const match = text.match(/(\d{4})[年\/\.\-](\d{1,2})(?:[月\/\.\-](\d{1,2}))?/);
    if (!match) return '';
    const year = match[1];
    const month = match[2].padStart(2, '0');
    if (match[3]) {
      const day = match[3].padStart(2, '0');
      return `${year}/${month}/${day}`;
    }
    return `${year}/${month}`;
  };

  const tryUpdateMetaFromText = (text = '') => {
    if (!text) return;
    if (!meta.gameCode) {
      // 检查是否查询的是"所有游戏"或"全部游戏"
      const cleanedText = text.replace(/\s+/g, '');
      const isAllGamesQuery = /所有游戏|全部游戏|所有.*游戏|全部.*游戏/i.test(cleanedText);
      
      // 只有在不是"所有游戏"查询时，才提取 gameCode
      if (!isAllGamesQuery) {
        const gameMatch = text.match(/(gp_[a-z0-9_]+)/i);
        if (gameMatch) {
          meta.gameCode = gameMatch[1];
        }
      }
    }
    if (!meta.timeLabel) {
      const timeLabel = normalizeTime(text);
      if (timeLabel) meta.timeLabel = timeLabel;
    }
    if (!meta.metricLabel) {
      // 先尝试从冒号后提取
      const idx = Math.max(text.lastIndexOf('：'), text.lastIndexOf(':'));
      if (idx !== -1 && idx < text.length - 1) {
        meta.metricLabel = normalizeMetric(text.slice(idx + 1));
      } else {
        // 如果没有冒号，尝试从整个文本中提取指标关键词
        const cleanedText = text.replace(/\s+/g, '');
        if (/累计.*派奖.*投注|累计.*投注.*派奖/.test(cleanedText)) {
          meta.metricLabel = '派奖投注额';
        } else if (/累计.*投注/.test(cleanedText)) {
          meta.metricLabel = '累计投注额';
        } else if (/累计.*派奖/.test(cleanedText)) {
          meta.metricLabel = '累计派奖额';
        } else if (/活跃用户|日活|月活|ActiveUser/i.test(cleanedText)) {
          meta.metricLabel = '活跃用户数';
        } else if (/留存/.test(cleanedText)) {
          meta.metricLabel = '留存分析';
        } else if (/投注记录/.test(cleanedText)) {
          meta.metricLabel = '投注记录';
        }
      }
    }
  };

  queryRecords.forEach(record => {
    tryUpdateMetaFromText(record.json.text || '');
  });

  if (!meta.metricLabel) {
    const combinedText = queryRecords
      .map(record => (record.json.text || '').replace(/\s+/g, ''))
      .join('');
    if (combinedText) {
      if (/活跃用户|日活|月活|ActiveUser/i.test(combinedText)) {
        meta.metricLabel = '活跃用户数';
      } else if (/留存/.test(combinedText)) {
        meta.metricLabel = '留存分析';
      } else if (/累计.*派奖.*投注|累计.*投注.*派奖/.test(combinedText)) {
        meta.metricLabel = '派奖投注额';
      } else if (/累计.*投注/.test(combinedText)) {
        meta.metricLabel = '累计投注额';
      } else if (/累计.*派奖/.test(combinedText)) {
        meta.metricLabel = '累计派奖额';
      } else if (/投注记录/.test(combinedText)) {
        meta.metricLabel = '投注记录';
      }
    }
  }

  // 只有在查询文本中没有提到"所有游戏"、"全部游戏"等关键词时，才从 gameRecords 中提取 gameCode
  if (!meta.gameCode) {
    const allQueryTexts = queryRecords
      .map(record => (record.json.text || '').replace(/\s+/g, ''))
      .join('');
    
    // 检查是否查询的是"所有游戏"或"全部游戏"
    const isAllGamesQuery = /所有游戏|全部游戏|所有.*游戏|全部.*游戏/i.test(allQueryTexts);
    
    // 只有在不是"所有游戏"查询时，才从 gameRecords 中提取 gameCode
    if (!isAllGamesQuery) {
      const game = gameRecords.find(rec => rec.json.game_code || rec.json.game_id);
      if (game) {
        meta.gameCode = game.json.game_code || game.json.game_id || '';
      }
    }
  }

  if (!meta.timeLabel) {
    const monthRecord = gameRecords.find(rec => rec.json.month_str);
    if (monthRecord) {
      const monthStr = String(monthRecord.json.month_str);
      if (/^\d{6}$/.test(monthStr)) {
        meta.timeLabel = `${monthStr.slice(0, 4)}/${monthStr.slice(4)}`;
      }
    }
  }
  if (!meta.timeLabel) {
    const statRecord = gameRecords.find(rec => rec.json.date_str);
    if (statRecord) {
      meta.timeLabel = statRecord.json.date_str;
    }
  }

  if (!meta.metricLabel) {
    const metricMap = [
      { field: 'monthly_active_users', label: '活跃用户数' },
      { field: 'daily_active_users', label: '活跃用户数' },
      { field: 'active_users', label: '活跃用户数' },
      { field: 'net_win', label: '净输赢' },
      { field: 'total_amount', label: '累计投注额' },
      { field: 'total_pay_out', label: '累计派奖额' },
      { field: 'retention_rate', label: '留存率' },
    ];
    const matched = metricMap.find(entry =>
      gameRecords.some(rec => rec.json[entry.field] !== undefined)
    );
    if (matched) {
      meta.metricLabel = matched.label;
    }
  }

  if (!meta.metricLabel) {
    if (gameRecords.some(rec => rec.json.total_amount !== undefined || rec.json.total_pay_out !== undefined)) {
      meta.metricLabel = '汇总结果';
    } else if (gameRecords.some(rec => rec.json.daily_active_users !== undefined || rec.json.monthly_active_users !== undefined)) {
      meta.metricLabel = '活跃统计';
    } else if (gameRecords.some(rec => rec.json.cohort_date)) {
      meta.metricLabel = '留存分析';
    }
  }

  return meta;
}

function buildMetaFileName(meta, overrides = {}) {
  const parts = [];
  const gameCode = overrides.gameCode || meta.gameCode;
  const timeLabel = overrides.timeLabel || meta.timeLabel;
  const metricLabel = overrides.metricLabel || meta.metricLabel;
  if (gameCode) parts.push(gameCode);
  if (timeLabel) parts.push(timeLabel);
  if (metricLabel) parts.push(metricLabel);
  return parts.length ? `${parts.join('-')}.csv` : '';
}

function buildFallbackFileName(queryRecords, gameRecords) {
  const merchantIds = new Set();

  queryRecords.forEach(record => {
    const text = record.json.text || '';
    const merchantMatch = text.match(/商户(?:号|id)?[:：]?\s*([0-9、，,\s]+)/i);
    if (merchantMatch) {
      const merchants = merchantMatch[1]
        .split(/[、，,\s]+/)
        .map(m => m.trim())
        .filter(m => /^\d+$/.test(m));
      merchants.forEach(m => merchantIds.add(m));
    }
  });

  gameRecords.forEach(record => {
    const merchant = record.json.merchant || record.json.merchant_id || record.json.platform;
    if (merchant && /^\d+$/.test(String(merchant))) {
      merchantIds.add(String(merchant));
    }
  });

  let timeRange = '';
  queryRecords.forEach(record => {
    const text = record.json.text || '';
    const timeMatch = text.match(/时间[:：]?\s*([0-9.\-\/年月至日]+)/i);
    if (timeMatch && !timeRange) {
      let timeStr = timeMatch[1].trim();
      if (timeStr.includes('-')) {
        const parts = timeStr.split('-');
        if (parts.length === 2) {
          const startPart = parts[0].trim();
          const endPart = parts[1].trim();
          const startMatch = startPart.match(/(\d{4})[.\/]?(\d{1,2})[.\/]?(\d{1,2})/);
          if (startMatch) {
            const year = startMatch[1];
            const month = String(startMatch[2]).padStart(2, '0');
            const day = String(startMatch[3]).padStart(2, '0');
            const startDate = `${year}${month}${day}`;
            const endMatch = endPart.match(/(\d{1,2})[.\/]?(\d{1,2})/);
            if (endMatch) {
              const endMonth = String(endMatch[1]).padStart(2, '0');
              const endDay = String(endMatch[2]).padStart(2, '0');
              const endDate = `${year}${endMonth}${endDay}`;
              timeRange = `${startDate}-${endDate}`;
            } else {
              timeRange = startDate;
            }
          }
        }
      } else {
        const dateMatch = timeStr.match(/(\d{4})[.\/]?(\d{1,2})[.\/]?(\d{1,2})/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = String(dateMatch[2]).padStart(2, '0');
          const day = String(dateMatch[3]).padStart(2, '0');
          timeRange = `${year}${month}${day}`;
        }
      }
    }
  });

  const parts = ['查数'];
  if (merchantIds.size === 0) {
    parts.push('未知商户');
  } else if (merchantIds.size === 1) {
    parts.push(Array.from(merchantIds)[0]);
  } else if (merchantIds.size <= 3) {
    parts.push(Array.from(merchantIds).join('_'));
  } else {
    parts.push('多商户');
  }
  if (timeRange) {
    parts.push(timeRange);
  }
  return `${parts.join('_')}.csv`;
}

function detectMetricLabelForRecord(record, defaultLabel) {
  const text = (record.json.text || '').replace(/\s+/g, '');
  const sql = record.json.sql || '';
  if (/新用户留存/.test(text) || /新用户留存/.test(sql)) {
    return '新用户留存';
  }
  if (/活跃用户留存/.test(text) || /活跃用户留存/.test(sql)) {
    return '活跃用户留存';
  }
  if (/新&活跃用户留存/.test(text)) {
    if (/first_seen/i.test(sql)) return '新用户留存';
    if (/cohort\s+AS/i.test(sql)) return '活跃用户留存';
  }
  if (/first_seen/i.test(sql)) return '新用户留存';
  if (/cohort\s+AS/i.test(sql)) return '活跃用户留存';
  if (/留存/.test(text)) return '留存分析';
  return defaultLabel || '查询结果';
}

function ensureUniqueFileName(name, usageMap) {
  const base = name.replace(/\.csv$/i, '');
  const count = usageMap.get(base) || 0;
  usageMap.set(base, count + 1);
  return count === 0 ? `${base}.csv` : `${base}_${count + 1}.csv`;
}

const formatGameRecord = (json, index) => {
  const idxTitle = typeof index === 'number' ? `（第 ${index} 条）` : '';

  // 留存分析数据（cohort_date + d0_users/d1_users等）
  if (json.cohort_date && (json.d0_users !== undefined || json.d1_users !== undefined || json.d3_users !== undefined || json.d7_users !== undefined || json.d1_retention_rate !== undefined)) {
    let messageText = `留存分析结果${idxTitle}：\n`;
    if (json.cohort_date) {
      messageText += `队列日期: ${json.cohort_date}\n`;
    }
    if (json.merchant || json.merchant_id) {
      messageText += `商户号: ${json.merchant || json.merchant_id || 'N/A'}\n`;
    }
    if (json.game_id) {
      messageText += `游戏ID: ${json.game_id}\n`;
    }
    if (json.d0_users !== undefined) {
      messageText += `D0用户数: ${json.d0_users}\n`;
    }
    if (json.d1_users !== undefined) {
      messageText += `D1用户数: ${json.d1_users}\n`;
    }
    if (json.d1_retention_rate !== undefined) {
      messageText += `D1留存率: ${json.d1_retention_rate}%\n`;
    }
    if (json.d3_users !== undefined) {
      messageText += `D3用户数: ${json.d3_users}\n`;
    }
    if (json.d7_users !== undefined) {
      messageText += `D7用户数: ${json.d7_users}\n`;
    }
    return messageText;
  }

  // 统计类查询结果（日活、月活等）
  if (json.daily_active_users !== undefined || json.monthly_active_users !== undefined || 
      json.active_users !== undefined || json.retention_rate !== undefined) {
    let messageText = `统计结果${idxTitle}：\n`;
    if (json.date_str) {
      messageText += `日期: ${json.date_str}\n`;
    }
    if (json.merchant || json.merchant_id) {
      messageText += `商户号: ${json.merchant || json.merchant_id || 'N/A'}\n`;
    }
    if (json.daily_active_users !== undefined) {
      messageText += `日活用户数: ${json.daily_active_users}\n`;
    }
    if (json.monthly_active_users !== undefined) {
      messageText += `月活用户数: ${json.monthly_active_users}\n`;
    }
    if (json.active_users !== undefined) {
      messageText += `活跃用户数: ${json.active_users}\n`;
    }
    if (json.retention_rate !== undefined) {
      messageText += `留存率: ${json.retention_rate}\n`;
    }
    return messageText;
  }

  // 聚合汇总记录（累计投注、派奖等）
  if (json.total_amount !== undefined || json.total_pay_out !== undefined) {
    let messageText = `汇总结果${idxTitle}：\n`;
    messageText += `商户/平台: ${json.merchant || json.platform || json.merchant_id || 'N/A'}\n`;
    messageText += `币种: ${json.currency || 'N/A'}\n`;
    messageText += `游戏: ${json.game_id || json.game_code || 'ALL'}\n`;
    messageText += `累计投注: ${json.total_amount ?? 'N/A'}\n`;
    messageText += `累计派奖: ${json.total_pay_out ?? 'N/A'}`;
    return messageText;
  }

  // 投注记录
  let messageText = `投注记录核实结果${idxTitle}：\n`;
  messageText += `回合ID: ${json.id || 'N/A'}\n`;
  messageText += `玩家ID: ${json.uid || 'N/A'}\n`;
  messageText += `商户号: ${json.merchant_id || json.merchant || 'N/A'}\n`;
  messageText += `游戏ID: ${json.game_id || 'N/A'}\n`;
  messageText += `游戏代码: ${json.game_code || 'N/A'}\n`;
  messageText += `结果: ${json.result || 'N/A'}\n`;
  messageText += `货币: ${json.currency || 'N/A'}\n`;
  messageText += `下注金额: ${json.amount || 'N/A'}\n`;
  messageText += `赔付金额: ${json.pay_out || 'N/A'}\n`;
  messageText += `倍数: ${json.multiplier || 'N/A'}\n`;
  messageText += `余额: ${json.balance || 'N/A'}`;
  return messageText;
};

// 情况0：有查询记录但未解析出任何数据，直接提示“未查询到”
if (gameRecords.length === 0 && queryRecords.length > 0) {
  const baseJson = (queryRecords[0]?.json) || {};
  const noDataMessage = '⚠️ 未查询到相关数据，请核对查询条件后再尝试。';
  return [{
    json: {
      ...baseJson,
      messageText: noDataMessage,
      outputType: 'text_only',
      recordCount: 0,
      queryRecords: queryRecords.map(item => item.json),
      gameRecords: []
    }
  }];
}

// 情况1：数据量 <=3，全部走纯文本输出
if (totalCount <= 3) {
  const baseJson = (queryRecords[0]?.json) || (gameRecords[0]?.json) || {};
  const textBlocks = [];

  queryRecords.forEach((record, idx) => {
    const json = record.json;
    let messageText = json.text || `查询记录（第 ${idx + 1} 条）`;
    if (json.result && json.result !== '查询未完成') {
      messageText += `\n\n查询状态: ${json.result}`;
    }
    textBlocks.push(messageText);
  });

  gameRecords.forEach((record, idx) => {
    textBlocks.push(formatGameRecord(record.json, idx + 1));
  });

  const finalMessage = textBlocks.join('\n\n----------------\n\n') || '查询完成';

  return [{
    json: {
      ...baseJson,
      messageText: finalMessage,
      outputType: 'text_only',
      recordCount: totalCount,
      queryRecords: queryRecords.map(item => item.json),
      gameRecords: gameRecords.map(item => item.json)
    }
  }];
}

// 情况2：大于1行数据 - 返回文件+文案
// 需要找到有文件的查询记录
const recordsWithFile = queryRecords.filter(item => {
  return item.json.filePresent === true && pickBinaryAttachment(item.binary);
});

// 合并所有查询记录的 text 字段，整理回复文案
const allQueryTexts = queryRecords
  .map(item => item.json.text)
  .filter(text => text);

// 构建回复文案（结合 text 字段）
let replyText = '';
if (allQueryTexts.length > 0) {
  // 如果有多个查询，合并所有 text 内容
  if (allQueryTexts.length === 1) {
    replyText = allQueryTexts[0];
  } else {
    // 多个查询，合并所有 text
    replyText = allQueryTexts.join('\n\n');
  }
  
  // 如果有文件，添加文件信息
  if (recordsWithFile.length > 0) {
    replyText += '\n\n';
    replyText += '查询结果文件：\n';
    recordsWithFile.forEach((item, idx) => {
      const fileInfo = item.json.fileInfo;
      if (fileInfo) {
        replyText += `\n文件 ${idx + 1}: ${fileInfo.fileName || 'N/A'}\n`;
        replyText += `大小: ${fileInfo.formattedSize || 'N/A'}\n`;
        if (fileInfo.recommendation) {
          replyText += `建议: ${fileInfo.recommendation.message || 'N/A'}\n`;
        }
      }
    });
  }
} else {
  // 没有 text 字段，使用默认文案
  replyText = '查询完成';
  if (recordsWithFile.length > 0) {
    replyText += '，请查看附件文件。';
  }
}

// 如果没有文件，但有多条记录，返回汇总消息
if (recordsWithFile.length === 0) {
  return [{
    json: {
      messageText: replyText || '查询结果汇总',
      outputType: 'text_only',
      recordCount: totalCount,
      queryRecords: queryRecords.map(item => item.json),
      gameRecords: gameRecords.map(item => item.json)
    }
  }];
}

// 生成基础文件名
const friendlyFileName = buildMetaFileName(metaInfo) || fallbackFileName;
const filenameUsage = new Map();
const recordFileNames = new Map();

// 为所有有文件的查询记录生成文件名
const fileInfoRecords = queryRecords.filter(item => item.json.filePresent === true);
fileInfoRecords.forEach(item => {
  const identifier = item.json.queryId || item.json.id || `record_${recordFileNames.size}`;
  const metricLabel = detectMetricLabelForRecord(item, metaInfo.metricLabel);
  
  // 尝试生成文件名：优先使用 metaInfo + metricLabel，如果没有则使用 friendlyFileName，最后使用 fallbackFileName
  let desiredName = buildMetaFileName(metaInfo, { metricLabel });
  
  // 如果还是没有，尝试只用 timeLabel 和 metricLabel（即使没有 gameCode）
  if (!desiredName && (metaInfo.timeLabel || metaInfo.metricLabel)) {
    desiredName = buildMetaFileName({ gameCode: '', timeLabel: metaInfo.timeLabel, metricLabel: metricLabel || metaInfo.metricLabel });
  }
  
  // 如果还是没有，使用 fallback
  if (!desiredName) {
    desiredName = friendlyFileName || fallbackFileName;
  }
  
  desiredName = ensureUniqueFileName(desiredName, filenameUsage);
  recordFileNames.set(identifier, desiredName);

  // 更新 fileInfo 和 fileName
  if (item.json.fileInfo) {
    item.json.fileInfo = { ...item.json.fileInfo, fileName: desiredName };
  } else {
    item.json.fileInfo = { fileName: desiredName };
  }
  item.json.fileName = desiredName;
  
  console.log(`📝 为查询 ${identifier} 生成文件名: ${desiredName} (metricLabel: ${metricLabel}, metaInfo: ${JSON.stringify(metaInfo)})`);
});

// 返回结果：如果有多个文件，返回多个输出项；否则返回一个
if (recordsWithFile.length === 1) {
  // 单个文件
  const item = recordsWithFile[0];
  const identifier = item.json.queryId || item.json.id || 'record_single';
  const singleFileName = recordFileNames.get(identifier) || friendlyFileName;
  const binaryPayload = pickBinaryAttachment(item.binary);
  
  // 更新文件名
  if (binaryPayload) {
    binaryPayload.fileName = singleFileName;
    binaryPayload.fileExtension = '.csv';
    binaryPayload.mimeType = binaryPayload.mimeType || 'text/csv';
  }
  
  // 更新fileInfo中的fileName
  const updatedFileInfo = item.json.fileInfo ? {
    ...item.json.fileInfo,
    fileName: singleFileName
  } : null;
  
  return [{
    json: {
      ...item.json,
      fileInfo: updatedFileInfo,
      fileName: singleFileName,
      messageText: replyText,
      outputType: 'file_with_text',
      recordCount: totalCount
    },
    binary: {
      [OUTPUT_BINARY_FIELD]: binaryPayload
    }
  }];
} else {
  // 多个文件，返回多个输出项
  // 为每个文件单独生成文案和文件名
  return recordsWithFile.map((item, idx) => {
    const fileInfo = item.json.fileInfo;
    const binaryPayload = pickBinaryAttachment(item.binary);

    const identifier = item.json.queryId || item.json.id || `record_${idx}`;
    const desiredFileName = recordFileNames.get(identifier) || ensureUniqueFileName(friendlyFileName, filenameUsage);

    // 更新文件名
    if (binaryPayload) {
      binaryPayload.fileName = desiredFileName;
      binaryPayload.fileExtension = '.csv';
      binaryPayload.mimeType = binaryPayload.mimeType || 'text/csv';
    }
    
    // 更新fileInfo中的fileName
    const updatedFileInfo = fileInfo ? {
      ...fileInfo,
      fileName: desiredFileName
    } : null;
    
    let itemReplyText = '';
    
    // 使用该文件对应的 text 字段
    if (item.json.text) {
      itemReplyText = item.json.text;
    } else if (allQueryTexts.length > 0) {
      // 如果没有对应的 text，使用第一个 text
      itemReplyText = allQueryTexts[0];
    } else {
      itemReplyText = '查询完成';
    }
    
    // 添加文件信息
    itemReplyText += `\n\n查询结果文件 ${idx + 1}/${recordsWithFile.length}：\n`;
    itemReplyText += `文件名: ${desiredFileName}\n`;
    itemReplyText += `大小: ${fileInfo?.formattedSize || 'N/A'}\n`;
    if (fileInfo?.recommendation) {
      itemReplyText += `建议: ${fileInfo.recommendation.message || 'N/A'}\n`;
    }
    
    return {
      json: {
        ...item.json,
        fileInfo: updatedFileInfo,
        fileName: desiredFileName,
        messageText: itemReplyText,
        outputType: 'file_with_text',
        recordCount: totalCount,
        fileIndex: idx + 1,
        totalFiles: recordsWithFile.length
      },
      binary: {
        [OUTPUT_BINARY_FIELD]: binaryPayload
      }
    };
  });
}

