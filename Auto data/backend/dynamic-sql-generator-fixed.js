// 修复版增强动态SQL生成器
// 支持上周和上月的游戏新用户和活跃用户留存查询

const inputData = $input.all();
const timeData = inputData[0].json;

// 提取时间参数
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

// 日期格式转换函数
function formatDateForSQL(dateStr) {
  if (!dateStr) return null;
  // 将 YYYYMMDD 转换为 YYYY-MM-DD
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

const queries = {};

// 检查是否有上周数据
if (lastWeekStart && lastWeekEnd && lastWeekRange) {
  console.log(`生成上周查询，时间范围: ${lastWeekRange}`);
  
  const lastWeekStartFormatted = formatDateForSQL(lastWeekStart);
  const lastWeekEndFormatted = formatDateForSQL(lastWeekEnd);
  
  console.log(`日期格式转换: ${lastWeekStart} -> ${lastWeekStartFormatted}, ${lastWeekEnd} -> ${lastWeekEndFormatted}`);
  
  // 1. 上周游戏活跃用户留存
  queries.gameActLastWeek = `
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
  GROUP BY
    gr.merchant,
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
 AND e.uid = c.uid
 AND e.event_date IN (
       c.cohort_date,
       DATE_ADD('day', 1,  c.cohort_date),
       DATE_ADD('day', 3,  c.cohort_date),
       DATE_ADD('day', 7,  c.cohort_date)
     )
GROUP BY c.merchant, c.cohort_date
ORDER BY c.merchant, c.cohort_date;`;

  // 2. 上周游戏新用户留存
  queries.gameNewLastWeek = `
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
    fs.first_event_date AS new_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastWeekStartFormatted}' AND DATE '${lastWeekEndFormatted}'
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
  DATE_FORMAT(c.new_date, '%Y-%m-%d') AS new_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.new_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.new_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.new_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant = c.merchant
 AND e.uid = c.uid
 AND e.event_date IN (
       c.new_date,
       DATE_ADD('day', 1,  c.new_date),
       DATE_ADD('day', 3,  c.new_date),
       DATE_ADD('day', 7,  c.new_date)
     )
GROUP BY c.merchant, c.new_date
ORDER BY c.merchant, c.new_date;`;
}

// 检查是否有上月数据
if (lastMonthStart && lastMonthEnd && lastMonthRange) {
  console.log(`生成上月查询，时间范围: ${lastMonthRange}`);
  
  const lastMonthStartFormatted = formatDateForSQL(lastMonthStart);
  const lastMonthEndFormatted = formatDateForSQL(lastMonthEnd);
  
  console.log(`日期格式转换: ${lastMonthStart} -> ${lastMonthStartFormatted}, ${lastMonthEnd} -> ${lastMonthEndFormatted}`);
  
  // 3. 上月游戏活跃用户留存
  queries.gameActLastMonth = `
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
  GROUP BY
    gr.merchant,
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
 AND e.uid = c.uid
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

  // 4. 上月游戏新用户留存
  queries.gameNewLastMonth = `
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
    fs.first_event_date AS new_date
  FROM first_seen fs
  WHERE fs.first_event_date BETWEEN DATE '${lastMonthStartFormatted}' AND DATE '${lastMonthEndFormatted}'
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
  DATE_FORMAT(c.new_date, '%Y-%m-%d') AS new_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.new_date) THEN c.uid END) AS d1_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.new_date) THEN c.uid END) AS d3_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.new_date) THEN c.uid END) AS d7_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d7_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.new_date) THEN c.uid END) AS d14_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d14_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.new_date) THEN c.uid END) AS d30_users,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END) = 0 THEN 0
    ELSE ROUND(
      (CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.new_date) THEN c.uid END) AS DOUBLE) 
      / COUNT(DISTINCT CASE WHEN e.event_date = c.new_date THEN c.uid END)) * 100, 
      2
    ) 
  END AS d30_retention_rate
FROM cohort_new c
LEFT JOIN events_window e
  ON e.merchant = c.merchant
 AND e.uid = c.uid
 AND e.event_date IN (
       c.new_date,
       DATE_ADD('day', 1,  c.new_date),
       DATE_ADD('day', 3,  c.new_date),
       DATE_ADD('day', 7,  c.new_date),
       DATE_ADD('day', 14, c.new_date),
       DATE_ADD('day', 30, c.new_date)
     )
GROUP BY c.merchant, c.new_date
ORDER BY c.merchant, c.new_date;`;
}

// 统计生成的查询数量
const queryCount = Object.keys(queries).length;
console.log(`=== 查询生成完成 ===`);
console.log(`总共生成 ${queryCount} 个查询`);
console.log('查询类型:', Object.keys(queries));

// 返回结果（n8n Code节点需要返回数组）
return [{
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
}];

