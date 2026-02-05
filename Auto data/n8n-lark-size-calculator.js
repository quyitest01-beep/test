/* ========== n8n Code节点：修复飞书上传size参数 ==========
 * 
 * 问题：飞书API要求size参数必须与实际文件大小完全一致
 * 解决：在上传前重新计算准确的文件大小
 * 
 * 使用方法：
 * 1. 在"上传 PDF"节点之前插入此Code节点
 * 2. 确保上游有binary数据（PDF文件）
 * 3. 此节点会自动计算正确的size并传递给下游
 */

const items = $input.all();

return items.map((item, index) => {
  console.log(`\n========== 处理 Item ${index} ==========`);
  
  // 1. 查找binary数据
  let binaryData = null;
  let binaryKey = null;
  
  if (!item.binary) {
    throw new Error(`Item ${index}: 没有找到binary数据`);
  }
  
  // 尝试从不同位置获取binary
  if (item.json.binaryProperty && item.binary[item.json.binaryProperty]) {
    binaryKey = item.json.binaryProperty;
    binaryData = item.binary[binaryKey];
    console.log(`使用指定的binaryProperty: ${binaryKey}`);
  } else if (item.binary.data) {
    binaryKey = 'data';
    binaryData = item.binary.data;
    console.log(`使用默认的'data' binary key`);
  } else {
    // 使用第一个可用的binary key
    const keys = Object.keys(item.binary);
    if (keys.length > 0) {
      binaryKey = keys[0];
      binaryData = item.binary[binaryKey];
      console.log(`使用第一个binary key: ${binaryKey}`);
    }
  }
  
  if (!binaryData) {
    throw new Error(`Item ${index}: 无法找到有效的binary数据`);
  }
  
  // 2. 计算实际文件大小
  let actualSize = 0;
  
  if (binaryData.data) {
    // Base64编码的数据
    const base64Data = binaryData.data;
    actualSize = Buffer.from(base64Data, 'base64').length;
    console.log(`从base64计算大小: ${actualSize} bytes`);
  } else if (binaryData.fileSize) {
    // 如果有fileSize属性
    actualSize = binaryData.fileSize;
    console.log(`使用fileSize属性: ${actualSize} bytes`);
  } else {
    throw new Error(`Item ${index}: 无法确定文件大小`);
  }
  
  // 3. 检查文件大小限制（飞书限制20MB）
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (actualSize > maxSize) {
    throw new Error(`Item ${index}: 文件过大 (${(actualSize / 1024 / 1024).toFixed(2)} MB)，超过飞书20MB限制`);
  }
  
  // 4. 获取文件名
  const fileName = item.json.fileName || binaryData.fileName || `file_${index}.pdf`;
  
  // 5. 打印详细信息
  console.log(`文件信息:`);
  console.log(`  文件名: ${fileName}`);
  console.log(`  Binary Key: ${binaryKey}`);
  console.log(`  Mime Type: ${binaryData.mimeType}`);
  console.log(`  实际大小: ${actualSize} bytes (${(actualSize / 1024 / 1024).toFixed(2)} MB)`);
  
  // 如果有原始的size，对比一下
  if (item.json.size) {
    console.log(`  原始声明size: ${item.json.size} bytes`);
    console.log(`  是否一致: ${item.json.size === actualSize ? '✅ 是' : '❌ 否'}`);
    if (item.json.size !== actualSize) {
      console.log(`  差异: ${actualSize - item.json.size} bytes`);
    }
  }
  
  // 6. 返回修正后的数据
  return {
    json: {
      fileName: fileName,
      size: actualSize,  // 使用准确计算的大小
      binaryProperty: binaryKey,
      parent_type: item.json.parent_type || 'bitable_file',
      parent_node: item.json.parent_node || 'BzfvbqKmXaTXotsyrMmlycZUg9g',
      tenant_access_token: item.json.tenant_access_token,
      // 保留其他可能需要的字段
      ...Object.keys(item.json).reduce((acc, key) => {
        if (!['fileName', 'size', 'binaryProperty', 'parent_type', 'parent_node', 'tenant_access_token'].includes(key)) {
          acc[key] = item.json[key];
        }
        return acc;
      }, {})
    },
    binary: item.binary  // 保持binary数据不变
  };
});
