// 商户数据格式化器 - 处理上游数据结构
// 分析上游数据并输出商户映射信息

const inputs = $input.all();
console.log("=== 商户数据格式化开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分析上游数据结构
const inputData = inputs[0].json;
console.log("🔍 上游数据结构分析:");
console.log("数据类型:", typeof inputData);
console.log("主要字段:", Object.keys(inputData));

// 检查是否有filtered_merchants字段
if (inputData.filtered_merchants && Array.isArray(inputData.filtered_merchants)) {
  console.log(`📊 发现filtered_merchants数组，共 ${inputData.filtered_merchants.length} 个商户`);
  
  // 生成商户映射数据
  const merchantMappingData = inputData.filtered_merchants.map(merchant => {
    return {
      商户名: merchant.sub_merchant_name,
      主商户名: merchant.main_merchant_name,
      商户ID: merchant.merchant_id
    };
  });
  
  // 按商户名A→Z排序
  const sortedMerchants = merchantMappingData.sort((a, b) => {
    return a.商户名.localeCompare(b.商户名, 'zh-CN', { numeric: true });
  });
  
  console.log("商户排序结果:", sortedMerchants.slice(0, 10).map(m => m.商户名));
  
  // 生成Lark表格格式数据
  const larkTableData = sortedMerchants.map(merchant => {
    return {
      商户名: merchant.商户名,
      主商户名: merchant.主商户名,
      商户ID: merchant.商户ID
    };
  });
  
  console.log(`📈 生成商户映射数据: ${larkTableData.length} 行`);
  console.log("数据示例:", larkTableData.slice(0, 5));
  
  // 返回格式化的数据
  return larkTableData.map(item => ({ json: item }));
  
} else {
  console.log("⚠️ 未发现filtered_merchants字段，尝试其他数据结构");
  
  // 尝试处理其他可能的数据结构
  if (Array.isArray(inputData)) {
    console.log("📊 输入数据是数组格式");
    return inputData.map(item => ({ json: item }));
  } else {
    console.log("📊 输入数据是对象格式，直接返回");
    return [{ json: inputData }];
  }
}
