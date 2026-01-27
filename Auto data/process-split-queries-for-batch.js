// 处理上游拆分查询数据，转换为批量查询API所需格式
// 输入：上游拆分分析结果数组
// 输出：每个SQL查询作为独立的输出项，符合 /api/batch/start 格式

// 从上游数据中提取所有需要执行的SQL查询
const upstreamData = $input.all();

// 存储所有输出项
const outputItems = [];
let queryCounter = 0;

// 遍历上游的每个分析结果
upstreamData.forEach((item, index) => {
  const data = item.json;
  
  if (data.canSplit && data.splitPlan && data.splitPlan.length > 0) {
    // 如果可以拆分，为每个拆分后的SQL创建独立的输出项
    data.splitPlan.forEach((plan) => {
      queryCounter++;
      // 生成唯一的查询名称
      const queryName = `part${plan.part}_${plan.startDate}_to_${plan.endDate}`;
      
      // 创建符合API格式的queries对象
      const queriesObj = {};
      queriesObj[queryName] = plan.sql;
      
      outputItems.push({
        json: {
          queries: queriesObj,
          database: 'gmp'
        }
      });
    });
  } else if (data.sql) {
    // 如果不拆分但有SQL，创建单个输出项
    queryCounter++;
    const queryName = `query_${queryCounter}`;
    
    const queriesObj = {};
    queriesObj[queryName] = data.sql;
    
    outputItems.push({
      json: {
        queries: queriesObj,
        database: 'gmp'
      }
    });
  }
  // 如果既不能拆分也没有SQL，跳过
});

// 返回所有输出项
return outputItems;
