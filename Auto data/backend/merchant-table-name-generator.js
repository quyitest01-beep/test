// 商户表格名称生成器
// 根据数据周期设定表名，保留token值和上游数据

const inputs = $input.all();
console.log("=== 商户表格名称生成器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 用于收集token和商户数据
let tenantAccessToken = null;
const merchantData = [];

// 遍历所有输入项，分离token和商户数据
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  // 检查是否是token数据（放宽条件：只要包含 tenant_access_token 即可）
  if (item.tenant_access_token) {
    console.log(`🔑 识别到token数据: ${item.tenant_access_token.substring(0, 20)}...`);
    tenantAccessToken = item.tenant_access_token;
  }
  // 检查是否是商户/留存数据（兼容：商户聚合行、明细行、留存行 new_date/cohort_date）
  else if (
    (item.商户名 && (item.日期 === "合计" || item.日期 || item.new_date || item.cohort_date)) ||
    item.new_date ||
    item.cohort_date
  ) {
    const hintDate = item.日期 || item.new_date || item.cohort_date || 'N/A';
    const hintName = item.商户名 || item.merchant || '未命名商户';
    console.log(`📊 识别到业务数据: ${hintName} - ${hintDate}`);
    merchantData.push(item);
  }
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的数据项 (索引: ${index})，数据字段: ${Object.keys(item).join(', ')}`);
  }
});

console.log(`🔑 收集到token: ${tenantAccessToken ? '是' : '否'}`);
console.log(`📊 收集到商户数据: ${merchantData.length} 条`);

// 检查是否有必要的数据
if (!tenantAccessToken) {
  console.error("❌ 没有找到tenant_access_token，无法继续处理");
  return [];
}

if (merchantData.length === 0) {
  console.error("❌ 没有找到商户数据，无法继续处理");
  return [];
}

// 分析数据周期（支持 YYYYMMDD 与 YYYY-MM-DD，忽略“合计”行）
const dateSet = new Set();
function normalizeToYYYYMMDD(dateStr) {
  if (!dateStr) return null;
  if (/^\d{8}$/.test(dateStr)) return dateStr; // 已是 YYYYMMDD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${y}${m}${d}`;
  }
  return null;
}

merchantData.forEach(item => {
  const raw = (item.日期 && item.日期 !== "合计") ? item.日期 : (item.new_date || item.cohort_date || null);
  const norm = normalizeToYYYYMMDD(raw);
  if (norm) dateSet.add(norm);
});

const sortedDates = Array.from(dateSet).sort();
console.log("📅 发现的日期:", sortedDates);

// 生成表名
let tableName = "";
if (sortedDates.length > 1) {
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  // 生成表名：YYYYMMDD-DD商户活跃用户数（跨多日）
  tableName = `${startDate}-${endDate.substring(6)}商户活跃用户数`;
} else if (sortedDates.length === 1) {
  // 仅一天：YYYYMMDD商户活跃用户数
  tableName = `${sortedDates[0]}商户活跃用户数`;
} else {
  // 如果没有具体日期，使用当前日期
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  tableName = `${year}${month}${day}商户活跃用户数`;
}

console.log(`📋 生成表名: ${tableName}`);

// 生成输出数据
const outputData = {
  table_name: tableName,
  tenant_access_token: tenantAccessToken,
  merchant_data: merchantData,
  data_count: merchantData.length,
  date_range: sortedDates.length > 1
    ? `${sortedDates[0]}-${sortedDates[sortedDates.length - 1]}`
    : (sortedDates.length === 1 ? `${sortedDates[0]}-${sortedDates[0]}` : null),
  generated_at: new Date().toISOString()
};

console.log(`📈 生成输出数据完成`);
console.log("输出数据示例:", {
  table_name: outputData.table_name,
  tenant_access_token: outputData.tenant_access_token.substring(0, 20) + "...",
  data_count: outputData.data_count,
  date_range: outputData.date_range
});

// 返回格式化的数据
return [{ json: outputData }];
