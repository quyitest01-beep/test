import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { settingsAPI } from '../../services/api'

// 异步thunk：获取用户设置
export const fetchUserSettings = createAsyncThunk(
  'settings/fetchUserSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await settingsAPI.getUserSettings()
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：更新用户设置
export const updateUserSettings = createAsyncThunk(
  'settings/updateUserSettings',
  async (settings, { rejectWithValue }) => {
    try {
      const response = await settingsAPI.updateUserSettings(settings)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 异步thunk：测试Athena连接
export const testAthenaConnection = createAsyncThunk(
  'settings/testAthenaConnection',
  async (connectionConfig, { rejectWithValue }) => {
    try {
      const response = await settingsAPI.testConnection(connectionConfig)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

const initialState = {
  // Athena连接配置
  athenaConfig: {
    region: 'us-east-1',
    database: '',
    workgroup: 'primary',
    outputLocation: '',
    accessKeyId: '',
    secretAccessKey: ''
  },
  
  // 查询设置
  querySettings: {
    maxRows: 100000, // 单次查询最大行数
    timeout: 300, // 查询超时时间（秒）
    autoSplit: true, // 是否自动拆分大查询
    splitThreshold: 100000, // 拆分阈值
    defaultExportFormat: 'xlsx' // 默认导出格式
  },
  
  // UI设置
  uiSettings: {
    theme: 'light', // light, dark
    language: 'zh-CN',
    pageSize: 10, // 历史记录页面大小
    autoRefresh: false, // 是否自动刷新查询状态
    refreshInterval: 5000 // 自动刷新间隔（毫秒）
  },
  
  // 通知设置
  notificationSettings: {
    queryComplete: true, // 查询完成通知
    queryFailed: true, // 查询失败通知
    exportComplete: true, // 导出完成通知
    soundEnabled: false // 声音通知
  },
  
  // 加载状态
  loading: false,
  saving: false,
  testing: false,
  error: null,
  
  // 连接测试结果
  connectionTest: {
    status: null, // success, failed
    message: '',
    lastTested: null
  }
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // 更新Athena配置
    updateAthenaConfig: (state, action) => {
      state.athenaConfig = { ...state.athenaConfig, ...action.payload }
    },
    
    // 更新查询设置
    updateQuerySettings: (state, action) => {
      state.querySettings = { ...state.querySettings, ...action.payload }
    },
    
    // 更新UI设置
    updateUISettings: (state, action) => {
      state.uiSettings = { ...state.uiSettings, ...action.payload }
    },
    
    // 更新通知设置
    updateNotificationSettings: (state, action) => {
      state.notificationSettings = { ...state.notificationSettings, ...action.payload }
    },
    
    // 清除错误
    clearError: (state) => {
      state.error = null
    },
    
    // 重置连接测试结果
    resetConnectionTest: (state) => {
      state.connectionTest = {
        status: null,
        message: '',
        lastTested: null
      }
    }
  },
  
  extraReducers: (builder) => {
    builder
      // 获取用户设置
      .addCase(fetchUserSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUserSettings.fulfilled, (state, action) => {
        state.loading = false
        const { athenaConfig, querySettings, uiSettings, notificationSettings } = action.payload
        
        if (athenaConfig) {
          state.athenaConfig = { ...state.athenaConfig, ...athenaConfig }
        }
        if (querySettings) {
          state.querySettings = { ...state.querySettings, ...querySettings }
        }
        if (uiSettings) {
          state.uiSettings = { ...state.uiSettings, ...uiSettings }
        }
        if (notificationSettings) {
          state.notificationSettings = { ...state.notificationSettings, ...notificationSettings }
        }
      })
      .addCase(fetchUserSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // 更新用户设置
      .addCase(updateUserSettings.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateUserSettings.fulfilled, (state, action) => {
        state.saving = false
        // 设置已在reducer中更新，这里可以显示成功消息
      })
      .addCase(updateUserSettings.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload
      })
      
      // 测试Athena连接
      .addCase(testAthenaConnection.pending, (state) => {
        state.testing = true
        state.connectionTest.status = null
        state.connectionTest.message = ''
      })
      .addCase(testAthenaConnection.fulfilled, (state, action) => {
        state.testing = false
        state.connectionTest = {
          status: 'success',
          message: action.payload.message || '连接测试成功',
          lastTested: new Date().toISOString()
        }
      })
      .addCase(testAthenaConnection.rejected, (state, action) => {
        state.testing = false
        state.connectionTest = {
          status: 'failed',
          message: action.payload || '连接测试失败',
          lastTested: new Date().toISOString()
        }
      })
  }
})

export const {
  updateAthenaConfig,
  updateQuerySettings,
  updateUISettings,
  updateNotificationSettings,
  clearError,
  resetConnectionTest
} = settingsSlice.actions

export default settingsSlice.reducer