// n8n Code节点：AI输出验证和优化器
// 功能：验证AI Agent输出的Markdown报告是否包含必需信息，并自动补充缺失内容

const inputs = $input.all();
console.log("=== AI输出验证和优化器开始 ===");

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 提取AI输出
let aiOutput = '';
if (inputs[0] && inputs[0].json) {
  if (inputs[0].json.output) {
    aiOutput = inputs[0].json.output;
  } else if (inputs[0].json.content) {
    aiOutput = inputs[0].json.content;
  } else if (inputs[0].json.text) {
    aiOutput = inputs[0].json.text;
  } else if (typeof inputs[0].json === 'string') {
    aiOutput = inputs[0].json;
  }
}

if (!aiOutput) {
  console.error("❌ 无法提取AI输出内容");
  return inputs;
}

console.log(`📄 AI输出长度: ${aiOutput.length} 字符`);

// 验证函数
function validateAndFixOutput(markdown) {
  let fixed = markdown;
  const issues = [];
  const fixes = [];
  
  // 1. 检查是否包含标题（应该移除）
  if (markdown.match(/^#+\s*业务数据/i)) {
    issues.push('⚠️ 发现重复标题，建议移除');
    // 移除开头的标题行
    fixed = fixed.replace(/^#+\s*业务数据[^\n]*\n*/i, '');
    fixes.push('✅ 已移除重复标题');
  }
  
  // 2. 检查是否包含多余横线
  const lines = fixed.split('\n');
  let startIndex = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '***') {
      if (i === 0 || (i === 1 && lines[i-1].trim().match(/^#+\s*业务数据/i))) {
        startIndex = i + 1;
        fixes.push('✅ 已移除开头的多余横线');
      }
    }
  }
  if (startIndex > 0) {
    fixed = lines.slice(startIndex).join('\n');
  }
  
  // 3. 检查新游戏分析是否包含平台和币种排行
  const hasNewGameSection = /###\s*二[、.]\s*新游戏/i.test(fixed);
  if (hasNewGameSection) {
    const hasPlatformRanking = /主要平台/i.test(fixed) && /-\s*[^:]+：\s*\d+[,\d]*\s*\([0-9.]+%\)/i.test(fixed);
    const hasCurrencyRanking = /主要币种/i.test(fixed) && /-\s*[A-Z]{3}[^:]+：\s*\d+[,\d]*\s*\([0-9.]+%\)/i.test(fixed);
    
    if (!hasPlatformRanking) {
      issues.push('❌ 新游戏分析缺少主要平台（商户）排行');
    }
    if (!hasCurrencyRanking) {
      issues.push('❌ 新游戏分析缺少主要币种排行');
    }
    
    if (hasPlatformRanking && hasCurrencyRanking) {
      fixes.push('✅ 新游戏分析包含平台和币种排行');
    }
  }
  
  // 4. 检查表格格式
  const tableMatches = fixed.match(/\|.+\|/g);
  if (tableMatches && tableMatches.length > 0) {
    let hasTableIssues = false;
    // 检查表格是否有分隔行
    const hasSeparator = fixed.match(/\|[\s:|-]+\|/);
    if (!hasSeparator && tableMatches.length > 1) {
      issues.push('⚠️ 表格可能缺少表头分隔行');
      hasTableIssues = true;
    }
    
    if (!hasTableIssues) {
      fixes.push('✅ 表格格式正确');
    }
  }
  
  // 5. 检查周期信息
  const hasPeriodInfo = /\d{4}-\d{2}-\d{2}\s*[至到]\s*\d{4}-\d{2}-\d{2}/.test(fixed) ||
                        /\d{8}\s*[-至]\s*\d{8}/.test(fixed);
  if (!hasPeriodInfo) {
    issues.push('⚠️ 缺少明确的报告周期信息');
  } else {
    fixes.push('✅ 包含报告周期信息');
  }
  
  // 6. 检查必需章节
  const requiredSections = [
    { pattern: /###\s*[一二三四五六七八九十][、.]\s*总体/i, name: '总体运营概览' },
    { pattern: /###\s*[三四五六七八九十][、.]\s*商户/i, name: '商户表现分析' },
    { pattern: /###\s*[四五六七八九十][、.]\s*游戏/i, name: '游戏表现分析' },
    { pattern: /###\s*[五六七八九十][、.]\s*投注/i, name: '投注量分析' },
    { pattern: /###\s*[七八九十][、.]\s*币种/i, name: '币种表现分析' },
    { pattern: /###\s*[八九十][、.]\s*留存/i, name: '留存数据分析' }
  ];
  
  requiredSections.forEach(section => {
    if (section.pattern.test(fixed)) {
      fixes.push(`✅ 包含${section.name}章节`);
    } else {
      issues.push(`⚠️ 缺少${section.name}章节`);
    }
  });
  
  return {
    original: markdown,
    fixed: fixed,
    issues: issues,
    fixes: fixes
  };
}

// 执行验证和修复
const result = validateAndFixOutput(aiOutput);

console.log('\n📊 验证结果：');
if (result.fixes.length > 0) {
  console.log('\n✅ 通过检查：');
  result.fixes.forEach(fix => console.log(`   ${fix}`));
}

if (result.issues.length > 0) {
  console.log('\n⚠️ 发现问题：');
  result.issues.forEach(issue => console.log(`   ${issue}`));
} else {
  console.log('\n✅ 所有检查通过！');
}

// 输出修复后的内容
const output = {
  json: {
    output: result.fixed,
    original: result.original,
    validation: {
      issues: result.issues,
      fixes: result.fixes,
      isValid: result.issues.length === 0
    }
  }
};

console.log(`\n📝 输出长度: ${result.fixed.length} 字符`);
console.log(`📝 修复项数: ${result.fixes.length}`);

return [output];

