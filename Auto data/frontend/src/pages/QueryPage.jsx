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
  Spin
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
  ClearOutlined
} from '@ant-design/icons'
import SQLPreview from '../components/SQLPreview'
import QueryStatus from '../components/QueryStatus'
import ResultTable from '../components/ResultTable'
import ExportModal from '../components/ExportModal'
import { queryAPI } from '../services/api'

const { TextArea } = Input
const { Title } = Typography

const QueryPage = () => {
  const [queryText, setQueryText] = useState('')
  const [generatedSQL, setGeneratedSQL] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [executionTime, setExecutionTime] = useState(0)
  const [recordCount, setRecordCount] = useState(0)
  const [sqlPreviewVisible, setSqlPreviewVisible] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  
  // 提交查询
  const handleSubmitQuery = async () => {
    if (!queryText.trim()) {
      message.warning('请输入查询描述')
      return
    }
    
    try {
      setStatus('generating')
      setProgress(10)
      setError('')
      setResults([])
      
      // 生成SQL
      const sqlResponse = await queryAPI.generateSQL(queryText)
      setGeneratedSQL(sqlResponse.sql)
      setProgress(30)
      
      // 执行查询
      setStatus('executing')
      const startTime = Date.now()
      const queryResponse = await queryAPI.executeQuery(sqlResponse.sql)
      
      setProgress(70)
      setStatus('processing')
      
      // 检查是否需要拆分
      if (queryResponse.recordCount > 100000) {
        setStatus('splitting')
        setProgress(80)
        
        // 自动拆分查询
        const splitResponse = await queryAPI.splitQuery({
          sql: sqlResponse.sql,
          originalQuery: queryText,
          recordCount: queryResponse.recordCount
        })
        
        setResults(splitResponse.results)
        setRecordCount(splitResponse.totalRecords)
      } else {
        setResults(queryResponse.results)
        setRecordCount(queryResponse.recordCount)
      }
      
      setExecutionTime(Date.now() - startTime)
      setProgress(100)
      setStatus('completed')
      
      message.success('查询完成')
    } catch (err) {
      console.error('Query error:', err)
      setStatus('error')
      setError(err.message || '查询失败，请重试')
      message.error('查询失败')
    }
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
        Athena智能数据查询系统
      </Title>
      
      {/* 查询输入区域 */}
      <Card title="📝 查询描述" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <TextArea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="请用自然语言描述您需要查询的数据，例如：\n\n• 查询2023年销售额最高的10个产品\n• 统计每个地区的用户数量和平均年龄\n• 找出最近30天活跃用户的购买行为数据\n• 分析不同时间段的订单分布情况"
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
            
            {generatedSQL && (
              <Button
                icon={<EyeOutlined />}
                onClick={() => setSqlPreviewVisible(true)}
                size="large"
              >
                预览SQL
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
        <Card title="💡 使用提示" style={{ marginTop: 24 }}>
          <div style={{ color: '#666', lineHeight: '1.8' }}>
            <p><strong>系统特色：</strong></p>
            <ul style={{ paddingLeft: 20 }}>
              <li>🤖 <strong>智能SQL生成</strong>：将自然语言自动转换为标准SQL查询</li>
              <li>⚡ <strong>大数据处理</strong>：自动检测并拆分超过10万条记录的查询结果</li>
              <li>📁 <strong>多格式导出</strong>：支持Excel、CSV等格式的数据导出</li>
              <li>🔍 <strong>结果预览</strong>：实时查看生成的SQL语句和执行进度</li>
            </ul>
            <p><strong>查询示例：</strong></p>
            <ul style={{ paddingLeft: 20 }}>
              <li>"查询最近一个月销售额超过1万的产品"</li>
              <li>"统计各个城市的用户注册数量"</li>
              <li>"找出评分最高的前20个商品"</li>
            </ul>
          </div>
        </Card>
      )}
      
      {/* SQL预览模态框 */}
      <Modal
        title="🔍 SQL预览"
        open={sqlPreviewVisible}
        onCancel={() => setSqlPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSqlPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
      >
        <SQLPreview sql={generatedSQL} showActions={true} />
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