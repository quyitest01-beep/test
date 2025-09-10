import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  DatePicker,
  Select,
  Modal,
  message,
  Popconfirm,
  Tooltip,
  Typography
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import {
  fetchQueryHistory,
  deleteHistoryItem,
  rerunHistoryQuery,
  setFilters,
  setPagination,
  clearError
} from '../store/slices/historySlice'
import { setQueryText } from '../store/slices/querySlice'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Text, Paragraph } = Typography

const HistoryPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const {
    items,
    pagination,
    filters,
    loading,
    error,
    deleting,
    rerunning
  } = useSelector(state => state.history)
  
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  
  // 初始加载历史记录
  useEffect(() => {
    dispatch(fetchQueryHistory({ page: 1, pageSize: pagination.pageSize }))
  }, [])
  
  // 刷新数据
  const handleRefresh = () => {
    dispatch(fetchQueryHistory({
      page: pagination.current,
      pageSize: pagination.pageSize,
      filters
    }))
  }
  
  // 搜索
  const handleSearch = (value) => {
    dispatch(setFilters({ keyword: value }))
    dispatch(fetchQueryHistory({
      page: 1,
      pageSize: pagination.pageSize,
      filters: { ...filters, keyword: value }
    }))
  }
  
  // 状态筛选
  const handleStatusFilter = (status) => {
    dispatch(setFilters({ status }))
    dispatch(fetchQueryHistory({
      page: 1,
      pageSize: pagination.pageSize,
      filters: { ...filters, status }
    }))
  }
  
  // 日期范围筛选
  const handleDateRangeFilter = (dates) => {
    const dateRange = dates ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : null
    dispatch(setFilters({ dateRange }))
    dispatch(fetchQueryHistory({
      page: 1,
      pageSize: pagination.pageSize,
      filters: { ...filters, dateRange }
    }))
  }
  
  // 分页变化
  const handleTableChange = (paginationConfig) => {
    dispatch(setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize
    }))
    dispatch(fetchQueryHistory({
      page: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      filters
    }))
  }
  
  // 删除历史记录
  const handleDelete = async (queryId) => {
    try {
      await dispatch(deleteHistoryItem(queryId)).unwrap()
      message.success('删除成功')
    } catch (error) {
      message.error(`删除失败: ${error}`)
    }
  }
  
  // 重新执行查询
  const handleRerun = async (item) => {
    try {
      await dispatch(rerunHistoryQuery(item.id)).unwrap()
      dispatch(setQueryText(item.queryText))
      navigate('/query')
      message.success('查询已重新提交')
    } catch (error) {
      message.error(`重新执行失败: ${error}`)
    }
  }
  
  // 查看详情
  const handleViewDetail = (item) => {
    setSelectedItem(item)
    setDetailModalVisible(true)
  }
  
  // 批量删除
  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`,
      onOk: async () => {
        try {
          // 这里应该调用批量删除API
          for (const id of selectedRowKeys) {
            await dispatch(deleteHistoryItem(id)).unwrap()
          }
          setSelectedRowKeys([])
          message.success('批量删除成功')
        } catch (error) {
          message.error(`批量删除失败: ${error}`)
        }
      }
    })
  }
  
  // 状态标签渲染
  const renderStatus = (status) => {
    const statusConfig = {
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
      running: { color: 'processing', text: '运行中' },
      cancelled: { color: 'default', text: '已取消' }
    }
    
    const config = statusConfig[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }
  
  // 表格列定义
  const columns = [
    {
      title: '查询内容',
      dataIndex: 'queryText',
      key: 'queryText',
      ellipsis: true,
      width: 300,
      render: (text) => (
        <Tooltip title={text}>
          <Text style={{ maxWidth: 280 }}>{text}</Text>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatus,
      filters: [
        { text: '已完成', value: 'completed' },
        { text: '失败', value: 'failed' },
        { text: '运行中', value: 'running' },
        { text: '已取消', value: 'cancelled' }
      ],
      filteredValue: filters.status ? [filters.status] : null
    },
    {
      title: '结果数量',
      dataIndex: 'resultCount',
      key: 'resultCount',
      width: 100,
      render: (count) => count ? `${count.toLocaleString()} 条` : '-'
    },
    {
      title: '执行时间',
      dataIndex: 'executionTime',
      key: 'executionTime',
      width: 100,
      render: (time) => time ? `${time}s` : '-'
    },
    {
      title: '查询成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      render: (cost) => cost ? `$${cost.toFixed(4)}` : '-'
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 150,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          
          <Tooltip title="重新执行">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              loading={rerunning[record.id]}
              onClick={() => handleRerun(record)}
            />
          </Tooltip>
          
          {record.status === 'completed' && (
            <Tooltip title="下载结果">
              <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => {
                  // 这里应该调用下载API
                  message.info('下载功能开发中...')
                }}
              />
            </Tooltip>
          )}
          
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              loading={deleting[record.id]}
              danger
            />
          </Popconfirm>
        </Space>
      )
    }
  ]
  
  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE
    ]
  }
  
  return (
    <div className="history-container">
      <Card title="查询历史" className="history-filters">
        <Space wrap>
          <Input.Search
            placeholder="搜索查询内容"
            allowClear
            style={{ width: 250 }}
            onSearch={handleSearch}
          />
          
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status || undefined}
            onChange={handleStatusFilter}
          >
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
            <Option value="running">运行中</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
            onChange={handleDateRangeFilter}
          />
          
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
          
          {selectedRowKeys.length > 0 && (
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={handleBatchDelete}
            >
              批量删除 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </Card>
      
      <Card>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          onChange={handleTableChange}
        />
      </Card>
      
      {/* 详情模态框 */}
      <Modal
        title="查询详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          selectedItem?.status === 'completed' && (
            <Button
              key="rerun"
              type="primary"
              onClick={() => {
                setDetailModalVisible(false)
                handleRerun(selectedItem)
              }}
            >
              重新执行
            </Button>
          )
        ]}
        width={800}
      >
        {selectedItem && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>查询内容：</Text>
              <Paragraph copyable>{selectedItem.queryText}</Paragraph>
            </div>
            
            <div>
              <Text strong>生成的SQL：</Text>
              <Paragraph copyable>
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                  {selectedItem.sql}
                </pre>
              </Paragraph>
            </div>
            
            <div>
              <Text strong>执行信息：</Text>
              <ul>
                <li>状态：{renderStatus(selectedItem.status)}</li>
                <li>开始时间：{selectedItem.startTime ? dayjs(selectedItem.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}</li>
                <li>结束时间：{selectedItem.endTime ? dayjs(selectedItem.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}</li>
                <li>执行时间：{selectedItem.executionTime ? `${selectedItem.executionTime}s` : '-'}</li>
                <li>结果数量：{selectedItem.resultCount ? `${selectedItem.resultCount.toLocaleString()} 条` : '-'}</li>
                <li>查询成本：{selectedItem.cost ? `$${selectedItem.cost.toFixed(4)}` : '-'}</li>
              </ul>
            </div>
            
            {selectedItem.error && (
              <div>
                <Text strong>错误信息：</Text>
                <Paragraph>
                  <pre style={{ background: '#fff2f0', padding: '12px', borderRadius: '4px', color: '#ff4d4f' }}>
                    {selectedItem.error}
                  </pre>
                </Paragraph>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default HistoryPage