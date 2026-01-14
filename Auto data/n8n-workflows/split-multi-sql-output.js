// n8n Code节点：拆分多SQL输出为多个查询项
// 输入：解析后的AI输出（可能包含 finalSQL、finalSQL_new、finalSQL_active）
// 输出：每个SQL一个输出项

const input = $input.first().json;

// 检查是否为多SQL场景
const isMultiSQL = input.outputType === '套用模板（多SQL）' || 
                   (input.finalSQL_new && input.finalSQL_active);

console.log('🔍 检查多SQL场景:', {
  outputType: input.outputType,
  hasFinalSQLNew: !!input.finalSQL_new,
  hasFinalSQLActive: !!input.finalSQL_active,
  hasFinalSQL: !!input.finalSQL,
  isMultiSQL: isMultiSQL
});

const outputs = [];

if (isMultiSQL) {
  // 多SQL场景：拆分成多个输出项
  
  // 1. 新用户留存SQL
  if (input.finalSQL_new) {
    outputs.push({
      json: {
        ...input,
        finalSQL: input.finalSQL_new,
        sqlType: 'new',
        sqlDescription: '新用户留存',
        // 清空多SQL相关字段，避免混淆
        finalSQL_new: '',
        finalSQL_active: '',
        outputType: '套用模板'
      }
    });
    console.log('✅ 添加新用户留存SQL输出项');
  }
  
  // 2. 活跃用户留存SQL
  if (input.finalSQL_active) {
    outputs.push({
      json: {
        ...input,
        finalSQL: input.finalSQL_active,
        sqlType: 'active',
        sqlDescription: '活跃用户留存',
        // 清空多SQL相关字段，避免混淆
        finalSQL_new: '',
        finalSQL_active: '',
        outputType: '套用模板'
      }
    });
    console.log('✅ 添加活跃用户留存SQL输出项');
  }
  
  console.log(`📤 多SQL场景：共生成 ${outputs.length} 个输出项`);
} else {
  // 单SQL场景：直接输出
  if (input.finalSQL) {
    outputs.push({
      json: {
        ...input,
        sqlType: 'single',
        sqlDescription: '单SQL查询',
        // 确保多SQL字段为空
        finalSQL_new: '',
        finalSQL_active: ''
      }
    });
    console.log('✅ 单SQL场景：生成1个输出项');
  } else {
    // 如果没有SQL，抛出错误
    throw new Error('未找到有效的SQL语句。finalSQL为空，且不是多SQL场景。');
  }
}

// 验证输出
if (outputs.length === 0) {
  throw new Error('未生成任何输出项。请检查输入数据。');
}

// 验证每个输出项都有finalSQL
outputs.forEach((output, index) => {
  if (!output.json.finalSQL) {
    throw new Error(`输出项 ${index + 1} 缺少 finalSQL 字段`);
  }
  console.log(`✅ 输出项 ${index + 1}: sqlType=${output.json.sqlType}, finalSQL长度=${output.json.finalSQL.length}`);
});

console.log(`📤 最终输出: ${outputs.length} 个输出项`);

return outputs;

