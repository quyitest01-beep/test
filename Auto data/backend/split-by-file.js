// 按文件拆分数据 - 将提取的数据按原始文件分组
const inputs = $input.all();
console.log("=== 按文件拆分数据开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 按原始文件分组数据
const fileGroups = new Map();
let totalProcessed = 0;

inputs.forEach((item, index) => {
  const data = item.json;
  
  // 获取原始文件信息
  const originalFile = item.binary?.data || item.binary?.file;
  const fileName = originalFile?.fileName || `file_${index}`;
  const fileSize = originalFile?.fileSize || 0;
  
  console.log(`📁 处理文件: ${fileName} (${fileSize} bytes)`);
  
  // 初始化文件组
  if (!fileGroups.has(fileName)) {
    fileGroups.set(fileName, {
      fileName: fileName,
      fileSize: fileSize,
      data: [],
      rowCount: 0
    });
  }
  
  // 添加数据到对应文件组
  const fileGroup = fileGroups.get(fileName);
  fileGroup.data.push(data);
  fileGroup.rowCount++;
  totalProcessed++;
});

console.log(`📊 处理完成，共 ${fileGroups.size} 个文件组`);
console.log(`📊 总数据行数: ${totalProcessed}`);

// 输出每个文件组的数据
const results = [];
fileGroups.forEach((fileGroup, fileName) => {
  console.log(`📁 文件组: ${fileName} - ${fileGroup.rowCount} 行数据`);
  
  // 为每个文件组创建一个输出项
  results.push({
    json: {
      fileName: fileName,
      fileSize: fileGroup.fileSize,
      rowCount: fileGroup.rowCount,
      data: fileGroup.data,
      summary: {
        totalRows: fileGroup.rowCount,
        fileSize: fileGroup.fileSize,
        fileName: fileName
      }
    }
  });
});

console.log(`=== 按文件拆分完成 ===`);
console.log(`📊 输出文件组数: ${results.length}`);

return results;







