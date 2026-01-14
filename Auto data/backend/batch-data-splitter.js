// n8n Code节点：分批处理数据拆分器
// 处理大量数据时使用分批处理，避免内存问题

const inputData = $input.all();
const BATCH_SIZE = 1000; // 每批处理1000条数据

console.log(`开始分批处理 ${inputData.length} 条数据，每批 ${BATCH_SIZE} 条`);

// 分批处理函数
function processBatch(batch, startIndex) {
  const merchantData = [];
  const gameData = [];
  const otherData = [];
  
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const data = item.json;
    const originalIndex = startIndex + i;
    
    if (data.stat_type) {
      if (data.stat_type.includes('merchant')) {
        merchantData.push({
          json: {
            ...data,
            dataType: 'merchant',
            originalIndex: originalIndex
          }
        });
      } else if (data.stat_type.includes('game')) {
        gameData.push({
          json: {
            ...data,
            dataType: 'game',
            originalIndex: originalIndex
          }
        });
      } else {
        otherData.push({
          json: {
            ...data,
            dataType: 'other',
            originalIndex: originalIndex
          }
        });
      }
    } else {
      otherData.push({
        json: {
          ...data,
          dataType: 'unknown',
          originalIndex: originalIndex
        }
      });
    }
  }
  
  return { merchantData, gameData, otherData };
}

// 分批处理所有数据
const allMerchantData = [];
const allGameData = [];
const allOtherData = [];

for (let i = 0; i < inputData.length; i += BATCH_SIZE) {
  const batch = inputData.slice(i, i + BATCH_SIZE);
  const result = processBatch(batch, i);
  
  allMerchantData.push(...result.merchantData);
  allGameData.push(...result.gameData);
  allOtherData.push(...result.otherData);
  
  console.log(`已处理 ${Math.min(i + BATCH_SIZE, inputData.length)} / ${inputData.length} 条数据`);
}

console.log(`处理完成:`);
console.log(`- 商户数据: ${allMerchantData.length} 条`);
console.log(`- 游戏数据: ${allGameData.length} 条`);
console.log(`- 其他数据: ${allOtherData.length} 条`);

// 返回合并后的结果
return [
  ...allMerchantData,
  ...allGameData,
  ...allOtherData
];






