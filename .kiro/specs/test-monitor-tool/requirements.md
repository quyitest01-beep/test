# 需求文档

## 简介

自动化测试工作监控工具后台（Test Monitor Tool），用于衔接 VS Code Playwright 插件录制的测试脚本与项目 Issue 管理系统。该工具监听 Playwright 录制生成的 `.spec.ts` 文件，自动关联对应的 Issue 链接，生成完整的测试用例，并将整理好的测试用例发布到对应的 Issue 中。同时提供测试用例目录管理和一键运行测试的 Web 页面。

## 术语表

- **Monitor_Service**：文件监听服务，负责监听指定目录下 Playwright 录制生成的 `.spec.ts` 文件变更
- **Test_Case_Generator**：测试用例生成器，负责将录制的原始脚本与 Issue 信息整合为完整的测试用例
- **Issue_Connector**：Issue 连接器，负责与外部 Issue 管理系统（如 GitHub Issues、Jira 等）进行通信
- **Test_Case_Manager**：测试用例管理器，负责测试用例的目录组织、分类和元数据维护
- **Test_Runner**：测试运行器，负责执行测试用例并收集运行结果
- **Web_Dashboard**：Web 管理面板，提供测试用例浏览、管理和一键运行的用户界面
- **spec_file**：Playwright 录制生成的 `.spec.ts` 测试脚本文件
- **test_case**：经过整理和关联 Issue 后的完整测试用例
- **issue_link**：外部 Issue 管理系统中的 Issue 链接地址

## 需求

### 需求 1：文件监听与检测

**用户故事：** 作为测试工程师，我希望系统能自动监听 Playwright 录制生成的测试脚本文件，以便我不需要手动触发后续流程。

#### 验收标准

1. WHEN Monitor_Service 启动时, THE Monitor_Service SHALL 开始监听用户配置的目标目录下所有 `.spec.ts` 文件的新增和修改事件
2. WHEN 一个新的 spec_file 被创建或修改时, THE Monitor_Service SHALL 在 5 秒内检测到该文件变更
3. WHEN Monitor_Service 检测到文件变更时, THE Monitor_Service SHALL 提取文件名、文件路径和文件内容，并触发测试用例生成流程
4. WHILE Monitor_Service 处于运行状态, THE Monitor_Service SHALL 持续监听目标目录，不遗漏任何文件变更事件
5. IF Monitor_Service 监听的目标目录不存在, THEN THE Monitor_Service SHALL 记录错误日志并以明确的错误信息通知用户
6. IF spec_file 内容为空或格式不合法, THEN THE Monitor_Service SHALL 跳过该文件并记录警告日志

### 需求 2：Issue 关联与获取

**用户故事：** 作为测试工程师，我希望系统能自动获取与测试脚本对应的 Issue 链接和需求信息，以便生成包含完整上下文的测试用例。

#### 验收标准

1. WHEN Monitor_Service 检测到新的 spec_file 时, THE Issue_Connector SHALL 根据文件名或文件内注释中的标识提取对应的 issue_link
2. WHEN issue_link 被提取成功时, THE Issue_Connector SHALL 从 Issue 管理系统获取 Issue 的标题、描述和标签信息
3. IF issue_link 无法从 spec_file 中提取, THEN THE Issue_Connector SHALL 提示用户手动输入或选择关联的 Issue
4. IF Issue 管理系统不可达或返回错误, THEN THE Issue_Connector SHALL 记录错误日志并将该任务标记为"待关联"状态
5. THE Issue_Connector SHALL 支持至少一种 Issue 管理系统的 API 集成（如 GitHub Issues 或 Jira）

### 需求 3：测试用例生成

**用户故事：** 作为测试工程师，我希望系统能将录制的脚本和 Issue 需求信息整合为完整的测试用例，以便测试用例具有清晰的结构和可追溯性。

#### 验收标准

1. WHEN spec_file 和对应的 Issue 信息均已获取时, THE Test_Case_Generator SHALL 生成包含以下内容的 test_case：测试标题、关联 Issue 链接、前置条件、测试步骤和预期结果
2. THE Test_Case_Generator SHALL 保留 Playwright 录制的原始测试代码作为 test_case 的自动化脚本部分
3. WHEN test_case 生成完成时, THE Test_Case_Generator SHALL 将 test_case 保存到 Test_Case_Manager 管理的目录结构中
4. IF 生成 test_case 过程中缺少必要信息, THEN THE Test_Case_Generator SHALL 生成包含已有信息的 test_case 并标记缺失字段为"待补充"

### 需求 4：测试用例发布到 Issue

**用户故事：** 作为测试工程师，我希望整理好的测试用例能自动发布到对应的 Issue 中，以便团队成员在 Issue 中直接查看测试覆盖情况。

#### 验收标准

1. WHEN test_case 生成完成且关联了有效的 issue_link 时, THE Issue_Connector SHALL 将格式化后的 test_case 内容以评论形式发布到对应的 Issue 中
2. THE Issue_Connector SHALL 使用 Markdown 格式发布 test_case，包含测试标题、测试步骤和预期结果
3. IF 发布到 Issue 失败, THEN THE Issue_Connector SHALL 重试最多 3 次，每次间隔 10 秒
4. IF 重试 3 次后仍然失败, THEN THE Issue_Connector SHALL 将该 test_case 标记为"待发布"状态并记录错误日志
5. WHEN 同一 Issue 已存在之前发布的 test_case 时, THE Issue_Connector SHALL 更新已有评论而非创建新评论

### 需求 5：测试用例目录管理

**用户故事：** 作为测试工程师，我希望系统能有序地管理测试用例目录，以便我能快速找到和组织测试用例。

#### 验收标准

1. THE Test_Case_Manager SHALL 按照项目和模块的层级结构组织 test_case 文件
2. WHEN 新的 test_case 被保存时, THE Test_Case_Manager SHALL 根据关联 Issue 的标签或模块信息自动归类到对应目录
3. THE Test_Case_Manager SHALL 为每个 test_case 维护元数据，包括：创建时间、最后修改时间、关联 Issue 链接、运行状态
4. WHEN 用户通过 Web_Dashboard 请求测试用例列表时, THE Test_Case_Manager SHALL 返回按目录结构组织的 test_case 列表及其元数据
5. IF 目标目录不存在, THEN THE Test_Case_Manager SHALL 自动创建所需的目录结构

### 需求 6：一键运行测试

**用户故事：** 作为测试工程师，我希望能通过 Web 页面一键运行测试用例，以便我无需切换到命令行即可执行测试。

#### 验收标准

1. WHEN 用户在 Web_Dashboard 上点击"运行"按钮时, THE Test_Runner SHALL 使用 Playwright 执行选中的 test_case
2. THE Test_Runner SHALL 支持运行单个 test_case、按目录批量运行和运行全部 test_case 三种模式
3. WHILE Test_Runner 正在执行测试时, THE Web_Dashboard SHALL 实时显示测试执行进度和当前运行的 test_case 名称
4. WHEN 测试执行完成时, THE Test_Runner SHALL 返回测试结果，包括：通过数量、失败数量、跳过数量和执行耗时
5. WHEN 测试执行完成时, THE Web_Dashboard SHALL 展示测试结果摘要和每个 test_case 的详细运行结果
6. IF test_case 执行失败, THEN THE Test_Runner SHALL 收集错误信息、失败截图和执行日志

### 需求 7：Web 管理面板

**用户故事：** 作为测试工程师，我希望有一个直观的 Web 管理面板，以便我能集中管理和查看所有测试相关信息。

#### 验收标准

1. THE Web_Dashboard SHALL 提供测试用例目录树视图，展示所有 test_case 的层级结构
2. THE Web_Dashboard SHALL 提供 test_case 详情页面，展示测试用例的完整内容和运行历史
3. THE Web_Dashboard SHALL 提供测试运行结果的统计面板，包括通过率、失败率和最近运行时间
4. WHEN 用户在 Web_Dashboard 上搜索时, THE Web_Dashboard SHALL 支持按测试名称、关联 Issue 和运行状态进行筛选
5. THE Web_Dashboard SHALL 提供系统配置页面，允许用户配置监听目录路径、Issue 管理系统连接信息和通知设置

### 需求 8：系统配置管理

**用户故事：** 作为测试工程师，我希望能灵活配置系统参数，以便工具能适配不同的项目环境。

#### 验收标准

1. THE Monitor_Service SHALL 从配置文件中读取监听目录路径、Issue 管理系统类型和 API 凭证等参数
2. WHEN 配置文件被修改时, THE Monitor_Service SHALL 在不重启服务的情况下重新加载配置
3. THE Monitor_Service SHALL 在启动时验证配置文件的完整性和有效性
4. IF 配置文件缺失或格式错误, THEN THE Monitor_Service SHALL 使用默认配置启动并记录警告日志
