# Lark 消息卡片文件下载按钮配置指南

## 功能说明

在 Lark 消息卡片中添加"下载文件"按钮，点击后可以下载对应的 CSV 文件。

## 工作流结构

```
构建消息内容 (Code)
    ↓
上传文件到Lark (HTTP Request) - 获取 file_key
    ↓
合并数据 (Merge) - 合并 file_key 和原始数据
    ↓
构建消息内容（带下载链接）(Code) - 生成带下载按钮的卡片
    ↓
发送卡片消息 (HTTP Request)
```

## 详细步骤

### 步骤 1：构建消息内容（初始）

**Code 节点**：`build-lark-card-message.js`

输出：
- `requestBodyJson`：卡片消息内容（此时还没有下载链接）
- `binary.csv`：二进制文件数据
- `fileName`：文件名
- `size`：文件大小

### 步骤 2：上传文件获取 file_key

**HTTP Request 节点**：上传文件

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/files`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
- **Body**:
  - **Body Content Type**: `Multipart-Form-Data`
  - **Body Parameters**:
    - `file_type`: `stream`
    - `file`: `={{ $binary.csv }}`
    - `file_name`: `={{ $json.fileName }}`

**响应示例：**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "file_key": "file_vxxxxx"
  }
}
```

### 步骤 3：合并数据

**Merge 节点**：合并上传结果和原始数据

- **Mode**: `Merge By Index` 或 `Merge By Key`
- 合并两个输入：
  1. 上传文件节点的输出（包含 `data.file_key`）
  2. 构建消息内容节点的输出（包含原始数据）

**输出字段：**
- `file_key`: `={{ $json.data.file_key }}`（从上传节点）
- `requestBodyJson`: `={{ $json.requestBodyJson }}`（从构建节点）
- `chatid`, `tenant_access_token` 等原始字段

### 步骤 4：构建消息内容（带下载链接）

**Code 节点**：重新构建卡片，添加下载链接

```javascript
// n8n Code 节点：构建带下载链接的 Lark 消息卡片

const items = $input.all();
if (!items.length) throw new Error('未收到数据');

const outputs = items.map(item => {
  const json = item.json || {};
  
  // 获取 file_key
  const fileKey = json.file_key || json.data?.file_key || json.file_token || json.data?.file_token;
  
  // 解析现有的卡片内容
  let card;
  try {
    // 如果已有 requestBodyJson，解析它
    if (json.requestBodyJson) {
      const requestBody = JSON.parse(json.requestBodyJson);
      const content = JSON.parse(requestBody.content);
      card = content;
    } else if (json.card) {
      card = json.card;
    } else {
      throw new Error('未找到卡片内容');
    }
  } catch (e) {
    throw new Error('解析卡片内容失败: ' + e.message);
  }
  
  // 如果有 file_key，添加或更新下载按钮
  if (fileKey) {
    const downloadUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/${fileKey}/download`;
    
    // 查找是否已有 action 元素
    const actionIndex = card.elements.findIndex(el => el.tag === 'action');
    
    const downloadButton = {
      "tag": "button",
      "text": {
        "tag": "plain_text",
        "content": "📥 下载文件"
      },
      "type": "primary",
      "url": downloadUrl
    };
    
    if (actionIndex >= 0) {
      // 更新现有的 action
      card.elements[actionIndex].actions = [downloadButton];
    } else {
      // 添加新的 action
      card.elements.push({
        "tag": "action",
        "actions": [downloadButton]
      });
    }
  }
  
  // 重新构建请求体
  const cardContent = JSON.stringify(card);
  const requestBody = {
    receive_id: json.chatid || json.receive_id || '',
    msg_type: 'interactive',
    content: cardContent
  };
  const requestBodyJson = JSON.stringify(requestBody);
  
  return {
    json: {
      ...json,
      requestBodyJson: requestBodyJson,
      file_key: fileKey,
      card: card
    }
  };
});

return outputs;
```

### 步骤 5：发送卡片消息

**HTTP Request 节点**：发送卡片

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
  - `Content-Type`: `application/json`
- **Body**:
  - **Specify Body**: `Using Expression`
  - **JSON Body**: `={{ $json.requestBodyJson }}`

## 简化方案：单步流程

如果不想使用 Merge 节点，可以在上传文件后直接构建卡片：

### 工作流结构（简化）

```
构建消息内容 (Code)
    ↓
上传文件到Lark (HTTP Request)
    ↓
构建带下载链接的卡片 (Code) - 合并 file_key 和原始数据
    ↓
发送卡片消息 (HTTP Request)
```

### Code 节点：构建带下载链接的卡片

```javascript
// 获取上游数据（包含上传结果和原始数据）
const uploadResult = $input.item.json;
const fileKey = uploadResult.data?.file_key || uploadResult.file_key;

// 从原始数据中获取卡片内容
// 注意：需要确保原始数据在上传节点之前保存
// 或者使用 $node["构建消息内容"] 获取

// 构建下载链接
const downloadUrl = fileKey 
  ? `https://open.feishu.cn/open-apis/drive/v1/medias/${fileKey}/download`
  : '';

// 重新构建卡片（添加下载按钮）
// ... 卡片构建逻辑 ...
```

## 下载链接格式

Lark 文件下载链接格式：

1. **使用 file_key**（消息 API 返回）：
   ```
   https://open.feishu.cn/open-apis/drive/v1/medias/{file_key}/download
   ```

2. **使用 file_token**（云盘 API 返回）：
   ```
   https://open.feishu.cn/open-apis/drive/v1/medias/{file_token}/download
   ```

3. **直接访问**（需要权限）：
   ```
   https://open.feishu.cn/file/{file_key}
   ```

## 注意事项

1. **下载链接需要认证**：下载链接可能需要用户登录 Lark 才能访问
2. **file_key 有效期**：file_key 可能有有效期限制
3. **权限检查**：确保 `tenant_access_token` 有文件访问权限
4. **按钮位置**：下载按钮会添加在卡片底部

## 测试步骤

1. 执行完整工作流
2. 检查 Lark 消息卡片
3. 点击"下载文件"按钮
4. 验证文件是否正确下载

## 故障排除

### 按钮不显示

- 检查 `file_key` 是否正确获取
- 检查卡片构建代码是否正确执行
- 查看 Code 节点的输出，确认 `file_key` 存在

### 点击按钮无法下载

- 检查下载链接格式是否正确
- 确认 `file_key` 是否有效
- 检查用户是否有文件访问权限
- 尝试在浏览器中直接访问下载链接

### file_key 为空

- 检查文件上传是否成功
- 查看上传节点的响应，确认 `data.file_key` 存在
- 检查 Merge 节点是否正确合并数据

