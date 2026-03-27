# Test Monitor Tool

自动化测试工作监控工具 — 衔接 Playwright 录制测试脚本与 Issue 管理系统。

## 功能

- 监听目录中的 Playwright 测试脚本，自动导入为测试用例
- 关联 GitHub Issue，AI 自动增强测试用例（补充断言、等待逻辑、步骤注释）
- 在页面上编辑测试步骤/前置条件，AI 重新生成自动化脚本
- 一键运行测试（headed 模式，可视化浏览器操作）
- 实时显示测试状态和步骤日志（Socket.IO）
- 运行历史记录、截图、错误信息展示
- 手动编辑自动化脚本并同步回源文件

## 技术栈

- 后端：Express + Socket.IO + better-sqlite3 + tsx
- 前端：React + Vite + React Router
- 测试执行：Playwright（headed, chromium, single worker）
- AI：OpenAI 兼容 API

## 快速开始

```bash
cd test-monitor-tool
npm install

# 启动后端
npm run dev:server

# 启动前端（另一个终端）
npm run dev:client
```

前端访问 http://localhost:4000，后端 API 端口见 `config.json` 中的 `serverPort`。

## 配置

编辑 `config.json`：

| 字段 | 说明 |
|------|------|
| watchDir | 监听的测试脚本目录 |
| serverPort | 后端端口 |
| issueRepo | GitHub 仓库（owner/repo） |
| issueApiToken | GitHub Token |
| aiApiKey | AI API Key |
| aiModel | AI 模型名称 |
| aiBaseUrl | AI API 地址 |
