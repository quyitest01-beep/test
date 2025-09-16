import React, { useState } from 'react'
import {
  Card,
  List,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Badge,
  Avatar,
  Tooltip,
  Popconfirm,
  message,
  Tabs,
  Progress,
  Statistic,
  Row,
  Col,
  Alert,
  Divider,
  Timeline
} from 'antd'
import {
  RobotOutlined,
  MessageOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SendOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

const BotsPage = () => {
  const [bots, setBots] = useState([
    {
      id: 1,
      name: 'Telegram数据查询机器人',
      type: 'telegram',
      status: 'active',
      description: '通过Telegram机器人处理用户的数据查询请求',
      config: {
        botToken: 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        chatId: '-1001234567890',
        allowedUsers: ['@admin', '@user1'],
        commands: ['/query', '/help', '/status']
      },
      stats: {
        totalQueries: 1250,
        todayQueries: 45,
        successRate: 92.5,
        avgResponseTime: 2.3,
        activeUsers: 28
      },
      lastActivity: '2024-01-17 09:30:00',
      createdAt: '2024-01-10 10:00:00'
    },
    {
      id: 2,
      name: '飞书数据助手',
      type: 'lark',
      status: 'inactive',
      description: '集成飞书应用，为团队提供数据查询服务',
      config: {
        appId: 'cli_a1b2c3d4e5f6g7h8',
        appSecret: 'abcdefghijklmnopqrstuvwxyz123456',
        chatId: 'oc_1234567890abcdef',
        departments: ['技术部', '产品部', '运营部']
      },
      stats: {
        totalQueries: 0,
        todayQueries: 0,
        successRate: 0,
        avgResponseTime: 0,
        activeUsers: 0
      },
      lastActivity: null,
      createdAt: '2024-01-15 14:30:00'
    },
    {
      id: 3,
      name: '企业微信查询助手',
      type: 'wechat',
      status: 'error',
      description: '企业微信群聊机器人，支持自然语言查询',
      config: {
        corpId: 'ww1234567890abcdef',
        agentId: '1000001',
        secret: 'abcdefghijklmnopqrstuvwxyz123456',
        chatId: 'wrjc1234567890abcdef'
      },
      stats: {
        totalQueries: 856,
        todayQueries: 0,
        successRate: 88.2,
        avgResponseTime: 3.1,
        activeUsers: 15
      },
      lastActivity: '2024-01-16 18:45:00',
      createdAt: '2024-01-12 09:15:00',
      errorMessage: 'Token已过期，需要重新授权'
    }
  ])

  const [activities, setActivities] = useState([
    {
      id: 1,
      botName: 'Telegram数据查询机器人',
      user: '@admin',
      action: '执行查询',
      query: '查询昨日销售数据',
      result: '成功',
      timestamp: '2024-01-17 09:30:00'
    },
    {
      id: 2,
      botName: 'Telegram数据查询机器人',
      user: '@user1',
      action: '执行查询',
      query: '统计本月用户注册量',
      result: '成功',
      timestamp: '2024-01-17 09:15:00'
    },
    {
      id: 3,
      botName: '企业微信查询助手',
      user: '张三',
      action: '执行查询',
      query: '查看产品销量排行',
      result: '失败',
      timestamp: '2024-01-16 18:45:00'
    }
  ])

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [editingBot, setEditingBot] = useState(null)
  const [form] = Form.useForm()
  const [configForm] = Form.useForm()

  const botTypes = [
    { value: 'telegram', label: 'Telegram机器人', icon: <MessageOutlined /> },
    { value: 'lark', label: '飞书应用', icon: <TeamOutlined /> },
    { value: 'wechat', label: '企业微信', icon: <MessageOutlined /> },
    { value: 'dingtalk', label: '钉钉机器人', icon: <MessageOutlined /> }
  ]

  const getStatusConfig = (status) => {
    const configs = {
      active: { color: 'success', text: '运行中', icon: <CheckCircleOutlined /> },
      inactive: { color: 'default', text: '已停用', icon: <StopOutlined /> },
      error: { color: 'error', text: '异常', icon: <ExclamationCircleOutlined /> },
      pending: { color: 'processing', text: '启动中', icon: <ClockCircleOutlined /> }
    }
    return configs[status] || configs.inactive
  }

  const getBotIcon = (type) => {
    const icons = {
      telegram: <MessageOutlined style={{ color: '#0088cc' }} />,
      lark: <TeamOutlined style={{ color: '#00d4aa' }} />,
      wechat: <MessageOutlined style={{ color: '#07c160' }} />,
      dingtalk: <MessageOutlined style={{ color: '#1890ff' }} />
    }
    return icons[type] || <RobotOutlined />
  }

  const handleToggleBot = (botId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setBots(bots.map(bot => 
      bot.id === botId 
        ? { ...bot, status: newStatus }
        : bot
    ))
    message.success(`机器人已${newStatus === 'active' ? '启动' : '停用'}`)
  }

  const handleDeleteBot = (botId) => {
    setBots(bots.filter(bot => bot.id !== botId))
    message.success('机器人删除成功')
  }

  const handleCreateBot = () => {
    form.validateFields().then(values => {
      const newBot = {
        id: Date.now(),
        ...values,
        status: 'inactive',
        stats: {
          totalQueries: 0,
          todayQueries: 0,
          successRate: 0,
          avgResponseTime: 0,
          activeUsers: 0
        },
        lastActivity: null,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      }
      
      setBots([...bots, newBot])
      message.success('机器人创建成功')
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleConfigBot = (bot) => {
    setEditingBot(bot)
    configForm.setFieldsValue({
      name: bot.name,
      description: bot.description,
      ...bot.config
    })
    setIsConfigModalVisible(true)
  }

  const handleSaveConfig = () => {
    configForm.validateFields().then(values => {
      const { name, description, ...config } = values
      
      setBots(bots.map(bot => 
        bot.id === editingBot.id 
          ? { 
              ...bot, 
              name,
              description,
              config
            }
          : bot
      ))
      
      message.success('配置保存成功')
      setIsConfigModalVisible(false)
      setEditingBot(null)
      configForm.resetFields()
    })
  }

  const handleTestBot = (bot) => {
    message.loading('正在测试机器人连接...', 2)
    
    // 模拟测试过程
    setTimeout(() => {
      const success = Math.random() > 0.3
      if (success) {
        message.success(`${bot.name} 连接测试成功`)
      } else {
        message.error(`${bot.name} 连接测试失败`)
      }
    }, 2000)
  }

  const renderBotItem = (bot) => {
    const statusConfig = getStatusConfig(bot.status)
    
    return (
      <List.Item
        key={bot.id}
        actions={[
          <Switch
            checked={bot.status === 'active'}
            onChange={() => handleToggleBot(bot.id, bot.status)}
            disabled={bot.status === 'error'}
          />,
          <Button 
            type="text" 
            icon={<SettingOutlined />} 
            onClick={() => handleConfigBot(bot)}
          />,
          <Button 
            type="text" 
            onClick={() => handleTestBot(bot)}
          >
            测试
          </Button>,
          <Popconfirm
            title="确定要删除这个机器人吗？"
            onConfirm={() => handleDeleteBot(bot.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={bot.status === 'error'}>
              <Avatar icon={getBotIcon(bot.type)} size="large" />
            </Badge>
          }
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{bot.name}</span>
              <Tag color={statusConfig.color} icon={statusConfig.icon}>
                {statusConfig.text}
              </Tag>
              <Tag>{botTypes.find(t => t.value === bot.type)?.label}</Tag>
            </div>
          }
          description={
            <div>
              <div style={{ marginBottom: '8px' }}>{bot.description}</div>
              {bot.errorMessage && (
                <Alert 
                  message={bot.errorMessage} 
                  type="error" 
                  size="small" 
                  style={{ marginBottom: '8px' }}
                />
              )}
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="总查询" 
                    value={bot.stats.totalQueries} 
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="今日查询" 
                    value={bot.stats.todayQueries} 
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="成功率" 
                    value={bot.stats.successRate} 
                    suffix="%" 
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="活跃用户" 
                    value={bot.stats.activeUsers} 
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
              </Row>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                <Space split={<Divider type="vertical" />}>
                  <span>创建时间: {bot.createdAt}</span>
                  {bot.lastActivity && <span>最后活动: {bot.lastActivity}</span>}
                </Space>
              </div>
            </div>
          }
        />
      </List.Item>
    )
  }

  const renderActivityItem = (activity) => {
    const isSuccess = activity.result === '成功'
    
    return {
      dot: isSuccess ? 
        <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
        <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      children: (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {activity.botName} - {activity.user}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <Tag color={isSuccess ? 'success' : 'error'}>{activity.result}</Tag>
            <span>{activity.action}: {activity.query}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {activity.timestamp}
          </div>
        </div>
      )
    }
  }

  const getTotalStats = () => {
    return bots.reduce((acc, bot) => ({
      totalQueries: acc.totalQueries + bot.stats.totalQueries,
      todayQueries: acc.todayQueries + bot.stats.todayQueries,
      activeUsers: acc.activeUsers + bot.stats.activeUsers,
      activeBots: acc.activeBots + (bot.status === 'active' ? 1 : 0)
    }), { totalQueries: 0, todayQueries: 0, activeUsers: 0, activeBots: 0 })
  }

  const totalStats = getTotalStats()

  return (
    <div>
      <Card 
        title={
          <Space>
            <RobotOutlined />
            智能客服管理
            <Badge count={bots.filter(bot => bot.status === 'active').length} />
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields()
            setIsModalVisible(true)
          }}>
            添加机器人
          </Button>
        }
      >
        <Tabs defaultActiveKey="bots">
          <TabPane tab="机器人列表" key="bots">
            <List
              dataSource={bots}
              renderItem={renderBotItem}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 个机器人`
              }}
            />
          </TabPane>
          
          <TabPane tab="统计概览" key="statistics">
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总查询次数"
                    value={totalStats.totalQueries}
                    prefix={<BarChartOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="今日查询"
                    value={totalStats.todayQueries}
                    prefix={<SendOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="活跃用户"
                    value={totalStats.activeUsers}
                    prefix={<UserOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="运行中机器人"
                    value={totalStats.activeBots}
                    suffix={`/ ${bots.length}`}
                    prefix={<RobotOutlined />}
                  />
                </Card>
              </Col>
            </Row>
            
            <Card title="机器人性能对比" style={{ marginBottom: '24px' }}>
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                性能图表功能开发中...
              </div>
            </Card>
          </TabPane>
          
          <TabPane tab="活动日志" key="activities">
            <Timeline
              items={activities.map(renderActivityItem)}
              style={{ marginTop: '16px' }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建机器人模态框 */}
      <Modal
        title="添加机器人"
        open={isModalVisible}
        onOk={handleCreateBot}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'telegram'
          }}
        >
          <Form.Item
            name="name"
            label="机器人名称"
            rules={[{ required: true, message: '请输入机器人名称' }]}
          >
            <Input placeholder="请输入机器人名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="机器人类型"
            rules={[{ required: true, message: '请选择机器人类型' }]}
          >
            <Select placeholder="请选择机器人类型">
              {botTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  <Space>
                    {type.icon}
                    {type.label}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入机器人描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置机器人模态框 */}
      <Modal
        title={`配置 - ${editingBot?.name}`}
        open={isConfigModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => {
          setIsConfigModalVisible(false)
          setEditingBot(null)
          configForm.resetFields()
        }}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={configForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="机器人名称"
            rules={[{ required: true, message: '请输入机器人名称' }]}
          >
            <Input placeholder="请输入机器人名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="请输入机器人描述" />
          </Form.Item>

          <Divider>连接配置</Divider>

          {editingBot?.type === 'telegram' && (
            <>
              <Form.Item
                name="botToken"
                label="Bot Token"
                rules={[{ required: true, message: '请输入Bot Token' }]}
              >
                <Input.Password placeholder="请输入Telegram Bot Token" />
              </Form.Item>
              <Form.Item
                name="chatId"
                label="Chat ID"
              >
                <Input placeholder="请输入群组Chat ID" />
              </Form.Item>
            </>
          )}

          {editingBot?.type === 'lark' && (
            <>
              <Form.Item
                name="appId"
                label="App ID"
                rules={[{ required: true, message: '请输入App ID' }]}
              >
                <Input placeholder="请输入飞书应用ID" />
              </Form.Item>
              <Form.Item
                name="appSecret"
                label="App Secret"
                rules={[{ required: true, message: '请输入App Secret' }]}
              >
                <Input.Password placeholder="请输入飞书应用密钥" />
              </Form.Item>
            </>
          )}

          {editingBot?.type === 'wechat' && (
            <>
              <Form.Item
                name="corpId"
                label="企业ID"
                rules={[{ required: true, message: '请输入企业ID' }]}
              >
                <Input placeholder="请输入企业微信ID" />
              </Form.Item>
              <Form.Item
                name="agentId"
                label="应用ID"
                rules={[{ required: true, message: '请输入应用ID' }]}
              >
                <Input placeholder="请输入应用ID" />
              </Form.Item>
              <Form.Item
                name="secret"
                label="应用密钥"
                rules={[{ required: true, message: '请输入应用密钥' }]}
              >
                <Input.Password placeholder="请输入应用密钥" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default BotsPage