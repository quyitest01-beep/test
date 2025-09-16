import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  TimePicker,
  Switch,
  Popconfirm,
  message,
  Tooltip,
  Badge
} from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select

const ScheduledTasksPage = () => {
  const [tasks, setTasks] = useState([
    {
      id: 1,
      name: '每日销售数据统计',
      description: '统计昨日销售数据，包括订单量、收入等指标',
      query: '查询昨天的销售数据，包括订单数量和总收入',
      schedule: 'daily',
      time: '09:00',
      status: 'running',
      enabled: true,
      lastRun: '2024-01-17 09:00:00',
      nextRun: '2024-01-18 09:00:00',
      recipients: ['admin@company.com', 'sales@company.com'],
      createdAt: '2024-01-15 10:30:00'
    },
    {
      id: 2,
      name: '周度用户活跃报告',
      description: '生成每周用户活跃度分析报告',
      query: '分析本周用户活跃情况，包括DAU、MAU等指标',
      schedule: 'weekly',
      time: '10:00',
      status: 'completed',
      enabled: true,
      lastRun: '2024-01-15 10:00:00',
      nextRun: '2024-01-22 10:00:00',
      recipients: ['product@company.com'],
      createdAt: '2024-01-10 14:20:00'
    },
    {
      id: 3,
      name: '月度财务汇总',
      description: '生成月度财务数据汇总报告',
      query: '汇总本月所有财务数据，包括收入、支出、利润等',
      schedule: 'monthly',
      time: '08:00',
      status: 'paused',
      enabled: false,
      lastRun: '2024-01-01 08:00:00',
      nextRun: '2024-02-01 08:00:00',
      recipients: ['finance@company.com', 'ceo@company.com'],
      createdAt: '2024-01-01 16:45:00'
    }
  ])

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [form] = Form.useForm()

  const scheduleOptions = [
    { value: 'daily', label: '每天' },
    { value: 'weekly', label: '每周' },
    { value: 'monthly', label: '每月' },
    { value: 'custom', label: '自定义' }
  ]

  const getStatusTag = (status) => {
    const statusConfig = {
      running: { color: 'processing', text: '运行中', icon: <PlayCircleOutlined /> },
      completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      paused: { color: 'warning', text: '已暂停', icon: <PauseCircleOutlined /> },
      failed: { color: 'error', text: '执行失败', icon: <ExclamationCircleOutlined /> },
      stopped: { color: 'default', text: '已停止', icon: <StopOutlined /> }
    }
    const config = statusConfig[status] || statusConfig.stopped
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    form.setFieldsValue({
      ...task,
      time: dayjs(task.time, 'HH:mm'),
      recipients: task.recipients.join(', ')
    })
    setIsModalVisible(true)
  }

  const handleDeleteTask = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId))
    message.success('任务删除成功')
  }

  const handleToggleTask = (taskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const newEnabled = !task.enabled
        const newStatus = newEnabled ? 'running' : 'paused'
        return { ...task, enabled: newEnabled, status: newStatus }
      }
      return task
    }))
    message.success('任务状态更新成功')
  }

  const handleRunTask = (taskId) => {
    message.success('任务已手动执行')
    // 这里可以添加实际的任务执行逻辑
  }

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const formData = {
        ...values,
        time: values.time.format('HH:mm'),
        recipients: values.recipients.split(',').map(email => email.trim()),
        status: values.enabled ? 'running' : 'paused'
      }

      if (editingTask) {
        // 编辑任务
        setTasks(tasks.map(task => 
          task.id === editingTask.id 
            ? { ...task, ...formData }
            : task
        ))
        message.success('任务更新成功')
      } else {
        // 创建新任务
        const newTask = {
          id: Date.now(),
          ...formData,
          lastRun: null,
          nextRun: '计算中...',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
        }
        setTasks([...tasks, newTask])
        message.success('任务创建成功')
      }

      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: '执行计划',
      dataIndex: 'schedule',
      key: 'schedule',
      render: (schedule, record) => (
        <div>
          <div>{scheduleOptions.find(opt => opt.value === schedule)?.label}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>每天 {record.time}</div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          {getStatusTag(status)}
          <div style={{ marginTop: 4 }}>
            <Switch 
              size="small" 
              checked={record.enabled} 
              onChange={() => handleToggleTask(record.id)}
            />
            <span style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
              {record.enabled ? '启用' : '禁用'}
            </span>
          </div>
        </div>
      )
    },
    {
      title: '执行时间',
      key: 'execution',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: '#666' }}>上次：</span>
            {record.lastRun || '未执行'}
          </div>
          <div style={{ fontSize: '12px', marginTop: 2 }}>
            <span style={{ color: '#666' }}>下次：</span>
            {record.nextRun}
          </div>
        </div>
      )
    },
    {
      title: '接收人',
      dataIndex: 'recipients',
      key: 'recipients',
      render: (recipients) => (
        <div>
          {recipients.slice(0, 2).map((email, index) => (
            <Tag key={index} size="small">{email}</Tag>
          ))}
          {recipients.length > 2 && (
            <Tooltip title={recipients.slice(2).join(', ')}>
              <Tag size="small">+{recipients.length - 2}</Tag>
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="立即执行">
            <Button 
              type="text" 
              icon={<PlayCircleOutlined />} 
              onClick={() => handleRunTask(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEditTask(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={() => handleDeleteTask(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Card 
        title={
          <Space>
            <ClockCircleOutlined />
            定时任务管理
            <Badge count={tasks.filter(task => task.enabled).length} showZero />
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
            新建任务
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个任务`
          }}
        />
      </Card>

      <Modal
        title={editingTask ? '编辑定时任务' : '新建定时任务'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            enabled: true,
            schedule: 'daily',
            time: dayjs('09:00', 'HH:mm')
          }}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea rows={2} placeholder="请输入任务描述" />
          </Form.Item>

          <Form.Item
            name="query"
            label="查询内容"
            rules={[{ required: true, message: '请输入查询内容' }]}
          >
            <TextArea rows={3} placeholder="请输入自然语言查询内容" />
          </Form.Item>

          <Form.Item
            name="schedule"
            label="执行频率"
            rules={[{ required: true, message: '请选择执行频率' }]}
          >
            <Select placeholder="请选择执行频率">
              {scheduleOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="time"
            label="执行时间"
            rules={[{ required: true, message: '请选择执行时间' }]}
          >
            <TimePicker format="HH:mm" placeholder="请选择执行时间" />
          </Form.Item>

          <Form.Item
            name="recipients"
            label="报告接收人"
            rules={[{ required: true, message: '请输入接收人邮箱' }]}
          >
            <Input placeholder="请输入邮箱地址，多个邮箱用逗号分隔" />
          </Form.Item>

          <Form.Item name="enabled" valuePropName="checked">
            <Switch /> <span style={{ marginLeft: 8 }}>创建后立即启用</span>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ScheduledTasksPage