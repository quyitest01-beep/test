import React, { useState, useEffect } from 'react'
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Modal,
  message,
  Spin,
  Tabs,
  Switch,
  Tooltip
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
  ClearOutlined,
  DatabaseOutlined,
  CodeOutlined,
  SettingOutlined
} from '@ant-design/icons'
import SQLPreview from '../components/SQLPreview'
import QueryStatus from '../components/QueryStatus'
import ResultTable from '../components/ResultTable'
import ExportModal from '../components/ExportModal'

import { queryAPI } from '../services/api'

const { TextArea } = Input
const { Title } = Typography
const { TabPane } = Tabs

const QueryPage = () => {
  const [queryText, setQueryText] = useState('')
  const [generatedSQL, setGeneratedSQL] = useState('')
  const [generatedPythonCode, setGeneratedPythonCode] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [executionTime, setExecutionTime] = useState(0)
  const [recordCount, setRecordCount] = useState(0)
  const [sqlPreviewVisible, setSqlPreviewVisible] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  
  // 新增状态
  const [usePythonQuery, setUsePythonQuery] = useState(true)
  const [pythonEnvStatus, setPythonEnvStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('query')
  
  // 预设查询示例
  const queryExamples = [
    {
      title: "销售数据分析",
      description: "查询2023年销售额最高的10个产品",
      sql: "SELECT product_name, SUM(sales_amount) as total_sales FROM sales WHERE year = 2023 GROUP BY product_name ORDER BY total_sales DESC LIMIT 10",
      mockData: [
        { product_name: "iPhone 15 Pro", total_sales: 2580000 },
        { product_name: "MacBook Air M2", total_sales: 1950000 },
        { product_name: "iPad Pro", total_sales: 1420000 },
        { product_name: "AirPods Pro", total_sales: 980000 },
        { product_name: "Apple Watch Series 9", total_sales: 850000 },
        { product_name: "Mac Studio", total_sales: 720000 },
        { product_name: "iPhone 15", total_sales: 680000 },
        { product_name: "iPad Air", total_sales: 540000 },
        { product_name: "MacBook Pro 14", total_sales: 480000 },
        { product_name: "HomePod", total_sales: 320000 }
      ]
    },
    {
      title: "用户统计分析",
      description: "统计每个地区的用户数量和平均年龄",
      sql: "SELECT region, COUNT(*) as user_count, AVG(age) as avg_age FROM users GROUP BY region ORDER BY user_count DESC",
      mockData: [
        { region: "北京", user_count: 15420, avg_age: 28.5 },
        { region: "上海", user_count: 13280, avg_age: 30.2 },
        { region: "广州", user_count: 9850, avg_age: 27.8 },
        { region: "深圳", user_count: 8960, avg_age: 29.1 },
        { region: "杭州", user_count: 6740, avg_age: 26.9 },
        { region: "成都", user_count: 5820, avg_age: 28.3 },
        { region: "武汉", user_count: 4950, avg_age: 27.6 },
        { region: "西安", user_count: 4320, avg_age: 28.8 }
      ]
    },
    {
      title: "订单趋势分析",
      description: "分析最近30天每日订单数量趋势",
      sql: "SELECT DATE(order_date) as date, COUNT(*) as order_count FROM orders WHERE order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(order_date) ORDER BY date",
      mockData: Array.from({ length: 30 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (29 - i))
        return {
          date: date.toISOString().split('T')[0],
          order_count: Math.floor(Math.random() * 500) + 200
        }
      })
    },
    {
      title: "商品评价分析",
      description: "找出评分最高的前20个商品及其平均评分",
      sql: "SELECT product_name, AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews GROUP BY product_name HAVING review_count >= 10 ORDER BY avg_rating DESC LIMIT 20",
      mockData: [
        { product_name: "无线蓝牙耳机 Pro", avg_rating: 4.8, review_count: 1250 },
        { product_name: "智能手表 Ultra", avg_rating: 4.7, review_count: 890 },
        { product_name: "便携充电宝 20000mAh", avg_rating: 4.6, review_count: 2100 },
        { product_name: "无线充电器", avg_rating: 4.5, review_count: 650 },
        { product_name: "蓝牙音箱 Mini", avg_rating: 4.4, review_count: 980 }
      ]
    }
  ]
  
  // 检查Python环境
  useEffect(() => {
    const checkPythonEnv = async () => {
      try {
        const envStatus = await queryAPI.checkPythonEnvironment()
        setPythonEnvStatus(envStatus)
      } catch (error) {
        console.error('Failed to check Python environment:', error)
        setPythonEnvStatus({ available: false, error: error.message })
      }
    }
    
    if (usePythonQuery) {
      checkPythonEnv()
    }
  }, [usePythonQuery])
  
  // 处理查询提交
  const handleSubmitQuery = async () => {
    if (!queryText.trim()) {
      message.warning('请输入查询描述')
      return
    }
    

    
    if (usePythonQuery && pythonEnvStatus && !pythonEnvStatus.available) {
      message.error('Python环境不可用，请检查Python安装')
      return
    }
    
    if (usePythonQuery) {
      await handlePythonQuery()
    } else {
      await handleLegacyQuery()
    }
  }
  
  // Python查询处理
  const handlePythonQuery = async () => {
    try {
      setStatus('generating')
      setProgress(10)
      setError('')
      setResults([])
      setGeneratedSQL('')
      setGeneratedPythonCode('')
      
      const startTime = Date.now()
      
      // 调用Python查询API
      const result = await queryAPI.pythonQuery(queryText, {}, {
        splitLargeResults: true,
        maxRowsPerBatch: 50000
      })
      
      if (result.success) {
        setGeneratedSQL(result.sql || '')
        setGeneratedPythonCode(result.pythonCode || '')
        setResults(result.data || [])
        setRecordCount(result.totalRecords || result.data?.length || 0)
        setExecutionTime(Date.now() - startTime)
        setProgress(100)
        setStatus('completed')
        
        if (result.wasSplit) {
          message.success(`查询完成，数据已自动拆分为${result.batchCount}个批次`)
        } else {
          message.success('查询完成')
        }
      } else {
        throw new Error(result.error || '查询失败')
      }
    } catch (error) {
      console.error('Python query error:', error)
      setStatus('error')
      setError(error.message || '查询失败，请重试')
      message.error('查询失败: ' + error.message)
    }
  }
  
  // 传统查询处理（保持向后兼容）
  const handleLegacyQuery = async () => {
    try {
      setStatus('generating')
      setProgress(10)
      setError('')
      setResults([])
      
      // 模拟生成SQL过程
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // 智能匹配查询示例
      const matchedExample = findBestMatch(queryText)
      
      if (matchedExample) {
        setGeneratedSQL(matchedExample.sql)
        setProgress(30)
        
        // 模拟执行查询
        setStatus('executing')
        const startTime = Date.now()
        await new Promise(resolve => setTimeout(resolve, 1200))
        
        setProgress(70)
        setStatus('processing')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 设置结果
        setResults(matchedExample.mockData)
        setRecordCount(matchedExample.mockData.length)
        setExecutionTime(Date.now() - startTime)
        setProgress(100)
        setStatus('completed')
        
        message.success('查询完成')
      } else {
        // 生成通用SQL和模拟数据
        const genericSQL = generateGenericSQL(queryText)
        setGeneratedSQL(genericSQL)
        setProgress(30)
        
        setStatus('executing')
        const startTime = Date.now()
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setProgress(70)
        setStatus('processing')
        await new Promise(resolve => setTimeout(resolve, 400))
        
        // 生成模拟数据
        const mockResults = generateMockData(queryText)
        setResults(mockResults)
        setRecordCount(mockResults.length)
        setExecutionTime(Date.now() - startTime)
        setProgress(100)
        setStatus('completed')
        
        message.success('查询完成')
      }
    } catch (err) {
      console.error('Query error:', err)
      setStatus('error')
      setError(err.message || '查询失败，请重试')
      message.error('查询失败')
    }
  }
  
  // 智能匹配最佳示例
  const findBestMatch = (query) => {
    const keywords = {
      '销售': ['销售', '产品', '商品', '收入', '营收'],
      '用户': ['用户', '客户', '地区', '年龄', '统计'],
      '订单': ['订单', '趋势', '日期', '时间', '每日'],
      '评价': ['评价', '评分', '商品', '排行', '最高']
    }
    
    let bestMatch = null
    let maxScore = 0
    
    queryExamples.forEach(example => {
      let score = 0
      const queryLower = query.toLowerCase()
      
      // 检查关键词匹配
      Object.entries(keywords).forEach(([category, words]) => {
        words.forEach(word => {
          if (queryLower.includes(word)) {
            if (example.title.includes(category) || example.description.includes(word)) {
              score += 2
            }
          }
        })
      })
      
      // 检查直接文本匹配
      if (queryLower.includes(example.title.toLowerCase().substring(0, 2))) {
        score += 3
      }
      
      if (score > maxScore) {
        maxScore = score
        bestMatch = example
      }
    })
    
    return maxScore > 1 ? bestMatch : null
  }
  
  // 生成通用SQL
  const generateGenericSQL = (query) => {
    const templates = [
      "SELECT * FROM table_name WHERE condition ORDER BY column_name",
      "SELECT column1, COUNT(*) as count FROM table_name GROUP BY column1",
      "SELECT AVG(column1), SUM(column2) FROM table_name WHERE date_column >= '2023-01-01'",
      "SELECT * FROM table_name WHERE column_name LIKE '%keyword%' LIMIT 100"
    ]
    
    return templates[Math.floor(Math.random() * templates.length)]
  }
  
  // 生成模拟数据
  const generateMockData = (query) => {
    const sampleData = [
      { id: 1, name: "示例数据1", value: 100, date: "2024-01-15" },
      { id: 2, name: "示例数据2", value: 250, date: "2024-01-16" },
      { id: 3, name: "示例数据3", value: 180, date: "2024-01-17" },
      { id: 4, name: "示例数据4", value: 320, date: "2024-01-18" },
      { id: 5, name: "示例数据5", value: 150, date: "2024-01-19" }
    ]
    
    return sampleData
  }
  
  // 清空结果
  const handleClearResults = () => {
    setResults([])
    setGeneratedSQL('')
    setStatus('idle')
    setProgress(0)
    setError('')
    setExecutionTime(0)
    setRecordCount(0)
  }
  
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
        智能数据查询系统
      </Title>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
        <TabPane tab="📝 数据查询" key="query">
          {/* 查询模式选择 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space align="center">
              <span>查询模式：</span>
              <Switch
                checked={usePythonQuery}
                onChange={setUsePythonQuery}
                checkedChildren="Python查询"
                unCheckedChildren="模拟查询"
              />
              <Tooltip title={usePythonQuery ? 
                '使用Python连接真实数据库进行查询，支持大数据集自动拆分' : 
                '使用模拟数据进行演示，无需配置数据库'
              }>
                <Button type="text" icon={<SettingOutlined />} size="small" />
              </Tooltip>
              
              {usePythonQuery && pythonEnvStatus && (
                <span style={{ 
                  color: pythonEnvStatus.available ? '#52c41a' : '#f5222d',
                  fontSize: '12px'
                }}>
                  Python环境: {pythonEnvStatus.available ? '✓ 可用' : '✗ 不可用'}
                </span>
              )}
            </Space>
          </Card>
          
          {/* 查询输入区域 */}
          <Card title="📝 查询描述" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 快速示例按钮 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: '14px' }}>💡 快速体验示例：</div>
            <Space wrap>
              {queryExamples.map((example, index) => (
                <Button
                  key={index}
                  size="small"
                  onClick={() => setQueryText(example.description)}
                  style={{ marginBottom: 4 }}
                >
                  {example.title}
                </Button>
              ))}
            </Space>
          </div>
          
          <TextArea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="请用自然语言描述您需要查询的数据，例如：\n\n• 查询2023年销售额最高的10个产品\n• 统计每个地区的用户数量和平均年龄\n• 找出最近30天活跃用户的购买行为数据\n• 分析不同时间段的订单分布情况\n\n💡 提示：点击上方示例按钮可快速体验不同类型的查询"
            rows={6}
            maxLength={1000}
            showCount
            style={{ fontSize: '14px' }}
          />
          
          <Space size="middle">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSubmitQuery}
              loading={['generating', 'executing', 'processing', 'splitting'].includes(status)}
              size="large"
              style={{ minWidth: 120 }}
            >
              开始查询
            </Button>
            
            {(generatedSQL || generatedPythonCode) && (
              <Button
                icon={<EyeOutlined />}
                onClick={() => setSqlPreviewVisible(true)}
                size="large"
              >
                {usePythonQuery ? '预览代码' : '预览SQL'}
              </Button>
            )}
            
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
              disabled={!results || results.length === 0}
              size="large"
            >
              导出数据
            </Button>
            
            <Button
              icon={<ClearOutlined />}
              onClick={handleClearResults}
              disabled={!results || results.length === 0}
              size="large"
            >
              清空结果
            </Button>
          </Space>
        </Space>
      </Card>
        </TabPane>
        

      </Tabs>
      
      {/* 查询状态 */}
      <QueryStatus
        status={status}
        progress={progress}
        message={error}
        executionTime={executionTime}
        recordCount={recordCount}
        onCancel={() => {
          setStatus('cancelled')
          message.info('查询已取消')
        }}
      />
      
      {/* 查询结果 */}
      {results && results.length > 0 && (
        <Card title="📊 查询结果" style={{ marginTop: 24 }}>
          <ResultTable
            data={results}
            loading={status === 'processing'}
            showExport={true}
            title={`查询结果 (${recordCount > 100000 ? '已自动拆分' : '完整结果'})`}
          />
        </Card>
      )}
      
      {/* 使用提示 */}
      {status === 'idle' && (
        <Card title="💡 演示说明" style={{ marginTop: 24 }}>
          <Alert
            message="当前为演示模式"
            description="系统使用模拟数据进行演示，展示完整的查询流程和功能特性。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div style={{ color: '#666', lineHeight: '1.8' }}>
            <p><strong>🚀 快速体验：</strong></p>
            <ul style={{ paddingLeft: 20 }}>
              <li>点击上方<strong>快速示例按钮</strong>，一键填入预设查询</li>
              <li>或者输入自定义查询描述，体验智能匹配功能</li>
              <li>观察完整的查询流程：生成SQL → 执行查询 → 展示结果</li>
              <li>尝试<strong>预览SQL</strong>和<strong>导出数据</strong>功能</li>
            </ul>
            
            <p><strong>💼 系统特色：</strong></p>
            <ul style={{ paddingLeft: 20 }}>
              <li>🤖 <strong>智能SQL生成</strong>：自然语言自动转换为标准SQL查询</li>
              <li>⚡ <strong>大数据处理</strong>：自动检测并拆分超大查询结果</li>
              <li>📊 <strong>实时进度</strong>：可视化查询执行状态和进度</li>
              <li>📁 <strong>多格式导出</strong>：支持Excel、CSV等格式数据导出</li>
            </ul>
            
            <p><strong>📝 支持的查询类型：</strong></p>
            <ul style={{ paddingLeft: 20 }}>
              <li><strong>销售分析</strong>："查询销售额最高的产品"、"统计月度营收"</li>
              <li><strong>用户统计</strong>："各地区用户分布"、"用户年龄分析"</li>
              <li><strong>趋势分析</strong>："订单趋势"、"日活跃用户变化"</li>
              <li><strong>评价分析</strong>："商品评分排行"、"用户满意度"</li>
            </ul>
          </div>
        </Card>
      )}
      
      {/* SQL/代码预览模态框 */}
      <Modal
        title={usePythonQuery ? "🐍 Python代码预览" : "🔍 SQL预览"}
        open={sqlPreviewVisible}
        onCancel={() => setSqlPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSqlPreviewVisible(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            type="primary"
            onClick={() => {
              const codeText = usePythonQuery ? generatedPythonCode : generatedSQL;
              navigator.clipboard.writeText(codeText);
              message.success(usePythonQuery ? 'Python代码已复制到剪贴板' : 'SQL已复制到剪贴板');
            }}
          >
            {usePythonQuery ? '复制代码' : '复制SQL'}
          </Button>
        ]}
        width={900}
      >
        {usePythonQuery ? (
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '16px', 
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '1.5',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {generatedPythonCode}
          </pre>
        ) : (
          <SQLPreview sql={generatedSQL} showActions={true} />
        )}
      </Modal>
      
      {/* 导出模态框 */}
      <ExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        data={results}
        filename={`query_results_${new Date().getTime()}`}
      />
    </div>
  )
}

export default QueryPage