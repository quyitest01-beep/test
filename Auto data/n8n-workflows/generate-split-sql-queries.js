// n8n Code 节点：根据拆分计划生成多个SQL查询

const item = $input.item;
const json = item.json;

if (!json.canSplit || !json.splitPlan || !Array.isArray(json.splitPlan)) {
  throw new Error('无法拆分或拆分计划无效: ' + JSON.stringify({
    canSplit: json.canSplit,
    hasSplitPlan: !!json.splitPlan,
    splitPlanType: typeof json.splitPlan
  }));
}

const outputs = [];

// 获取原始查询信息
const originalQuery = json.originalQuery || {};
const merchantId = originalQuery.merchant_id || null;
const timeRange = originalQuery.timeRange || '';

// 为每个拆分计划生成一个SQL查询
json.splitPlan.forEach((plan, index) => {
  // 构建时间范围条件（时间戳，毫秒）
  const startDate = new Date(plan.startTime);
  const endDate = new Date(plan.endTime);
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  
  // 构建基础SQL模板
  let sql = `SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  result,
  currency,
  ROUND(CAST(amount AS DOUBLE), 2) AS amount,
  ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out,
  multiplier,
  balance,
  detail,
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM gmp.game_records
WHERE 1=1`;
  
  // 添加商户号条件
  if (merchantId) {
    sql += `\n  AND merchant_id = '${merchantId}'`;
  }
  
  // 添加时间范围条件（使用时间戳，毫秒）
  sql += `\n  AND created_at >= ${startTimestamp}`;
  sql += `\n  AND created_at <= ${endTimestamp}`;
  
  // 可以添加其他条件（如provider、game_code等）
  // 这里可以根据原始查询需求动态添加
  
  outputs.push({
    json: {
      // 原始消息信息
      chatid: json.chatid,
      senderid: json.senderid,
      messagid: json.messagid,
      type: json.type || 'telegram',
      text: originalQuery.text || json.text || '',
      
      // 拆分信息
      splitPart: plan.part || (index + 1),
      splitTotal: json.splitCount || json.splitPlan.length,
      splitDescription: plan.description || `${plan.startDate} 至 ${plan.endDate}`,
      startDate: plan.startDate,
      endDate: plan.endDate,
      startTime: plan.startTime,
      endTime: plan.endTime,
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      
      // SQL信息
      sql: sql,
      database: 'gmp',
      
      // 原始查询信息（用于后续合并结果）
      originalQuery: {
        text: originalQuery.text || json.text,
        merchant_id: merchantId,
        timeRange: timeRange,
        chatid: json.chatid,
        senderid: json.senderid,
        messagid: json.messagid,
        type: json.type || 'telegram'
      },
      
      // 拆分计划信息
      splitPlan: plan,
      splitStrategy: json.splitStrategy || 'date_range',
      
      // 状态
      splitStatus: 'pending',
      createdAt: new Date().toISOString(),
      
      // 其他字段
      status: `拆分查询 ${plan.part || (index + 1)}/${json.splitCount || json.splitPlan.length}`
    }
  });
});

console.log(`✅ 生成了 ${outputs.length} 个拆分SQL查询`);

return outputs;

