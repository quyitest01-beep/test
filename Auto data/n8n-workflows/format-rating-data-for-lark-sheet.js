// n8n Code 节点：整理写表数据
// 功能：将游戏评分数据转换为 Lark 表格格式

const inputs = $input.all();

console.log("=== 开始整理写表数据 ===");
console.log("📊 输入项数量:", inputs.length);

// 1. 查找评分数据、子表信息和token
let ratingData = [];
let sheetInfo = null;
let tenantAccessToken = null;

inputs.forEach((input, index) => {
  const data = input.json || {};
  
  // 查找评分数据（从"计算评分数据"节点）
  if (data.game && data.global_rating && data.platform_ratings) {
    ratingData.push(data);
    console.log(`✅ 找到评分数据 #${index + 1}: ${data.game.name}`);
  }
  
  // 查找子表信息（多种格式）
  // 格式1：从"构建子表数据"节点（target_sheet_name/target_sheet_id）
  if (data.target_sheet_name || data.target_sheet_id) {
    sheetInfo = {
      sheet_name: data.target_sheet_name || data.target_sheet_id,
      sheet_id: data.target_sheet_id || data.target_sheet_name,
      spreadsheet_token: data.spreadsheet_token || "Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg"
    };
    console.log(`✅ 找到子表信息（格式1） #${index + 1}: ${sheetInfo.sheet_name}`);
  }
  // 格式2：从"创建子表"节点的响应（data.replies[0].addSheet.properties）
  else if (data.data && data.data.replies && Array.isArray(data.data.replies) && data.data.replies.length > 0) {
    const addSheet = data.data.replies[0].addSheet;
    if (addSheet && addSheet.properties) {
      sheetInfo = {
        sheet_name: addSheet.properties.title || "",
        sheet_id: addSheet.properties.sheetId || addSheet.properties.title || "",
        spreadsheet_token: "Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg" // 默认值
      };
      console.log(`✅ 找到子表信息（格式2） #${index + 1}: ${sheetInfo.sheet_name} (ID: ${sheetInfo.sheet_id})`);
    }
  }
  // 格式3：从"创建子表"节点的响应（replies[0].addSheet.properties）
  else if (data.replies && Array.isArray(data.replies) && data.replies.length > 0) {
    const addSheet = data.replies[0].addSheet;
    if (addSheet && addSheet.properties) {
      sheetInfo = {
        sheet_name: addSheet.properties.title || "",
        sheet_id: addSheet.properties.sheetId || addSheet.properties.title || "",
        spreadsheet_token: "Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg" // 默认值
      };
      console.log(`✅ 找到子表信息（格式3） #${index + 1}: ${sheetInfo.sheet_name} (ID: ${sheetInfo.sheet_id})`);
    }
  }
  
  // 查找token（多种格式）
  // 格式1：直接包含 tenant_access_token
  if (data.tenant_access_token && !tenantAccessToken) {
    tenantAccessToken = data.tenant_access_token;
    console.log(`✅ 找到token（格式1） #${index + 1}`);
  }
  // 格式2：从http_request中提取token
  else if (data.http_request && data.http_request.headers && data.http_request.headers.Authorization) {
    const authHeader = data.http_request.headers.Authorization;
    const match = authHeader.match(/Bearer\s+(.+)/);
    if (match && !tenantAccessToken) {
      tenantAccessToken = match[1];
      console.log(`✅ 从http_request提取token #${index + 1}`);
    }
  }
});

if (ratingData.length === 0) {
  console.error("❌ 未找到评分数据");
  console.error("   输入项数量:", inputs.length);
  console.error("   输入项结构示例:", inputs.slice(0, 3).map((item, idx) => ({
    index: idx + 1,
    keys: Object.keys(item.json || {}),
    hasGame: !!(item.json?.game),
    hasGlobalRating: !!(item.json?.global_rating)
  })));
  throw new Error("❌ 未找到评分数据，请检查上游节点输出");
}

if (!sheetInfo) {
  console.error("❌ 未找到子表信息");
  console.error("   输入项数量:", inputs.length);
  console.error("   尝试查找的字段:", ["target_sheet_name", "target_sheet_id", "data.replies[0].addSheet.properties"]);
  console.error("   输入项结构示例:", inputs.slice(0, 5).map((item, idx) => ({
    index: idx + 1,
    keys: Object.keys(item.json || {}),
    hasTargetSheet: !!(item.json?.target_sheet_name || item.json?.target_sheet_id),
    hasReplies: !!(item.json?.data?.replies || item.json?.replies)
  })));
  throw new Error("❌ 未找到子表信息，请检查上游节点输出");
}

if (!tenantAccessToken) {
  console.error("❌ 未找到tenant_access_token");
  console.error("   输入项数量:", inputs.length);
  console.error("   尝试查找的字段:", ["tenant_access_token", "http_request.headers.Authorization"]);
  console.error("   输入项结构示例:", inputs.slice(0, 5).map((item, idx) => ({
    index: idx + 1,
    keys: Object.keys(item.json || {}),
    hasToken: !!(item.json?.tenant_access_token),
    hasHttpRequest: !!(item.json?.http_request)
  })));
  throw new Error("❌ 未找到tenant_access_token，请检查上游节点输出");
}

console.log(`\n📊 数据汇总:`);
console.log(`   评分数据: ${ratingData.length} 条`);
console.log(`   子表名称: ${sheetInfo.sheet_name}`);
console.log(`   Token: ${tenantAccessToken.substring(0, 20)}...`);

// 1.5. 计算汇总新用户数（所有游戏的新用户数之和）
let totalNewUserCount = 0;
ratingData.forEach((rating) => {
  const newUserCount = rating.global_rating?.metrics?.new_user_count || 0;
  totalNewUserCount += Number(newUserCount) || 0;
});
console.log(`   汇总新用户数: ${totalNewUserCount}`);

// 2. 格式化函数
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(decimals);
};

const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  // 如果值小于1，认为是0-1浮点，需要乘以100
  if (num < 1 && num > 0) {
    return `${(num * 100).toFixed(decimals)}%`;
  }
  return `${num.toFixed(decimals)}%`;
};

// 3. 构建表格数据
// 表头
const tableHeader = [
  "游戏名称",
  "统计周期",
  "全局等级",
  "全局得分",
  "D1留存率",
  "D7留存率",
  "新用户数",
  "新用户占比",
  "派彩下注比",
  "RTP值",
  "人均GGR",
  "D1得分",
  "D7得分",
  "规模得分",
  "价值得分",
  "风险得分",
  "平台数量",
  "红渠道数量",
  "可增加预算"
];

const tableData = [tableHeader];

// 数据行
ratingData.forEach((rating, index) => {
  const game = rating.game || {};
  const period = rating.period || {};
  const globalRating = rating.global_rating || {};
  const metrics = globalRating.metrics || {};
  const scores = globalRating.scores || {};
  const summary = rating.summary || {};
  
  // 计算新用户占比 = 当前游戏新用户数 ÷ 汇总新用户数
  const currentGameNewUserCount = Number(metrics.new_user_count || 0);
  const newUserRatio = totalNewUserCount > 0 
    ? currentGameNewUserCount / totalNewUserCount 
    : 0;
  
  // 派彩下注比 = 该游戏总派奖USD ÷ 总投注USD
  // 优先从 revenue_data 中获取，如果没有则从顶层字段获取，最后使用已计算的值
  let payoutBetRatio = null;
  const revenueData = rating.revenue_data || {};
  const totalPayoutUSD = revenueData.total_payout_usd !== null && revenueData.total_payout_usd !== undefined
    ? Number(revenueData.total_payout_usd)
    : (rating.total_payout_usd !== undefined ? Number(rating.total_payout_usd || 0) : null);
  const totalBetUSD = revenueData.total_bet_usd !== null && revenueData.total_bet_usd !== undefined
    ? Number(revenueData.total_bet_usd)
    : (rating.total_bet_usd !== undefined ? Number(rating.total_bet_usd || 0) : null);
  
  if (totalPayoutUSD !== null && totalBetUSD !== null && totalBetUSD > 0) {
    payoutBetRatio = totalPayoutUSD / totalBetUSD;
  } else if (metrics.payout_bet_ratio !== null && metrics.payout_bet_ratio !== undefined) {
    // 如果已有计算好的值，直接使用
    payoutBetRatio = metrics.payout_bet_ratio;
  }
  
  // RTP值：来自 rtp_raw
  // 优先从 revenue_data 中获取，如果没有则从其他字段获取
  const rtpValue = revenueData.rtp_raw !== null && revenueData.rtp_raw !== undefined
    ? revenueData.rtp_raw
    : (rating.rtp_raw || rating.rtp_value || metrics.rtp_value || metrics.rtp_raw || null);
  
  // 人均GGR = 当前游戏GGR-USD ÷ 当前游戏新用户数
  // 优先从 revenue_data 中获取，如果没有则从其他字段获取
  let ggrPerUser = null;
  const ggrUSD = revenueData.ggr_usd !== null && revenueData.ggr_usd !== undefined
    ? Number(revenueData.ggr_usd)
    : (rating.ggr_usd !== undefined ? Number(rating.ggr_usd || 0) : (rating.total_ggr_usd !== undefined ? Number(rating.total_ggr_usd || 0) : null));
  
  if (ggrUSD !== null && currentGameNewUserCount > 0) {
    ggrPerUser = ggrUSD / currentGameNewUserCount;
  } else if (metrics.ggr_per_user !== null && metrics.ggr_per_user !== undefined) {
    // 如果已有计算好的值，直接使用
    ggrPerUser = metrics.ggr_per_user;
  }
  
  const row = [
    game.name || "-",
    period.days_range || `${period.start || ""}-${period.end || ""}`,
    globalRating.tier || "-",
    formatNumber(scores.total_score, 2),
    formatPercentage(metrics.d1_retention, 2),
    formatPercentage(metrics.d7_retention, 2),
    String(currentGameNewUserCount),
    formatPercentage(newUserRatio, 2), // 新用户占比
    formatPercentage(payoutBetRatio, 2), // 派彩下注比
    rtpValue ? String(rtpValue) : "-", // RTP值（直接显示原始值，不格式化）
    formatNumber(ggrPerUser, 4), // 人均GGR
    formatNumber(scores.d1_score, 2),
    formatNumber(scores.d7_score, 2),
    formatNumber(scores.scale_score, 2),
    formatNumber(scores.value_score, 2),
    formatNumber(scores.risk_score, 2),
    String(summary.platform_count || 0),
    String(summary.red_channel_count || 0),
    summary.can_increase_budget ? "是" : "否"
  ];
  
  tableData.push(row);
  
  console.log(`✅ 处理游戏 ${index + 1}/${ratingData.length}: ${game.name} → ${globalRating.tier}级`);
  console.log(`   新用户占比: ${formatPercentage(newUserRatio, 2)} (${currentGameNewUserCount}/${totalNewUserCount})`);
  if (payoutBetRatio !== null) {
    console.log(`   派彩下注比: ${formatPercentage(payoutBetRatio, 2)}`);
  }
  if (rtpValue) {
    console.log(`   RTP值: ${rtpValue}`);
  }
  if (ggrPerUser !== null) {
    console.log(`   人均GGR: ${formatNumber(ggrPerUser, 4)}`);
  }
});

console.log(`\n📊 表格数据构建完成:`);
console.log(`   表头列数: ${tableHeader.length}`);
console.log(`   数据行数: ${tableData.length - 1}`);

// 辅助函数：将列数转换为列字母（1->A, 2->B, ..., 26->Z, 27->AA, ...）
function numberToColumnLetter(num) {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

// 计算range
const columnCount = tableHeader.length; // 19列（已移除"游戏代码"）
const rowCount = tableData.length; // 行数（包含表头）
const lastColumn = numberToColumnLetter(columnCount); // S列（19列）

// Lark API要求使用sheetId而不是工作表名称
// 如果sheet_id存在，使用sheet_id；否则使用sheet_name作为fallback
const sheetIdentifier = sheetInfo.sheet_id || sheetInfo.sheet_name;
const range = `${sheetIdentifier}!A1:${lastColumn}${rowCount}`;

console.log(`📋 Range计算:`);
console.log(`   列数: ${columnCount}`);
console.log(`   行数: ${rowCount}`);
console.log(`   最后一列: ${lastColumn}`);
console.log(`   工作表ID: ${sheetInfo.sheet_id || '未找到，使用名称'}`);
console.log(`   工作表名称: ${sheetInfo.sheet_name}`);
console.log(`   Range: ${range}`);

// 4. 构建输出
const output = {
  target_sheet_id: sheetInfo.sheet_id,
  target_sheet_name: sheetInfo.sheet_name,
  spreadsheet_token: sheetInfo.spreadsheet_token,
  table_data: tableData,
  row_count: rowCount,
  column_count: columnCount,
  range: range, // 添加range字段供HTTP节点使用
  last_column: lastColumn, // 添加最后一列字母供HTTP节点使用
  http_request: {
    method: "POST",
    url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${sheetInfo.spreadsheet_token}/values_batch_update`,
    headers: {
      "Authorization": `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: {
      valueRanges: [
        {
          range: range,
          values: tableData
        }
      ]
    }
  },
  meta: {
    generated_at: new Date().toISOString(),
    game_count: ratingData.length
  }
};

console.log(`\n✅ 数据整理完成，准备写入工作表: ${sheetInfo.sheet_name}`);

return [{
  json: output
}];

