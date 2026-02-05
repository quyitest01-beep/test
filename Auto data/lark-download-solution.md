# Lark文件下载功能使用指南

## 功能状态
✅ **已完成并测试通过**

## 认证状态
✅ **Lark应用认证正常**
- App ID: `cli_a9978e93ce389ed2`
- App Secret: 已正确配置
- Token获取: 正常工作

## 后端服务状态
✅ **后端服务运行正常**
- 端口: 8000
- Lark下载路由: 已配置
- 环境变量: 已加载

## API端点

### 1. 获取文件信息
```
GET http://localhost:8000/lark-file-info/{file_key}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "file_key": "BzfvbqKmXaTXotsyrMmlycZUg9g",
    "file_name": "report.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "download_url": "/lark-download/BzfvbqKmXaTXotsyrMmlycZUg9g",
    "direct_url": "http://localhost:8000/lark-download/BzfvbqKmXaTXotsyrMmlycZUg9g"
  },
  "requestId": "req_xxx"
}
```

### 2. 下载文件
```
GET http://localhost:8000/lark-download/{file_key}
```

**响应:**
- Content-Type: application/pdf
- Content-Disposition: attachment; filename="report_{file_key}.pdf"
- 文件流数据

## 在n8n中使用

### 1. 生成下载链接
在n8n的Code节点中使用以下代码生成下载链接：

```javascript
// 假设你有一个file_key
const fileKey = 'your_actual_file_key_here';
const downloadUrl = `http://localhost:8000/lark-download/${fileKey}`;

// 生成Lark消息中的下载按钮
const downloadButton = `[📎 点击下载 报告文件](${downloadUrl})`;

return {
  json: {
    downloadUrl: downloadUrl,
    downloadButton: downloadButton,
    fileKey: fileKey
  }
};
```

### 2. 在Lark消息中显示
```javascript
// 在发送到Lark的消息中包含下载链接
const message = `
📊 报告已生成完成

${downloadButton}

⏰ 下载链接有效期：15分钟
`;

return {
  json: {
    text: message
  }
};
```

## 重要说明

### 文件权限
- 确保Lark应用有权限访问要下载的文件
- 文件必须在应用可访问的范围内
- 外部群组可能需要特殊权限配置

### 错误处理
常见错误及解决方案：

1. **404 Not Found**
   - 文件不存在或file_key无效
   - 应用没有访问权限
   - 文件已被删除

2. **401 Unauthorized**
   - App ID或App Secret配置错误
   - Token过期（自动重新获取）

3. **403 Forbidden**
   - 应用权限不足
   - 需要在Lark开发者后台配置相应权限

### 测试方法
1. 确保后端服务运行在端口8000
2. 使用真实的file_key进行测试
3. 检查Lark应用权限配置

## 下一步
1. 在n8n工作流中集成此下载功能
2. 替换测试用的file_key为实际的文件key
3. 测试完整的端到端流程

## 技术实现细节
- 使用Lark Open API v1
- 支持流式文件传输
- 自动处理Token刷新
- 完整的错误日志记录