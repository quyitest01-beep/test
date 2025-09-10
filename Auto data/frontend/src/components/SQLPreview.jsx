import React from 'react'
import { Card, Typography, Button, Space, message } from 'antd'
import { CopyOutlined, FullscreenOutlined } from '@ant-design/icons'

const { Paragraph } = Typography

const SQLPreview = ({ sql, title = "SQL预览", showActions = true }) => {
  // 复制SQL到剪贴板
  const handleCopySQL = () => {
    navigator.clipboard.writeText(sql).then(() => {
      message.success('SQL已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败')
    })
  }
  
  // 全屏显示SQL
  const handleFullscreen = () => {
    // 创建全屏模态框显示SQL
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `
    
    const content = document.createElement('div')
    content.style.cssText = `
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
      position: relative;
    `
    
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '×'
    closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    `
    closeBtn.onclick = () => document.body.removeChild(modal)
    
    const pre = document.createElement('pre')
    pre.style.cssText = `
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
      color: #24292e;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    `
    pre.textContent = sql
    
    content.appendChild(closeBtn)
    content.appendChild(pre)
    modal.appendChild(content)
    document.body.appendChild(modal)
    
    // 点击背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    }
  }
  
  // SQL语法高亮（简单实现）
  const highlightSQL = (sqlText) => {
    if (!sqlText) return ''
    
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
      'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
      'DISTINCT', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
      'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE',
      'END', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'INSERT', 'UPDATE', 'DELETE',
      'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'DATABASE'
    ]
    
    let highlighted = sqlText
    
    // 高亮关键字
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      highlighted = highlighted.replace(regex, `<span style="color: #d73a49; font-weight: bold;">${keyword}</span>`)
    })
    
    // 高亮字符串
    highlighted = highlighted.replace(/'([^']*)'/g, '<span style="color: #032f62;">\'\$1\'</span>')
    
    // 高亮数字
    highlighted = highlighted.replace(/\b\d+\b/g, '<span style="color: #005cc5;">\$&</span>')
    
    // 高亮注释
    highlighted = highlighted.replace(/--.*$/gm, '<span style="color: #6a737d; font-style: italic;">\$&</span>')
    
    return highlighted
  }
  
  if (!sql) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        暂无SQL预览
      </div>
    )
  }
  
  return (
    <div>
      {showActions && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>{title}</h4>
          <Space>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopySQL}
            >
              复制
            </Button>
            <Button
              size="small"
              icon={<FullscreenOutlined />}
              onClick={handleFullscreen}
            >
              全屏
            </Button>
          </Space>
        </div>
      )}
      
      <div
        style={{
          background: '#f6f8fa',
          border: '1px solid #e1e4e8',
          borderRadius: '6px',
          padding: '16px',
          fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#24292e',
          maxHeight: '400px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
        dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }}
      />
    </div>
  )
}

export default SQLPreview