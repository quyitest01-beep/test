import React from 'react'
import { Layout, Menu } from 'antd'
import {
  SearchOutlined,
  HistoryOutlined,
  SettingOutlined,
  DashboardOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Sider } = Layout

const AppSider = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // 菜单项配置
  const menuItems = [
    {
      key: '/query',
      icon: <SearchOutlined />,
      label: '智能查询',
      onClick: () => navigate('/query')
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: '查询历史',
      onClick: () => navigate('/history')
    },
    {
      type: 'divider'
    },
    {
      key: 'data-management',
      icon: <DatabaseOutlined />,
      label: '数据管理',
      children: [
        {
          key: '/databases',
          label: '数据库浏览',
          onClick: () => {
            // 跳转到数据库浏览页面
          }
        },
        {
          key: '/tables',
          label: '表结构查看',
          onClick: () => {
            // 跳转到表结构页面
          }
        }
      ]
    },
    {
      key: 'system',
      icon: <DashboardOutlined />,
      label: '系统管理',
      children: [
        {
          key: '/settings',
          label: '系统设置',
          onClick: () => navigate('/settings')
        },
        {
          key: '/monitoring',
          label: '监控面板',
          onClick: () => {
            // 跳转到监控页面
          }
        },
        {
          key: '/logs',
          label: '操作日志',
          onClick: () => {
            // 跳转到日志页面
          }
        }
      ]
    }
  ]
  
  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const path = location.pathname
    if (path === '/' || path === '/query') {
      return ['/query']
    }
    return [path]
  }
  
  // 获取展开的菜单项
  const getOpenKeys = () => {
    const path = location.pathname
    if (path === '/settings') {
      return ['system']
    }
    return []
  }
  
  return (
    <Sider
      width={220}
      style={{
        background: '#001529',
        minHeight: 'calc(100vh - 64px)'
      }}
    >
      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        style={{
          height: '100%',
          borderRight: 0,
          paddingTop: 16
        }}
        items={menuItems}
      />
    </Sider>
  )
}

export default AppSider