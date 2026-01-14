// n8n Code节点：将AI输出的Markdown评级报告转换为精美HTML
// 功能：解析Markdown文本，生成适合PDF生成的精美HTML报告

const input = $input.first();
const markdownText = input.json.output || input.json.content || input.json.text || '';

if (!markdownText) {
  console.error("❌ 没有找到Markdown内容");
  return [{
    json: {
      html: '<html><body><p>错误：没有找到Markdown内容</p></body></html>',
      error: 'No markdown content found'
    }
  }];
}

console.log("📝 开始处理Markdown报告...");
console.log(`内容长度: ${markdownText.length} 字符`);

// 提取游戏名称和评分（用于标题）
// 最新格式（H1）：# 🎮 {gameName} 游戏评级报告
const h1NewFormatMatch = markdownText.match(/^#\s*🎮\s*(.+?)\s*游戏评级报告/m);
// 新格式（H2）：## 🎮 {gameName}  14 日评分报告 | 平台 {platform}
const h2NewFormatMatch = markdownText.match(/##\s*🎮\s*(.+?)\s+14\s*日评分报告(?:\s*\|\s*平台\s*(.+?))?/);
// 旧格式：## {gameName} 游戏评级分析报告
const oldFormatMatch = markdownText.match(/##\s*(.+?)\s*游戏评级分析报告/);

const gameName = h1NewFormatMatch ? h1NewFormatMatch[1].trim() 
  : (h2NewFormatMatch ? h2NewFormatMatch[1].trim() 
    : (oldFormatMatch ? oldFormatMatch[1].trim() : '游戏'));
const platform = h2NewFormatMatch ? (h2NewFormatMatch[2] || '').trim() : '';

// 提取统计周期和全局评级（新格式）
let dataPeriod = '';
let globalTier = '';
let globalScore = '';
// 格式：**统计周期**：{start} - {end}（{days_range}）
const periodMatch = markdownText.match(/\*\*统计周期\*\*[：:]\s*([^\n（]+)（([^）]+)）/);
if (periodMatch) {
  dataPeriod = periodMatch[1].trim();
}
// 格式：**全局评级**：{tier} 级（{score} 分）
const globalRatingMatch = markdownText.match(/\*\*全局评级\*\*[：:]\s*([SABC])级（(\d+\.?\d*)分）/);
if (globalRatingMatch) {
  globalTier = globalRatingMatch[1].trim();
  globalScore = globalRatingMatch[2].trim();
}

// 提取评分和等级
// 优先使用全局评级信息，其次从表格或一句话结论中提取
const scoreFromTable = markdownText.match(/\|\s*\*\*综合得分\*\*\s*\|\s*—\s*\|\s*—\s*\|\s*—\s*\|\s*(\d+\.?\d*)\s*\|/) 
  || markdownText.match(/\|\s*\*\*总分\*\*\s*\|\s*—\s*\|\s*—\s*\|\s*—\s*\|\s*(\d+\.?\d*)\s*\|/);
const scoreFromText = markdownText.match(/综合评分[^0-9\n]*?(\d+)分(?:（([SABC])级）)?/);
const scoreFromOneLine = markdownText.match(/\*\*一句话\*\*[：:]\s*(?:综合\s*)?(\d+)分\s*([SABC])档/);

const score = globalScore || (scoreFromTable ? scoreFromTable[1] : (scoreFromText ? scoreFromText[1] : (scoreFromOneLine ? scoreFromOneLine[1] : '')));
const grade = globalTier || (scoreFromText ? (scoreFromText[2] || '') : (scoreFromOneLine ? scoreFromOneLine[2] : ''));

// 解析Markdown表格
function parseMarkdownTable(tableText) {
  const lines = tableText.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return null;
  
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map(cell => cell.trim()).filter(cell => cell);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  if (rows.length < 2) return null;
  
  const header = rows[0];
  const dataRows = rows.slice(1);
  
  // 检测是否是平台评分表（包含"渠道状态"或"平台名称"列）
  const isPlatformTable = header.some(cell => 
    cell.includes('渠道状态') || cell.includes('平台名称') || cell.includes('平台ID')
  );
  
  // 查找渠道状态列的索引
  let channelStatusIndex = -1;
  if (isPlatformTable) {
    channelStatusIndex = header.findIndex(cell => cell.includes('渠道状态'));
  }
  
  // 确定表格类名
  const tableClass = isPlatformTable ? 'platform-table' : 'metrics-table';
  
  let html = `<table class="${tableClass}">\n<thead>\n<tr>\n`;
  header.forEach(cell => {
    html += `<th>${processInlineFormatting(cell)}</th>\n`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';
  
  dataRows.forEach(row => {
    // 检测是否是红色渠道
    const isRedChannel = channelStatusIndex >= 0 && channelStatusIndex < row.length 
      && (row[channelStatusIndex].includes('红色') || row[channelStatusIndex].includes('🔴'));
    
    const rowClass = isRedChannel ? 'red-channel-row' : '';
    html += `<tr class="${rowClass}">\n`;
    row.forEach((cell, index) => {
      const tag = index === 0 && /^\*\*/.test(cell) ? 'th' : 'td';
      html += `<${tag}>${processInlineFormatting(cell)}</${tag}>\n`;
    });
    html += '</tr>\n';
  });
  
  html += '</tbody>\n</table>\n';
  return html;
}

// 处理Mermaid雷达图
function processMermaidRadar(mermaidText, scoreColorParam = '#3b82f6', gameNameParam = '游戏') {
  const cleaned = mermaidText.trim();
  
  // 提取Mermaid配置和数值
  const configMatch = cleaned.match(/%%\{init:\s*(\{[\s\S]*?\})\}%%/);
  const valueMatch = cleaned.match(/value:\s*\[([\d,\s.]+)\]/);
  const nameMatch = cleaned.match(/name:\s*['"](.+?)['"]/);
  
  // 解析数值
  let values = [];
  if (valueMatch) {
    values = valueMatch[1].split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
  }
  const chartGameName = nameMatch ? nameMatch[1] : gameNameParam;
  
  // 如果无法解析，显示原始代码块（但样式化）
  if (!configMatch || values.length < 5) {
    return {
      html: `<div class="mermaid-container"><pre class="mermaid-code"><code>${escapeHtml(cleaned)}</code></pre></div>`,
      needsColor: false
    };
  }
  
  // 使用SVG渲染雷达图
  const maxValue = 100;
  const centerX = 150;
  const centerY = 150;
  const radius = 100;
  const angles = [0, Math.PI * 2 / 5, Math.PI * 4 / 5, Math.PI * 6 / 5, Math.PI * 8 / 5];
  const labels = ['D1留存', 'D7留存', '规模占比', '人均GGR', '风险'];
  
  // 生成SVG雷达图
  let points = [];
  values.forEach((value, index) => {
    const angle = angles[index];
    const r = Math.max(0, Math.min((value / maxValue) * radius, radius));
    const x = centerX + r * Math.sin(angle);
    const y = centerY - r * Math.cos(angle);
    points.push({x, y});
  });
  
  // 绘制雷达图路径
  let pathData = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathData += ` L ${points[i].x} ${points[i].y}`;
  }
  pathData += ' Z';
  
  // 绘制网格线
  let gridLines = '';
  for (let i = 1; i <= 5; i++) {
    const r = (i / 5) * radius;
    gridLines += `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="1" opacity="0.5"/>`;
  }
  
  // 绘制轴线和标签
  let axes = '';
  angles.forEach((angle, index) => {
    const x = centerX + radius * Math.sin(angle);
    const y = centerY - radius * Math.cos(angle);
    axes += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="#d1d5db" stroke-width="1"/>`;
    // 标签
    const labelX = centerX + (radius + 25) * Math.sin(angle);
    const labelY = centerY - (radius + 25) * Math.cos(angle);
    axes += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="11" fill="#374151" font-weight="500">${labels[index]}</text>`;
  });
  
  // 绘制数据区域（使用传入的颜色）
  // 将颜色转换为RGBA格式以添加透明度
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const fillColor = hexToRgba(scoreColorParam, 0.2);
  const strokeColor = scoreColorParam;
  const radarPath = `<path d="${pathData}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" opacity="0.8"/>`;
  
  // 绘制数据点
  let dataPoints = '';
  points.forEach((point, index) => {
    dataPoints += `<circle cx="${point.x}" cy="${point.y}" r="5" fill="${strokeColor}" stroke="#fff" stroke-width="2"/>`;
    dataPoints += `<text x="${point.x}" y="${point.y - 12}" text-anchor="middle" font-size="11" fill="#1f2937" font-weight="600">${values[index].toFixed(1)}</text>`;
  });
  
  const svgContent = `
    <svg width="300" height="300" viewBox="0 0 300 300" class="radar-chart-svg" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      ${axes}
      ${radarPath}
      ${dataPoints}
    </svg>
  `;
  
  return {
    html: `<div class="mermaid-container"><div class="radar-chart-wrapper"><h4 class="radar-title">${chartGameName} 评分雷达图</h4>${svgContent}</div></div>`,
    needsColor: true,
    color: scoreColorParam
  };
}

// Markdown转HTML的核心函数
function markdownToHtml(markdown, scoreColorParam = '#3b82f6', gameNameParam = '游戏') {
  let lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let currentSection = '';
  let inInfoCard = false;
  let inTable = false;
  let tableLines = [];
  let inMermaid = false;
  let mermaidLines = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();
    
    // 处理代码块（```mermaid 或 ```）
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // 结束代码块
        if (codeBlockLanguage === 'mermaid' && mermaidLines.length > 0) {
          const mermaidText = mermaidLines.join('\n');
          const result = processMermaidRadar(mermaidText, scoreColorParam, gameNameParam);
          if (result && result.html) {
            html += result.html;
          }
        } else if (mermaidLines.length > 0) {
          // 普通代码块
          html += `<pre class="code-block"><code class="language-${codeBlockLanguage}">${escapeHtml(mermaidLines.join('\n'))}</code></pre>`;
        }
        mermaidLines = [];
        inCodeBlock = false;
        codeBlockLanguage = '';
      } else {
        // 开始代码块
        inCodeBlock = true;
        codeBlockLanguage = trimmed.substring(3).trim() || 'text';
        mermaidLines = [];
      }
      continue;
    }
    
    // 如果在代码块中，收集代码
    if (inCodeBlock) {
      mermaidLines.push(line);
      continue;
    }
    
    // 处理Mermaid雷达图（%%{init:格式）
    if (trimmed.includes('%%{init:') || inMermaid) {
      inMermaid = true;
      mermaidLines.push(line);
      // 检查是否包含结束标记（%%）
      if (trimmed.includes('%%') && mermaidLines.length > 0) {
        const mermaidText = mermaidLines.join('\n');
        const result = processMermaidRadar(mermaidText, scoreColorParam, gameNameParam);
        if (result && result.html) {
          html += result.html;
        }
        mermaidLines = [];
        inMermaid = false;
      }
      continue;
    }
    
    // 处理表格
    if (trimmed.startsWith('|')) {
      // 检查是否是分隔行
      if (trimmed.match(/^\|\s*[-:|\s]+\s*\|/)) {
        // 跳过分隔行，继续收集表格
        continue;
      }
      // 开始或继续表格
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
      continue;
    } else if (inTable) {
      // 表格结束
      const tableText = tableLines.join('\n');
      const tableHtml = parseMarkdownTable(tableText);
      if (tableHtml) {
        html += tableHtml;
      }
      tableLines = [];
      inTable = false;
    }
    
    // 跳过空行（但需要关闭列表和表格）
    if (!trimmed) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      continue;
    }
    
    // 处理一级标题（新格式：# 🎮 {gameName} 游戏评级报告）
    if (trimmed.startsWith('# ') && !trimmed.startsWith('##')) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      if (currentSection) {
        html += '</div>\n';
        currentSection = '';
      }
      if (inInfoCard) {
        html += '</div>\n';
        inInfoCard = false;
      }
      const title = trimmed.substring(2).trim();
      // 检测是否为新格式的游戏评级报告标题
      if (title.includes('游戏评级报告')) {
        html += `<h1 class="report-title">${processInlineFormatting(title)}</h1>\n`;
      } else {
        html += `<h1>${processInlineFormatting(title)}</h1>\n`;
      }
    }
    // 处理二级标题
    else if (trimmed.startsWith('## ')) {
      // 关闭列表和section
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      if (currentSection && (currentSection === 'red-light' || currentSection === 'green-light' || currentSection === 'ltv')) {
        html += '</div>\n';
        currentSection = '';
      }
      if (currentSection) {
        html += '</div>\n';
        currentSection = '';
      }
      const title = trimmed.substring(3).trim();
      
      // 检测基本信息部分
      if (title.includes('基本信息')) {
        inInfoCard = true;
        html += '<div class="info-card">\n';
      } else if (inInfoCard) {
        html += '</div>\n';
        inInfoCard = false;
      }
      
      // 检测新格式的标题（14日评分报告）
      if (title.includes('14') && title.includes('日评分报告')) {
        html += `<h2 class="report-header">${processInlineFormatting(title)}</h2>\n`;
      } else {
        html += `<h2>${processInlineFormatting(title)}</h2>\n`;
      }
    }
    // 处理三级标题
    else if (trimmed.startsWith('### ')) {
      // 关闭列表和section
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      if (currentSection && (currentSection === 'red-light' || currentSection === 'green-light' || currentSection === 'ltv')) {
        html += '</div>\n';
        currentSection = '';
      }
      if (currentSection) {
        // 如果当前是评分规则部分，先关闭 <small> 标签
        if (currentSection === 'rating-rules') {
          html += '</small>\n';
        }
        html += '</div>\n';
        currentSection = '';
      }
      const title = trimmed.substring(4).trim();
      
      // 检测特殊部分
      if (title.includes('优势')) {
        currentSection = 'advantage';
        html += '<div class="advantage-section">\n';
      } else if (title.includes('不足')) {
        currentSection = 'disadvantage';
        html += '<div class="disadvantage-section">\n';
      } else if (title.includes('评级依据')) {
        currentSection = 'rating-basis';
        html += '<div class="rating-basis-section">\n';
      } else if (title.includes('风险提示')) {
        currentSection = 'risk';
        html += '<div class="risk-section">\n';
      } else if (title.includes('改进建议')) {
        currentSection = 'improvement';
        html += '<div class="improvement-section">\n';
      } else if (title.includes('核心指标数据')) {
        currentSection = 'metrics';
        html += '<div class="metrics-section">\n';
      } else if (title.includes('评分规则') || title.includes('评分规则说明')) {
        currentSection = 'rating-rules';
        html += '<div class="rating-rules-section">\n';
        html += '<small>\n'; // 开始小字格式
      } else if (title.includes('详细分析') || title.includes('综合评估')) {
        currentSection = '';
      }
      
      html += `<h3>${processInlineFormatting(title)}</h3>\n`;
    }
    // 处理红灯/绿灯建议
    else if (trimmed.includes('🚨 红灯') || trimmed.includes('🟢 绿灯') || trimmed.includes('💰 30 日 LTV 预测')) {
      // 关闭之前的列表和section
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      if (currentSection && (currentSection === 'red-light' || currentSection === 'green-light' || currentSection === 'ltv')) {
        html += '</div>\n';
      }
      
      // 开启新的section
      if (trimmed.includes('🚨 红灯')) {
        html += '<div class="red-light-section">\n';
        html += `<h3>🚨 红灯</h3>\n`;
        currentSection = 'red-light';
      } else if (trimmed.includes('🟢 绿灯')) {
        html += '<div class="green-light-section">\n';
        html += `<h3>🟢 绿灯</h3>\n`;
        currentSection = 'green-light';
      } else if (trimmed.includes('💰 30 日 LTV 预测')) {
        html += '<div class="ltv-section">\n';
        html += `<h3>💰 30 日 LTV 预测</h3>\n`;
        currentSection = 'ltv';
      }
    }
    // 处理列表项
    else if (trimmed.match(/^[-*+]\s+/)) {
      // 如果在红灯/绿灯/LTV section中，确保列表在section内
      if (!inList) {
        html += '<ul class="section-list">\n';
        inList = true;
      }
      const rawContent = trimmed.replace(/^[-*+]\s+/, '').trim();
      if (inInfoCard) {
        const parts = rawContent.split(/[：:]/);
        if (parts.length >= 2) {
          const label = parts.shift().replace(/\*\*/g, '').trim();
          const valueText = parts.join('：').trim();
          const formattedValue = processInlineFormatting(valueText);
          html += `<li><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${formattedValue}</span></li>\n`;
          continue;
        }
      }
      const content = processInlineFormatting(rawContent);
      html += `<li>${content}</li>\n`;
    }
    // 处理普通段落
    else {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      // 处理一句话结论
      if (trimmed.includes('**一句话**') || trimmed.includes('**一句话**')) {
        html += `<p class="one-line-summary">${processInlineFormatting(trimmed)}</p>\n`;
      } else {
        html += `<p>${processInlineFormatting(trimmed)}</p>\n`;
      }
    }
  }
  
  // 处理剩余的表格
  if (inTable && tableLines.length > 0) {
    const tableText = tableLines.join('\n');
    const tableHtml = parseMarkdownTable(tableText);
    if (tableHtml) {
      html += tableHtml;
    }
  }
  
  // 关闭未关闭的标签
  if (inList) {
    html += '</ul>\n';
  }
  if (currentSection) {
    // 如果当前是评分规则部分，先关闭 <small> 标签
    if (currentSection === 'rating-rules') {
      html += '</small>\n';
    }
    html += '</div>\n';
  }
  if (inInfoCard) {
    html += '</div>\n';
  }
  
  return html;
}

// 处理行内格式化（粗体、评分、数值等）
function processInlineFormatting(text) {
  // HTML转义
  text = escapeHtml(text);
  
  // 处理粗体（需要在转义后处理）
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 处理评分徽章（支持新格式：XX分（X级）或旧格式：XX分）
  text = text.replace(/(综合评分[：:]?\s*)?(\d+)分(?:（([SABC])级）)?/g, (match, prefix, score, grade) => {
    const gradeClass = grade ? `score-${grade.toLowerCase()}` : `score-${score}`;
    const displayText = grade ? `${score}分（${grade}级）` : `${score}分`;
    if (prefix) {
      return `${prefix}<span class="score-badge ${gradeClass}">${displayText}</span>`;
    }
    return `<span class="score-badge ${gradeClass}">${displayText}</span>`;
  });
  
  // 处理百分比（直接替换，嵌套也不影响显示）
  text = text.replace(/(\d+\.?\d*)%/g, '<span class="highlight-number">$1%</span>');
  
  // 处理货币
  text = text.replace(/\$(\d+[,\d]*\.?\d*)/g, '<span class="highlight-currency">$$$1</span>');
  
  // 处理评级标准
  text = text.replace(/(\d+分标准)/g, '<span class="rating-standard">$1</span>');
  
  // 处理评级结果
  text = text.replace(/(远超|达到|仅达到|低于)(\d+分标准)/g, (match, action, standard) => {
    const className = action.includes('远超') ? 'rating-exceed' : 
                     action.includes('达到') && !action.includes('仅') ? 'rating-meet' : 
                     action.includes('仅达到') ? 'rating-barely' : 'rating-below';
    return `<span class="rating-result ${className}">${match}</span>`;
  });
  
  return text;
}

// HTML转义函数
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 根据评分或等级确定颜色主题
function getScoreColor(score, grade) {
  // 优先使用等级
  if (grade) {
    switch (grade.toUpperCase()) {
      case 'S': return '#10b981'; // 绿色
      case 'A': return '#3b82f6'; // 蓝色
      case 'B': return '#f59e0b'; // 橙色
      case 'C': return '#ef4444'; // 红色
    }
  }
  // 回退到分数判断
  const s = parseInt(score) || 0;
  if (s >= 80) return '#10b981'; // 绿色 (S级)
  if (s >= 65) return '#3b82f6'; // 蓝色 (A级)
  if (s >= 50) return '#f59e0b'; // 橙色 (B级)
  return '#ef4444'; // 红色 (C级)
}

const scoreColor = getScoreColor(score, grade);
const displayScore = score ? (grade ? `${score}分（${grade}级）` : `${score}分`) : 'N/A';

// 提取数据周期（用于顶部信息）- 如果没有从新格式提取到，尝试从旧格式提取
if (!dataPeriod) {
  const oldPeriodMatch = markdownText.match(/数据周期[：:]?\s*(\d{8}\s*-\s*\d{8})/);
  if (oldPeriodMatch) {
    dataPeriod = oldPeriodMatch[1].replace(/\s+/g, ' ').trim();
  }
}

// 提取推荐资源位
let recommendedSlot = '';
const resourceMatch = markdownText.match(/推荐资源位[：:]*\s*(.+)/);
if (resourceMatch) {
  recommendedSlot = resourceMatch[1].split('\n')[0].trim();
}

// 生成完整HTML（传递scoreColor和gameName参数）
const htmlContent = markdownToHtml(markdownText, scoreColor, gameName);

// 检查是否为新格式（14日评分报告或游戏评级报告）
const isNewFormat = h2NewFormatMatch !== null || h1NewFormatMatch !== null;
const reportTitle = h1NewFormatMatch 
  ? `${escapeHtml(gameName)} 游戏评级报告`
  : (h2NewFormatMatch 
    ? `${escapeHtml(gameName)} 14 日评分报告${platform ? ` | 平台 ${escapeHtml(platform)}` : ''}`
    : `${escapeHtml(gameName)} 游戏评级分析报告`);

// 顶部Hero区域
const heroSection = `
  <header class="hero">
    <div class="hero-left">
      <p class="hero-subtitle">AI智能评级报告</p>
      <h1>${reportTitle}</h1>
      ${dataPeriod ? `<p class="hero-meta">统计周期：${escapeHtml(dataPeriod)}</p>` : ''}
      ${globalTier && globalScore ? `<p class="hero-meta">全局评级：${escapeHtml(globalTier)} 级（${escapeHtml(globalScore)} 分）</p>` : ''}
      ${recommendedSlot ? `<p class="hero-meta">推荐资源位：${escapeHtml(recommendedSlot)}</p>` : ''}
    </div>
    <div class="hero-score">
      <div class="hero-score-circle" style="border-color: ${scoreColor};">
        <span>${displayScore}</span>
      </div>
      <p class="hero-score-label">综合评分</p>
    </div>
  </header>`;

// 去除原始H1/H2标题（如果是新格式），避免重复
const htmlBody = isNewFormat 
  ? htmlContent.replace(/<h1[^>]*class="report-title"[^>]*>[\s\S]*?<\/h1>/i, '')
      .replace(/<h2[^>]*>[\s\S]*?14\s*日评分报告[\s\S]*?<\/h2>/i, '')
      .replace(/<h1[^>]*>[\s\S]*?游戏评级报告[\s\S]*?<\/h1>/i, '')
  : htmlContent.replace(/<h1>[\s\S]*?<\/h1>/i, '');

// 生成完整的HTML文档
const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${gameName} 游戏评级分析报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 2cm;
      @top-center {
        content: "${gameName} 游戏评级分析报告";
        font-size: 10pt;
        color: #666;
      }
      @bottom-center {
        content: "第 " counter(page) " 页 / 共 " counter(pages) " 页";
        font-size: 10pt;
        color: #666;
      }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.65;
      color: #333;
      background: #fff;
      padding: 28px;
      max-width: 200mm;
      margin: 0 auto;
    }
    
    /* 容器 */
    .report-container {
      max-width: 820px;
      margin: 0 auto;
    }

    /* 顶部区域 */
    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: linear-gradient(120deg, #f8fafc 0%, #eef2ff 100%);
      border-radius: 14px;
      padding: 18px 24px;
      border: 1px solid #e2e8f0;
      position: relative;
      overflow: hidden;
      margin-bottom: 18px;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.08));
      opacity: 0.8;
      pointer-events: none;
    }

    .hero > * {
      position: relative;
      z-index: 1;
    }

    .hero-left {
      flex: 1;
      min-width: 0;
    }

    .hero-subtitle {
      font-size: 12px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }

    .hero h1 {
      font-size: 23px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 6px;
    }

    .hero-meta {
      font-size: 13px;
      color: #334155;
      margin: 2px 0;
    }

    .hero-score {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      min-width: 120px;
    }

    .hero-score-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid rgba(59, 130, 246, 0.35);
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      font-size: 22px;
      font-weight: 700;
      color: ${scoreColor};
      min-width: 104px;
    }

    .hero-score-circle span {
      display: block;
    }

    .hero-score-label {
      font-size: 12px;
      color: #475569;
      letter-spacing: 1px;
      font-weight: 500;
    }

    h2 {
      font-size: 22px;
      font-weight: 600;
      color: #2c3e50;
      margin: 24px 0 12px 0;
      padding: 10px 0 6px 0;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
    }
    
    h2::before {
      content: '';
      position: absolute;
      left: 0;
      bottom: -2px;
      width: 60px;
      height: 2px;
      background: ${scoreColor};
    }
    
    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #34495e;
      margin: 20px 0 12px 0;
      padding-left: 12px;
      border-left: 4px solid ${scoreColor};
    }
    
    /* 段落样式 */
    p {
      margin: 8px 0;
      text-align: justify;
      font-size: 14px;
      line-height: 1.6;
    }
    
    /* 列表样式 */
    ul {
      margin: 10px 0 10px 22px;
      padding: 0;
    }
    
    li {
      margin: 6px 0;
      padding-left: 6px;
      line-height: 1.8;
      font-size: 14px;
    }
    
    /* 评分徽章 */
    .score-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 18px;
      color: #fff;
      background: ${scoreColor};
      margin: 0 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    /* 新评级标准：S/A/B/C */
    .score-s { background: #10b981; }
    .score-a { background: #3b82f6; }
    .score-b { background: #f59e0b; }
    .score-c { background: #ef4444; }
    
    /* 兼容旧格式：分数样式 */
    .score-100 { background: #10b981; }
    .score-80 { background: #3b82f6; }
    .score-60 { background: #f59e0b; }
    .score-40 { background: #f59e0b; }
    .score-20 { background: #ef4444; }
    
    /* 高亮数字 */
    .highlight-number {
      color: #2563eb;
      font-weight: 600;
      font-size: 15px;
      padding: 2px 4px;
      background: #eff6ff;
      border-radius: 4px;
    }
    
    /* 高亮货币 */
    .highlight-currency {
      color: #059669;
      font-weight: 600;
      font-size: 15px;
      padding: 2px 4px;
      background: #ecfdf5;
      border-radius: 4px;
    }
    
    /* 评级标准 */
    .rating-standard {
      color: #7c3aed;
      font-weight: 600;
      padding: 2px 6px;
      background: #f3e8ff;
      border-radius: 4px;
    }
    
    /* 评级结果 */
    .rating-result {
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
    }
    
    .rating-exceed {
      color: #059669;
      background: #d1fae5;
    }
    
    .rating-meet {
      color: #2563eb;
      background: #dbeafe;
    }
    
    .rating-barely {
      color: #f59e0b;
      background: #fef3c7;
    }
    
    .rating-below {
      color: #ef4444;
      background: #fee2e2;
    }
    
    /* 优势和不足部分 */
    .advantage-section {
      background: rgba(16, 185, 129, 0.08);
      border-left: 3px solid #10b981;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
    }
    
    .advantage-section h3 {
      color: #059669;
      border-left-color: #10b981;
    }
    
    .disadvantage-section {
      background: rgba(248, 113, 113, 0.1);
      border-left: 3px solid #ef4444;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
    }
    
    .disadvantage-section h3 {
      color: #dc2626;
      border-left-color: #ef4444;
    }
    
    /* 评级依据部分 */
    .rating-basis-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
    }
    
    .rating-basis-section h3 {
      color: #475569;
      border-left-color: #64748b;
    }
    
    /* 风险提示部分 */
    .risk-section {
      background: rgba(245, 158, 11, 0.12);
      border-left: 3px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
    }
    
    .risk-section h3 {
      color: #d97706;
      border-left-color: #f59e0b;
    }
    
    /* 核心指标数据表格样式 */
    .metrics-section {
      background: #f9fafb;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .metrics-section h3 {
      margin-top: 0;
    }
    
    /* 改进建议部分 */
    .improvement-section {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      padding: 16px;
      margin: 16px 0;
      border-radius: 6px;
    }
    
    .improvement-section h3 {
      color: #2563eb;
      border-left-color: #3b82f6;
    }
    
    /* 基本信息卡片 */
    .info-card {
      background: #ffffff;
      color: #0f172a;
      padding: 18px 20px;
      border-radius: 12px;
      margin: 20px 0;
      box-shadow: none;
      border: 1px solid #e2e8f0;
    }
    
    .info-card h2 {
      color: #1e293b;
      border-bottom: 1px solid rgba(148, 163, 184, 0.35);
      margin-top: 0;
    }
    
    .info-card h2::before {
      background: ${scoreColor};
    }
    
    .info-card ul {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    
    .info-card li {
      padding: 10px 0;
      font-size: 14px;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
    }

    .info-card li:last-child {
      border-bottom: none;
    }
    
    .info-label {
      display: block;
      font-size: 13px;
      text-transform: none;
      letter-spacing: 0.5px;
      color: #94a3b8;
      font-weight: 500;
      margin-bottom: 0;
    }
    
    .info-value {
      display: block;
      font-size: 15px;
      color: #1f2937;
      font-weight: 600;
      line-height: 1.4;
    }

    .info-card .score-badge {
      margin: 0;
    }
    
    /* 打印样式 */
    @media print {
      body {
        padding: 0;
      }
      
      h1, h2, h3 {
        page-break-after: avoid;
      }
      
      ul, p {
        page-break-inside: avoid;
      }
      
      .advantage-section,
      .disadvantage-section,
      .rating-basis-section,
      .risk-section,
      .improvement-section {
        page-break-inside: avoid;
      }
    }
    
    /* 响应式设计 */
    @media (max-width: 768px) {
      body {
        padding: 20px;
      }
      
      h1 {
        font-size: 24px;
      }
      
      h2 {
        font-size: 20px;
      }
      
      h3 {
        font-size: 16px;
      }
    }

    .report-container h2:first-of-type {
      margin-top: 12px;
    }
    
    /* 新格式样式：表格 */
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 14px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .metrics-table thead {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    }
    
    .metrics-table th {
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      font-size: 14px;
    }
    
    .metrics-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
      font-size: 14px;
    }
    
    .metrics-table tbody tr:last-child td {
      border-bottom: none;
      font-weight: 700;
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      color: #1f2937;
      font-size: 15px;
    }
    
    .metrics-table tbody tr:last-child th {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      font-weight: 700;
      font-size: 15px;
    }
    
    .metrics-table tbody tr:not(:last-child):hover {
      background: #f9fafb;
    }
    
    .metrics-table tbody tr:not(:last-child) {
      transition: background-color 0.2s;
    }
    
    /* 平台评分表样式 */
    .platform-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 13px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .platform-table thead {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    }
    
    .platform-table th {
      padding: 12px 14px;
      text-align: left;
      font-weight: 600;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      font-size: 13px;
    }
    
    .platform-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
      font-size: 13px;
    }
    
    .platform-table tbody tr:hover {
      background: #f9fafb;
    }
    
    .platform-table .red-channel-row {
      background: rgba(239, 68, 68, 0.05);
      border-left: 3px solid #ef4444;
    }
    
    .platform-table .red-channel-row:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    
    .platform-table .red-channel-row td {
      color: #991b1b;
      font-weight: 500;
    }
    
    /* 评分规则部分样式（小字格式） */
    .rating-rules-section {
      margin: 24px 0;
      padding: 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    
    .rating-rules-section small {
      display: block;
      font-size: 11px;
      line-height: 1.6;
      color: #64748b;
    }
    
    .rating-rules-section small h3 {
      font-size: 13px;
      color: #475569;
      margin-top: 0;
      margin-bottom: 8px;
      padding-left: 0;
      border-left: none;
    }
    
    .rating-rules-section small h4 {
      font-size: 12px;
      color: #64748b;
      margin: 10px 0 6px 0;
      font-weight: 600;
    }
    
    .rating-rules-section small p {
      font-size: 11px;
      margin: 6px 0;
      color: #64748b;
    }
    
    .rating-rules-section small ul {
      margin: 6px 0 6px 20px;
      padding: 0;
    }
    
    .rating-rules-section small li {
      font-size: 11px;
      margin: 4px 0;
      color: #64748b;
    }
    
    /* 新格式样式：一句话结论 */
    .one-line-summary {
      font-size: 15px;
      line-height: 1.8;
      color: #1f2937;
      margin: 16px 0;
      padding: 12px 16px;
      background: #f0f9ff;
      border-left: 4px solid ${scoreColor};
      border-radius: 6px;
    }
    
    .one-line-summary strong {
      color: #1e40af;
      font-weight: 600;
    }
    
    /* 新格式样式：红灯建议 */
    .red-light-section {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
      border-left: 5px solid #ef4444;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);
    }
    
    .red-light-section h3 {
      color: #dc2626;
      border-left: none;
      padding-left: 0;
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .red-light-section ul {
      margin: 8px 0 0 0;
      padding-left: 24px;
      list-style: none;
    }
    
    .red-light-section li {
      margin: 10px 0;
      color: #991b1b;
      line-height: 1.7;
      padding-left: 8px;
      position: relative;
    }
    
    .red-light-section li::before {
      content: '⚠️';
      position: absolute;
      left: -24px;
    }
    
    /* 新格式样式：绿灯建议 */
    .green-light-section {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
      border-left: 5px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.1);
    }
    
    .green-light-section h3 {
      color: #059669;
      border-left: none;
      padding-left: 0;
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .green-light-section ul {
      margin: 8px 0 0 0;
      padding-left: 24px;
      list-style: none;
    }
    
    .green-light-section li {
      margin: 10px 0;
      color: #065f46;
      line-height: 1.7;
      padding-left: 8px;
      position: relative;
    }
    
    .green-light-section li::before {
      content: '✓';
      position: absolute;
      left: -24px;
      color: #10b981;
      font-weight: bold;
    }
    
    /* 新格式样式：LTV预测 */
    .ltv-section {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
      border-left: 5px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
    }
    
    .ltv-section h3 {
      color: #2563eb;
      border-left: none;
      padding-left: 0;
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ltv-section p {
      margin: 8px 0 0 0;
      color: #1e40af;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.8;
    }
    
    .section-list {
      margin: 0;
      padding-left: 24px;
    }
    
    .section-list li {
      margin: 8px 0;
      line-height: 1.7;
    }
    
    /* 新格式样式：报告标题 */
    .report-header {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      margin: 20px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid ${scoreColor};
    }
    
    /* Mermaid雷达图容器 */
    .mermaid-container {
      margin: 24px 0;
      padding: 24px;
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    
    .radar-chart-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    
    .radar-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    
    .radar-chart-svg {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
    }
    
    .radar-chart-svg text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
    }
    
    .mermaid {
      display: inline-block;
      max-width: 100%;
    }
    
    .mermaid-code {
      background: #1f2937;
      color: #f9fafb;
      padding: 16px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      overflow-x: auto;
      margin: 0;
    }
    
    .mermaid-code code {
      color: #f9fafb;
      background: transparent;
      padding: 0;
    }
    
    .code-block {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }
    
    .code-block code {
      color: #1f2937;
      background: transparent;
      padding: 0;
    }
    
    /* 打印样式优化 */
    @media print {
      .metrics-table {
        page-break-inside: avoid;
      }
      
      .red-light-section,
      .green-light-section,
      .ltv-section {
        page-break-inside: avoid;
      }
      
      .mermaid-container {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
    <body>
  <div class="report-container">
    ${heroSection}
    ${htmlBody}
  </div>
</body>
</html>`;

console.log("✅ HTML生成完成");
console.log(`HTML长度: ${fullHtml.length} 字符`);

return [{
  json: {
    html: fullHtml,
    gameName: gameName,
    score: score,
    grade: grade,
    scoreColor: scoreColor,
    displayScore: displayScore,
    timestamp: new Date().toISOString()
  }
}];

