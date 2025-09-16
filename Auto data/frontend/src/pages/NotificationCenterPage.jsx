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
  Empty,
  Divider,
  Alert,
  Progress
} from 'antd'
import {
  BellOutlined,
  MailOutlined,
  MessageOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

const NotificationCenterPage = () => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'system',
      title: '定时任务执行成功',
      content: '销售数据报告已成功生成并发送至指定邮箱',
      status: 'success',
      priority: 'medium',
      createdAt: '2024-01-17 09:15:00',
      readAt: null,
      sender: '系统',
      recipients: ['sales@company.com'],
      channel: 'email',
      relatedTask: '销售数据报告生成'
    },
    {
      id: 2,
      type: 'alert',
      title: '数据库连接异常',
      content: '检测到数据库连接不稳定，可能影响查询性能',
      status: 'warning',
      priority: 'high',
      createdAt: '2024-01-17 08:45:00',
      readAt: '2024-01-17 09:00:00',
      sender: '监控系统',
      recipients: ['admin@company.com'],
      channel: 'system',
      relatedTask: null
    },
    {
      id: 3,
      type: 'task',
      title: '报告生成失败',
      content: '财务月度汇总报告生成失败，错误原因：数据库连接超时',
      status: 'error',
      priority: 'high',
      createdAt: '2024-01-17 07:30:00',
      readAt: null,
      sender: '定时任务系统',
      recipients: ['finance@company.com', 'admin@company.com'],
      channel: 'email',
      relatedTask: '财务月度汇总'
    },
    {
      id: 4,
      type: 'info',
      title: '系统维护通知',
      content: '系统将于今晚23:00-01:00进行例行维护，期间可能影响服务',
      status: 'info',
      priority: 'medium',
      createdAt: '2024-01-16 16:00:00',
      readAt: '2024-01-16 16:30:00',
      sender: '运维团队',
      recipients: ['all@company.com'],
      channel: 'broadcast',
      relatedTask: null
    },
    {
      id: 5,
      type: 'user',
      title: '新用户注册',
      content: '用户 zhang.san@company.com 已成功注册并激活账户',
      status: 'success',
      priority: 'low',
      createdAt: '2024-01-16 14:20:00',
      readAt: null,
      sender: '用户系统',
      recipients: ['admin@company.com'],
      channel: 'system',
      relatedTask: null
    }
  ])

  const [channels, setChannels] = useState([
    {
      id: 1,
      name: '邮件通知',
      type: 'email',
      enabled: true,
      config: {
        smtp: 'smtp.company.com',
        port: 587,
        username: 'noreply@company.com',
        ssl: true
      },
      status: 'active',
      lastTest: '2024-01-17 08:00:00',
      testResult: 'success'
    },
    {
      id: 2,
      name: 'Telegram机器人',
      type: 'telegram',
      enabled: true,
      config: {
        botToken: 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        chatId: '-1001234567890'
      },
      status: 'active',
      lastTest: '2024-01-17 07:30:00',
      testResult: 'success'
    },
    {
      id: 3,
      name: '飞书应用',
      type: 'lark',
      enabled: false,
      config: {
        appId: 'cli_a1b2c3d4e5f6g7h8',
        appSecret: 'abcdefghijklmnopqrstuvwxyz123456',
        chatId: 'oc_1234567890abcdef'
      },
      status: 'inactive',
      lastTest: null,
      testResult: null
    },
    {
      id: 4,
      name: '系统内通知',
      type: 'system',
      enabled: true,
      config: {},
      status: 'active',
      lastTest: '2024-01-17 09:00:00',
      testResult: 'success'
    }
  ])

  const [activeTab, setActiveTab] = useState('notifications')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isChannelModalVisible, setIsChannelModalVisible] = useState(false)
  const [editingChannel, setEditingChannel] = useState(null)
  const [form] = Form.useForm()
  const [channelForm] = Form.useForm()

  const notificationTypes = [
    { value: 'system', label: '系统通知', color: 'blue' },
    { value: 'alert', label: '告警通知', color: 'red' },
    { value: 'task', label: '任务通知', color: 'orange' },
    { value: 'info', label: '信息通知', color: 'green' },
    { value: 'user', label: '用户通知', color: 'purple' }
  ]

  const priorityConfig = {
    high: { color: 'red', text: '高' },
    medium: { color: 'orange', text: '中' },
    low: { color: 'green', text: '低' }
  }

  const statusConfig = {
    success: { color: 'success', icon: <CheckCircleOutlined /> },
    warning: { color: 'warning', icon: <ExclamationCircleOutlined /> },
    error: { color: 'error', icon: <CloseOutlined /> },
    info: { color: 'processing', icon: <InfoCircleOutlined /> }
  }

  const channelIcons = {
    email: <MailOutlined />,
    telegram: <MessageOutlined />,
    lark: <TeamOutlined />,
    system: <BellOutlined />
  }

  const getUnreadCount = () => {
    return notifications.filter(n => !n.readAt).length
  }

  const handleMarkAsRead = (notificationId) => {
    setNotifications(notifications.map(n => 
      n.id === notificationId 
        ? { ...n, readAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
        : n
    ))
  }

  const handleMarkAllAsRead = () => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    setNotifications(notifications.map(n => ({ ...n, readAt: n.readAt || now })))
    message.success('所有通知已标记为已读')
  }

  const handleDeleteNotification = (notificationId) => {
    setNotifications(notifications.filter(n => n.id !== notificationId))
    message.success('通知删除成功')
  }

  const handleSendNotification = () => {
    form.validateFields().then(values => {
      const newNotification = {
        id: Date.now(),
        ...values,
        status: 'info',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        readAt: null,
        sender: '管理员',
        recipients: values.recipients.split(',').map(email => email.trim()),
        relatedTask: null
      }
      
      setNotifications([newNotification, ...notifications])
      message.success('通知发送成功')
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleToggleChannel = (channelId, enabled) => {
    setChannels(channels.map(channel => 
      channel.id === channelId 
        ? { ...channel, enabled, status: enabled ? 'active' : 'inactive' }
        : channel
    ))
    message.success(`通知渠道已${enabled ? '启用' : '禁用'}`)
  }

  const handleTestChannel = (channel) => {
    message.loading('正在测试通知渠道...', 2)
    
    // 模拟测试过程
    setTimeout(() => {
      const success = Math.random() > 0.2 // 80% 成功率
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      
      setChannels(channels.map(c => 
        c.id === channel.id 
          ? { 
              ...c, 
              lastTest: now,
              testResult: success ? 'success' : 'failed'
            }
          : c
      ))
      
      if (success) {
        message.success(`${channel.name} 测试成功`)
      } else {
        message.error(`${channel.name} 测试失败`)
      }
    }, 2000)
  }

  const handleEditChannel = (channel) => {
    setEditingChannel(channel)
    channelForm.setFieldsValue({
      name: channel.name,
      enabled: channel.enabled,
      ...channel.config
    })
    setIsChannelModalVisible(true)
  }

  const handleSaveChannel = () => {
    channelForm.validateFields().then(values => {
      const { name, enabled, ...config } = values
      
      if (editingChannel) {
        setChannels(channels.map(channel => 
          channel.id === editingChannel.id 
            ? { 
                ...channel, 
                name,
                enabled,
                config,
                status: enabled ? 'active' : 'inactive'
              }
            : channel
        ))
        message.success('通知渠道更新成功')
      } else {
        const newChannel = {
          id: Date.now(),
          name,
          type: 'custom',
          enabled,
          config,
          status: enabled ? 'active' : 'inactive',
          lastTest: null,
          testResult: null
        }
        setChannels([...channels, newChannel])
        message.success('通知渠道创建成功')
      }
      
      setIsChannelModalVisible(false)
      setEditingChannel(null)
      channelForm.resetFields()
    })
  }

  const renderNotificationItem = (item) => {
    const typeConfig = notificationTypes.find(t => t.value === item.type)
    const isUnread = !item.readAt
    
    return (
      <List.Item
        key={item.id}
        style={{
          backgroundColor: isUnread ? '#f6ffed' : 'transparent',
          border: isUnread ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
          borderRadius: '6px',
          marginBottom: '8px',
          padding: '16px'
        }}
        actions={[
          !item.readAt && (
            <Tooltip title="标记为已读">
              <Button 
                type="text" 
                icon={<CheckOutlined />} 
                onClick={() => handleMarkAsRead(item.id)}
              />
            </Tooltip>
          ),
          <Popconfirm
            title="确定要删除这条通知吗？"
            onConfirm={() => handleDeleteNotification(item.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={isUnread}>
              <Avatar 
                icon={statusConfig[item.status]?.icon || <BellOutlined />} 
                style={{ backgroundColor: typeConfig?.color || '#1890ff' }}
              />
            </Badge>
          }
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: isUnread ? 'bold' : 'normal' }}>
                {item.title}
              </span>
              <Tag color={typeConfig?.color}>{typeConfig?.label}</Tag>
              <Tag color={priorityConfig[item.priority]?.color}>
                {priorityConfig[item.priority]?.text}优先级
              </Tag>
              {item.relatedTask && (
                <Tag color="blue">关联任务: {item.relatedTask}</Tag>
              )}
            </div>
          }
          description={
            <div>
              <div style={{ marginBottom: '8px' }}>{item.content}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <Space split={<Divider type="vertical" />}>
                  <span>发送者: {item.sender}</span>
                  <span>时间: {item.createdAt}</span>
                  <span>渠道: {channelIcons[item.channel]} {item.channel}</span>
                  <span>接收人: {item.recipients.join(', ')}</span>
                  {item.readAt && <span>已读时间: {item.readAt}</span>}
                </Space>
              </div>
            </div>
          }
        />
      </List.Item>
    )
  }

  const renderChannelItem = (channel) => {
    const getStatusColor = (status) => {
      return status === 'active' ? 'success' : 'default'
    }
    
    const getTestResultColor = (result) => {
      if (!result) return 'default'
      return result === 'success' ? 'success' : 'error'
    }
    
    return (
      <List.Item
        key={channel.id}
        actions={[
          <Switch
            checked={channel.enabled}
            onChange={(checked) => handleToggleChannel(channel.id, checked)}
          />,
          <Button 
            type="text" 
            onClick={() => handleTestChannel(channel)}
            disabled={!channel.enabled}
          >
            测试
          </Button>,
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEditChannel(channel)}
          />
        ]}
      >
        <List.Item.Meta
          avatar={<Avatar icon={channelIcons[channel.type]} />}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{channel.name}</span>
              <Tag color={getStatusColor(channel.status)}>
                {channel.status === 'active' ? '运行中' : '已停用'}
              </Tag>
              {channel.testResult && (
                <Tag color={getTestResultColor(channel.testResult)}>
                  测试{channel.testResult === 'success' ? '成功' : '失败'}
                </Tag>
              )}
            </div>
          }
          description={
            <div>
              <div>类型: {channel.type}</div>
              {channel.lastTest && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  最后测试: {channel.lastTest}
                </div>
              )}
            </div>
          }
        />
      </List.Item>
    )
  }

  return (
    <div>
      <Card 
        title={
          <Space>
            <BellOutlined />
            通知中心
            <Badge count={getUnreadCount()} />
          </Space>
        }
        extra={
          <Space>
            {activeTab === 'notifications' && (
              <>
                <Button onClick={handleMarkAllAsRead}>
                  全部已读
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                  发送通知
                </Button>
              </>
            )}
            {activeTab === 'channels' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setEditingChannel(null)
                channelForm.resetFields()
                setIsChannelModalVisible(true)
              }}>
                添加渠道
              </Button>
            )}
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="通知列表" key="notifications">
            {notifications.length > 0 ? (
              <List
                dataSource={notifications}
                renderItem={renderNotificationItem}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条通知`
                }}
              />
            ) : (
              <Empty description="暂无通知" />
            )}
          </TabPane>
          
          <TabPane tab="通知渠道" key="channels">
            <Alert
              message="通知渠道管理"
              description="在这里可以配置和管理各种通知渠道，包括邮件、Telegram、飞书等。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <List
              dataSource={channels}
              renderItem={renderChannelItem}
            />
          </TabPane>
          
          <TabPane tab="统计分析" key="statistics">
            <div style={{ padding: '20px' }}>
              <h3>通知统计</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {notifications.length}
                    </div>
                    <div>总通知数</div>
                  </div>
                </Card>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {notifications.filter(n => n.readAt).length}
                    </div>
                    <div>已读通知</div>
                  </div>
                </Card>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                      {getUnreadCount()}
                    </div>
                    <div>未读通知</div>
                  </div>
                </Card>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                      {channels.filter(c => c.enabled).length}
                    </div>
                    <div>活跃渠道</div>
                  </div>
                </Card>
              </div>
              
              <h4>通知类型分布</h4>
              <div style={{ marginBottom: '24px' }}>
                {notificationTypes.map(type => {
                  const count = notifications.filter(n => n.type === type.value).length
                  const percentage = notifications.length > 0 ? (count / notifications.length * 100).toFixed(1) : 0
                  return (
                    <div key={type.value} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>{type.label}</span>
                        <span>{count} ({percentage}%)</span>
                      </div>
                      <Progress percent={parseFloat(percentage)} strokeColor={type.color} />
                    </div>
                  )
                })}
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* 发送通知模态框 */}
      <Modal
        title="发送通知"
        open={isModalVisible}
        onOk={handleSendNotification}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        width={600}
        okText="发送"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'info',
            priority: 'medium',
            channel: 'system'
          }}
        >
          <Form.Item
            name="title"
            label="通知标题"
            rules={[{ required: true, message: '请输入通知标题' }]}
          >
            <Input placeholder="请输入通知标题" />
          </Form.Item>

          <Form.Item
            name="content"
            label="通知内容"
            rules={[{ required: true, message: '请输入通知内容' }]}
          >
            <TextArea rows={4} placeholder="请输入通知内容" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Form.Item
              name="type"
              label="通知类型"
              rules={[{ required: true, message: '请选择通知类型' }]}
            >
              <Select placeholder="请选择通知类型">
                {notificationTypes.map(type => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true, message: '请选择优先级' }]}
            >
              <Select placeholder="请选择优先级">
                <Option value="high">高优先级</Option>
                <Option value="medium">中优先级</Option>
                <Option value="low">低优先级</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="channel"
              label="发送渠道"
              rules={[{ required: true, message: '请选择发送渠道' }]}
            >
              <Select placeholder="请选择发送渠道">
                {channels.filter(c => c.enabled).map(channel => (
                  <Option key={channel.id} value={channel.type}>
                    {channel.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="recipients"
            label="接收人"
            rules={[{ required: true, message: '请输入接收人' }]}
          >
            <Input placeholder="请输入邮箱地址或用户ID，多个用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 渠道配置模态框 */}
      <Modal
        title={editingChannel ? '编辑通知渠道' : '添加通知渠道'}
        open={isChannelModalVisible}
        onOk={handleSaveChannel}
        onCancel={() => {
          setIsChannelModalVisible(false)
          setEditingChannel(null)
          channelForm.resetFields()
        }}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={channelForm}
          layout="vertical"
          initialValues={{
            enabled: true
          }}
        >
          <Form.Item
            name="name"
            label="渠道名称"
            rules={[{ required: true, message: '请输入渠道名称' }]}
          >
            <Input placeholder="请输入渠道名称" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider>渠道配置</Divider>

          {/* 这里可以根据不同的渠道类型显示不同的配置项 */}
          <Form.Item
            name="smtp"
            label="SMTP服务器"
          >
            <Input placeholder="例如: smtp.gmail.com" />
          </Form.Item>

          <Form.Item
            name="port"
            label="端口"
          >
            <Input placeholder="例如: 587" />
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotificationCenterPage