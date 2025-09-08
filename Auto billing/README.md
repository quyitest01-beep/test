# Auto Billing 项目

## 🎉 最新进展

### ✅ 已完成功能

1. **主商户PDF子商户明细表（8列）与计算修正**
   - 新增8列子商户明细表：子商户名称、总投注、总派奖、GGR、USD汇率、费率、Charge、备注
   - 修正计算逻辑：Charge = GGR × USD Rate × Fee Rate
   - 修正汇总计算：應付縂金額 = 所有子商户Charge之和，GGR (USDT) = 所有子商户GGR×USD Rate之和

2. **映射以 Lark 子商户为先、去除自映射、A→Z 排序**
   - 修复映射逻辑：优先检查是否为子商户，避免错误自映射
   - 统一排序：Lark消息和PDF文件都按主商户名称A→Z排序
   - 解决EpicWin→slotsapi、Brabet06→Brabet等映射问题

3. **按月精确选择（避免跨月串用）**
   - 所有数据文件严格按 `TARGET_YYYYMM` 筛选
   - 包括：`matched_merchant_excel_data_*.json`、`unified_merchants_*.json`、`master_merchant_report_*.json`
   - 完整流程6/6步骤全部通过验证，发送环节按目标月份选择报告并打印使用文件名

4. **Lark群账单确认与多通道发送**
   - 实现Lark群账单确认流程（点击按钮跳转链接）
   - 支持确认后多通道发送（邮箱/TG群）
   - 使用HMAC签名确保链接安全性，本地批次记录管理

5. **商户邮箱和TG配置信息拉取功能修复**
   - 修复 `step1_fetch_lark_merchants.py` 无法正确读取和保存商户配置信息的问题
   - 成功拉取40个商户信息，11个有邮箱配置，15个有TG Chat ID配置
   - 支持复杂邮箱数据格式解析（从Lark对象中提取text字段）

6. **Lark消息卡片模板格式改造**
   - 将自定义JSON结构改为Lark官方模板格式
   - 使用 `template_id` 和 `template_variable` 结构
   - 修复按钮结构，支持直接链接跳转
   - 添加唯一UUID生成，每次发送消息时生成新的标识符

7. **多通道发送超时机制优化**
   - 邮件发送添加30秒超时机制，避免网络问题导致程序卡住
   - TG发送添加30秒超时机制，提升系统稳定性
   - 使用ThreadPoolExecutor实现跨平台超时控制
   - 优化发送结果展示：仅显示有PDF的商户，忽略无PDF商户

8. **统一配置管理 - 所有配置使用.env文件**
   - 创建统一配置加载器 `config_loader.py`，统一管理所有配置
   - 所有核心组件已更新使用.env文件配置，不再依赖分散的配置文件
   - 提高配置管理的安全性和便利性，敏感信息不会被意外泄露
   - 支持配置验证和状态检查，确保配置完整性

9. **重试工具双向确认机制（完整实现）**
   - ✅ **核心功能完成**：重试工具集成完整的双向确认机制
   - ✅ **用户交互优化**：通过Lark交互式卡片确认或拒绝重试操作
   - ✅ **超时机制**：实现300秒超时机制，避免无限等待
   - ✅ **安全验证**：使用安全的HMAC-SHA256 token验证，确保操作安全性
   - ✅ **状态管理**：完整的批次记录和状态管理，支持操作追踪
   - ✅ **服务集成**：集成confirm_webhook服务处理用户响应
   - ✅ **容错机制**：交互式消息发送失败时自动回退到简单确认机制
   - ✅ **配置修复**：修复token生成格式和配置获取逻辑
   - ✅ **兼容性**：实现group_id和chat_id字段的完全兼容
   - ✅ **测试验证**：所有组件集成测试通过，错误处理机制完善

10. **账单发送结果汇总问题修复**
   - 修复总商户数统计错误（显示13而不是24）
   - 解决重复商户计入总商户数的问题
   - 修复Telegram Token错误（末尾多了一个字母z）
   - 优化发送逻辑：以PDF文件中的商户为准，按商户名A→Z排序

10. **邮件处理超时和最新邮件选择问题修复**
    - 修复邮件处理过程中经常超时卡住的问题
    - 优化邮件选择逻辑：自动选择最新的匹配邮件而不是第一个
    - 简化邮件处理逻辑：只获取主题信息，通过倒序遍历确保选择最新邮件
    - 添加30秒超时保护，提高邮件处理稳定性

11. **PDF 生成器稳定性修复与完整输出（2025-08）**
    - 为 `sub_merchants`、`currencies` 全量增加 None 兜底与类型校验，避免 `'NoneType' object is not iterable`
    - 增加类内 wrapper，修复 `create_merchant_info` 属性缺失导致的 `AttributeError`
    - 成功生成 24/24 主商户 PDF，输出目录 `complete_invoice_pdfs/`，总金额 28,215.95 USDT 与主商户报告一致
    - 验证命令：`python complete_invoice_pdf_generator.py "2025年08月"`

12. **冗余文件清理与代码库优化**
    - 删除功能重复的 `auto_monthly_billing.py`（存在类型转换bug）
    - 删除损坏的 `auto_monthly_billing_downloader.py`（被日志信息污染）

13. **PDF汇总表格宽度优化**
    - 调整應付縂金額(Total Payable)和GGR汇总表格的列宽，使布局更加紧凑
    - 第一次优化：第三列宽度1.8→1.5英寸，第四列宽度1.2→1.0英寸
    - 第二次优化：解决数值超行距问题，重新分配列宽比例
      - 第一列：1.5→1.2英寸，第二列：1.8→1.5英寸
      - 第三列：1.5→1.3英寸，第四列：1.0→1.3英寸
    - 修改位置：第769行、第999行、第1371行的汇总表格设置
    - 数值列宽度增加30%，确保数值完整显示，避免超行距
    - 测试验证：成功生成24个PDF文件，表格布局更加美观紧凑
    - 删除关联的批处理文件：`setup_scheduled_task.bat`、`run_auto_billing.bat`
    - 清理legacy文件和专用日志文件，减少维护成本
    - 统一使用 `python full_billing_pipeline.py auto` 替代旧命令
    - 项目结构更加清晰，代码质量显著提升

13. **Lark消息发送功能修复**
    - 修复账单发送结果汇总消息无法发送到Lark群的问题
    - 解决`confirm_handler.py`中`batch_record`缺少`period`字段的问题
    - 完善`send_results_to_lark`方法中的期间解析逻辑
    - 创建独立测试脚本验证Lark消息发送功能正常
    - 确保管理员能及时收到账单发送结果通知

14. **子商户名称字段映射修复**
    - 修复PDF账单中子商户信息显示错误问题
    - 修复字段映射逻辑：优先使用lark表中的 `merchant_name`（对应 `C_merchant_name`）字段

15. **PDF汇款链接下方添加二维码图片功能**
    - 在PDF页脚的汇款链接下方添加二维码图片显示功能
    - 导入ReportLab的Image组件，支持PNG格式二维码图片
    - 设置合适的图片尺寸（1.5x1.5英寸）和10像素间距
    - 添加完善的异常处理机制，图片不存在时显示占位符文本
    - 测试验证：成功生成25个PDF文件，二维码正确显示在汇款链接下方
    - 提升用户体验：商户可直接扫描二维码进行汇款操作
    - 添加字段优先级：`merchant_name` > `C_merchant_name` > `name` > `Account` > `D_account`
    - 确保子商户名称和数量信息正确显示，提升账单数据准确性
    - 测试验证：成功生成24个PDF文件，子商户信息显示正确

16. **PDF页脚文案内容优化**
    - 优化PDF页脚的文案内容，提供更详细的汇款操作指导
    - 增加汇款方式说明：支持链接或扫码两种汇款方式
    - 添加汇款成功后通知要求：需在TG群或邮件告知公司
    - 保持中英文双语对照格式，提升国际化用户体验
    - 分别显示汇款链接和汇款码标签，布局更加清晰
    - 优化间距设置和视觉效果，确保二维码在文案下方正确显示
    - 测试验证：成功生成25个PDF文件，文案显示完整，布局合理

17. **账单发送失败重试功能** ✅
   - 智能识别发送成功和失败的商户
   - 支持自动、手动和交互式重试模式
   - 精准重试，避免给已成功商户重复发送
   - 完整的重试结果记录和分析
   - 详细的使用指南和故障排除文档
   - 工具文件：`retry_failed_bills.py`
   - 使用指南：`docs/retry_guide.md`

18. **GitHub项目提交准备工作**
   - 完成项目代码的Git版本控制管理和GitHub提交准备
   - 验证本地提交历史，确认所有功能更新已正确记录
   - 配置远程仓库地址，支持SSH和HTTPS两种连接方式
   - 处理.gitignore文件配置，正确忽略生成文件和日志文件
   - 提供详细的手动推送指导和网络连接问题解决方案
   - 完整记录提交内容：二维码功能、文案优化、文档更新
   - 建立规范的版本控制流程，便于后续代码管理和协作开发

19. **账单发送文案中英双语化** ✅
   - 创建统一的双语文案模板系统 `BilingualTemplates` 类
   - 支持邮件、Telegram、Lark三个平台的中英双语文案
   - 邮件功能：内部确认邮件和客户账单邮件双语化
   - Telegram功能：账单通知和发送消息双语化
   - Lark功能：确认消息双语化
   - 统一的模板管理：所有文案模板集中在 `bilingual_templates.py` 文件
   - 完整的测试验证：确保所有模板格式正确，中英文内容完整
   - 提升国际化用户体验：支持中英文用户的使用需求
   - 修改文件：`email_sender.py`、`telegram_sender.py`、`confirm_handler.py`、`lark_confirmation_sender.py`
### 2025-09-03 重大里程碑：PDF模板和检验器优化完成！ 🚀

**🎯 PDF检验器完全修复成功**
- ✅ 所有22个PDF都验证通过，总金额信息检测成功
- ✅ 解决了"未检测到总金额信息"的关键问题
- ✅ PDF生成器和检验器完全兼容，数据质量优秀

**🔧 技术问题修复**
- ✅ 修复了PDF生成器的字段名和数据结构问题
- ✅ 优化了PDF检验器的正则表达式模式匹配
- ✅ 支持主商户数据结构和原始数据结构
- ✅ 解决了None值处理和期间设置问题

**📊 验证结果**
- 总PDF数量：22个 ✅
- 验证通过：22个 ✅
- 验证失败：0个 ✅
- 发现问题：0个 ✅
- 发现警告：26个（主要是建议性警告）

### 2025-09-03 重大里程碑：完整流程执行成功！ 🚀

**🎯 完整自动化流程验证成功**
- ✅ 6步骤自动化流程全部执行成功
- ✅ 从Lark数据拉取到PDF生成再到Lark确认的完整链路已验证
- ✅ 总金额：1,293,871.31 USDT，22个主商户
- ✅ 自动生成22个PDF账单，智能分割为3个ZIP包

**🔧 技术问题修复**
- ✅ 修复环境变量设置问题（TARGET_YYYYMM）
- ✅ 修复商户映射分析的文件依赖问题
- ✅ 验证了完整的自动化处理能力

**📊 执行结果**
- 拉取Lark商户信息：40个商户 ✅
- 处理邮件附件：56个商户数据 ✅
- 商户映射分析：22个主商户 ✅
- 生成PDF账单：22个PDF文件 ✅
- PDF数据检验：发现格式问题，需要优化 ⚠️
- 发送确认消息：成功发送到Lark群 ✅

### 2025-09-03 PDF账单数据检验流程开发完成 ✅

**🔍 新增功能**
- 基础版和增强版PDF检验器
- 智能数据提取和验证
- 数据质量评分系统
- 集成到主流程中自动执行

**📈 检验能力**
- 文件完整性检查
- 数据内容验证
- 源数据一致性对比
- 费率计算准确性验证

### 2025-09-03 项目清理和文件管理优化完成 ✅

**🧹 项目结构优化**
- 清理历史临时文件，项目根目录更加清晰
- 建立文件生命周期管理规范
- 创建archive目录，分类存储历史文件

**📁 文件管理规范**
- 每个类型保留最新的3个文件
- 历史文件有序归档，便于追溯
- 提高项目的可维护性

### 2025-09-03 新增：主商户PDF“子商户明细表（8列）”与计算修正 ✅

**🎯 功能增强**
- 在主商户PDF中新增“子商户明细表（8列）”：
  子商户、币种、总派奖、总下注、GGR、费率、USD汇率、应付金额
- 明细按应付金额（Charge）降序展示

**🧮 计算修正**
- Charge = GGR × USD Rate × Fee Rate%
- 應付縂金額 (USDT) = Σ Charge
- GGR (USDT) = Σ (GGR × USD Rate)

**🔗 映射与排序**
- 映射以 Lark 子商户归属为先，去除自映射干扰（EpicWin、Brabet06 等按归属主商户统计）。
- PDF打包与Lark商户明细统一按主商户名称 A→Z 排序。

**📊 验证结果**
- 22个PDF全部生成成功
- 汇总金额与明细求和一致
- 建议执行 `python enhanced_pdf_validator.py "2025年08月"` 复核

### 2025-08-29 核心功能完善 ✅

1. **✅ 商户映射系统** - 100%映射成功率，支持复杂的主商户-子商户关系
2. **✅ PDF生成器** - 完整版发票风格，支持多商户批量处理
3. **✅ ZIP包优化** - 自动分割大文件集，符合Lark显示要求
4. **✅ 确认流程系统** - Lark集成，支持多ZIP包和确认按钮
5. **✅ 邮件搜索优化** - 精确匹配目标期间，减少历史邮件干扰
6. **✅ 项目清理和文件管理优化** - 项目结构清晰，文件组织有序
7. **✅ 优化的邮件搜索范围** - 精确匹配，减少历史邮件干扰
8. **✅ 项目清理和文件管理优化** - 项目结构清晰，文件组织有序
9. **✅ 新增PDF账单数据检验流程** - 自动验证PDF数据质量
10. **✅ 完整流程验证和执行** - 6步骤自动化流程全部成功

## 🚀 系统能力

**核心功能**:
- 🔄 自动化Lark数据拉取和商户映射
- 📧 智能邮件附件处理和Excel数据提取
- 📄 高质量PDF账单生成（22个商户批量处理）
- 📦 智能ZIP包分割和优化（超过10个PDF自动分割）
- 🔍 自动化PDF数据质量检验
- 📱 完整的Lark集成和确认流程

**技术特色**:
- 🧠 智能商户映射算法（100%成功率）
- 📊 多维度数据验证和质量评分
- 🔧 自动化错误检测和报告生成
- 📈 可扩展的模块化架构

## 技术架构

### 核心组件
- **`config_loader.py`** - 统一配置加载器（从.env文件加载所有配置）
- **`step1_fetch_lark_merchants.py`** - 拉取Lark商户信息（包含邮箱和TG配置）
- **`step2_fetch_mail_attachment.py`** - 处理邮件附件和Excel数据
- **`improved_merchant_mapper.py`** - 商户映射分析
- **`complete_invoice_pdf_generator.py`** - PDF账单生成器（8列子商户明细表）
- **`single_confirmation_sender.py`** - 确认消息发送器（集成ZIP包优化）
- **`lark_confirmation_sender.py`** - Lark消息发送器（模板格式）
- **`confirm_handler.py`** - 确认处理器（多通道发送调度器）
- **`email_sender.py`** - 邮件发送器（支持超时机制）
- **`telegram_sender.py`** - Telegram发送器（支持超时机制）

### 数据流程
1. **拉取Lark商户信息** → 生成 `unified_merchants_*.json`（包含邮箱和TG配置）
2. **处理邮件附件** → 生成 `matched_merchant_excel_data_*.json`
3. **商户映射分析** → 生成 `master_merchant_report_*.json`
4. **生成PDF账单** → 创建 `complete_invoice_pdfs/` 目录（8列子商户明细表）
5. **发送确认消息** → 发送Lark模板卡片，生成批次记录 `records/batch_*.json`
6. **确认处理和多通道发送** → 根据确认结果发送到商户邮箱/TG群
7. **结果汇总** → 将发送结果汇总并发送到Lark群

### 项目结构
```
Auto billing/
├── archive/                    # 历史文件归档目录
│   ├── confirmation_files/     # 历史确认文件
│   └── data_files/            # 历史数据文件
├── complete_invoice_pdfs/      # 生成的PDF账单
├── data/                       # 数据源文件
├── docs/                       # 项目文档
├── logs/                       # 日志文件
├── output/                     # 输出文件
├── records/                    # 记录文件（批次记录、确认状态）
├── .env                        # 🔑 统一配置文件（所有敏感信息）
├── config_loader.py            # 统一配置加载器
├── lark_config.json           # 已废弃（使用.env中的LARK_*配置）
├── email_config.json          # 已废弃（使用.env中的EMAIL_*配置）
├── telegram_config.json       # 已废弃（使用.env中的TELEGRAM_*配置）
└── [核心代码文件]              # Python脚本和配置文件
```

**⚠️ 重要**: `.env` 文件是项目的**核心配置文件**，包含所有敏感信息。请确保：
1. 不要将 `.env` 文件提交到版本控制系统
2. 定期备份 `.env` 文件
3. 在不同环境中使用不同的 `.env` 文件

## 使用方法

### 完整流程
```bash
# 🤖 自动模式：自动获取上个月月份并运行完整流程（步骤1-5）
python full_billing_pipeline.py auto

# 👤 手动模式：指定年份和月份运行完整流程（步骤1-5）
python full_billing_pipeline.py 2025 08

# 步骤6: 确认处理和多通道发送（需要手动触发）
# 在Lark群中点击确认按钮后，运行以下命令：
python confirm_handler.py --apply --url "https://simulate.confirm/bill?bid=20250904_104210&action=confirm&code=8319a71bc4b1616b"
```

### 🤖 自动模式说明
- **自动模式**：`python full_billing_pipeline.py auto`
  - 自动计算并处理上个月份的账单（例如：当前是9月，自动处理8月账单）
  - 无需手动指定年份和月份，系统自动获取
  - 适合定时任务和日常使用

- **手动模式**：`python full_billing_pipeline.py <年份> <月份>`
  - 手动指定要处理的年份和月份
  - 适合处理历史账单或特定月份
  - 示例：`python full_billing_pipeline.py 2025 07`

### 端到端流程说明
1. **自动生成账单** (步骤1-5): 拉取数据 → 生成PDF → 发送确认消息到Lark群
2. **人工确认** (Lark群操作): 在Lark群中点击"确认"或"拒绝"按钮
3. **自动发送账单** (步骤6): 根据确认结果自动发送到商户邮箱/TG群
4. **结果汇总** (自动): 将发送结果汇总并发送到Lark群

### 单独步骤
```bash
# 步骤1: 拉取Lark商户信息（包含邮箱和TG配置）
python step1_fetch_lark_merchants.py

# 步骤2: 处理邮件附件
python step2_fetch_mail_attachment.py

# 步骤3: 商户映射分析
python improved_merchant_mapper.py

# 步骤4: 生成PDF账单（包含8列子商户明细表与修正后的计算）
python complete_invoice_pdf_generator.py 2025年08月

# 步骤5: 发送确认消息（集成ZIP包优化）
python single_confirmation_sender.py 2025 08

# 步骤6: 确认处理和多通道发送

## 自动触发步骤6（回调服务）

为实现“在 Lark 中点击按钮即可自动执行步骤6（确认处理与多通道发送）/拒绝不发送”，项目内置了本地回调服务。

### 1) 启动回调服务

```bash
python confirm_webhook.py --port 8787
```

- 监听地址: `http://127.0.0.1:8787/confirm`
- 请求示例: `/confirm?bid=<批次ID>&action=confirm|reject&code=<签名>`

### 2) 发送带按钮的 Lark 消息

```bash
python lark_confirmation_sender.py "2025年08月"
```

- 消息中的“确认/拒绝”按钮 URL 已指向本地回调：
  - 确认: `http://127.0.0.1:8787/confirm?bid=...&action=confirm&code=...`
  - 拒绝: `http://127.0.0.1:8787/confirm?bid=...&action=reject&code=...`

### 3) 在 Lark 中点击按钮后的行为

- 点击“确认账单”：
  - 触发步骤6，调用 `ConfirmHandler.handle_confirmation(..., apply=True)`
  - 自动执行邮件/TG 发送，完成后回发“发送结果汇总”到 Lark
- 点击“拒绝账单”：
  - 记录批次状态为已拒绝，不执行后续发送
  - 回发“已拒绝账单，本次不发送”

### 4) 安全与部署

- 仍使用 HMAC `code` 校验防伪；批次ID+动作+期间签名验证。
- 若需外网或内网其他机器访问：
  - 将 `lark_confirmation_sender.py` 中的 `http://127.0.0.1:8787` 替换为你的域名或内网地址
  - 确保网络与防火墙放行 8787 端口（或自定义端口）

python confirm_handler.py --apply --url "确认链接"
```

### 📅 按月精确选择（避免跨月串用）
- 步骤2（邮件附件）输出：`matched_merchant_excel_data_{YYYYMM}_{ts}.json`
- 步骤3（映射报告）输入：仅读取 `matched_merchant_excel_data_{YYYYMM}_*.json`；输出：`master_merchant_report_{YYYYMM}_{ts}.json`
- 步骤4（PDF生成）输入：仅加载 `master_merchant_report_{YYYYMM}_*.json`
- 步骤6（发送确认）输入：严格按 `{YYYYMM}` 选择 `master_merchant_report_{YYYYMM}_*.json`，并在日志打印“使用的报告文件名”
- 环境变量：`TARGET_YYYYMM`（以及 `TARGET_YYYY`、`TARGET_MM`）

### 本次月份验证结果
- 2025年07月：21 个商户，总金额 24,145.18 USDT（3 个ZIP包）
- 2025年08月：24 个商户，总金额 28,215.95 USDT（3 个ZIP包）
> 已确认不同月份金额不同，串月问题消除。

## 配置要求

### 🔑 .env文件配置（重要！）

**⚠️ 重要提示**: 本项目已统一使用 `.env` 文件管理所有配置，这是**唯一**的配置文件。所有敏感信息都存储在 `.env` 文件中，确保安全性。

#### 完整的.env文件配置示例
```bash
# Lark API 配置
LARK_APP_ID=your_lark_app_id
LARK_APP_SECRET=your_lark_app_secret
LARK_GROUP_ID=your_lark_group_id

# 邮件发送配置（用于发送账单PDF）
EMAIL_HOST=smtp.larksuite.com
EMAIL_PORT=465
EMAIL_USER=your_email@domain.com
EMAIL_PASSWORD=your_email_password

# 邮件接收配置（用于拉取邮件附件）
EMAIL_SERVER=imap.larksuite.com
EMAIL_PORT=993
EMAIL_USERNAME=your_email@domain.com
EMAIL_PASSWORD=your_email_password
EMAIL_FOLDER=INBOX

# Lark表格配置
LARK_SPREADSHEET_TOKEN=your_spreadsheet_token
LARK_SHEET_ID=your_sheet_id
LARK_SPREADSHEET_TOKEN2=your_spreadsheet_token2
LARK_SHEET_ID2=your_sheet_id2

# Telegram Bot配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Lark群配置
chat_id=your_lark_chat_id

# 目标月份配置
TARGET_YYYYMM=202508
```

#### .env文件的重要性
1. **安全性**: 所有敏感信息（密码、API密钥）都存储在.env文件中
2. **统一管理**: 所有配置都在一个文件中，便于维护
3. **版本控制**: .env文件被git忽略，不会意外提交敏感信息
4. **环境隔离**: 不同环境可以使用不同的.env文件

**🔒 安全提醒**: 
- 请将上述示例中的 `your_*` 占位符替换为您的真实配置信息
- 绝对不要将包含真实敏感信息的.env文件提交到版本控制系统
- 建议定期更换密码和API密钥

#### 配置验证
系统提供配置验证功能，可以检查配置完整性：
```python
from config_loader import get_config

config = get_config()
config.print_config_status()  # 显示配置状态
validation = config.validate_config()  # 验证配置完整性
```

### 旧配置文件（已废弃）
以下配置文件已不再使用，但为了向后兼容仍然保留：
- **`lark_config.json`** - 已废弃，使用.env中的LARK_*配置
- **`email_config.json`** - 已废弃，使用.env中的EMAIL_*配置
- **`telegram_config.json`** - 已废弃，使用.env中的TELEGRAM_*配置

## 多通道发送功能

### 功能概述
系统支持将账单通过多种渠道发送给商户：
- **邮件发送**: 发送PDF账单到商户对账邮箱
- **Telegram发送**: 发送PDF账单到商户TG群
- **超时保护**: 每个发送任务都有30秒超时机制
- **结果汇总**: 自动将发送结果汇总并发送到Lark群

### 使用流程
1. **生成账单**: 运行完整流程生成PDF账单
2. **发送确认**: 系统自动发送确认消息到Lark群
3. **人工确认**: 在Lark群中点击"确认"按钮
4. **自动发送**: 系统根据确认结果自动发送到商户
5. **结果汇总**: 发送结果自动汇总到Lark群

### 确认处理器使用
```bash
# 确认账单并发送
python confirm_handler.py --apply --url "确认链接"

# 拒绝账单
python confirm_handler.py --apply --url "拒绝链接"
```

### 发送结果格式
```
账单发送结果汇总 - 2025年07月

**发送统计**:
- 总商户数: 8
- 发送成功: 6
- 发送失败: 2

**详细结果**:
**AAFUN**: ✅ email: poon@gaming-panda.com - 发送成功
**Betfarms**: ✅ email: poon@gaming-panda.com - 发送成功
**Game Plus**: ❌ telegram: Chat ID: -4958072703 - TG发送失败
```

### 超时机制
- **邮件发送**: 30秒超时，防止SMTP连接卡住
- **TG发送**: 30秒超时，防止API请求卡住
- **错误处理**: 超时自动标记为失败，不影响其他发送任务

## 故障排除指南

### 常见问题

#### 1. 邮件发送失败
**症状**: 邮件发送超时或连接失败
**解决方案**:
- 检查 `.env` 文件中的邮件配置
- 确认SMTP服务器地址和端口正确
- 检查邮箱密码和权限设置

#### 2. TG发送失败
**症状**: TG发送超时或API错误
**解决方案**:
- 检查 `.env` 文件中的 `TELEGRAM_BOT_TOKEN`
- 确认Bot有发送消息的权限
- 检查Chat ID是否正确

#### 3. 确认处理器无响应
**症状**: 点击确认按钮后没有反应
**解决方案**:
- 检查批次记录文件是否存在 `records/batch_*.json`
- 确认Token验证是否通过
- 检查Lark配置是否正确

#### 4. PDF文件未找到
**症状**: 显示"未找到对应PDF文件"
**解决方案**:
- 确认PDF文件已生成在 `complete_invoice_pdfs/` 目录
- 检查文件名格式是否正确
- 确认商户ID匹配逻辑

### 调试命令
```bash
# 检查PDF文件
dir complete_invoice_pdfs\*.pdf

# 检查批次记录
dir records\batch_*.json

# 检查商户配置
python step1_fetch_lark_merchants.py

# 测试邮件发送
python -c "from email_sender import EmailSender; print('邮件配置正常')"

# 测试TG发送
python -c "from telegram_sender import TelegramSender; print('TG配置正常')"
```

## 问题跟踪

### ✅ 已解决的问题

**1. 商户映射成功率低** ✅
- **问题**: 初始映射成功率仅44.6%
- **解决**: 修复了数据结构问题，现在100%成功率
- **结果**: 所有56个商户都正确映射

**2. SLOTIFY7商户映射失败** ✅
- **问题**: SLOTIFY7商户无法映射到A99AU主商户
- **解决**: 线上Lark表数据已更新
- **结果**: 映射成功率100.0%

**3. ZIP文件内容显示问题** ✅
- **问题**: 用户反馈ZIP文件里只有15个PDF
- **解决**: 系统功能正常，问题在用户端查看工具
- **结果**: 建议重新下载或使用专业ZIP工具

**4. ZIP包优化后只发送主包** ✅
- **问题**: Lark只收到一个包含10个PDF的ZIP包
- **解决**: 完善了ZIP包发送逻辑，支持发送所有分割包
- **结果**: 现在Lark会收到3个ZIP包，用户可以看到全部22个PDF

**5. 商户明细显示不完整** ✅
- **问题**: 商户明细只显示前15个商户
- **解决**: 移除了商户数量显示限制
- **结果**: 现在显示全部22个商户，完整无遗漏

**6. 邮件搜索范围过宽** ✅
- **问题**: 搜索范围从"当月1号到下月8号"，时间跨度约38天
- **解决**: 修改搜索范围为"下月1号到当天"，时间跨度约3天
- **结果**: 搜索范围更加精确，减少历史邮件干扰

**7. 项目文件管理混乱** ✅
- **问题**: 项目根目录存在大量临时文件，影响代码管理
- **解决**: 建立了完整的文件管理规范，清理了47个历史文件
- **结果**: 项目结构清晰，文件组织有序，便于维护

### 🔍 当前状态
**所有核心问题已解决！项目结构已优化，系统运行稳定，功能完整。**

## 性能指标

### 商户映射
- **成功率**: 100.0% (56/56)
- **主商户数量**: 40个
- **子商户数量**: 56个
- **总金额**: $1,291,997.25 USDT

### ZIP包优化
- **PDF数量**: 22个
- **自动分割**: 3个包（10+10+2）
- **每个包大小**: ≤10个PDF
- **Lark兼容性**: 100%

### 邮件处理
- **搜索范围**: 下月1号到当天
- **时间跨度**: 约3天
- **匹配精度**: 高
- **历史干扰**: 低

### 项目结构
- **根目录文件**: 已优化到合理数量
- **历史文件**: 47个文件已归档到archive目录
- **文件管理**: 建立了完整的规范文档
- **维护性**: 显著提高

## 文件管理

### 文件保留策略
- **核心代码文件**: 永久保留
- **数据文件**: 保留最新3个版本
- **确认文件**: 保留最新3个版本
- **历史文件**: 归档到archive目录

### 清理规范
- **自动清理**: 超过3个版本时自动归档
- **手动清理**: 每周检查并清理过期文件
- **文档记录**: 所有清理操作记录在worklog.md中

详细规范请参考：[FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md)

## 最新修复 - 发送失败问题解决

### 🔧 问题修复 (2025-09-04 14:57)

**修复内容**：
- ✅ **邮件发送失败**：修复环境变量名不匹配问题
- ✅ **Telegram发送失败**：修复返回状态检查逻辑
- ✅ **商户配置处理**：正确处理无配置和有配置商户
- ✅ **监听器调用**：修复构造函数调用方式

**技术改进**：
- 统一配置管理，确保所有发送器使用正确的环境变量
- 增强错误处理和重试机制
- 完善状态检查和日志记录

**影响范围**：
- 所有发送流程现在都能正常工作
- 无配置商户正确显示"无相应配置"
- 有配置商户正常发送邮件和Telegram通知
- 完整流程集成所有修复

**测试验证**：
- 邮件发送：✅ 完全成功
- Telegram发送：✅ 完全成功
- 商户配置：✅ 正确处理

### 📧 邮件格式优化 (2025-09-04 15:15)

**修复内容**：
- ✅ **PDF附件格式**：修复MIME类型设置，邮件客户端正确识别
- ✅ **邮件文案**：优化为专业HTML格式，提升视觉效果
- ✅ **用户体验**：添加详细账单信息和联系方式

**技术改进**：
- 根据文件扩展名自动设置正确的MIME类型
- 专业的HTML邮件模板设计
- 响应式布局，适配不同邮件客户端
- 统一的品牌视觉风格

**影响范围**：
- 所有邮件发送使用正确的PDF MIME类型
- 邮件文案更加专业和用户友好
- 提升了品牌形象和用户体验

### 📧 邮件最终修复 (2025-09-04 15:19)

**修复内容**：
- ✅ **PDF附件格式**：使用MIMEApplication正确处理PDF文件
- ✅ **邮件文案**：删除联系方式部分，保持简洁专业
- ✅ **用户体验**：突出核心账单信息

**技术改进**：
- 使用 `MIMEApplication(file_data, _subtype='pdf')` 处理PDF附件
- 删除联系方式部分，简化邮件内容
- 保持专业的HTML格式和样式

**影响范围**：
- 所有邮件发送使用正确的PDF MIME类型
- 邮件文案更加简洁专业
- 提升了用户体验

### 📧 邮件附件格式最终修复 (2025-09-04 15:21)

**修复内容**：
- ✅ **文件名编码**：修复中文文件名编码问题，正确显示文件名
- ✅ **MIME类型**：优化PDF附件MIME类型设置
- ✅ **兼容性**：同时支持UTF-8和ASCII文件名编码

**技术改进**：
- 使用 `urllib.parse.quote(filename.encode('utf-8'))` 编码中文文件名
- 添加 `filename*=UTF-8''{encoded_filename}` 编码头
- 保留ASCII备用文件名确保兼容性
- 使用 `MIMEApplication(file_data, _subtype='pdf')` 处理PDF

**影响范围**：
- 所有邮件发送正确显示中文文件名
- PDF附件格式完全正确
- 邮件客户端可以正确预览和下载附件

### 📧 PDF MIME类型最终修复 (2025-09-04 15:27)

**修复内容**：
- ✅ **MIME类型设置**：显式添加Content-Type: application/pdf头
- ✅ **文件类型识别**：确保邮件客户端正确识别PDF文件
- ✅ **兼容性**：支持各种邮件客户端

**技术改进**：
- 使用 `MIMEApplication(file_data, _subtype='pdf')` 处理PDF
- 显式添加 `Content-Type: application/pdf` 头
- 完整的PDF处理：MIMEApplication + Content-Type + 文件名编码
- 确保各种邮件客户端正确识别PDF文件

**影响范围**：
- 所有邮件发送正确识别PDF文件类型
- 邮件客户端可以正确预览和下载PDF附件
- 文件名正确显示，支持中文字符

## 下一步计划

### 🎯 近期目标
1. **部署和上线准备** - 生产环境配置和测试
2. **用户培训** - 系统使用方法和最佳实践
3. **文档完善** - 详细的操作手册和故障排除指南

### 🚀 长期规划
1. **性能优化** - 处理更大规模的账单数据
2. **功能扩展** - 支持更多类型的账单和报表
3. **监控和告警** - 系统运行状态监控
4. **自动化维护** - 文件清理和维护自动化

## 贡献者
- 开发团队
- 测试团队
- 业务团队

---

*最后更新：2025-09-04 21:57*
*项目状态：核心功能开发完成，已集成8列明细与正确计算，统一配置管理完成，发送失败问题已修复，邮件格式和文案已优化，PDF附件格式已修复，中文文件名编码已修复，PDF MIME类型已修复，Lark消息发送功能已修复，准备部署上线*

## ⚠️ 重要：使用前预防措施

**在执行自动模式前，请务必按以下步骤检查系统状态，避免多进程冲突导致Lark汇总消息缺失：**

### 1. 检查残留的Python进程
```bash
# 查看当前运行的Python进程
tasklist | findstr python
```
**说明**：检查是否有之前未正常关闭的 `confirm_webhook.py` 进程在后台运行

### 2. 清理残留进程（如果发现多个Python进程）
```bash
# 强制终止所有Python进程
taskkill /f /im python.exe
taskkill /f /im python3.exe
taskkill /f /im python3.13.exe
```
**说明**：清理可能导致端口冲突的残留进程

### 3. 验证8787端口状态
```bash
# 检查8787端口占用情况
netstat -an | findstr 8787
```
**正常状态**：应该没有任何输出，或者只有1个 `LISTENING` 状态
**异常状态**：如果看到多个 `LISTENING` 或 `ESTABLISHED` 连接，请等待30秒后重新检查

### 4. 确认服务状态
```bash
# 再次确认没有Python进程运行
tasklist | findstr python
```
**正常状态**：应该没有任何输出

### 5. 快速检查脚本（可选）
创建一个 `check_system.bat` 文件，包含以下内容：
```batch
@echo off
echo 正在检查系统状态...
echo.
echo 1. 检查Python进程：
tasklist | findstr python
echo.
echo 2. 检查8787端口：
netstat -an | findstr 8787
echo.
echo 检查完成。如果上述命令有输出，请先清理进程再运行自动模式。
pause
```
**说明**：双击运行此脚本可快速检查系统状态


### 异常状态处理建议
- **如果发现多个Python进程**：执行步骤2清理进程
- **如果8787端口被占用**：等待30秒让系统释放端口，或重启命令行窗口
- **如果问题持续存在**：重启计算机以完全清理系统状态

---

## 使用方法

### 自动模式和手动模式

python full_billing_pipeline.py auto

python full_billing_pipeline.py 2025 08

# 步骤6: 确认处理和多通道发送（需要手动触发）
# 在Lark群中点击确认按钮后，运行以下命令：
python confirm_handler.py --apply --url "https://simulate.confirm/bill?bid=20250904_104210&action=confirm&code=8319a71bc4b1616b"