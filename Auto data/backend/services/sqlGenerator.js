const logger = require('../utils/logger')

class SQLGenerator {
  constructor() {
    this.templates = {
      sales: {
        keywords: ['销售', '销量', '营业额', '收入', 'sales', 'revenue'],
        sql: `SELECT product_name, SUM(sales_amount) as total_sales, COUNT(*) as order_count
FROM sales_data 
WHERE order_date >= '{start_date}'
GROUP BY product_name
ORDER BY total_sales DESC
LIMIT {limit};`
      },
      region: {
        keywords: ['地区', '城市', '区域', '省份', 'region', 'city', 'area'],
        sql: `SELECT region, COUNT(DISTINCT customer_id) as customer_count, AVG(sales_amount) as avg_sales
FROM sales_data 
WHERE order_date >= '{start_date}'
GROUP BY region
ORDER BY customer_count DESC
LIMIT {limit};`
      },
      customer: {
        keywords: ['用户', '客户', '顾客', 'customer', 'user', 'client'],
        sql: `SELECT customer_id, COUNT(*) as order_count, SUM(sales_amount) as total_spent
FROM sales_data 
WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
GROUP BY customer_id
ORDER BY total_spent DESC
LIMIT {limit};`
      },
      product: {
        keywords: ['产品', '商品', '物品', 'product', 'item', 'goods'],
        sql: `SELECT product_name, COUNT(*) as sales_count, AVG(sales_amount) as avg_price
FROM sales_data 
WHERE order_date >= '{start_date}'
GROUP BY product_name
ORDER BY sales_count DESC
LIMIT {limit};`
      },
      time: {
        keywords: ['时间', '日期', '月份', '年份', 'time', 'date', 'month', 'year'],
        sql: `SELECT DATE_FORMAT(order_date, '%Y-%m') as month, COUNT(*) as order_count, SUM(sales_amount) as total_sales
FROM sales_data 
WHERE order_date >= '{start_date}'
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY month DESC
LIMIT {limit};`
      }
    }
  }

  /**
   * 生成SQL查询语句
   */
  async generateSQL(queryText, options = {}) {
    const {
      database,
      limit = 1000,
      optimize = true
    } = options

    try {
      logger.info('Generating SQL from natural language', { 
        queryText: queryText.substring(0, 100),
        database,
        limit 
      })

      // 分析查询意图
      const intent = this.analyzeIntent(queryText)
      
      // 提取参数
      const parameters = this.extractParameters(queryText)
      
      // 生成SQL
      let sql = this.buildSQL(intent, parameters, { limit })
      
      // 优化SQL
      if (optimize) {
        sql = this.optimizeSQL(sql)
      }

      // 估算成本和时间
      const estimates = this.estimateQuery(sql, intent)

      logger.info('SQL generated successfully', { 
        intent: intent.type,
        estimatedCost: estimates.cost,
        estimatedTime: estimates.time 
      })

      return {
        sql,
        intent: intent.type,
        parameters,
        estimated_cost: estimates.cost,
        estimated_time: estimates.time,
        explanation: this.explainSQL(sql, intent)
      }

    } catch (error) {
      logger.error('SQL generation failed', { queryText, error: error.message })
      throw new Error(`SQL generation failed: ${error.message}`)
    }
  }

  /**
   * 分析查询意图
   */
  analyzeIntent(queryText) {
    const lowerQuery = queryText.toLowerCase()
    
    // 检查每个模板的关键词
    for (const [type, template] of Object.entries(this.templates)) {
      for (const keyword of template.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          return {
            type,
            confidence: this.calculateConfidence(lowerQuery, template.keywords),
            template: template.sql
          }
        }
      }
    }

    // 默认返回通用查询
    return {
      type: 'general',
      confidence: 0.5,
      template: `SELECT * FROM sales_data WHERE order_date >= '{start_date}' ORDER BY order_date DESC LIMIT {limit};`
    }
  }

  /**
   * 计算意图匹配置信度
   */
  calculateConfidence(queryText, keywords) {
    let matches = 0
    for (const keyword of keywords) {
      if (queryText.includes(keyword.toLowerCase())) {
        matches++
      }
    }
    return Math.min(matches / keywords.length + 0.3, 1.0)
  }

  /**
   * 提取查询参数
   */
  extractParameters(queryText) {
    const parameters = {
      start_date: '2023-01-01',
      end_date: new Date().toISOString().split('T')[0],
      days: 30,
      limit: 1000
    }

    // 提取时间范围
    const timePatterns = [
      { pattern: /(\d{4})年/, key: 'year' },
      { pattern: /(\d{1,2})月/, key: 'month' },
      { pattern: /(\d{1,2})天/, key: 'days' },
      { pattern: /最近(\d+)天/, key: 'days' },
      { pattern: /过去(\d+)天/, key: 'days' },
      { pattern: /(\d{4}-\d{2}-\d{2})/, key: 'date' }
    ]

    for (const { pattern, key } of timePatterns) {
      const match = queryText.match(pattern)
      if (match) {
        if (key === 'year') {
          parameters.start_date = `${match[1]}-01-01`
        } else if (key === 'month') {
          const year = new Date().getFullYear()
          parameters.start_date = `${year}-${match[1].padStart(2, '0')}-01`
        } else if (key === 'days') {
          parameters.days = parseInt(match[1])
        } else if (key === 'date') {
          parameters.start_date = match[1]
        }
      }
    }

    // 提取数量限制
    const limitPatterns = [
      /前(\d+)/, /top\s*(\d+)/i, /限制(\d+)/, /最多(\d+)/
    ]

    for (const pattern of limitPatterns) {
      const match = queryText.match(pattern)
      if (match) {
        parameters.limit = Math.min(parseInt(match[1]), 10000)
        break
      }
    }

    return parameters
  }

  /**
   * 构建SQL语句
   */
  buildSQL(intent, parameters, options = {}) {
    let sql = intent.template

    // 替换参数
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`
      sql = sql.replace(new RegExp(placeholder, 'g'), value)
    }

    // 替换选项
    for (const [key, value] of Object.entries(options)) {
      const placeholder = `{${key}}`
      sql = sql.replace(new RegExp(placeholder, 'g'), value)
    }

    return sql
  }

  /**
   * 优化SQL语句
   */
  optimizeSQL(sql) {
    // 基础SQL优化
    let optimizedSQL = sql

    // 添加索引提示（如果需要）
    if (sql.includes('WHERE order_date')) {
      // 可以添加索引提示
    }

    // 优化LIMIT子句
    if (!sql.includes('LIMIT')) {
      optimizedSQL += ' LIMIT 1000'
    }

    return optimizedSQL
  }

  /**
   * 估算查询成本和时间
   */
  estimateQuery(sql, intent) {
    // 基于SQL复杂度和意图类型估算
    let baseCost = 0.01 // 基础成本$0.01
    let baseTime = 2 // 基础时间2秒

    // 根据查询类型调整
    const complexityFactors = {
      sales: 1.2,
      region: 1.0,
      customer: 1.5,
      product: 1.1,
      time: 1.3,
      general: 1.0
    }

    const factor = complexityFactors[intent.type] || 1.0
    
    // 根据SQL特征调整
    if (sql.includes('GROUP BY')) baseTime *= 1.5
    if (sql.includes('ORDER BY')) baseTime *= 1.2
    if (sql.includes('JOIN')) {
      baseTime *= 2.0
      baseCost *= 1.8
    }

    return {
      cost: Math.round(baseCost * factor * 1000) / 1000,
      time: Math.round(baseTime * factor)
    }
  }

  /**
   * 解释SQL语句
   */
  explainSQL(sql, intent) {
    const explanations = {
      sales: '查询销售数据，按产品分组统计销售额和订单数量',
      region: '查询地区数据，统计各地区客户数量和平均销售额',
      customer: '查询客户数据，统计客户订单数量和消费总额',
      product: '查询产品数据，统计产品销售次数和平均价格',
      time: '查询时间维度数据，按月份统计订单和销售额',
      general: '执行通用数据查询，返回符合条件的记录'
    }

    return explanations[intent.type] || '执行自定义SQL查询'
  }

  /**
   * 验证SQL语句
   */
  validateSQL(sql) {
    // 基础SQL验证
    const dangerousKeywords = [
      'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'
    ]

    const upperSQL = sql.toUpperCase()
    for (const keyword of dangerousKeywords) {
      if (upperSQL.includes(keyword)) {
        throw new Error(`Dangerous SQL keyword detected: ${keyword}`)
      }
    }

    // 检查SQL基本语法
    if (!upperSQL.includes('SELECT')) {
      throw new Error('Invalid SQL: Must contain SELECT statement')
    }

    return true
  }
}

module.exports = new SQLGenerator()