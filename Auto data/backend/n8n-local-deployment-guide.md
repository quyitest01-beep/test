# n8n 本地部署指南

## 快速开始（Windows）

### 1. 安装 Node.js
从 [nodejs.org](https://nodejs.org/) 下载并安装 Node.js LTS 版本。

### 2. 全局安装 n8n
```powershell
npm install -g n8n
```

### 3. 安装 xlsx 模块
```powershell
npm install -g xlsx
```

### 4. 启动 n8n
```powershell
n8n start
```

### 5. 访问
浏览器打开：`http://localhost:5678`

## 安装方式详解

### 方式1：npx（最快，测试用）
```bash
npx n8n
```

### 方式2：npm 全局安装（推荐）⭐⭐⭐
```bash
npm install -g n8n
n8n start
```

### 方式3：Docker
```bash
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

### 方式4：本地项目
```bash
mkdir n8n-local && cd n8n-local
npm init -y
npm install n8n xlsx
npx n8n
```

## 配置自定义模块

安装xlsx后，在n8n的Code节点中可以直接使用：

```javascript
const XLSX = require('xlsx');
// 现在可以使用xlsx了！
```

## 数据保存位置

- Windows: `C:\Users\<用户名>\.n8n`
- Linux/Mac: `~/.n8n`

## 常见问题

**Q: 如何验证xlsx是否可用？**
在n8n Code节点中运行：
```javascript
try {
  const XLSX = require('xlsx');
  return [{ json: { success: true } }];
} catch (e) {
  return [{ json: { success: false, error: e.message } }];
}
```

**Q: 端口被占用？**
```powershell
$env:N8N_PORT=5679
n8n start
```

**Q: 如何更新？**
```bash
npm update -g n8n
```

**Q: 代理连接错误 `Proxy connection ended before receiving CONNECT response`？**

这是因为环境变量中配置了代理，但代理不支持或有问题。

**解决方案1：临时禁用代理启动n8n**（推荐）
```powershell
# 清除代理环境变量并启动n8n
$env:HTTP_PROXY=""
$env:HTTPS_PROXY=""
$env:NO_PROXY=""
$env:SOCKS_PROXY=""
npx n8n
```

或者如果使用全局安装：
```powershell
$env:HTTP_PROXY=""
$env:HTTPS_PROXY=""
$env:NO_PROXY=""
$env:SOCKS_PROXY=""
n8n start
```

**解决方案2：在n8n中配置不使用代理**
在HTTP Request节点的Options中：
- 勾选 `Bypass Proxy`（如果选项可用）

**解决方案3：修复代理配置**
如果你的代理支持HTTPS，确保代理正常运行。否则使用方案1。

