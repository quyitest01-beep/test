// n8n Function节点：HTML报告生成器
// 将分析结果转换为美观的HTML报告

const inputData = $input.first().json;

console.log("=== HTML报告生成器开始 ===");

if (!inputData.analyses || !inputData.overallConclusion) {
  console.error("❌ 无效的分析数据");
  return [];
}

const analyses = inputData.analyses;
const summary = inputData.summary || {};
const overallGGR = summary.overallGGR || {};

// 获取报告类型（从输入数据或推断），支持英文到中文的映射
const reportTypeMap = {
  'daily': '日报',
  'weekly': '周报',
  'monthly': '月报',
  '日报': '日报',
  '周报': '周报',
  '月报': '月报'
};

const rawReportType = inputData.reportType || '日报';
const reportType = reportTypeMap[rawReportType] || rawReportType;

// 获取日期范围信息
const dateRanges = inputData.dateRanges || {};
const currentRange = dateRanges.current;
const previousRange = dateRanges.previous;

// 构建标题：YYYYMMDD-YYYYMMDD周报/月报/日报
let reportTitle = reportType;
if (currentRange && currentRange.display) {
  reportTitle = `${currentRange.display}${reportType}`;
}

// 构建环比周期文本
let comparisonPeriodText = '';
if (previousRange && previousRange.display) {
  comparisonPeriodText = `环比周期：${previousRange.display}`;
}

// 不再使用logo图片或图标

// 辅助函数：格式化货币显示，处理-0的情况
function formatCurrencyDisplay(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';
  const num = parseFloat(amount);
  // 处理-0的情况
  if (Math.abs(num) < 0.01) return '$0';
  return `$${num.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
}

// HTML模板
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            background: #f5f7fa;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        
        .header {
            background: #e3f2fd;
            color: #212529;
            padding: 20px 40px;
            position: relative;
            border-bottom: 2px solid #90caf9;
        }
        
        .header-row {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 8px;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin: 0;
            color: #212529;
        }
        
        .header .comparison-period {
            font-size: 14px;
            color: #495057;
            text-align: left;
            margin: 0;
            font-weight: 400;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            padding: 0;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .summary-card {
            text-align: center;
            padding: 30px 20px;
            background: white;
            border-right: 1px solid #e9ecef;
            border-bottom: 1px solid #e9ecef;
            position: relative;
        }
        
        .summary-card:nth-child(2n) {
            border-right: none;
        }
        
        .summary-card:nth-child(n+3) {
            border-bottom: 1px solid #e9ecef;
        }
        
        .summary-card:nth-child(5),
        .summary-card:nth-child(6) {
            border-bottom: none;
        }
        
        .summary-card .label {
            font-size: 14px;
            color: #495057;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .summary-card .value {
            font-size: 28px;
            font-weight: 700;
            color: #212529;
        }
        
        .summary-card .change {
            font-size: 14px;
            margin-top: 8px;
        }
        
        .summary-card .change.positive {
            color: #28a745;
        }
        
        .summary-card .change.negative {
            color: #dc3545;
        }
        
        .content {
            padding: 30px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #212529;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #667eea;
        }
        
        .conclusion-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-left: 4px solid #ffc107;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        
        .conclusion-box h3 {
            color: #856404;
            margin-bottom: 12px;
            font-size: 16px;
        }
        
        .conclusion-box p {
            color: #856404;
            margin: 0;
            white-space: pre-line;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .data-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
        }
        
        .data-table td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .data-table tr:last-child td {
            border-bottom: none;
        }
        
        .data-table tr:hover {
            background: #f8f9fa;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .badge-success {
            background: #d4edda;
            color: #155724;
        }
        
        .badge-danger {
            background: #f8d7da;
            color: #721c24;
        }
        
        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .overall-conclusion {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            margin-top: 40px;
        }
        
        .overall-conclusion h2 {
            font-size: 24px;
            margin-bottom: 20px;
        }
        
        .overall-conclusion p {
            font-size: 16px;
            line-height: 1.8;
            white-space: pre-line;
        }
        
        .footer {
            padding: 20px;
            text-align: center;
            color: #495057;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 头部 -->
        <div class="header">
            <div class="header-row">
                <h1>${reportTitle}</h1>
            </div>
            ${comparisonPeriodText ? `<div class="comparison-period">${comparisonPeriodText}</div>` : ''}
        </div>
        
        <!-- 核心指标汇总 -->
        <div class="summary">
            <div class="summary-card">
                <div class="label">总GGR</div>
                <div class="value">${(overallGGR.current && Math.abs(overallGGR.current) >= 0.01) ? `$${(overallGGR.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</div>
                ${overallGGR.change ? `
                <div class="change ${overallGGR.change.isPositive ? 'positive' : 'negative'}">
                    ${overallGGR.change.display}
                </div>` : ''}
            </div>
            
            ${summary.newGameGGR ? `
            <div class="summary-card">
                <div class="label">新游戏GGR</div>
                <div class="value">${(summary.newGameGGR?.total && Math.abs(summary.newGameGGR.total) >= 0.01) ? `$${(summary.newGameGGR.total || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</div>
                ${summary.newGameGGR?.contribution ? `
                <div class="change positive">
                    占比 ${summary.newGameGGR.contribution}%
                </div>` : ''}
            </div>
            ` : ''}
            
            <div class="summary-card">
                <div class="label">投注总额</div>
                <div class="value">${(summary.betTotal?.total && Math.abs(summary.betTotal.total) >= 0.01) ? `$${(summary.betTotal.total || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</div>
                ${summary.betTotal?.change ? `
                <div class="change ${summary.betTotal.change.isPositive ? 'positive' : 'negative'}">
                    ${summary.betTotal.change.display}
                </div>` : ''}
            </div>
            
            ${summary.newGameBet ? `
            <div class="summary-card">
                <div class="label">新游戏投注总额</div>
                <div class="value">${(summary.newGameBet?.total && Math.abs(summary.newGameBet.total) >= 0.01) ? `$${(summary.newGameBet.total || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</div>
                ${summary.newGameBet?.contribution ? `
                <div class="change positive">
                    占比 ${summary.newGameBet.contribution}%
                </div>` : ''}
            </div>
            ` : ''}
            
            <div class="summary-card">
                <div class="label">活跃用户数</div>
                <div class="value">${(summary.activeUsers?.total || 0).toLocaleString('en-US')}</div>
                ${summary.activeUsers?.change ? `
                <div class="change ${summary.activeUsers.change.isPositive ? 'positive' : 'negative'}">
                    ${summary.activeUsers.change.display}
                </div>` : ''}
            </div>
            
            ${summary.newGameActiveUsers ? `
            <div class="summary-card">
                <div class="label">新游戏活跃用户数</div>
                <div class="value">${(summary.newGameActiveUsers?.total || 0).toLocaleString('en-US')}</div>
                ${summary.newGameActiveUsers?.contribution ? `
                <div class="change positive">
                    占比 ${summary.newGameActiveUsers.contribution}%
                </div>` : ''}
            </div>
            ` : ''}
        </div>
        
        <!-- 内容区域 -->
        <div class="content">
            ${analyses.newGame && analyses.newGame.conclusion ? `
            <div class="section">
                <h2 class="section-title">新游戏分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.newGame.conclusion}</p>
                </div>
                ${analyses.newGame.topGames && analyses.newGame.topGames.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>游戏名</th>
                            <th>GGR</th>
                            <th>首次出现日期</th>
                            <th>核心商户</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.newGame.topGames.map(game => {
                          // 从gameDetails中查找对应游戏的首次出现日期
                          let firstAppearDate = '';
                          if (analyses.newGame.gameDetails) {
                            const gameDetail = analyses.newGame.gameDetails.find(gd => 
                              (gd.name || '').toLowerCase() === (game.name || '').toLowerCase()
                            );
                            if (gameDetail && gameDetail.firstAppearDate) {
                              try {
                                const date = new Date(gameDetail.firstAppearDate);
                                if (!isNaN(date.getTime())) {
                                  const month = date.getMonth() + 1;
                                  const day = date.getDate();
                                  firstAppearDate = `${month}月${day}日`;
                                } else {
                                  firstAppearDate = gameDetail.firstAppearDate;
                                }
                              } catch (e) {
                                firstAppearDate = gameDetail.firstAppearDate;
                              }
                            }
                          }
                          // 如果没有找到，尝试从game对象本身获取
                          if (!firstAppearDate && game.first_appear_date) {
                            try {
                              const date = new Date(game.first_appear_date);
                              if (!isNaN(date.getTime())) {
                                const month = date.getMonth() + 1;
                                const day = date.getDate();
                                firstAppearDate = `${month}月${day}日`;
                              } else {
                                firstAppearDate = game.first_appear_date;
                              }
                            } catch (e) {
                              firstAppearDate = game.first_appear_date;
                            }
                          }
                          return `
                        <tr>
                            <td><strong>${game.name}</strong></td>
                            <td>${(game.ggr && Math.abs(game.ggr) >= 0.01) ? `$${(game.ggr || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td>${firstAppearDate || '-'}</td>
                            <td>${game.merchants ? game.merchants.slice(0, 3).map(m => m.name || m).join(', ') : '-'}</td>
                        </tr>`;
                        }).join('')}
                    </tbody>
                </table>` : ''}
            </div>` : ''}
            
            ${analyses.merchant && analyses.merchant.conclusion ? `
            <div class="section">
                <h2 class="section-title">商户维度分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.merchant.conclusion}</p>
                </div>
                ${analyses.merchant.topGrowth && analyses.merchant.topGrowth.length > 0 ? `
                <h3 style="margin: 20px 0 10px; color: #28a745;">Top增长商户</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>商户名</th>
                            <th>本期GGR</th>
                            <th>环比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.merchant.topGrowth.map(m => `
                        <tr>
                            <td><strong>${m.name}</strong></td>
                            <td>${(m.current && Math.abs(m.current) >= 0.01) ? `$${(m.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td><span class="badge badge-success">${m.change.display}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : ''}
                
                ${analyses.merchant.topDecline && analyses.merchant.topDecline.length > 0 ? `
                <h3 style="margin: 20px 0 10px; color: #dc3545;">Top下滑商户</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>商户名</th>
                            <th>本期GGR</th>
                            <th>环比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.merchant.topDecline.map(m => `
                        <tr>
                            <td><strong>${m.name}</strong></td>
                            <td>${(m.current && Math.abs(m.current) >= 0.01) ? `$${(m.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td><span class="badge badge-danger">${m.change.display}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : ''}
            </div>` : ''}
            
            ${analyses.game && analyses.game.conclusion ? `
            <div class="section">
                <h2 class="section-title">游戏维度分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.game.conclusion}</p>
                </div>
                ${analyses.game.topGrowth && analyses.game.topGrowth.length > 0 ? `
                <h3 style="margin: 20px 0 10px; color: #28a745;">增长游戏 Top 5</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>游戏名</th>
                            <th>本期GGR</th>
                            <th>环比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.game.topGrowth.map(g => `
                        <tr>
                            <td><strong>${g.name}</strong></td>
                            <td>${(g.current && Math.abs(g.current) >= 0.01) ? `$${(g.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td><span class="badge badge-success">${g.change.display}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : ''}
                
                ${analyses.game.topDecline && analyses.game.topDecline.length > 0 ? `
                <h3 style="margin: 20px 0 10px; color: #dc3545;">下滑游戏 Top 5</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>游戏名</th>
                            <th>本期GGR</th>
                            <th>环比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.game.topDecline.map(g => `
                        <tr>
                            <td><strong>${g.name}</strong></td>
                            <td>${(g.current && Math.abs(g.current) >= 0.01) ? `$${(g.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td><span class="badge badge-danger">${g.change.display}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : ''}
            </div>` : ''}
            
            ${analyses.bet && analyses.bet.conclusion ? `
            <div class="section">
                <h2 class="section-title">投注量分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.bet.conclusion}</p>
                </div>
            </div>` : ''}
            
            ${analyses.rounds && analyses.rounds.conclusion ? `
            <div class="section">
                <h2 class="section-title">局数分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.rounds.conclusion}</p>
                </div>
            </div>` : ''}
            
            ${analyses.currency && analyses.currency.conclusion ? `
            <div class="section">
                <h2 class="section-title">币种维度分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.currency.conclusion}</p>
                </div>
                ${analyses.currency.topGrowth && analyses.currency.topGrowth.length > 0 ? `
                <h3 style="margin: 20px 0 10px; color: #28a745;">增长币种</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>币种</th>
                            <th>本期GGR</th>
                            <th>环比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.currency.topGrowth.map(c => `
                        <tr>
                            <td><strong>${c.code}</strong></td>
                            <td>${(c.current && Math.abs(c.current) >= 0.01) ? `$${(c.current || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}` : '$0'}</td>
                            <td><span class="badge badge-success">${c.change.display}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : ''}
            </div>` : ''}
            
            ${analyses.retention && analyses.retention.conclusion ? `
            <div class="section">
                <h2 class="section-title">留存数据分析</h2>
                <div class="conclusion-box">
                    <p>${analyses.retention.conclusion}</p>
                </div>
                ${analyses.retention.newUsers && analyses.retention.newUsers.d1Avg ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>用户类型</th>
                            <th>次日留存</th>
                            <th>7日留存</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>新用户</strong></td>
                            <td>${analyses.retention.newUsers.d1Avg}%</td>
                            <td>${analyses.retention.newUsers.d7Avg}%</td>
                        </tr>
                    </tbody>
                </table>` : ''}
            </div>` : ''}
        </div>
        
        <!-- 总体结论 -->
        <div class="overall-conclusion">
            <h2>总体结论</h2>
            <p>${inputData.overallConclusion || '暂无结论'}</p>
        </div>
        
        <!-- 页脚 -->
        <div class="footer">
            <p>报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p>数据来源: GMP营收、用户数据</p>
        </div>
    </div>
</body>
</html>`;

console.log("✅ HTML报告生成完成");
console.log(`📄 报告类型: ${reportType}`);
console.log(`📄 报告标题: ${reportTitle}`);


return [{
  json: {
    html: html,
    reportType: reportType,
    reportTitle: reportTitle,
    span: reportType === '日报' ? '每日' : reportType === '周报' ? '每周' : '每月'
  }
}];

