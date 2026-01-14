// 提取files数组供Split In Batches使用
const inputData = $input.all();

console.log('=== 提取files数组 ===');
console.log('输入数据数量:', inputData.length);

if (!inputData || inputData.length === 0) {
  return {
    success: false,
    error: '没有输入数据'
  };
}

const item = inputData[0].json;
console.log('输入数据结构:', Object.keys(item));

if (!item.files || !Array.isArray(item.files)) {
  return {
    success: false,
    error: '输入数据中没有files数组',
    availableKeys: Object.keys(item)
  };
}

console.log('files数组长度:', item.files.length);
console.log('files数组内容:', item.files.map(f => f.filename));

// 返回files数组，每个文件作为一个单独的项目
// 这样Split In Batches就可以循环处理每个文件
// 需要将每个文件对象包装在json键下，避免index保留字段冲突
return item.files.map(file => ({
  json: file
}));
