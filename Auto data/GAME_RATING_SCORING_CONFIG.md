# 游戏评级评分配置表

> 供 AI 节点评分时读取的统一配置，涵盖数据窗口、指标、权重、惩罚、档位与输出规则。

---

## 1. 数据窗口

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `window_label` | `L+30D` | 游戏上线后 30 天（含上线当日） |
| `window_rule` | `launch_date ~ launch_date+29` | 仅使用上线首月的全量数据 |
| `include_today` | `true` | 当天数据若可用需纳入 |

---

## 2. 指标定义

| Key | 中文名 | 计算来源 / 说明 | 单位 |
| --- | --- | --- | --- |
| `d1_retention` | D1 留存率 | D1 回流人数 ÷ Day0 新增人数 | % |
| `d7_retention` | D7 留存率 | D7 回流人数 ÷ Day0 新增人数 | % |
| `new_user_bet_ratio` | 新用户下注人数占比 | 游戏新用户下注人数 ÷ 平台新用户总数 | % |
| `payout_bet_ratio` | 派彩下注比 | 累计派彩 ÷ 累计下注 | % |
| `new_user_count` | 新用户数 | 游戏上线首月内累计新用户数 | 人 |
| `ggr_per_new_user` | 人均 GGR | 累计 GGR ÷ 新用户数 | USDT |
| `rtp_value` | 游戏 RTP | 该游戏的理论派彩率（0-1 浮点） | % |

> 注：所有“占比/比率”均按 0-1 浮点计算，输出时可 ×100 变成百分比。

---

## 3. 单项得分权重与计算

| Score Key | 中文名 | 权重 | 公式 |
| --- | --- | --- | --- |
| `score_d1` | D1 得分 | 35% | `clamp((d1_retention − 0.039) ÷ (0.109 − 0.039)) × 100` |
| `score_d7` | D7 得分 | 25% | `clamp((d7_retention − 0.009) ÷ (0.023 − 0.009)) × 100` |
| `score_scale` | 规模得分 | 20% | `clamp((new_user_bet_ratio − 0.022) ÷ (0.42 − 0.022)) × 100` |
| `score_value` | 价值得分 | 15% | `clamp((new_user_bet_ratio − 0.022) ÷ (0.42 − 0.022)) × 100` |
| `score_risk` | 风险得分 | 10% | `clamp(1 − |payout_bet_ratio − rtp_value| ÷ rtp_diff_tolerance) × 100` |

- `clamp(x) = max(0, min(1, x))`
- `rtp_diff_tolerance` 建议默认 `0.02`（派彩与 RTP 偏差 ≤2% 视为满分，可按需要调整）
- 综合得分（未惩罚前）=`Σ(score_i × weight_i)`

---

## 4. 小样本惩罚

| 条件 | 乘数 |
| --- | --- |
| `new_user_count < 500` | `0.5` |
| `500 ≤ new_user_count < 1000` | `0.8` |
| `new_user_count ≥ 1000` | `1.0` |

应用顺序：先算综合得分，再乘以惩罚因子。

---

## 5. 档位映射

| 档位 | 区间 |
| --- | --- |
| `S` | `score ≥ 80` |
| `A` | `65 ≤ score < 80` |
| `B` | `50 ≤ score < 65` |
| `C` | `score < 50` |

---

## 6. 平台评分规则

1. **先算游戏全局等级**：使用所有平台合并数据（global）。
2. **再算各平台**：对 `platform` 维度独立套用同一指标/权重/惩罚逻辑。
3. **输出字段**：每条结果需包含 `scope`（`global` or `platform`）、`platform_name`、所有原始指标、单项得分、综合得分、惩罚后得分、档位。

---

## 7. 输出顺序

1. 游戏全局结果（1条）
2. 平台结果（按综合得分降序）

---

## 8. AI 调用示例（JSON）

```json
{
  "window": {
    "label": "L+30D",
    "start_offset": 0,
    "end_offset": 29,
    "include_today": true
  },
  "metrics": {
    "d1_retention": {"label": "D1 留存率", "unit": "%"},
    "d7_retention": {"label": "D7 留存率", "unit": "%"},
    "new_user_bet_ratio": {"label": "新用户下注人数占比", "unit": "%"},
    "payout_bet_ratio": {"label": "派彩下注比", "unit": "%"},
    "new_user_count": {"label": "新用户数", "unit": "人"},
    "ggr_per_new_user": {"label": "人均 GGR", "unit": "USDT"},
    "rtp_value": {"label": "游戏 RTP", "unit": "%"}
  },
  "scores": [
    {"key": "score_d1", "weight": 0.35, "formula": "clamp((d1_retention-0.039)/(0.109-0.039))*100"},
    {"key": "score_d7", "weight": 0.25, "formula": "clamp((d7_retention-0.009)/(0.023-0.009))*100"},
    {"key": "score_scale", "weight": 0.20, "formula": "clamp((new_user_bet_ratio-0.022)/(0.42-0.022))*100"},
    {"key": "score_value", "weight": 0.15, "formula": "clamp((new_user_bet_ratio-0.022)/(0.42-0.022))*100"},
    {"key": "score_risk", "weight": 0.10, "formula": "clamp(1-abs(payout_bet_ratio-rtp_value)/rtp_diff_tolerance)*100"}
  ],
  "parameters": {
    "rtp_diff_tolerance": 0.02
  },
  "penalty": [
    {"condition": "new_user_count < 500", "multiplier": 0.5},
    {"condition": "new_user_count < 1000", "multiplier": 0.8}
  ],
  "grade": [
    {"level": "S", "threshold": 80},
    {"level": "A", "threshold": 65},
    {"level": "B", "threshold": 50},
    {"level": "C", "threshold": 0}
  ],
  "output_order": ["global_first", "platform_desc"]
}
```

---

## 9. 使用说明

- AI 读取本表即可获取最新评分配置，无需硬编码到提示词。
- 若未来指标/权重变更，只需更新本文件并在 README / worklog 中记录变更日期。

