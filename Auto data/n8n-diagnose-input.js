/* ========== 诊断版本：查看输入数据 ========== */

console.log('=== 开始诊断 ===');

// 检查可用的API
console.log('typeof $input:', typeof $input);
console.log('typeof $items:', typeof $items);
console.log('typeof $json:', typeof $json);
console.log('typeof $binary:', typeof $binary);

// 尝试获取数据
let items = [];

try {
  if (typeof $input !== 'undefined' && typeof $input.all === 'function') {
    items = $input.all();
    console.log('✅ $input.all() 成功, items数量:', items.length);
  } else {
    console.log('❌ $input.all() 不可用');
  }
} catch (e) {
  console.log('❌ $input.all() 报错:', e.message);
}

// 如果$input.all()失败，尝试其他方式
if (items.length === 0) {
  try {
    if (typeof $items === 'function') {
      items = $items();
      console.log('✅ $items() 成功, items数量:', items.length);
    }
  } catch (e) {
    console.log('❌ $items() 报错:', e.message);
  }
}

// 如果还是没有数据，尝试直接使用当前item
if (items.length === 0) {
  console.log('⚠️ 尝试使用当前item');
  
  const currentItem = {
    json: typeof $json !== 'undefined' ? $json : {},
    binary: typeof $binary !== 'undefined' ? $binary : {}
  };
  
  items = [currentItem];
  console.log('当前item json keys:', Object.keys(currentItem.json));
  console.log('当前item binary keys:', Object.keys(currentItem.binary));
}

// 打印第一个item的详细信息
if (items.length > 0) {
  const item = items[0];
  console.log('\n=== 第一个Item详情 ===');
  console.log('Item keys:', Object.keys(item));
  
  if (item.json) {
    console.log('JSON keys:', Object.keys(item.json));
    console.log('JSON内容:', JSON.stringify(item.json, null, 2));
  } else {
    console.log('❌ 没有json属性');
  }
  
  if (item.binary) {
    console.log('Binary keys:', Object.keys(item.binary));
    Object.keys(item.binary).forEach(key => {
      const bin = item.binary[key];
      console.log(`  ${key}:`, {
        fileName: bin.fileName,
        mimeType: bin.mimeType,
        hasData: !!bin.data
      });
    });
  } else {
    console.log('❌ 没有binary属性');
  }
}

// 返回诊断信息
return items.map((item, index) => ({
  json: {
    debug_index: index,
    debug_has_json: !!item.json,
    debug_has_binary: !!item.binary,
    debug_json_keys: item.json ? Object.keys(item.json).join(',') : 'none',
    debug_binary_keys: item.binary ? Object.keys(item.binary).join(',') : 'none',
    debug_message: '查看console日志获取详细信息',
    // 保留原有数据
    ...item.json
  },
  binary: item.binary
}));
