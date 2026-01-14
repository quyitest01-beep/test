# 数组格式Lark子表创建器使用说明

## 问题分析

### 原始问题
你的上游数据是数组格式：
```javascript
[
  ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489],
  ["20251013", "mexlucky", "1698203058", "RD1", "10733", "merchant", "已匹配", 13490],
  ["20251013", "mexswin", "1713329090", "RD1", "8184", "merchant", "已匹配", 13491]
]
```

### 代码期望格式
但代码期望的是对象格式：
```javascript
{
  "date_str": "20251013",
  "merchant": "aajogo", 
  "merchant_id": "1698202662",
  "main_merchant_name": "RD1",
  "unique_users": "1420",
  "dataType": "merchant",
  "isMatched": true,
  "originalIndex": 13489
}
```

## 解决方案

### 1. 数组格式识别
代码现在能够识别以下格式：
- **直接数组格式**：`[["20251013", "aajogo", ...], ...]`
- **API响应中的数组**：`{"code": 0, "data": [["20251013", "aajogo", ...], ...], "msg": "success"}`
- **对象格式**：`{"date_str": "20251013", "merchant": "aajogo", ...}`

### 2. 数据转换逻辑
```javascript
// 将数组转换为对象格式
const merchantObj = {
  date_str: row[0] || '',           // "20251013"
  merchant: row[1] || '',          // "aajogo"
  merchant_id: row[2] || '',       // "1698202662"
  main_merchant_name: row[3] || '', // "RD1"
  unique_users: row[4] || '',      // "1420"
  dataType: row[5] || '',          // "merchant"
  isMatched: row[6] === '已匹配',   // true
  originalIndex: row[7] || '',      // 13489
  stat_type: 'merchant_daily',     // 根据数据推断
  month_str: row[0] ? row[0].substring(0, 6) : '202510' // 从日期推断月份
};
```

### 3. 数组索引映射
| 索引 | 字段名 | 示例值 | 说明 |
|------|--------|--------|------|
| 0 | date_str | "20251013" | 日期字符串 |
| 1 | merchant | "aajogo" | 商户名称 |
| 2 | merchant_id | "1698202662" | 商户ID |
| 3 | main_merchant_name | "RD1" | 主商户名称 |
| 4 | unique_users | "1420" | 唯一用户数 |
| 5 | dataType | "merchant" | 数据类型 |
| 6 | isMatched | "已匹配" | 匹配状态 |
| 7 | originalIndex | 13489 | 原始索引 |

## 使用方法

### 1. 替换代码
将 `backend/array-format-lark-writer.js` 的代码复制到你的"创建Lark子表"节点中。

### 2. 数据流
```
上游数据（数组格式） → 创建Lark子表（数组格式处理） → HTTP Request（创建子表） → HTTP Request（写入数据）
```

### 3. 输出格式
```json
{
  "table_name": "202510商户活跃用户数",
  "stat_type": "merchant_daily",
  "month_str": "202510",
  "tenant_access_token": "t-xxx",
  "spreadsheet_token": "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
  "lark_data": {
    "headers": ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
    "rows": [
      ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489],
      ["20251013", "mexlucky", "1698203058", "RD1", "10733", "merchant", "已匹配", 13490]
    ],
    "total_rows": 2
  },
  "create_sheet_request": { /* API请求配置 */ },
  "write_data_request": { /* API请求配置 */ }
}
```

## 关键改进

### 1. 数组格式支持
- ✅ 识别数组格式的输入数据
- ✅ 自动将数组转换为对象格式
- ✅ 支持嵌套在API响应中的数组数据

### 2. 智能字段推断
- ✅ 从日期字符串推断月份：`"20251013"` → `"202510"`
- ✅ 从数据类型推断统计类型：`"merchant"` → `"merchant_daily"`
- ✅ 从匹配状态推断布尔值：`"已匹配"` → `true`

### 3. 错误处理
- ✅ 详细的调试日志
- ✅ 数据格式验证
- ✅ 错误信息提示

## 注意事项

1. **数组长度要求**：每个数据行必须至少包含8个元素
2. **日期格式**：日期字符串必须是 `YYYYMMDD` 格式
3. **匹配状态**：必须是 `"已匹配"` 或 `"未匹配"`
4. **数据类型**：必须是 `"merchant"` 或 `"game"`

## 调试建议

如果仍然出现问题，请检查：
1. 上游节点是否正确输出了数组格式的数据
2. 数组中的每个元素是否都包含8个字段
3. 日期格式是否正确
4. 是否有 `tenant_access_token` 数据






