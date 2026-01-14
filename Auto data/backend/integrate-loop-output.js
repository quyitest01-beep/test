// n8n Code节点：整合并输出 Loop Over Items 的所有输出数据
// 功能：收集所有输入项，整合后输出，方便查看数据结构

const inputs = $input.all();

if (!inputs || inputs.length === 0) {
  return [{
    json: {
      error: '未收到任何输入数据',
      inputCount: 0
    }
  }];
}

console.log(`📥 收到 ${inputs.length} 个输入项`);

// 收集所有输入项的数据
const allItems = [];
const summary = {
  totalItems: inputs.length,
  itemsWithData: 0,
  itemsWithoutData: 0,
  allKeys: new Set(),
  dataTypes: {},
  arrayFields: [],
  possibleSheetsArrays: []
};

inputs.forEach((wrapper, index) => {
  // 检查 wrapper 的所有字段，不仅仅是 json
  const wrapperKeys = wrapper ? Object.keys(wrapper) : [];
  const item = wrapper?.json;
  const binary = wrapper?.binary;
  const data = wrapper?.data;
  
  console.log(`\n📦 输入项 [${index}]:`);
  console.log(`  - wrapper 的键:`, wrapperKeys);
  console.log(`  - 是否有 json:`, !!item);
  console.log(`  - 是否有 binary:`, !!binary);
  console.log(`  - 是否有 data:`, !!data);
  
  // 检查 wrapper 的所有字段
  if (wrapper) {
    Object.keys(wrapper).forEach(key => {
      const value = wrapper[key];
      console.log(`  - wrapper.${key}:`, typeof value, Array.isArray(value) ? `Array[${value.length}]` : '', 
        typeof value === 'object' && value !== null ? `keys: ${Object.keys(value).join(', ')}` : '');
    });
  }
  
  // 使用 item 或整个 wrapper 作为数据源
  const dataSource = item || wrapper || {};
  
  if (dataSource && (Object.keys(dataSource).length > 0 || item !== undefined)) {
    summary.itemsWithData++;
    
    // 收集所有键（从 dataSource）
    Object.keys(dataSource).forEach(key => summary.allKeys.add(key));
    
    // 分析数据类型
    Object.keys(dataSource).forEach(key => {
      const value = dataSource[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      if (!summary.dataTypes[key]) {
        summary.dataTypes[key] = {
          type: type,
          count: 0,
          sampleValue: null
        };
      }
      summary.dataTypes[key].count++;
      if (!summary.dataTypes[key].sampleValue && value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          summary.dataTypes[key].sampleValue = `Array[${value.length}]`;
          if (value.length > 0) {
            summary.dataTypes[key].firstElement = value[0];
          }
        } else if (typeof value === 'object') {
          summary.dataTypes[key].sampleValue = `Object with keys: ${Object.keys(value).join(', ')}`;
        } else {
          summary.dataTypes[key].sampleValue = String(value).substring(0, 100);
        }
      }
    });
    
    // 查找所有数组字段
    const findArrays = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        if (obj.length > 0) {
          const firstElement = obj[0];
          const arrayInfo = {
            path: path || 'root',
            length: obj.length,
            firstElementType: typeof firstElement,
            firstElementKeys: firstElement && typeof firstElement === 'object' ? Object.keys(firstElement) : null,
            firstElementSample: firstElement && typeof firstElement === 'object' ? 
              JSON.stringify(firstElement).substring(0, 200) : 
              String(firstElement).substring(0, 100)
          };
          
          // 检查是否可能是 sheets 数组
          if (firstElement && typeof firstElement === 'object') {
            const hasSheetId = !!(firstElement.sheetId || firstElement.sheet_id);
            const hasTitle = !!(firstElement.title || firstElement.sheet_title);
            if (hasSheetId || hasTitle) {
              arrayInfo.looksLikeSheets = true;
              arrayInfo.hasSheetId = hasSheetId;
              arrayInfo.hasTitle = hasTitle;
              summary.possibleSheetsArrays.push({
                itemIndex: index,
                ...arrayInfo
              });
            }
          }
          
          summary.arrayFields.push({
            itemIndex: index,
            ...arrayInfo
          });
        }
        return;
      }
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newPath = path ? `${path}.${key}` : key;
          findArrays(obj[key], newPath);
        }
      }
    };
    
    findArrays(dataSource);
    
    // 保存完整的输入项（包括 wrapper 的所有信息）
    allItems.push({
      index: index,
      json: item,
      binary: binary,
      data: data,
      wrapper: wrapper,
      dataSource: dataSource
    });
  } else {
    summary.itemsWithoutData++;
    allItems.push({
      index: index,
      json: null,
      wrapper: wrapper,
      error: '没有数据'
    });
  }
});

// 输出汇总信息
console.log('\n📊 数据汇总:');
console.log(`  - 总输入项: ${summary.totalItems}`);
console.log(`  - 有数据的项: ${summary.itemsWithData}`);
console.log(`  - 无数据的项: ${summary.itemsWithoutData}`);
console.log(`  - 所有键:`, Array.from(summary.allKeys));
console.log(`\n📋 数据类型分析:`);
Object.entries(summary.dataTypes).forEach(([key, info]) => {
  console.log(`  - ${key}: ${info.type} (出现 ${info.count} 次)`);
  if (info.sampleValue) {
    console.log(`    示例: ${info.sampleValue}`);
  }
  if (info.firstElement) {
    console.log(`    第一个元素:`, info.firstElement);
  }
});

console.log(`\n📦 数组字段 (${summary.arrayFields.length} 个):`);
summary.arrayFields.forEach((arr, idx) => {
  console.log(`  ${idx + 1}. 路径: ${arr.path}, 长度: ${arr.length}, 类型: ${arr.firstElementType}`);
  if (arr.firstElementKeys) {
    console.log(`     第一个元素的键:`, arr.firstElementKeys);
  }
  if (arr.looksLikeSheets) {
    console.log(`     ⭐ 可能是 sheets 数组! (有 sheetId: ${arr.hasSheetId}, 有 title: ${arr.hasTitle})`);
  }
});

if (summary.possibleSheetsArrays.length > 0) {
  console.log(`\n✅ 发现 ${summary.possibleSheetsArrays.length} 个可能的 sheets 数组:`);
  summary.possibleSheetsArrays.forEach((arr, idx) => {
    console.log(`  ${idx + 1}. 输入项 [${arr.itemIndex}], 路径: ${arr.path}, 长度: ${arr.length}`);
  });
} else {
  console.log(`\n⚠️ 未发现可能的 sheets 数组`);
}

// 输出整合后的数据
const output = {
  summary: {
    totalItems: summary.totalItems,
    itemsWithData: summary.itemsWithData,
    itemsWithoutData: summary.itemsWithoutData,
    allKeys: Array.from(summary.allKeys),
    dataTypes: summary.dataTypes,
    arrayFieldsCount: summary.arrayFields.length,
    possibleSheetsArraysCount: summary.possibleSheetsArrays.length
  },
  arrayFields: summary.arrayFields,
  possibleSheetsArrays: summary.possibleSheetsArrays,
  allItems: allItems.map(item => ({
    index: item.index,
    wrapperKeys: item.wrapper ? Object.keys(item.wrapper) : [],
    jsonKeys: item.json ? Object.keys(item.json) : [],
    dataSourceKeys: item.dataSource ? Object.keys(item.dataSource) : [],
    hasSheets: item.dataSource ? !!(item.dataSource.sheets || item.dataSource.data?.sheets) : false,
    hasDataSheets: item.dataSource ? !!(item.dataSource.data?.sheets) : false,
    hasDirectSheets: item.dataSource ? !!(item.dataSource.sheets) : false,
    // 只输出前几个输入项的完整数据，避免输出过大
    fullData: item.index < 3 ? item.dataSource : null,
    fullWrapper: item.index < 3 ? item.wrapper : null
  })),
  // 输出第一个输入项的完整结构（用于调试）
  firstItemFullStructure: allItems[0]?.dataSource || null,
  firstItemWrapper: allItems[0]?.wrapper || null
};

// 输出到控制台（完整结构）
console.log('\n📄 第一个输入项的完整 wrapper 结构:');
console.log(JSON.stringify(allItems[0]?.wrapper || null, null, 2));
console.log('\n📄 第一个输入项的 dataSource 结构:');
console.log(JSON.stringify(allItems[0]?.dataSource || null, null, 2));

return [{
  json: output
}];

