/* ========== 调试版本：查看所有可用的变量 ========== */

console.log('=== 可用的全局变量 ===');
console.log('typeof $input:', typeof $input);
console.log('typeof $items:', typeof $items);
console.log('typeof $binary:', typeof $binary);
console.log('typeof $json:', typeof $json);

// 尝试不同的方式获取数据
let items = [];

try {
  if (typeof $items === 'function') {
    items = $items();
    console.log('\n✅ 使用 $items() 成功');
  } else if (typeof $input !== 'undefined' && $input.all) {
    items = $input.all();
    console.log('\n✅ 使用 $input.all() 成功');
  }
} catch (e) {
  console.log('\n❌ 获取items失败:', e.message);
}

console.log('\n=== Items 信息 ===');
console.log('Items 数量:', items.length);

if (items.length > 0) {
  const item = items[0];
  console.log('\n第一个 Item 的结构:');
  console.log('- Keys:', Object.keys(item));
  
  if (item.json) {
    console.log('- JSON keys:', Object.keys(item.json));
  }
  
  if (item.binary) {
    console.log('- Binary keys:', Object.keys(item.binary));
    
    for (const key of Object.keys(item.binary)) {
      const bin = item.binary[key];
      console.log(`\n  Binary[${key}]:`);
      console.log('    - Keys:', Object.keys(bin));
      console.log('    - fileName:', bin.fileName);
      console.log('    - mimeType:', bin.mimeType);
      console.log('    - has data:', !!bin.data);
      
      if (bin.data) {
        try {
          const size = Buffer.from(bin.data, 'base64').length;
          console.log('    - size:', size, 'bytes');
        } catch (e) {
          console.log('    - size calculation error:', e.message);
        }
      }
    }
  } else {
    console.log('- ❌ 没有 binary 属性');
  }
}

// 尝试直接访问 $binary
if (typeof $binary !== 'undefined') {
  console.log('\n=== 直接访问 $binary ===');
  console.log('$binary keys:', Object.keys($binary));
}

// 返回原始数据
return items.length > 0 ? items : [{ json: { debug: '查看console输出' } }];
