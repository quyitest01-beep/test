// n8n Code节点：将上游数据整合为JSON文本
// 功能：将Lark统计数据整合为格式化的JSON字符串，供Google Docs节点使用

const inputs = $input.all();
console.log("=== 数据整合为JSON文本开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 收集所有输入数据
const allData = [];

inputs.forEach((input, index) => {
  const item = input.json;
  allData.push(item);
  console.log(`📦 收集第 ${index + 1} 项数据: ${Object.keys(item).join(', ')}`);
});

// 将数据格式化为易读的JSON字符串
// 使用2个空格缩进，便于在文档中阅读
const jsonText = JSON.stringify(allData, null, 2);

console.log(`✅ JSON文本生成完成，长度: ${jsonText.length} 字符`);

// 返回结果，供Google Docs节点使用
return [{
  json: {
    text: jsonText,
    jsonData: allData,
    itemCount: allData.length
  }
}];










