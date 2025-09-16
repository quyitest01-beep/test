# 项目任务跟踪

## 当前任务状态

### 已完成任务
- ✅ 检查游戏映射字典是否正确构建
- ✅ 调试get_game_name函数的映射逻辑  
- ✅ 验证数据库中的游戏映射关系
- ✅ 测试游戏名映射是否正常工作
- ✅ 修复游戏名映射失败问题
- ✅ 修正 debug_mapping.py 在 SQLAlchemy 2.x 下的连接测试写法

### 已完成任务（新增）
- ✅ 修复 weekly_billing.py 中 normalize_id 缺失导致的 NameError
- ✅ 成功运行 weekly_billing.py，并验证“厂商游戏汇总”生成与字段正确

### 进行中任务
- 🔄 更新项目文档（README/工作日志）

### 待处理任务（新增）
- ⏳ 输出“商户游戏汇总”前若干行用于交叉验证（优先从日志，必要时读 Excel）
- ⏳ 清理临时测试文件
- ⏳ 验证完整的数据处理流程

## 详细任务记录

### 2024年任务
- **任务**: 修复游戏名映射失败问题
- **状态**: 已完成 ✅
- **描述**: 修复了weekly_billing.py中get_game_mappings函数的SQL查询错误，将`game_name`字段名更正为`name`
- **影响**: 游戏ID `1697709381286` 现在可以正确映射到游戏名称 `classic_limbo`
- **修复内容**: 
  - 修改了第250行的SQL查询语句
  - 增加了映射失败时的数据库直接查询后备方案

### 2025-09-12 留存日报格式输出（新增）
- 目标：新增“商户名、游戏名、日期、当天新用户数、次日用户数、次日留存、7日用户数、7日留存、14日用户数、14日留存、30日用户数、30日留存”列格式的日留存输出。
- 进展：
  - 已在 <mcfile name="weekly_retention.py" path="D:\cursor\月报\weekly_retention.py"></mcfile> 中实现 compute_daily_retention，导出到 Excel 第二个 Sheet：商户游戏日留存。
  - 导出字段顺序与口径说明：当前“当天新用户数”按当日活跃 UID 计为 cohort；留存率=对应留存人数/当天新用户数，四舍五入到4位小数。
- 待办：
  - 若需“真正新增用户”（历史未出现过的 UID）定义，增加可配置的历史回溯窗口（--lookback-days）并扩展取数范围；与业务确认口径后再实施。
  - 在存在数据的周区间进行一次完整导出验证，并抽取若干行用于核对。

### 2025-09-12 留存脚本开发计划与进展（新增）
- 目标：按周输出 GP/Popular 厂商在“商户-游戏”维度的 D0/D1/D3/D7 留存与留存率，并支持自动发送邮件。
- 已完成：
  - ✅ 设计方案（数据源、口径、映射与输出）。
  - ✅ 新增 weekly_retention.py，复用 weekly_billing 的配置、日志、映射与导出/邮件框架；实现 --start-date/--end-date 与 --no-email。
  - ✅ 首轮试运行 --no-email，发现默认统计周对应的 sink.user_game_record_YYYYMMDD_{0,1} 表不存在，导致结果为空。
- 待办：
  - ⏳ 提供/确认存在数据的目标周后复测导出并核对样例行。
  - ⏳（可选增强）自动探测可用日期范围：从 information_schema.tables 检索 user_game_record_% 列表，选择最近完整周计算。
  - ⏳ 更新 README 增加 weekly_retention 脚本使用说明。

### 2025-09-12 留存口径增强（lookback）
- 目标：支持“真正新增用户”口径（按历史首次出现日识别），新增命令行 --lookback-days 参数。
- 进展：
  - 在 <mcfile name="weekly_retention.py" path="D:\cursor\月报\weekly_retention.py"></mcfile>：
    - 新增 --lookback-days（默认0），当 >0 时将读取 start_date-回溯 至 end_date+30 的数据；
    - 计算 first_seen_map={(merchant,provider,game,uid)->first_day}，据此筛选“当天新用户数”；
    - 保持导出列顺序不变；周表不受影响。
- 2025-09-12 日留存输出格式调整
目标：按业务要求将“商户游戏日留存”Sheet列顺序调整为“商户名 | 游戏名 | 日期 | 当天新用户数 | 次日用户数 | 次日留存 | 3日用户数 | 3日留存 | 7日用户数 | 7日留存”，去除14/30日留存相关字段与计算。
进展：已完成weekly_retention.py的daily_df导出列顺序调整，compute_daily_retention与export_and_send逻辑同步更新，Sheet仅保留D1/D3/D7相关字段。
- x3-1 完成：日报Sheet输出真实商户名和游戏名，异常ID已日志提示。
- x3-2 完成：worklog.md已记录本次修复与验证。
- x3-3 待完成：README.md补充映射逻辑说明。
- 待办：
  - 提供存在数据的实际日期范围，完成一次带 lookback 的试运行；
  - 根据业务确认最终“新用户”口径后，更新 README 示例与说明。
- 新增需求：只统计 provider=gp 或 provider=popular 的数据，其他厂商数据不参与日报Sheet与留存统计。
- 计划：
  1. 检查并完善数据读取逻辑，确保只读取 provider=gp 或 popular 的数据。
  2. 检查聚合和导出逻辑，确保只输出这两类厂商的数据。
  3. 修改 weekly_retention.py，完善 provider 筛选逻辑。
  4. 验证脚本运行结果，确保只统计 gp/popular 数据。
  5. 更新 worklog.md 记录本次修改内容。
  6. 更新 README.md，补充 provider 筛选说明。
- x4-1 完成：日报Sheet导出逻辑已支持只统计provider=gp或popular的数据，代码已修复并验证。
- x4-2 完成：worklog.md已记录本次开发与验证过程。
- x4-3 待完成：README.md补充provider筛选逻辑说明。
- x5-1 完成：日报Sheet日期字段已统一为YYYY-MM-DD，去除时分秒
- x5-2 完成：日报Sheet导出逻辑已严格筛选provider=gp或popular，排除其他provider_id
- x5-3 完成：worklog.md已记录本次修复与验证过程
- x5-4 待完成：README.md补充日期格式与provider筛选逻辑说明

## 2025-09-01 日报Sheet输出逻辑修正任务进度
- [x] 调整Sheet列顺序为：商户名 | 游戏名 | 日期 | 当天新用户数 | 次日用户数 | 次日留存 | 3日用户数 | 3日留存 | 7日用户数 | 7日留存，去除14/30日留存
- [x] 实现商户名和游戏名的数据库映射逻辑，日报Sheet输出真实商户名和游戏名
- [x] 完善weekly_retention.py，确保日报Sheet输出真实商户名和游戏名，补充异常处理与日志提示
- [x] 增量更新worklog.md，记录本次开发与映射逻辑完善过程
- [ ] 同步更新README.md，补充映射逻辑说明与使用注意事项
- x6-1 待完成：完善游戏名映射逻辑，确保game_id正确映射为游戏名，异常时日志提示、报表显示原始ID
- x6-2 待完成：日期字段格式化为YYYY-MM-DD，去除时分秒
- x6-3 待完成：provider_id筛选及字段命名统一，所有逻辑使用provider_id字段
- x6-4 待完成：报表字段“当天新用户数”改为“当天用户数”
- x6-5 待完成：修复weekly_retention.py并验证运行结果
- x6-6 待完成：增量更新worklog.md，记录本次开发与验证过程
- x6-7 待完成：同步更新README.md，补充映射逻辑、provider_id筛选及字段命名说明
- [# 当前任务进度
- [x] 修复 num_format_6 未定义导致的异常，确保Excel格式变量在用到前已定义。
- [x] 修复 all_data 未定义导致的异常，确保新增Sheet统计逻辑前 all_data 已赋值且作用域可达。
- [ ] 修正日留存统计逻辑，compute_daily_retention入口处增加provider_id筛选，只统计gp和popular，排除其他provider。
- [x] 修复主入口写死月份参数问题，改为自动获取当前时间的上月数据。

- [x] 修正日留存统计逻辑，compute_daily_retention入口处增加provider_id筛选，只统计gp和popular，排除其他provider。
- [待完成] 验证修正后报表输出是否符合预期。
- [待完成] 更新README.md说明统计口径调整。

## 阶段任务

- [x] 新增商户+货币+游戏分组报表导出，字段与合计行效果与用户截图一致。
- [x] 验证导出Excel文件内容与格式。
- [x] 更新worklog.md，记录本次修改内容。
- [x] 清理临时文件。
- [x] 更新README.md。

## 任务列表

### 已完成任务
- [x] 新增商户+货币+游戏分组报表导出
- [x] 修复商户+货币+游戏汇总表中商户名映射失败问题
- [x] 测试新增报表导出功能
- [x] 修复monthly_billing.py编码问题
- [x] 商户+货币+游戏汇总表统计范围调整（仅统计gp和popular厂商）

### 待完成任务
- [x] 更新worklog.md和task.md文档

### 2025-09-16 merchant_currency_game游戏名映射修复
- [x] 修复merchant_currency_game汇总表游戏名映射逻辑
- [x] 采用与provider_game_currency相同的两步映射策略
- [x] 为GP和Popular厂商使用game_id -> source_id -> game_name映射
- [x] 添加映射失败日志提示

### 2025-09-15 商户+货币+游戏汇总表功能修复
- [x] 分析商户+货币+游戏汇总表缺失问题
- [x] 重新实现商户+货币+游戏汇总表导出逻辑
- [x] 更新get_data_and_export函数返回语句
- [x] 更新new_monthly_billing函数处理五个文件
- [x] 测试新增报表导出功能
- [x] 更新worklog.md和task.md文档
- [x] 验证所有功能正常工作

### 2025-09-15 商户+货币+游戏汇总表格式优化
- [x] 为weekly_billing.py商户游戏汇总表添加合计行加粗格式
- [x] 为weekly_billing.py商户游戏汇总表添加合计行后空白行
- [x] 调整weekly_billing.py商户游戏汇总表游戏字段列宽
- [x] 为monthly_billing.py商户游戏汇总表添加合计行加粗格式
- [x] 为monthly_billing.py商户游戏汇总表添加合计行后空白行
- [x] 修复monthly_billing.py中RTP列对齐问题（保持右对齐）
- [x] 修复weekly_billing.py中RTP列对齐问题（保持右对齐）
- [x] 修复monthly_billing.py中worksheet.get_cell()方法不存在错误
- [x] 统一monthly_billing.py和weekly_billing.py中USD汇率列格式为6位小数
- [x] 修复monthly_billing.py中worksheet.insert_row()方法不存在错误
- [x] 验证weekly_billing.py中商户厂商汇总表GGR列格式正确（数值格式，非百分比）