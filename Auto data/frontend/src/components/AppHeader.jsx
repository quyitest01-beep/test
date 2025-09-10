import React from 'react'
import { Layout, Typography, Space, Avatar, Dropdown, Menu, Badge } from 'antd'
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Header } = Layout
const { Title } = Typography

const AppHeader = () => {
  const navigate = useNavigate()
  
  // 用户菜单
  const userMenu = (
    <Menu
      items={[
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: '个人资料',
          onClick: () => {
            // 跳转到个人资料页面
          }
        },
        {
          key: 'settings',
          icon: <SettingOutlined />,
          label: '系统设置',
          onClick: () => navigate('/settings')
        },
        {
          type: 'divider'
        },
        {
          key: 'help',
          icon: <QuestionCircleOutlined />,
          label: '帮助文档',
          onClick: () => {
            window.open('https://docs.aws.amazon.com/athena/', '_blank')
          }
        },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: () => {
            // 处理退出登录
            localStorage.removeItem('auth_token')
            window.location.href = '/login'
          }
        }
      ]}
    />
  )
  
  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      {/* 左侧标题 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12
          }}
        >
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>A</span>
        </div>
        <Title level={4} style={{ margin: 0, color: '#262626' }}>
          Athena智能数据查询系统
        </Title>
      </div>
      
      {/* 右侧用户信息 */}
      <Space size="large">
        {/* 通知铃铛 */}
        <Badge count={0} size="small">
          <BellOutlined
            style={{
              fontSize: '18px',
              color: '#666',
              cursor: 'pointer'
            }}
            onClick={() => {
              // 显示通知面板
            }}
          />
        </Badge>
        
        {/* 用户头像和菜单 */}
        <Dropdown overlay={userMenu} placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff' }}
            />
            <span style={{ marginLeft: 8, color: '#262626' }}>管理员</span>
          </div>
        </Dropdown>
      </Space>
    </Header>
  )
}

export default AppHeader