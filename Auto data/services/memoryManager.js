const os = require('os');
const logger = require('../utils/logger');

/**
 * 内存管理服务
 * 处理大数据查询时的内存限制和优化
 */
class MemoryManager {
  constructor() {
    this.maxMemoryMB = 4096; // 默认最大使用4GB内存
    this.safeThreshold = 0.8; // 安全阈值80%
    this.monitoringInterval = 1000; // 监控间隔1秒
    this.activeQueries = new Map();
  }

  /**
   * 初始化内存管理器
   */
  initialize(maxMemoryMB = 4096) {
    this.maxMemoryMB = maxMemoryMB;
    logger.info('内存管理器已初始化', { 
      maxMemoryMB: this.maxMemoryMB,
      totalSystemMemory: Math.round(os.totalmem() / 1024 / 1024)
    });
    
    // 启动内存监控
    this.startMonitoring();
  }

  /**
   * 启动内存监控
   */
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitoringInterval);
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usagePercentage = (usedMB / this.maxMemoryMB) * 100;

    if (usagePercentage > 90) {
      logger.warn('内存使用率超过90%', {
        usedMB,
        totalMB,
        maxMemoryMB: this.maxMemoryMB,
        usagePercentage: usagePercentage.toFixed(2) + '%',
        activeQueries: this.activeQueries.size
      });
    }

    if (usagePercentage > 95) {
      this.triggerMemoryProtection();
    }
  }

  /**
   * 触发内存保护机制
   */
  triggerMemoryProtection() {
    logger.error('内存使用率超过95%，触发保护机制');
    
    // 1. 暂停新的查询
    // 2. 终止最耗内存的查询
    // 3. 清理缓存
    this.cleanupMemory();
  }

  /**
   * 清理内存
   */
  cleanupMemory() {
    // 清理Node.js内存
    if (global.gc) {
      global.gc();
      logger.info('强制执行垃圾回收');
    }

    // 终止部分查询
    this.terminateMemoryIntensiveQueries();
  }

  /**
   * 终止内存密集型查询
   */
  terminateMemoryIntensiveQueries() {
    const queries = Array.from(this.activeQueries.entries())
      .sort((a, b) => b[1].memoryUsage - a[1].memoryUsage)
      .slice(0, Math.ceil(this.activeQueries.size * 0.3)); // 终止30%最耗内存的查询

    queries.forEach(([queryId, queryInfo]) => {
      logger.warn('终止内存密集型查询', { queryId, memoryUsage: queryInfo.memoryUsage });
      this.removeQuery(queryId);
      // 这里应该调用实际的查询终止逻辑
    });
  }

  /**
   * 注册查询
   */
  registerQuery(queryId, estimatedMemory) {
    this.activeQueries.set(queryId, {
      memoryUsage: estimatedMemory,
      startTime: Date.now(),
      estimatedMemory
    });
  }

  /**
   * 更新查询内存使用
   */
  updateQueryMemory(queryId, memoryUsage) {
    const queryInfo = this.activeQueries.get(queryId);
    if (queryInfo) {
      queryInfo.memoryUsage = memoryUsage;
    }
  }

  /**
   * 移除查询
   */
  removeQuery(queryId) {
    this.activeQueries.delete(queryId);
  }

  /**
   * 检查是否可以执行新查询
   */
  canExecuteQuery(estimatedMemory) {
    const currentUsage = this.getCurrentMemoryUsage();
    const projectedUsage = currentUsage + estimatedMemory;
    
    return projectedUsage <= this.maxMemoryMB * this.safeThreshold;
  }

  /**
   * 获取当前内存使用
   */
  getCurrentMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return Math.round(memoryUsage.heapUsed / 1024 / 1024);
  }

  /**
   * 估算查询内存需求
   */
  estimateQueryMemory(sql, expectedRows = 10000) {
    // 基础内存需求（MB）
    let baseMemory = 10;
    
    // 基于SQL复杂度调整
    const complexityFactors = {
      join: sql.includes('JOIN') ? 2 : 1,
      groupBy: sql.includes('GROUP BY') ? 1.5 : 1,
      orderBy: sql.includes('ORDER BY') ? 1.2 : 1,
      distinct: sql.includes('DISTINCT') ? 1.3 : 1,
      subquery: (sql.match(/SELECT.*SELECT/g) || []).length > 0 ? 1.4 : 1
    };

    // 基于预期行数调整（每万行约1MB）
    const rowFactor = Math.max(1, expectedRows / 10000);
    
    // 计算总内存需求
    const totalMemory = baseMemory * 
      complexityFactors.join *
      complexityFactors.groupBy *
      complexityFactors.orderBy *
      complexityFactors.distinct *
      complexityFactors.subquery *
      rowFactor;

    return Math.round(totalMemory);
  }

  /**
   * 获取内存状态报告
   */
  getMemoryStatus() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemory = Math.round(os.freemem() / 1024 / 1024);
    
    return {
      process: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      system: {
        total: systemMemory,
        free: freeMemory,
        used: systemMemory - freeMemory
      },
      limits: {
        maxAllowed: this.maxMemoryMB,
        safeThreshold: this.maxMemoryMB * this.safeThreshold
      },
      activeQueries: this.activeQueries.size,
      timestamp: new Date().toISOString()
    };
  }
}

// 创建单例实例
module.exports = new MemoryManager();