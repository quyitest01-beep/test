// n8n Code节点：将清洗后的数据转换为Google Docs可用的HTML格式
// 功能：格式化数据为HTML，添加分页符和标题，便于在Google Docs中创建新页面

const input = $input.first().json;

// 提取周期信息
const periodInfo = input.periodInfo || {};
const currentPeriod = periodInfo.currentPeriod || '未知周期';
const previousPeriod = periodInfo.previousPeriod || null;
const periodType = periodInfo.periodType === 'weekly' ? '周度' : '月度';
const currentPeriodFull = periodInfo.currentPeriodFull || currentPeriod;
const previousPeriodFull = periodInfo.previousPeriodFull || previousPeriod;

// 工具函数：格式化货币
function formatCurrency(value) {
  if (!value || value === 0) return '$0';
  return '$' + Math.round(value).toLocaleString('en-US');
}

// 工具函数：格式化百分比
function formatPercentage(value) {
  if (!value && value !== 0) return 'N/A';
  return value.toFixed(2) + '%';
}

// 工具函数：格式化大数字
function formatNumber(value) {
  if (!value && value !== 0) return '0';
  return Math.round(value).toLocaleString('en-US');
}

// 构建HTML内容
let html = '';

// 添加分页符和标题
html += '<div style="page-break-before: always;">\n';
html += `<h1 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">${currentPeriod}${periodType}数据报告</h1>\n`;
html += `<p><strong>报告周期：</strong>${currentPeriodFull}`;
if (previousPeriodFull) {
  html += ` vs ${previousPeriodFull}`;
}
html += '</p>\n';
html += '<hr>\n\n';

// 一、总体运营概览
html += '<h2>一、总体运营概览</h2>\n';
const overall = input.overall || {};
const overallCurrent = overall.current || {};
const overallPrevious = overall.previous || {};

html += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">\n';
html += '<tr><th>指标</th><th>当前期</th>';
if (overallPrevious) {
  html += '<th>上期</th><th>环比变化</th>';
}
html += '</tr>\n';

html += `<tr><td>总GGR</td><td>${formatCurrency(overallCurrent.totalGGRUSD)}</td>`;
if (overallPrevious) {
  html += `<td>${formatCurrency(overallPrevious.totalGGRUSD)}</td>`;
  const changeRate = overall.ggrChangeRate;
  const changeAmount = overall.ggrChangeAmount;
  html += `<td>${changeRate !== null ? formatPercentage(changeRate) : 'N/A'} (${changeAmount !== null ? formatCurrency(changeAmount) : 'N/A'})</td>`;
}
html += '</tr>\n';

html += `<tr><td>总投注</td><td>${formatCurrency(overallCurrent.totalBetUSD)}</td>`;
if (overallPrevious) {
  html += `<td>${formatCurrency(overallPrevious.totalBetUSD)}</td>`;
  const changeRate = overall.betChangeRate;
  const changeAmount = overall.betChangeAmount;
  html += `<td>${changeRate !== null ? formatPercentage(changeRate) : 'N/A'} (${changeAmount !== null ? formatCurrency(changeAmount) : 'N/A'})</td>`;
}
html += '</tr>\n';

html += `<tr><td>总局数</td><td>${formatNumber(overallCurrent.totalRounds)}</td>`;
if (overallPrevious) {
  html += `<td>${formatNumber(overallPrevious.totalRounds)}</td>`;
  const changeRate = overall.roundsChangeRate;
  const changeAmount = overall.roundsChangeAmount;
  html += `<td>${changeRate !== null ? formatPercentage(changeRate) : 'N/A'} (${changeAmount !== null ? formatNumber(changeAmount) : 'N/A'})</td>`;
}
html += '</tr>\n';

html += `<tr><td>总RTP</td><td>${formatPercentage(overallCurrent.totalRTP)}</td>`;
if (overallPrevious) {
  html += `<td>${formatPercentage(overallPrevious.totalRTP)}</td>`;
  const rtpChange = overall.rtpChange;
  html += `<td>${rtpChange !== null ? formatPercentage(rtpChange) : 'N/A'}</td>`;
}
html += '</tr>\n';

html += `<tr><td>总活跃用户数</td><td>${formatNumber(overallCurrent.totalActiveUsers)}</td>`;
if (overallPrevious) {
  html += `<td>${formatNumber(overallPrevious.totalActiveUsers)}</td>`;
  const changeRate = overall.usersChangeRate;
  const changeAmount = overall.usersChangeAmount;
  html += `<td>${changeRate !== null ? formatPercentage(changeRate) : 'N/A'} (${changeAmount !== null ? formatNumber(changeAmount) : 'N/A'})</td>`;
}
html += '</tr>\n';

html += '</table>\n\n';

// 二、新游戏表现（如果有）
const newGames = input.newGames || [];
if (newGames.length > 0) {
  html += '<h2>二、新游戏表现</h2>\n';
  newGames.forEach((game, index) => {
    html += `<h3>${index + 1}. ${game.gameName}</h3>\n`;
    html += `<p><strong>总GGR：</strong>${formatCurrency(game.totalGGRUSD)}</p>\n`;
    html += `<p><strong>总投注：</strong>${formatCurrency(game.totalBetUSD)}</p>\n`;
    html += `<p><strong>总局数：</strong>${formatNumber(game.totalRounds)}</p>\n`;
    html += `<p><strong>投注用户数：</strong>${formatNumber(game.totalUsers)}</p>\n`;
    html += `<p><strong>RTP：</strong>${formatPercentage(game.rtp)}</p>\n`;
    
    // 主要平台
    if (game.topMerchants && game.topMerchants.length > 0) {
      html += '<p><strong>主要平台：</strong></p><ul>\n';
      game.topMerchants.forEach(merchant => {
        html += `<li>${merchant.merchantName}：${formatCurrency(merchant.ggrUSD)}（${merchant.percentage}%）</li>\n`;
      });
      html += '</ul>\n';
    }
    
    // 主要币种
    if (game.topCurrencies && game.topCurrencies.length > 0) {
      html += '<p><strong>主要币种：</strong></p><ul>\n';
      game.topCurrencies.forEach(currency => {
        html += `<li>${currency.currency}：${formatCurrency(currency.ggrUSD)}（${currency.percentage}%）</li>\n`;
      });
      html += '</ul>\n';
    }
  });
  html += '\n';
}

// 三、商户维度分析
html += '<h2>三、商户维度分析</h2>\n';

// 3.1 商户GGR分析
html += '<h3>3.1 商户GGR分析</h3>\n';
const merchants = input.merchants || {};

if (merchants.topGrowthGGR && merchants.topGrowthGGR.length > 0) {
  html += '<p><strong>前3名贡献最大的商户：</strong></p><ul>\n';
  merchants.topGrowthGGR.forEach(merchant => {
    html += `<li>${merchant.merchantName}：由 ${formatCurrency(merchant.previousGGRUSD)} → ${formatCurrency(merchant.totalGGRUSD)}，环比 ${merchant.ggrChangeRate !== null ? formatPercentage(merchant.ggrChangeRate) : 'N/A'}（${merchant.ggrChangeAmount !== null ? formatCurrency(merchant.ggrChangeAmount) : 'N/A'}）</li>\n`;
  });
  html += '</ul>\n';
}

if (merchants.topDeclineGGR && merchants.topDeclineGGR.length > 0) {
  html += '<p><strong>前3名下滑商户：</strong></p><ul>\n';
  merchants.topDeclineGGR.forEach(merchant => {
    html += `<li>${merchant.merchantName}：由 ${formatCurrency(merchant.previousGGRUSD)} → ${formatCurrency(merchant.totalGGRUSD)}，环比 ${merchant.ggrChangeRate !== null ? formatPercentage(merchant.ggrChangeRate) : 'N/A'}（${merchant.ggrChangeAmount !== null ? formatCurrency(merchant.ggrChangeAmount) : 'N/A'}）</li>\n`;
  });
  html += '</ul>\n';
}

// 3.2 商户投注分析
html += '<h3>3.2 商户投注分析</h3>\n';
// 类似处理投注数据...

// 四、游戏维度分析
html += '<h2>四、游戏维度分析</h2>\n';
// 类似处理游戏数据...

// 五、币种维度分析
html += '<h2>五、币种维度分析</h2>\n';
const currencies = input.currencies || {};

if (currencies.topGrowth && currencies.topGrowth.length > 0) {
  html += '<p><strong>前3名增长币种：</strong></p><ul>\n';
  currencies.topGrowth.forEach(currency => {
    html += `<li>${currency.currency}：由 ${formatCurrency(currency.previousGGRUSD)} → ${formatCurrency(currency.totalGGRUSD)}，环比 ${currency.ggrChangeRate !== null ? formatPercentage(currency.ggrChangeRate) : 'N/A'}（${currency.ggrChangeAmount !== null ? formatCurrency(currency.ggrChangeAmount) : 'N/A'}）</li>\n`;
  });
  html += '</ul>\n';
}

// 六、留存数据分析
html += '<h2>六、留存数据分析</h2>\n';
const retention = input.retention || {};

if (retention.newUserD1 && retention.newUserD1.length > 0) {
  html += '<h3>6.1 TOP20商户-游戏新用户次日留存排行</h3>\n';
  html += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">\n';
  html += '<tr><th>排名</th><th>商户名</th><th>游戏名</th><th>当日用户数</th><th>次日留存率</th></tr>\n';
  retention.newUserD1.forEach(item => {
    html += `<tr><td>${item.rank}</td><td>${item.merchantName}</td><td>${item.gameName}</td><td>${formatNumber(item.dailyUsers)}</td><td>${item.retentionFormatted}</td></tr>\n`;
  });
  html += '</table>\n\n';
}

// 添加结束标签
html += '</div>\n';

return [{
  json: {
    html: html,
    periodInfo: periodInfo,
    originalData: input
  }
}];












