// 测试反向查询功能（ID查商户名）
const testData = {
  filtered_merchants: [
    {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
    {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662},
    {"sub_merchant_name": "rico100", "main_merchant_name": "RD1", "merchant_id": 1698202814}
  ]
};

// 模拟查询处理函数
function processQuery(queryText, merchants) {
  const queryKeyword = queryText.trim();
  
  // 检查是否为纯数字ID查询
  if (/^\d+$/.test(queryKeyword)) {
    console.log('检测到数字ID查询:', queryKeyword);
    const queryId = parseInt(queryKeyword);
    
    for (const merchant of merchants) {
      const merchantId = merchant.merchant_id;
      if (merchantId === queryId) {
        return {
          type: 'merchant_by_id',
          success: true,
          merchant_id: merchantId,
          sub_merchant_name: merchant.sub_merchant_name,
          main_merchant_name: merchant.main_merchant_name,
          message: `通过ID找到商户: ${merchant.sub_merchant_name} (ID: ${merchantId})`
        };
      }
    }
    
    return {
      type: 'id_not_found',
      success: false,
      message: `未找到ID为 ${queryKeyword} 的商户`
    };
  } else {
    // 商户名查询
    for (const merchant of merchants) {
      if (merchant.sub_merchant_name === queryKeyword) {
        return {
          type: 'merchant_exact',
          success: true,
          merchant_id: merchant.merchant_id,
          sub_merchant_name: merchant.sub_merchant_name,
          main_merchant_name: merchant.main_merchant_name,
          message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
        };
      }
    }
    
    return {
      type: 'no_match',
      success: false,
      message: `未找到商户: "${queryKeyword}"`
    };
  }
}

// 测试用例
const testCases = [
  // 正向查询（商户名查ID）
  { query: "betfiery", desc: "商户名查ID", expected: "merchant_exact" },
  { query: "aajogo", desc: "商户名查ID", expected: "merchant_exact" },
  { query: "rico100", desc: "商户名查ID", expected: "merchant_exact" },
  
  // 反向查询（ID查商户名）
  { query: "1698202251", desc: "ID查商户名 - betfiery", expected: "merchant_by_id" },
  { query: "1698202662", desc: "ID查商户名 - aajogo", expected: "merchant_by_id" },
  { query: "1698202814", desc: "ID查商户名 - rico100", expected: "merchant_by_id" },
  
  // 不存在的查询
  { query: "nonexistent", desc: "不存在的商户名", expected: "no_match" },
  { query: "9999999999", desc: "不存在的ID", expected: "id_not_found" }
];

console.log('=== 反向查询功能测试 ===\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`测试 ${index + 1}: ${testCase.desc}`);
  console.log(`查询: "${testCase.query}"`);
  
  const result = processQuery(testCase.query, testData.filtered_merchants);
  
  console.log(`查询类型: ${result.type}`);
  console.log(`匹配成功: ${result.success}`);
  console.log(`消息: ${result.message}`);
  
  if (result.type === testCase.expected) {
    console.log(`✅ 测试通过`);
    passedTests++;
  } else {
    console.log(`❌ 测试失败 - 期望: ${testCase.expected}, 实际: ${result.type}`);
  }
  
  // 显示详细结果
  if (result.success) {
    console.log(`📋 商户ID: ${result.merchant_id}`);
    console.log(`📋 商户名: ${result.sub_merchant_name}`);
    console.log(`📋 主商户: ${result.main_merchant_name}`);
  }
  
  console.log('');
});

console.log(`=== 测试总结 ===`);
console.log(`通过: ${passedTests}/${totalTests}`);
console.log(`成功率: ${(passedTests / totalTests * 100).toFixed(1)}%`);

// 演示双向查询
console.log('\n=== 双向查询演示 ===');

console.log('\n1. 正向查询（商户名 → ID）:');
const forwardResult = processQuery('betfiery', testData.filtered_merchants);
console.log(`输入: betfiery`);
console.log(`输出: ${forwardResult.message}`);

console.log('\n2. 反向查询（ID → 商户名）:');
const reverseResult = processQuery('1698202251', testData.filtered_merchants);
console.log(`输入: 1698202251`);
console.log(`输出: ${reverseResult.message}`);

console.log('\n✅ 双向查询功能完整！');