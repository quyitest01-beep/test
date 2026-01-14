// HTML生成模块（从 ai-report-to-html.js 提取的核心函数）
// 可以在 Node.js 环境中直接使用

// 转义HTML特殊字符
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// 处理行内格式（代码、粗体、斜体、数字、百分比、货币）
function processInlineFormatting(text) {
  if (!text) return '';
  
  let html = escapeHtml(text);
  
  // 处理代码（`code`）- 先处理，避免影响其他格式
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 处理粗体（**text**）
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 使用占位符策略，避免重复处理
  const placeholders = [];
  let placeholderIndex = 0;
  const getPlaceholder = () => `__PLACEHOLDER_${placeholderIndex++}__`;
  
  // 1. 先处理货币金额（完整格式：$xxx,xxx.xx 或 $xxx）
  html = html.replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+)/g, (match) => {
    const placeholder = getPlaceholder();
    placeholders.push({ placeholder, replacement: `<span class="currency">${match}</span>` });
    return placeholder;
  });
  
  // 2. 处理百分比（正负值，带颜色标记）
  html = html.replace(/([+-]?\d+\.?\d*%)/g, (match) => {
    if (match.includes('__PLACEHOLDER_')) {
      return match;
    }
    const num = parseFloat(match);
    const placeholder = getPlaceholder();
    const className = num >= 0 ? 'percentage' : 'percentage-negative';
    placeholders.push({ placeholder, replacement: `<span class="${className}">${match}</span>` });
    return placeholder;
  });
  
  // 3. 处理大数字（逗号分隔的数字）
  const originalHtml = html;
  html = html.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, function(match, p1, offset) {
    if (match.includes('__PLACEHOLDER_')) {
      return match;
    }
    const before = originalHtml.substring(Math.max(0, offset - 50), offset);
    const after = originalHtml.substring(offset, offset + match.length + 50);
    if (before.match(/<[^>]*$/) || after.match(/^[^<]*>/)) {
      return match;
    }
    const placeholder = getPlaceholder();
    placeholders.push({ placeholder, replacement: `<span class="highlight-number">${match}</span>` });
    return placeholder;
  });
  
  // 4. 恢复所有占位符
  placeholders.forEach(({ placeholder, replacement }) => {
    html = html.replace(placeholder, replacement);
  });
  
  // 处理斜体（*text*）
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  
  return html;
}

// Markdown转HTML
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  const lines = markdown.split('\n');
  const processedLines = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let lastIndent = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 空行处理
    if (!trimmed) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push('');
      lastIndent = 0;
      continue;
    }
    
    // 处理标题
    if (trimmed.startsWith('### ')) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(`<h3>${trimmed.substring(4)}</h3>`);
      lastIndent = 0;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(`<h2>${trimmed.substring(3)}</h2>`);
      lastIndent = 0;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(`<h1>${trimmed.substring(2)}</h1>`);
      lastIndent = 0;
      continue;
    }
    
    // 处理分隔线
    if (trimmed === '---') {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push('<hr>');
      lastIndent = 0;
      continue;
    }
    
    // 处理无序列表
    const unorderedMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (unorderedMatch) {
      const indent = unorderedMatch[1].length;
      const content = processInlineFormatting(unorderedMatch[3]);
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      if (!inUnorderedList || indent !== lastIndent) {
        if (inUnorderedList && indent < lastIndent) { processedLines.push('</ul>'); }
        processedLines.push('<ul>');
        inUnorderedList = true;
        lastIndent = indent;
      }
      processedLines.push(`<li>${content}</li>`);
      continue;
    }
    
    // 处理有序列表
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const indent = orderedMatch[1].length;
      const content = processInlineFormatting(orderedMatch[3]);
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (!inOrderedList || indent !== lastIndent) {
        if (inOrderedList && indent < lastIndent) { processedLines.push('</ol>'); }
        processedLines.push('<ol>');
        inOrderedList = true;
        lastIndent = indent;
      }
      processedLines.push(`<li>${content}</li>`);
      continue;
    }
    
    // 普通段落
    if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
    if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
    lastIndent = 0;
    
    const formatted = processInlineFormatting(trimmed);
    // 检查是否是结论段落或新游戏总结
    const isConclusion = trimmed.includes('结论：') || trimmed.includes('结论:');
    const isNewGameSummary = trimmed.includes('新游戏总结') || trimmed.includes('新游戏:') || 
                            (trimmed.includes('新游戏') && (trimmed.includes('GGR') || trimmed.includes('合计')));
    
    let className = '';
    if (isNewGameSummary) {
      className = 'new-game-summary';
    } else if (isConclusion) {
      className = 'conclusion-box';
    }
    
    if (className) {
      processedLines.push(`<p class="${className}">${formatted}</p>`);
    } else {
      processedLines.push(`<p>${formatted}</p>`);
    }
  }
  
  // 关闭所有打开的列表
  if (inUnorderedList) { processedLines.push('</ul>'); }
  if (inOrderedList) { processedLines.push('</ol>'); }
  
  return processedLines.join('\n');
}

// 提取报告周期信息并生成标题
function extractReportTitle(markdownContent) {
  let currentPeriod = '';
  let reportType = '周报';
  
  const periodPatterns = [
    /\*\*当前周期[：:]\*\*\s*(\d{8})\s*[-至]\s*(\d{8})/,
    /当前周期[（(]CP[）)]:\s*\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,
    /当前周期[（(]CP[）)][：:]\s*(\d{8})\s*[-至]\s*(\d{8})/,
    /当前周期[：:]\s*(\d{8})\s*[-至]\s*(\d{8})/,
    /\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,
    /(\d{8})\s*[-至]\s*(\d{8})/,
  ];
  
  for (const pattern of periodPatterns) {
    const match = markdownContent.match(pattern);
    if (match && match[1] && match[2]) {
      const start = match[1];
      const end = match[2];
      if (/^\d{8}$/.test(start) && /^\d{4}$/.test(end)) {
        const endFull = start.substring(0, 4) + end;
        currentPeriod = `${start} - ${endFull}`;
      } else if (/^\d{8}$/.test(start) && /^\d{8}$/.test(end)) {
        currentPeriod = `${start} - ${end}`;
      }
      if (currentPeriod) break;
    }
  }
  
  const typePatterns = [
    /报告类型[：:]\s*\*\*([周月]报)\*\*/,
    /报告类型[：:]\s*([周月]报)/,
    /([周月]报)/,
  ];
  
  for (const pattern of typePatterns) {
    const match = markdownContent.match(pattern);
    if (match && match[1]) {
      reportType = match[1];
      break;
    }
  }
  
  // 生成标题：优先使用周期信息，格式为：20251027 - 20251102周度数据报告
  let title = '业务数据统计报告';
  if (currentPeriod) {
    const typeText = reportType === '月报' ? '月度数据报告' : '周度数据报告';
    title = `${currentPeriod}${typeText}`;
  }
  
  return { title, currentPeriod, reportType };
}

// 生成完整的HTML文档
function generateHtmlReport(markdownContent) {
  const htmlContent = markdownToHtml(markdownContent);
  const { title, currentPeriod, reportType } = extractReportTitle(markdownContent);
  
  let reportPeriod = '';
  const periodMatch = markdownContent.match(/\*\*当前周期[：:]\*\*\s*(.+?)(?:\n|$)/);
  if (periodMatch) {
    reportPeriod = periodMatch[1].trim();
  } else if (currentPeriod) {
    reportPeriod = `当前周期: ${currentPeriod}`;
  }
  
  let prevPeriod = '';
  const prevPeriodMatch = markdownContent.match(/\*\*上一个周期[（(]PP[）)][：:]\*\*\s*(.+?)(?:\n|$)/);
  if (prevPeriodMatch) {
    prevPeriod = prevPeriodMatch[1].trim();
  }
  
  // 完整的CSS样式
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      background: #ffffff;
      padding: 40px;
      max-width: 210mm;
      margin: 0 auto;
    }
    
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 15px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #2c3e50;
      margin: 30px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #34495e;
      margin: 20px 0 10px 0;
    }
    
    p {
      margin: 10px 0;
      text-align: justify;
      line-height: 1.8;
    }
    
    ul, ol {
      margin: 10px 0 10px 20px;
      padding-left: 20px;
    }
    
    ul {
      list-style-type: disc;
    }
    
    ol {
      list-style-type: decimal;
    }
    
    li {
      margin: 8px 0;
      line-height: 1.7;
    }
    
    ul ul, ol ol, ul ol, ol ul {
      margin-top: 5px;
      margin-bottom: 5px;
    }
    
    code {
      background-color: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 3px;
      padding: 2px 6px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #d14;
    }
    
    strong {
      font-weight: 600;
      color: #1a1a1a;
    }
    
    em {
      font-style: italic;
      color: #555;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 30px 0;
    }
    
    .report-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .report-period-info {
      display: flex;
      gap: 20px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    
    .report-period-item {
      font-size: 13px;
      color: #666;
    }
    
    .report-period-item strong {
      color: #333;
      font-weight: 600;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 13px;
    }
    
    th, td {
      border: 1px solid #e0e0e0;
      padding: 8px 12px;
      text-align: left;
    }
    
    th {
      background-color: #f5f5f5;
      font-weight: 600;
      color: #333;
    }
    
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    
    .highlight-number {
      color: #2c3e50;
      font-weight: 600;
      font-family: 'Courier New', 'Menlo', monospace;
      background-color: #f8f9fa;
      padding: 1px 4px;
      border-radius: 3px;
    }
    
    .currency {
      font-family: 'Courier New', 'Menlo', monospace;
      font-weight: 700;
      color: #1a73e8;
      background-color: #e8f0fe;
      padding: 2px 5px;
      border-radius: 3px;
    }
    
    strong .currency,
    strong .percentage,
    strong .percentage-negative,
    strong .highlight-number {
      font-size: 1.05em;
    }
    
    .conclusion-box {
      background-color: #f0f7ff;
      border-left: 4px solid #3498db;
      padding: 15px 18px;
      margin: 20px 0;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    .new-game-summary {
      background-color: #fff9e6;
      border: 1px solid #ffd700;
      border-left: 4px solid #ffa500;
      padding: 15px 18px;
      margin: 20px 0;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    .percentage {
      color: #27ae60 !important;
      font-weight: 700;
      background-color: #d4edda;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .percentage-negative {
      color: #e74c3c !important;
      font-weight: 700;
      background-color: #f8d7da;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    @media print {
      body {
        padding: 20px;
        font-size: 12px;
      }
      
      h1 {
        font-size: 22px;
      }
      
      h2 {
        font-size: 18px;
      }
      
      h3 {
        font-size: 16px;
      }
      
      .currency,
      .percentage,
      .percentage-negative,
      .highlight-number {
        background-color: transparent !important;
        padding: 0;
      }
      
      @page {
        margin: 20mm;
        size: A4;
      }
      
      ul, ol {
        page-break-inside: avoid;
      }
      
      h1, h2, h3 {
        page-break-after: avoid;
      }
      
      .conclusion-box {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    ${reportPeriod || prevPeriod ? `
    <div class="report-period-info">
      ${reportPeriod ? `<div class="report-period-item"><strong>当前周期(CP):</strong> ${escapeHtml(reportPeriod)}</div>` : ''}
      ${prevPeriod ? `<div class="report-period-item"><strong>上一个周期(PP):</strong> ${escapeHtml(prevPeriod)}</div>` : ''}
      ${reportType ? `<div class="report-period-item"><strong>报告类型:</strong> ${escapeHtml(reportType)}</div>` : ''}
    </div>
    ` : ''}
  </div>
  <div class="report-content">
    ${htmlContent}
  </div>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #999;">
    <p>报告生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
  </div>
</body>
</html>`;
  
  return html;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateHtmlReport,
    extractReportTitle,
    markdownToHtml,
    processInlineFormatting,
    escapeHtml
  };
}

