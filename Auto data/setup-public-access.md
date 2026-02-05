# 设置公网访问 - 快速指南

## 当前状态
- ✅ 后端服务运行在 http://localhost:8000
- ✅ PDF服务运行在 http://localhost:8787  
- ✅ Lark下载功能已实现
- ❌ 需要公网访问让外部用户下载文件

## 快速设置方案

### 方案1：Cloudflare Tunnel（免费，推荐）

1. **下载cloudflared**
```bash
# 手动下载
# 访问：https://github.com/cloudflare/cloudflared/releases/latest
# 下载：cloudflared-windows-amd64.exe
# 重命名为：cloudflared.exe
# 放到当前目录
```

2. **启动隧道**
```bash
.\cloudflared.exe tunnel --url http://localhost:8000
```

3. **复制公网URL**
- 终端会显示类似：`https://abc-def-ghi.trycloudflare.com`
- 复制这个URL

### 方案2：ngrok（需要注册）

1. **下载ngrok**
```bash
# 访问：https://ngrok.com/download
# 下载Windows版本
# 注册账号获取authtoken
```

2. **配置和启动**
```bash
ngrok authtoken YOUR_AUTHTOKEN
ngrok http 8000
```

3. **复制公网URL**
- 复制显示的 `https://xxx.ngrok.io` URL

## 配置n8n工作流

获得公网URL后，在n8n Code节点中修改：

```javascript
// 将这行
let publicBaseUrl = 'https://your-ngrok-url.ngrok.io';

// 改为实际URL，例如：
let publicBaseUrl = 'https://abc-def-ghi.trycloudflare.com';
```

## 测试公网访问

1. **测试后端健康检查**
```
https://your-public-url/api/health
```

2. **测试文件下载**
```
https://your-public-url/lark-download/file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu?filename=测试报告
```

## 完整工作流程

1. 启动后端服务（已完成）
2. 启动公网隧道
3. 更新n8n配置中的公网URL
4. 运行n8n工作流
5. 检查Lark群中的消息和下载链接

## 当前可用的测试数据

基于你提供的上游数据，可以测试以下file_key：
- `file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu`
- `file_v3_00uj_5dd0567b-378e-4313-aac3-2405d1194fhu`

## 下一步

1. 选择并设置公网访问方案
2. 获取公网URL
3. 更新n8n配置
4. 测试完整流程

需要我帮你设置哪个方案？