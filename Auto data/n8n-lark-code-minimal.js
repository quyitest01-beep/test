/* ========== 最简版本：只添加size，保留所有数据 ========== */

const items = $input.all();

return items.map(item => {
  // 计算size
  let size = 0;
  
  if (item.binary) {
    const binaryKeys = Object.keys(item.binary);
    if (binaryKeys.length > 0) {
      const binaryKey = binaryKeys[0];
      const binary = item.binary[binaryKey];
      
      if (binary.data) {
        size = Buffer.from(binary.data, 'base64').length;
      } else if (binary.fileSize) {
        size = binary.fileSize;
      }
      
      console.log(`文件: ${binary.fileName}, 大小: ${size} bytes`);
    }
  }
  
  // 返回：保留原有json + 添加size + 保留binary
  return {
    json: {
      ...item.json,
      size: size
    },
    binary: item.binary
  };
});
