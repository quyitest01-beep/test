# 自动化测试监控工具

基于 Playwright 录制脚本与 GitHub Issue 管理系统的自动化测试工作监控平台。

## 核心功能

- 监听目录中的 Playwright 测试脚本，自动导入为测试用例
- 关联 GitHub Issue，AI 自动增强测试用例
- 编辑测试步骤/前置条件，AI 重新生成自动化脚本
- 一键运行测试（可视化浏览器操作）
- 实时日志监控 + 步骤截图
- 测试目录管理所有测试用例文件

## 快速开始

```bash
cd test-monitor-tool
npm install
npm run dev:server   # 启动后端
npm run dev:client   # 启动前端（另一个终端）
```

详细说明见 [test-monitor-tool/README.md](test-monitor-tool/README.md)
