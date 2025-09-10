import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { queryAPI } from '../../services/api'

// 异步thunk：提交查询
export const submitQuery = createAsyncThunk(
  'query/submitQuery',
  async (queryText, { rejectWithValue }) => {
    try {
      const response = await queryAPI.submitQuery(queryText)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：检查查询状态
export const checkQueryStatus = createAsyncThunk(
  'query/checkQueryStatus',
  async (queryId, { rejectWithValue }) => {
    try {
      const response = await queryAPI.getQueryStatus(queryId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：获取查询结果
export const fetchQueryResults = createAsyncThunk(
  'query/fetchQueryResults',
  async (queryId, { rejectWithValue }) => {
    try {
      const response = await queryAPI.getQueryResults(queryId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：导出数据
export const exportData = createAsyncThunk(
  'query/exportData',
  async ({ queryId, format }, { rejectWithValue }) => {
    try {
      const response = await queryAPI.exportData(queryId, format)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

const initialState = {
  // 当前查询状态
  currentQuery: {
    id: null,
    text: '',
    sql: '',
    status: 'idle', // idle, parsing, running, completed, failed
    progress: 0,
    startTime: null,
    endTime: null,
    error: null
  },
  
  // 查询结果
  results: {
    data: [],
    columns: [],
    totalRows: 0,
    executionTime: 0,
    dataScanned: 0,
    cost: 0,
    isSplit: false,
    splitInfo: null
  },
  
  // UI状态
  loading: false,
  error: null,
  
  // 导出状态
  exporting: false,
  exportProgress: 0
}

const querySlice = createSlice({
  name: 'query',
  initialState,
  reducers: {
    // 设置查询文本
    setQueryText: (state, action) => {
      state.currentQuery.text = action.payload
    },
    
    // 清除当前查询
    clearCurrentQuery: (state) => {
      state.currentQuery = initialState.currentQuery
      state.results = initialState.results
      state.error = null
    },
    
    // 更新查询进度
    updateProgress: (state, action) => {
      state.currentQuery.progress = action.payload
    },
    
    // 清除错误
    clearError: (state) => {
      state.error = null
      state.currentQuery.error = null
    },
    
    // 设置SQL预览
    setSqlPreview: (state, action) => {
      state.currentQuery.sql = action.payload
    }
  },
  
  extraReducers: (builder) => {
    builder
      // 提交查询
      .addCase(submitQuery.pending, (state) => {
        state.loading = true
        state.error = null
        state.currentQuery.status = 'parsing'
        state.currentQuery.startTime = new Date().toISOString()
      })
      .addCase(submitQuery.fulfilled, (state, action) => {
        state.loading = false
        state.currentQuery.id = action.payload.queryId
        state.currentQuery.sql = action.payload.sql
        state.currentQuery.status = 'running'
        state.results.isSplit = action.payload.isSplit || false
        state.results.splitInfo = action.payload.splitInfo || null
      })
      .addCase(submitQuery.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.currentQuery.status = 'failed'
        state.currentQuery.error = action.payload
      })
      
      // 检查查询状态
      .addCase(checkQueryStatus.fulfilled, (state, action) => {
        const { status, progress, error } = action.payload
        state.currentQuery.status = status
        state.currentQuery.progress = progress || 0
        
        if (status === 'failed') {
          state.currentQuery.error = error
          state.error = error
        } else if (status === 'completed') {
          state.currentQuery.endTime = new Date().toISOString()
        }
      })
      
      // 获取查询结果
      .addCase(fetchQueryResults.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchQueryResults.fulfilled, (state, action) => {
        state.loading = false
        state.results = {
          ...state.results,
          ...action.payload
        }
        state.currentQuery.status = 'completed'
      })
      .addCase(fetchQueryResults.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.currentQuery.status = 'failed'
        state.currentQuery.error = action.payload
      })
      
      // 导出数据
      .addCase(exportData.pending, (state) => {
        state.exporting = true
        state.exportProgress = 0
      })
      .addCase(exportData.fulfilled, (state, action) => {
        state.exporting = false
        state.exportProgress = 100
        // 触发文件下载
        if (action.payload.downloadUrl) {
          const link = document.createElement('a')
          link.href = action.payload.downloadUrl
          link.download = action.payload.filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      })
      .addCase(exportData.rejected, (state, action) => {
        state.exporting = false
        state.exportProgress = 0
        state.error = action.payload
      })
  }
})

export const {
  setQueryText,
  clearCurrentQuery,
  updateProgress,
  clearError,
  setSqlPreview
} = querySlice.actions

export default querySlice.reducer