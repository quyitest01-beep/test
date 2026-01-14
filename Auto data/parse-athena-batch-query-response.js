// 处理Athena批量查询状态响应
// n8n Code节点：解析批量查询状态

const queryExecutions = $json.QueryExecutions || [];
const unprocessedIds = $json.UnprocessedQueryExecutionIds || [];

console.log('📥 收到批量查询响应:', {
  processedCount: queryExecutions.length,
  unprocessedCount: unprocessedIds.length
});

// 处理每个查询执行的结果
const results = queryExecutions.map(execution => {
  const status = execution.Status || {};
  const state = status.State || 'UNKNOWN';
  const statistics = execution.Statistics || {};
  
  // 判断状态
  const isRunning = state === 'RUNNING' || state === 'QUEUED';
  const isCompleted = state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED';
  const isSuccess = state === 'SUCCEEDED';
  const isFailed = state === 'FAILED';
  const isCancelled = state === 'CANCELLED';
  
  // 计算运行时间（毫秒）
  const submissionTime = status.SubmissionDateTime ? new Date(status.SubmissionDateTime).getTime() : null;
  const completionTime = status.CompletionDateTime ? new Date(status.CompletionDateTime).getTime() : null;
  const runTimeMs = completionTime && submissionTime ? completionTime - submissionTime : statistics.EngineExecutionTimeInMillis || 0;
  
  return {
    queryExecutionId: execution.QueryExecutionId || '',
    query: execution.Query || '',
    state: state,
    isRunning: isRunning,
    isCompleted: isCompleted,
    isSuccess: isSuccess,
    isFailed: isFailed,
    isCancelled: isCancelled,
    submissionTime: status.SubmissionDateTime || '',
    completionTime: status.CompletionDateTime || null,
    stateChangeReason: status.StateChangeReason || '',
    statistics: {
      engineExecutionTimeMs: statistics.EngineExecutionTimeInMillis || 0,
      dataScannedBytes: statistics.DataScannedInBytes || 0,
      totalExecutionTimeMs: statistics.TotalExecutionTimeInMillis || 0,
      runTimeMs: runTimeMs,
      runTimeFormatted: formatRunTime(runTimeMs)
    },
    resultConfiguration: execution.ResultConfiguration || {}
  };
});

// 格式化运行时间
function formatRunTime(ms) {
  if (!ms || ms === 0) return '0 sec';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} min ${seconds % 60} sec`;
  } else if (minutes > 0) {
    return `${minutes} min ${seconds % 60}.${Math.floor((ms % 1000) / 100)} sec`;
  } else {
    return `${seconds}.${Math.floor((ms % 1000) / 100)} sec`;
  }
}

// 统计信息
const stats = {
  totalCount: queryExecutions.length,
  runningCount: results.filter(r => r.isRunning).length,
  completedCount: results.filter(r => r.isCompleted).length,
  successCount: results.filter(r => r.isSuccess).length,
  failedCount: results.filter(r => r.isFailed).length,
  cancelledCount: results.filter(r => r.isCancelled).length,
  unprocessedCount: unprocessedIds.length
};

console.log('📊 查询状态统计:', stats);

// 构建输出
return {
  json: {
    results: results,
    stats: stats,
    unprocessedIds: unprocessedIds,
    // 如果只有一个结果，也提供扁平化的字段便于后续使用
    ...(results.length === 1 ? {
      queryExecutionId: results[0].queryExecutionId,
      state: results[0].state,
      isRunning: results[0].isRunning,
      isCompleted: results[0].isCompleted,
      finalSQL: results[0].query
    } : {})
  }
};





