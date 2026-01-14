// n8n Code节点：拆分商户数据和游戏数据
// 处理上万行数据，按数据类型拆分

const inputData = $input.all();
const merchantData = [];
const gameData = [];

console.log(`开始处理 ${inputData.length} 条数据`);

for (const item of inputData) {
  const data = item.json;
  
  // 根据数据特征判断是商户数据还是游戏数据
  if (data.stat_type === 'merchant_daily' || data.stat_type === 'merchant_monthly') {
    // 商户数据
    merchantData.push({
      json: {
        ...data,
        dataType: 'merchant',
        originalIndex: inputData.indexOf(item)
      }
    });
  } else if (data.stat_type === 'game_daily' || data.stat_type === 'game_monthly') {
    // 游戏数据
    gameData.push({
      json: {
        ...data,
        dataType: 'game',
        originalIndex: inputData.indexOf(item)
      }
    });
  } else {
    // 其他类型数据，可以根据需要处理
    console.log(`未知数据类型: ${data.stat_type}`);
  }
}

console.log(`商户数据: ${merchantData.length} 条`);
console.log(`游戏数据: ${gameData.length} 条`);

// 返回拆分后的数据
// 注意：这个节点会输出两个分支，需要在n8n中配置两个输出连接
return {
  merchantData: merchantData,
  gameData: gameData,
  summary: {
    totalRecords: inputData.length,
    merchantRecords: merchantData.length,
    gameRecords: gameData.length,
    processedAt: new Date().toISOString()
  }
};
