import React from 'react'
import { Layout } from 'antd'
import QueryPage from './pages/QueryPage'
import './App.css'

const { Content } = Layout

function App() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#f0f2f5'
        }}
      >
        <QueryPage />
      </Content>
    </Layout>
  )
}

export default App