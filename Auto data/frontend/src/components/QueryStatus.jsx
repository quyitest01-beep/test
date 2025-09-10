import React from 'react'
import { Card, Progress, Alert, Space, Typography, Tag, Button } from 'antd'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  StopOutlined
} from '@ant-design/icons'

const { Text } = Typography

const QueryStatus = ({ 
  status, 
  progress = 0, 
  message, 
  executionTime, 
  recordCount,
  onCancel,
  showCancel = true
}) => {
  // 状态配置
  const statusConfig = {
    idle: {
      icon: null,
      color: '#d9d9d9',
      text: '等待查询',
      type: 'info'
    },
    generating: {
      icon: <LoadingOutlined spin />,
      color: '#1890ff',
      text: '正在生成SQL...',
      type: 'info'
    },
    executing: {
      icon: <LoadingOutlined spin />,
      color: '#1890ff',
      text: '正在执行查询...',
      type: 'info'
    },
    processing: {
      icon: <LoadingOutlined spin />,
      color: '#1890ff',
      text: '正在处理结果...',
      type: 'info'
    },
    splitting: {
      icon: <LoadingOutlined spin />,
      color: '#faad14',
      text: '数据量较大，正在自动拆分...',
      type: 'warning'
    },
    completed: {
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      text: '查询完成',
      type: 'success'
    },
    error: {
      icon: <ExclamationCircleOutlined />,
      color: '#ff4d4f',
      text: '查询失败',
      type: 'error'
    },
    cancelled: {
      icon: <StopOutlined />,
      color: '#d9d9d9',
      text: '查询已取消',
      type: 'warning'
    }
  }
  
  const config = statusConfig[status] || statusConfig.idle
  const isRunning = ['generating', 'executing', 'processing', 'splitting'].includes(status)
  
  // 格式化执行时间
  const formatExecutionTime = (time) => {
    if (!time) return ''
    if (time < 1000) return `${time}ms`
    if (time < 60000) return `${(time / 1000).toFixed(1)}s`
    return `${Math.floor(time / 60000)}m ${Math.floor((time % 60000) / 1000)}s`
  }
  
  // 格式化记录数
  const formatRecordCount = (count) => {
    if (!count) return ''
    if (count < 1000) return count.toString()
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`
    return `${(count / 1000000).toFixed(1)}M`
  }
  
  if (status === 'idle') {
    return null
  }
  
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space size="middle">
          {/* 状态图标和文本 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: config.color, marginRight: 8, fontSize: 16 }}>
              {config.icon}
            </span>
            <Text strong style={{ color: config.color }}>
              {config.text}
            </Text>
          </div>
          
          {/* 执行信息 */}
          <Space>
            {executionTime && (
              <Tag icon={<ClockCircleOutlined />} color="blue">
                {formatExecutionTime(executionTime)}
              </Tag>
            )}
            {recordCount && (
              <Tag color="green">
                {formatRecordCount(recordCount)} 条记录
              </Tag>
            )}
          </Space>
        </Space>
        
        {/* 取消按钮 */}
        {isRunning && showCancel && onCancel && (
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={onCancel}
          >
            取消
          </Button>
        )}
      </div>
      
      {/* 进度条 */}
      {isRunning && (
        <div style={{ marginTop: 12 }}>
          <Progress
            percent={progress}
            size="small"
            status={status === 'error' ? 'exception' : 'active'}
            strokeColor={config.color}
          />
        </div>
      )}
      
      {/* 消息提示 */}
      {message && (
        <div style={{ marginTop: 12 }}>
          <Alert
            message={message}
            type={config.type}
            showIcon
            size="small"
          />
        </div>
      )}
      
      {/* 数据拆分提示 */}
      {status === 'splitting' && (
        <div style={{ marginTop: 12 }}>
          <Alert
            message="检测到查询结果超过10万条记录"
            description="系统正在自动拆分查询条件或结果集，以确保最佳性能和完整性。"
            type="warning"
            showIcon
            size="small"
          />
        </div>
      )}
    </Card>
  )
}

export default QueryStatus