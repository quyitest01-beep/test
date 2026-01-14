// n8n Code节点：将上游数据整合为格式化的文本（适合Google Docs）
// 功能：将Lark统计数据整合为易读的格式化文本，供Google Docs节点使用

const inputs = $input.all();
console.log("=== 数据整合为格式化文本开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 收集所有输入数据
const allData = [];

inputs.forEach((input, index) => {
  const item = input.json;
  allData.push(item);
  console.log(`📦 收集第 ${index + 1} 项数据`);
});

// 生成格式化的文本内容
let formattedText = '';

// 添加标题
formattedText += '=== 业务数据统计报告 ===\n\n';
formattedText += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
formattedText += `数据项数: ${allData.length}\n\n`;
formattedText += '---\n\n';

// 格式化JSON数据
allData.forEach((item, index) => {
  formattedText += `【数据项 ${index + 1}】\n\n`;
  
  // 如果有新游戏信息
  if (item.english_name) {
    formattedText += `新游戏: ${item.english_name}\n`;
    formattedText += `发布日期: ${item.release_date}\n\n`;
  }
  
  // 如果有周期数据
  if (item.periods && Array.isArray(item.periods)) {
    formattedText += `周期数据 (${item.periods.length} 个周期):\n\n`;
    
    item.periods.forEach((period, pIndex) => {
      formattedText += `  周期 ${pIndex + 1}: ${period.periodDisplay || period.period}\n`;
      formattedText += `    日期范围: ${period.periodFull || period.startDate + ' 至 ' + period.endDate}\n`;
      
      if (period.overall) {
        formattedText += `    总GGR-USD: $${(period.overall.totalGGRUSD || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}\n`;
        formattedText += `    总投注USD: $${(period.overall.totalBetUSD || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}\n`;
        formattedText += `    总派奖USD: $${(period.overall.totalPayoutUSD || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}\n`;
        formattedText += `    总局数: ${(period.overall.totalRounds || 0).toLocaleString('en-US')}\n`;
        formattedText += `    总RTP: ${period.overall.totalRTPFormatted || period.overall.totalRTP + '%'}\n`;
      }
      
      if (period.merchants && period.merchants.length > 0) {
        formattedText += `    商户数: ${period.merchants.length}\n`;
      }
      
      if (period.games && period.games.length > 0) {
        formattedText += `    游戏数: ${period.games.length}\n`;
      }
      
      if (period.currencies && period.currencies.length > 0) {
        formattedText += `    币种数: ${period.currencies.length}\n`;
      }
      
      formattedText += '\n';
    });
  }
  
  // 如果有留存数据
  if (item.periods && Array.isArray(item.periods)) {
    const hasRetention = item.periods.some(p => p.retention);
    if (hasRetention) {
      formattedText += `留存数据:\n\n`;
      item.periods.forEach((period, pIndex) => {
        if (period.retention) {
          formattedText += `  周期 ${pIndex + 1}: ${period.periodDisplay || period.period}\n`;
          if (period.retention.newUsers) {
            formattedText += `    新用户留存Top20 D1: ${period.retention.newUsers.top20D1?.length || 0} 条\n`;
            formattedText += `    新用户留存Top20 D7: ${period.retention.newUsers.top20D7?.length || 0} 条\n`;
          }
          if (period.retention.activeUsers) {
            formattedText += `    活跃用户留存Top20 D1: ${period.retention.activeUsers.top20D1?.length || 0} 条\n`;
            formattedText += `    活跃用户留存Top20 D7: ${period.retention.activeUsers.top20D7?.length || 0} 条\n`;
          }
          formattedText += '\n';
        }
      });
    }
  }
  
  formattedText += '---\n\n';
});

// 添加完整的JSON数据（作为附录）
formattedText += '\n\n=== 完整JSON数据 ===\n\n';
formattedText += JSON.stringify(allData, null, 2);

console.log(`✅ 格式化文本生成完成，长度: ${formattedText.length} 字符`);

// 返回结果
return [{
  json: {
    text: formattedText,
    jsonText: JSON.stringify(allData, null, 2), // 纯JSON版本
    jsonData: allData,
    itemCount: allData.length
  }
}];

