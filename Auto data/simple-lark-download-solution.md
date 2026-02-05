# 简单的Lark文件下载解决方案

## 🚫 当前问题

Lark文件下载失败，原因是：
```
Failed to get token: invalid param
```

这是因为缺少Lark App的配置信息。

## 💡 简单解决方案

### 方案1：配置Lark App凭据（推荐）

1. **获取Lark App信息**：
   - 登录 [Lark开发者后台](https://open.larksuite.com/)
   - 找到你的应用
   - 获取 App ID 和 App Secret

2. **更新环境变量**：
   ```env
   # 在 backend/.env 中添加
   LARK_APP_ID=cli_xxxxxxxxxx
   LARK_APP_SECRET=xxxxxxxxxxxxxxxxxx
   ```

3. **重启后端服务**：
   ```bash
   # 停止当前服务
   taskkill /F /IM node.exe
   
   # 重新启动
   cd backend && npm start
   ```

### 方案2：使用Lark直接分享链接（更简单）

如果配置App凭据比较复杂，可以使用Lark的直接分享功能：

```javascript
// 在n8n Code节点中，不生成下载链接，而是提供文件信息
const card = {
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `📄 **报告已生成**\n\n` +
                `**文件ID：** \`${fileKey}\`\n\n` +
                `💡 *请联系管理员获取文件，或在Lark中直接查看文件*`
      }
    }
  ]
};
```

### 方案3：使用PDF服务生成下载链接

如果你有PDF文件的原始数据，可以通过PDF服务提供下载：

```javascript
// 生成PDF服务的下载链接
const downloadUrl = `http://localhost:8787/render-pdf/${fileKey}`;
```

## 🔧 快速修复

**最简单的方法**：修改你的n8n Code节点，不提供下载按钮，只显示文件信息：

```javascript
// 简化版本 - 不提供下载链接
const card = {
  config: { wide_screen_mode: true },
  header: {
    template: 'blue',
    title: { tag: 'plain_text', content: '📊 报告已生成' }
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**报告周期：** ${reportPeriod}\n` +
                `**生成时间：** ${generatedAt}\n` +
                `**文件名称：** ${fileName}\n\n` +
                `📋 **文件ID：** \`${fileKey}\`\n\n` +
                `💡 *文件已上传到Lark，请在应用中查看或联系管理员获取*`
      }
    }
  ]
};
```

## 📋 推荐步骤

1. **立即修复**：使用方案3（简化版本），去掉下载按钮
2. **长期解决**：配置Lark App凭据，启用完整下载功能
3. **测试验证**：确保卡片能正常发送到外部群

这样外部群用户至少能看到报告已生成的通知，即使暂时无法直接下载。