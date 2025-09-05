# Auto Billing 项目文件清理和归档方案

## 📋 分析概述

基于对项目结构的深入分析，制定以下安全的文件清理和归档方案，确保不影响 `full_billing_pipeline.py` 的完整流程。

## 🔍 核心功能文件（绝对保留）

### 主流程文件
- `full_billing_pipeline.py` - 主自动化流程
- `step1_fetch_lark_merchants.py` - 步骤1：拉取Lark商户信息
- `step2_fetch_mail_attachment.py` - 步骤2：处理邮件附件
- `improved_merchant_mapper.py` - 步骤3：商户映射分析
- `complete_invoice_pdf_generator.py` - 步骤4：生成PDF账单
- `enhanced_pdf_validator.py` - 步骤5：PDF数据检验
- `single_confirmation_sender.py` - 步骤6：发送确认消息
- `confirm_webhook.py` - 步骤7：启动回调服务

### 核心支持文件
- `config_loader.py` - 统一配置加载器
- `confirm_handler.py` - 确认处理器
- `lark_client.py` - Lark客户端
- `lark_confirmation_sender.py` - Lark确认发送器
- `telegram_sender.py` - Telegram发送器
- `email_sender.py` - 邮件发送器
- `unified_billing_controller.py` - 统一计费控制器
- `unified_merchant_manager.py` - 统一商户管理器
- `create_merchant_summary.py` - 商户摘要生成器
- `update_merchant_mappings.py` - 更新商户映射

### 配置和文档文件
- `.env` - 环境配置文件
- `README.md` - 项目说明文档
- `task.md` - 任务清单
- `worklog.md` - 工作日志
- `.gitignore` - Git忽略文件

## 🗂️ 需要清理的文件分类

### 1. 历史数据文件（移动到 archive/data_files/）

#### 确认文件（根目录 → archive/confirmation_files/）
```
confirmation_202508_*.json (8个文件)
- confirmation_202508_114542.json
- confirmation_202508_123234.json
- confirmation_202508_123559.json
- confirmation_202508_123921.json
- confirmation_202508_124346.json
- confirmation_202508_124811.json
- confirmation_202508_125605.json
- confirmation_202508_131304.json
```

#### 商户数据文件（根目录 → archive/data_files/）
```
unified_merchants_*.json (13个文件)
- unified_merchants_20250905_*.json (所有时间戳版本)

matched_merchant_excel_data_*.json (12个文件)
- matched_merchant_excel_data_202508_*.json (所有时间戳版本)

master_merchant_report_*.json (11个文件)
- master_merchant_report_202508_*.json (所有时间戳版本)
```

#### PDF验证报告（根目录 → archive/data_files/）
```
enhanced_pdf_validation_report_*.json (8个文件)
- enhanced_pdf_validation_report_2025年08月_*.json (所有时间戳版本)
```

#### 其他历史数据文件
```
- corrected_billing_lark_*.json (2个文件)
- data_analysis_results.json
- multi_currency_billing_data.json
- workflow_status_202508.json
- 完整流程检查报告.json
```

### 2. 过时脚本文件（移动到 archive/deprecated_scripts/）

#### 旧版自动化脚本
```
- auto_monthly_billing.py (存在bug的旧版本)
- auto_monthly_billing_downloader.py (已损坏)
- run_auto_billing.bat (关联批处理文件)
- setup_scheduled_task.bat (关联批处理文件)
```

#### 旧版组件脚本
```
- bill_calculator.py (旧版账单计算器)
- customer_manager.py (客户管理器)
- rate_manager.py (费率管理器)
- pdf_style_config.py (PDF样式配置)
- email_attachment_parser.py (邮件附件解析器)
```

#### 旧版监听和服务脚本
```
- telegram_bot_listener.py (Telegram机器人监听器)
- smart_listener.py (智能监听器)
- start_listener.py (启动监听器)
- start_server.py (启动服务器)
- web_confirmation.py (Web确认)
- telegram_confirmation.py (Telegram确认)
- dual_confirmation_system.py (双重确认系统)
```

#### 其他过时脚本
```
- dynamic_email_downloader.py
- email_attachment_downloader.py
- split_zip_packager.py
- send_all_pdfs_to_telegram.py
- send_batch_zip.py
- install_telegram_service.py
- get_chat_id.py
```

### 3. 临时和测试文件（移动到 archive/temp_files/）

#### 临时数据文件
```
- table1_merchant_data.json
- table2_fee_data.json
- sample_rate_data.json
- internal_confirmation_config.json
- unified_merchant_table.json
- main_merchant_bills_summary.json
- correct_unified_merchants.json
```

#### 批处理和启动脚本
```
- start_telegram_listener.bat
- start_telegram_listener.ps1
```

#### 运行脚本
```
- run_billing_step2.py
- run_billing_step3.py
```

### 4. 工具和检查脚本（移动到 archive/utility_scripts/）

```
- check_config.py
- check_status.py
- setup_email_config.py
- update_fee_rates.py
- update_with_lark_data.py
- real_lark_data_fetcher.py
- create_real_billing_data.py
- send_actual_bills.py
- send_real_confirmation.py
- direct_confirm.py
- lark_update_needed.py
- unified_merchant_table_manager.py
```

## 🛡️ 安全清理策略

### 1. 分阶段执行
1. **第一阶段**：移动明确的历史数据文件
2. **第二阶段**：移动过时脚本文件
3. **第三阶段**：移动临时和工具文件
4. **第四阶段**：验证核心功能完整性

### 2. 备份策略
- 在移动文件前创建完整备份
- 保留最近3个版本的重要数据文件
- 确保archive目录结构清晰

### 3. 验证机制
- 每个阶段后运行 `python full_billing_pipeline.py --help` 验证
- 检查核心依赖文件是否完整
- 测试关键功能模块导入

## 📊 预期清理效果

### 文件数量减少
- **当前根目录文件数**：约120个文件
- **清理后根目录文件数**：约25个核心文件
- **清理比例**：约80%的文件将被归档

### 项目结构优化
- 根目录只保留核心功能文件
- 历史数据按时间和类型归档
- 过时脚本集中管理
- 提高项目可维护性

## ⚠️ 注意事项

1. **绝对不移动的文件**：
   - `full_billing_pipeline.py` 及其直接依赖
   - `.env` 配置文件
   - 核心文档文件

2. **移动前检查**：
   - 确认文件不被核心流程引用
   - 检查import依赖关系
   - 验证配置文件引用

3. **回滚准备**：
   - 保留移动操作日志
   - 准备快速恢复脚本
   - 建立文件位置映射表

## 🎯 执行计划

1. **创建备份**：完整项目备份
2. **执行清理**：按阶段移动文件
3. **功能验证**：测试核心流程
4. **文档更新**：更新项目文档
5. **清理确认**：最终验证和确认

---

*创建时间：2025年9月5日*
*状态：待执行*