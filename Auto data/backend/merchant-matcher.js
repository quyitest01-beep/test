// n8n Function节点：商户数据匹配器
// 处理上游数据，匹配两批数据中 sub_merchant_name 相同的商户
// 输入：包含 filtered_merchants 数组的对象 + 包含逗号分隔商户名的对象
// 输出：匹配成功的商户数据（sub_merchant_name, account, password）

const inputs = $input.all();
console.log("=== 商户数据匹配器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分离两批数据
let filteredMerchantsData = null;  // 第一批：包含 filtered_merchants 数组
let merchantNameListData = null;   // 第二批：包含逗号分隔的商户名

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 检查输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 300) + "...");
  
  // 检查是否是包含 filtered_merchants 的对象
  if (item && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
    console.log(`✅ 识别到第一批数据（filtered_merchants），包含 ${item.filtered_merchants.length} 个商户`);
    filteredMerchantsData = item.filtered_merchants;
  }
  // 检查是否是包含 sub_merchant_name 的对象（可能是逗号分隔的字符串）
  else if (item && item.sub_merchant_name && typeof item.sub_merchant_name === 'string') {
    console.log(`✅ 识别到第二批数据（sub_merchant_name）：${item.sub_merchant_name.substring(0, 100)}...`);
    merchantNameListData = item.sub_merchant_name;
  }
  // 检查是否直接是包含 sub_merchant_name 的数组元素
  else if (item && item.sub_merchant_name) {
    console.log(`✅ 识别到第二批数据（sub_merchant_name）：${item.sub_merchant_name.substring(0, 100)}...`);
    merchantNameListData = item.sub_merchant_name;
  }
});

// 验证数据
if (!filteredMerchantsData || filteredMerchantsData.length === 0) {
  console.error("❌ 没有找到 filtered_merchants 数据");
  return [{
    json: {
      error: "没有找到 filtered_merchants 数据",
      status: "failed"
    }
  }];
}

if (!merchantNameListData) {
  console.error("❌ 没有找到商户名列表数据");
  return [{
    json: {
      error: "没有找到商户名列表数据",
      status: "failed"
    }
  }];
}

console.log(`📊 第一批数据：${filteredMerchantsData.length} 个商户`);
console.log(`📊 第二批数据：商户名字符串长度 ${merchantNameListData.length}`);

// 解析商户名列表（逗号分隔）
const merchantNamesToMatch = merchantNameListData
  .split(',')
  .map(name => name.trim())  // 去除首尾空格
  .filter(name => name.length > 0);  // 过滤空字符串

console.log(`📋 需要匹配的商户名数量: ${merchantNamesToMatch.length}`);
console.log(`📋 商户名列表:`, merchantNamesToMatch.slice(0, 10).join(', '), merchantNamesToMatch.length > 10 ? '...' : '');

// 构建商户名到商户数据的映射（不区分大小写，去除空格）
const merchantMap = new Map();

filteredMerchantsData.forEach(merchant => {
  if (!merchant || !merchant.sub_merchant_name) {
    return;
  }
  
  // 规范化商户名（去除空格，转小写）用于匹配
  const normalizedName = merchant.sub_merchant_name.trim().toLowerCase();
  
  // 如果已有相同的规范化名称，保留第一个（或可以根据需要合并）
  if (!merchantMap.has(normalizedName)) {
    merchantMap.set(normalizedName, merchant);
  }
});

console.log(`🗺️ 构建商户映射表完成，共 ${merchantMap.size} 个商户`);

// 辅助函数：提取 account 字段的文本值
function extractAccount(account) {
  if (typeof account === 'string') {
    return account;
  } else if (Array.isArray(account)) {
    // 如果是数组，提取所有 text 字段并拼接
    return account
      .filter(item => item && item.text)
      .map(item => item.text)
      .join('');
  } else if (account && account.text) {
    return account.text;
  }
  return account || '';
}

// 辅助函数：提取 password 字段的文本值
function extractPassword(password) {
  if (typeof password === 'string') {
    return password;
  } else if (Array.isArray(password)) {
    // 如果是数组，提取所有 text 字段并拼接
    return password
      .filter(item => item && item.text)
      .map(item => item.text)
      .join('');
  } else if (password && password.text) {
    return password.text;
  }
  return password || '';
}

// 匹配商户
const matchedMerchants = [];
const unmatchedNames = [];

merchantNamesToMatch.forEach(merchantName => {
  // 规范化商户名用于匹配
  const normalizedName = merchantName.trim().toLowerCase();
  
  const matchedMerchant = merchantMap.get(normalizedName);
  
  if (matchedMerchant) {
    // 提取 account 和 password
    const account = extractAccount(matchedMerchant.account);
    const password = extractPassword(matchedMerchant.password);
    
    const result = {
      sub_merchant_name: matchedMerchant.sub_merchant_name.trim(),  // 使用原始名称（去除首尾空格）
      account: account,
      password: password
    };
    
    matchedMerchants.push(result);
    console.log(`✅ 匹配成功: ${result.sub_merchant_name} -> account: ${account.substring(0, 30)}...`);
  } else {
    unmatchedNames.push(merchantName);
    console.log(`❌ 未匹配: ${merchantName}`);
  }
});

console.log(`=== 匹配完成 ===`);
console.log(`✅ 匹配成功: ${matchedMerchants.length} 个商户`);
console.log(`❌ 未匹配: ${unmatchedNames.length} 个商户名`);

if (unmatchedNames.length > 0) {
  console.log(`⚠️ 未匹配的商户名:`, unmatchedNames.slice(0, 10).join(', '), unmatchedNames.length > 10 ? '...' : '');
}

// 输出结果：每个匹配的商户作为一个 item
const results = matchedMerchants.map(merchant => ({
  json: merchant
}));

// 如果没有任何匹配，返回错误信息
if (results.length === 0) {
  return [{
    json: {
      error: "没有找到匹配的商户",
      status: "failed",
      unmatched_count: unmatchedNames.length,
      unmatched_names: unmatchedNames.slice(0, 10)
    }
  }];
}

console.log(`📈 输出 ${results.length} 个匹配的商户数据`);
console.log("前3个匹配结果示例:");
results.slice(0, 3).forEach((item, index) => {
  console.log(`  ${index + 1}.`, JSON.stringify(item.json));
});

return results;

