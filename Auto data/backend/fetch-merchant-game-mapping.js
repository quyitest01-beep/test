// n8n Code节点：从外部数据源获取商户和游戏映射关系
// 这个节点可以调用API或查询数据库获取最新的映射数据

// 模拟从API获取商户映射数据
async function fetchMerchantMapping() {
  // 这里可以调用你的商户API
  // 例如：从Lark表格API获取商户数据
  const merchantMapping = {
    "10001": "系统商户",
    "10002": "测试商户", 
    "20001": "生产商户A",
    "20002": "生产商户B",
    "30001": "游戏商户C",
    "30002": "游戏商户D",
    "40001": "VIP商户E",
    "40002": "普通商户F"
  };
  
  return merchantMapping;
}

// 模拟从API获取游戏映射数据
async function fetchGameMapping() {
  // 这里可以调用你的游戏API
  // 例如：从Lark表格API获取游戏数据
  const gameMapping = {
    "game_001": "老虎机游戏A",
    "game_002": "扑克游戏B",
    "game_003": "轮盘游戏C", 
    "game_004": "百家乐游戏D",
    "game_005": "骰子游戏E",
    "game_006": "体育博彩F",
    "game_007": "电竞游戏G",
    "game_008": "彩票游戏H"
  };
  
  return gameMapping;
}

// 主处理函数
async function processMappingData() {
  try {
    console.log('开始获取映射数据...');
    
    const merchantMapping = await fetchMerchantMapping();
    const gameMapping = await fetchGameMapping();
    
    console.log(`获取到 ${Object.keys(merchantMapping).length} 个商户映射`);
    console.log(`获取到 ${Object.keys(gameMapping).length} 个游戏映射`);
    
    return {
      json: {
        merchantMapping: merchantMapping,
        gameMapping: gameMapping,
        fetchedAt: new Date().toISOString(),
        summary: {
          merchantCount: Object.keys(merchantMapping).length,
          gameCount: Object.keys(gameMapping).length
        }
      }
    };
    
  } catch (error) {
    console.error('获取映射数据失败:', error);
    throw error;
  }
}

// 执行并返回结果
return await processMappingData();









