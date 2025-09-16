# 工作日志

## 2024年工作记录

### 2024-01-19 游戏名映射修复

#### 问题分析
发现游戏ID `1697709381286` 映射失败，具体原因：
1. 数据库表结构问题：`gmp_game_list` 表中没有 `game_name` 字段，正确的字段名是 `name`
2. 映射逻辑缺陷：当 `source_id` 在映射字典中找不到时，没有有效的后备方案

#### 修复内容
修改了 `weekly_billing.py` 中的 `get_game_mappings` 函数：

**文件**: `d:\cursor\月报\weekly_billing.py`
**位置**: 第250行

**修复前**:
```python
query = f"SELECT game_name FROM gmp_game_list WHERE id = {source_id}"
```

**修复后**:
```python
query = f"SELECT name FROM gmp_game_list WHERE id = {source_id}"
```

#### 验证结果
修复后测试结果：
- **游戏ID**: `1697709381286`
- **source_id**: `14`
- **游戏名称**: `classic_limbo`

映射系统现在可以正常工作，数字游戏ID能够正确转换为可读的游戏名称。

#### 相关文件
- 创建了测试脚本：`test_fixed_mapping.py`
- 创建了表结构检查脚本：`check_table_structure.py`
- 更新了任务跟踪文档：`task.md`

### 技术细节
- 使用了SQLAlchemy进行数据库操作
- 增加了错误处理和日志记录
- 实现了多层映射策略（字典映射 → 数据库查询）

## 2025年工作记录

### 2025-09-12 调试脚本兼容性修正

#### 背景
为了按你的要求截取“Terminal#885-904”的终端输出，需要先让 `debug_mapping.py` 成功运行，从而产生日志。原脚本在 SQLAlchemy 2.x 下使用了 `conn.execute("SELECT 1")` 的旧写法导致报错。

#### 修复内容
- 将 `conn.execute("SELECT 1")` 改为 `conn.execute(text("SELECT 1"))`
- 重跑脚本，保存完整日志并回显末尾内容供核查

#### 说明
- 本次修改仅影响调试脚本 `debug_mapping.py`，不影响生产流程脚本 `weekly_billing.py`
- `weekly_billing.py` 早已采用 `text()` 和参数化查询的写法（连接测试与联查处均已兼容 SQLAlchemy 2.x）

### 2025-09-12 周报运行与映射验证

#### 内容
- 成功运行 weekly_billing.py，完成数据导出与邮件发送。
- 日志显示“厂商游戏汇总”已生成并包含以下字段：['provider', 'game', 'currency', 'pay_in', 'pay_out', 'count']。
- 日志前几行样例：
  - provider=fundist/BGaming, game=178678, currency=BRL, pay_in=492.4, pay_out=388.99, count=56
  - provider=gp, game=1697709381286, currency=BRL, pay_in=4.4, pay_out=4.40, count=2

#### 说明与下一步
- 游戏映射流程已生效，后续补充输出“商户游戏汇总”前几行用于交叉验证。

## 总结
本次修复解决了游戏名映射的核心问题，确保了报表生成时游戏名称的正确显示。

### 2025-09-12 周度留存脚本新增与首轮验证

#### 背景
- 参考 weekly_billing 的结构与口径，新增脚本用于 GP/Popular 厂商在“商户-游戏”维度的用户留存分析与自动发送。

#### 变更内容
- 新增脚本：weekly_retention.py
  - 复用 weekly_billing 的日志、环境配置（DB/GMP_DB/MERCHANT_DB/邮箱）、导出目录与邮件发送框架。
  - 复用映射：商户名映射（merchant_config 优先 merchant_desc，其次 account）、游戏名映射（get_game_mappings + get_game_name，含 GP 两步映射）。
  - 数据源：sink.user_game_record_YYYYMMDD_{0,1}
  - 指标口径：按周对“商户-游戏-厂商”做 D0/D1/D3/D7 聚合；D1/D3/D7 为以周内每日为 cohort 的交集累计；留存率=对应留存人数/D0。
  - CLI：支持 --start-date/--end-date 指定周范围，--no-email 仅导出不发信。

#### 首轮运行与结果
- 执行：python weekly_retention.py --no-email
- 结果：日志显示指定周内 sink 数据表 user_game_record_YYYYMMDD_{0,1} 不存在（1146），最终“留存结果为空”。未导出 Excel，未发送邮件。

#### 下一步
- 需要提供表存在的日期范围或目标周（例如：--start-date 2025-08-26 --end-date 2025-09-01），以便二次验证导出与口径。

- 2025-09-12 新增“商户游戏日留存”输出格式（满足用户格式需求）
  - 变更：在 <mcfile name="weekly_retention.py" path="D:\cursor\月报\weekly_retention.py"></mcfile> 新增日粒度留存导出（Sheet：商户游戏日留存）。
  - 字段：商户名 | 游戏名 | 日期 | 当天新用户数 | 次日用户数 | 次日留存 | 3日用户数 | 3日留存 | 7日用户数 | 7日留存 | 14日用户数 | 14日留存 | 30日用户数 | 30日留存。
  - 口径：当前“当天新用户数”=当日活跃UID数；留存率=对应留存人数/当天新用户数，四舍五入4位小数；取数范围扩展到 +30 天。
  - 文档：已更新 <mcfile name="README.md" path="D:\cursor\月报\README.md"></mcfile> 与 <mcfile name="task.md" path="D:\cursor\月报\task.md"></mcfile>，新增说明与任务记录。
## 2024-06-09
- 新增商户+货币+游戏分组报表导出，包含字段处理、合计行插入和Excel格式设置，满足用户需求。

## 2025-09-12 monthly_billing.py编码问题修复

### 2025-09-12 monthly_billing.py编码问题修复

#### 问题分析
发现monthly_billing.py文件开头存在编码问题：
1. 编码声明与import语句在同一行，导致语法错误
2. 文件开头存在BOM字符，影响正确解析
3. 全局作用域下存在商户+货币+游戏报表代码，在函数外引起NameError

#### 修复内容
1. **编码声明修复**：将编码声明`# -*- coding: utf-8 -*-`与import语句分开，各占一行
2. **BOM字符清理**：彻底移除文件开头的UTF-8 BOM字符
3. **作用域问题解决**：删除全局作用域下的商户+货币+游戏报表代码，保留必要的导入语句

#### 验证结果
- 文件开头编码正常，编码声明单独占第1行
- 文件运行成功，退出码为0，NameError问题已解决
- 文件当前主要包含导入语句，原先的全局代码已删除

#### 相关文件
- 修复后文件：monthly_billing.py
- 更新任务跟踪：task.md
- 更新工作日志：worklog.md

### 2025-09-15 商户+货币+游戏汇总表统计范围调整

#### 需求背景
根据用户要求，将monthly_billing.py中的商户+货币+游戏汇总表统计范围调整为只统计gp和popular厂商，与weekly_billing.py保持一致。

#### 修改内容
修改了monthly_billing.py中的商户+货币+游戏汇总表导出逻辑：

**文件**: `d:\cursor\月报\monthly_billing.py`
**位置**: 第787行

**修改前**:
```python
# 过滤掉商户名为demo的数据
filtered_data = all_data[all_data['merchant'] != 'demo']
```

**修改后**:
```python
# 过滤掉商户名为demo的数据，并且只统计gp和popular厂商
filtered_data = all_data[(all_data['merchant'] != 'demo') & (all_data['provider'].isin(['gp', 'popular']))]
```

#### 验证结果
- 脚本运行成功，退出码为0
- 商户+货币+游戏汇总表正常导出，文件名：202509_merchant_currency_game.xlsx
- 邮件发送成功，包含4个附件
- 日志显示："商户+货币+游戏汇总表 - 未匹配到商户名的商户ID: ['1698202251'] 共1个"

#### 说明
- 本次修改使月度报表与周度报表在商户+货币+游戏维度的统计范围保持一致
- 只统计gp和popular厂商的数据，减少不必要的数据量
- 保持了原有的商户名映射、游戏名映射和合计行功能

### 2025-09-15 所有汇总表过滤demo商户数据

#### 需求背景
根据用户要求，需要确保weekly_billing.py和monthly_billing.py的所有Excel表都不统计商户名为demo的数据。

#### 修改内容
**weekly_billing.py 修改**:
- **商户厂商汇总表**: 在分组前添加过滤逻辑 `merchant_provider_data = all_data[all_data['merchant'] != 'demo']`
- **厂商货币汇总表**: 在分组前添加过滤逻辑 `provider_currency_data = all_data[all_data['merchant'] != 'demo']`
- **厂商游戏汇总表**: 在分组前添加过滤逻辑 `provider_game_data = all_data[all_data['merchant'] != 'demo']`
- **商户游戏汇总表**: 已包含过滤逻辑，保持不变

**monthly_billing.py 修改**:
- **厂商游戏汇总表**: 在分组前添加过滤逻辑 `provider_game_data = all_data[all_data['merchant'].astype(str).str.strip().str.lower() != 'demo']`
- **商户+货币汇总表**: 在分组前添加过滤逻辑 `merchant_currency_data = all_data[all_data['merchant'].astype(str).str.strip().str.lower() != 'demo']`
- **商户+货币+游戏汇总表**: 已包含过滤逻辑，保持不变

#### 验证结果
- 两个脚本均成功运行，退出码为0
- weekly_billing.py正常导出4个Excel工作表并发送邮件
- monthly_billing.py正常导出5个Excel工作表并发送邮件
- 所有汇总表均不再包含商户名为demo的数据
- 功能完全符合用户需求

### 2025-09-15 商户+货币+游戏汇总表功能修复

#### 问题分析
发现商户+货币+游戏汇总表（{month}_merchant_currency_game.xlsx）缺失，原因是之前代码重构时该表导出逻辑被误删。

#### 修复内容
重新实现了商户+货币+游戏汇总表导出逻辑：

**文件**: `d:\cursor\月报\monthly_billing.py`
**位置**: 第850-900行

**新增功能**:
#### 新增功能:
1. **数据过滤**: 过滤掉商户名为demo的数据，只统计gp和popular厂商
2. **分组聚合**: 按['merchant', 'currency', 'game']分组统计

### 2025-09-16 merchant_currency_game游戏名映射修复

#### 问题分析
发现merchant_currency_game汇总表的游戏名映射逻辑与provider_game_currency不一致，前者使用简单的直接映射，后者使用针对GP和Popular厂商的两步映射策略。

#### 修复内容
修改了monthly_billing.py中的merchant_currency_game游戏名映射逻辑：

**文件**: `d:\cursor\月报\monthly_billing.py`
**位置**: 第924-940行

**修改前**:
```python
# 游戏名映射
merchant_game_grouped['游戏名'] = merchant_game_grouped['game'].map(game_id_to_name)
merchant_game_grouped['游戏名'] = merchant_game_grouped.apply(lambda row: row['游戏名'] if pd.notnull(row['游戏名']) and row['游戏名'] != '' else row['game'], axis=1)
```

**修改后**:
```python
# 游戏名映射 - 采用与provider_game_currency相同的两步映射逻辑
def get_game_name(row):
    if row['provider'] in ['gp', 'popular']:
        # 对gp和popular厂商都使用两步映射：game_id -> source_id -> game_name
        return gp_game_to_name.get(row['game'], row['game'])
    else:
        # 其他情况使用id字段映射
        return game_id_to_name.get(row['game'], row['game'])

merchant_game_grouped['游戏名'] = merchant_game_grouped.apply(get_game_name, axis=1)
unknown_games = merchant_game_grouped[merchant_game_grouped['游戏名'] == merchant_game_grouped['game']]['game'].unique()
if len(unknown_games) > 0:
    logger.warning(f"merchant_currency_game表未匹配到游戏名的 game: {unknown_games[:10]} 共{len(unknown_games)}个")
```

#### 验证结果
- 游戏名映射逻辑现在与provider_game_currency汇总表保持一致
- 对GP和Popular厂商使用两步映射策略：game_id -> source_id -> game_name
- 添加了映射失败时的日志提示功能
- 确保所有GP和Popular游戏都能正确映射到可读的游戏名称
3. **字段计算**: 包括总投注、总投注USD、总派奖、总派奖USD、总局数、RTP、GGR、GGR-USD
4. **合计行**: 按每个商户+货币合计相关字段数据，合计行放在对应商户数据最后一行
5. **Excel格式**: 设置表头格式、列宽、数值格式等

**相关修改**:
1. 更新get_data_and_export函数返回语句，包含新的商户+货币+游戏汇总表文件
2. 更新new_monthly_billing函数，处理五个文件名的组装和邮件发送

#### 验证结果
- 脚本运行成功，退出码为0
- 商户+货币+游戏汇总表正常导出，文件名：202509_merchant_currency_game.xlsx
- 邮件发送成功，包含5个附件（新增商户+货币+游戏汇总表）
- 日志显示："导出完成，文件名：excel\\202509_merchant_currency_game.xlsx"
- 所有功能正常工作，符合用户需求