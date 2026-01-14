// n8n Code节点：业务数据报告JSON转HTML
// 功能：将AI Agent输出的JSON报告转换为格式化的HTML，用于PDF生成

const inputs = $input.all();
console.log("=== 业务数据报告JSON转HTML开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：转义HTML特殊字符
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

// 工具函数：Markdown转HTML（增强版）
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  // 确保markdown是字符串类型
  if (typeof markdown !== 'string') {
    console.warn(`⚠️ markdownToHtml: 输入不是字符串类型，当前类型: ${typeof markdown}，尝试转换`);
    markdown = String(markdown || '');
  }
  
  const lines = markdown.split('\n');
  const processedLines = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let lastIndent = 0;
  let inTable = false;
  let tableRows = [];
  let inSummarySection = false;
  
  // 预处理：跳过开头的报告周期行和横线
  let startIndex = 0;
  
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const trimmed = lines[i].trim();
    
    // 跳过报告周期行
    if (trimmed.match(/^报告周期[：:]/) || trimmed.match(/^报告周期信息[：:]/)) {
      startIndex = i + 1;
      if (i + 1 < lines.length && (lines[i + 1].trim() === '---' || lines[i + 1].trim() === '***')) {
        startIndex = i + 2;
      }
      break;
    }
    
    // 跳过开头的标题行
    if (trimmed.match(/^#+\s*业务数据/) || trimmed.match(/^#+\s*[0-9]{8}/)) {
      startIndex = i + 1;
      if (i + 1 < lines.length && (lines[i + 1].trim() === '---' || lines[i + 1].trim() === '***')) {
        startIndex = i + 2;
      }
      break;
    }
    
    if (trimmed && !trimmed.startsWith('#') && trimmed !== '---' && trimmed !== '***' && !trimmed.match(/^报告周期[：:]/) && !trimmed.match(/^报告周期信息[：:]/)) {
      break;
    }
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 处理表格
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      continue;
    } else {
      if (inTable && tableRows.length > 0) {
        processedLines.push(processTable(tableRows));
        tableRows = [];
        inTable = false;
      }
    }
    
    // 空行处理
    if (!trimmed) {
      if (inUnorderedList) {
        processedLines.push('</ul>');
        inUnorderedList = false;
        if (inSummarySection && lastIndent === 0) {
          processedLines.push('</div>');
          inSummarySection = false;
        }
        lastIndent = 0;
      }
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
        lastIndent = 0;
      }
      processedLines.push('');
      continue;
    }
    
    // 处理标题
    if (trimmed.startsWith('### ')) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      if (inSummarySection) {
        processedLines.push('</div>');
        inSummarySection = false;
      }
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
    if (trimmed === '---' || trimmed === '***') {
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      if (prevLine.match(/^报告周期[：:]/) || prevLine.match(/^报告周期信息[：:]/)) {
        continue;
      }
      if (processedLines.length > 0) {
        if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
        if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
        processedLines.push('<hr>');
        lastIndent = 0;
      }
      continue;
    }
    
    // 处理无序列表
    const unorderedMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (unorderedMatch) {
      const indent = unorderedMatch[1].length;
      const content = processInlineFormatting(unorderedMatch[3]);
      
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      
      if (!inUnorderedList || indent !== lastIndent) {
        if (inUnorderedList && indent < lastIndent) {
          processedLines.push('</ul>');
          if (inSummarySection && lastIndent === 0 && indent < lastIndent) {
            processedLines.push('</div>');
            inSummarySection = false;
          }
        }
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
      
      if (inUnorderedList) {
        processedLines.push('</ul>');
        inUnorderedList = false;
      }
      
      if (!inOrderedList || indent !== lastIndent) {
        if (inOrderedList && indent < lastIndent) {
          processedLines.push('</ol>');
        }
        processedLines.push('<ol>');
        inOrderedList = true;
        lastIndent = indent;
      }
      
      processedLines.push(`<li>${content}</li>`);
      continue;
    }
    
    // 普通段落
    if (inUnorderedList) {
      processedLines.push('</ul>');
      inUnorderedList = false;
      lastIndent = 0;
    }
    if (inOrderedList) {
      processedLines.push('</ol>');
      inOrderedList = false;
      lastIndent = 0;
    }
    
    const formatted = processInlineFormatting(trimmed);
    
    // 检查是否是小结标题
    const isSummaryTitle = trimmed.includes('**小结**') || trimmed === '小结';
    
    if (isSummaryTitle) {
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push('<div class="summary-section">');
      processedLines.push(`<p class="summary-title">${formatted}</p>`);
      inSummarySection = true;
      lastIndent = 0;
      continue;
    }
    
    // 检查是否是结论段落
    const isConclusion = trimmed.includes('结论：') || trimmed.includes('结论:');
    const isNewGameSummary = trimmed.includes('新游戏总结') || trimmed.includes('新游戏:');
    
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
  
  // 处理最后可能存在的表格
  if (inTable && tableRows.length > 0) {
    processedLines.push(processTable(tableRows));
  }
  
  // 关闭所有打开的列表和小结容器
  if (inUnorderedList) {
    processedLines.push('</ul>');
  }
  if (inOrderedList) {
    processedLines.push('</ol>');
  }
  if (inSummarySection) {
    processedLines.push('</div>');
  }
  
  return processedLines.join('\n');
}

// 处理Markdown表格
function processTable(tableRows) {
  if (tableRows.length === 0) return '';
  
  let html = '<table>\n';
  let headerProcessed = false;
  
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i].trim();
    if (!row) continue;
    
    // 跳过分隔行
    if (row.match(/^[\|\s:\-]+$/)) {
      headerProcessed = true;
      continue;
    }
    
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
    
    if (cells.length === 0) continue;
    
    const isHeader = !headerProcessed && (i === 0 || (i === 1 && tableRows[0].match(/^[\|\s:\-]+$/)));
    
    if (isHeader) {
      headerProcessed = true;
    }
    
    html += '<tr>\n';
    
    for (const cell of cells) {
      const cellContent = processInlineFormatting(cell);
      if (isHeader) {
        html += `<th>${cellContent}</th>\n`;
      } else {
        let className = '';
        const trimmedCell = cell.trim();
        
        // 检查百分比
        if (trimmedCell.match(/^[+\-]?\d+\.?\d*%$/)) {
          const num = parseFloat(trimmedCell);
          className = num >= 0 ? 'percentage' : 'percentage-negative';
        } 
        // 检查货币
        else if (trimmedCell.match(/^[+\-]?\$[\d,]+(\.\d{2})?$/)) {
          className = 'currency';
          if (trimmedCell.startsWith('-')) {
            className = 'currency-negative';
          } else if (trimmedCell.startsWith('+')) {
            className = 'currency-positive';
          }
        }
        // 检查大数字
        else if (trimmedCell.match(/^[+\-]?[\d,]+$/)) {
          className = 'highlight-number';
          if (trimmedCell.startsWith('-')) {
            className = 'highlight-number-negative';
          } else if (trimmedCell.startsWith('+')) {
            className = 'highlight-number-positive';
          }
        }
        
        html += `<td${className ? ` class="${className}"` : ''}>${cellContent}</td>\n`;
      }
    }
    
    html += '</tr>\n';
  }
  
  html += '</table>';
  return html;
}

// 处理行内格式
function processInlineFormatting(text) {
  if (!text) return '';
  
  let html = escapeHtml(text);
  
  // 处理代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 处理粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 使用占位符策略
  const placeholders = [];
  let placeholderIndex = 0;
  const getPlaceholder = () => `__PLACEHOLDER_${placeholderIndex++}__`;
  
  // 1. 先处理货币金额
  html = html.replace(/([+-]?\$[\d,]+(?:\.\d{2})?)/g, (match) => {
    const placeholder = getPlaceholder();
    let className = 'currency';
    if (match.startsWith('+')) {
      className = 'currency-positive';
    } else if (match.startsWith('-')) {
      className = 'currency-negative';
    }
    placeholders.push({ placeholder, replacement: `<span class="${className}">${match}</span>` });
    return placeholder;
  });
  
  // 2. 处理百分比
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
  
  // 3. 处理大数字
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
  
  // 处理斜体
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  
  return html;
}

// 提取报告标题
function extractTitle(markdown) {
  if (!markdown) return '业务数据统计报告';
  
  let currentPeriod = '';
  let reportType = '周度数据报告';
  
  // 提取周期信息
  const periodPatterns = [
    {
      pattern: /报告周期信息[：:]\s*本期\s*\((\d{1,2})\.(\d{1,2})-(\\d{1,2})\.(\d{1,2})\)/,
      handler: (match) => {
        const startMonth = parseInt(match[1], 10);
        const startDay = parseInt(match[2], 10);
        const endMonth = parseInt(match[3], 10);
        const endDay = parseInt(match[4], 10);
        const currentYear = new Date().getFullYear();
        const start = `${currentYear}${String(startMonth).padStart(2, '0')}${String(startDay).padStart(2, '0')}`;
        const end = `${currentYear}${String(endMonth).padStart(2, '0')}${String(endDay).padStart(2, '0')}`;
        return { start, end };
      }
    },
    {
      pattern: /(\d{8})\s*[-至]\s*(\d{8})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    }
  ];
  
  for (const patternConfig of periodPatterns) {
    const match = markdown.match(patternConfig.pattern);
    if (match) {
      try {
        const result = patternConfig.handler(match);
        if (result && result.start && result.end) {
          let start = result.start;
          let end = result.end;
          
          if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
            start = start.replace(/-/g, '');
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            end = end.replace(/-/g, '');
          }
          
          if (/^\d{8}$/.test(start) && /^\d{8}$/.test(end)) {
            currentPeriod = `${start}-${end}`;
            break;
          }
        }
      } catch (e) {
        console.warn('Period pattern handler error:', e);
        continue;
      }
    }
  }
  
  // 提取报告类型
  const typePatterns = [
    /报告类型[：:]\s*\*\*([周月]报)\*\*/,
    /报告类型[：:]\s*([周月]报)/,
    /([周月]报)/
  ];
  
  for (const pattern of typePatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const type = match[1];
      reportType = type === '月报' ? '月度数据报告' : '周度数据报告';
      break;
    }
  }
  
  if (currentPeriod) {
    return `${currentPeriod}${reportType}`;
  }
  
  return '业务数据统计报告';
}

// 生成完整的HTML文档
function generateHtmlReport(markdownContent) {
  const htmlContent = markdownToHtml(markdownContent);
  const title = extractTitle(markdownContent);
  
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
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 10px 0;
      padding-bottom: 10px;
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
      border-bottom: 1px solid #e0e0e0;
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
    
    table {
      background-color: transparent;
    }
    
    table td, table th {
      background-color: inherit;
    }
    
    table tr:nth-child(even) td {
      background-color: #fafafa;
    }
    
    table th {
      background-color: #f5f5f5;
    }
    
    .currency {
      font-family: 'Courier New', 'Menlo', monospace;
      font-weight: 700;
      color: #1a73e8;
      background-color: #e8f0fe;
      padding: 2px 5px;
      border-radius: 3px;
    }
    
    .currency-positive {
      font-family: 'Courier New', 'Menlo', monospace;
      font-weight: 700;
      color: #27ae60;
      background-color: #d4edda;
      padding: 2px 5px;
      border-radius: 3px;
    }
    
    .currency-negative {
      font-family: 'Courier New', 'Menlo', monospace;
      font-weight: 700;
      color: #e74c3c;
      background-color: #f8d7da;
      padding: 2px 5px;
      border-radius: 3px;
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
    
    .highlight-number {
      color: #2c3e50;
      font-weight: 600;
      font-family: 'Courier New', 'Menlo', monospace;
      background-color: #f8f9fa;
      padding: 1px 4px;
      border-radius: 3px;
    }
    
    .highlight-number-positive {
      color: #27ae60;
      font-weight: 600;
      font-family: 'Courier New', 'Menlo', monospace;
      background-color: #d4edda;
      padding: 1px 4px;
      border-radius: 3px;
    }
    
    .highlight-number-negative {
      color: #e74c3c;
      font-weight: 600;
      font-family: 'Courier New', 'Menlo', monospace;
      background-color: #f8d7da;
      padding: 1px 4px;
      border-radius: 3px;
    }
    
    .summary-section {
      background-color: #f0f7ff;
      border-left: 4px solid #3498db;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    .summary-section .summary-title {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 10px;
    }
    
    .summary-section ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    
    .summary-section li {
      margin: 8px 0;
    }
    
    .summary-section p {
      margin: 8px 0;
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
      .currency-positive,
      .currency-negative,
      .percentage,
      .percentage-negative,
      .highlight-number,
      .highlight-number-positive,
      .highlight-number-negative {
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
      
      .conclusion-box,
      .summary-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
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

// 处理输入数据
const results = [];

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 提取AI输出内容
  let markdownContent = '';
  
  if (item.output) {
    if (typeof item.output === 'object' && item.output !== null) {
      if (item.output.markdown) {
        markdownContent = String(item.output.markdown);
      } else {
        markdownContent = JSON.stringify(item.output, null, 2);
      }
    } else if (typeof item.output === 'string') {
      markdownContent = item.output;
    } else {
      markdownContent = String(item.output);
    }
  } else if (item.markdown) {
    markdownContent = String(item.markdown);
  } else if (item.content) {
    if (typeof item.content === 'object' && item.content !== null) {
      if (item.content.markdown) {
        markdownContent = String(item.content.markdown);
      } else {
        markdownContent = JSON.stringify(item.content, null, 2);
      }
    } else if (typeof item.content === 'string') {
      markdownContent = item.content;
    } else {
      markdownContent = String(item.content);
    }
  } else if (item.text) {
    if (typeof item.text === 'object' && item.text !== null) {
      if (item.text.markdown) {
        markdownContent = String(item.text.markdown);
      } else {
        markdownContent = JSON.stringify(item.text, null, 2);
      }
    } else if (typeof item.text === 'string') {
      markdownContent = item.text;
    } else {
      markdownContent = String(item.text);
    }
  } else if (typeof item === 'string') {
    markdownContent = item;
  } else {
    if (item && typeof item === 'object' && item.markdown) {
      markdownContent = String(item.markdown);
    } else {
      markdownContent = JSON.stringify(item, null, 2);
    }
  }
  
  // 确保markdownContent是字符串类型
  if (typeof markdownContent !== 'string') {
    console.warn(`⚠️ markdownContent 不是字符串类型，当前类型: ${typeof markdownContent}，尝试转换`);
    markdownContent = String(markdownContent || '');
  }
  
  console.log(`📄 处理第 ${index + 1} 项，内容长度: ${markdownContent.length} 字符`);
  
  // 生成HTML
  const html = generateHtmlReport(markdownContent);
  
  results.push({
    json: {
      html: html,
      markdown: markdownContent,
      title: extractTitle(markdownContent),
      timestamp: new Date().toISOString()
    }
  });
});

console.log(`✅ 成功生成 ${results.length} 个HTML报告`);

// 返回结果
return results;

