# n8n Merge节点保留Binary数据的配置

## 问题

Merge节点可能会"丢失"binary数据，导致下游节点无法访问。

## Merge节点配置检查清单

### 1. Merge Mode（合并模式）

选择正确的模式：

- **Merge By Position** - 按位置合并，保留所有字段
- **Merge By Key** - 按键合并，需要配置正确
- **Multiplex** - 多路复用，会保留binary

**推荐**：使用 "Merge By Position" 或 "Multiplex"

### 2. Options（选项）

确保启用以下选项：

```
Options:
☑ Include All Fields (包含所有字段)
☑ Include Unpaired Items (包含未配对项)
```

### 3. 输入顺序

Binary数据应该从**Input 1**进入：

```
Input 1: 包含binary数据的节点（PDF生成等）
Input 2: 包含JSON数据的节点（token等）
```

## 完整配置示例

```json
{
  "parameters": {
    "mode": "mergeByPosition",
    "options": {
      "includeUnpaired": true,
      "fuzzyCompare": false
    }
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 2.1
}
```

## 验证Binary数据是否保留

在Merge节点之后添加一个**Code节点**测试：

```javascript
// 简单测试：检查binary是否存在
const items = $input.all();

return items.map(item => ({
  json: {
    hasBinary: !!item.binary,
    binaryKeys: item.binary ? Object.keys(item.binary).join(',') : 'none',
    itemKeys: Object.keys(item).join(',')
  }
}));
```

如果输出显示 `hasBinary: false`，说明Merge节点配置有问题。

## 替代方案：不使用Merge节点

如果Merge节点一直有问题，考虑：

### 方案A：使用Set节点添加字段

```
流程：
PDF生成 -> Set节点（添加token等字段）-> HTTP Request上传
```

在Set节点中：
```
添加字段：
- tenant_access_token: ={{ $('获取Token节点').item.json.tenant_access_token }}
- fileName: ={{ $binary.data.fileName }}
```

### 方案B：在HTTP Request节点直接引用其他节点

```
HTTP Request节点的Header:
Authorization: =Bearer {{ $('获取Token节点').first().json.tenant_access_token }}

Body Parameters:
file_name: ={{ $binary.data.fileName }}
file: (binary) =data
size: ={{ Buffer.from($binary.data.data, 'base64').length }}
```

这样完全不需要Merge节点。

## 推荐工作流结构

```
[生成PDF] 
    ↓
[Set节点：添加token引用]
    ↓
[HTTP Request：上传到飞书]
```

**Set节点配置**：
```
Keep Only Set: false (保留原有字段)

添加字段：
- tenant_access_token: ={{ $('获取飞书Token').first().json.tenant_access_token }}
- parent_node: BzfvbqKmXaTXotsyrMmlycZUg9g
- fileName: ={{ $binary.data.fileName || 'report.pdf' }}
```

**HTTP Request节点配置**：
```
Headers:
- Authorization: =Bearer {{ $json.tenant_access_token }}

Body (multipart/form-data):
- file_name: ={{ $json.fileName }}
- file: (binary) =data
- parent_type: bitable_file
- parent_node: ={{ $json.parent_node }}
- size: ={{ Buffer.from($binary.data.data, 'base64').length }}
```

## 总结

1. **检查Merge节点配置** - 确保保留所有字段
2. **验证binary数据** - 使用简单的Code节点测试
3. **考虑不用Merge** - 使用Set节点+节点引用更可靠
4. **直接在HTTP Request使用表达式** - 避免Code节点的问题
