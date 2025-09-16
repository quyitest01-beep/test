import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Timeline,
  Progress,
  Table,
  Tag,
  Button,
  Space,
  Divider
} from 'antd'
import {
  SearchOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  RobotOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'

const DashboardPage = () => {
  const [systemStats, setSystemStats] = useState({
    totalQueries: 1247,
    scheduledTasks: 23,
    activeReports: 15,
    connectedBots: 8,
    queryGrowth: 12.5,
    taskGrowth: -2.3,
    reportGrowth: 8.7,
    botGrowth: 25.0
  })

  const [systemStatus, setSystemStatus] = useState({
    cpu: 45,
    memory: 67,
    database: 89,
    apiResponse: 156
  })

  const [recentActivities] = useState([
    {
      time: '2024-01-17 14:30',
      type: 'query',
      content: '用户执行了销售数据查询',
      status: 'success'
    },
    {
      time: '2024-01-17 14:25',
      type: 'task',
      content: '定时任务"月度报表"执行完成',
      status: 'success'
    },
    {
      time: '2024-01-17 14:20',
      type: 'bot',
      content: 'Telegram机器人收到新查询请求',
      status: 'info'
    },
    {
      time: '2024-01-17 14:15',
      type: 'report',
      content: '报告"用户行为分析"生成失败',
      status: 'error'
    },
    {
      time: '2024-01-17 14:10',
      type: 'system',
      content: '系统性能监控告警已解除',
      status: 'warning'
    }
  ])

  const [quickActions] = useState([
    {
      title: '新建查询',
      description: '创建新的数据查询任务',
      icon: <SearchOutlined />,
      action: 'query'
    },
    {
      title: '添加定时任务',
      description: '配置自动化查询任务',
      icon: <ClockCircleOutlined />,
      action: 'scheduled-tasks'
    },
    {
      title: '生成报告',
      description: '手动生成数据报告',
      icon: <FileTextOutlined />,
      action: 'reports'
    },
    {
      title: '机器人管理',
      description: '管理智能客服机器人',
      icon: <RobotOutlined />,
      action: 'bots'
    }
  ])

  const getActivityIcon = (type) => {
    switch (type) {
      case 'query':
        return <SearchOutlined style={{ color: '#1890ff' }} />
      case 'task':
        return <ClockCircleOutlined style={{ color: '#52c41a' }} />
      case 'bot':
        return <RobotOutlined style={{ color: '#722ed1' }} />
      case 'report':
        return <FileTextOutlined style={{ color: '#fa8c16' }} />
      case 'system':
        return <DatabaseOutlined style={{ color: '#13c2c2' }} />
      default:
        return <CheckCircleOutlined />
    }
  }

  const getActivityColor = (status) => {
    switch (status) {
      case 'success':
        return 'green'
      case 'error':
        return 'red'
      case 'warning':
        return 'orange'
      case 'info':
        return 'blue'
      default:
        return 'default'
    }
  }

  const getStatusColor = (value) => {
    if (value < 50) return '#52c41a'
    if (value < 80) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总查询次数"
              value={systemStats.totalQueries}
              prefix={<SearchOutlined />}
              suffix={
                <span style={{ fontSize: '14px' }}>
                  {systemStats.queryGrowth > 0 ? (
                    <ArrowUpOutlined style={{ color: '#3f8600' }} />
                  ) : (
                    <ArrowDownOutlined style={{ color: '#cf1322' }} />
                  )}
                  {Math.abs(systemStats.queryGrowth)}%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="定时任务数"
              value={systemStats.scheduledTasks}
              prefix={<ClockCircleOutlined />}
              suffix={
                <span style={{ fontSize: '14px' }}>
                  {systemStats.taskGrowth > 0 ? (
                    <ArrowUpOutlined style={{ color: '#3f8600' }} />
                  ) : (
                    <ArrowDownOutlined style={{ color: '#cf1322' }} />
                  )}
                  {Math.abs(systemStats.taskGrowth)}%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃报告数"
              value={systemStats.activeReports}
              prefix={<FileTextOutlined />}
              suffix={
                <span style={{ fontSize: '14px' }}>
                  {systemStats.reportGrowth > 0 ? (
                    <ArrowUpOutlined style={{ color: '#3f8600' }} />
                  ) : (
                    <ArrowDownOutlined style={{ color: '#cf1322' }} />
                  )}
                  {Math.abs(systemStats.reportGrowth)}%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="连接机器人数"
              value={systemStats.connectedBots}
              prefix={<RobotOutlined />}
              suffix={
                <span style={{ fontSize: '14px' }}>
                  {systemStats.botGrowth > 0 ? (
                    <ArrowUpOutlined style={{ color: '#3f8600' }} />
                  ) : (
                    <ArrowDownOutlined style={{ color: '#cf1322' }} />
                  )}
                  {Math.abs(systemStats.botGrowth)}%
                </span>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 系统状态监控 */}
        <Col xs={24} lg={12}>
          <Card title="系统状态监控" extra={<Button type="link">查看详情</Button>}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span><DatabaseOutlined /> CPU使用率</span>
                  <span>{systemStatus.cpu}%</span>
                </div>
                <Progress 
                  percent={systemStatus.cpu} 
                  strokeColor={getStatusColor(systemStatus.cpu)}
                  showInfo={false}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span><CloudServerOutlined /> 内存使用率</span>
                  <span>{systemStatus.memory}%</span>
                </div>
                <Progress 
                  percent={systemStatus.memory} 
                  strokeColor={getStatusColor(systemStatus.memory)}
                  showInfo={false}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span><DatabaseOutlined /> 数据库连接</span>
                  <span>{systemStatus.database}%</span>
                </div>
                <Progress 
                  percent={systemStatus.database} 
                  strokeColor={getStatusColor(systemStatus.database)}
                  showInfo={false}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span><ApiOutlined /> API响应时间</span>
                  <span>{systemStatus.apiResponse}ms</span>
                </div>
                <Progress 
                  percent={Math.min(systemStatus.apiResponse / 5, 100)} 
                  strokeColor={systemStatus.apiResponse < 200 ? '#52c41a' : systemStatus.apiResponse < 500 ? '#faad14' : '#ff4d4f'}
                  showInfo={false}
                />
              </div>
            </Space>
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col xs={24} lg={12}>
          <Card title="最近活动" extra={<Button type="link">查看全部</Button>}>
            <Timeline
              items={recentActivities.map((activity, index) => ({
                key: index,
                dot: getActivityIcon(activity.type),
                children: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{activity.content}</span>
                      <Tag color={getActivityColor(activity.status)}>
                        {activity.status === 'success' && '成功'}
                        {activity.status === 'error' && '失败'}
                        {activity.status === 'warning' && '警告'}
                        {activity.status === 'info' && '信息'}
                      </Tag>
                    </div>
                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                      {activity.time}
                    </div>
                  </div>
                )
              }))}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {quickActions.map((action, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card 
                hoverable
                style={{ textAlign: 'center', cursor: 'pointer' }}
                bodyStyle={{ padding: '24px 16px' }}
                onClick={() => console.log(`Navigate to ${action.action}`)}
              >
                <div style={{ fontSize: '32px', color: '#1890ff', marginBottom: 16 }}>
                  {action.icon}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>
                  {action.title}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {action.description}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}

export default DashboardPage