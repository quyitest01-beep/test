/* ========== 简化版：修复飞书上传size参数 ========== */

const items = $input.all();

return items.map((item, index) => {
  // 检查是否有binary数据
  if (!item.binary) {
    throw new Error(`Item ${index}: 没有binary数据`);
  }
  
  // 打印所有可用的binary keys用于调试
  const availableKeys = Object.keys(item.binary);
  console.log(`Item ${index} 可用的binary keys:`, availableKeys);
  
  // 尝试找到binary数据
  let binaryKey = null;
  let binary = null;
  
  // 方法1: 使用指定的binaryProperty
  if (item.json.binaryProperty && item.binary[item.json.binaryProperty]) {
    binaryKey = item.json.binaryProperty;
    binary = item.binary[binaryKey];
  }
  // 方法2: 使用'data'
  else if (item.binary.data) {
    binaryKey = 'data';
    binary = item.binary.data;
  }
  // 方法3: 使用第一个可用的key
  else if (availableKeys.length > 0) {
    binaryKey = availableKeys[0];
    binary = item.binary[binaryKey];
  }
  
  if (!binary) {
    throw new Error(`Item ${index}: 找不到binary数据。可用keys: ${availableKeys.join(', ')}`);
  }
  
  if (!binary.data) {
    throw new Error(`Item ${index}: Binary对象没有data属性。Binary keys: ${Object.keys(binary).join(', ')}`);
  }
  
  // 计算实际文件大小（从base64解码）
  const actualSize = Buffer.from(binary.data, 'base64').length;
  
  // 打印信息用于调试
  console.log(`\n文件 ${index}:`);
  console.log(`  Binary Key: ${binaryKey}`);
  console.log(`  文件名: ${binary.fileName || '未知'}`);
  console.log(`  计算的size: ${actualSize} bytes (${(actualSize / 1024 / 1024).toFixed(2)} MB)`);
  if (item.json.size) {
    console.log(`  原始size: ${item.json.size} bytes`);
    console.log(`  差异: ${actualSize - item.json.size} bytes`);
  }
  
  // 返回修正后的数据
  return {
    json: {
      ...item.json,
      size: actualSize,  // 使用准确的大小
      fileName: binary.fileName || item.json.fileName || `file_${index}.pdf`,
      binaryProperty: binaryKey
    },
    binary: item.binary
  };
});
