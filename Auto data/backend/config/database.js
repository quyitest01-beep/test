const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const mockDatabase = require('./mockDatabase');

// 数据库连接池配置
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'athena_admin',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4',
  timezone: '+08:00'
};

// 创建连接池
let pool;
let useMockDb = false;

try {
  pool = mysql.createPool(poolConfig);
} catch (error) {
  logger.warn('MySQL连接池创建失败，将使用模拟数据库');
  useMockDb = true;
}

// 测试数据库连接
const testConnection = async () => {
  if (useMockDb) {
    return await mockDatabase.testConnection();
  }
  
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('✅ MySQL数据库连接成功');
    return true;
  } catch (error) {
    logger.error('❌ MySQL数据库连接失败:', error.message);
    logger.info('🔄 切换到模拟数据库模式');
    useMockDb = true;
    return await mockDatabase.testConnection();
  }
};

// 执行查询的封装函数
const execute = async (sql, params = []) => {
  if (useMockDb) {
    return await mockDatabase.execute(sql, params);
  }
  
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return [rows, fields];
  } catch (error) {
    logger.error('MySQL查询错误:', {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      params,
      error: error.message
    });
    
    // 如果MySQL查询失败，尝试切换到模拟数据库
    logger.info('🔄 MySQL查询失败，切换到模拟数据库');
    useMockDb = true;
    return await mockDatabase.execute(sql, params);
  }
};

// 执行查询（不使用预处理语句）
const query = async (sql) => {
  try {
    const [rows, fields] = await pool.query(sql);
    return [rows, fields];
  } catch (error) {
    logger.error('数据库查询错误:', {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      error: error.message
    });
    throw error;
  }
};

// 流式查询（分批获取数据，避免内存溢出）
const streamQuery = async (sql, options = {}) => {
  const {
    batchSize = 10000,
    onBatch = null,
    maxMemoryUsage = 1024 * 1024 * 512 // 默认512MB内存限制
  } = options;

  const connection = await pool.getConnection();
  
  return new Promise((resolve, reject) => {
    let currentBatch = [];
    let totalRows = 0;
    let currentMemory = 0;
    
    try {
      const stream = connection.query(sql).stream();
      
      stream.on('data', (row) => {
        currentBatch.push(row);
        totalRows++;
        
        // 估算内存使用（每行约1KB）
        currentMemory += 1024;
        
        // 检查批次大小或内存限制
        if (currentBatch.length >= batchSize || currentMemory >= maxMemoryUsage) {
          if (onBatch) {
            onBatch(currentBatch, totalRows);
          }
          currentBatch = [];
          currentMemory = 0;
        }
      });
      
      stream.on('end', () => {
        if (currentBatch.length > 0 && onBatch) {
          onBatch(currentBatch, totalRows);
        }
        connection.release();
        resolve({ totalRows, success: true });
      });
      
      stream.on('error', (error) => {
        connection.release();
        reject(error);
      });
      
    } catch (error) {
      connection.release();
      reject(error);
    }
  });
};

// 估算查询内存需求
const estimateQueryMemory = (sql) => {
  // 基于SQL复杂度估算内存需求
  let baseMemory = 1024 * 1024 * 10; // 10MB基础内存
  
  if (sql.includes('JOIN')) baseMemory *= 2;
  if (sql.includes('GROUP BY')) baseMemory *= 1.5;
  if (sql.includes('ORDER BY')) baseMemory *= 1.2;
  if (sql.includes('DISTINCT')) baseMemory *= 1.3;
  
  return baseMemory;
};

// 开始事务
const beginTransaction = async () => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
};

// 提交事务
const commit = async (connection) => {
  await connection.commit();
  connection.release();
};

// 回滚事务
const rollback = async (connection) => {
  await connection.rollback();
  connection.release();
};

// 获取连接池状态
const getPoolStatus = () => {
  return {
    totalConnections: pool.pool._allConnections.length,
    freeConnections: pool.pool._freeConnections.length,
    acquiringConnections: pool.pool._acquiringConnections.length,
    queuedRequests: pool.pool._connectionQueue.length
  };
};

// 优雅关闭连接池
const closePool = async () => {
  try {
    await pool.end();
    logger.info('数据库连接池已关闭');
  } catch (error) {
    logger.error('关闭数据库连接池失败:', error);
  }
};

// 监听进程退出事件，优雅关闭数据库连接
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);
process.on('exit', closePool);

// 初始化数据库连接
testConnection();

module.exports = {
  pool,
  execute,
  query,
  beginTransaction,
  commit,
  rollback,
  testConnection,
  getPoolStatus,
  closePool
};