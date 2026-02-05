/* ========== 正确传递binary和json的Code节点 ========== */

// 获取输入数据
const items = $input.all();

console.log('=== 输入数据检查 ===');
console.log('Items数量:', items.length);

// 处理每个item
return items.map((item, index) => {
  console.log(`\n处理 Item ${index}:`);
  
  // 1. 保留原有的json数据
  const outputJson = {
    ...item.json  // 保留所有原有字段
  };
  
  // 2. 检查并处理binary数据
  let binaryData = null;
  let binaryKey = 'data';  // 默认key
  
  if (item.binary) {
    const binaryKeys = Object.keys(item.binary);
    console.log('Binary keys:', binaryKeys);
    
    if (binaryKeys.length > 0) {
      binaryKey = binaryKeys[0];  // 使用第一个binary key
      binaryData = item.binary[binaryKey];
      
      console.log(`使用 binary key: ${binaryKey}`);
      console.log('Binary fileName:', binaryData.fileName);
      console.log('Binary mimeType:', binaryData.mimeType);
      
      // 3. 计算文件大小
      let fileSize = 0;
      if (binaryData.data) {
        fileSize = Buffer.from(binaryData.data, 'base64').length;
        console.log(`文件大小: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      } else if (binaryData.fileSize) {
        fileSize = binaryData.fileSize;
        console.log(`使用fileSize属性: ${fileSize} bytes`);
      }
      
      // 4. 添加必要的字段到json（但不覆盖已有字段）
      if (!outputJson.fileName) {
        outputJson.fileName = binaryData.fileName || 'document.pdf';
      }
      if (!outputJson.size) {
        outputJson.size = fileSize;
      }
      if (!outputJson.binaryProperty) {
        outputJson.binaryProperty = binaryKey;
      }
    }
  } else {
    console.log('⚠️ 没有binary数据');
  }
  
  // 5. 返回完整的item结构
  const result = {
    json: outputJson
  };
  
  // 6. 关键：必须传递binary数据
  if (item.binary) {
    result.binary = item.binary;
  }
  
  console.log('输出json keys:', Object.keys(result.json));
  console.log('输出binary存在:', !!result.binary);
  
  return result;
});
