# 飞书上传 - 直接在HTTP Request节点使用表达式

## 问题分析

Code节点无法访问binary数据，但HTTP Request节点**可以直接访问**。

## 解决方案：不使用Code节点

### 方法1：在HTTP Request节点直接计算size（推荐）

在HTTP Request节点的Body Parameters中，**直接使用表达式**：

```
参数配置：
- name: file_name
  value: ={{ $json.fileName || $binary.data.fileName }}

- name: file (formBinaryData)
  inputDataFieldName: =data

- name: parent_type
  value: bitable_file

- name: parent_node  
  value: BzfvbqKmXaTXotsyrMmlycZUg9g

- name: size
  value: ={{ $binary.data ? Buffer.from($binary.data.data, 'base64').length : 0 }}
```

**关键点**：
- HTTP Request节点可以直接访问 `$binary.data`
- 使用表达式 `={{ ... }}` 直接计算size
- 不需要额外的Code节点

### 方法2：完全移除size参数（最简单）

飞书API可能支持自动检测文件大小，直接删除size参数：

```
只保留这些参数：
- file_name
- file (binary)
- parent_type
- parent_node
```

### 方法3：使用固定的binaryProperty名称

如果上游节点的binary key是固定的（比如 "data"），可以：

```
- name: size
  value: ={{ $binary.data.data ? Buffer.from($binary.data.data, 'base64').length : $json.size }}
```

## 完整的HTTP Request节点配置

```json
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
          "value": "={{ $binary.data ? $binary.data.fileName : $json.fileName }}"
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
          "value": "={{ $binary.data && $binary.data.data ? Buffer.from($binary.data.data, 'base64').length : ($json.size || 0) }}"
        }
      ]
    }
  }
}
```

## 调试步骤

### 1. 先测试不带size参数

完全删除size这一行，看飞书是否接受。

### 2. 检查binary key名称

在HTTP Request节点前添加一个**Set节点**（不是Code节点）：

```
添加字段：
- debugBinaryKeys: ={{ Object.keys($binary).join(',') }}
- debugHasBinaryData: ={{ !!$binary.data }}
- debugFileName: ={{ $binary.data ? $binary.data.fileName : 'no data' }}
```

这样可以看到binary的实际结构。

### 3. 使用正确的binary key

如果binary key不是"data"，而是其他名称（比如"file"或"pdf"），修改表达式：

```
inputDataFieldName: =file  // 或其他实际的key名称
```

## 为什么Code节点不工作

n8n的Code节点在某些情况下：
- `$input.all()` 可能不包含binary数据
- `$items()` 可能不存在或返回空
- binary数据可能被Merge节点"丢失"

但HTTP Request节点可以**直接访问当前item的binary数据**，所以应该直接在HTTP Request节点使用表达式。

## 最终建议

**按顺序尝试**：

1. **删除size参数** - 最简单，可能就能工作
2. **使用表达式计算size** - 在HTTP Request节点直接计算
3. **检查binary key名称** - 确保使用正确的key
4. **使用后端API** - 如果以上都不行，通过后端服务上传

## 注意事项

- 确保Merge3节点配置为"Keep Matches"或"Merge By Position"以保留binary数据
- 检查Merge3节点的"Options" -> "Include All Fields"是否启用
- 如果Merge3之后binary消失，考虑重新设计workflow，避免merge binary数据
