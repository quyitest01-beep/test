// n8n Code节点：将AI Agent输出的Markdown报告转换为HTML
// 功能：处理AI分析报告，转换为格式化的HTML，用于PDF生成

const inputs = $input.all();
console.log("=== AI报告转HTML开始 ===");
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

// 工具函数：Markdown转HTML（简化版，处理常见格式）
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
  let inSummarySection = false; // 跟踪是否在小结区域内
  let skipTitle = true; // 跳过文档开头的标题和横线
  
  // 预处理：跳过开头的报告周期行和横线
  let startIndex = 0;
  
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const trimmed = lines[i].trim();
    
    // 跳过报告周期行（"报告周期: 2025-10-27 至 2025-11-02" 或 "报告周期信息: 本期 (10.27-11.02) vs 上期 (10.20-10.26)"）
    if (trimmed.match(/^报告周期[：:]/) || trimmed.match(/^报告周期信息[：:]/)) {
      // 跳过报告周期行本身
      startIndex = i + 1;
      // 如果下一行是横线，也跳过
      if (i + 1 < lines.length && (lines[i + 1].trim() === '---' || lines[i + 1].trim() === '***')) {
        startIndex = i + 2;
      }
      break;
    }
    
    // 跳过开头的标题行（# 业务数据分析报告 或类似）
    if (trimmed.match(/^#+\s*业务数据/) || trimmed.match(/^#+\s*[0-9]{8}/)) {
      startIndex = i + 1;
      // 跳过紧随其后的横线
      if (i + 1 < lines.length && (lines[i + 1].trim() === '---' || lines[i + 1].trim() === '***')) {
        startIndex = i + 2;
      }
      break;
    }
    
    // 如果遇到第一个非空且不是标题、不是报告周期、不是横线的行，停止跳过
    if (trimmed && !trimmed.startsWith('#') && trimmed !== '---' && trimmed !== '***' && !trimmed.match(/^报告周期[：:]/) && !trimmed.match(/^报告周期信息[：:]/)) {
      break;
    }
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 处理表格
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      // 表格行
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      continue;
    } else {
      // 非表格行，如果有待处理的表格，先处理表格
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
        // 如果在小结区域内且列表结束，关闭小结容器
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
      // 关闭小结容器（如果有）
      if (inUnorderedList) { 
        processedLines.push('</ul>'); 
        inUnorderedList = false; 
      }
      if (inOrderedList) { 
        processedLines.push('</ol>'); 
        inOrderedList = false; 
      }
      if (inSummarySection) {
        processedLines.push('</div>'); // 关闭小结容器
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
    
    // 处理分隔线（跳过报告周期后的分隔线）
    if (trimmed === '---' || trimmed === '***') {
      // 检查前一行是否是报告周期行
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      if (prevLine.match(/^报告周期[：:]/)) {
        // 如果是报告周期后的横线，跳过
        continue;
      }
      
      // 如果已经在处理内容了，保留分隔线
      if (processedLines.length > 0) {
        if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
        if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
        processedLines.push('<hr>');
        lastIndent = 0;
      }
      continue;
    }
    
    // 处理无序列表（* 或 -）
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
          // 如果退出小结区域的列表（indent为0），关闭小结容器
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
    
    // 处理有序列表（数字.）
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
    
    // 检查是否是小结标题（**小结**）
    const isSummaryTitle = trimmed.includes('**小结**') || (trimmed === '小结');
    
    // 如果遇到小结标题，开始小结容器
    if (isSummaryTitle) {
      // 关闭之前的列表（如果有）
      if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      // 开始小结容器
      processedLines.push('<div class="summary-section">');
      processedLines.push(`<p class="summary-title">${formatted}</p>`);
      inSummarySection = true;
      lastIndent = 0;
      continue;
    }
    
    // 检查是否是结论段落
    const isConclusion = trimmed.includes('结论：') || trimmed.includes('结论:');
    // 检查是否是新游戏总结段落
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
    
    // 跳过分隔行（如 |---|---| 或 |:---|:---|）
    if (row.match(/^[\|\s:\-]+$/)) {
      headerProcessed = true; // 分隔行后的第一行是表头
      continue;
    }
    
    // 分割单元格
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
    
    if (cells.length === 0) continue;
    
    // 判断是否是表头行（第一行或分隔行后的第一行）
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
        // 检查是否是数字、百分比或货币，应用相应样式
        let className = '';
        const trimmedCell = cell.trim();
        
        // 检查百分比（可能包含 + 或 -）
        if (trimmedCell.match(/^[+\-]?\d+\.?\d*%$/)) {
          const num = parseFloat(trimmedCell);
          className = num >= 0 ? 'percentage' : 'percentage-negative';
        } 
        // 检查货币（$ 开头，可能包含 + 或 -）
        else if (trimmedCell.match(/^[+\-]?\$[\d,]+(\.\d{2})?$/)) {
          className = 'currency';
          // 如果是负数，添加负值样式
          if (trimmedCell.startsWith('-')) {
            className = 'currency-negative';
          } else if (trimmedCell.startsWith('+')) {
            className = 'currency-positive';
          }
        }
        // 检查大数字（逗号分隔，可能包含 + 或 -）
        else if (trimmedCell.match(/^[+\-]?[\d,]+$/)) {
          className = 'highlight-number';
          // 如果是负数，添加负值样式
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
  
  // 1. 先处理货币金额（完整格式：$xxx,xxx.xx 或 $xxx，可能包含 + 或 -）
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
  
  // 2. 处理百分比（正负值，带颜色标记）
  // 匹配格式：14.63%、-2.35%、+57.50% 等
  html = html.replace(/([+-]?\d+\.?\d*%)/g, (match) => {
    // 检查是否已经在占位符中（避免重复处理）
    if (match.includes('__PLACEHOLDER_')) {
      return match;
    }
    const num = parseFloat(match);
    const placeholder = getPlaceholder();
    const className = num >= 0 ? 'percentage' : 'percentage-negative';
    placeholders.push({ placeholder, replacement: `<span class="${className}">${match}</span>` });
    return placeholder;
  });
  
  // 3. 处理大数字（逗号分隔的数字，如 84,194,578 或 125,793）
  // 注意：只处理不在HTML标签内的数字
  const originalHtml = html;
  html = html.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, function(match, p1, offset) {
    // 检查是否在占位符中
    if (match.includes('__PLACEHOLDER_')) {
      return match;
    }
    
    // 检查是否在HTML标签内
    const before = originalHtml.substring(Math.max(0, offset - 50), offset);
    const after = originalHtml.substring(offset, offset + match.length + 50);
    
    // 如果前后有HTML标签，说明在标签内，不处理
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
  
  // 处理斜体（*text*，但不影响粗体和列表）
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  
  return html;
}

// 提取报告周期信息并生成标题
function extractReportTitle(markdownContent) {
  // 提取当前周期（格式：20251027 - 20251102 或 20251027-20251102）
  let currentPeriod = '';
  let reportType = '周报'; // 默认周报
  
  // 尝试多种匹配模式
  const periodPatterns = [
    /\*\*当前周期[：:]\*\*\s*(\d{8})\s*[-至]\s*(\d{8})/,  // **当前周期：** 20251027 - 20251102
    /当前周期[（(]CP[）)]:\s*\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,  // 当前周期(CP): **20251027 - 20251102**
    /当前周期[：:]\s*(\d{8})\s*[-至]\s*(\d{8})/,  // 当前周期: 20251027 - 20251102
    /\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,  // **20251027 - 20251102**
  ];
  
  for (const pattern of periodPatterns) {
    const match = markdownContent.match(pattern);
    if (match) {
      const start = match[1];
      const end = match[2];
      // 格式化日期：20251027 -> 20251027
      currentPeriod = `${start} - ${end}`;
      break;
    }
  }
  
  // 提取报告类型（周报/月报）
  const typePatterns = [
    /报告类型[：:]\s*\*\*([周月]报)\*\*/,
    /报告类型[：:]\s*([周月]报)/,
    /([周月]报)/,
  ];
  
  for (const pattern of typePatterns) {
    const match = markdownContent.match(pattern);
    if (match) {
      reportType = match[1];
      break;
    }
  }
  
  // 生成标题
  let title = '业务数据分析报告';
  if (currentPeriod) {
    title = `${currentPeriod}${reportType}`;
  } else {
    // 如果没找到周期，尝试从标题中提取
    const titleMatch = markdownContent.match(/^#+\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/#/g, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim();
    }
  }
  
  return { title, currentPeriod, reportType };
}

// 生成完整的HTML文档
function generateHtmlReport(markdownContent) {
  const htmlContent = markdownToHtml(markdownContent);
  
  // 提取报告标题和周期信息（使用extractTitle函数，支持更多格式）
  const title = extractTitle(markdownContent);
  
  // 提取报告类型（用于显示周期信息）
  let reportType = '周度数据报告';
  const typePatterns = [
    /报告类型[：:]\s*\*\*([周月]报)\*\*/,
    /报告类型[：:]\s*([周月]报)/,
    /([周月]报)/,
  ];
  for (const pattern of typePatterns) {
    const match = markdownContent.match(pattern);
    if (match && match[1]) {
      reportType = match[1] === '月报' ? '月度数据报告' : '周度数据报告';
      break;
    }
  }
  
  // 提取当前周期（用于显示）
  let currentPeriod = '';
  let reportPeriod = '';
  let prevPeriod = '';
  
  const periodInfoMatch = markdownContent.match(/报告周期信息[：:]\s*本期\s*\((\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\)\s*vs\s*上期\s*\((\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\)/);
  if (periodInfoMatch) {
    // 提取本期
    const startMonth = parseInt(periodInfoMatch[1], 10);
    const startDay = parseInt(periodInfoMatch[2], 10);
    const endMonth = parseInt(periodInfoMatch[3], 10);
    const endDay = parseInt(periodInfoMatch[4], 10);
    const currentYear = new Date().getFullYear();
    const start = `${currentYear}${String(startMonth).padStart(2, '0')}${String(startDay).padStart(2, '0')}`;
    const end = `${currentYear}${String(endMonth).padStart(2, '0')}${String(endDay).padStart(2, '0')}`;
    currentPeriod = `${start}-${end}`;
    reportPeriod = `本期 (${periodInfoMatch[1]}.${periodInfoMatch[2]}-${periodInfoMatch[3]}.${periodInfoMatch[4]})`;
    
    // 提取上期
    prevPeriod = `上期 (${periodInfoMatch[5]}.${periodInfoMatch[6]}-${periodInfoMatch[7]}.${periodInfoMatch[8]})`;
  } else {
    // 如果没有匹配到完整格式，尝试单独匹配
    const currentPeriodMatch = markdownContent.match(/报告周期信息[：:]\s*本期\s*\((\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\)/);
    if (currentPeriodMatch) {
      const startMonth = parseInt(currentPeriodMatch[1], 10);
      const startDay = parseInt(currentPeriodMatch[2], 10);
      const endMonth = parseInt(currentPeriodMatch[3], 10);
      const endDay = parseInt(currentPeriodMatch[4], 10);
      const currentYear = new Date().getFullYear();
      const start = `${currentYear}${String(startMonth).padStart(2, '0')}${String(startDay).padStart(2, '0')}`;
      const end = `${currentYear}${String(endMonth).padStart(2, '0')}${String(endDay).padStart(2, '0')}`;
      currentPeriod = `${start}-${end}`;
      reportPeriod = `本期 (${currentPeriodMatch[1]}.${currentPeriodMatch[2]}-${currentPeriodMatch[3]}.${currentPeriodMatch[4]})`;
    }
    
    const prevPeriodMatch = markdownContent.match(/报告周期信息[：:].*?上期\s*\((\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\)/);
    if (prevPeriodMatch) {
      prevPeriod = `上期 (${prevPeriodMatch[1]}.${prevPeriodMatch[2]}-${prevPeriodMatch[3]}.${prevPeriodMatch[4]})`;
    }
  }
  
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
    
    /* 标题样式 */
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 10px 0;
      padding-bottom: 10px;
      /* 移除h1的border-bottom，只保留.report-header的border-bottom */
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
    
    /* 段落样式 */
    p {
      margin: 10px 0;
      text-align: justify;
      line-height: 1.8;
    }
    
    /* 列表样式 */
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
    
    /* 嵌套列表 */
    ul ul, ol ol, ul ol, ol ul {
      margin-top: 5px;
      margin-bottom: 5px;
    }
    
    /* 代码样式 */
    code {
      background-color: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 3px;
      padding: 2px 6px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #d14;
    }
    
    /* 强调样式 */
    strong {
      font-weight: 600;
      color: #1a1a1a;
    }
    
    em {
      font-style: italic;
      color: #555;
    }
    
    /* 分隔线 */
    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 30px 0;
    }
    
    /* 报告头部信息 */
    .report-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e0e0e0; /* 只保留一条横线 */
    }
    
    .report-period {
      font-size: 13px;
      color: #666;
      margin-top: 10px;
    }
    
    /* 结论框样式 */
    p:has(strong:contains("结论：")),
    p:has(strong:contains("结论：")) {
      background-color: #f9f9f9;
      border-left: 4px solid #3498db;
      padding: 12px 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    
    /* 表格样式（如果有） */
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
      background-color: #f5f5f5; /* 灰色背景，不是蓝色 */
      font-weight: 600;
      color: #333;
    }
    
    tr:nth-child(even) {
      background-color: #fafafa; /* 浅灰色背景，不是蓝色 */
    }
    
    /* 确保表格没有蓝色背景 */
    table {
      background-color: transparent;
    }
    
    table td, table th {
      background-color: inherit;
    }
    
    /* 只有偶数行有浅灰色背景 */
    table tr:nth-child(even) td {
      background-color: #fafafa;
    }
    
    /* 表头保持灰色 */
    table th {
      background-color: #f5f5f5;
    }
    
    /* 数字高亮 */
    .highlight-number {
      color: #2c3e50;
      font-weight: 600;
      font-family: 'Courier New', 'Menlo', monospace;
      background-color: #f8f9fa;
      padding: 1px 4px;
      border-radius: 3px;
    }
    
    /* 货币格式化 */
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
    
    /* 强调strong标签内的数字 */
    strong .currency,
    strong .percentage,
    strong .percentage-negative,
    strong .highlight-number {
      font-size: 1.05em;
    }
    
    /* 报告头部信息增强 */
    .report-header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 15px;
    }
    
    .report-period {
      font-size: 14px;
      color: #555;
      margin-top: 8px;
      line-height: 1.8;
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
    
    /* 结论框样式增强 - 通过JavaScript动态添加class */
    .conclusion-box {
      background-color: #f0f7ff;
      border-left: 4px solid #3498db;
      padding: 15px 18px;
      margin: 20px 0;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    /* 新游戏总结框样式（黄色背景） */
    .new-game-summary {
      background-color: #fff9e6;
      border: 1px solid #ffd700;
      border-left: 4px solid #ffa500;
      padding: 15px 18px;
      margin: 20px 0;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    /* 小结区域样式（高亮背景） */
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
    
    /* 百分比颜色增强 */
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
    
    /* 打印样式 */
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
      
      /* 避免分页时断开列表 */
      ul, ol {
        page-break-inside: avoid;
      }
      
      /* 避免标题孤立 */
      h1, h2, h3 {
        page-break-after: avoid;
      }
      
      /* 避免结论框被分页 */
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

// 处理输入数据
const results = [];

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 提取AI输出内容
  let markdownContent = '';
  
  // 优先检查是否是JSON格式（Structured Output Parser输出）
  // 检查顺序：output.markdown > markdown > output (string) > content > text > item本身
  
  if (item.output) {
    // 如果output字段是对象，尝试提取markdown字段
    if (typeof item.output === 'object' && item.output !== null) {
      if (item.output.markdown) {
        markdownContent = String(item.output.markdown);
      } else {
        // 如果output是对象但没有markdown字段，转换为字符串
        markdownContent = JSON.stringify(item.output, null, 2);
      }
    } else if (typeof item.output === 'string') {
      // 如果output是字符串，直接使用
      markdownContent = item.output;
    } else {
      // 其他情况，转换为字符串
      markdownContent = String(item.output);
    }
  } else if (item.markdown) {
    // 如果JSON中有markdown字段，直接使用
    markdownContent = String(item.markdown);
  } else if (item.content) {
    // 如果content字段是对象，尝试提取markdown字段
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
    // 如果text字段是对象，尝试提取markdown字段
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
    // 如果直接是字符串
    markdownContent = item;
  } else {
    // 如果是JSON对象，尝试提取markdown字段
    if (item && typeof item === 'object' && item.markdown) {
      markdownContent = String(item.markdown);
    } else {
      // 如果没有markdown字段，转换为字符串
      markdownContent = JSON.stringify(item, null, 2);
    }
  }
  
  // 确保markdownContent是字符串类型
  if (typeof markdownContent !== 'string') {
    console.warn(`⚠️ markdownContent 不是字符串类型，当前类型: ${typeof markdownContent}，尝试转换`);
    markdownContent = String(markdownContent || '');
  }
  
  console.log(`📄 处理第 ${index + 1} 项，内容长度: ${markdownContent.length} 字符`);
  console.log(`📄 markdownContent 类型: ${typeof markdownContent}，前100字符: ${markdownContent.substring(0, 100)}`);
  
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

// 辅助函数：提取标题（基于统计数据周期）
function extractTitle(markdown) {
  if (!markdown) return '业务数据统计报告';
  
  // 提取当前周期（支持：20251027 - 20251102、2025-10-27 至 2025-11-02 等）
  let currentPeriod = '';
  let reportType = '周度数据报告'; // 默认周度数据报告
  
  // 尝试多种匹配模式（按优先级排序）
  const periodPatterns = [
    // 报告周期信息: 本期 (10.27-11.02) vs 上期 (10.20-10.26)
    {
      pattern: /报告周期信息[：:]\s*本期\s*\((\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\)/,
      handler: (match) => {
        // 从匹配中提取月日信息
        const startMonth = parseInt(match[1], 10);
        const startDay = parseInt(match[2], 10);
        const endMonth = parseInt(match[3], 10);
        const endDay = parseInt(match[4], 10);
        
        // 推断年份（默认为2025，可以从当前日期推断）
        const currentYear = new Date().getFullYear();
        const year = currentYear;
        
        // 格式化为 YYYYMMDD
        const start = `${year}${String(startMonth).padStart(2, '0')}${String(startDay).padStart(2, '0')}`;
        const end = `${year}${String(endMonth).padStart(2, '0')}${String(endDay).padStart(2, '0')}`;
        
        return { start, end };
      }
    },
    // 报告周期: 2025-10-27 至 2025-11-02 (对比 2025-10-20 至 2025-10-26)
    {
      pattern: /报告周期[：:]\s*(\d{4}-\d{2}-\d{2})\s*[-至]\s*(\d{4}-\d{2}-\d{2})(?:\s*\([^)]*\))?/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 报告周期: 2025-10-27 至 2025-11-02
    {
      pattern: /报告周期[：:]\s*(\d{4}-\d{2}-\d{2})\s*[-至]\s*(\d{4}-\d{2}-\d{2})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // **当前周期：** 20251027 - 20251102
    {
      pattern: /\*\*当前周期[：:]\*\*\s*(\d{8})\s*[-至]\s*(\d{8})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 当前周期(CP): **20251027 - 20251102**
    {
      pattern: /当前周期[（(]CP[）)]:\s*\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 当前周期(CP): 20251027 - 20251102
    {
      pattern: /当前周期[（(]CP[）)][：:]\s*(\d{8})\s*[-至]\s*(\d{8})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 当前周期: 20251027 - 20251102
    {
      pattern: /当前周期[：:]\s*(\d{8})\s*[-至]\s*(\d{8})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // **20251027 - 20251102**
    {
      pattern: /\*\*(\d{8})\s*[-至]\s*(\d{8})\*\*/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 20251027 - 20251102（通用匹配）
    {
      pattern: /(\d{8})\s*[-至]\s*(\d{8})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // **当前周期：** 2025-10-27 至 2025-11-02
    {
      pattern: /\*\*当前周期[：:]\*\*\s*(\d{4}-\d{2}-\d{2})\s*[-至]\s*(\d{4}-\d{2}-\d{2})/,
      handler: (match) => {
        return { start: match[1], end: match[2] };
      }
    },
    // 2025-10-27 至 2025-11-02（通用匹配）
    {
      pattern: /(\d{4}-\d{2}-\d{2})\s*[-至]\s*(\d{4}-\d{2}-\d{2})/,
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
          
          // 验证日期格式并转换：如果日期格式是 2025-10-27，转换为 20251027
          if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
            start = start.replace(/-/g, '');
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            end = end.replace(/-/g, '');
          }
          
          if (/^\d{8}$/.test(start) && /^\d{4}$/.test(end)) {
            // 如果end只有4位，可能是 20251027-1026 格式
            const endFull = start.substring(0, 4) + end;
            currentPeriod = `${start}-${endFull}`; // 使用短横线连接，无空格
          } else if (/^\d{8}$/.test(start) && /^\d{8}$/.test(end)) {
            currentPeriod = `${start}-${end}`; // 使用短横线连接，无空格
          }
          if (currentPeriod) break;
        }
      } catch (e) {
        // 如果处理函数出错，继续尝试下一个模式
        console.warn('Period pattern handler error:', e);
        continue;
      }
    }
  }
  
  // 提取报告类型（周报/月报）并转换为标题格式
  const typePatterns = [
    /报告类型[：:]\s*\*\*([周月]报)\*\*/,
    /报告类型[：:]\s*([周月]报)/,
    /([周月]报)/,
  ];
  
  for (const pattern of typePatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const type = match[1];
      reportType = type === '月报' ? '月度数据报告' : '周度数据报告';
      break;
    }
  }
  
  // 生成标题：优先使用周期信息（格式：20251027-20251102周度数据报告）
  if (currentPeriod) {
    // 确保格式为：20251027-20251102周度数据报告（使用单个短横线，无空格）
    return `${currentPeriod}${reportType}`;
  }
  
  // 如果没找到周期，尝试从标题中提取
  const titleMatch = markdown.match(/^#+\s*(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    const title = titleMatch[1].replace(/#/g, '').replace(/\*\*/g, '').replace(/`/g, '').trim();
    // 如果标题中已经包含周期信息，直接返回
    if (title.match(/\d{8}\s*[-至]\s*\d{4,8}/) || title.match(/\d{4}-\d{2}-\d{2}\s*[-至]\s*\d{4}-\d{2}-\d{2}/)) {
      return title;
    }
    return title;
  }
  
  return '业务数据统计报告';
}

