/* ========== 最终版：修复飞书上传size参数 ========== 
 * 使用n8n正确的API访问binary数据
 */

// 获取所有输入项
for (const item of $input.all()) {
  // 打印调试信息
  console.log('=== Item 结构 ===');
  console.log('JSON keys:', Object.keys(item.json || {}));
  console.log('Binary keys:', Object.keys(item.binary || {}));
  
  // 检查binary
  if (item.binary) {
    for (const key of Object.keys(item.binary)) {
      const bin = item.binary[key];
      console.log(`\nBinary[${key}]:`);
      console.log('  - fileName:', bin.fileName);
      console.log('  - mimeType:', bin.mimeType);
      console.log('  - fileSize:', bin.fileSize);
      console.log('  - has data:', !!bin.data);
      
      if (bin.data) {
        try {
          const size = Buffer.from(bin.data, 'base64').length;
          console.log('  - calculated size:', size, 'bytes');
        } catch (e) {
          console.log('  - size calculation error:', e.message);
        }
      }
    }
  }
}

// 处理数据
const output = [];

for (const item of $input.all()) {
  if (!item.binary || Object.keys(item.binary).length === 0) {
    // 没有binary数据，直接传递
    output.push(item);
    continue;
  }
  
  // 找到第一个binary
  const binaryKeys = Object.keys(item.binary);
  const firstKey = binaryKeys[0];
  const binary = item.binary[firstKey];
  
  // 计算size
  let calculatedSize = 0;
  if (binary.data) {
    calculatedSize = Buffer.from(binary.data, 'base64').length;
  } else if (binary.fileSize) {
    calculatedSize = binary.fileSize;
  }
  
  console.log(`\n✅ 处理文件: ${binary.fileName}`);
  console.log(`   Size: ${calculatedSize} bytes (${(calculatedSize / 1024 / 1024).toFixed(2)} MB)`);
  
  // 输出
  output.push({
    json: {
      ...item.json,
      size: calculatedSize,
      fileName: binary.fileName || item.json.fileName,
      binaryProperty: firstKey
    },
    binary: item.binary
  });
}

return output;
