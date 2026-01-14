/* ========== n8n Code 节点：AI-Markdown → 彩色HTML（优化版）========== *
 * 2025-11-14  优化版
 * 1. 修复表格对齐 & 列丢失
 * 2. 全局/平台颜色按评级自动映射
 * 3. 红色渠道行高亮 + 图标
 * 4. 保留 SVG 雷达图（可选）
 * 5. 输出：html、gameName、score、grade、scoreColor、timestamp
 * 6. 正确处理百分比格式化（不乘以100）
 * 7. 支持 • 开头的列表项
 * 8. 改进 Markdown 内联格式解析（加粗、链接等）
 */

const items = $input.all();

if (!items || !items.length) {
  throw new Error('❌ 未收到任何Markdown输入');
}

const results = items.map((item, index) => {
  const raw = item?.json || {};
  const markdownText = raw.output || raw.content || raw.text || '';
  const report = buildHtmlReport(raw, markdownText, index);
  return { json: report };
});

return results;

function buildHtmlReport(rawData, markdownText, index) {
  if (!markdownText) {
    return {
      html: '<html><body>错误：无Markdown内容</body></html>',
      error: 'No markdown',
      gameName: '',
      score: '',
      grade: '',
      scoreColor: '#6b7280',
      timestamp: new Date().toISOString(),
      index,
    };
  }

/* ---------- 1. 提取游戏名、周期、评级、颜色主题 ---------- */
const h1MatchCn = markdownText.match(/^#\s*🎮\s*(.+?)\s*游戏评级报告/m);
const h1MatchEn = markdownText.match(/^#\s*🎮\s*(.+?)\s*Game Rating Report/m);
let gameName = (h1MatchCn || h1MatchEn) ? (h1MatchCn || h1MatchEn)[1].trim() : '';
if (!gameName || gameName === '游戏') {
  gameName = rawData.game?.name ||
             rawData.game_name ||
             rawData.name ||
             rawData.title ||
             '游戏';
}

// 提取周期信息：**周期**：{start} - {end}（{days_range}）
const periodMatchCn = markdownText.match(/\*\*周期\*\*[：:]\s*([^\n（]+)（([^）]+)）/);
const periodMatchEn = markdownText.match(/\*\*Period\*\*[：:]\s*([^\n(]+)(?:\(([^)]+)\))?/);
let dataPeriod = '';
if (periodMatchCn) {
  dataPeriod = periodMatchCn[1].trim();
} else if (periodMatchEn) {
  dataPeriod = periodMatchEn[1].trim();
} else if (rawData.period?.start && rawData.period?.end) {
  dataPeriod = `${rawData.period.start} - ${rawData.period.end}`;
}

// 提取评级信息：**评级**：{tier} 级（{score} 分）
let globalTier = '';
let globalScore = '';

const tierMatch = markdownText.match(/\*\*评级\*\*[：:]\s*([SABC])级（(\d+\.?\d*)分）/);
if (tierMatch) {
  globalTier = tierMatch[1];
  globalScore = tierMatch[2];
} else {
  const tierMatchEn = markdownText.match(/\*\*Rating\*\*[：:]\s*Tier\s*([SABC])\s*\((\d+\.?\d*)\s*points?\)/i);
  if (tierMatchEn) {
    globalTier = tierMatchEn[1];
    globalScore = tierMatchEn[2];
  }
}

if (!globalTier) {
  globalTier = rawData.global_rating?.tier ||
               rawData.summary?.global_tier ||
               '';
}
if (!globalScore) {
  globalScore = rawData.global_rating?.scores?.total_score?.toString() ||
                rawData.summary?.global_score?.toString() ||
                '';
}

// 如果没有从评级信息中提取到，尝试从表格中提取综合得分
if (!globalTier || !globalScore) {
  // 尝试多种表格格式匹配综合得分
  const tableScorePatterns = [
    /\|\s*\*\*综合\*\*\s*\|\s*—\s*\|\s*(\d+\.?\d*)\s*\|\s*—\s*\|/,  // | **综合** | — | 47.42 | — |
    /\|\s*\*\*综合\*\*\s*\|\s*—\s*\|\s*\*\*(\d+\.?\d*)\*\*\s*\|\s*—\s*\|/,  // | **综合** | — | **47.42** | — |
    /\|\s*综合\s*\|\s*—\s*\|\s*(\d+\.?\d*)\s*\|\s*—\s*\|/,  // | 综合 | — | 47.42 | — |
    /\|\s*\*\*综合得分\*\*\s*\|\s*—\s*\|\s*(\d+\.?\d*)\s*\|\s*—\s*\|/,  // | **综合得分** | — | 47.42 | — |
  ];
  
  for (const pattern of tableScorePatterns) {
    const match = markdownText.match(pattern);
    if (match && !globalScore) {
      globalScore = match[1];
      break;
    }
  }
  
  // 根据得分推断等级
  if (globalScore && !globalTier) {
    const scoreNum = parseFloat(globalScore);
    if (!isNaN(scoreNum)) {
      if (scoreNum >= 80) globalTier = 'S';
      else if (scoreNum >= 65) globalTier = 'A';
      else if (scoreNum >= 50) globalTier = 'B';
      else globalTier = 'C';
    }
  }
  
  // 如果还是没有，尝试从文本中提取评级信息（其他格式）
  if (!globalTier) {
    const altTierMatch = markdownText.match(/评级[：:]\s*([SABC])级/);
    if (altTierMatch) {
      globalTier = altTierMatch[1];
    }
  }
}

const scoreColor = {
  S: '#10b981', // 绿色
  A: '#3b82f6', // 蓝色
  B: '#f59e0b', // 橙色
  C: '#ef4444'  // 红色
}[globalTier] || '#6b7280';

// 调试日志
console.log("📊 提取的信息:");
console.log(`  游戏名: ${gameName}`);
console.log(`  周期: ${dataPeriod}`);
console.log(`  评级: ${globalTier}`);
console.log(`  分数: ${globalScore}`);
console.log(`  颜色: ${scoreColor}`);

/* ---------- 2. 内联格式处理（加粗、链接等） ---------- */
function processInlineFormatting(text) {
  if (!text) return '';
  
  // HTML 转义
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // 加粗：**text** 或 __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // 斜体：*text* 或 _text_
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
  
  // 链接：[text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  return html;
}

/* ---------- 3. HTML 转义 ---------- */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ---------- 4. 解析 Markdown 表格（含颜色高亮） ---------- */
function parseMarkdownTable(text, scoreColor, context) {
  const ctx = context || {};
  const rows = text.split('\n').filter(l => l.trim().startsWith('|'));
  if (rows.length < 2) return '';

  // 过滤掉分隔行（仅包含 |---|---| 这样的行）
  const validRows = rows.filter(r => !r.match(/^\|\s*[-:|\s]+\s*\|$/));
  if (validRows.length < 2) return '';

  // 检测是否是平台表
  const headerRow = validRows[0];
  const isPlatformTable = headerRow.includes('平台名称') || 
                          headerRow.includes('平台ID') || 
                          headerRow.includes('排名');
  const isMetricsTable = headerRow.includes('指标') || headerRow.includes('数值') || headerRow.includes('得分');

  // 解析表头
  const headerCells = headerRow.split('|')
    .map(c => c.trim())
    .filter(c => c && !c.match(/^[-:\s]+$/));
  
  if (headerCells.length === 0) return '';

  // 找到各列的索引
  const scoreColIdx = headerCells.findIndex(h => h.includes('得分') || h.includes('综合'));
  const valueColIdx = headerCells.findIndex(h => h.includes('数值') || h.includes('占比') || h.includes('留存') || h.includes('GGR') || h.includes('派彩'));
  const contributionColIdx = headerCells.findIndex(h => h.includes('权重贡献'));

  let html = `<table class="${isPlatformTable ? 'platform-table' : 'metrics-table'}">\n<thead>\n<tr>\n`;
  headerCells.forEach(h => {
    html += `<th>${processInlineFormatting(h)}</th>\n`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';

  // 解析数据行
  const dataRows = validRows.slice(1);
  dataRows.forEach(row => {
    const cells = row.split('|')
      .map(c => c.trim())
      .filter(c => c);
    
    // 确保列数与表头一致
    while (cells.length < headerCells.length) {
      cells.push('');
    }
    if (cells.length > headerCells.length) {
      cells = cells.slice(0, headerCells.length);
    }
    
    // 检测是否是综合行
    const isSummaryRow = cells[0] && (cells[0].includes('综合') || cells[0].includes('总计'));
    
    // 检测红色渠道（包含 🔴、红色，或评级为 C）
    const isRed = !isSummaryRow && cells.some(c => 
      c.includes('🔴') || 
      c.includes('红色') || 
      c.trim() === 'C' ||
      c.trim() === 'C级'
    );
    
    html += `<tr${isRed ? ' class="red-channel-row"' : ''}${isSummaryRow ? ' class="summary-row"' : ''}>\n`;
    cells.forEach((cell, idx) => {
      let cellClass = '';
      let cellStyle = '';
      
      // 综合行特殊样式
      if (isSummaryRow) {
        if (idx === 0) {
          cellClass = 'summary-label';
        } else if (idx === scoreColIdx) {
          cellClass = 'summary-score';
          cellStyle = `background: ${scoreColor}; color: white;`;
          // 提取综合得分（去除加粗标记）
          const scoreValue = cell.replace(/\*\*/g, '').trim();
          const scoreNum = parseFloat(scoreValue);
          if (!isNaN(scoreNum) && !ctx.extractedGlobalScore) {
            ctx.extractedGlobalScore = scoreValue;
            console.log(`📊 从表格中提取到综合得分: ${ctx.extractedGlobalScore}`);
          }
        }
      } else {
        // 得分列：根据数值添加颜色
        if (idx === scoreColIdx && cell && !cell.includes('—')) {
          const scoreNum = parseFloat(cell);
          if (!isNaN(scoreNum)) {
            if (scoreNum >= 80) {
              cellClass = 'score-high'; // 绿色
              cellStyle = 'background: #d1fae5; color: #065f46;';
            } else if (scoreNum >= 50) {
              cellClass = 'score-medium'; // 蓝色
              cellStyle = 'background: #dbeafe; color: #1e40af;';
            } else {
              cellClass = 'score-low'; // 橙色/红色
              cellStyle = 'background: #fee2e2; color: #991b1b;';
            }
          }
        }
        // 数值列：高亮百分比
        if (idx === valueColIdx && cell && (cell.includes('%') || cell.includes('USDT'))) {
          cellClass = 'value-highlight';
          cellStyle = 'background: #eff6ff; color: #1e40af; font-weight: 600;';
        }
        // 权重贡献列：使用主题色
        if (idx === contributionColIdx && cell && !cell.includes('—')) {
          cellStyle = `color: ${scoreColor}; font-weight: 600;`;
        }
      }
      
      const cellContent = processInlineFormatting(cell);
      html += `<td${cellClass ? ` class="${cellClass}"` : ''}${cellStyle ? ` style="${cellStyle}"` : ''}>${cellContent}</td>\n`;
    });
    html += '</tr>\n';
  });

  html += '</tbody>\n</table>\n';
  return html;
}

/* ---------- 5. Markdown → HTML 核心函数 ---------- */
function markdownToHtml(md, scoreColor, context) {
  let html = '';
  let inTable = false;
  let tableLines = [];
  let inList = false;
  let listType = 'ul'; // 'ul' 或 'ol'

  const flushTable = () => {
    if (!inTable) return;
    const tableHtml = parseMarkdownTable(tableLines.join('\n'), scoreColor, context);
    if (tableHtml) {
      html += tableHtml;
    }
    tableLines = [];
    inTable = false;
  };

  const flushList = () => {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
      listType = 'ul';
    }
  };

  const lines = md.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // 表格行
    if (t.startsWith('|') && t.endsWith('|')) {
      if (!inTable) {
        flushList();
      }
      inTable = true;
      tableLines.push(line);
      continue;
    }
    
    // 非表格行，先刷新表格
    flushTable();

    // 空行
    if (!t) {
      flushList();
      continue;
    }

    // 标题（去掉重复的 H1，H1 由 Hero 生成）
    if (t.startsWith('# ')) {
      flushList();
      // 跳过 H1，由 Hero 生成
      continue;
    }
    if (t.startsWith('## ')) {
      flushList();
      const text = t.slice(3).trim();
      html += `<h2>${processInlineFormatting(text)}</h2>\n`;
      continue;
    }
    if (t.startsWith('### ')) {
      flushList();
      const text = t.slice(4).trim();
      html += `<h3>${processInlineFormatting(text)}</h3>\n`;
      continue;
    }

    // 列表项（支持 •、-、*、数字）
    const bulletMatch = t.match(/^[•·]\s+(.+)$/);
    const dashMatch = t.match(/^[-*+]\s+(.+)$/);
    const numMatch = t.match(/^\d+[.)]\s+(.+)$/);
    
    if (bulletMatch || dashMatch) {
      if (!inList || listType !== 'ul') {
        flushList();
        html += '<ul class="bullet-list">\n';
        inList = true;
        listType = 'ul';
      }
      const content = bulletMatch ? bulletMatch[1] : dashMatch[1];
      html += `<li>${processInlineFormatting(content)}</li>\n`;
      continue;
    }
    
    if (numMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${processInlineFormatting(numMatch[1])}</li>\n`;
      continue;
    }

    // 普通段落（处理加粗、链接等）
    flushList();
    
    // 检查是否是纯格式行（如 **核心优势**：）
    if (t.match(/^\*\*[^*]+\*\*[：:]/)) {
      html += `<p class="section-label">${processInlineFormatting(t)}</p>\n`;
    } else {
      html += `<p>${processInlineFormatting(t)}</p>\n`;
    }
  }

  // 最后刷新
  flushTable();
  flushList();

  return html;
}

/* ---------- 6. 先解析 bodyHtml 以提取综合得分 ---------- */
  const context = { extractedGlobalScore: null };

  const bodyHtml = markdownToHtml(markdownText, scoreColor, context)
  .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')  // 去除重复的 H1
  .replace(/<h2[^>]*>[\s\S]*?14\s*日评分报告[\s\S]*?<\/h2>/gi, ''); // 去除重复的 H2

// 如果从表格中提取到了综合得分，且之前没有提取到，则使用它
  if (context.extractedGlobalScore && !globalScore) {
    globalScore = context.extractedGlobalScore;
    console.log(`✅ 使用从表格提取的综合得分: ${globalScore}`);
  // 根据得分推断等级
  const scoreNum = parseFloat(globalScore);
  if (!isNaN(scoreNum) && !globalTier) {
    if (scoreNum >= 80) globalTier = 'S';
    else if (scoreNum >= 65) globalTier = 'A';
    else if (scoreNum >= 50) globalTier = 'B';
    else globalTier = 'C';
  }
}

// 更新 scoreColor（如果评级发生了变化）
const finalScoreColor = {
  S: '#10b981',
  A: '#3b82f6',
  B: '#f59e0b',
  C: '#ef4444'
}[globalTier] || '#6b7280';

/* ---------- 7. 生成 Hero 头图（增强色彩） ---------- */
const heroHtml = `
<header class="hero">
  <div class="hero-left">
    <p class="hero-subtitle">AI智能评级报告</p>
    <h1>${escapeHtml(gameName)} 游戏评级报告</h1>
    ${dataPeriod ? `<p class="hero-meta"><strong>周期</strong>：${escapeHtml(dataPeriod)}</p>` : ''}
    ${globalTier && globalScore ? `<p class="hero-meta"><strong>评级</strong>：<span class="tier-badge tier-${globalTier.toLowerCase()}">${escapeHtml(globalTier)} 级</span>（${escapeHtml(globalScore)} 分）</p>` : ''}
  </div>
  <div class="hero-score">
    <div class="hero-score-box" style="background: ${finalScoreColor}; border-color: ${finalScoreColor};">
      <div class="hero-score-value">${escapeHtml(globalScore || 'N/A')}</div>
      <div class="hero-score-unit">分</div>
    </div>
    <p class="hero-score-label">综合评分</p>
  </div>
</header>`;

const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(gameName)} 游戏评级报告</title>
  <style>
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      font-variant-emoji: emoji; /* 确保 emoji 正确显示 */
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 20px;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 50%, #e0f2fe 100%);
      border-radius: 12px;
      padding: 28px 36px;
      margin-bottom: 28px;
      border: 2px solid ${scoreColor};
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, ${scoreColor} 0%, transparent 100%);
    }
    .hero-left {
      flex: 1;
    }
    .hero-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .hero h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 12px 0;
    }
    .hero-meta {
      font-size: 14px;
      color: #475569;
      margin: 4px 0;
    }
    .hero-meta strong {
      color: #334155;
    }
    .hero-score {
      text-align: center;
      margin-left: 24px;
    }
    .hero-score-box {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 100px;
      padding: 16px 24px;
      border-radius: 8px;
      border: 3px solid ${scoreColor};
      background: ${scoreColor};
      color: #ffffff;
      margin-bottom: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .hero-score-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .hero-score-unit {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
    }
    .hero-score-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .tier-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
    }
    .tier-badge.tier-s {
      background: #d1fae5;
      color: #065f46;
    }
    .tier-badge.tier-a {
      background: #dbeafe;
      color: #1e40af;
    }
    .tier-badge.tier-b {
      background: #fef3c7;
      color: #92400e;
    }
    .tier-badge.tier-c {
      background: #fee2e2;
      color: #991b1b;
    }
    h1, h2, h3 {
      margin: 24px 0 12px;
      font-weight: 600;
      color: #1e293b;
    }
    h1 { font-size: 24px; }
    h2 {
      font-size: 20px;
      border-bottom: 2px solid ${scoreColor};
      padding-bottom: 8px;
    }
    h3 {
      font-size: 18px;
      padding-left: 12px;
      border-left: 3px solid ${scoreColor};
    }
    p {
      margin: 12px 0;
      line-height: 1.7;
    }
    .section-label {
      font-weight: 600;
      color: #1e40af;
      margin-top: 16px;
      padding: 8px 12px;
      background: linear-gradient(90deg, #eff6ff 0%, transparent 100%);
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px 16px;
      border: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    td {
      color: #1f2937;
    }
    .metrics-table th {
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      border-bottom: 2px solid ${scoreColor};
    }
    .metrics-table tbody tr:hover {
      background: #f9fafb;
    }
    .summary-row {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%) !important;
      font-weight: 600;
      border-top: 2px solid ${scoreColor};
    }
    .summary-row td {
      padding: 14px 16px;
    }
    .summary-label {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
    }
    .summary-score {
      font-size: 16px;
      font-weight: 700;
      text-align: center;
    }
    .score-high {
      font-weight: 700;
      border-left: 3px solid #10b981;
    }
    .score-medium {
      font-weight: 700;
      border-left: 3px solid #3b82f6;
    }
    .score-low {
      font-weight: 700;
      border-left: 3px solid #f59e0b;
    }
    .value-highlight {
      font-weight: 600;
      border-left: 2px solid #3b82f6;
    }
    .platform-table th {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-bottom: 2px solid #f59e0b;
    }
    .platform-table .red-channel-row {
      background: rgba(239, 68, 68, 0.12) !important;
      border-left: 4px solid #ef4444;
      position: relative;
    }
    .platform-table .red-channel-row::before {
      content: "⚠";
      position: absolute;
      left: 8px;
      color: #ef4444;
      font-size: 16px;
    }
    .platform-table .red-channel-row td {
      color: #991b1b;
      font-weight: 500;
      padding-left: 32px;
    }
    .platform-table .red-channel-row td:first-child {
      padding-left: 40px;
    }
    .platform-table tbody tr:hover {
      background: #fef2f2;
    }
    ul, ol {
      margin: 12px 0 12px 24px;
      line-height: 1.8;
    }
    .bullet-list li {
      list-style: none;
      position: relative;
      padding-left: 24px;
      margin: 10px 0;
    }
    .bullet-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: ${scoreColor};
      font-weight: bold;
      font-size: 20px;
      top: 2px;
    }
    ul li, ol li {
      margin: 6px 0;
    }
    a {
      color: ${scoreColor};
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }
    a:hover {
      border-bottom-color: ${scoreColor};
    }
    strong {
      font-weight: 600;
      color: #1e293b;
    }
    em {
      font-style: italic;
      color: #475569;
    }
    small {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .report-container {
        box-shadow: none;
        padding: 20px;
      }
      .hero {
        page-break-inside: avoid;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    ${heroHtml}
    ${bodyHtml}
  </div>
</body>
</html>`;

  return {
    html: fullHtml,
    gameName: gameName,
    score: globalScore,
    grade: globalTier,
    scoreColor: scoreColor,
    displayScore: globalScore && globalTier ? `${globalScore}分（${globalTier}级）` : 'N/A',
    timestamp: new Date().toISOString(),
    index,
  };
}
