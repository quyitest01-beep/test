# Lark表格集成指南

## 🎯 **功能说明**

根据 `stat_type` 创建Lark子表并写入匹配后的商户数据。

## 📋 **数据流程**

```
商户匹配结果 → 按stat_type分组 → 创建Lark子表 → 写入数据
```

## 🔧 **n8n工作流配置**

### **1. 数据分组节点 (Code)**

**节点名称**: `Lark表格写入器`

**代码**:
```javascript
// Lark表格写入器 - 根据stat_type创建子表并写入数据
const inputs = $input.all();
console.log("=== Lark表格写入开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 按stat_type分组数据
const groupedData = new Map();
let totalProcessed = 0;

inputs.forEach((item, index) => {
  const data = item.json;
  
  if (data.stat_type && data.merchant) {
    const statType = data.stat_type;
    
    if (!groupedData.has(statType)) {
      groupedData.set(statType, []);
    }
    
    groupedData.get(statType).push(data);
    totalProcessed++;
  }
});

console.log(`📊 处理完成，共 ${totalProcessed} 条数据`);
console.log(`📊 分组数量: ${groupedData.size}`);

// 为每个stat_type创建Lark子表
const results = [];

groupedData.forEach((dataList, statType) => {
  console.log(`📋 处理 ${statType} 数据，共 ${dataList.length} 条`);
  
  // 根据stat_type生成子表名
  const tableName = generateTableName(statType);
  console.log(`📋 生成子表名: ${tableName}`);
  
  // 准备写入Lark的数据
  const larkData = prepareLarkData(dataList, statType);
  
  // 创建Lark表格写入结果
  const result = {
    stat_type: statType,
    table_name: tableName,
    data_count: dataList.length,
    lark_data: larkData,
    lark_url: `https://d4ft1c7bo4f.sg.larksuite.com/wiki/P5xzwpnIxiwWmTkNph5louAoggf`,
    summary: {
      total_rows: dataList.length,
      matched_count: dataList.filter(d => d.isMatched).length,
      unmatched_count: dataList.filter(d => !d.isMatched).length,
      match_rate: dataList.length > 0 ? ((dataList.filter(d => d.isMatched).length / dataList.length) * 100).toFixed(1) + '%' : '0%'
    }
  };
  
  results.push({
    json: result
  });
  
  console.log(`✅ ${statType} 数据处理完成，准备写入Lark表格: ${tableName}`);
});

console.log(`=== Lark表格写入准备完成 ===`);
console.log(`📊 总共创建 ${results.length} 个子表`);

return results;

// 根据stat_type生成子表名
function generateTableName(statType) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = `${year}${month}${day}`;
  
  switch (statType) {
    case 'merchant_daily':
      return `商户日活跃用户_${timestamp}`;
    case 'merchant_monthly':
      return `商户月活跃用户_${timestamp}`;
    case 'game_daily':
      return `游戏日活跃用户_${timestamp}`;
    case 'game_monthly':
      return `游戏月活跃用户_${timestamp}`;
    default:
      return `${statType}_${timestamp}`;
  }
}

// 准备写入Lark的数据格式
function prepareLarkData(dataList, statType) {
  const headers = [
    '日期',
    '商户名称',
    '商户ID',
    '主商户名称',
    '唯一用户数',
    '数据类型',
    '匹配状态',
    '原始索引'
  ];
  
  const rows = dataList.map(data => [
    data.date_str || '',
    data.merchant || '',
    data.merchant_id || '',
    data.main_merchant_name || '',
    data.unique_users || '',
    data.dataType || '',
    data.isMatched ? '已匹配' : '未匹配',
    data.originalIndex || ''
  ]);
  
  return {
    headers: headers,
    rows: rows,
    total_rows: rows.length
  };
}
```

### **2. HTTP Request节点 - 创建Lark子表**

**节点名称**: `创建Lark子表`

**配置**:
- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/bitable/v1/apps/{{ $json.lark_app_id }}/tables`
- **Authentication**: `Lark API`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body**:
```json
{
  "table": {
    "name": "{{ $json.table_name }}",
    "default_view_name": "{{ $json.table_name }}_视图"
  }
}
```

### **3. HTTP Request节点 - 写入Lark数据**

**节点名称**: `写入Lark数据`

**配置**:
- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/bitable/v1/apps/{{ $json.lark_app_id }}/tables/{{ $json.table_id }}/records/batch_create`
- **Authentication**: `Lark API`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body**:
```json
{
  "records": [
    {
      "fields": {
        "日期": "{{ $json.lark_data.rows[0][0] }}",
        "商户名称": "{{ $json.lark_data.rows[0][1] }}",
        "商户ID": "{{ $json.lark_data.rows[0][2] }}",
        "主商户名称": "{{ $json.lark_data.rows[0][3] }}",
        "唯一用户数": "{{ $json.lark_data.rows[0][4] }}",
        "数据类型": "{{ $json.lark_data.rows[0][5] }}",
        "匹配状态": "{{ $json.lark_data.rows[0][6] }}",
        "原始索引": "{{ $json.lark_data.rows[0][7] }}"
      }
    }
  ]
}
```

## 📊 **输出数据格式**

### **分组结果**
```json
{
  "stat_type": "merchant_daily",
  "table_name": "商户日活跃用户_20251021",
  "data_count": 150,
  "lark_data": {
    "headers": ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
    "rows": [
      ["20251013", "betfiery", "1698202251", "RD1", "1525", "merchant", "已匹配", "13488"],
      ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", "13489"]
    ],
    "total_rows": 150
  },
  "lark_url": "https://d4ft1c7bo4f.sg.larksuite.com/wiki/P5xzwpnIxiwWmTkNph5louAoggf",
  "summary": {
    "total_rows": 150,
    "matched_count": 120,
    "unmatched_count": 30,
    "match_rate": "80.0%"
  }
}
```

## 🎯 **子表命名规则**

| stat_type | 子表名称 |
|-----------|----------|
| merchant_daily | 商户日活跃用户_YYYYMMDD |
| merchant_monthly | 商户月活跃用户_YYYYMMDD |
| game_daily | 游戏日活跃用户_YYYYMMDD |
| game_monthly | 游戏月活跃用户_YYYYMMDD |

## 🔧 **Lark API配置**

1. **创建Lark应用**: 在Lark开放平台创建应用
2. **获取App ID**: 从应用设置中获取App ID
3. **配置权限**: 确保应用有读写多维表格的权限
4. **设置认证**: 在n8n中配置Lark API认证信息

## 📋 **工作流连接**

```
商户匹配 → Lark表格写入器 → 创建Lark子表 → 写入Lark数据 → 完成
```

## 🎉 **预期结果**

- 根据 `stat_type` 自动创建对应的Lark子表
- 将匹配后的商户数据写入对应的子表
- 提供详细的统计信息和匹配率
- 支持多种数据类型（商户日/月、游戏日/月）

现在你可以使用这个配置来创建Lark子表并写入数据了！🎉







