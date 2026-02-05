# 文件大小批量查询API下载链接功能

## 功能概述

`/api/query/file-size/batch` API 现在支持为大文件（>500KB）自动生成S3预签名下载链接，让用户可以直接下载查询结果文件。

## 新增功能

### 自动下载链接生成
- **触发条件**: 当文件大小超过 500KB 时
- **链接类型**: S3预签名URL
- **有效期**: 15分钟（900秒）
- **权限**: 只读下载权限

### API响应格式更新

原有响应格式保持不变，新增 `downloadUrl` 字段：

```json
{
  "success": true,
  "data": [
    {
      "queryId": "81556de6-88db-4122-84e8-44c926f82054",
      "success": true,
      "fileSize": {
        "totalSizeBytes": 1048576,
        "totalSizeMB": 1.0,
        "totalSizeGB": 0.001,
        "fileCount": 1,
        "formattedSize": "1.0 MB",
        "contentType": "text/csv",
        "lastModified": "2024-02-04T04:20:11.000Z"
      },
      "recommendation": {
        "action": "export_or_batch",
        "message": "中等文件，建议导出或批量处理"
      },
      "bucket": "aws-athena-query-results-us-west-2-034986963036",
      "fileKey": "81556de6-88db-4122-84e8-44c926f82054.csv",
      "downloadUrl": "https://s3.us-west-2.amazonaws.com/aws-athena-query-results-us-west-2-034986963036/81556de6-88db-4122-84e8-44c926f82054.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
    }
  ],
  "totalQueries": 1,
  "successfulQueries": 1,
  "failedQueries": 0,
  "requestId": "req_1707019211_abc123"
}
```

## 使用方法

### 1. 发送请求

```bash
curl -X POST http://localhost:8000/api/query/file-size/batch \
  -H "Content-Type: application/json" \
  -d '{
    "queryIds": ["81556de6-88db-4122-84e8-44c926f82054"]
  }'
```

### 2. 检查响应

- 如果 `fileSize.totalSizeBytes > 512000` (500KB)
- 且 `success: true`
- 则 `downloadUrl` 字段包含预签名下载链接

### 3. 使用下载链接

```javascript
// 检查是否有下载链接
if (result.downloadUrl) {
  // 直接在浏览器中打开或使用fetch下载
  window.open(result.downloadUrl);
  
  // 或者使用fetch下载
  fetch(result.downloadUrl)
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileKey;
      a.click();
    });
}
```

## 安装和部署

### 1. 安装依赖

```bash
cd backend
npm install @aws-sdk/s3-request-presigner@^3.478.0
```

或运行提供的批处理文件：
```bash
install-s3-presigner.bat
```

### 2. 重启服务

```bash
cd backend
npm start
```

### 3. 测试功能

```bash
node test-file-size-batch-with-download-url.js
```

## 配置说明

### 环境变量

确保以下AWS配置正确：

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SESSION_TOKEN=your_session_token  # 如果使用临时凭证
AWS_REGION=us-west-2
ATHENA_OUTPUT_LOCATION=s3://aws-athena-query-results-us-west-2-034986963036/
```

### 权限要求

AWS凭证需要以下S3权限：
- `s3:GetObject` - 生成预签名URL
- `s3:HeadObject` - 获取文件信息

## 安全考虑

### 链接安全性
- **有效期限制**: 15分钟自动过期
- **只读权限**: 只能下载，不能修改或删除
- **签名验证**: AWS签名确保链接完整性

### 访问控制
- 只有通过API认证的用户才能获取下载链接
- 链接包含AWS签名，无法伪造
- 过期后链接自动失效

## 故障排除

### 常见问题

1. **下载链接为null**
   - 检查文件大小是否>500KB
   - 验证AWS凭证配置
   - 查看服务器日志中的错误信息

2. **链接访问被拒绝**
   - 检查AWS凭证权限
   - 确认S3 bucket和文件存在
   - 验证链接是否过期

3. **依赖安装失败**
   - 确保网络连接正常
   - 检查npm版本兼容性
   - 尝试清除npm缓存：`npm cache clean --force`

### 日志查看

服务器日志会记录：
- 预签名URL生成成功/失败
- 文件大小检查结果
- AWS API调用错误

```bash
# 查看实时日志
tail -f backend/logs/app.log
```

## 性能影响

### 响应时间
- 小文件（<500KB）：无额外延迟
- 大文件（>500KB）：增加约50-100ms（生成预签名URL）

### 并发处理
- 批量请求按10个一组并行处理
- 每组内的预签名URL生成并行执行
- 对AWS API调用频率影响最小

## 示例代码

### JavaScript前端使用

```javascript
async function downloadLargeFiles(queryIds) {
  try {
    const response = await fetch('/api/query/file-size/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryIds })
    });
    
    const data = await response.json();
    
    data.data.forEach(result => {
      if (result.success && result.downloadUrl) {
        console.log(`文件 ${result.fileKey} 可下载:`, result.downloadUrl);
        
        // 自动下载
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileKey;
        link.click();
      }
    });
  } catch (error) {
    console.error('下载失败:', error);
  }
}
```

### Python后端使用

```python
import requests

def get_download_urls(query_ids):
    response = requests.post(
        'http://localhost:8000/api/query/file-size/batch',
        json={'queryIds': query_ids}
    )
    
    data = response.json()
    download_urls = []
    
    for result in data['data']:
        if result['success'] and result.get('downloadUrl'):
            download_urls.append({
                'queryId': result['queryId'],
                'fileName': result['fileKey'],
                'downloadUrl': result['downloadUrl'],
                'fileSize': result['fileSize']['formattedSize']
            })
    
    return download_urls
```

## 更新日志

### v1.1.0 (2024-02-04)
- ✅ 新增：大文件自动生成S3预签名下载链接
- ✅ 新增：500KB文件大小阈值
- ✅ 新增：15分钟链接有效期
- ✅ 新增：完整的错误处理和日志记录
- ✅ 新增：测试脚本和文档