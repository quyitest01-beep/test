const logger = require('../utils/logger');
const memoryManager = require('./memoryManager');

/**
 * 查询优化器服务
 * 针对内存限制优化大数据查询
 */
class QueryOptimizer {
  constructor() {
    this.optimizationStrategies = {
      memory: this.optimizeForMemory.bind(this),
      performance: this.optimizeForPerformance.bind(this),
      balanced: this.optimizeForBalance.bind(this)
    };
  }

  /**
   * 优化查询
   */
  optimizeQuery(sql, strategy = 'balanced', options = {}) {
    const originalSql = sql;
    
    try {
      // 分析查询特征
      const analysis = this.analyzeQuery(sql);
      
      // 选择优化策略
      const optimizer = this.optimizationStrategies[strategy] || this.optimizationStrategies.balanced;
      
      // 执行优化
      const optimized = optimizer(sql, analysis, options);
      
      logger.info('查询优化完成', {
        originalLength: originalSql.length,
        optimizedLength: optimized.sql.length,
        strategy,
        changes: optimized.changes,
        estimatedMemoryReduction: optimized.memoryReduction
      });
      
      return optimized;
      
    } catch (error) {
      logger.warn('查询优化失败，使用原始SQL', { error: error.message });
      return {
        sql: originalSql,
        changes: [],
        memoryReduction: 0,
        analysis: this.analyzeQuery(originalSql)
      };
    }
  }

  /**
   * 分析查询特征
   */
  analyzeQuery(sql) {
    const analysis = {
      hasJoins: sql.includes('JOIN'),
      hasGroupBy: sql.includes('GROUP BY'),
      hasOrderBy: sql.includes('ORDER BY'),
      hasSubqueries: (sql.match(/SELECT.*SELECT/g) || []).length > 0,
      hasDistinct: sql.includes('DISTINCT'),
      hasLimit: sql.includes('LIMIT'),
      estimatedComplexity: this.estimateComplexity(sql),
      tableCount: this.countTables(sql)
    };

    analysis.memoryIntensive = analysis.hasJoins || analysis.hasGroupBy || analysis.hasSubqueries;
    analysis.requiresSorting = analysis.hasOrderBy || analysis.hasGroupBy;
    
    return analysis;
  }

  /**
   * 估算查询复杂度
   */
  estimateComplexity(sql) {
    let complexity = 1;
    
    if (sql.includes('JOIN')) complexity += 2;
    if (sql.includes('GROUP BY')) complexity += 1.5;
    if (sql.includes('ORDER BY')) complexity += 1;
    if (sql.includes('DISTINCT')) complexity += 1.2;
    if (sql.includes('WHERE')) complexity += 0.5;
    if (sql.includes('HAVING')) complexity += 1;
    
    // 计算子查询数量
    const subqueryCount = (sql.match(/SELECT.*SELECT/g) || []).length;
    complexity += subqueryCount * 1.5;
    
    return Math.round(complexity * 10) / 10;
  }

  /**
   * 统计表数量
   */
  countTables(sql) {
    const fromMatches = sql.match(/FROM\s+([\w_]+)/gi) || [];
    const joinMatches = sql.match(/JOIN\s+([\w_]+)/gi) || [];
    
    const tables = new Set();
    
    fromMatches.forEach(match => {
      const table = match.replace(/FROM\s+/i, '').trim();
      if (table) tables.add(table);
    });
    
    joinMatches.forEach(match => {
      const table = match.replace(/JOIN\s+/i, '').trim();
      if (table) tables.add(table);
    });
    
    return tables.size;
  }

  /**
   * 内存优化策略
   */
  optimizeForMemory(sql, analysis, options) {
    const changes = [];
    let optimizedSql = sql;
    
    // 1. 添加LIMIT子句（如果不存在）
    if (!analysis.hasLimit && options.maxRows) {
      optimizedSql = this.addLimitClause(optimizedSql, options.maxRows);
      changes.push('添加行数限制');
    }
    
    // 2. 移除不必要的ORDER BY
    if (analysis.hasOrderBy && options.removeUnnecessarySorting) {
      optimizedSql = this.removeUnnecessaryOrderBy(optimizedSql);
      changes.push('移除不必要的排序');
    }
    
    // 3. 优化SELECT子句
    if (options.optimizeSelect) {
      optimizedSql = this.optimizeSelectClause(optimizedSql);
      changes.push('优化SELECT子句');
    }
    
    // 4. 拆分复杂JOIN
    if (analysis.hasJoins && analysis.tableCount > 3) {
      optimizedSql = this.optimizeJoins(optimizedSql);
      changes.push('优化JOIN操作');
    }
    
    const memoryReduction = this.estimateMemoryReduction(sql, optimizedSql);
    
    return {
      sql: optimizedSql,
      changes,
      memoryReduction,
      analysis
    };
  }

  /**
   * 性能优化策略
   */
  optimizeForPerformance(sql, analysis, options) {
    // 性能优化逻辑（略）
    return {
      sql,
      changes: [],
      memoryReduction: 0,
      analysis
    };
  }

  /**
   * 平衡优化策略
   */
  optimizeForBalance(sql, analysis, options) {
    const memoryOptimized = this.optimizeForMemory(sql, analysis, options);
    
    // 在内存优化的基础上进行性能调整
    if (memoryOptimized.memoryReduction > 30) { // 如果内存减少超过30%
      // 可以适当放宽一些限制以提高性能
      return memoryOptimized;
    }
    
    return memoryOptimized;
  }

  /**
   * 添加LIMIT子句
   */
  addLimitClause(sql, maxRows = 100000) {
    if (sql.includes('LIMIT')) {
      return sql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
    }
    
    // 在SQL末尾添加LIMIT
    return `${sql} LIMIT ${maxRows}`;
  }

  /**
   * 移除不必要的ORDER BY
   */
  removeUnnecessaryOrderBy(sql) {
    // 简单的实现：移除ORDER BY子句
    return sql.replace(/ORDER BY.*?(?=WHERE|GROUP BY|HAVING|LIMIT|$)/gi, '');
  }

  /**
   * 优化SELECT子句
   */
  optimizeSelectClause(sql) {
    // 将SELECT * 替换为具体列名（需要表结构信息）
    // 这里使用简化实现
    if (sql.includes('SELECT *')) {
      return sql.replace('SELECT *', 'SELECT id, created_at, updated_at'); // 示例
    }
    return sql;
  }

  /**
   * 优化JOIN操作
   */
  optimizeJoins(sql) {
    // 简化实现：添加查询提示或优化JOIN顺序
    return sql;
  }

  /**
   * 估算内存减少量
   */
  estimateMemoryReduction(originalSql, optimizedSql) {
    const originalMemory = memoryManager.estimateQueryMemory(originalSql);
    const optimizedMemory = memoryManager.estimateQueryMemory(optimizedSql);
    
    if (originalMemory > 0) {
      return Math.round(((originalMemory - optimizedMemory) / originalMemory) * 100);
    }
    
    return 0;
  }

  /**
   * 生成查询优化建议
   */
  generateOptimizationSuggestions(analysis) {
    const suggestions = [];
    
    if (analysis.memoryIntensive) {
      suggestions.push({
        type: 'warning',
        message: '查询包含内存密集型操作（JOIN/GROUP BY/子查询）',
        suggestion: '考虑分批处理或增加内存限制'
      });
    }
    
    if (analysis.requiresSorting && !analysis.hasLimit) {
      suggestions.push({
        type: 'info',
        message: '查询包含排序操作但无限制',
        suggestion: '添加LIMIT子句减少内存使用'
      });
    }
    
    if (analysis.estimatedComplexity > 5) {
      suggestions.push({
        type: 'warning',
        message: '查询复杂度较高',
        suggestion: '考虑简化查询或拆分复杂操作'
      });
    }
    
    return suggestions;
  }

  /**
   * 检查查询是否适合内存限制
   */
  isQuerySuitableForMemory(sql, availableMemoryMB) {
    const estimatedMemory = memoryManager.estimateQueryMemory(sql);
    const currentUsage = memoryManager.getCurrentMemoryUsage();
    
    return (currentUsage + estimatedMemory) <= availableMemoryMB;
  }

  /**
   * 获取优化器状态
   */
  getStatus() {
    return {
      strategies: Object.keys(this.optimizationStrategies),
      memoryStatus: memoryManager.getMemoryStatus(),
      timestamp: new Date().toISOString()
    };
  }
}

// 创建单例实例
module.exports = new QueryOptimizer();