#查询指定游戏
SELECT
  *, -- 查询所有原始字段
  -- 将 created_at 毫秒时间戳转为北京时间（UTC+8）并格式化
  date_format(from_unixtime((created_at + 28800000) / 1000), '%Y-%m-%d %H:%i:%s') AS created_at_utc8,
  -- 将 updated_at 毫秒时间戳转为北京时间（UTC+8）并格式化
  date_format(from_unixtime((updated_at + 28800000) / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at_utc8
FROM game_records
WHERE merchant = '1737978166'-- 指定商户号
  AND uid = 'ydb7179-e64caba150ac446aada8397f732ced56'-- 指定用户ID
  AND provider = 'gp'-- 指定游戏提供商
  AND game_code IN ('gp_table_44', 'gp_table_38')-- 指定游戏
  -- 筛选 hour 字段在指定时间段内的数据（格式为 yyyymmddHH），按UTC0时区
  AND hour BETWEEN '2025071316' AND '2025071415'

#查询指定时间内不同货币、游戏的投注、派彩、局数、用户数
  SELECT
  currency,
  game_code,
  FORMAT('%.2f', SUM(CAST(amount AS DOUBLE))) AS total_amount,
  FORMAT('%.2f', SUM(CAST(pay_out AS DOUBLE))) AS total_pay_out,
  COUNT(DISTINCT id) AS total_rounds,
  COUNT(DISTINCT uid) AS total_users
FROM
  game_records
WHERE
  provider = 'gp'
  AND hour BETWEEN '2025071400' AND '2025072023'
GROUP BY
  currency,game_code
ORDER BY
  currency,game_code