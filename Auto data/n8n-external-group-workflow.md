# 外部群完整解决方案

## 🎯 问题

外部群无法：
- 使用API发送文件
- 访问内部file_key
- 直接下载Lark内部文件

## ✅ 解决方案：公开下载链接

### 工作流设计

```
[数据整合] → [生成下载链接] → [发送卡片到外部群]
```

### 1. 修改后端（添加公开下载API）

在 `backend/app.js` 中添加：
```javascript
const publicDownloadRouter = require('./routes/publicDownload');
app.use('/api/public', publicDownloadRouter);
```

### 2. 修改n8n工作流

#### Code节点1：准备数据
```javascript
const items = $input.all();
// ... 原有的数据整合逻辑 ...

// 构建生成下载链接的请求
const generateLinkRequest = {
  url: 'http://localhost:8000/api/public/generate-download-link',
  body: {
    file_key: fileKey,
    file_name: fileName,
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
    generateLinkRequest
  }
}];
```

#### HTTP节点1：生成下载链接
```
Method: POST
URL: ={{ $json.generateLinkRequest.url }}
Body: ={{ $json.generateLinkRequest.body }}
```

#### Code节点2：构建卡片
```javascript
const downloadUrl = $json.download_url;
const shortUrl = $json.short_url;

const card = {
  config: { wide_screen_mode: true },
  header: {
    template: 'blue',
    title: { tag: 'plain_text', content: $('Code节点1').first().json.report_title }
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**报告周期：** ${$('Code节点1').first().json.report_period}\n` +
                `**生成时间：** ${$('Code节点1').first().json.generated_at}`
      }
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `📄 **文件：** ${$('Code节点1').first().json.file_name}\n\n` +
                `🔗 **下载链接：** [点击下载](${downloadUrl})\n\n` +
                `📱 **短链接：** ${shortUrl}\n\n` +
                `⏰ *链接24小时内有效*`
      }
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '📥 立即下载' },
          type: 'primary',
          url: downloadUrl
        }
      ]
    }
  ]
};

return [{
  json: {
    webhookRequest: {
      url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
      body: {
        msg_type: 'interactive',
        card: card
      }
    }
  }
}];
```

#### HTTP节点2：发送到外部群
```
Method: POST
URL: ={{ $json.webhookRequest.url }}
Body: ={{ $json.webhookRequest.body }}
```

---

## 🎨 最终效果

外部群用户会收到：

```
┌─────────────────────────────────┐
│ 📊 GMP日报_2026.02.02-02        │
├─────────────────────────────────┤
│ 报告周期： 2026.02.02-02        │
│ 生成时间： 2026-02-04 03:18:56  │
│ ─────────────────────────────── │
│ 📄 文件： 周报.pdf              │
│                                 │
│ 🔗 下载链接： 点击下载          │
│                                 │
│ 📱 短链接： http://xxx/d/abc123  │
│                                 │
│ ⏰ 链接24小时内有效             │
│                                 │
│ [📥 立即下载]                   │
└─────────────────────────────────┘
```

用户点击链接或按钮，直接下载PDF文件！

---

## 🔒 安全特性

- ✅ **临时链接**：24小时自动过期
- ✅ **一次性token**：每次生成新的下载token
- ✅ **权限验证**：后端验证file_key访问权限
- ✅ **短链接**：方便分享和记忆

---

## 🚀 部署步骤

1. **添加后端API**：复制 `backend-public-download-api.js` 到后端
2. **修改n8n工作流**：按上面的3个节点配置
3. **测试下载**：确保外部用户能正常下载

这样外部群用户就能直接下载文件了！