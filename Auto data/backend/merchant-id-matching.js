// n8n Code节点：商户ID匹配到商户名
// 从商户数据中提取merchant字段，匹配到对应的商户名

const inputData = $input.all();

// 商户ID和商户名的映射关系
// 这个数据应该从你的商户表中获取，这里提供示例结构
const merchantMapping = {
  // 示例数据，实际使用时需要从数据库或API获取
  "10001": "系统商户",
  "10002": "测试商户",
  "20001": "生产商户A",
  "20002": "生产商户B",
  "30001": "游戏商户C",
  "30002": "游戏商户D"
  // 添加更多商户映射...
};

// 如果商户映射数据很大，可以从外部API获取
async function getMerchantMapping() {
  // 这里可以调用你的商户API获取完整的映射关系
  // 例如：从Lark表格或数据库中获取
  return merchantMapping;
}

const outputItems = [];

for (const item of inputData) {
  const data = item.json;
  const merchantId = data.merchant;
  
  // 查找商户名
  const merchantName = merchantMapping[merchantId] || `未知商户_${merchantId}`;
  
  // 创建新的数据项
  outputItems.push({
    json: {
      ...data,
      merchantId: merchantId,
      merchantName: merchantName,
      isMatched: merchantMapping.hasOwnProperty(merchantId),
      matchedAt: new Date().toISOString()
    }
  });
}

console.log(`处理了 ${outputItems.length} 条商户数据`);
console.log(`匹配成功的商户: ${outputItems.filter(item => item.json.isMatched).length} 条`);

return outputItems;









