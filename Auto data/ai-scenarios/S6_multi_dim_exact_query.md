# S6 多维度组合精确查询

## 场景简介
当需要通过多个关键字段（ID + 游戏 + 商户 + 分区）锁定极少量记录时使用，常见于数据稽核或交叉对账。

## 字段要求
- **必填**：`id`, `game_code`, `merchant_id`, `hour`
- **可选**：`uid`, `provider`
- **校验**：
  - `hour` 必须是 `YYYYMMDDHH`
  - 所有必填字段缺一不可，否则无法保证精确匹配

## 输入示例
```json
{
  "id": "1990823099625480192",
  "game_code": "gp_superace",
  "merchant_id": "1716179958",
  "hour": "2025100512"
}
```

## 模板 SQL
```sql
SELECT *
FROM gmp.game_records
WHERE id = '{{ id }}'
  AND game_code = '{{ game_code }}'
  AND merchant_id = '{{ merchant_id }}'
  AND provider IN ('gp', 'popular')
  AND hour = '{{ hour }}'
  {{ AND uid = '{{ uid }}' }}
  {{ AND provider = '{{ provider }}' }};
```

## 生成检查清单
1. 四个关键字段是否齐全；如缺失需提示用户。
2. `hour` 是否符合分区格式。
3. 如匹配失败可建议用户扩大条件（取消 `hour` 或更换场景）。

## 扩展提示
- 若用户提供的是 `created_at` 毫秒值，可先转换为 `hour = DATE_FORMAT(...)`。
- 该场景通常只返回 1 条记录，便于比对详细字段。***

