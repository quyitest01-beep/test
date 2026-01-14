// n8n Code节点：从 Sheets 列表中提取游戏名称并输出
// 功能：
// 1. 接收 token + sheets列表（不再需要游戏名称输入）
// 2. 从每个 sheet 的 title 中提取游戏名称（'-' 前的部分）
// 3. 为每个 sheet 输出一个结果，包含提取的游戏名称
// 4. 输出给下游节点处理（每个 sheet 一个结果）

const inputs = $input.all();
if (!inputs?.length) {
  throw new Error('❌ 未收到任何输入数据');
}

// 从 sheet title 中提取游戏名称：取 title 中 '-' 前的部分
const extractGameFromTitle = (title) => {
  if (!title) return null;
  const base = String(title).split('-')[0];
  return base.trim();
};

// 第一步：收集所有输入数据
let tenantToken = null;
let spreadsheetToken = null;
const allSheets = [];
const gameNames = new Set(); // 用于收集所有游戏名称
const inputItems = []; // 保存所有输入项，用于后续处理

console.log(`📥 开始处理 ${inputs.length} 个输入项`);
console.log(`输入项详情:`);
inputs.forEach((wrapper, idx) => {
  const item = wrapper?.json;
  if (item) {
    const hasSheets = !!(item.data?.sheets || item.sheets);
    const hasToken = !!(item.tenant_access_token || item.tenant_token);
    const hasSpreadsheetToken = !!(item.spreadsheet_token || item.data?.spreadsheetToken);
    
    console.log(`  [${idx}] - 有sheets: ${hasSheets}, 有token: ${hasToken}, 有spreadsheetToken: ${hasSpreadsheetToken}`);
    
    // 如果是sheets数据，显示sheets数量
    if (hasSheets) {
      const sheetsCount = (item.data?.sheets || item.sheets || []).length;
      console.log(`      → 包含 ${sheetsCount} 个sheets`);
    }
  } else {
    console.log(`  [${idx}] - 无数据`);
  }
});

inputs.forEach((wrapper, index) => {
  const item = wrapper?.json;
  if (!item) {
    console.warn(`⚠️ 输入项 [${index}] 没有 json 数据`);
    return;
  }

  console.log(`\n📦 处理输入项 [${index}]:`);
  console.log(`  - 是否有 data.sheets: ${!!item.data?.sheets}`);
  console.log(`  - data.sheets 类型: ${Array.isArray(item.data?.sheets) ? 'Array' : typeof item.data?.sheets}`);
  console.log(`  - data.sheets 长度: ${Array.isArray(item.data?.sheets) ? item.data.sheets.length : 'N/A'}`);
  console.log(`  - 是否有 sheets: ${!!item.sheets}`);
  console.log(`  - sheets 类型: ${Array.isArray(item.sheets) ? 'Array' : typeof item.sheets}`);
  console.log(`  - sheets 长度: ${Array.isArray(item.sheets) ? item.sheets.length : 'N/A'}`);
  console.log(`  - 是否有 data.data?.sheets: ${!!item.data?.data?.sheets}`);
  console.log(`  - data.data?.sheets 长度: ${Array.isArray(item.data?.data?.sheets) ? item.data.data.sheets.length : 'N/A'}`);
  
  // 检查所有可能包含sheets的路径
  if (item.data?.properties?.sheetCount) {
    console.log(`  - ⚠️ 发现 sheetCount: ${item.data.properties.sheetCount}，但需要找到实际的sheets数组`);
  }

  // 提取 token（优先使用 tenant_access_token）
  if (!tenantToken) {
    tenantToken = item.tenant_access_token || item.tenant_token || null;
    if (tenantToken) {
      console.log(`  ✅ 提取到 tenant_access_token`);
    }
  }

  // 提取 spreadsheet token
  if (!spreadsheetToken) {
    spreadsheetToken = item.spreadsheet_token || 
                       item.data?.spreadsheetToken || 
                       null;
    if (spreadsheetToken) {
      console.log(`  ✅ 提取到 spreadsheet_token`);
    }
  }

  // 收集所有 sheets（可能来自不同的输入项）
  let sheetsFromThisItem = 0;
  
  // 辅助函数：收集sheets数组（需要在递归搜索之前定义）
  const collectSheetsFromArray = (sheetsArray, sourceName) => {
    if (!Array.isArray(sheetsArray) || sheetsArray.length === 0) {
      return 0;
    }
    
    console.log(`  📋 从 ${sourceName} 收集 ${sheetsArray.length} 个 sheets`);
    console.log(`  📋 ${sourceName} 前3个示例:`, sheetsArray.slice(0, 3).map(s => ({
      sheetId: s.sheetId || s.sheet_id,
      title: s.title || s.sheet_title
    })));
    
    let added = 0;
    sheetsArray.forEach((sheet, sheetIdx) => {
      // 获取当前sheet的ID（优先使用sheetId，其次使用sheet_id）
      const currentSheetId = sheet.sheetId || sheet.sheet_id;
      
      // 避免重复添加相同的 sheet（只有当sheetId存在且相等时才认为是重复）
      let existingSheet = null;
      if (currentSheetId) {
        existingSheet = allSheets.find(s => {
          const existingId = s.sheetId || s.sheet_id;
          return existingId && existingId === currentSheetId;
        });
      }
      
      if (!existingSheet) {
        allSheets.push(sheet);
        added++;
        if (sheetIdx < 5) {
          console.log(`    ✅ 添加 sheet [${sheetIdx + 1}]: ${currentSheetId || 'N/A'} - "${sheet.title || sheet.sheet_title}"`);
        }
      } else {
        if (sheetIdx < 5) {
          console.log(`    ⏭️ 跳过重复 sheet [${sheetIdx + 1}]: ${currentSheetId || 'N/A'} - "${sheet.title || sheet.sheet_title}" (已存在: ${existingSheet.sheetId || existingSheet.sheet_id})`);
        }
      }
    });
    console.log(`  ✅ 从 ${sourceName} 新增 ${added} 个 sheets（共 ${allSheets.length} 个）`);
    return added;
  };
  
  // 递归搜索函数：在所有可能的路径中查找 sheets 数组
  const deepSearchForSheets = (obj, path = '', visited = new Set(), maxDepth = 10, currentDepth = 0) => {
    if (currentDepth > maxDepth || !obj || typeof obj !== 'object' || visited.has(obj)) {
      return [];
    }
    visited.add(obj);
    
    const foundSheets = [];
    
    // 如果当前对象是数组
    if (Array.isArray(obj)) {
      // 检查数组中的元素是否像 sheet 对象
      if (obj.length > 0) {
        const firstElement = obj[0];
        if (firstElement && typeof firstElement === 'object') {
          const hasSheetId = !!(firstElement.sheetId || firstElement.sheet_id);
          const hasTitle = !!(firstElement.title || firstElement.sheet_title);
          
          // 如果至少有一个元素有 sheetId 或 title，认为这可能是 sheets 数组
          if (hasSheetId || hasTitle) {
            // 检查数组中是否至少有一些元素同时有 sheetId 和 title
            const validSheets = obj.filter(s => 
              s && typeof s === 'object' && 
              (s.sheetId || s.sheet_id) && 
              (s.title || s.sheet_title)
            );
            
            if (validSheets.length > 0) {
              foundSheets.push({
                path: path || 'root',
                array: obj,
                validCount: validSheets.length,
                totalCount: obj.length
              });
            }
          }
        }
      }
      return foundSheets;
    }
    
    // 遍历对象的所有属性
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (value && typeof value === 'object') {
          const newPath = path ? `${path}.${key}` : key;
          const found = deepSearchForSheets(value, newPath, visited, maxDepth, currentDepth + 1);
          foundSheets.push(...found);
        }
      }
    }
    
    return foundSheets;
  };
  
  // 先进行深度搜索，查找所有可能的 sheets 数组
  const foundSheetsArrays = deepSearchForSheets(item);
  if (foundSheetsArrays.length > 0) {
    console.log(`  🔍 深度搜索发现 ${foundSheetsArrays.length} 个可能的 sheets 数组:`);
    foundSheetsArrays.forEach((found, idx) => {
      console.log(`    ${idx + 1}. 路径: ${found.path}, 有效 sheets: ${found.validCount}/${found.totalCount}`);
      // 尝试收集这些 sheets
      if (found.array && Array.isArray(found.array)) {
        const collected = collectSheetsFromArray(found.array, `深度搜索-${found.path}`);
        if (collected > 0) {
          sheetsFromThisItem += collected;
        }
      }
    });
  }
  
  // 检查输入项本身是否就是一个 sheet 对象（包含 sheetId 和 title）
  const hasSheetId = !!(item.sheetId || item.sheet_id);
  const hasTitle = !!(item.title || item.sheet_title);
  if (hasSheetId && hasTitle) {
    // 输入项本身就是一个 sheet 对象
    const sheetObj = {
      sheetId: item.sheetId || item.sheet_id,
      title: item.title || item.sheet_title,
      index: item.index,
      rowCount: item.rowCount,
      columnCount: item.columnCount,
      frozenRowCount: item.frozenRowCount,
      frozenColCount: item.frozenColCount,
    };
    
    // 检查是否已存在（避免重复）
    const existingSheet = allSheets.find(s => {
      const existingId = s.sheetId || s.sheet_id;
      return existingId && existingId === sheetObj.sheetId;
    });
    
    if (!existingSheet) {
      allSheets.push(sheetObj);
      sheetsFromThisItem++;
      console.log(`  ✅ 输入项 [${index}] 本身就是一个 sheet: ${sheetObj.sheetId} - "${sheetObj.title}"`);
    } else {
      console.log(`  ⏭️ 输入项 [${index}] 的 sheet 已存在: ${sheetObj.sheetId} - "${sheetObj.title}"`);
    }
  }
  
  // 检查所有可能的sheets路径
  if (item.data?.sheets && Array.isArray(item.data.sheets)) {
    collectSheetsFromArray(item.data.sheets, 'data.sheets');
  }
  
  // 兼容直接包含 sheets 数组的情况
  if (item.sheets && Array.isArray(item.sheets)) {
    collectSheetsFromArray(item.sheets, 'sheets');
  }
  
  // 检查嵌套的 data.data.sheets
  if (item.data?.data?.sheets && Array.isArray(item.data.data.sheets)) {
    collectSheetsFromArray(item.data.data.sheets, 'data.data.sheets');
  }
  
  // 检查 data.spreadsheet?.sheets
  if (item.data?.spreadsheet?.sheets && Array.isArray(item.data.spreadsheet.sheets)) {
    collectSheetsFromArray(item.data.spreadsheet.sheets, 'data.spreadsheet.sheets');
  }

  if (sheetsFromThisItem === 0) {
    // 尝试查找任何包含sheets的路径
    const possiblePaths = [
      'data.sheets',
      'sheets',
      'data.data.sheets',
      'data.spreadsheet.sheets',
      'data.properties.sheets'
    ];
    
    let foundPath = null;
    for (const path of possiblePaths) {
      const keys = path.split('.');
      let value = item;
      for (const key of keys) {
        value = value?.[key];
        if (!value) break;
      }
      if (Array.isArray(value) && value.length > 0) {
        foundPath = path;
        console.log(`  🔍 发现可能的sheets路径: ${path}，包含 ${value.length} 个元素`);
        // 检查第一个元素的结构，判断是否是 sheets 元数据
        const firstElement = value[0];
        if (firstElement && typeof firstElement === 'object') {
          console.log(`  🔍 第一个元素结构:`, Object.keys(firstElement));
          console.log(`  🔍 第一个元素示例:`, JSON.stringify(firstElement).substring(0, 200));
          
          // 如果第一个元素有 sheetId 或 title，尝试作为 sheet 处理
          if ((firstElement.sheetId || firstElement.sheet_id) && (firstElement.title || firstElement.sheet_title)) {
            console.log(`  💡 尝试将 ${path} 中的元素作为 sheets 处理`);
            collectSheetsFromArray(value, path);
            sheetsFromThisItem = allSheets.length; // 更新计数
          }
        }
        break;
      }
    }
    
    // 如果仍然没有找到 sheets，检查是否有其他可能包含 sheet 信息的字段
    if (sheetsFromThisItem === 0) {
      // 检查是否有 sheet 相关的字段（可能是单个 sheet 对象）
      const sheetFields = ['sheet', 'sheetInfo', 'currentSheet'];
      for (const field of sheetFields) {
        if (item[field] && typeof item[field] === 'object') {
          const sheetObj = item[field];
          if ((sheetObj.sheetId || sheetObj.sheet_id) && (sheetObj.title || sheetObj.sheet_title)) {
            console.log(`  💡 发现 ${field} 字段，尝试作为 sheet 处理`);
            const sheetInfo = {
              sheetId: sheetObj.sheetId || sheetObj.sheet_id,
              title: sheetObj.title || sheetObj.sheet_title,
              index: sheetObj.index,
              rowCount: sheetObj.rowCount,
              columnCount: sheetObj.columnCount,
            };
            
            const existingSheet = allSheets.find(s => {
              const existingId = s.sheetId || s.sheet_id;
              return existingId && existingId === sheetInfo.sheetId;
            });
            
            if (!existingSheet) {
              allSheets.push(sheetInfo);
              sheetsFromThisItem++;
              console.log(`  ✅ 从 ${field} 字段添加 sheet: ${sheetInfo.sheetId} - "${sheetInfo.title}"`);
            }
            break;
          }
        }
      }
    }
    
    if (sheetsFromThisItem === 0 && !foundPath) {
      console.log(`  ⏭️ 输入项 [${index}] 没有找到 sheets 数据`);
      // 输出完整的输入项结构用于调试（限制长度）
      const itemStr = JSON.stringify(item, null, 2);
      console.log(`  🔍 输入项 [${index}] 的键:`, Object.keys(item));
      if (itemStr.length > 1000) {
        console.log(`  🔍 输入项 [${index}] 的结构（前1000字符）:`, itemStr.substring(0, 1000));
      } else {
        console.log(`  🔍 输入项 [${index}] 的完整结构:`, itemStr);
      }
    }
  }

  // 保存输入项（包含 WeekStart、WeekEnd 等字段）
  inputItems.push(item);
});

// 检查是否是 Loop Over Items 的输出格式（包含 data.valueRange.range）
const hasValueRange = inputItems.some(item => item.data?.valueRange?.range);
if (hasValueRange && allSheets.length === 0) {
  console.log('\n🔍 检测到 Loop Over Items 输出格式，使用新的处理逻辑');
  
  // 从 range 中提取 sheetId 的函数
  const extractSheetIdFromRange = (range) => {
    if (!range || typeof range !== 'string') return null;
    const match = range.match(/^([^!]+)!/);
    return match ? match[1] : null;
  };
  
  // 从表格数据中提取游戏名称的函数
  const extractGameNameFromValues = (values) => {
    if (!Array.isArray(values) || values.length < 2) return null;
    const headers = values[0];
    if (!Array.isArray(headers)) return null;
    
    // 查找"游戏名称"列的索引
    const gameNameIndex = headers.findIndex(h => 
      h && typeof h === 'string' && (
        h.includes('游戏名称') || 
        h.includes('游戏名') ||
        h.toLowerCase().includes('game name') ||
        h.toLowerCase().includes('gamename')
      )
    );
    
    // 如果找到"游戏名称"列，从第二行开始提取第一个非空的游戏名称
    if (gameNameIndex >= 0 && values.length > 1) {
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (Array.isArray(row) && row[gameNameIndex]) {
          const gameName = String(row[gameNameIndex]).trim();
          if (gameName && gameName !== '') {
            return gameName;
          }
        }
      }
    }
    
    // 如果没有找到"游戏名称"列，尝试从第二列（索引1）提取
    if (values.length > 1) {
      const secondRow = values[1];
      if (Array.isArray(secondRow) && secondRow.length > 1) {
        const gameName = secondRow[1];
        if (gameName && String(gameName).trim() !== '') {
          return String(gameName).trim();
        }
      }
    }
    
    return null;
  };
  
  // 处理每个输入项
  inputItems.forEach((item, index) => {
    const range = item.data?.valueRange?.range;
    if (!range) return;
    
    const sheetId = extractSheetIdFromRange(range);
    if (!sheetId) return;
    
    const values = item.data?.valueRange?.values;
    const gameName = extractGameNameFromValues(values) || sheetId; // 如果没有游戏名称，使用 sheetId
    
    // 构建 sheet 对象
    const sheetObj = {
      sheetId: sheetId,
      title: gameName, // 使用游戏名称作为 title
      range: range
    };
    
    allSheets.push(sheetObj);
    
    // 如果提取到了游戏名称，添加到 gameNames
    if (gameName && gameName !== sheetId) {
      gameNames.add(gameName);
    }
    
    console.log(`  ✅ 从输入项 [${index}] 提取: sheetId=${sheetId}, gameName=${gameName}`);
  });
  
  console.log(`\n✅ 从 Loop Over Items 输出中提取到 ${allSheets.length} 个 sheets`);
}

// 验证必要字段
if (allSheets.length === 0) {
  console.error('\n❌ 错误：未找到任何 sheets，无法提取游戏名称');
  console.error('\n📋 调试信息：');
  console.error(`  - 输入项数量: ${inputs.length}`);
  console.error(`  - 已处理的输入项: ${inputItems.length}`);
  
  // 递归查找所有可能的数组字段（可能是 sheets 数据）
  const findArraysInObject = (obj, path = '', depth = 0, maxDepth = 5) => {
    if (depth > maxDepth) return [];
    
    const arrays = [];
    if (!obj || typeof obj !== 'object') return arrays;
    
    if (Array.isArray(obj)) {
      // 检查数组中的元素是否像 sheet 对象
      if (obj.length > 0) {
        const firstElement = obj[0];
        if (firstElement && typeof firstElement === 'object') {
          const hasSheetId = !!(firstElement.sheetId || firstElement.sheet_id);
          const hasTitle = !!(firstElement.title || firstElement.sheet_title);
          if (hasSheetId || hasTitle) {
            arrays.push({
              path: path || 'root',
              length: obj.length,
              firstElement: firstElement,
              looksLikeSheets: hasSheetId && hasTitle
            });
          }
        }
      }
      return arrays;
    }
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newPath = path ? `${path}.${key}` : key;
        const value = obj[key];
        
        if (Array.isArray(value)) {
          const found = findArraysInObject(value, newPath, depth + 1, maxDepth);
          arrays.push(...found);
        } else if (value && typeof value === 'object') {
          const found = findArraysInObject(value, newPath, depth + 1, maxDepth);
          arrays.push(...found);
        }
      }
    }
    
    return arrays;
  };
  
  // 输出所有输入项的详细信息
  inputs.forEach((wrapper, idx) => {
    const item = wrapper?.json;
    if (item) {
      console.error(`\n  ========== 输入项 [${idx}] ==========`);
      console.error(`  所有键:`, Object.keys(item));
      
      // 查找所有可能的数组字段
      const possibleArrays = findArraysInObject(item);
      if (possibleArrays.length > 0) {
        console.error(`  \n  🔍 发现 ${possibleArrays.length} 个可能的数组字段:`);
        possibleArrays.forEach((arr, arrIdx) => {
          console.error(`    ${arrIdx + 1}. 路径: ${arr.path}`);
          console.error(`       长度: ${arr.length}`);
          console.error(`       看起来像 sheets: ${arr.looksLikeSheets ? '✅' : '❌'}`);
          if (arr.firstElement) {
            console.error(`       第一个元素的键:`, Object.keys(arr.firstElement));
            console.error(`       第一个元素示例:`, JSON.stringify(arr.firstElement).substring(0, 300));
          }
        });
      }
      
      // 检查是否有 values 或 data.values（可能是表格数据）
      if (item.values || item.data?.values) {
        console.error(`  \n  ⚠️ 发现 values 字段（可能是表格数据，不是 sheets 元数据）`);
        const values = item.values || item.data?.values;
        if (Array.isArray(values) && values.length > 0) {
          console.error(`    - values 长度: ${values.length}`);
          console.error(`    - 第一个值示例:`, JSON.stringify(values[0]).substring(0, 200));
        }
      }
      
      // 检查是否有 data 字段
      if (item.data) {
        console.error(`  \n  data 字段的键:`, Object.keys(item.data));
        if (item.data.sheets) {
          console.error(`    - data.sheets 存在，类型: ${typeof item.data.sheets}, 是否为数组: ${Array.isArray(item.data.sheets)}`);
        }
      }
      
      // 输出完整的 JSON 结构（限制长度以避免过长）
      try {
        const fullJson = JSON.stringify(item, null, 2);
        if (fullJson.length > 2000) {
          console.error(`  \n  完整结构（前2000字符）:`);
          console.error(fullJson.substring(0, 2000));
          console.error(`  \n  ... (还有 ${fullJson.length - 2000} 个字符)`);
        } else {
          console.error(`  \n  完整结构:`);
          console.error(fullJson);
        }
      } catch (e) {
        console.error(`  \n  无法序列化 JSON:`, e.message);
      }
    } else {
      console.error(`\n  输入项 [${idx}] 没有 json 数据`);
    }
  });
  
  throw new Error('❌ 未找到任何 sheets，无法提取游戏名称。请检查输入数据是否包含 sheets 元数据（应包含 sheetId 和 title 字段）。如果输入是表格数据（values），需要先获取 sheets 列表。请查看上方的调试信息了解实际的数据结构。');
}

if (!tenantToken) {
  console.warn('⚠️ 未找到 tenant_access_token，可能影响后续 API 调用');
}

console.log(`\n=== 开始从 Sheets 提取游戏名称 ===`);
console.log('总 sheets 数量:', allSheets.length);

// 显示所有收集到的 sheets（用于调试）
if (allSheets.length > 0) {
  console.log('\n📋 收集到的所有 sheets:');
  allSheets.slice(0, 20).forEach((sheet, idx) => {
    const title = sheet.title || sheet.sheet_title || 'N/A';
    const sheetId = sheet.sheetId || sheet.sheet_id || 'N/A';
    const extracted = extractGameFromTitle(title);
    console.log(`  ${idx + 1}. "${title}" (sheetId: ${sheetId}) -> 提取游戏名: "${extracted || 'N/A'}"`);
  });
  if (allSheets.length > 20) {
    console.log(`  ... 还有 ${allSheets.length - 20} 个 sheets`);
  }
}

// 第二步：为每个 sheet 提取游戏名称并输出结果
const results = [];

allSheets.forEach((sheet, idx) => {
  const sheetTitle = sheet.title || sheet.sheet_title || '';
  let extractedGameName = extractGameFromTitle(sheetTitle);
  
  // 如果 extractGameFromTitle 返回 null 或空，但 title 不为空，直接使用 title
  // 这处理了从 Loop Over Items 输出中提取的情况（title 可能直接是游戏名称）
  if ((!extractedGameName || extractedGameName.trim() === '') && sheetTitle && sheetTitle.trim() !== '') {
    extractedGameName = sheetTitle.trim();
    console.log(`  💡 title 直接作为游戏名称使用: "${extractedGameName}"`);
  }
  
  console.log(`\n📄 处理 sheet [${idx + 1}]: "${sheetTitle}"`);
  console.log(`  -> 提取的游戏名称: "${extractedGameName || 'N/A'}"`);
  
  // 如果无法提取游戏名称，跳过这个 sheet
  if (!extractedGameName || extractedGameName.trim() === '') {
    console.warn(`  ⚠️ 无法从标题 "${sheetTitle}" 中提取游戏名称，跳过`);
    return;
  }
  
  // 构建单个 sheet 的信息（统一格式）
  const sheetInfo = {
    sheetId: sheet.sheetId || sheet.sheet_id || null,
    title: sheet.title || sheet.sheet_title || '',
    // 保留其他有用的字段
    index: sheet.index,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    frozenRowCount: sheet.frozenRowCount,
    frozenColCount: sheet.frozenColCount,
  };
  
  // 从输入项中查找对应的其他字段（WeekStart、WeekEnd 等）
  // 使用第一个输入项（如果有多个输入项，使用第一个）
  const matchingInput = inputItems.length > 0 ? inputItems[0] : null;
  
  // 构建输出结果（每个 sheet 一个结果）
  const result = {
    tenant_access_token: tenantToken,
    spreadsheet_token: spreadsheetToken,
    target_game: extractedGameName.trim(), // 从 sheet title 提取的游戏名称
    sheets: [sheetInfo], // 只包含当前这个 sheet
  };
  
  // 保留输入项中的其他字段（WeekStart、WeekEnd 等）
  if (matchingInput) {
    if (matchingInput.WeekStart) {
      result.WeekStart = matchingInput.WeekStart;
    }
    if (matchingInput.WeekEnd) {
      result.WeekEnd = matchingInput.WeekEnd;
    }
    // 保留其他可能的字段（排除已处理的字段）
    Object.keys(matchingInput).forEach(key => {
      if (!['game', 'target_game', 'game_name', 'data', 'tenant_access_token', 'tenant_token', 'spreadsheet_token', 'sheets'].includes(key)) {
        if (!result[key]) {
          result[key] = matchingInput[key];
        }
      }
    });
  }
  
  console.log(`  ✅ 生成结果: 游戏名称="${extractedGameName}", sheetId="${sheetInfo.sheetId}"`);
  
  results.push({
    json: result,
  });
});

console.log(`\n=== 游戏名称提取完成 ===`);
console.log(`共处理 ${allSheets.length} 个 sheets，成功提取游戏名称: ${results.length} 个`);

// 详细的统计信息
const extractedGames = new Set(results.map(r => r.json.target_game));

console.log(`\n📊 统计信息:`);
console.log(`  - 总 sheets 数量: ${allSheets.length}`);
console.log(`  - 成功提取游戏名称的 sheets: ${results.length} 个`);
console.log(`  - 提取到的唯一游戏数量: ${extractedGames.size} 个`);
console.log(`  - 无法提取游戏名称的 sheets: ${allSheets.length - results.length} 个`);

if (results.length > 0) {
  console.log(`\n✅ 提取到的游戏列表:`);
  const gameCounts = {};
  results.forEach(result => {
    const game = result.json.target_game;
    gameCounts[game] = (gameCounts[game] || 0) + 1;
  });
  
  Object.entries(gameCounts)
    .sort((a, b) => b[1] - a[1]) // 按数量排序
    .slice(0, 20)
    .forEach(([game, count], idx) => {
      console.log(`  ${idx + 1}. "${game}" - ${count} 个 sheet(s)`);
    });
  
  if (Object.keys(gameCounts).length > 20) {
    console.log(`  ... 还有 ${Object.keys(gameCounts).length - 20} 个游戏`);
  }
}

// 输出结果（每个 sheet 一个结果，包含从 sheet title 提取的游戏名称）
return results;

