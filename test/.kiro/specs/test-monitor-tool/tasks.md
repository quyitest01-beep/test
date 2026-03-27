# 实现计划：Test Monitor Tool

## 概述

基于需求文档和技术设计文档，将 Test Monitor Tool 拆分为增量式编码任务。采用 Node.js + TypeScript 技术栈，后端 Express + Socket.IO，前端 React + Vite，数据存储 SQLite。每个任务逐步构建，确保无孤立代码。

## 任务列表

- [x] 1. 项目初始化与基础设施搭建
  - [x] 1.1 初始化项目结构、package.json、tsconfig.json 和 vite.config.ts
    - 创建 `test-monitor-tool/` 项目目录
    - 初始化 `package.json`，添加依赖：express, socket.io, chokidar, better-sqlite3, uuid, octokit
    - 初始化 `tsconfig.json`，配置 TypeScript 编译选项
    - 创建 `vite.config.ts`，配置 React 前端构建
    - 安装开发依赖：vitest, fast-check, msw, @types/*
    - _需求: 8.1_

  - [x] 1.2 创建共享类型定义 `src/server/types/index.ts`
    - 定义 FileChangeEvent、IssueInfo、PublishResult、TestCase、TestStep、TestCaseFilter、TestCaseTree、TestCaseLeaf、TestCaseMetadata 接口
    - 定义 TestRunResult、TestRunSummary、RunningStatus 接口
    - 定义 AppConfig、ValidationResult 接口
    - _需求: 1.3, 2.2, 3.1, 5.3, 6.4, 8.1_

  - [x] 1.3 创建 SQLite 数据库初始化模块 `src/server/db/database.ts` 和 `src/server/db/migrations.ts`
    - 使用 better-sqlite3 创建数据库连接
    - 创建 test_cases、test_runs、issue_comments 三张表
    - 实现数据库初始化和迁移逻辑
    - _需求: 3.3, 5.3_

- [x] 2. 配置管理模块
  - [x] 2.1 实现 ConfigManager 服务 `src/server/services/ConfigManager.ts`
    - 实现 load()、getConfig()、update()、validate()、onConfigChange() 方法
    - 从 config.json 读取配置，支持默认配置回退
    - 配置文件变更时自动重新加载（使用 chokidar 监听）
    - 启动时验证配置完整性和有效性
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 2.2 编写 ConfigManager 属性测试
    - **Property 16: 配置加载与验证**
    - 使用 fast-check 生成随机配置对象，验证 validate 方法正确识别缺失/无效字段
    - 验证有效配置 load 后返回等价的 AppConfig 对象
    - **验证需求: 8.1, 8.3**

  - [ ]* 2.3 编写 ConfigManager 单元测试
    - 测试配置文件缺失时的默认值回退
    - 测试配置热重载功能
    - _需求: 8.2, 8.4_

- [x] 3. 检查点 - 确保基础设施就绪
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 文件监听服务
  - [x] 4.1 实现 MonitorService 服务 `src/server/services/MonitorService.ts`
    - 使用 chokidar 监听 `**/*.spec.ts` 文件的 add 和 change 事件
    - 实现 start()、stop()、onFileChange()、isRunning() 方法
    - 文件变更后读取内容，验证非空且格式合法
    - 启动时验证目标目录存在性，不存在时记录错误日志并通知用户
    - 通过 EventEmitter 模式分发 FileChangeEvent
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 4.2 编写 MonitorService 属性测试
    - **Property 3: 无效文件过滤** - 生成空/空白内容，验证跳过逻辑
    - **Property 4: 不存在的监听目录错误处理** - 生成随机路径，验证错误信息包含目录路径
    - **验证需求: 1.5, 1.6**

  - [ ]* 4.3 编写 MonitorService 单元测试
    - 测试启动/停止生命周期
    - 测试目录不存在时的错误处理
    - _需求: 1.1, 1.4, 1.5_

- [x] 5. Issue 连接器
  - [x] 5.1 实现 IssueConnector 服务 `src/server/services/IssueConnector.ts`
    - 实现 extractIssueLink()：优先匹配 `// @issue: <url>` 注释，其次匹配文件名 `#<number>` 模式
    - 实现 fetchIssueInfo()：通过 Octokit 获取 GitHub Issue 详情（标题、描述、标签）
    - 实现 publishTestCase()：将格式化 Markdown 测试用例以评论形式发布到 Issue
    - 实现 updateTestCaseComment()：更新已有评论
    - 发布失败时重试 3 次，间隔 10 秒
    - 同一 Issue 已有评论时更新而非新建
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 编写 IssueConnector 属性测试
    - **Property 1: Issue 链接提取正确性** - 生成随机文件名和内容，验证提取逻辑
    - **Property 8: Markdown 格式化输出** - 生成随机 TestCase，验证 Markdown 包含标题、步骤和预期结果
    - **Property 9: Issue 评论更新幂等性** - 模拟重复发布，验证评论数量始终为 1
    - **验证需求: 2.1, 2.3, 4.2, 4.5**

  - [ ]* 5.3 编写 IssueConnector 单元测试
    - 使用 msw 模拟 GitHub API 调用成功/失败场景
    - 测试重试逻辑（3 次重试验证）
    - 测试 Issue 信息获取
    - _需求: 2.2, 2.4, 4.3, 4.4_

- [x] 6. 测试用例生成器
  - [x] 6.1 实现 TestCaseGenerator 服务 `src/server/services/TestCaseGenerator.ts`
    - 实现 generate() 方法：整合 spec 文件内容和 Issue 信息生成完整 TestCase
    - 生成包含测试标题、关联 Issue 链接、前置条件、测试步骤和预期结果的 TestCase
    - 保留 Playwright 录制的原始代码作为 automationScript
    - Issue 信息缺失时标记 status 为 `pending_info`，记录 missingFields
    - _需求: 3.1, 3.2, 3.4_

  - [ ]* 6.2 编写 TestCaseGenerator 属性测试
    - **Property 5: 测试用例生成完整性** - 生成随机 spec 内容和 Issue 信息，验证字段完整性
    - **Property 7: 缺失信息标记** - 生成缺少 Issue 信息的场景，验证 status 和 missingFields
    - **验证需求: 3.1, 3.2, 3.4**

  - [ ]* 6.3 编写 TestCaseGenerator 单元测试
    - 测试具体的 spec 文件生成示例
    - _需求: 3.1, 3.2_

- [x] 7. 检查点 - 确保核心服务就绪
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 测试用例管理器
  - [x] 8.1 实现 TestCaseManager 服务 `src/server/services/TestCaseManager.ts`
    - 实现 save()、list()、get()、update()、getMetadata() 方法
    - 按项目和模块层级结构组织测试用例文件
    - 根据 Issue 标签自动归类到对应目录
    - 维护元数据：创建时间、修改时间、关联 Issue、运行状态
    - 目标目录不存在时自动创建
    - 支持按名称、Issue 链接、运行状态筛选
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4_

  - [ ]* 8.2 编写 TestCaseManager 属性测试
    - **Property 6: 测试用例保存与检索往返** - 生成随机 TestCase，验证保存后检索等价
    - **Property 10: 测试用例目录自动归类** - 生成带不同模块标签的 TestCase，验证目录位置
    - **Property 11: 测试用例元数据完整性** - 验证元数据字段非空且正确
    - **Property 12: 列表树结构正确性** - 生成多个 TestCase，验证树结构包含所有用例
    - **Property 15: 搜索筛选正确性** - 生成随机用例和筛选条件，验证结果满足条件
    - **验证需求: 3.3, 5.1, 5.2, 5.3, 5.4, 7.4**

  - [ ]* 8.3 编写 TestCaseManager 单元测试
    - 测试目录自动创建（边界情况）
    - 测试空列表查询
    - _需求: 5.5_

- [x] 9. 测试运行器
  - [x] 9.1 实现 TestRunner 服务 `src/server/services/TestRunner.ts`
    - 实现 runSingle()、runByDirectory()、runAll()、getRunningStatus() 方法
    - 通过 child_process.spawn 调用 `npx playwright test` 执行测试
    - 使用 Playwright JSON reporter 收集结果
    - 失败时收集错误信息、截图和执行日志
    - 通过 Socket.IO 实时推送执行进度
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 9.2 编写 TestRunner 属性测试
    - **Property 13: 测试结果计数不变量** - 生成随机测试结果集，验证 passedCount + failedCount + skippedCount == totalCount
    - **Property 14: 失败测试信息收集** - 生成 failed 状态结果，验证 errorMessage 和 logs 非空
    - **验证需求: 6.4, 6.6**

  - [ ]* 9.3 编写 TestRunner 单元测试
    - 测试三种运行模式的具体示例
    - 测试 Playwright CLI 调用验证
    - _需求: 6.1, 6.2_

- [x] 10. 检查点 - 确保所有后端服务就绪
  - 确保所有测试通过，如有问题请询问用户。

- [x] 11. 核心工作流串联
  - [x] 11.1 实现文件变更到测试用例生成的完整流程 `src/server/services/` 中各服务的串联
    - 在 MonitorService 的 onFileChange 回调中串联 IssueConnector → TestCaseGenerator → TestCaseManager → IssueConnector（发布）
    - 实现完整的数据流：文件变更 → 提取 Issue → 生成用例 → 保存 → 发布到 Issue
    - 处理各环节的错误情况（Issue 不可达时标记待关联，发布失败时标记待发布）
    - _需求: 1.3, 2.1, 2.4, 3.1, 3.3, 4.1, 4.4_

  - [ ]* 11.2 编写 MonitorService 文件变更事件属性测试
    - **Property 2: 文件变更事件数据完整性** - 生成随机文件路径和内容，验证 FileChangeEvent 字段正确
    - **验证需求: 1.3**

- [x] 12. REST API 层
  - [x] 12.1 实现 Express 服务入口 `src/server/index.ts` 和 API 路由
    - 创建 Express 应用和 Socket.IO 服务器
    - 实现 `src/server/api/routes.ts` 注册所有路由
    - _需求: 7.1, 7.2, 7.3_

  - [x] 12.2 实现测试用例相关 API `src/server/api/testCaseRoutes.ts`
    - GET `/api/test-cases` - 获取测试用例列表（支持筛选）
    - GET `/api/test-cases/:id` - 获取测试用例详情
    - PUT `/api/test-cases/:id` - 更新测试用例
    - GET `/api/stats` - 获取统计数据
    - _需求: 5.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 12.3 实现测试运行相关 API `src/server/api/testRunRoutes.ts`
    - POST `/api/test-run/single/:id` - 运行单个测试
    - POST `/api/test-run/directory` - 按目录批量运行
    - POST `/api/test-run/all` - 运行全部测试
    - GET `/api/test-run/status` - 获取当前运行状态
    - GET `/api/test-run/history` - 获取运行历史
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.4 实现配置相关 API `src/server/api/configRoutes.ts`
    - GET `/api/config` - 获取系统配置
    - PUT `/api/config` - 更新系统配置
    - _需求: 7.5, 8.1, 8.2_

  - [x] 12.5 实现 WebSocket 事件推送
    - 实现 `test:progress`、`test:complete`、`file:change`、`testcase:created` 事件
    - 将 TestRunner 和 MonitorService 的事件通过 Socket.IO 推送到前端
    - _需求: 6.3, 6.5_

- [x] 13. 检查点 - 确保后端 API 就绪
  - 确保所有测试通过，如有问题请询问用户。

- [x] 14. Web 前端管理面板
  - [x] 14.1 创建前端入口和应用框架 `src/client/`
    - 创建 `index.html`、`App.tsx`，配置路由
    - 集成 Socket.IO 客户端用于实时通信
    - _需求: 7.1_

  - [x] 14.2 实现测试用例目录树视图 `src/client/components/DirectoryTree.tsx` 和 `src/client/components/TestCaseList.tsx`
    - 展示所有测试用例的层级结构
    - 支持展开/折叠目录
    - _需求: 7.1_

  - [x] 14.3 实现 Dashboard 页面 `src/client/pages/Dashboard.tsx`
    - 展示测试运行结果统计面板（通过率、失败率、最近运行时间）
    - 集成目录树和测试用例列表
    - _需求: 7.1, 7.3_

  - [x] 14.4 实现测试用例详情页面 `src/client/pages/TestCaseDetail.tsx`
    - 展示测试用例完整内容和运行历史
    - _需求: 7.2_

  - [x] 14.5 实现测试运行结果页面 `src/client/pages/TestRunResults.tsx` 和 `src/client/components/RunProgress.tsx`
    - 展示测试结果摘要和每个测试用例的详细运行结果
    - 实时显示测试执行进度和当前运行的测试用例名称
    - 提供"运行"按钮（单个、按目录、全部）
    - _需求: 6.3, 6.5, 7.3_

  - [x] 14.6 实现搜索筛选功能 `src/client/components/SearchBar.tsx`
    - 支持按测试名称、关联 Issue 和运行状态进行筛选
    - _需求: 7.4_

  - [x] 14.7 实现系统配置页面 `src/client/pages/Settings.tsx`
    - 允许用户配置监听目录路径、Issue 管理系统连接信息
    - _需求: 7.5_

- [x] 15. 集成与最终验证
  - [x] 15.1 创建默认配置文件 `config.json` 并串联前后端
    - 创建默认 config.json 配置文件
    - 确保前端通过 Vite 代理正确连接后端 API
    - 确保 MonitorService 在服务启动时自动开始监听
    - _需求: 8.1, 8.4_

  - [ ]* 15.2 编写端到端集成测试
    - 测试完整流程：文件变更 → Issue 关联 → 用例生成 → 保存 → 发布
    - 测试 API 端到端调用
    - _需求: 1.3, 2.1, 3.1, 4.1_

- [x] 16. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
