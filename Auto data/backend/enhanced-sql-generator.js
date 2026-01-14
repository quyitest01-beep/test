// 增强版动态SQL生成器
// 支持上周和上月的8个核心查询，灵活处理时间数据

const inputData = $input.all();
const timeData = inputData[0].json;

// 提取时间参数，支持灵活的时间数据
const { 
  lastWeekStart, 
  lastWeekEnd, 
  lastWeekRange,
  lastMonthStart, 
  lastMonthEnd, 
  lastMonthRange,
  lastMonthStr
} = timeData;

console.log('=== 时间数据检查 ===');
console.log('上周数据:', { lastWeekStart, lastWeekEnd, lastWeekRange });
console.log('上月数据:', { lastMonthStart, lastMonthEnd, lastMonthRange, lastMonthStr });

const queries = {};

// 检查是否有上周数据，如果有则生成上周查询
if (lastWeekStart && lastWeekEnd && lastWeekRange) {
  console.log(`生成上周查询，时间范围: ${lastWeekRange}`);
  
  // 1. 上周游戏日统计
  queries.gameDailyLastWeek = `
SELECT 
    SUBSTR(hour, 1, 8) AS date_str,
    merchant,
    game_id,
    COUNT(DISTINCT uid) AS daily_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastWeekStart}00'
    AND hour <= '${lastWeekEnd}23'
GROUP BY SUBSTR(hour, 1, 8),
         merchant,
         game_id
ORDER BY date_str, merchant, game_id;`;

  // 2. 上周商户日统计
  queries.merchantDailyLastWeek = `
SELECT 
    SUBSTR(hour, 1, 8) AS date_str,
    merchant,
    COUNT(DISTINCT uid) AS daily_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastWeekStart}00'
    AND hour <= '${lastWeekEnd}23'
GROUP BY SUBSTR(hour, 1, 8),
         merchant
ORDER BY date_str, merchant;`;

  // 3. 上周游戏周统计
  queries.gameWeeklyTotal = `
SELECT 
    SUBSTR(hour, 1, 6) AS month_str,
    merchant,
    game_id,
    COUNT(DISTINCT uid) AS weekly_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastWeekStart}00'
    AND hour <= '${lastWeekEnd}23'
GROUP BY 
    SUBSTR(hour, 1, 6),
    merchant,
    game_id
ORDER BY 
    month_str,
    merchant,
    game_id;`;

  // 4. 上周商户周统计
  queries.merchantWeeklyTotal = `
SELECT 
    SUBSTR(hour, 1, 6) AS month_str,
    merchant,
    COUNT(DISTINCT uid) AS weekly_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastWeekStart}00'
    AND hour <= '${lastWeekEnd}23'
GROUP BY 
    SUBSTR(hour, 1, 6),
    merchant
ORDER BY 
    month_str,
    merchant;`;

  // 5. 上周游戏投注用户留存（周度只要D1,D3,D7）
  queries.gameRetentionLastWeek = `
WITH
cohort AS (
  SELECT
    gr.merchant,
    gr.game_id,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
    gr.uid
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
  GROUP BY
    gr.merchant,
    gr.game_id,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
    gr.uid
),
events_window AS (
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
)
SELECT
  c.merchant,
  c.game_id,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate
FROM cohort c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.game_id = c.game_id
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date)
     )
GROUP BY c.merchant, c.game_id, c.cohort_date
ORDER BY c.merchant, c.game_id, c.cohort_date;`;

  // 6. 上周游戏新用户留存
  queries.gameNewUserRetentionLastWeek = `
WITH
first_seen AS (
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
   AND merchant <> '10001' 
   AND CAST(gr.hour AS VARCHAR) <= '${lastWeekEnd}23'
  GROUP BY gr.merchant, gr.game_id, gr.uid
),
cohort_new AS (                                                
  SELECT
    fs.merchant,
    fs.game_id,
    fs.uid,
    fs.first_event_date AS cohort_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastWeekStart}' AND DATE '${lastWeekEnd}'
),
events_window AS (                                            
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
)
SELECT
  c.merchant,
  c.game_id,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.game_id = c.game_id
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date)
     )
GROUP BY c.merchant, c.game_id, c.cohort_date
ORDER BY c.merchant, c.game_id, c.cohort_date;`;

  // 7. 上周商户投注用户留存
  queries.merchantRetentionLastWeek = `
WITH
cohort AS (
  SELECT
    gr.merchant,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
    gr.uid
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
  GROUP BY gr.merchant,
           DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
           gr.uid
),
events_window AS (
  SELECT
    gr.merchant,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
  AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
)
SELECT
  c.merchant,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate
FROM cohort c
LEFT JOIN events_window e
  ON e.merchant = c.merchant
 AND e.uid      = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date)
     )
GROUP BY c.merchant, c.cohort_date
ORDER BY c.merchant, c.cohort_date;`;

  // 8. 上周商户新用户留存
  queries.merchantNewUserRetentionLastWeek = `
WITH
first_seen AS (
  SELECT
    gr.merchant,
    gr.uid,
    MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND CAST(gr.hour AS VARCHAR) <= '${lastWeekEnd}23'
  GROUP BY gr.merchant, gr.uid
),
cohort_new AS (                                                
  SELECT
    fs.merchant,
    fs.uid,
    fs.first_event_date AS cohort_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastWeekStart}' AND DATE '${lastWeekEnd}'
),
events_window AS (                                            
  SELECT
    gr.merchant,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastWeekStart}' AND '${lastWeekEnd}'
)
SELECT
  c.merchant,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date)
     )
GROUP BY c.merchant, c.cohort_date
ORDER BY c.merchant, c.cohort_date;`;
}

// 检查是否有上月数据，如果有则生成上月查询
if (lastMonthStart && lastMonthEnd && lastMonthRange) {
  console.log(`生成上月查询，时间范围: ${lastMonthRange}`);
  
  // 1. 上月游戏日统计
  queries.gameDailyLastMonth = `
SELECT 
    SUBSTR(hour, 1, 8) AS date_str,
    merchant,
    game_id,
    COUNT(DISTINCT uid) AS daily_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastMonthStart}00'
    AND hour <= '${lastMonthEnd}23'
GROUP BY SUBSTR(hour, 1, 8),
         merchant,
         game_id
ORDER BY date_str, merchant, game_id;`;

  // 2. 上月商户日统计
  queries.merchantDailyLastMonth = `
SELECT 
    SUBSTR(hour, 1, 8) AS date_str,
    merchant,
    COUNT(DISTINCT uid) AS daily_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastMonthStart}00'
    AND hour <= '${lastMonthEnd}23'
GROUP BY SUBSTR(hour, 1, 8),
         merchant
ORDER BY date_str, merchant;`;

  // 3. 上月游戏月统计
  queries.gameMonthlyTotal = `
SELECT 
    SUBSTR(hour, 1, 6) AS month_str,
    merchant,
    game_id,
    COUNT(DISTINCT uid) AS monthly_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastMonthStart}00'
    AND hour <= '${lastMonthEnd}23'
GROUP BY 
    SUBSTR(hour, 1, 6),
    merchant,
    game_id
ORDER BY 
    month_str,
    merchant,
    game_id;`;

  // 4. 上月商户月统计
  queries.merchantMonthlyTotal = `
SELECT 
    SUBSTR(hour, 1, 6) AS month_str,
    merchant,
    COUNT(DISTINCT uid) AS monthly_unique_users
FROM game_records
WHERE provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND hour >= '${lastMonthStart}00'
    AND hour <= '${lastMonthEnd}23'
GROUP BY 
    SUBSTR(hour, 1, 6),
    merchant
ORDER BY 
    month_str,
    merchant;`;

  // 5. 上月游戏投注用户留存（月度需要D1,D3,D7,D14,D30）
  queries.gameRetentionLastMonth = `
WITH
cohort AS (
  SELECT
    gr.merchant,
    gr.game_id,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
    gr.uid
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
  GROUP BY
    gr.merchant,
    gr.game_id,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
    gr.uid
),
events_window AS (
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
)
SELECT
  c.merchant,
  c.game_id,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS d14_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d14_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS d30_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d30_retention_rate
FROM cohort c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.game_id = c.game_id
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date),
       DATE_ADD('day', 14, c.cohort_date),
       DATE_ADD('day', 30, c.cohort_date)
     )
GROUP BY c.merchant, c.game_id, c.cohort_date
ORDER BY c.merchant, c.game_id, c.cohort_date;`;

  // 6. 上月游戏新用户留存
  queries.gameNewUserRetentionLastMonth = `
WITH
first_seen AS (
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
   AND merchant <> '10001' 
   AND CAST(gr.hour AS VARCHAR) <= '${lastMonthEnd}23'
  GROUP BY gr.merchant, gr.game_id, gr.uid
),
cohort_new AS (                                                
  SELECT
    fs.merchant,
    fs.game_id,
    fs.uid,
    fs.first_event_date AS cohort_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastMonthStart}' AND DATE '${lastMonthEnd}'
),
events_window AS (                                            
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
)
SELECT
  c.merchant,
  c.game_id,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS d14_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d14_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS d30_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d30_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.game_id = c.game_id
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date),
       DATE_ADD('day', 14, c.cohort_date),
       DATE_ADD('day', 30, c.cohort_date)
     )
GROUP BY c.merchant, c.game_id, c.cohort_date
ORDER BY c.merchant, c.game_id, c.cohort_date;`;

  // 7. 上月商户投注用户留存
  queries.merchantRetentionLastMonth = `
WITH
cohort AS (
  SELECT
    gr.merchant,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
    gr.uid
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
  GROUP BY gr.merchant,
           DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
           gr.uid
),
events_window AS (
  SELECT
    gr.merchant,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
  AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
)
SELECT
  c.merchant,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS d14_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d14_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS d30_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d30_retention_rate
FROM cohort c
LEFT JOIN events_window e
  ON e.merchant = c.merchant
 AND e.uid      = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date),
       DATE_ADD('day', 14, c.cohort_date),
       DATE_ADD('day', 30, c.cohort_date)
     )
GROUP BY c.merchant, c.cohort_date
ORDER BY c.merchant, c.cohort_date;`;

  // 8. 上月商户新用户留存
  queries.merchantNewUserRetentionLastMonth = `
WITH
first_seen AS (
  SELECT
    gr.merchant,
    gr.uid,
    MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND CAST(gr.hour AS VARCHAR) <= '${lastMonthEnd}23'
  GROUP BY gr.merchant, gr.uid
),
cohort_new AS (                                                
  SELECT
    fs.merchant,
    fs.uid,
    fs.first_event_date AS cohort_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastMonthStart}' AND DATE '${lastMonthEnd}'
),
events_window AS (                                            
  SELECT
    gr.merchant,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND merchant <> '10001'
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '${lastMonthStart}' AND '${lastMonthEnd}'
)
SELECT
  c.merchant,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS d14_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d14_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS d30_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d30_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant  = c.merchant
 AND e.uid       = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date),
       DATE_ADD('day', 14, c.cohort_date),
       DATE_ADD('day', 30, c.cohort_date)
     )
GROUP BY c.merchant, c.cohort_date
ORDER BY c.merchant, c.cohort_date;`;
}

// 统计生成的查询数量
const queryCount = Object.keys(queries).length;
console.log(`=== 查询生成完成 ===`);
console.log(`总共生成 ${queryCount} 个查询`);
console.log('查询类型:', Object.keys(queries));

// 返回结果
return {
  json: {
    success: true,
    timeData: {
      lastWeek: { 
        start: lastWeekStart, 
        end: lastWeekEnd, 
        range: lastWeekRange,
        hasData: !!(lastWeekStart && lastWeekEnd)
      },
      lastMonth: { 
        start: lastMonthStart, 
        end: lastMonthEnd, 
        range: lastMonthRange,
        hasData: !!(lastMonthStart && lastMonthEnd)
      }
    },
    queries: queries,
    queryCount: queryCount,
    hasLastWeek: !!(lastWeekStart && lastWeekEnd),
    hasLastMonth: !!(lastMonthStart && lastMonthEnd),
    generatedAt: new Date().toISOString()
  }
};
