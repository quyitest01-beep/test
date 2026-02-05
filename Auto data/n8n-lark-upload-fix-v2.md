# 飞书文件上传问题 - 完整解决方案

## 问题分析

从截图看到的错误：
```
Bad request - please check your parameters [item 0]
the actual size is inconsistent with the parameter declaration size
```

## 根本原因

飞书的 `multipart/form-data` 上传API有以下要求：

1. **size参数必须准确** - 必须是实际文件的字节数
2. **formBinaryData的处理** - n8n在处理binary数据时可能会改变大小
3. **parent_node参数** - 必须是有效的文件夹/文档ID

## 解决方案

### 方案1：完全移除size参数（推荐）

很多情况下，飞书API可以自动检测文件大小。尝试**完全删除size参数**：

**在HTTP Request节点的Body Parameters中**：
- 删除 `size` 这一行参数
- 只保留：`file_name`, `file`, `parent_type`, `parent_node`

### 方案2：使用正确的size计算方式

如果必须传size，需要在上传前添加Code节点：

```javascript
// n8n Code节点：正确计算文件大小
const items = $input.all();

return items.map(item => {
  // 找到binary数据
  let binaryData = null;
  let binaryKey = null;
  
  // 尝试从不同的位置获取binary
  if (item.binary) {
    // 优先使用指定的binaryProperty
    if (item.json.binaryProperty && item.binary[item.json.binaryProperty]) {
      binaryKey = item.json.binaryProperty;
      binaryData = item.binary[binaryKey];
    }
    // 否则使用'data'
    else if (item.binary.data) {
      binaryKey = 'data';
      binaryData = item.binary.data;
    }
    // 或者使用第一个binary key
    else {
      const keys = Object.keys(item.binary);
      if (keys.length > 0) {
        binaryKey = keys[0];
        binaryData = item.binary[binaryKey];
      }
    }
  }
  
  if (!binaryData) {
    throw new Error('找不到binary数据');
  }
  
  // 计算实际文件大小
  let actualSize = 0;
  
  if (binaryData.data) {
    // 如果是base64编码的数据
    const base64Data = binaryData.data;
    actualSize = Buffer.from(base64Data, 'base64').length;
  } else if (binaryData.fileSize) {
    // 如果有fileSize属性
    actualSize = binaryData.fileSize;
  }
  
  console.log(`文件: ${binaryData.fileName}`);
  console.log(`  Binary Key: ${binaryKey}`);
  console.log(`  Mime Type: ${binaryData.mimeType}`);
  console.log(`  计算的大小: ${actualSize} bytes (${(actualSize / 1024 / 1024).toFixed(2)} MB)`);
  
  return {
    json: {
      fileName: binaryData.fileName || 'document.pdf',
      size: actualSize,
      binaryProperty: binaryKey,
      parent_node: item.json.parent_node || 'BzfvbqKmXaTXotsyrMmlycZUg9g',
      tenant_access_token: item.json.tenant_access_token
    },
    binary: item.binary
  };
});
```

### 方案3：使用飞书SDK或专用节点

如果HTTP Request一直有问题，考虑：

1. **使用n8n的Lark节点**（如果有）
2. **使用自定义Webhook**通过后端服务上传
3. **分步上传**：先获取上传URL，再上传文件

## 调试步骤

### 1. 检查上游数据

在上传节点之前添加Code节点打印所有信息：

```javascript
const items = $input.all();

items.forEach((item, index) => {
  console.log(`\n========== Item ${index} ==========`);
  console.log('JSON数据:', JSON.stringify(item.json, null, 2));
  
  if (item.binary) {
    console.log('\nBinary数据:');
    Object.keys(item.binary).forEach(key => {
      const bin = item.binary[key];
      console.log(`  ${key}:`);
      console.log(`    fileName: ${bin.fileName}`);
      console.log(`    mimeType: ${bin.mimeType}`);
      console.log(`    fileExtension: ${bin.fileExtension}`);
      
      if (bin.data) {
        const size = Buffer.from(bin.data, 'base64').length;
        console.log(`    实际大小: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
      
      if (bin.fileSize) {
        console.log(`    fileSize属性: ${bin.fileSize}`);
      }
    });
  }
});

return items;
```

### 2. 测试小文件

先用一个很小的测试文件（几KB），确保流程正确。

### 3. 检查飞书API权限

确保：
- `tenant_access_token` 有效
- 有上传文件的权限
- `parent_node` ID正确且有写入权限

## 替代方案：通过后端服务上传

如果n8n直接上传一直有问题，可以创建一个后端API来处理：

### 后端API（Node.js）

```javascript
// backend/routes/larkUpload.js
const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const axios = require('axios');

router.post('/upload-to-lark', async (req, res) => {
  try {
    const { 
      fileData,  // base64编码的文件
      fileName, 
      parentNode, 
      tenantAccessToken 
    } = req.body;
    
    // 解码base64
    const buffer = Buffer.from(fileData, 'base64');
    
    // 创建form data
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('file', buffer, { filename: fileName });
    form.append('parent_type', 'bitable_file');
    form.append('parent_node', parentNode);
    form.append('size', buffer.length);  // 准确的大小
    
    // 上传到飞书
    const response = await axios.post(
      'https://open.larksuite.com/open-apis/drive/v1/medias/upload_all',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${tenantAccessToken}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('上传失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;
```

### n8n调用后端API

```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/lark/upload-to-lark",
  "body": {
    "fileData": "={{ $binary.data.data }}",
    "fileName": "={{ $binary.data.fileName }}",
    "parentNode": "BzfvbqKmXaTXotsyrMmlycZUg9g",
    "tenantAccessToken": "={{ $json.tenant_access_token }}"
  }
}
```

## 常见错误码

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| size不一致 | 声明的size与实际不符 | 移除size参数或正确计算 |
| 权限不足 | token没有上传权限 | 检查应用权限配置 |
| parent_node无效 | 文件夹ID错误 | 确认ID正确 |
| 文件过大 | 超过20MB限制 | 使用分片上传API |

## 推荐配置

**最简单的配置（移除size）**：

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
        "inputDataFieldName": "={{ $json.binaryProperty }}"
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

注意：**完全移除了size参数**

## 总结

1. **首选方案**：移除size参数，让飞书自动检测
2. **备选方案**：使用Code节点正确计算size
3. **终极方案**：通过后端服务处理上传

建议先尝试方案1（移除size），如果不行再尝试其他方案。
