# 批量查询API使用指南

## 一、启动服务器

### 方法1：使用批处理文件（推荐）
```bash
# Windows
start-server.bat

# 或者在项目根目录执行
cd backend
node server.js
```

### 方法2：直接运行Node.js
```bash
cd backend
node server.js
```

### 方法3：使用npm（如果有配置）
```bash
npm start
```

服务器默认运行在端口 **8000**，可以通过环境变量 `PORT` 修改。

## 二、API接口说明

### 1. 启动批量查询
**接口地址：** `POST /api/batch/start`

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
{
  "queries": {
    "queryName1": "SELECT * FROM table1 WHERE condition1",
    "queryName2": "SELECT * FROM table2 WHERE condition2",
    "queryName3": "SELECT * FROM table3 WHERE condition3"
  },
  "database": "gmp",  // 可选，默认使用配置的数据库
  "maxRetries": 3     // 可选，最大重试次数（0-5），默认3
}
```

**参数说明：**
- `queries` (必需): 对象，键为查询名称，值为SQL查询语句
  - 最多支持10个查询
  - 每个SQL语句最多10000个字符
- `database` (可选): 数据库名称，如 "gmp"
- `maxRetries` (可选): 最大重试次数，范围0-5，默认3

**响应示例：**
```json
{
  "success": true,
  "batchId": "batch_1703123456789_abc123xyz",
  "queryResults": {
    "queryName1": {
      "queryId": "query_1_uuid",
      "status": "pending",
      "message": "查询已启动"
    },
    "queryName2": {
      "queryId": "query_2_uuid",
      "status": "pending",
      "message": "查询已启动"
    }
  },
  "totalQueries": 2,
  "successfulQueries": 2,
  "failedQueries": 0,
  "message": "批量查询已启动: 2/2 成功",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### 2. 查询批量状态
**接口地址：** `GET /api/batch/status/{batchId}`

**路径参数：**
- `batchId`: 批量查询ID（从启动接口返回）

**响应示例：**
```json
{
  "success": true,
  "batchId": "batch_1703123456789_abc123xyz",
  "status": "running",
  "queryStatuses": {
    "queryName1": {
      "queryId": "query_1_uuid",
      "status": "completed",
      "rowCount": 150,
      "executionTime": 2500,
      "message": "查询执行成功！"
    },
    "queryName2": {
      "queryId": "query_2_uuid",
      "status": "running",
      "progress": 60,
      "message": "查询正在执行中，请稍候..."
    }
  },
  "summary": {
    "totalQueries": 2,
    "completedQueries": 1,
    "failedQueries": 0,
    "runningQueries": 1,
    "progress": 50
  },
  "timestamp": "2025-01-01T12:00:30.000Z"
}
```

### 3. 取消批量查询
**接口地址：** `POST /api/batch/cancel/{batchId}`

**路径参数：**
- `batchId`: 批量查询ID

**响应示例：**
```json
{
  "success": true,
  "batchId": "batch_1703123456789_abc123xyz",
  "cancelledQueries": 2,
  "message": "批量查询已取消",
  "timestamp": "2025-01-01T12:01:00.000Z"
}
```

## 三、使用示例

### 使用curl命令

#### 1. 启动批量查询
```bash
curl -X POST http://localhost:8000/api/batch/start \
  -H "Content-Type: application/json" \
  -d '{
    "queries": {
      "merchantDaily": "SELECT * FROM merchant_game_analytics WHERE stat_type = '\''merchant_daily'\''",
      "gameDaily": "SELECT * FROM merchant_game_analytics WHERE stat_type = '\''game_daily'\''"
    },
    "database": "gmp",
    "maxRetries": 3
  }'
```

#### 2. 查询批量状态
```bash
curl -X GET http://localhost:8000/api/batch/status/batch_1703123456789_abc123xyz
```

#### 3. 取消批量查询
```bash
curl -X POST http://localhost:8000/api/batch/cancel/batch_1703123456789_abc123xyz
```

### 使用JavaScript/Node.js

```javascript
const axios = require('axios');

// 1. 启动批量查询
async function startBatchQuery() {
  try {
    const response = await axios.post('http://localhost:8000/api/batch/start', {
      queries: {
        merchantDaily: "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_daily'",
        gameDaily: "SELECT * FROM merchant_game_analytics WHERE stat_type = 'game_daily'"
      },
      database: "gmp",
      maxRetries: 3
    });
    
    console.log('批量查询已启动:', response.data);
    return response.data.batchId;
  } catch (error) {
    console.error('启动失败:', error.response?.data || error.message);
  }
}

// 2. 查询批量状态
async function getBatchStatus(batchId) {
  try {
    const response = await axios.get(`http://localhost:8000/api/batch/status/${batchId}`);
    console.log('批量查询状态:', response.data);
    return response.data;
  } catch (error) {
    console.error('查询状态失败:', error.response?.data || error.message);
  }
}

// 3. 取消批量查询
async function cancelBatchQuery(batchId) {
  try {
    const response = await axios.post(`http://localhost:8000/api/batch/cancel/${batchId}`);
    console.log('批量查询已取消:', response.data);
  } catch (error) {
    console.error('取消失败:', error.response?.data || error.message);
  }
}

// 使用示例
(async () => {
  const batchId = await startBatchQuery();
  
  // 轮询查询状态
  const interval = setInterval(async () => {
    const status = await getBatchStatus(batchId);
    if (status.status === 'completed' || status.status === 'failed') {
      clearInterval(interval);
      console.log('批量查询完成');
    }
  }, 2000); // 每2秒查询一次
})();
```

### 使用Python

```python
import requests
import time

BASE_URL = "http://localhost:8000"

# 1. 启动批量查询
def start_batch_query():
    response = requests.post(
        f"{BASE_URL}/api/batch/start",
        json={
            "queries": {
                "merchantDaily": "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_daily'",
                "gameDaily": "SELECT * FROM merchant_game_analytics WHERE stat_type = 'game_daily'"
            },
            "database": "gmp",
            "maxRetries": 3
        }
    )
    return response.json()

# 2. 查询批量状态
def get_batch_status(batch_id):
    response = requests.get(f"{BASE_URL}/api/batch/status/{batch_id}")
    return response.json()

# 3. 取消批量查询
def cancel_batch_query(batch_id):
    response = requests.post(f"{BASE_URL}/api/batch/cancel/{batch_id}")
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 启动批量查询
    result = start_batch_query()
    batch_id = result["batchId"]
    print(f"批量查询已启动，batchId: {batch_id}")
    
    # 轮询查询状态
    while True:
        status = get_batch_status(batch_id)
        print(f"状态: {status['status']}, 进度: {status.get('summary', {}).get('progress', 0)}%")
        
        if status["status"] in ["completed", "failed"]:
            break
        
        time.sleep(2)  # 每2秒查询一次
```

## 四、完整工作流程

1. **启动服务器**
   ```bash
   cd backend
   node server.js
   ```

2. **调用启动接口**
   - 发送POST请求到 `/api/batch/start`
   - 获取返回的 `batchId`

3. **轮询查询状态**
   - 使用 `batchId` 调用 `/api/batch/status/{batchId}`
   - 根据返回的状态决定是否继续轮询

4. **获取查询结果**
   - 当状态为 `completed` 时，可以通过单个查询API获取结果
   - 或使用异步查询结果获取接口

5. **（可选）取消查询**
   - 如果需要取消，调用 `/api/batch/cancel/{batchId}`

## 五、注意事项

1. **服务器必须先启动**：确保后端服务器正在运行（默认端口8000）
2. **查询数量限制**：最多同时执行10个查询
3. **SQL长度限制**：每个SQL语句最多10000个字符
4. **超时处理**：建议设置合理的超时时间，避免长时间等待
5. **错误处理**：注意处理网络错误和API错误响应
6. **状态轮询**：建议使用合理的轮询间隔（如2-5秒），避免过于频繁的请求

## 六、常见问题

### Q: 服务器启动失败？
A: 检查：
- 端口8000是否被占用
- 环境变量配置是否正确
- 依赖包是否已安装（`npm install`）

### Q: 接口返回404？
A: 确认：
- 服务器是否已启动
- 接口路径是否正确（`/api/batch/start`）
- 请求方法是否为POST

### Q: 查询一直处于pending状态？
A: 可能原因：
- Athena服务响应慢
- 网络连接问题
- 查询语句有问题

### Q: 如何查看服务器日志？
A: 服务器日志会输出到控制台，包括：
- 请求信息
- 错误信息
- 查询执行状态

## 七、相关文件

- 路由文件：`backend/routes/batchQuery.js`
- 服务器文件：`backend/server.js`
- 测试文件：`backend/test-batch-query-api.js`
- 启动脚本：`start-server.bat`

