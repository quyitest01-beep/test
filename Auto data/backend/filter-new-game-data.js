// n8n Code节点：根据新游戏名过滤数据
// 功能：
// 1. 从上游数据中提取新游戏名（english_name字段的值）
// 2. 过滤剩余数据，只保留游戏名=english_name的数据
// 
// 输入格式：
// - 第一个item：{ "english_name": "Aero Rush", "release_date": "2025/10" }
// - 其他items：Lark表格数据，包含values数组，游戏名在索引1位置
//
// 输出格式：保留匹配的数据行（数组格式）

const inputs = $input.all();
console.log("=== 根据新游戏名过滤数据 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 步骤1：提取新游戏名（english_name）
const newGameNames = new Set();
let dataStartIndex = 0;

// 检查第一个item是否是新游戏数据
if (inputs.length > 0 && inputs[0].json) {
  const firstItem = inputs[0].json;
  
  // 检查是否包含 english_name 字段
  if (firstItem.english_name !== undefined && firstItem.english_name !== null) {
    const englishName = String(firstItem.english_name).trim();
    if (englishName) {
      newGameNames.add(englishName.toLowerCase()); // 使用小写进行匹配
      dataStartIndex = 1; // 跳过第一个item
      console.log(`🎮 识别到新游戏: ${englishName}`);
      if (firstItem.release_date) {
        console.log(`   发布日期: ${firstItem.release_date}`);
      }
    }
  }
  
  // 检查是否是数组格式的新游戏列表
  if (Array.isArray(firstItem) && firstItem.length > 0) {
    firstItem.forEach(game => {
      if (game && game.english_name) {
        const englishName = String(game.english_name).trim();
        if (englishName) {
          newGameNames.add(englishName.toLowerCase());
        }
      }
    });
    if (newGameNames.size > 0) {
      dataStartIndex = 1;
      console.log(`🎮 识别到新游戏列表: ${newGameNames.size} 个新游戏`);
      Array.from(newGameNames).forEach(name => {
        console.log(`   - ${name}`);
      });
    }
  }
}

// 检查其他items中是否也有english_name
for (let i = 1; i < inputs.length; i++) {
  const item = inputs[i].json;
  if (item && item.english_name !== undefined && item.english_name !== null) {
    const englishName = String(item.english_name).trim();
    if (englishName) {
      newGameNames.add(englishName.toLowerCase());
      console.log(`🎮 在其他item中识别到新游戏: ${englishName}`);
    }
  }
}

console.log(`📊 总共识别到 ${newGameNames.size} 个新游戏名`);

if (newGameNames.size === 0) {
  console.warn("⚠️ 没有找到新游戏名（english_name），将返回所有数据");
}

// 步骤2：处理剩余数据，提取values数组并过滤
const filteredResults = [];
let totalRows = 0;
let matchedRows = 0;
const headersAdded = new Set();

function cleanRow(row) {
  if (!Array.isArray(row)) return [];
  return row.filter(cell => !(cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')));
}

// 从 dataStartIndex 开始处理数据
for (let index = dataStartIndex; index < inputs.length; index++) {
  const inputItem = inputs[index];
  const item = inputItem.json;
  
  if (!item) {
    continue;
  }
  
  const headerKey = `item-${index}`;

  // 提取values数组
  let valuesArray = null;
  let headerRowCandidate = null;
  
  // 情况1：Lark API格式 - item.data.valueRange.values
  if (item.data && item.data.valueRange && item.data.valueRange.values && Array.isArray(item.data.valueRange.values)) {
    valuesArray = item.data.valueRange.values;
    console.log(`📊 Item ${index}: 从 data.valueRange.values 提取，共 ${valuesArray.length} 行`);
  }
  // 情况2：简化格式 - item.values
  else if (item.values && Array.isArray(item.values)) {
    valuesArray = item.values;
    console.log(`📊 Item ${index}: 从 values 提取，共 ${valuesArray.length} 行`);
  }
  // 情况3：直接是数组
  else if (Array.isArray(item)) {
    valuesArray = item;
    console.log(`📊 Item ${index}: 直接是数组，共 ${valuesArray.length} 行`);
  }
  
  if (!valuesArray || valuesArray.length === 0) {
    console.warn(`⚠️ Item ${index}: 没有找到values数组`);
    continue;
  }
  
  // 检测表头，确定游戏名的位置
  // 表头可能包含："游戏名"、"游戏名称"、"game_name"等
  let gameNameColumnIndex = null;
  
  // 尝试检测表头（检查前几行）
  for (let i = 0; i < Math.min(3, valuesArray.length); i++) {
    const headerRow = valuesArray[i];
    if (!headerRow || !Array.isArray(headerRow)) continue;
    
    // 查找包含"游戏名"的列
    headerRow.forEach((cell, colIndex) => {
      const cellStr = String(cell || '').toLowerCase().trim();
      if (cellStr === '游戏名' || cellStr === '游戏名称' || cellStr === 'game_name' || cellStr === 'game name') {
        gameNameColumnIndex = colIndex;
        headerRowCandidate = headerRow;
        console.log(`📋 Item ${index}: 检测到游戏名列在索引 ${colIndex}`);
      }
    });
    
    if (gameNameColumnIndex !== null) {
      break; // 找到表头，退出
    }
  }
  
  if (!headerRowCandidate && valuesArray.length > 0) {
    const possibleHeader = valuesArray[0];
    if (Array.isArray(possibleHeader)) {
      const headerText = possibleHeader.map(cell => String(cell || '').toLowerCase());
      if (headerText.includes('日期') || headerText.includes('date') || headerText.includes('游戏名') || headerText.includes('game_name')) {
        headerRowCandidate = possibleHeader;
      }
    }
  }
  
  // 如果没有找到表头，尝试智能判断
  // 方法：检查多个可能的列位置（索引0和索引1）
  if (gameNameColumnIndex === null) {
    // 查找第一个非空数据行
    for (let i = 0; i < Math.min(10, valuesArray.length); i++) {
      const row = valuesArray[i];
      if (!row || !Array.isArray(row) || row.length < 2) continue;
      
      // 跳过表头行
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell === '日期' || firstCell === 'date' || firstCell === '游戏名' || firstCell === 'game_name') {
        continue; // 跳过表头
      }
      
      // 优先尝试索引1（第二列）- 常见格式：["合计"/日期, "游戏名", ...]
      const cell1 = row[1];
      if (cell1 && typeof cell1 === 'string' && cell1.trim() && 
          !cell1.match(/^\d+$/) && // 不是纯数字
          cell1 !== '合计' && cell1 !== 'Total') {
        // 检查是否看起来像游戏名（包含字母）
        if (cell1.match(/[a-zA-Z]/)) {
          gameNameColumnIndex = 1;
          console.log(`📋 Item ${index}: 推断游戏名列在索引 1（从数据行推断: "${cell1}"）`);
          break;
        }
      }
      
      // 尝试索引0（第一列）- 格式：["游戏名", "商户名", ...]
      const cell0 = row[0];
      if (cell0 && typeof cell0 === 'string' && cell0.trim() &&
          !cell0.match(/^\d+$/) && // 不是纯数字
          cell0 !== '合计' && cell0 !== 'Total' &&
          cell0 !== '日期' && cell0 !== 'Date') {
        // 检查是否看起来像游戏名（包含字母）
        if (cell0.match(/[a-zA-Z]/)) {
          // 检查索引1是否是商户名或其他标识（通常商户名也是字符串）
          const cell1 = row[1];
          if (cell1 && typeof cell1 === 'string' && cell1.trim()) {
            gameNameColumnIndex = 0;
            console.log(`📋 Item ${index}: 推断游戏名列在索引 0（从数据行推断: "${cell0}"）`);
            break;
          }
        }
      }
    }
  }
  
  // 默认使用索引1（如果无法确定）
  if (gameNameColumnIndex === null) {
    gameNameColumnIndex = 1;
    console.log(`📋 Item ${index}: 使用默认游戏名列索引 1`);
  }
  
  // 处理每一行数据
  valuesArray.forEach((row, rowIndex) => {
    // 跳过空行
    if (!row || !Array.isArray(row) || row.length < 2) {
      return;
    }
    
    // 跳过表头行
    const firstCell = String(row[0] || '').toLowerCase().trim();
    if (firstCell === '日期' || firstCell === 'date' || firstCell === '游戏名' || firstCell === 'game_name') {
      return; // 跳过表头
    }
    
    totalRows++;
    
    // 尝试多个列位置查找游戏名（索引0和索引1）
    // 这样可以同时处理两种格式：
    // 1. ["合计", "Aero Rush", ...] - 游戏名在索引1
    // 2. ["Aero Rush", "betfiery", ...] - 游戏名在索引0
    let gameName = null;
    let gameNameIndex = null;
    
    // 优先使用检测到的列位置
    if (gameNameColumnIndex !== null && row.length > gameNameColumnIndex) {
      const candidate = row[gameNameColumnIndex];
      if (candidate && typeof candidate === 'string' && candidate.trim() &&
          candidate.trim() !== '合计' && candidate.trim() !== 'Total') {
        gameName = candidate;
        gameNameIndex = gameNameColumnIndex;
      }
    }
    
    // 如果检测到的列位置没有找到游戏名，尝试其他位置
    if (!gameName) {
      // 尝试索引1
      if (row.length > 1) {
        const candidate1 = row[1];
        if (candidate1 && typeof candidate1 === 'string' && candidate1.trim() &&
            candidate1.trim() !== '合计' && candidate1.trim() !== 'Total' &&
            candidate1.trim().match(/[a-zA-Z]/)) {
          gameName = candidate1;
          gameNameIndex = 1;
        }
      }
      
      // 尝试索引0（如果索引1没有找到）
      if (!gameName && row.length > 0) {
        const candidate0 = row[0];
        if (candidate0 && typeof candidate0 === 'string' && candidate0.trim() &&
            candidate0.trim() !== '合计' && candidate0.trim() !== 'Total' &&
            candidate0.trim() !== '日期' && candidate0.trim() !== 'Date' &&
            candidate0.trim().match(/[a-zA-Z]/)) {
          gameName = candidate0;
          gameNameIndex = 0;
        }
      }
    }
    
    if (!gameName || gameName === null || gameName === undefined || gameName === '') {
      // 如果找不到游戏名，跳过
      return;
    }
    
    const gameNameStr = String(gameName).trim();
    const gameNameLower = gameNameStr.toLowerCase();
    
    // 如果设置了新游戏名，只保留匹配的数据
    if (newGameNames.size > 0) {
      if (newGameNames.has(gameNameLower)) {
        // 匹配成功，保留该行数据
        const cleanedRow = cleanRow(row);
        if (!headersAdded.has(headerKey) && headerRowCandidate) {
          const cleanedHeader = cleanRow(headerRowCandidate);
          filteredResults.push({
            json: {
              values: cleanedHeader,
              is_header: true
            }
          });
          headersAdded.add(headerKey);
        }
        filteredResults.push({
          json: {
            values: cleanedRow,
            game_name: gameNameStr,
            game_name_index: gameNameIndex
          }
        });
        matchedRows++;
        
        if (matchedRows <= 10) {
          console.log(`✅ [${matchedRows}] 匹配成功: game_name="${gameNameStr}" (列索引: ${gameNameIndex})`);
          console.log(`   数据预览: [${cleanedRow.slice(0, Math.min(5, cleanedRow.length)).join(', ')}...]`);
        }
      }
    } else {
      // 如果没有新游戏名，保留所有数据
      const cleanedRow = cleanRow(row);
      filteredResults.push({
        json: {
          values: cleanedRow,
          game_name: gameNameStr,
          game_name_index: gameNameIndex
        }
      });
      matchedRows++;
    }
  });
}

console.log(`=== 过滤完成 ===`);
console.log(`📊 统计信息:`);
console.log(`   - 新游戏名数量: ${newGameNames.size}`);
console.log(`   - 处理的总行数: ${totalRows}`);
console.log(`   - 匹配成功的行数: ${matchedRows}`);
console.log(`   - 过滤率: ${totalRows > 0 ? ((matchedRows / totalRows) * 100).toFixed(1) : 0}%`);

// 显示结果示例
if (filteredResults.length > 0) {
  console.log("\n📋 前5条匹配结果:");
  filteredResults.slice(0, 5).forEach((item, index) => {
    const row = item.json.values || [];
    const preview = row.slice(0, Math.min(5, row.length)).join(', ');
    const gameName = item.json.game_name || row[1] || row[0] || 'N/A';
    const headerFlag = item.json.is_header ? '[表头]' : '';
    console.log(`  ${index + 1}. ${headerFlag} 游戏名: "${gameName}", 数据: [${preview}...]`);
  });
} else {
  console.warn("\n⚠️ 没有匹配的数据");
  if (newGameNames.size > 0) {
    console.log("建议：");
    console.log("  1. 检查游戏名是否与 english_name 匹配");
    console.log("  2. 检查游戏名是否在数组的索引1位置");
    console.log("  3. 检查数据格式是否正确");
  }
}

return filteredResults;

