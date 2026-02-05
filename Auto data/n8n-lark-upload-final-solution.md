# 飞书上传问题 - 最终解决方案

## 核心问题

Code节点无法访问binary数据，但这**不是必须的**！

## ✅ 推荐解决方案（3选1）

### 方案1：完全删除size参数（最简单）⭐⭐⭐

**直接在HTTP Request节点删除size这一行参数。**

飞书API会自动从multipart数据中读取文件大小。

```json
{
  "bodyParameters": {
    "parameters": [
      {
        "name": "file_name",
        "value": "={{ $json.fileName }}"
      },
      {
        "parameterType": "formBinaryData",
        "name": "file",
        "inputDataFieldName": "=data"
      },
      {
        "name": "parent_type",
        "value": "bitable_file"
      },
      {
        "name": "parent_node",
        "value": "BzfvbqKmXaTXotsyrMmlycZUg9g"
      }
    ]
  }
}
```

**注意**：完全没有size参数！

---

### 方案2：在HTTP Request节点直接计算size ⭐⭐

**不需要Code节点**，直接在HTTP Request的size参数使用表达式：

```
参数名: size
参数值: ={{ Buffer.from($binary.data.data, 'base64').length }}
```

完整配置：

```json
{
  "bodyParameters": {
    "parameters": [
      {
        "name": "file_name",
        "value": "={{ $json.fileName }}"
      },
      {
        "parameterType": "formBinaryData",
        "name": "file",
        "inputDataFieldName": "=data"
      },
      {
        "name": "parent_type",
        "value": "bitable_file"
      },
      {
        "name": "parent_node",
        "value": "BzfvbqKmXaTXotsyrMmlycZUg9g"
      },
      {
        "name": "size",
        "value": "={{ Buffer.from($binary.data.data, 'base64').length }}"
      }
    ]
  }
}
```

**关键**：HTTP Request节点可以直接访问 `$binary.data`！

---

### 方案3：修复Merge节点配置 ⭐

如果binary数据在Merge后丢失，修改Merge3节点：

**Merge节点配置**：
```
Mode: Merge By Position
Options:
  ☑ Include All Fields
```

**或者完全不用Merge节点**，改用Set节点：

```
流程：
[生成PDF] -> [Set节点] -> [HTTP Request上传]
```

Set节点配置：
```
Keep Only Set: false

添加字段：
- tenant_access_token: ={{ $('获取Token').first().json.tenant_access_token }}
- fileName: ={{ $binary.data.fileName }}
```

---

## 🔧 操作步骤

### 立即尝试（按顺序）：

1. **先试方案1** - 删除size参数
   - 打开HTTP Request节点
   - 找到Body Parameters中的size那一行
   - 点击删除按钮
   - 保存并测试

2. **如果方案1不行，试方案2** - 使用表达式
   - 在size参数的value中输入：
     ```
     ={{ Buffer.from($binary.data.data, 'base64').length }}
     ```
   - 保存并测试

3. **如果还不行，检查Merge节点** - 方案3
   - 打开Merge3节点
   - 确保Mode是"Merge By Position"
   - 在Options中勾选"Include All Fields"
   - 保存并测试

---

## 🐛 调试技巧

### 检查binary数据是否存在

在HTTP Request节点**之前**添加一个Set节点：

```
添加字段：
- debug_has_binary: ={{ !!$binary.data }}
- debug_binary_keys: ={{ Object.keys($binary).join(',') }}
- debug_file_name: ={{ $binary.data ? $binary.data.fileName : 'no file' }}
```

运行后查看输出：
- 如果 `debug_has_binary` 是 `false`，说明binary数据丢失了
- 如果 `debug_binary_keys` 不包含"data"，说明key名称不对

### 如果binary key不是"data"

假设binary key是"file"或"pdf"，修改：

```
inputDataFieldName: =file  // 改成实际的key名称

size表达式: ={{ Buffer.from($binary.file.data, 'base64').length }}
```

---

## ❌ 不要做的事

1. **不要使用Code节点计算size** - Code节点访问binary有问题
2. **不要使用 `$input.all()`** - 可能不包含binary
3. **不要使用 `$items()`** - 可能不存在
4. **不要猜测size值** - 必须精确或不传

---

## ✅ 最可能成功的配置

```json
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "https://open.larksuite.com/open-apis/drive/v1/medias/upload_all",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json.tenant_access_token }}"
            }
          ]
        },
        "sendBody": true,
        "contentType": "multipart-form-data",
        "bodyParameters": {
          "parameters": [
            {
              "name": "file_name",
              "value": "={{ $json.fileName }}"
            },
            {
              "parameterType": "formBinaryData",
              "name": "file",
              "inputDataFieldName": "=data"
            },
            {
              "name": "parent_type",
              "value": "bitable_file"
            },
            {
              "name": "parent_node",
              "value": "BzfvbqKmXaTXotsyrMmlycZUg9g"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "name": "上传到飞书"
    }
  ]
}
```

**注意**：这个配置**没有size参数**！

---

## 📝 总结

- **最简单**：删除size参数（方案1）
- **如果必须传size**：在HTTP Request节点用表达式（方案2）
- **如果binary丢失**：修复Merge节点或改用Set节点（方案3）
- **不要用Code节点**：它访问不到binary数据

**现在就试方案1，直接删除size参数！**
