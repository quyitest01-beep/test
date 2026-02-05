/* ========== 使用n8n内置变量 ========== */

// 在n8n的Code节点中，可以直接访问 $json 和 $binary
// 不需要使用 $input.all() 或 $items()

console.log('=== 使用内置变量 ===');
console.log('$json keys:', Object.keys($json));
console.log('$binary keys:', Object.keys($binary));

// 计算size
let size = 0;
let binaryKey = null;

if ($binary && Object.keys($binary).length > 0) {
  const binaryKeys = Object.keys($binary);
  binaryKey = binaryKeys[0];
  const binary = $binary[binaryKey];
  
  console.log(`使用 binary key: ${binaryKey}`);
  console.log('Binary fileName:', binary.fileName);
  
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
    console.log(`文件大小: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

// 返回：保留原有数据 + 添加size
return {
  json: {
    ...$json,  // 保留所有原有字段
    size: size,
    binaryProperty: binaryKey || 'data'
  },
  binary: $binary  // 传递binary数据
};
