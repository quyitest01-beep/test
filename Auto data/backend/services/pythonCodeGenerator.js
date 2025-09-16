const logger = require('../utils/logger')

class PythonCodeGenerator {
  constructor() {
    // 数据库驱动配置
    this.dbDrivers = {
      mysql: 'mysql+pymysql',
      postgresql: 'postgresql+psycopg2',
      sqlite: 'sqlite',
      sqlserver: 'mssql+pyodbc',
      oracle: 'oracle+cx_oracle'
    }

    // 查询意图模板
    this.intentTemplates = {
      sales_analysis: {
        keywords: ['销售', '销量', '营业额', '收入', 'sales', 'revenue', '营收'],
        tables: ['sales', 'orders', 'transactions'],
        common_columns: ['product_name', 'sales_amount', 'order_date', 'customer_id'],
        aggregations: ['SUM', 'COUNT', 'AVG']
      },
      user_analysis: {
        keywords: ['用户', '客户', '顾客', 'user', 'customer', 'client'],
        tables: ['users', 'customers', 'user_profiles'],
        common_columns: ['user_id', 'username', 'email', 'region', 'age', 'created_at'],
        aggregations: ['COUNT', 'AVG', 'GROUP BY']
      },
      product_analysis: {
        keywords: ['产品', '商品', '物品', 'product', 'item', 'goods'],
        tables: ['products', 'items', 'inventory'],
        common_columns: ['product_id', 'product_name', 'category', 'price', 'stock'],
        aggregations: ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN']
      },
      time_analysis: {
        keywords: ['时间', '日期', '趋势', 'time', 'date', 'trend', '每日', '每月'],
        tables: ['orders', 'sales', 'logs'],
        common_columns: ['created_at', 'order_date', 'updated_at'],
        aggregations: ['DATE_FORMAT', 'GROUP BY', 'COUNT']
      },
      region_analysis: {
        keywords: ['地区', '城市', '区域', '省份', 'region', 'city', 'area', 'province'],
        tables: ['users', 'orders', 'addresses'],
        common_columns: ['region', 'city', 'province', 'country'],
        aggregations: ['GROUP BY', 'COUNT', 'SUM']
      }
    }

    // Python代码模板
    this.pythonTemplate = `
import pandas as pd
from sqlalchemy import create_engine, text
import logging
import sys
import json
from datetime import datetime, timedelta

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def execute_query():
    """
    执行数据库查询并返回结果
    """
    try:
        # 数据库连接配置
        connection_string = "{connection_string}"
        
        # 创建数据库引擎
        engine = create_engine(connection_string, pool_pre_ping=True)
        
        # 查询参数
        query_params = {query_params}
        
        # SQL查询语句
        query = text("""
        {sql_query}
        """)
        
        logger.info(f"执行查询: {{query}}")
        logger.info(f"查询参数: {{query_params}}")
        
        # 执行查询
        start_time = datetime.now()
        df = pd.read_sql(query, engine, params=query_params)
        end_time = datetime.now()
        
        execution_time = (end_time - start_time).total_seconds() * 1000
        
        # 数据处理
        {data_processing}
        
        # 检查数据量
        row_count = len(df)
        requires_split = row_count > {split_threshold}
        
        # 格式化结果
        result_data = df.to_dict('records') if row_count <= {max_return_rows} else df.head({max_return_rows}).to_dict('records')
        
        # 返回结果
        result = {
            'success': True,
            'data': result_data,
            'row_count': row_count,
            'columns': df.columns.tolist(),
            'execution_time': execution_time,
            'requires_split': requires_split,
            'data_types': df.dtypes.astype(str).to_dict(),
            'memory_usage': df.memory_usage(deep=True).sum(),
            'query_info': {
                'intent': '{intent}',
                'tables_used': {tables_used},
                'has_aggregation': {has_aggregation}
            }
        }
        
        # 如果数据量过大，提供拆分建议
        if requires_split:
            result['split_suggestions'] = generate_split_suggestions(df, query_params)
        
        return result
        
    except Exception as e:
        logger.error(f"查询执行失败: {{str(e)}}")
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'data': [],
            'row_count': 0
        }
    
    finally:
        # 清理资源
        if 'engine' in locals():
            engine.dispose()

def generate_split_suggestions(df, params):
    """
    生成数据拆分建议
    """
    suggestions = []
    
    # 检查是否有日期列
    date_columns = df.select_dtypes(include=['datetime64', 'object']).columns
    for col in date_columns:
        if 'date' in col.lower() or 'time' in col.lower():
            suggestions.append({
                'type': 'date_range',
                'column': col,
                'strategy': '按月拆分',
                'estimated_parts': max(1, len(df) // 100000)
            })
    
    # 检查是否有ID列
    id_columns = [col for col in df.columns if 'id' in col.lower()]
    if id_columns:
        suggestions.append({
            'type': 'id_range',
            'column': id_columns[0],
            'strategy': '按ID范围拆分',
            'estimated_parts': max(1, len(df) // 100000)
        })
    
    return suggestions

# 执行查询并输出结果
if __name__ == '__main__':
    result = execute_query()
    print(json.dumps(result, ensure_ascii=False, default=str))
`
  }

  /**
   * 生成Python查询代码
   */
  async generatePythonCode(queryText, dbConfig = null, options = {}) {
    const {
      limit = 1000,
      splitThreshold = 100000,
      maxReturnRows = 10000,
      optimize = true
    } = options

    try {
      // 从环境变量获取数据库配置
      const envDbConfig = this.getDbConfigFromEnv()
      
      logger.info('生成Python查询代码', { 
        queryText: queryText.substring(0, 100),
        dbType: envDbConfig.type
      })

      // 1. 分析查询意图
      const intent = this.analyzeQueryIntent(queryText)
      
      // 2. 提取查询参数
      const parameters = this.extractQueryParameters(queryText)
      
      // 3. 生成SQL查询
      const sqlQuery = this.generateSQL(intent, parameters, { limit })
      
      // 4. 构建连接字符串（使用环境变量配置）
      const connectionString = this.buildConnectionString(envDbConfig)
      
      // 5. 生成数据处理代码
      const dataProcessing = this.generateDataProcessing(intent, parameters)
      
      // 6. 构建完整的Python代码
      const pythonCode = this.buildPythonCode({
        connectionString,
        sqlQuery,
        queryParams: parameters,
        dataProcessing,
        splitThreshold,
        maxReturnRows,
        intent: intent.type,
        tablesUsed: intent.tables || [],
        hasAggregation: sqlQuery.toLowerCase().includes('group by')
      })

      // 7. 估算执行时间和资源使用
      const estimates = this.estimateExecution(sqlQuery, intent, parameters)

      logger.info('Python代码生成成功', { 
        intent: intent.type,
        estimatedTime: estimates.time,
        linesOfCode: pythonCode.split('\n').length
      })

      return {
        python_code: pythonCode,
        sql_query: sqlQuery,
        intent: intent.type,
        parameters,
        estimated_time: estimates.time,
        estimated_rows: estimates.rows,
        requires_split: estimates.rows > splitThreshold,
        connection_info: {
          type: envDbConfig.type,
          database: envDbConfig.database
        },
        execution_info: {
          memory_estimate: estimates.memory,
          complexity: estimates.complexity
        }
      }

    } catch (error) {
      logger.error('Python代码生成失败', { error: error.message })
      throw new Error(`Python代码生成失败: ${error.message}`)
    }
  }

  /**
   * 从环境变量获取数据库配置
   */
  getDbConfigFromEnv() {
    const config = {
      type: process.env.DB_TYPE || 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'athena_query',
      ssl: process.env.DB_SSL === 'true',
      timeout: parseInt(process.env.DB_TIMEOUT) || 30000
    }

    // 根据数据库类型调整默认端口
    if (config.type === 'postgresql' && config.port === 3306) {
      config.port = 5432
    } else if (config.type === 'sqlserver' && config.port === 3306) {
      config.port = 1433
    } else if (config.type === 'oracle' && config.port === 3306) {
      config.port = 1521
    }

    // SQLite特殊处理
    if (config.type === 'sqlite') {
      config.database = process.env.DB_SQLITE_PATH || './database/data.sqlite'
    }

    return config
  }

  /**
   * 分析查询意图
   */
  analyzeQueryIntent(queryText) {
    const text = queryText.toLowerCase()
    let bestMatch = { type: 'general', score: 0, tables: [], keywords: [] }

    // 遍历所有意图模板
    for (const [intentType, template] of Object.entries(this.intentTemplates)) {
      let score = 0
      const matchedKeywords = []

      // 检查关键词匹配
      for (const keyword of template.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += keyword.length // 长关键词权重更高
          matchedKeywords.push(keyword)
        }
      }

      // 检查表名匹配
      const matchedTables = []
      for (const table of template.tables) {
        if (text.includes(table)) {
          score += 5 // 表名匹配权重较高
          matchedTables.push(table)
        }
      }

      if (score > bestMatch.score) {
        bestMatch = {
          type: intentType,
          score,
          tables: matchedTables.length > 0 ? matchedTables : template.tables.slice(0, 1),
          keywords: matchedKeywords,
          template
        }
      }
    }

    return bestMatch
  }

  /**
   * 提取查询参数
   */
  extractQueryParameters(queryText) {
    const parameters = {}
    const text = queryText.toLowerCase()

    // 提取数量限制
    const limitMatch = text.match(/(前|top|最多)\s*(\d+)/)
    if (limitMatch) {
      parameters.limit = parseInt(limitMatch[2])
    }

    // 提取时间范围
    const timePatterns = [
      { pattern: /(\d{4})年/, key: 'year' },
      { pattern: /(\d{1,2})月/, key: 'month' },
      { pattern: /最近(\d+)天/, key: 'recent_days' },
      { pattern: /过去(\d+)个?月/, key: 'recent_months' }
    ]

    for (const { pattern, key } of timePatterns) {
      const match = text.match(pattern)
      if (match) {
        parameters[key] = parseInt(match[1])
      }
    }

    // 提取排序方式
    if (text.includes('最高') || text.includes('降序') || text.includes('desc')) {
      parameters.order = 'DESC'
    } else if (text.includes('最低') || text.includes('升序') || text.includes('asc')) {
      parameters.order = 'ASC'
    }

    // 提取地区信息
    const regions = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安']
    for (const region of regions) {
      if (text.includes(region)) {
        parameters.region = region
        break
      }
    }

    return parameters
  }

  /**
   * 生成SQL查询
   */
  generateSQL(intent, parameters, options = {}) {
    const { limit = 1000 } = options
    const table = intent.tables[0] || 'data_table'
    
    let sql = ''
    
    switch (intent.type) {
      case 'sales_analysis':
        sql = this.generateSalesSQL(table, parameters, limit)
        break
      case 'user_analysis':
        sql = this.generateUserSQL(table, parameters, limit)
        break
      case 'product_analysis':
        sql = this.generateProductSQL(table, parameters, limit)
        break
      case 'time_analysis':
        sql = this.generateTimeSQL(table, parameters, limit)
        break
      case 'region_analysis':
        sql = this.generateRegionSQL(table, parameters, limit)
        break
      default:
        sql = this.generateGenericSQL(table, parameters, limit)
    }

    return sql
  }

  /**
   * 生成销售分析SQL
   */
  generateSalesSQL(table, params, limit) {
    const orderBy = params.order === 'ASC' ? 'ASC' : 'DESC'
    const timeFilter = this.buildTimeFilter(params)
    
    return `
      SELECT 
        product_name,
        SUM(sales_amount) as total_sales,
        COUNT(*) as order_count,
        AVG(sales_amount) as avg_sales
      FROM ${table}
      ${timeFilter ? `WHERE ${timeFilter}` : ''}
      GROUP BY product_name
      ORDER BY total_sales ${orderBy}
      LIMIT :limit
    `.trim()
  }

  /**
   * 生成用户分析SQL
   */
  generateUserSQL(table, params, limit) {
    const regionFilter = params.region ? `region = :region` : ''
    const timeFilter = this.buildTimeFilter(params)
    const whereClause = [regionFilter, timeFilter].filter(Boolean).join(' AND ')
    
    return `
      SELECT 
        region,
        COUNT(DISTINCT user_id) as user_count,
        AVG(CASE WHEN age IS NOT NULL THEN age END) as avg_age
      FROM ${table}
      ${whereClause ? `WHERE ${whereClause}` : ''}
      GROUP BY region
      ORDER BY user_count DESC
      LIMIT :limit
    `.trim()
  }

  /**
   * 生成产品分析SQL
   */
  generateProductSQL(table, params, limit) {
    const orderBy = params.order === 'ASC' ? 'ASC' : 'DESC'
    const timeFilter = this.buildTimeFilter(params)
    
    return `
      SELECT 
        product_name,
        category,
        COUNT(*) as sales_count,
        AVG(price) as avg_price,
        SUM(quantity) as total_quantity
      FROM ${table}
      ${timeFilter ? `WHERE ${timeFilter}` : ''}
      GROUP BY product_name, category
      ORDER BY sales_count ${orderBy}
      LIMIT :limit
    `.trim()
  }

  /**
   * 生成时间分析SQL
   */
  generateTimeSQL(table, params, limit) {
    const timeFilter = this.buildTimeFilter(params)
    
    return `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        COUNT(*) as daily_count,
        SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as daily_total
      FROM ${table}
      ${timeFilter ? `WHERE ${timeFilter}` : ''}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date DESC
      LIMIT :limit
    `.trim()
  }

  /**
   * 生成地区分析SQL
   */
  generateRegionSQL(table, params, limit) {
    const timeFilter = this.buildTimeFilter(params)
    
    return `
      SELECT 
        region,
        city,
        COUNT(*) as record_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM ${table}
      ${timeFilter ? `WHERE ${timeFilter}` : ''}
      GROUP BY region, city
      ORDER BY record_count DESC
      LIMIT :limit
    `.trim()
  }

  /**
   * 生成通用SQL
   */
  generateGenericSQL(table, params, limit) {
    const timeFilter = this.buildTimeFilter(params)
    
    return `
      SELECT *
      FROM ${table}
      ${timeFilter ? `WHERE ${timeFilter}` : ''}
      ORDER BY id DESC
      LIMIT :limit
    `.trim()
  }

  /**
   * 构建时间过滤条件
   */
  buildTimeFilter(params) {
    const conditions = []
    
    if (params.year) {
      conditions.push(`YEAR(created_at) = ${params.year}`)
    }
    
    if (params.month && params.year) {
      conditions.push(`MONTH(created_at) = ${params.month}`)
    }
    
    if (params.recent_days) {
      conditions.push(`created_at >= DATE_SUB(NOW(), INTERVAL ${params.recent_days} DAY)`)
    }
    
    if (params.recent_months) {
      conditions.push(`created_at >= DATE_SUB(NOW(), INTERVAL ${params.recent_months} MONTH)`)
    }
    
    return conditions.join(' AND ')
  }

  /**
   * 构建数据库连接字符串
   */
  buildConnectionString(dbConfig) {
    const { type, host, port, username, password, database } = dbConfig
    const driver = this.dbDrivers[type] || 'mysql+pymysql'
    
    if (type === 'sqlite') {
      return `sqlite:///${database}`
    }
    
    return `${driver}://${username}:${password}@${host}:${port}/${database}?charset=utf8mb4`
  }

  /**
   * 生成数据处理代码
   */
  generateDataProcessing(intent, parameters) {
    let processing = '# 数据处理\n'
    
    // 根据意图添加特定的数据处理逻辑
    switch (intent.type) {
      case 'sales_analysis':
        processing += `
        # 销售数据格式化
        if 'total_sales' in df.columns:
            df['total_sales'] = df['total_sales'].round(2)
        if 'avg_sales' in df.columns:
            df['avg_sales'] = df['avg_sales'].round(2)
        `
        break
        
      case 'time_analysis':
        processing += `
        # 时间数据格式化
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        `
        break
        
      default:
        processing += `
        # 通用数据处理
        # 处理空值
        df = df.fillna('')
        
        # 格式化数值列
        numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
        for col in numeric_columns:
            if df[col].dtype == 'float64':
                df[col] = df[col].round(2)
        `
    }
    
    return processing
  }

  /**
   * 构建完整的Python代码
   */
  buildPythonCode(config) {
    return this.pythonTemplate
      .replace('{connection_string}', config.connectionString)
      .replace('{sql_query}', config.sqlQuery)
      .replace('{query_params}', JSON.stringify(config.queryParams))
      .replace('{data_processing}', config.dataProcessing)
      .replace('{split_threshold}', config.splitThreshold)
      .replace('{max_return_rows}', config.maxReturnRows)
      .replace('{intent}', config.intent)
      .replace('{tables_used}', JSON.stringify(config.tablesUsed))
      .replace('{has_aggregation}', config.hasAggregation)
  }

  /**
   * 估算执行时间和资源
   */
  estimateExecution(sql, intent, parameters) {
    // 基础估算逻辑
    let baseTime = 1000 // 1秒基础时间
    let estimatedRows = 1000
    let memoryMB = 10
    let complexity = 'low'

    // 根据SQL复杂度调整
    if (sql.toLowerCase().includes('group by')) {
      baseTime *= 2
      complexity = 'medium'
    }
    
    if (sql.toLowerCase().includes('join')) {
      baseTime *= 3
      complexity = 'high'
    }
    
    // 根据意图调整估算
    switch (intent.type) {
      case 'sales_analysis':
        estimatedRows = parameters.limit || 5000
        memoryMB = Math.max(10, estimatedRows * 0.001)
        break
      case 'time_analysis':
        estimatedRows = parameters.recent_days ? parameters.recent_days * 100 : 3000
        memoryMB = Math.max(15, estimatedRows * 0.002)
        break
      default:
        estimatedRows = parameters.limit || 1000
        memoryMB = Math.max(5, estimatedRows * 0.0005)
    }

    return {
      time: baseTime,
      rows: estimatedRows,
      memory: memoryMB,
      complexity
    }
  }
}

module.exports = new PythonCodeGenerator()