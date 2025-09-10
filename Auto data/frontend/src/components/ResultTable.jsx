import React, { useState, useMemo } from 'react'
import { Table, Button, Space, Typography, Tag, Tooltip, Input, Select, message } from 'antd'
import {
  DownloadOutlined,
  FullscreenOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons'
import * as XLSX from 'xlsx'

const { Text } = Typography
const { Option } = Select

const ResultTable = ({ 
  data = [], 
  loading = false, 
  pagination = true,
  showExport = true,
  title = "查询结果"
}) => {
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState('')
  const [filteredData, setFilteredData] = useState(data)
  
  // 生成表格列配置
  const columns = useMemo(() => {
    if (!data || data.length === 0) return []
    
    const firstRow = data[0]
    return Object.keys(firstRow).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      width: 150,
      ellipsis: {
        showTitle: false
      },
      render: (text) => {
        if (text === null || text === undefined) {
          return <Text type="secondary">NULL</Text>
        }
        
        const textStr = String(text)
        if (textStr.length > 50) {
          return (
            <Tooltip title={textStr}>
              <Text>{textStr.substring(0, 50)}...</Text>
            </Tooltip>
          )
        }
        
        return <Text>{textStr}</Text>
      },
      sorter: (a, b) => {
        const aVal = a[key]
        const bVal = b[key]
        
        if (aVal === null || aVal === undefined) return -1
        if (bVal === null || bVal === undefined) return 1
        
        // 数字排序
        if (!isNaN(aVal) && !isNaN(bVal)) {
          return Number(aVal) - Number(bVal)
        }
        
        // 字符串排序
        return String(aVal).localeCompare(String(bVal))
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder={`搜索 ${key}`}
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters()
                confirm()
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: filtered => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value, record) => {
        const recordValue = record[key]
        if (recordValue === null || recordValue === undefined) return false
        return String(recordValue).toLowerCase().includes(String(value).toLowerCase())
      }
    }))
  }, [data])
  
  // 导出Excel
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    
    try {
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Query Results')
      
      const fileName = `athena_query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      message.success('数据导出成功')
    } catch (error) {
      console.error('Export error:', error)
      message.error('导出失败，请重试')
    }
  }
  
  // 导出CSV
  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    
    try {
      const headers = Object.keys(data[0])
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header]
            if (value === null || value === undefined) return ''
            const stringValue = String(value)
            // 如果包含逗号或引号，需要用引号包围并转义
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        )
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `athena_query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      message.success('数据导出成功')
    } catch (error) {
      console.error('Export error:', error)
      message.error('导出失败，请重试')
    }
  }
  
  // 全屏显示表格
  const handleFullscreen = () => {
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #fff;
      z-index: 9999;
      padding: 20px;
      overflow: auto;
    `
    
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '关闭'
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      padding: 8px 16px;
      background: #1890ff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `
    closeBtn.onclick = () => document.body.removeChild(modal)
    
    const tableContainer = document.createElement('div')
    tableContainer.style.cssText = `
      margin-top: 60px;
      height: calc(100% - 80px);
      overflow: auto;
    `
    
    // 这里应该渲染完整的表格，简化处理
    tableContainer.innerHTML = `
      <h2>${title}</h2>
      <p>记录数: ${data.length}</p>
      <div style="overflow: auto; height: 100%;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #f0f0f0;">
          <thead>
            <tr style="background: #fafafa;">
              ${Object.keys(data[0] || {}).map(key => 
                `<th style="padding: 12px; border: 1px solid #f0f0f0; text-align: left;">${key}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.slice(0, 1000).map(row => 
              `<tr>
                ${Object.keys(data[0] || {}).map(key => 
                  `<td style="padding: 12px; border: 1px solid #f0f0f0;">${row[key] || ''}</td>`
                ).join('')}
              </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    `
    
    modal.appendChild(closeBtn)
    modal.appendChild(tableContainer)
    document.body.appendChild(modal)
  }
  
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        暂无查询结果
      </div>
    )
  }
  
  return (
    <div>
      {/* 表格头部操作栏 */}
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>{title}</Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {data.length} 条记录
          </Tag>
        </div>
        
        {showExport && (
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              size="small"
            >
              导出Excel
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              size="small"
            >
              导出CSV
            </Button>
            <Button
              icon={<FullscreenOutlined />}
              onClick={handleFullscreen}
              size="small"
            >
              全屏查看
            </Button>
          </Space>
        )}
      </div>
      
      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data.map((item, index) => ({ ...item, key: index }))}
        loading={loading}
        pagination={pagination ? {
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100', '200'],
          defaultPageSize: 20
        } : false}
        scroll={{ x: 'max-content', y: 400 }}
        size="small"
        bordered
      />
    </div>
  )
}

export default ResultTable