EMAIL_SENDER=xxx@xxx.com
EMAIL_PASSWORD=your_email_password
EMAIL_SMTP_HOST=smtp.xxx.com
EMAIL_SMTP_PORT=465
EMAIL_RECEIVERS=xxx@xxx.com,yyy@xxx.com
EMAIL_CC=
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_DATABASE=sink
GMP_DB_HOST=127.0.0.1
GMP_DB_PORT=3306
GMP_DB_USER=root
GMP_DB_PASSWORD=your_db_password
GMP_DB_DATABASE=gmp_game_platform
MERCHANT_DB_HOST=127.0.0.1
MERCHANT_DB_PORT=3306
MERCHANT_DB_USER=root
MERCHANT_DB_PASSWORD=your_db_password
MERCHANT_DB_DATABASE=merchant

# 月度账单脚本说明

## 更新日志
### 2024-06-15
- 修复主入口写死月份参数问题，改为自动获取当前时间的上月数据（new_monthly_billing(None, 'manual')）。
- 用户无需每月手动修改参数，脚本运行即自动统计最新账单。
- 2024-06-15：修复 num_format_6 未定义导致的异常，确保所有Sheet均能正确设置Excel格式。
- 2024-06-15：修复新增商户-货币-游戏维度Sheet统计逻辑因 all_data 作用域不可达导致的 NameError，将相关逻辑移入 get_data_and_export 函数内部。
### 新增商户+货币+游戏分组报表导出
- 新增报表文件：{month}_merchant_currency_game.xlsx，按商户+货币+游戏分组统计，过滤demo商户，字段与合计行效果与截图一致。
- 合计行插入至对应商户数据最后一行，Excel格式与原报表一致。
- 相关功能已记录至task.md与worklog.md。
## 日报Sheet输出逻辑修正说明（2025-09-01）

### 统计逻辑调整
- 日报Sheet只统计 provider_id 为 gp 或 popular 的数据，其他厂商数据不参与统计。
- 商户名映射优先使用 merchant_config 表中的 merchant_desc，其次 account，最后 merchant_id。
- 游戏名映射支持 gp/popular 厂商的特殊映射，其他厂商按 id/code 映射。
- 日期字段统一格式为 YYYY-MM-DD。
- 日报Sheet字段顺序调整为：商户名 | 游戏名 | 日期 | 当天用户数 | 次日用户数 | 次日留存 | 3日用户数 | 3日留存 | 7日用户数 | 7日留存。
- 去除14/30日留存相关字段。

### 使用说明
- 运行 weekly_retention.py 脚本，自动导出 Excel 日报Sheet，Sheet 名为“商户游戏日留存”。
- 仅统计 provider_id=gp 或 popular 的数据，确保报表口径一致。
- 商户名和游戏名均通过数据库映射，输出真实名称。
- 若商户ID或game_id未能映射，将在日志中输出警告，报表显示原始ID。
- 如需“真正新增用户”口径，可通过 --lookback-days 参数配置。

### 变更记录
- 2025-09-01：修正日报Sheet输出逻辑，完善商户名和游戏名映射，补充异常处理与日志提示。
- 2025-09-01：调整Sheet字段顺序，去除14/30日留存相关字段。
- 2025-09-01：增量更新worklog.md与task.md，记录本次修正内容。

### 2024-06-12
- 日报Sheet游戏名映射逻辑已完善：
  - provider为gp或popular时，先查gmp_merchant_game_list的source_id，再查gmp_game_list的name，两步映射。
  - 其他厂商直接查gmp_game_list，id/code映射。
  - 日报Sheet输出真实游戏名，异常时日志提示。
  - 日志详细记录未匹配到游戏名的game_id，便于数据库数据排查。
- 参考weekly_billing.py、monthly_billing.py的映射分支实现，保证映射逻辑一致性。
- 按开发规范，已增量记录到worklog.md，后续如有需求可进一步补充调试脚本与SQL样例。

### 2025-09-15
- **商户+货币+游戏汇总表功能修复**：重新实现了缺失的商户+货币+游戏汇总表导出功能
- **统计范围**：过滤demo商户，只统计gp和popular厂商
- **主要字段**：日期、商户名、货币、游戏、USD汇率、总投注、总投注USD、总派奖、总派奖USD、总局数、RTP、GGR、GGR-USD
- **合计行**：按每个商户+货币合计相关字段数据，合计行放在对应商户数据最后一行
- **邮件附件**：现在包含5个报表文件，新增商户+货币+游戏汇总表
- **验证结果**：脚本运行成功，所有功能正常工作，符合用户需求