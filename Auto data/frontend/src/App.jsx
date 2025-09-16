import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Button } from 'antd'
import {
  DashboardOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BellOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import QueryPage from './pages/QueryPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import DashboardPage from './pages/DashboardPage'
import ScheduledTasksPage from './pages/ScheduledTasksPage'
import ReportsPage from './pages/ReportsPage'
import NotificationCenterPage from './pages/NotificationCenterPage'
import BotsPage from './pages/BotsPage'
import './App.css'

const { Header, Sider, Content } = Layout

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedKey, setSelectedKey] = useState('dashboard')

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: 'query',
      icon: <SearchOutlined />,
      label: '数据查询'
    },
    {
      key: 'scheduled-tasks',
      icon: <ClockCircleOutlined />,
      label: '定时任务'
    },
    {
      key: 'reports',
      icon: <FileTextOutlined />,
      label: '报告管理'
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: '通知中心'
    },
    {
      key: 'bots',
      icon: <RobotOutlined />,
      label: '智能客服'
    },
    {
      key: 'history',
      icon: <FileTextOutlined />,
      label: '查询历史'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ]

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ]

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <DashboardPage />
      case 'query':
        return <QueryPage />
      case 'scheduled-tasks':
        return <ScheduledTasksPage />
      case 'reports':
        return <ReportsPage />
      case 'notifications':
        return <NotificationCenterPage />
      case 'bots':
        return <BotsPage />
      case 'history':
        return <HistoryPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="dark"
        width={256}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div className="logo" style={{
          height: '64px',
          margin: '16px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? '16px' : '18px',
          fontWeight: 'bold'
        }}>
          {collapsed ? 'IDS' : '智能数据查询系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'all 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <h2 style={{ margin: 0, marginLeft: 16 }}>
              {menuItems.find(item => item.key === selectedKey)?.label || '仪表盘'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={5}>
              <BellOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
            </Badge>
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    console.log('退出登录')
                  }
                }
              }}
              placement="bottomRight"
            >
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span style={{ marginLeft: 8 }}>管理员</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          margin: '24px',
          padding: '24px',
          background: '#fff',
          borderRadius: '8px',
          minHeight: 'calc(100vh - 112px)'
        }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App