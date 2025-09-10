import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { historyAPI } from '../../services/api'

// 异步thunk：获取查询历史
export const fetchQueryHistory = createAsyncThunk(
  'history/fetchQueryHistory',
  async ({ page = 1, pageSize = 10, filters = {} }, { rejectWithValue }) => {
    try {
      const response = await historyAPI.getQueryHistory({ page, pageSize, ...filters })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：删除历史记录
export const deleteHistoryItem = createAsyncThunk(
  'history/deleteHistoryItem',
  async (queryId, { rejectWithValue }) => {
    try {
      await historyAPI.deleteHistoryItem(queryId)
      return queryId
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：重新执行历史查询
export const rerunHistoryQuery = createAsyncThunk(
  'history/rerunHistoryQuery',
  async (queryId, { rejectWithValue }) => {
    try {
      const response = await historyAPI.rerunQuery(queryId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

const initialState = {
  // 历史记录列表
  items: [],
  
  // 分页信息
  pagination: {
    current: 1,
    pageSize: 10,
    total: 0
  },
  
  // 筛选条件
  filters: {
    status: '', // all, completed, failed
    dateRange: null,
    keyword: ''
  },
  
  // 加载状态
  loading: false,
  error: null,
  
  // 删除状态
  deleting: {},
  
  // 重新执行状态
  rerunning: {}
}

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    
    // 设置分页
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    
    // 清除错误
    clearError: (state) => {
      state.error = null
    },
    
    // 添加新的历史记录（从查询页面添加）
    addHistoryItem: (state, action) => {
      state.items.unshift(action.payload)
      state.pagination.total += 1
    }
  },
  
  extraReducers: (builder) => {
    builder
      // 获取查询历史
      .addCase(fetchQueryHistory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchQueryHistory.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.items
        state.pagination = {
          current: action.payload.page,
          pageSize: action.payload.pageSize,
          total: action.payload.total
        }
      })
      .addCase(fetchQueryHistory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // 删除历史记录
      .addCase(deleteHistoryItem.pending, (state, action) => {
        state.deleting[action.meta.arg] = true
      })
      .addCase(deleteHistoryItem.fulfilled, (state, action) => {
        const queryId = action.payload
        state.items = state.items.filter(item => item.id !== queryId)
        state.pagination.total -= 1
        delete state.deleting[queryId]
      })
      .addCase(deleteHistoryItem.rejected, (state, action) => {
        delete state.deleting[action.meta.arg]
        state.error = action.payload
      })
      
      // 重新执行查询
      .addCase(rerunHistoryQuery.pending, (state, action) => {
        state.rerunning[action.meta.arg] = true
      })
      .addCase(rerunHistoryQuery.fulfilled, (state, action) => {
        delete state.rerunning[action.meta.arg]
        // 重新执行成功后，可以跳转到查询页面
      })
      .addCase(rerunHistoryQuery.rejected, (state, action) => {
        delete state.rerunning[action.meta.arg]
        state.error = action.payload
      })
  }
})

export const {
  setFilters,
  setPagination,
  clearError,
  addHistoryItem
} = historySlice.actions

export default historySlice.reducer