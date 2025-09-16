import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  InputNumber,
  Space,
  Divider,
  Alert,
  Tag,
  message,
  Tabs,
  Row,
  Col
} from 'antd'
import {
  SaveOutlined,

  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import {
  fetchUserSettings,
  updateUserSettings,
  testAthenaConnection,
  updateAthenaConfig,
  updateQuerySettings,
  updateUISettings,
  updateNotificationSettings,
  clearError,
  resetConnectionTest
} from '../store/slices/settingsSlice'

const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

const SettingsPage = () => {
  const dispatch = useDispatch()
  const {
    athenaConfig,
    querySettings,
    uiSettings,
    notificationSettings,
    loading,
    saving,
    testing,
    error,
    connectionTest
  } = useSelector(state => state.settings)
  
  const [form] = Form.useForm()
  const [hasChanges, setHasChanges] = useState(false)
  
  // 初始加载设置
  useEffect(() => {
    dispatch(fetchUserSettings())
  }, [])
  
  // 监听表单变化
  const handleFormChange = () => {
    setHasChanges(true)
  }
  
  // 保存设置
  const handleSaveSettings = async () => {
    try {
      const values = await form.validateFields()
      
      // 分别更新各个设置模块
      dispatch(updateAthenaConfig(values.athenaConfig))
      dispatch(updateQuerySettings(values.querySettings))
      dispatch(updateUISettings(values.uiSettings))
      dispatch(updateNotificationSettings(values.notificationSettings))
      
      // 保存到服务器
      await dispatch(updateUserSettings({
        athenaConfig: values.athenaConfig,
        querySettings: values.querySettings,
        uiSettings: values.uiSettings,
        notificationSettings: values.notificationSettings
      })).unwrap()
      
      setHasChanges(false)
      message.success('设置保存成功')
    } catch (error) {
      message.error(`设置保存失败: ${error}`)
    }
  }
  
  // 测试Athena连接
  const handleTestConnection = async () => {
    try {
      const athenaValues = await form.validateFields(['athenaConfig'])
      await dispatch(testAthenaConnection(athenaValues.athenaConfig)).unwrap()
    } catch (error) {
      // 错误已在reducer中处理
    }
  }
  
  // 重置连接测试
  const handleResetConnectionTest = () => {
    dispatch(resetConnectionTest())
  }
  
  // 渲染连接测试状态
  const renderConnectionTestStatus = () => {
    if (!connectionTest.status) return null
    
    const isSuccess = connectionTest.status === 'success'
    return (
      <Alert
        message={isSuccess ? '连接测试成功' : '连接测试失败'}
        description={
          <div>
            <div>{connectionTest.message}</div>
            {connectionTest.lastTested && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                测试时间: {new Date(connectionTest.lastTested).toLocaleString()}
              </div>
            )}
          </div>
        }
        type={isSuccess ? 'success' : 'error'}
        icon={isSuccess ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        showIcon
        closable
        onClose={handleResetConnectionTest}
        style={{ marginTop: 16 }}
      />
    )
  }
  
  return (
    <div className="settings-container">
      <Card
        title="系统设置"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSettings}
              loading={saving}
              disabled={!hasChanges}
            >
              保存设置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                dispatch(fetchUserSettings())
                form.resetFields()
                setHasChanges(false)
              }}
              loading={loading}
            >
              重置
            </Button>
          </Space>
        }
      >
        {error && (
          <Alert
            message="设置加载失败"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(clearError())}
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            athenaConfig,
            querySettings,
            uiSettings,
            notificationSettings
          }}
          onValuesChange={handleFormChange}
        >
          <Tabs defaultActiveKey="athena">
            {/* Athena连接配置 */}
            <TabPane tab="Athena连接" key="athena">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'region']}
                    label="AWS区域"
                    rules={[{ required: true, message: '请选择AWS区域' }]}
                  >
                    <Select placeholder="选择AWS区域">
                      <Option value="us-east-1">US East (N. Virginia)</Option>
                      <Option value="us-west-2">US West (Oregon)</Option>
                      <Option value="eu-west-1">Europe (Ireland)</Option>
                      <Option value="ap-southeast-1">Asia Pacific (Singapore)</Option>
                      <Option value="ap-northeast-1">Asia Pacific (Tokyo)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'workgroup']}
                    label="工作组"
                    rules={[{ required: true, message: '请输入工作组名称' }]}
                  >
                    <Input placeholder="primary" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'database']}
                    label="默认数据库"
                    rules={[{ required: true, message: '请输入数据库名称' }]}
                  >
                    <Input placeholder="your_database" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'outputLocation']}
                    label="查询结果存储位置"
                    rules={[{ required: true, message: '请输入S3存储位置' }]}
                  >
                    <Input placeholder="s3://your-bucket/athena-results/" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Divider>AWS凭证</Divider>
              
              <Alert
                message="安全提示"
                description="建议使用IAM角色或临时凭证，避免在此处存储长期访问密钥。"
                type="info"
                icon={<InfoCircleOutlined />}
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'accessKeyId']}
                    label="Access Key ID"
                  >
                    <Input.Password placeholder="AKIA..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['athenaConfig', 'secretAccessKey']}
                    label="Secret Access Key"
                  >
                    <Input.Password placeholder="..." />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleTestConnection}
                  loading={testing}
                >
                  测试连接
                </Button>
              </Form.Item>
              
              {renderConnectionTestStatus()}
            </TabPane>
            
            {/* 查询设置 */}
            <TabPane tab="查询设置" key="query">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['querySettings', 'maxRows']}
                    label="单次查询最大行数"
                    rules={[{ required: true, message: '请输入最大行数' }]}
                  >
                    <InputNumber
                      min={1000}
                      max={1000000}
                      step={10000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['querySettings', 'timeout']}
                    label="查询超时时间（秒）"
                    rules={[{ required: true, message: '请输入超时时间' }]}
                  >
                    <InputNumber min={30} max={3600} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['querySettings', 'autoSplit']}
                    label="自动拆分大查询"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['querySettings', 'splitThreshold']}
                    label="拆分阈值（行数）"
                    rules={[{ required: true, message: '请输入拆分阈值' }]}
                  >
                    <InputNumber
                      min={10000}
                      max={1000000}
                      step={10000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item
                name={['querySettings', 'defaultExportFormat']}
                label="默认导出格式"
              >
                <Select>
                  <Option value="xlsx">Excel (.xlsx)</Option>
                  <Option value="csv">CSV (.csv)</Option>
                  <Option value="json">JSON (.json)</Option>
                </Select>
              </Form.Item>
            </TabPane>
            
            {/* UI设置 */}
            <TabPane tab="界面设置" key="ui">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['uiSettings', 'theme']}
                    label="主题"
                  >
                    <Select>
                      <Option value="light">浅色主题</Option>
                      <Option value="dark">深色主题</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['uiSettings', 'language']}
                    label="语言"
                  >
                    <Select>
                      <Option value="zh-CN">中文</Option>
                      <Option value="en-US">English</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['uiSettings', 'pageSize']}
                    label="每页显示条数"
                  >
                    <Select>
                      <Option value={10}>10条/页</Option>
                      <Option value={20}>20条/页</Option>
                      <Option value={50}>50条/页</Option>
                      <Option value={100}>100条/页</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['uiSettings', 'autoRefresh']}
                    label="自动刷新查询状态"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item
                name={['uiSettings', 'refreshInterval']}
                label="刷新间隔（毫秒）"
                rules={[{ required: true, message: '请输入刷新间隔' }]}
              >
                <InputNumber min={1000} max={60000} step={1000} style={{ width: '100%' }} />
              </Form.Item>
            </TabPane>
            
            {/* 通知设置 */}
            <TabPane tab="通知设置" key="notification">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item
                  name={['notificationSettings', 'queryComplete']}
                  label="查询完成通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name={['notificationSettings', 'queryFailed']}
                  label="查询失败通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name={['notificationSettings', 'exportComplete']}
                  label="导出完成通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name={['notificationSettings', 'soundEnabled']}
                  label="声音通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Space>
            </TabPane>
          </Tabs>
        </Form>
      </Card>
    </div>
  )
}

export default SettingsPage