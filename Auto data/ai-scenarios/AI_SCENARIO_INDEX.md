# AI 场景分类索引

本索引列出了当前可供 AI 选择的 10 个查数场景。每个场景在 `ai-scenarios/` 目录下拥有独立文档，包含模板 SQL、字段要求、检查清单与示例。

## 统一约定
- `start_date` / `end_date`：使用 `YYYYMMDD`（例如 `20251012`）
- `hour`：使用 `YYYYMMDDHH` 字符串（例如查询 2025-11-24 全日需 `hour BETWEEN '2025112400' AND '2025112423'`），必须与表分区保持一致
- 所有关联查询默认限制 `provider IN ('gp', 'popular')`
- `id`：仅包含数字，长度 ≥ 16
- 所有 SQL 必须包含必要的分区条件（如 `hour`、`merchant`、`provider`）以避免全表扫描
- 若缺少必填字段，AI 需返回 `hasScenario: false` 并在 `requiredFields` 中列出缺项

## 场景列表
| 场景 ID | 场景名称 | 必要字段 | 可选字段 | 文档路径 |
| --- | --- | --- | --- | --- |
| S1 | 单/多记录 ID 查询 | `id`（数组或单值，纯数字） | `uid`, `merchant_id`, `hour` | `ai-scenarios/S1_single_record_lookup.md` |
| S2 | 单用户全量记录查询 | `uid` | `merchant_id`, `start_date`, `end_date` | `ai-scenarios/S2_user_full_history.md` |
| S3 | 时间范围全量查询 | `start_date`, `end_date` | `merchant_id`, `game_code`, `provider` | `ai-scenarios/S3_time_range_full_scan.md` |
| S4 | 商户维度全量统计 | `merchant_id`, `start_date`, `end_date` | `game_code`, `provider` | `ai-scenarios/S4_merchant_aggregate.md` |
| S5 | 游戏维度全量分析 | `game_code`, `start_date`, `end_date` | `merchant_id`, `provider` | `ai-scenarios/S5_game_dimension_analysis.md` |
| S6 | 多维度组合精确查询 | `id`, `game_code`, `merchant_id`, `hour` | — | `ai-scenarios/S6_multi_dim_exact_query.md` |
| S7 | 异常数据全量排查 | `merchant_id`, `start_date`, `end_date` | `game_code`, `currency` | `ai-scenarios/S7_anomaly_scan.md` |
| S8 | 货币类型全量统计 | `merchant_id`, `currency`, `start_date`, `end_date` | — | `ai-scenarios/S8_currency_stats.md` |
| S9 | 时间趋势全量分析 | `start_date`, `end_date` | `merchant_id`, `provider`, `game_code` | `ai-scenarios/S9_time_trend_analysis.md` |
| S10 | 提供商维度全量对比 | `start_date`, `end_date` | `merchant_id`, `provider` | `ai-scenarios/S10_provider_comparison.md` |
| S11 | 新/活跃用户留存 | `start_date`, `end_date` | `merchant_id`, `game_id`, `cohort_type` | `ai-scenarios/S11_retention_analysis.md` |
| S12 | 日/月活跃用户统计 | `start_date`, `end_date` | `merchant_id`, `game_id`, `granularity` | `ai-scenarios/S12_active_user_stats.md` |
| S13 | 累计投注/派奖（分币种） | `start_date`, `end_date` | `merchant_id`, `game_code` | `ai-scenarios/S13_cumulative_amounts.md` |
| S14 | 指定游戏表现分析 | `start_date`, `end_date`, `game_code` | `merchant_id`, `currency` | `ai-scenarios/S14_target_game_performance.md` |

## 输入校验提示
- **日期**：必须保证 `start_date <= end_date`。若用户仅给出月份（如“10月”），需先解析为具体日期范围。
- **ID**：若用户提供多个 ID，数量 > 50 时建议提醒拆分。
- **自然语言时间**：需要转换为 `YYYYMMDD`（示例：“最近7天” → `start_date = 今日-6`, `end_date = 今日`）。

## 缺字段处理示例
```
hasScenario: false
matchedScenarioId: "S4"
requiredFields: ["merchant_id", "start_date", "end_date"]
reason: "商户维度统计需要提供商户号与时间范围"
suggestedQuestion: "请提供商户号，以及查询的起止日期（格式 20251001）"
```

## 版本信息
- 版本：v1.0
- 更新时间：2025-11-24
- 维护人：Auto Data Team

