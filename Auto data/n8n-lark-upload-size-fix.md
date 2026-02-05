# n8n 飞书文件上传 - Size 参数错误修复指南

## 错误信息
```
Bad request - please check your parameters [item 0]
the actual size is inconsistent with the parameter declaration size
```

## 问题原因

飞书的 `/open-apis/drive/v1/medias/upload_all` API 要求：
- `size` 参数必须是**实际文件的字节数**（整数）
- 如果声明的size与实际文件大小不一致，会报错

## 解决方案

### 方案1：从Binary数据自动获取文件大小（推荐）

在上传节点**之前**添加一个 **Code 节点**来计算实际文件大小：

```javascript
// n8n Code节点：计算Binary文件大小
const items = $input.all();

return items.map(item => {
  const binaryPropertyName = item.json.binaryProperty || 'data';
  const binary = item.binary[binaryPropertyName];
  
  if (!binary || !binary.data) {
    throw new Error(`Binary data not found: ${binaryPropertyName}`);
  }
  
  // 计算实际文件大小（Base64解码后的字节数）
  const base64Data = binary.data;
  const actualSize = Buffer.from(base64Data, 'base64').length;
  
  return {
    json: {
      ...item.json,
      size: actualSize,  // 实际文件大小（字节）
      fileName: item.json.fileName || binary.fileName || 'file.pdf',
      binaryProperty: binaryPropertyName
    },
    binary: item.binary
  };
});
```

### 方案2：移除size参数（让飞书自动检测）

如果飞书API支持，可以尝试**不传size参数**：

在HTTP Request节点的Body Parameters中，**删除size参数**。

### 方案3：从上游正确传递size

如果上游节点（如PDF生成服务）返回了文件大小，确保：

1. **检查上游数据结构**：
   ```javascript
   // 在Code节点中打印，查看实际数据
   console.log('上游数据:', JSON.stringify($input.all(), null, 2));
   return $input.all();
   ```

2. **确保size是数字类型**：
   ```javascript
   // 如果size是字符串，转换为数字
   const items = $input.all();
   return items.map(item => ({
     json: {
       ...item.json,
       size: parseInt(item.json.size, 10)  // 确保是整数
     },
     binary: item.binary
   }));
   ```

## 完整的工作流示例

```
[PDF生成] → [计算文件大小] → [上传到飞书]
```

### 节点1：PDF生成（HTTP Request）
调用你的PDF服务：
```json
{
  "method": "POST",
  "url": "http://localhost:8787/render",
  "body": {
    "html": "={{ $json.htmlContent }}",
    "filename": "={{ $json.fileName }}"
  },
  "responseType": "arraybuffer"
}
```

### 节点2：计算文件大小（Code）
```javascript
const items = $input.all();

return items.map(item => {
  // 假设PDF在 'data' binary property中
  const pdfBinary = item.binary.data;
  
  if (!pdfBinary || !pdfBinary.data) {
    throw new Error('PDF binary data not found');
  }
  
  // 计算实际大小
  const actualSize = Buffer.from(pdfBinary.data, 'base64').length;
  
  console.log(`文件: ${pdfBinary.fileName}, 大小: ${actualSize} bytes`);
  
  return {
    json: {
      fileName: pdfBinary.fileName || 'document.pdf',
      size: actualSize,
      binaryProperty: 'data',
      tenant_access_token: item.json.tenant_access_token  // 保留token
    },
    binary: item.binary
  };
});
```

### 节点3：上传到飞书（HTTP Request）
```json
{
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
        "inputDataFieldName": "={{ $json.binaryProperty }}"
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
        "value": "={{ $json.size }}"
      }
    ]
  }
}
```

## 调试技巧

### 1. 检查实际文件大小
在上传节点之前添加Code节点：
```javascript
const items = $input.all();

items.forEach(item => {
  const binaryProp = item.json.binaryProperty || 'data';
  const binary = item.binary[binaryProp];
  
  if (binary && binary.data) {
    const actualSize = Buffer.from(binary.data, 'base64').length;
    console.log(`声明的size: ${item.json.size}`);
    console.log(`实际的size: ${actualSize}`);
    console.log(`是否一致: ${item.json.size === actualSize}`);
  }
});

return items;
```

### 2. 查看飞书API响应
在HTTP Request节点的Settings中：
- 启用 "Always Output Data"
- 查看完整的错误响应

### 3. 测试小文件
先用一个很小的PDF测试（几KB），确保流程正确，再处理大文件。

## 常见问题

### Q: size应该是什么单位？
A: **字节（bytes）**，必须是整数。

### Q: 如果文件很大怎么办？
A: 飞书API有文件大小限制（通常是20MB），超过需要使用分片上传API。

### Q: 可以不传size参数吗？
A: 取决于飞书API版本，建议查看官方文档。通常需要传递。

## 参考资料

- [飞书开放平台 - 上传文件](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/upload_all)
- [n8n HTTP Request节点文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)

## 更新日志

- 2026-02-02: 创建文档，解决size参数不一致问题
