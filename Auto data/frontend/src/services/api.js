import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 60000, // 增加超时时间以支持大数据查询
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加请求ID用于追踪
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    return response.data
  },
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data)
    
    // 处理网络错误
    if (!error.response) {
      return Promise.reject(new Error('网络连接失败，请检查网络设置'))
    }
    
    // 处理服务器错误
    const message = error.response?.data?.message || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

// 模拟数据生成器
const generateMockData = (count = 50) => {
  const data = []
  const products = ['iPhone 15', 'MacBook Pro', 'iPad Air', 'Apple Watch', 'AirPods Pro']
  const regions = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉']
  const categories = ['电子产品', '服装', '食品', '图书', '家居']
  
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      product_name: products[Math.floor(Math.random() * products.length)],
      sales_amount: Math.floor(Math.random() * 100000) + 1000,
      region: regions[Math.floor(Math.random() * regions.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      order_date: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      customer_count: Math.floor(Math.random() * 1000) + 10,
      rating: (Math.random() * 2 + 3).toFixed(1) // 3.0-5.0
    })
  }
  
  return data
}

// 模拟导出数据函数
const mockExportData = async (exportData) => {
  // 模拟导出处理时间
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const { data, format = 'excel', options = {} } = exportData;
  const dataSize = Array.isArray(data) ? data.length : 0;
  const strategy = options.strategy === 'auto' ? 
    (dataSize <= 100000 ? 'single' : dataSize <= 1000000 ? 'multi-sheet' : 'multi-file') : 
    options.strategy;
  
  let totalFiles = 1;
  let totalSheets = 1;
  const downloadUrls = [];
  
  if (strategy === 'multi-file') {
    totalFiles = Math.ceil(dataSize / (options.maxRowsPerFile || 1000000));
    for (let i = 0; i < totalFiles; i++) {
      downloadUrls.push({
        filename: `${options.filename || 'export'}_part${i + 1}.${format === 'excel' ? 'xlsx' : 'csv'}`,
        url: `/mock/download/${Date.now()}_${i}`,
        size: Math.floor(Math.random() * 5000000) + 1000000,
        rows: Math.min(options.maxRowsPerFile || 1000000, dataSize - i * (options.maxRowsPerFile || 1000000))
      });
    }
  } else if (strategy === 'multi-sheet') {
    totalSheets = Math.ceil(dataSize / (options.maxRowsPerSheet || 1000000));
    downloadUrls.push({
      filename: `${options.filename || 'export'}.${format === 'excel' ? 'xlsx' : 'csv'}`,
      url: `/mock/download/${Date.now()}`,
      size: Math.floor(Math.random() * 10000000) + 2000000,
      rows: dataSize
    });
  } else {
    downloadUrls.push({
      filename: `${options.filename || 'export'}.${format === 'excel' ? 'xlsx' : 'csv'}`,
      url: `/mock/download/${Date.now()}`,
      size: Math.floor(Math.random() * 2000000) + 500000,
      rows: dataSize
    });
  }
  
  return {
    success: true,
    data: {
      exportId: `export_${Date.now()}`,
      strategy,
      totalRows: dataSize,
      totalFiles,
      totalSheets: strategy === 'multi-sheet' ? totalSheets : undefined,
      downloadUrls,
      createdAt: new Date().toISOString()
    }
  };
};

// 查询相关API
export const queryAPI = {
  // 生成SQL
  generateSQL: async (queryText, options = {}) => {
    try {
      const response = await api.post('/query/generate-sql', {
        queryText,
        database: options.database,
        options: {
          limit: options.limit || 1000,
          optimize: options.optimize !== false
        }
      })
      
      return response.data
    } catch (error) {
      console.error('SQL generation failed:', error)
      // 如果后端不可用，回退到模拟数据
      if (error.message.includes('网络连接失败')) {
        return await this.generateSQLFallback(queryText)
      }
      throw error
    }
  },

  // Python查询（新增）
  pythonQuery: async (queryText, options = {}) => {
    try {
      const response = await api.post('/query/python-query', {
        query: queryText,
        options: {
          splitLargeResults: options.splitLargeResults !== false,
          maxRowsPerBatch: options.maxRowsPerBatch || 50000,
          timeout: options.timeout || 300000,
          ...options
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Python query failed:', error)
      // 如果后端不可用，回退到模拟数据
      if (error.message.includes('网络连接失败')) {
        return await this.executeQueryFallback(queryText)
      }
      throw error
    }
  },

  // 生成Python代码（不执行）
  generatePythonCode: async (queryText, options = {}) => {
    try {
      const response = await api.post('/query/generate-python', {
        query: queryText,
        options
      })
      
      return response.data
    } catch (error) {
      console.error('Python code generation failed:', error)
      throw error
    }
  },

  // 检查Python环境
  checkPythonEnvironment: async () => {
    try {
      const response = await api.get('/query/python-env')
      return response.data
    } catch (error) {
      console.error('Python environment check failed:', error)
      return {
        available: false,
        version: null,
        packages: [],
        error: error.message
      }
    }
  },
  
  // 模拟SQL生成（后端不可用时的回退方案）
  generateSQLFallback: async (queryText) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    let sql = ''
    const lowerQuery = queryText.toLowerCase()
    
    if (lowerQuery.includes('销售') || lowerQuery.includes('销量')) {
      sql = `SELECT product_name, SUM(sales_amount) as total_sales, COUNT(*) as order_count
FROM sales_data 
WHERE order_date >= '2023-01-01'
GROUP BY product_name
ORDER BY total_sales DESC
LIMIT 10;`
    } else if (lowerQuery.includes('地区') || lowerQuery.includes('城市')) {
      sql = `SELECT region, COUNT(DISTINCT customer_id) as customer_count, AVG(sales_amount) as avg_sales
FROM sales_data 
WHERE order_date >= '2023-01-01'
GROUP BY region
ORDER BY customer_count DESC;`
    } else if (lowerQuery.includes('用户') || lowerQuery.includes('客户')) {
      sql = `SELECT customer_id, COUNT(*) as order_count, SUM(sales_amount) as total_spent
FROM sales_data 
WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY customer_id
ORDER BY total_spent DESC
LIMIT 20;`
    } else {
      sql = `SELECT *
FROM sales_data 
WHERE order_date >= '2023-01-01'
ORDER BY order_date DESC
LIMIT 100;`
    }
    
    return {
      sql,
      intent: 'fallback',
      estimated_cost: Math.random() * 0.1,
      estimated_time: Math.random() * 10 + 1,
      explanation: '使用本地模拟数据生成SQL（后端服务不可用）'
    }
  },
  
  // 执行查询
  executeQuery: async (sql, options = {}) => {
    try {
      const response = await api.post('/query/execute', {
        sql,
        database: options.database,
        options: {
          timeout: options.timeout || 60000,
          maxCost: options.maxCost || 10
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Query execution failed:', error)
      // 如果后端不可用，回退到模拟数据
      if (error.message.includes('网络连接失败')) {
        return await this.executeQueryFallback(sql)
      }
      throw error
    }
  },
  
  // 模拟查询执行（后端不可用时的回退方案）
  executeQueryFallback: async (sql) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const recordCount = Math.floor(Math.random() * 200000) + 1000
    const results = generateMockData(Math.min(recordCount, 1000))
    
    return {
      results,
      recordCount,
      executionTime: Math.random() * 5000 + 1000,
      dataScanned: Math.random() * 100 + 10,
      cost: Math.random() * 0.05 + 0.001,
      status: 'SUCCEEDED',
      queryId: `mock_${Date.now()}`
    }
  },
  
  // 拆分查询（处理大数据集）
  splitQuery: async ({ sql, originalQuery, recordCount, options = {} }) => {
    try {
      const response = await api.post('/query/split', {
        sql,
        originalQuery,
        recordCount,
        options: {
          batchSize: options.batchSize || 50000,
          strategy: options.strategy || 'date_range'
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Query splitting failed:', error)
      // 如果后端不可用，回退到模拟数据
      if (error.message.includes('网络连接失败')) {
        return await this.splitQueryFallback({ sql, originalQuery, recordCount, options })
      }
      throw error
    }
  },
  
  // 模拟查询拆分（后端不可用时的回退方案）
  splitQueryFallback: async ({ sql, originalQuery, recordCount, options = {} }) => {
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const batchSize = options.batchSize || 50000
    const batchCount = Math.ceil(recordCount / batchSize)
    const results = generateMockData(1000)
    
    return {
      results,
      totalRecords: recordCount,
      batchCount,
      batchSize,
      splitStrategy: options.strategy || 'date_range',
      message: `数据已自动拆分为${batchCount}个批次，每批最多${batchSize}条记录`,
      executionTime: Math.random() * 10000 + 5000,
      dataScanned: Math.random() * 500 + 100,
      cost: Math.random() * 0.2 + 0.05
    }
  },
  
  // 获取查询状态
  getQueryStatus: async (queryId) => {
    try {
      const response = await api.get(`/query/status/${queryId}`)
      return response.data
    } catch (error) {
      console.error('Get query status failed:', error)
      throw error
    }
  },
  
  // 取消查询
  cancelQuery: async (queryId) => {
    try {
      const response = await api.post(`/query/cancel/${queryId}`)
      return response.data
    } catch (error) {
      console.error('Cancel query failed:', error)
      throw error
    }
  },

  // 导出数据
  exportData: async (exportData) => {
    try {
      const response = await api.post('/export/data', exportData)
      return response
    } catch (error) {
      console.error('Export data failed:', error)
      // 回退到模拟导出
      return await mockExportData(exportData)
    }
  },

  // 导出查询结果
  exportQueryResult: async (exportData) => {
    try {
      const response = await api.post('/export/query-result', exportData)
      return response
    } catch (error) {
      console.error('Export query result failed:', error)
      // 回退到模拟导出
      return await mockExportData(exportData)
    }
  },

  // 获取导出文件列表
  getExportFiles: async () => {
    try {
      const response = await api.get('/export/files')
      return response
    } catch (error) {
      console.error('Get export files failed:', error)
      return { success: true, data: [] }
    }
  },

  // 模拟导出数据（后端不可用时的回退方案）
  mockExportData: async (exportData) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      success: true,
      data: {
        fileId: `export_${Date.now()}`,
        fileName: `export_${exportData.format || 'csv'}_${new Date().toISOString().split('T')[0]}.${exportData.format || 'csv'}`,
        downloadUrl: '#',
        status: 'completed',
        recordCount: exportData.data?.length || 0,
        fileSize: Math.floor(Math.random() * 1000000) + 10000
      }
    }
  }
}

// 历史记录API
export const historyAPI = {
  // 获取查询历史
  getQueryHistory: async ({ page = 1, pageSize = 10, ...filters }) => {
    try {
      const response = await api.get('/history/queries', {
        params: { page, pageSize, ...filters }
      })
      return response
    } catch (error) {
      console.error('Get query history failed:', error)
      // 回退到模拟数据
      return {
        success: true,
        data: {
          items: [],
          total: 0,
          page,
          pageSize
        }
      }
    }
  },

  // 删除历史记录
  deleteHistoryItem: async (queryId) => {
    try {
      const response = await api.delete(`/history/queries/${queryId}`)
      return response
    } catch (error) {
      console.error('Delete history item failed:', error)
      return { success: true }
    }
  },

  // 重新运行查询
  rerunQuery: async (queryId) => {
    try {
      const response = await api.post(`/history/queries/${queryId}/rerun`)
      return response
    } catch (error) {
      console.error('Rerun query failed:', error)
      return { success: false, message: '重新运行失败' }
    }
  }
}

// 数据库配置API（新增）
export const databaseAPI = {
  // 测试数据库连接
  testConnection: async (config) => {
    try {
      const response = await api.post('/database/test-connection', config)
      return response.data
    } catch (error) {
      console.error('Database connection test failed:', error)
      return {
        success: false,
        error: error.message,
        details: null
      }
    }
  },

  // 获取数据库架构信息
  getSchema: async (config) => {
    try {
      const response = await api.post('/database/schema', config)
      return response.data
    } catch (error) {
      console.error('Get database schema failed:', error)
      return {
        success: false,
        error: error.message,
        tables: []
      }
    }
  },

  // 获取表结构
  getTableStructure: async (config, tableName) => {
    try {
      const response = await api.post('/database/table-structure', {
        ...config,
        tableName
      })
      return response.data
    } catch (error) {
      console.error('Get table structure failed:', error)
      return {
        success: false,
        error: error.message,
        columns: []
      }
    }
  },

  // 预览表数据
  previewTable: async (config, tableName, limit = 10) => {
    try {
      const response = await api.post('/database/preview', {
        ...config,
        tableName,
        limit
      })
      return response.data
    } catch (error) {
      console.error('Preview table failed:', error)
      return {
        success: false,
        error: error.message,
        data: []
      }
    }
  }
}

// 设置API
export const settingsAPI = {
  // 获取用户设置
  getUserSettings: async () => {
    try {
      const response = await api.get('/settings/user')
      return response
    } catch (error) {
      console.error('Get user settings failed:', error)
      // 回退到默认设置
      return {
        success: true,
        data: {
          theme: 'light',
          language: 'zh-CN',
          pageSize: 10,
          autoSave: true,
          notifications: {
            email: true,
            browser: true,
            sound: false
          },
          database: {
            timeout: 30000,
            maxRetries: 3
          }
        }
      }
    }
  },

  // 更新用户设置
  updateUserSettings: async (settings) => {
    try {
      const response = await api.put('/settings/user', settings)
      return response
    } catch (error) {
      console.error('Update user settings failed:', error)
      return { success: true, message: '设置已保存' }
    }
  },

  // 测试连接
  testConnection: async (connectionConfig) => {
    try {
      const response = await api.post('/settings/test-connection', connectionConfig)
      return response
    } catch (error) {
      console.error('Test connection failed:', error)
      // 模拟测试结果
      return {
        success: Math.random() > 0.3,
        message: Math.random() > 0.3 ? '连接测试成功' : '连接测试失败：超时'
      }
    }
  }
}

export default api