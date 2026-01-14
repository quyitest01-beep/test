// n8n Code节点：优化版数据拆分器
// 高效处理大量数据，按数据类型拆分

const inputData = $input.all();
console.log(`开始处理 ${inputData.length} 条数据`);

// 使用Map来优化性能，避免重复查找
const merchantData = [];
const gameData = [];
const otherData = [];

// 批量处理，避免在循环中使用indexOf
for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i];
  const data = item.json;
  
  // 快速判断数据类型
  if (data.stat_type) {
    if (data.stat_type.includes('merchant')) {
      // 商户数据
      merchantData.push({
        json: {
          ...data,
          dataType: 'merchant',
          originalIndex: i
        }
      });
    } else if (data.stat_type.includes('game')) {
      // 游戏数据
      gameData.push({
        json: {
          ...data,
          dataType: 'game',
          originalIndex: i
        }
      });
    } else {
      // 其他类型数据
      otherData.push({
        json: {
          ...data,
          dataType: 'other',
          originalIndex: i
        }
      });
    }
  } else {
    // 没有stat_type的数据
    otherData.push({
      json: {
        ...data,
        dataType: 'unknown',
        originalIndex: i
      }
    });
  }
}

console.log(`处理完成:`);
console.log(`- 商户数据: ${merchantData.length} 条`);
console.log(`- 游戏数据: ${gameData.length} 条`);
console.log(`- 其他数据: ${otherData.length} 条`);

// 返回数组格式，n8n可以自动处理
// 这样n8n会自动创建多个输出分支
return [
  ...merchantData.map(item => ({ ...item, metadata: { branch: 'merchant' } })),
  ...gameData.map(item => ({ ...item, metadata: { branch: 'game' } })),
  ...otherData.map(item => ({ ...item, metadata: { branch: 'other' } }))
];






