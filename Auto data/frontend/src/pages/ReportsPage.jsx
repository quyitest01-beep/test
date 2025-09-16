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
  DatePicker,
  Progress,
  Popconfirm,
  message,
  Tooltip,
  Badge,
  Upload,
  Divider
} from 'antd'
import {
  PlusOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SendOutlined,
  ReloadOutlined,
  ExportOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select
const { RangePicker } = DatePicker
const { Dragger } = Upload

const ReportsPage = () => {
  const [reports, setReports] = useState([
    {
      id: 1,
      name: '2024年1月销售数据报告',
      type: 'scheduled',
      status: 'completed',
      progress: 100,
      query: '查询2024年1月的销售数据，包括订单量、收入、客户分布等',
      generatedAt: '2024-01-17 09:15:00',
      fileSize: '2.5MB',
      format: 'Excel',
      recipients: ['sales@company.com', 'manager@company.com'],
      downloadCount: 15,
      createdBy: '定时任务',
      taskId: 1
    },
    {
      id: 2,
      name: '用户行为分析报告',
      type: 'manual',
      status: 'generating',
      progress: 65,
      query: '分析用户在平台上的行为模式，包括访问路径、停留时间等',
      generatedAt: null,
      fileSize: null,
      format: 'PDF',
      recipients: ['product@company.com'],
      downloadCount: 0,
      createdBy: '管理员',
      taskId: null
    },
    {
      id: 3,
      name: '财务月度汇总',
      type: 'scheduled',
      status: 'failed',
      progress: 0,
      query: '汇总本月财务数据，包括收入、支出、利润分析',
      generatedAt: null,
      fileSize: null,
      format: 'Excel',
      recipients: ['finance@company.com'],
      downloadCount: 0,
      createdBy: '定时任务',
      taskId: 3,
      errorMessage: '数据库连接超时'
    },
    {
      id: 4,
      name: '客户满意度调查报告',
      type: 'manual',
      status: 'completed',
      progress: 100,
      query: '分析客户满意度调查结果，生成可视化报告',
      generatedAt: '2024-01-16 14:30:00',
      fileSize: '1.8MB',
      format: 'PDF',
      recipients: ['service@company.com'],
      downloadCount: 8,
      createdBy: '客服主管',
      taskId: null
    }
  ])

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [templateForm] = Form.useForm()

  const reportTypes = [
    { value: 'manual', label: '手动生成' },
    { value: 'scheduled', label: '定时生成' }
  ]

  const formatOptions = [
    { value: 'Excel', label: 'Excel (.xlsx)' },
    { value: 'PDF', label: 'PDF (.pdf)' },
    { value: 'CSV', label: 'CSV (.csv)' }
  ]

  const getStatusTag = (status, progress) => {
    const statusConfig = {
      completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      generating: { color: 'processing', text: '生成中', icon: <ClockCircleOutlined /> },
      failed: { color: 'error', text: '生成失败', icon: <ExclamationCircleOutlined /> },
      pending: { color: 'default', text: '等待中', icon: <StopOutlined /> }
    }
    const config = statusConfig[status] || statusConfig.pending
    
    if (status === 'generating') {
      return (
        <div>
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
          <Progress percent={progress} size="small" style={{ marginTop: 4, width: 100 }} />
        </div>
      )
    }
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  const handleCreateReport = () => {
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleDeleteReport = (reportId) => {
    setReports(reports.filter(report => report.id !== reportId))
    message.success('报告删除成功')
  }

  const handleDownloadReport = (report) => {
    if (report.status === 'completed') {
      message.success(`正在下载 ${report.name}`)
      // 这里可以添加实际的下载逻辑
      setReports(reports.map(r => 
        r.id === report.id 
          ? { ...r, downloadCount: r.downloadCount + 1 }
          : r
      ))
    } else {
      message.warning('报告尚未生成完成')
    }
  }

  const handleResendReport = (report) => {
    message.success(`正在重新发送 ${report.name}`)
    // 这里可以添加实际的重发逻辑
  }

  const handleRegenerateReport = (reportId) => {
    setReports(reports.map(report => 
      report.id === reportId 
        ? { ...report, status: 'generating', progress: 0, errorMessage: null }
        : report
    ))
    message.success('报告重新生成中')
    
    // 模拟生成进度
    let progress = 0
    const timer = setInterval(() => {
      progress += Math.random() * 20
      if (progress >= 100) {
        progress = 100
        clearInterval(timer)
        setReports(prev => prev.map(report => 
          report.id === reportId 
            ? { 
                ...report, 
                status: 'completed', 
                progress: 100,
                generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                fileSize: '2.1MB'
              }
            : report
        ))
        message.success('报告生成完成')
      } else {
        setReports(prev => prev.map(report => 
          report.id === reportId 
            ? { ...report, progress: Math.floor(progress) }
            : report
        ))
      }
    }, 1000)
  }

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const newReport = {
        id: Date.now(),
        ...values,
        type: 'manual',
        status: 'generating',
        progress: 0,
        generatedAt: null,
        fileSize: null,
        recipients: values.recipients.split(',').map(email => email.trim()),
        downloadCount: 0,
        createdBy: '管理员',
        taskId: null
      }
      
      setReports([newReport, ...reports])
      message.success('报告生成任务已创建')
      setIsModalVisible(false)
      form.resetFields()
      
      // 模拟生成过程
      setTimeout(() => {
        handleRegenerateReport(newReport.id)
      }, 1000)
    })
  }

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.pdf,.csv',
    beforeUpload: (file) => {
      const isValidType = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                          'application/vnd.ms-excel', 
                          'application/pdf', 
                          'text/csv'].includes(file.type)
      if (!isValidType) {
        message.error('只支持 Excel、PDF、CSV 格式的文件')
        return false
      }
      const isLt10M = file.size / 1024 / 1024 < 10
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB')
        return false
      }
      return false // 阻止自动上传
    },
    onChange: (info) => {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 模板上传成功`)
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 模板上传失败`)
      }
    }
  }

  const columns = [
    {
      title: '报告名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{text}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.query.length > 50 ? `${record.query.substring(0, 50)}...` : record.query}
          </div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <div>
          <Tag color={type === 'scheduled' ? 'blue' : 'green'}>
            {type === 'scheduled' ? '定时生成' : '手动生成'}
          </Tag>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            {record.format}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          {getStatusTag(status, record.progress)}
          {record.errorMessage && (
            <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: 4 }}>
              {record.errorMessage}
            </div>
          )}
        </div>
      )
    },
    {
      title: '生成信息',
      key: 'info',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: '#666' }}>创建者：</span>
            {record.createdBy}
          </div>
          {record.generatedAt && (
            <div style={{ fontSize: '12px', marginTop: 2 }}>
              <span style={{ color: '#666' }}>生成时间：</span>
              {record.generatedAt}
            </div>
          )}
          {record.fileSize && (
            <div style={{ fontSize: '12px', marginTop: 2 }}>
              <span style={{ color: '#666' }}>文件大小：</span>
              {record.fileSize}
            </div>
          )}
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
      title: '下载次数',
      dataIndex: 'downloadCount',
      key: 'downloadCount',
      render: (count) => (
        <Badge count={count} showZero style={{ backgroundColor: '#52c41a' }} />
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'completed' && (
            <>
              <Tooltip title="下载">
                <Button 
                  type="text" 
                  icon={<DownloadOutlined />} 
                  onClick={() => handleDownloadReport(record)}
                />
              </Tooltip>
              <Tooltip title="重新发送">
                <Button 
                  type="text" 
                  icon={<SendOutlined />} 
                  onClick={() => handleResendReport(record)}
                />
              </Tooltip>
            </>
          )}
          {record.status === 'failed' && (
            <Tooltip title="重新生成">
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={() => handleRegenerateReport(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="预览">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              disabled={record.status !== 'completed'}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个报告吗？"
            onConfirm={() => handleDeleteReport(record.id)}
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
            <FileTextOutlined />
            报告管理
            <Badge count={reports.filter(report => report.status === 'generating').length} />
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<ExportOutlined />} 
              onClick={() => setIsTemplateModalVisible(true)}
            >
              模板管理
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateReport}>
              生成报告
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个报告`
          }}
        />
      </Card>

      {/* 生成报告模态框 */}
      <Modal
        title="生成新报告"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        width={600}
        okText="开始生成"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            format: 'Excel'
          }}
        >
          <Form.Item
            name="name"
            label="报告名称"
            rules={[{ required: true, message: '请输入报告名称' }]}
          >
            <Input placeholder="请输入报告名称" />
          </Form.Item>

          <Form.Item
            name="query"
            label="查询内容"
            rules={[{ required: true, message: '请输入查询内容' }]}
          >
            <TextArea rows={3} placeholder="请输入自然语言查询内容" />
          </Form.Item>

          <Form.Item
            name="format"
            label="报告格式"
            rules={[{ required: true, message: '请选择报告格式' }]}
          >
            <Select placeholder="请选择报告格式">
              {formatOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="recipients"
            label="报告接收人"
            rules={[{ required: true, message: '请输入接收人邮箱' }]}
          >
            <Input placeholder="请输入邮箱地址，多个邮箱用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模板管理模态框 */}
      <Modal
        title="报告模板管理"
        open={isTemplateModalVisible}
        onCancel={() => setIsTemplateModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsTemplateModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        <div>
          <h4>上传报告模板</h4>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 Excel、PDF、CSV 格式，文件大小不超过 10MB
            </p>
          </Dragger>
          
          <Divider />
          
          <h4>现有模板</h4>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px' }}>
            <p style={{ color: '#666', textAlign: 'center' }}>暂无上传的模板</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ReportsPage