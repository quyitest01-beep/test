/* ========== 工作版本：使用n8n的特殊API ========== */

// 使用 $items() 而不是 $input.all()
const items = $items();

return items.map((item, index) => {
  console.log(`\n=== 处理 Item ${index} ===`);
  
  // 检查item结构
  console.log('Item keys:', Object.keys(item));
  console.log('Has json:', !!item.json);
  console.log('Has binary:', !!item.binary);
  
  // 如果没有binary，直接返回
  if (!item.binary || Object.keys(item.binary).length === 0) {
    console.log('⚠️ 没有binary数据，直接传递');
    return item;
  }
  
  // 获取所有binary keys
  const binaryKeys = Object.keys(item.binary);
  console.log('Binary keys:', binaryKeys);
  
  // 使用第一个binary
  const binaryKey = binaryKeys[0];
  const binary = item.binary[binaryKey];
  
  console.log(`使用 binary key: ${binaryKey}`);
  console.log('Binary 属性:', Object.keys(binary));
  
  // 计算size
  let size = 0;
  
  if (binary.data) {
    // 从base64计算
    size = Buffer.from(binary.data, 'base64').length;
    console.log(`✅ 从base64计算 size: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } else if (binary.fileSize) {
    // 使用fileSize属性
    size = binary.fileSize;
    console.log(`✅ 使用fileSize属性: ${size} bytes`);
  } else {
    console.log('❌ 无法确定文件大小');
  }
  
  // 构建输出
  return {
    json: {
      ...item.json,
      size: size,
      fileName: binary.fileName || item.json.fileName || 'file.pdf',
      binaryProperty: binaryKey
    },
    binary: item.binary
  };
});
