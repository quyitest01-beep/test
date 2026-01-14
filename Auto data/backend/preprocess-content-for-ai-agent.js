// n8n Code节点：预处理content数据，提取JSON数据供AI Agent使用
// 功能：从content文本中提取JSON数据，并格式化输出给AI Agent

const inputs = $input.all();
console.log("=== 预处理content数据开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const results = [];

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 检查是否有content字段
  if (!item || !item.content) {
    console.warn(`⚠️ [Item ${index}] 没有content字段`);
    // 如果没有content字段，直接传递原始数据
    results.push({
      json: {
        originalData: item,
        extractedData: null,
        content: item.content || JSON.stringify(item, null, 2)
      }
    });
    return;
  }
  
  const content = item.content;
  console.log(`📄 [Item ${index}] 处理content，长度: ${content.length} 字符`);
  
  // 尝试从content中提取JSON数据
  let extractedData = null;
  let jsonString = null;
  
  // 方法1：查找"=== 完整JSON数据 ==="标识
  const jsonMarker = "=== 完整JSON数据 ===";
  const jsonMarkerIndex = content.indexOf(jsonMarker);
  
  if (jsonMarkerIndex !== -1) {
    // 找到标识，提取后面的内容
    const jsonStart = jsonMarkerIndex + jsonMarker.length;
    const jsonText = content.substring(jsonStart).trim();
    
    // 尝试找到JSON数组或对象的开始
    const arrayStart = jsonText.indexOf('[');
    const objectStart = jsonText.indexOf('{');
    
    let jsonStartIndex = -1;
    if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
      jsonStartIndex = arrayStart;
    } else if (objectStart !== -1) {
      jsonStartIndex = objectStart;
    }
    
    if (jsonStartIndex !== -1) {
      // 找到JSON开始位置，尝试提取完整的JSON
      let jsonEndIndex = jsonText.length;
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = jsonStartIndex; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) {
          continue;
        }
        
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && bracketCount === 0 && jsonText[jsonStartIndex] === '{') {
            jsonEndIndex = i + 1;
            break;
          }
        } else if (char === '[') {
          bracketCount++;
        } else if (char === ']') {
          bracketCount--;
          if (bracketCount === 0 && braceCount === 0 && jsonText[jsonStartIndex] === '[') {
            jsonEndIndex = i + 1;
            break;
          }
        }
      }
      
      jsonString = jsonText.substring(jsonStartIndex, jsonEndIndex);
      
      try {
        extractedData = JSON.parse(jsonString);
        console.log(`  ✅ 成功提取JSON数据`);
        
        // 验证数据结构
        if (Array.isArray(extractedData) && extractedData.length > 0) {
          const firstItem = extractedData[0];
          if (firstItem.periods && Array.isArray(firstItem.periods)) {
            console.log(`  📊 识别到 ${firstItem.periods.length} 个周期`);
            if (firstItem.newGameList) {
              console.log(`  🎮 识别到 ${firstItem.newGameList.length} 个新游戏`);
            }
          }
        }
      } catch (e) {
        console.warn(`  ⚠️ JSON解析失败: ${e.message}`);
        console.log(`  📝 JSON字符串前500字符: ${jsonString.substring(0, 500)}`);
      }
    }
  }
  
  // 方法2：如果方法1失败，尝试直接在整个content中查找JSON
  if (!extractedData) {
    const jsonPatterns = [
      /\[\s*\{[\s\S]*"periods"[\s\S]*\}\s*\]/,  // 匹配包含periods的JSON数组
      /\{[\s\S]*"periods"[\s\S]*\}/,  // 匹配包含periods的JSON对象
    ];
    
    for (const pattern of jsonPatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          extractedData = JSON.parse(match[0]);
          console.log(`  ✅ 通过正则表达式提取JSON数据`);
          break;
        } catch (e) {
          // 继续尝试下一个模式
        }
      }
    }
  }
  
  // 构建输出
  const output = {
    originalData: item,
    extractedData: extractedData,
    content: content,
    // 如果成功提取JSON，添加格式化后的数据说明
    dataSummary: null
  };
  
  // 如果成功提取JSON，生成数据摘要
  if (extractedData) {
    const summary = {
      hasNewGames: false,
      periodCount: 0,
      periods: []
    };
    
    if (Array.isArray(extractedData) && extractedData.length > 0) {
      const firstItem = extractedData[0];
      if (firstItem.newGameList && Array.isArray(firstItem.newGameList)) {
        summary.hasNewGames = firstItem.newGameList.length > 0;
      }
      if (firstItem.periods && Array.isArray(firstItem.periods)) {
        summary.periodCount = firstItem.periods.length;
        summary.periods = firstItem.periods.map(p => ({
          period: p.period,
          periodDisplay: p.periodDisplay,
          startDate: p.startDate,
          endDate: p.endDate,
          totalGGRUSD: p.overall ? p.overall.totalGGRUSD : null
        }));
      }
    }
    
    output.dataSummary = summary;
    console.log(`  📋 数据摘要: ${summary.periodCount} 个周期${summary.hasNewGames ? '，有新游戏' : ''}`);
  }
  
  results.push({
    json: output
  });
});

console.log(`\n✅ 预处理完成，共处理 ${results.length} 项`);

// 返回结果
return results;












