// n8n Code节点：从 Loop Over Items 输出中提取游戏名称
// 功能：
// 1. 从 data.valueRange.range 中提取 sheetId（如 "3vrYm4!A1:O100" -> "3vrYm4"）
// 2. 从 data.valueRange.values 中提取游戏名称（从表格数据中）
// 3. 为每个输入项输出一个结果

const inputs = $input.all();

if (!inputs || inputs.length === 0) {
  throw new Error('❌ 未收到任何输入数据');
}

console.log(`📥 收到 ${inputs.length} 个输入项`);

// 收集 token（从第一个输入项中提取）
let tenantToken = null;
let spreadsheetToken = null;

// 从 range 字符串中提取 sheetId（如 "3vrYm4!A1:O100" -> "3vrYm4"）
const extractSheetIdFromRange = (range) => {
  if (!range || typeof range !== 'string') return null;
  const match = range.match(/^([^!]+)!/);
  return match ? match[1] : null;
};

// 从表格数据中提取游戏名称
// 假设第一行是表头，第二行开始是数据
// 游戏名称可能在第二列（索引1）或需要根据表头判断
const extractGameNameFromValues = (values) => {
  if (!Array.isArray(values) || values.length < 2) {
    return null;
  }
  
  // 第一行是表头
  const headers = values[0];
  if (!Array.isArray(headers)) {
    return null;
  }
  
  // 查找"游戏名称"列的索引
  const gameNameIndex = headers.findIndex(h => 
    h && typeof h === 'string' && (
      h.includes('游戏名称') || 
      h.includes('游戏名') ||
      h.toLowerCase().includes('game name') ||
      h.toLowerCase().includes('gamename')
    )
  );
  
  // 如果找到"游戏名称"列，从第二行开始提取
  if (gameNameIndex >= 0 && values.length > 1) {
    // 从第二行开始，查找第一个非空的游戏名称
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

const results = [];

inputs.forEach((wrapper, index) => {
  const item = wrapper?.json;
  
  if (!item) {
    console.warn(`⚠️ 输入项 [${index}] 没有 json 数据`);
    return;
  }
  
  console.log(`\n📦 处理输入项 [${index}]:`);
  
  // 提取 token（从第一个输入项中提取）
  if (index === 0) {
    // 尝试从输入项中提取 token（可能在其他字段中）
    tenantToken = item.tenant_access_token || item.tenant_token || null;
    spreadsheetToken = item.spreadsheet_token || item.data?.spreadsheetToken || null;
    
    if (tenantToken) {
      console.log(`  ✅ 提取到 tenant_access_token`);
    }
    if (spreadsheetToken) {
      console.log(`  ✅ 提取到 spreadsheet_token`);
    }
  }
  
  // 提取 sheetId
  const range = item.data?.valueRange?.range;
  const sheetId = extractSheetIdFromRange(range);
  
  if (!sheetId) {
    console.warn(`  ⚠️ 无法从 range 中提取 sheetId: ${range}`);
    return;
  }
  
  console.log(`  ✅ 提取到 sheetId: ${sheetId} (从 range: ${range})`);
  
  // 提取游戏名称
  const values = item.data?.valueRange?.values;
  const gameName = extractGameNameFromValues(values);
  
  if (!gameName) {
    console.warn(`  ⚠️ 无法从表格数据中提取游戏名称`);
    // 输出表格数据的前几行用于调试
    if (values && Array.isArray(values) && values.length > 0) {
      console.log(`  📋 表格数据前3行:`, values.slice(0, 3));
    }
    return;
  }
  
  console.log(`  ✅ 提取到游戏名称: "${gameName}"`);
  
  // 构建输出结果
  const result = {
    tenant_access_token: tenantToken,
    spreadsheet_token: spreadsheetToken || item.data?.spreadsheetToken || null,
    sheetId: sheetId,
    target_game: gameName,
    sheets: [{
      sheetId: sheetId,
      title: null, // 输出中没有 title
      range: range
    }],
    // 保留原始数据中的其他字段
    code: item.code,
    msg: item.msg,
    revision: item.data?.revision,
    valueRange: {
      majorDimension: item.data?.valueRange?.majorDimension,
      range: range,
      valuesCount: values ? values.length : 0
    }
  };
  
  results.push({
    json: result
  });
});

console.log(`\n=== 处理完成 ===`);
console.log(`共处理 ${inputs.length} 个输入项，成功提取游戏名称: ${results.length} 个`);

if (results.length > 0) {
  console.log(`\n✅ 提取到的游戏列表:`);
  const gameCounts = {};
  results.forEach(result => {
    const game = result.json.target_game;
    gameCounts[game] = (gameCounts[game] || 0) + 1;
  });
  
  Object.entries(gameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([game, count], idx) => {
      console.log(`  ${idx + 1}. "${game}" - ${count} 个 sheet(s)`);
    });
}

// 输出结果
return results;

