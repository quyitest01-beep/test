# Lark数据转换为DataTable格式使用说明

## 功能说明

这个代码节点用于将Lark表格读取的数据转换为适合写入DataTable的格式。

## 输入数据格式

### Lark API响应格式
```json
{
  "code": 0,
  "data": {
    "revision": 5,
    "spreadsheetToken": "X0gywQBBPiaThMkHPvPl8oRKgCe",
    "totalCells": 15000,
    "valueRanges": [
      {
        "majorDimension": "ROWS",
        "range": "acc10c!A1:C5000",
        "revision": 5,
        "values": [
          ["id", "merchant_id", "name"],
          [1698217736002, 1698203185, "Lucky Tanks"],
          [1698217736003, 1698203185, "Need For X"],
          [1698217736004, 1698203185, "Fortune Tiger"]
        ]
      }
    ]
  }
}
```

## 输出数据格式

### DataTable写入格式
```json
[
  {
    "json": {
      "game_id": 1698217736002,
      "merchant": 1698203185,
      "game_name": "Lucky Tanks"
    }
  },
  {
    "json": {
      "game_id": 1698217736003,
      "merchant": 1698203185,
      "game_name": "Need For X"
    }
  },
  {
    "json": {
      "game_id": 1698217736004,
      "merchant": 1698203185,
      "game_name": "Fortune Tiger"
    }
  }
]
```

## 字段映射

### Lark表头 → DataTable字段
| Lark表头 | DataTable字段 | 说明 |
|----------|---------------|------|
| `id` | `game_id` | 游戏ID |
| `merchant_id` | `merchant` | 商户ID |
| `name` | `game_name` | 游戏名称 |

## 使用方法

### 1. **添加Code节点**
在你的工作流中添加一个Code节点，将 `backend/lark-to-datatable-converter.js` 的代码复制到节点中。

### 2. **连接数据流**
```
HTTP Request (读取Lark数据) → Code节点 (数据转换) → DataTable (Insert row)
```

### 3. **配置DataTable节点**
确保DataTable节点的字段配置正确：
- `game_id`: 游戏ID
- `merchant`: 商户ID  
- `game_name`: 游戏名称

## 处理逻辑

### 1. **数据解析**
- 解析Lark API响应
- 提取 `valueRanges` 中的 `values` 数据
- 识别表头和数据行

### 2. **字段映射**
- 根据表头名称映射到DataTable字段
- 支持自定义字段映射逻辑

### 3. **数据转换**
- 将每行数据转换为DataTable对象格式
- 确保数据类型正确

## 输出示例

### 转换后的数据
```json
[
  {
    "json": {
      "game_id": 1698217736002,
      "merchant": 1698203185,
      "game_name": "Lucky Tanks"
    }
  },
  {
    "json": {
      "game_id": 1698217736003,
      "merchant": 1698203185,
      "game_name": "Need For X"
    }
  },
  {
    "json": {
      "game_id": 1698217736004,
      "merchant": 1698203185,
      "game_name": "Fortune Tiger"
    }
  },
  {
    "json": {
      "game_id": 1698217736008,
      "merchant": 1698203185,
      "game_name": "Fortune Mouse"
    }
  },
  {
    "json": {
      "game_id": 1698217736010,
      "merchant": 1698203185,
      "game_name": "GP Limbo"
    }
  }
]
```

## 注意事项

1. **表头识别**：代码会自动识别第一行作为表头
2. **字段映射**：确保Lark表头与DataTable字段名称匹配
3. **数据类型**：保持原始数据类型，不做额外转换
4. **错误处理**：如果数据格式不正确，会输出错误信息

## 扩展功能

如果需要处理其他字段映射，可以修改代码中的 `switch` 语句：

```javascript
switch (header) {
  case 'id':
    dataTableRow.game_id = value;
    break;
  case 'merchant_id':
    dataTableRow.merchant = value;
    break;
  case 'name':
    dataTableRow.game_name = value;
    break;
  // 添加更多字段映射
  case 'new_field':
    dataTableRow.new_field = value;
    break;
  default:
    dataTableRow[header] = value;
    break;
}
```

现在试试这个转换代码，应该能够正确将Lark数据转换为DataTable格式了！






