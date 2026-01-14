// n8n Code节点：整合查询结果和SQL信息
// 输入：查询结果（queryId、status）和SQL信息（finalSQL、sqlType等）
// 输出：整合后的数据，供Data Table节点使用

const items = $input.all();

console.log('📥 收到上游数据项数:', items.length);

// 分离查询结果和SQL信息
const queryResults = []; // 包含 queryId 和 status 的项
const sqlRecords = []; // 包含 finalSQL 的项

items.forEach((item, index) => {
  const json = item.json || {};
  
  // 判断是查询结果还是SQL记录
  if (json.queryId && json.status) {
    // 查询结果
    queryResults.push({
      ...json,
      index: index
    });
    console.log(`✅ 识别查询结果 ${index}: queryId=${json.queryId}, status=${json.status}`);
  } else if (json.finalSQL) {
    // SQL记录
    sqlRecords.push({
      ...json,
      index: index
    });
    console.log(`✅ 识别SQL记录 ${index}: sqlType=${json.sqlType || 'single'}, finalSQL长度=${json.finalSQL.length}`);
  } else {
    console.log(`⚠️ 未识别的数据项 ${index}:`, Object.keys(json));
  }
});

console.log(`📊 统计: 查询结果=${queryResults.length}, SQL记录=${sqlRecords.length}`);

// 如果查询结果和SQL记录数量不匹配，给出警告
if (queryResults.length !== sqlRecords.length) {
  console.warn(`⚠️ 警告: 查询结果数量(${queryResults.length})与SQL记录数量(${sqlRecords.length})不匹配`);
}

// 整合数据：将查询结果与SQL记录按顺序匹配
const mergedResults = [];

// 方法1：按顺序匹配（如果数量相同）
if (queryResults.length === sqlRecords.length) {
  for (let i = 0; i < queryResults.length; i++) {
    const queryResult = queryResults[i];
    const sqlRecord = sqlRecords[i];
    
    const merged = {
      // 查询结果字段
      queryId: queryResult.queryId || '',
      result: queryResult.message || queryResult.status || '',
      status: queryResult.status || '',
      
      // SQL记录字段
      sql: sqlRecord.finalSQL || '',
      sqlType: sqlRecord.sqlType || 'single',
      sqlDescription: sqlRecord.sqlDescription || '',
      
      // 其他字段（优先使用SQL记录中的，因为可能包含更完整的信息）
      senderid: sqlRecord.senderid || queryResult.senderid || '',
      chatid: sqlRecord.chatid || queryResult.chatid || '',
      messageid: sqlRecord.messagid || sqlRecord.messageid || queryResult.messageid || '',
      text: sqlRecord.text || queryResult.text || '',
      
      // 保留其他可能有用的字段
      matchedScenarioId: sqlRecord.matchedScenarioId || '',
      outputType: sqlRecord.outputType || '',
      reason: sqlRecord.reason || '',
      knowledgeDocUrl: sqlRecord.knowledgeDocUrl || '',
      hasUrl: sqlRecord.hasUrl || false,
      queryRequirement: sqlRecord.queryRequirement || {},
      
      // 时间戳
      timestamp: queryResult.timestamp || new Date().toISOString(),
      estimatedTime: queryResult.estimatedTime || ''
    };
    
    mergedResults.push(merged);
    console.log(`✅ 整合结果 ${i + 1}: queryId=${merged.queryId}, sqlType=${merged.sqlType}`);
  }
} else {
  // 方法2：尝试通过其他方式匹配（如果数量不同）
  // 优先处理查询结果，尝试匹配SQL记录
  queryResults.forEach((queryResult, index) => {
    // 尝试找到对应的SQL记录（按顺序或通过sqlType）
    const sqlRecord = sqlRecords[index] || sqlRecords[0] || {};
    
    const merged = {
      queryId: queryResult.queryId || '',
      result: queryResult.message || queryResult.status || '',
      status: queryResult.status || '',
      sql: sqlRecord.finalSQL || '',
      sqlType: sqlRecord.sqlType || 'single',
      sqlDescription: sqlRecord.sqlDescription || '',
      senderid: sqlRecord.senderid || queryResult.senderid || '',
      chatid: sqlRecord.chatid || queryResult.chatid || '',
      messageid: sqlRecord.messagid || sqlRecord.messageid || queryResult.messageid || '',
      text: sqlRecord.text || queryResult.text || '',
      matchedScenarioId: sqlRecord.matchedScenarioId || '',
      outputType: sqlRecord.outputType || '',
      reason: sqlRecord.reason || '',
      knowledgeDocUrl: sqlRecord.knowledgeDocUrl || '',
      hasUrl: sqlRecord.hasUrl || false,
      queryRequirement: sqlRecord.queryRequirement || {},
      timestamp: queryResult.timestamp || new Date().toISOString(),
      estimatedTime: queryResult.estimatedTime || ''
    };
    
    mergedResults.push(merged);
    console.log(`✅ 整合结果 ${index + 1} (不匹配模式): queryId=${merged.queryId}, sqlType=${merged.sqlType}`);
  });
  
  // 如果有未匹配的SQL记录，也添加进去（但queryId为空）
  if (sqlRecords.length > queryResults.length) {
    for (let i = queryResults.length; i < sqlRecords.length; i++) {
      const sqlRecord = sqlRecords[i];
      const merged = {
        queryId: '', // 没有对应的查询结果
        result: '等待查询启动',
        status: 'pending',
        sql: sqlRecord.finalSQL || '',
        sqlType: sqlRecord.sqlType || 'single',
        sqlDescription: sqlRecord.sqlDescription || '',
        senderid: sqlRecord.senderid || '',
        chatid: sqlRecord.chatid || '',
        messageid: sqlRecord.messagid || sqlRecord.messageid || '',
        text: sqlRecord.text || '',
        matchedScenarioId: sqlRecord.matchedScenarioId || '',
        outputType: sqlRecord.outputType || '',
        reason: sqlRecord.reason || '',
        knowledgeDocUrl: sqlRecord.knowledgeDocUrl || '',
        hasUrl: sqlRecord.hasUrl || false,
        queryRequirement: sqlRecord.queryRequirement || {},
        timestamp: new Date().toISOString(),
        estimatedTime: ''
      };
      mergedResults.push(merged);
      console.log(`✅ 添加未匹配SQL记录 ${i + 1}: sqlType=${merged.sqlType}`);
    }
  }
}

console.log(`📤 最终输出: ${mergedResults.length} 个整合结果`);

// 验证输出
mergedResults.forEach((result, index) => {
  if (!result.queryId && !result.sql) {
    console.warn(`⚠️ 警告: 输出项 ${index + 1} 既没有queryId也没有sql`);
  }
  console.log(`📋 输出项 ${index + 1}:`, {
    queryId: result.queryId || 'N/A',
    sqlType: result.sqlType || 'N/A',
    hasSQL: !!result.sql,
    hasQueryId: !!result.queryId
  });
});

return mergedResults.map(result => ({ json: result }));

