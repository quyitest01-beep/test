// n8n Code节点：游戏ID匹配到游戏名
// 从游戏数据中提取game_id字段，匹配到对应的游戏名

const inputData = $input.all();

// 游戏ID和游戏名的映射关系
// 这个数据应该从你的游戏表中获取，这里提供示例结构
const gameMapping = {
  // 示例数据，实际使用时需要从数据库或API获取
  "game_001": "老虎机游戏A",
  "game_002": "扑克游戏B", 
  "game_003": "轮盘游戏C",
  "game_004": "百家乐游戏D",
  "game_005": "骰子游戏E",
  "game_006": "体育博彩F"
  // 添加更多游戏映射...
};

// 如果游戏映射数据很大，可以从外部API获取
async function getGameMapping() {
  // 这里可以调用你的游戏API获取完整的映射关系
  // 例如：从Lark表格或数据库中获取
  return gameMapping;
}

const outputItems = [];

for (const item of inputData) {
  const data = item.json;
  const gameId = data.game_id;
  
  // 查找游戏名
  const gameName = gameMapping[gameId] || `未知游戏_${gameId}`;
  
  // 创建新的数据项
  outputItems.push({
    json: {
      ...data,
      gameId: gameId,
      gameName: gameName,
      isMatched: gameMapping.hasOwnProperty(gameId),
      matchedAt: new Date().toISOString()
    }
  });
}

console.log(`处理了 ${outputItems.length} 条游戏数据`);
console.log(`匹配成功的游戏: ${outputItems.filter(item => item.json.isMatched).length} 条`);

return outputItems;









