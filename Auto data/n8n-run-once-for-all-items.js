/* ========== 适配 "Run Once for All Items" 模式 ========== */

console.log('=== 开始处理 ===');

// 在 "Run Once for All Items" 模式下，需要使用 $input.all()
const items = $input.all();

console.log('Items 数量:', items.length);

if (items.length === 0) {
  console.log('❌ 没有输入items');
  return [];
}

// 处理每个item
return items.map((item, index) => {
  console.log(`\n=== 处理 Item ${index} ===`);
  console.log('Item keys:', Object.keys(item));
  console.log('Has json:', !!item.json);
  console.log('Has binary:', !!item.binary);
  
  // 计算size
  let size = 0;
  let fileName = 'document.pdf';
  let binaryKey = 'data';
  
  if (item.binary && Object.keys(item.binary).length > 0) {
    const binaryKeys = Object.keys(item.binary);
    binaryKey = binaryKeys[0];
    const binary = item.binary[binaryKey];
    
    console.log(`Binary key: ${binaryKey}`);
    console.log('Binary fileName:', binary.fileName);
    
    fileName = binary.fileName || fileName;
    
    if (binary.data) {
      size = Buffer.from(binary.data, 'base64').length;
      console.log(`文件大小: ${size} bytes`);
    } else if (binary.fileSize) {
      size = binary.fileSize;
    }
  } else {
    console.log('⚠️ Item没有binary数据');
  }
  
  // 构建输出 - 关键：必须返回完整的item结构
  const output = {
    json: {
      ...item.json,  // 保留所有原有字段
      size: size,
      fileName: fileName,
      binaryProperty: binaryKey
    }
  };
  
  // 关键：必须传递binary
  if (item.binary) {
    output.binary = item.binary;
    console.log('✅ 传递binary数据');
  } else {
    console.log('⚠️ 没有binary可传递');
  }
  
  return output;
});
