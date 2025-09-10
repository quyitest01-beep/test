import { configureStore } from '@reduxjs/toolkit'
import queryReducer from './slices/querySlice'
import historyReducer from './slices/historySlice'
import settingsReducer from './slices/settingsSlice'

export const store = configureStore({
  reducer: {
    query: queryReducer,
    history: historyReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch