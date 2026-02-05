/* ========== 强制输出binary数据 ========== */

console.log('=== 检查输入 ===');
console.log('typeof $json:', typeof $json);
console.log('typeof $binary:', typeof $binary);

// 检查$binary是否存在
if (typeof $binary === 'undefined' || !$binary) {
  console.log('❌ $binary 是 undefined 或 null');
  console.log('⚠️ 上游节点可能没有传递binary数据');
} else {
  console.log('✅ $binary 存在');
  console.log('$binary keys:', Object.keys($binary));
}

// 计算size
let size = 0;
let fileName = 'document.pdf';
let binaryKey = 'data';
let hasBinary = false;

if ($binary && typeof $binary === 'object' && Object.keys($binary).length > 0) {
  hasBinary = true;
  const binaryKeys = Object.keys($binary);
  binaryKey = binaryKeys[0];
  const binary = $binary[binaryKey];
  
  console.log(`Binary key: ${binaryKey}`);
  console.log('Binary properties:', Object.keys(binary));
  
  fileName = binary.fileName || fileName;
  
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
    console.log(`✅ 文件大小: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } else if (binary.fileSize) {
    size = binary.fileSize;
    console.log(`✅ 使用fileSize: ${size} bytes`);
  }
} else {
  console.log('⚠️ 没有binary数据，将只输出json');
}

// 构建输出
const output = {
  json: {
    ...$json,
    size: size,
    fileName: fileName,
    binaryProperty: binaryKey,
    debug_has_binary: hasBinary
  }
};

// 关键：只有当$binary存在时才添加binary字段
if (hasBinary) {
  output.binary = $binary;
  console.log('✅ 输出包含binary数据');
} else {
  console.log('⚠️ 输出不包含binary数据（因为输入没有）');
}

console.log('=== 输出 ===');
console.log('Output keys:', Object.keys(output));
console.log('JSON keys:', Object.keys(output.json));

return output;
