const mysql = require('mysql2/promise')
const { Pool } = require('pg')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const sql = require('mssql')
const oracledb = require('oracledb')
const logger = require('../utils/logger')

class DatabaseConnector {
  constructor() {
    this.connections = new Map() // 连接池缓存
    this.connectionTimeout = 30000 // 30秒连接超时
    this.queryTimeout = 300000 // 5分钟查询超时
    
    // 数据库驱动配置
    this.driverConfig = {
      mysql: {
        maxConnections: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
      },
      postgresql: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000
      },
      sqlite: {
        timeout: 30000,
        busyTimeout: 30000
      },
      sqlserver: {
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          encrypt: true,
          trustServerCertificate: true
        }
      },
      oracle: {
        poolMax: 10,
        poolMin: 0,
        poolIncrement: 1,
        poolTimeout: 60
      }
    }
  }

  /**
   * 从环境变量获取数据库配置
   */
  getConfigFromEnv() {
    const config = {
      type: process.env.DB_TYPE || 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'athena_query',
      ssl: process.env.DB_SSL === 'true',
      timeout: parseInt(process.env.DB_TIMEOUT) || 30000,
      maxConnections: parseInt(process.env.DB_CONNECTION_LIMIT) || 10
    }

    // 根据数据库类型添加特定配置
    switch (config.type) {
      case 'sqlite':
        config.database = process.env.DB_SQLITE_PATH || './database/data.sqlite'
        break
      case 'postgresql':
        config.schema = process.env.DB_POSTGRES_SCHEMA || 'public'
        if (config.port === 3306) config.port = 5432 // 默认PostgreSQL端口
        break
      case 'sqlserver':
        config.encrypt = process.env.DB_SQLSERVER_ENCRYPT === 'true'
        config.trustServerCertificate = process.env.DB_SQLSERVER_TRUST_CERT === 'true'
        if (config.port === 3306) config.port = 1433 // 默认SQL Server端口
        break
      case 'oracle':
        config.serviceName = process.env.DB_ORACLE_SERVICE_NAME || 'ORCL'
        if (config.port === 3306) config.port = 1521 // 默认Oracle端口
        break
    }

    return config
  }

  /**
   * 获取默认数据库连接（从环境变量）
   */
  async getDefaultConnection() {
    const config = this.getConfigFromEnv()
    return await this.getConnection(config)
  }

  /**
   * 获取数据库连接
   */
  async getConnection(config) {
    const connectionKey = this.generateConnectionKey(config)
    
    // 检查是否已有连接
    if (this.connections.has(connectionKey)) {
      const connection = this.connections.get(connectionKey)
      if (await this.testConnection(connection, config.type)) {
        return connection
      } else {
        // 连接失效，移除并重新创建
        this.connections.delete(connectionKey)
        await this.closeConnection(connection, config.type)
      }
    }
    
    // 创建新连接
    const connection = await this.createConnection(config)
    this.connections.set(connectionKey, connection)
    
    return connection
  }

  /**
   * 生成连接键
   */
  generateConnectionKey(config) {
    const { type, host, port, database, username } = config
    return `${type}://${username}@${host}:${port}/${database}`
  }

  /**
   * 创建数据库连接
   */
  async createConnection(config) {
    const { type } = config
    
    logger.info('创建数据库连接', { 
      type,
      host: config.host,
      database: config.database
    })
    
    try {
      switch (type) {
        case 'mysql':
          return await this.createMySQLConnection(config)
        case 'postgresql':
          return await this.createPostgreSQLConnection(config)
        case 'sqlite':
          return await this.createSQLiteConnection(config)
        case 'sqlserver':
          return await this.createSQLServerConnection(config)
        case 'oracle':
          return await this.createOracleConnection(config)
        default:
          throw new Error(`不支持的数据库类型: ${type}`)
      }
    } catch (error) {
      logger.error('数据库连接创建失败', { 
        type,
        error: error.message
      })
      throw new Error(`数据库连接失败: ${error.message}`)
    }
  }

  /**
   * 创建MySQL连接
   */
  async createMySQLConnection(config) {
    const { host, port, username, password, database } = config
    const driverConfig = this.driverConfig.mysql
    
    const pool = mysql.createPool({
      host,
      port,
      user: username,
      password,
      database,
      waitForConnections: true,
      connectionLimit: driverConfig.maxConnections,
      queueLimit: 0,
      acquireTimeout: driverConfig.acquireTimeout,
      timeout: driverConfig.timeout,
      reconnect: driverConfig.reconnect,
      charset: 'utf8mb4',
      timezone: '+00:00'
    })
    
    // 测试连接
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    
    return {
      type: 'mysql',
      pool,
      execute: async (sql, params = []) => {
        const [rows] = await pool.execute(sql, params)
        return rows
      },
      close: async () => {
        await pool.end()
      }
    }
  }

  /**
   * 创建PostgreSQL连接
   */
  async createPostgreSQLConnection(config) {
    const { host, port, username, password, database } = config
    const driverConfig = this.driverConfig.postgresql
    
    const pool = new Pool({
      host,
      port,
      user: username,
      password,
      database,
      ...driverConfig
    })
    
    // 测试连接
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    
    return {
      type: 'postgresql',
      pool,
      execute: async (sql, params = []) => {
        const client = await pool.connect()
        try {
          const result = await client.query(sql, params)
          return result.rows
        } finally {
          client.release()
        }
      },
      close: async () => {
        await pool.end()
      }
    }
  }

  /**
   * 创建SQLite连接
   */
  async createSQLiteConnection(config) {
    const { database } = config
    const driverConfig = this.driverConfig.sqlite
    
    const db = await open({
      filename: database,
      driver: sqlite3.Database
    })
    
    // 设置超时
    await db.run(`PRAGMA busy_timeout = ${driverConfig.busyTimeout}`)
    
    // 测试连接
    await db.get('SELECT 1')
    
    return {
      type: 'sqlite',
      db,
      execute: async (sql, params = []) => {
        if (sql.trim().toLowerCase().startsWith('select')) {
          return await db.all(sql, params)
        } else {
          const result = await db.run(sql, params)
          return { affectedRows: result.changes, insertId: result.lastID }
        }
      },
      close: async () => {
        await db.close()
      }
    }
  }

  /**
   * 创建SQL Server连接
   */
  async createSQLServerConnection(config) {
    const { host, port, username, password, database } = config
    const driverConfig = this.driverConfig.sqlserver
    
    const poolConfig = {
      server: host,
      port,
      user: username,
      password,
      database,
      ...driverConfig
    }
    
    const pool = new sql.ConnectionPool(poolConfig)
    await pool.connect()
    
    // 测试连接
    const request = pool.request()
    await request.query('SELECT 1')
    
    return {
      type: 'sqlserver',
      pool,
      execute: async (sqlQuery, params = []) => {
        const request = pool.request()
        
        // 添加参数
        params.forEach((param, index) => {
          request.input(`param${index}`, param)
        })
        
        const result = await request.query(sqlQuery)
        return result.recordset
      },
      close: async () => {
        await pool.close()
      }
    }
  }

  /**
   * 创建Oracle连接
   */
  async createOracleConnection(config) {
    const { host, port, username, password, database } = config
    const driverConfig = this.driverConfig.oracle
    
    const poolConfig = {
      user: username,
      password,
      connectString: `${host}:${port}/${database}`,
      ...driverConfig
    }
    
    const pool = await oracledb.createPool(poolConfig)
    
    // 测试连接
    const connection = await pool.getConnection()
    await connection.execute('SELECT 1 FROM DUAL')
    await connection.close()
    
    return {
      type: 'oracle',
      pool,
      execute: async (sql, params = []) => {
        const connection = await pool.getConnection()
        try {
          const result = await connection.execute(sql, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
          })
          return result.rows
        } finally {
          await connection.close()
        }
      },
      close: async () => {
        await pool.close()
      }
    }
  }

  /**
   * 执行查询
   */
  async executeQuery(config, sql, params = [], options = {}) {
    const {
      timeout = this.queryTimeout,
      maxRows = 100000,
      fetchSize = 1000
    } = options
    
    const startTime = Date.now()
    let connection
    
    try {
      logger.info('执行数据库查询', { 
        type: config.type,
        sql: sql.substring(0, 200),
        paramsCount: params.length
      })
      
      // 获取连接
      connection = await this.getConnection(config)
      
      // 设置查询超时
      const queryPromise = connection.execute(sql, params)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('查询超时')), timeout)
      })
      
      // 执行查询
      const rows = await Promise.race([queryPromise, timeoutPromise])
      
      const endTime = Date.now()
      const executionTime = endTime - startTime
      
      // 检查结果大小
      const rowCount = Array.isArray(rows) ? rows.length : 0
      const limitedRows = rowCount > maxRows ? rows.slice(0, maxRows) : rows
      
      logger.info('数据库查询完成', { 
        type: config.type,
        rowCount,
        executionTime,
        limited: rowCount > maxRows
      })
      
      return {
        success: true,
        data: limitedRows,
        row_count: rowCount,
        execution_time: executionTime,
        limited: rowCount > maxRows,
        columns: this.extractColumns(limitedRows),
        statistics: {
          execution_time: executionTime,
          rows_returned: rowCount,
          rows_limited: rowCount > maxRows ? maxRows : rowCount,
          memory_usage: this.estimateMemoryUsage(limitedRows)
        }
      }
      
    } catch (error) {
      const endTime = Date.now()
      const executionTime = endTime - startTime
      
      logger.error('数据库查询失败', { 
        type: config.type,
        error: error.message,
        executionTime
      })
      
      return {
        success: false,
        error: error.message,
        error_type: error.constructor.name,
        execution_time: executionTime,
        data: [],
        row_count: 0
      }
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(connection, type) {
    try {
      switch (type) {
        case 'mysql':
          const conn = await connection.pool.getConnection()
          await conn.ping()
          conn.release()
          return true
        case 'postgresql':
          const client = await connection.pool.connect()
          await client.query('SELECT 1')
          client.release()
          return true
        case 'sqlite':
          await connection.db.get('SELECT 1')
          return true
        case 'sqlserver':
          const request = connection.pool.request()
          await request.query('SELECT 1')
          return true
        case 'oracle':
          const oracleConn = await connection.pool.getConnection()
          await oracleConn.execute('SELECT 1 FROM DUAL')
          await oracleConn.close()
          return true
        default:
          return false
      }
    } catch (error) {
      logger.warn('连接测试失败', { type, error: error.message })
      return false
    }
  }

  /**
   * 提取列信息
   */
  extractColumns(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return []
    }
    
    const firstRow = rows[0]
    if (typeof firstRow !== 'object' || firstRow === null) {
      return []
    }
    
    return Object.keys(firstRow).map(key => ({
      name: key,
      type: this.inferColumnType(firstRow[key])
    }))
  }

  /**
   * 推断列类型
   */
  inferColumnType(value) {
    if (value === null || value === undefined) {
      return 'unknown'
    }
    
    const type = typeof value
    
    switch (type) {
      case 'number':
        return Number.isInteger(value) ? 'integer' : 'decimal'
      case 'string':
        // 检查是否是日期格式
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
          return 'date'
        }
        return 'string'
      case 'boolean':
        return 'boolean'
      case 'object':
        if (value instanceof Date) {
          return 'datetime'
        }
        return 'object'
      default:
        return type
    }
  }

  /**
   * 估算内存使用
   */
  estimateMemoryUsage(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 0
    }
    
    // 简单估算：每行平均大小 * 行数
    const sampleRow = rows[0]
    const rowSize = JSON.stringify(sampleRow).length
    const totalSize = rowSize * rows.length
    
    return Math.round(totalSize / 1024) // 返回KB
  }

  /**
   * 关闭连接
   */
  async closeConnection(connection, type) {
    try {
      if (connection && connection.close) {
        await connection.close()
      }
      logger.debug('数据库连接已关闭', { type })
    } catch (error) {
      logger.warn('关闭数据库连接失败', { 
        type,
        error: error.message
      })
    }
  }

  /**
   * 关闭所有连接
   */
  async closeAllConnections() {
    const promises = []
    
    for (const [key, connection] of this.connections.entries()) {
      const type = key.split('://')[0]
      promises.push(this.closeConnection(connection, type))
    }
    
    await Promise.all(promises)
    this.connections.clear()
    
    logger.info('所有数据库连接已关闭')
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    const stats = {
      total_connections: this.connections.size,
      connections_by_type: {},
      active_connections: []
    }
    
    for (const [key, connection] of this.connections.entries()) {
      const type = key.split('://')[0]
      
      if (!stats.connections_by_type[type]) {
        stats.connections_by_type[type] = 0
      }
      stats.connections_by_type[type]++
      
      stats.active_connections.push({
        key,
        type,
        created_at: connection.created_at || new Date().toISOString()
      })
    }
    
    return stats
  }
}

module.exports = new DatabaseConnector()