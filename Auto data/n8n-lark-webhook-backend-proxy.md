# 通过后端代理实现Webhook发送文件

## 问题

Lark Webhook **不支持直接发送文件**，只能发送文本、卡片等消息类型。

## 解决方案：后端API代理

### 1. 创建后端API端点

```javascript
// backend/routes/larkProxy.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// 代理发送文件到Lark群
router.post('/send-file-to-group', async (req, res) => {
  try {
    const { 
      file_key, 
      file_name, 
      report_title, 
      report_period,
      webhook_url,
      tenant_access_token 
    } = req.body;

    // 1. 先通过webhook发送通知卡片
    const cardResponse = await axios.post(webhook_url, {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: 'blue',
          title: { tag: 'plain_text', content: report_title || '📊 报告已生成' }
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**报告周期：** ${report_period}\n**文件名：** ${file_name}\n\n📎 文件正在发送中...`
            }
          }
        ]
      }
    });

    // 2. 再通过API发送实际文件
    const fileResponse = await axios.post(
      'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id',
      {
        receive_id: 'oc_f138be619fd7e6ef75c45ce167a3bf24',
        msg_type: 'file',
        content: JSON.stringify({ file_key })
      },
      {
        headers: {
          'Authorization': `Bearer ${tenant_access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      card_sent: cardResponse.status === 200,
      file_sent: fileResponse.status === 200,
      data: {
        card_response: cardResponse.data,
        file_response: fileResponse.data
      }
    });

  } catch (error) {
    console.error('发送失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;
```

### 2. 修改n8n Code节点

```javascript
const items = $input.all();

if (!items.length) throw new Error('未收到上游数据');

let tenantAccessToken = '';
let reportTitle = '周报';
let reportPeriod = '';
let generatedAt = '';
let fileKey = '';
let fileName = '';

// 扫描数据...
for (const item of items) {
  const j = item.json || {};
  
  if (j.tenant_access_token && !tenantAccessToken) {
    tenantAccessToken = j.tenant_access_token;
  }
  
  if (j.title || j.html || j.period) {
    reportTitle = j.title || reportTitle;
    reportPeriod = j.period || reportPeriod;
    generatedAt = j.timestamp || generatedAt;
  }
  
  if (!fileKey && (j.data?.file_key || j.file_key)) {
    fileKey = j.data?.file_key || j.file_key;
  }
  
  if (!fileName && (j.fileName || j.file_name)) {
    fileName = j.fileName || j.file_name;
  }
}

if (!tenantAccessToken) throw new Error('未找到 tenant_access_token');
if (!fileKey) throw new Error('未找到 file_key');

// ✅ 构建后端代理请求
const proxyRequest = {
  url: 'http://localhost:8000/api/lark/send-file-to-group',
  body: {
    file_key: fileKey,
    file_name: fileName,
    report_title: reportTitle,
    report_period: reportPeriod,
    webhook_url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
    tenant_access_token: tenantAccessToken
  }
};

return [{
  json: {
    report_title: reportTitle,
    report_period: reportPeriod,
    generated_at: generatedAt,
    file_key: fileKey,
    file_name: fileName,
    
    // ✅ 使用后端代理
    proxyRequest,
    
    // ✅ 兼容：保留原字段名
    httpRequest: proxyRequest,
  },
}];
```

### 3. n8n HTTP Request节点配置

```json
{
  "method": "POST",
  "url": "={{ $json.proxyRequest.url }}",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "={{ $json.proxyRequest.body }}"
}
```

## 优势

- ✅ **统一入口**：一个请求完成卡片+文件发送
- ✅ **无需token管理**：后端处理token
- ✅ **错误处理**：后端可以重试和错误恢复
- ✅ **日志记录**：后端可以记录发送日志

## 工作流

```
[n8n Code节点] 
    ↓
[n8n HTTP Request] 
    ↓
[后端API代理] 
    ↓ (并行)
[Webhook发送卡片] + [API发送文件]
    ↓
[Lark群聊]
```

这样就实现了"用webhook发送文件"的效果！