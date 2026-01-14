# Lark表格集成完整指南

## 🎯 **功能说明**

根据 `stat_type` 创建Lark子表并写入匹配后的商户数据，包含token处理。

## 📋 **数据流程**

```
商户匹配结果 + Lark Token → 按stat_type分组 → 创建Lark子表 → 写入数据
```

## 🔧 **n8n工作流配置**

### **1. 数据分组节点 (Code)**

**节点名称**: `创建Lark子表`

**代码**:
```javascript
// Lark表格写入器 - 包含token处理的完整版本
const inputs = $input.all();
console.log("=== Lark表格写入开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 提取token和商户数据
let larkToken = null;
const merchantData = [];

inputs.forEach((item, index) => {
  const data = item.json;
  
  // 检查是否是token数据
  if (data.tenant_access_token) {
    larkToken = data.tenant_access_token;
    console.log(`🔑 获取到Lark token: ${larkToken.substring(0, 20)}...`);
  }
  // 检查是否是商户数据
  else if (data.stat_type && data.merchant) {
    merchantData.push(data);
  }
});

if (!larkToken) {
  console.error("❌ 没有找到Lark token，无法创建表格");
  return [];
}

if (merchantData.length === 0) {
  console.error("❌ 没有找到商户数据");
  return [];
}

console.log(`📊 处理商户数据: ${merchantData.length} 条`);

// 按stat_type分组数据
const groupedData = new Map();
let totalProcessed = 0;

merchantData.forEach((data) => {
  const statType = data.stat_type;
  
  if (!groupedData.has(statType)) {
    groupedData.set(statType, []);
  }
  
  groupedData.get(statType).push(data);
  totalProcessed++;
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
    lark_token: larkToken,
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
- **Headers**:
  - `Authorization`: `Bearer {{ $json.lark_token }}`
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
- **Headers**:
  - `Authorization`: `Bearer {{ $json.lark_token }}`
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
  "lark_token": "t-g206al7tEJKWVSBJKVKHWDW3MXKUD4GEIF4375V3",
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

1. **获取App ID**: 从Lark开放平台获取应用ID
2. **配置token**: 使用 `tenant_access_token` 进行API调用
3. **设置权限**: 确保应用有读写多维表格的权限

## 📋 **工作流连接**

```
商户匹配 + Lark Token → 创建Lark子表 → 创建Lark子表API → 写入Lark数据API → 完成
```

## 🎉 **预期结果**

- 根据 `stat_type` 自动创建对应的Lark子表
- 将匹配后的商户数据写入对应的子表
- 提供详细的统计信息和匹配率
- 支持多种数据类型（商户日/月、游戏日/月）
- 包含完整的token认证

## 🔑 **Token处理**

- 自动提取 `tenant_access_token`
- 在API调用中使用Bearer认证
- 支持token过期处理

现在你可以使用这个完整的方案来创建Lark子表并写入数据了！🎉







