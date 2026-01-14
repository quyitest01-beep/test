# 修复查询结果导出问题

## 问题分析

从日志可以看出两个主要问题：

1. **`/api/export/query-result` 返回500错误**
2. **`/api/query-count/count/` 返回rowCount为0**

## 根本原因

查询ID `c1244fc7-407c-45ab-9128-1b014cb1b6b8` 对应的查询可能：
1. 没有正确完成
2. 结果没有正确存储
3. 查询ID与Athena编辑器中的查询不匹配

## 解决方案

### 方案1：检查查询状态

首先需要确认查询是否真的完成了：

```javascript
// 在export.js中添加调试信息
const queryStatus = await asyncQueryService.getQueryStatus(queryId);

console.log('查询状态调试:', {
  queryId,
  status: queryStatus?.status,
  hasResult: !!queryStatus?.result,
  resultKeys: queryStatus?.result ? Object.keys(queryStatus.result) : [],
  dataLength: queryStatus?.result?.data?.length || 0
});
```

### 方案2：修复export/query-result路由

```javascript
// 修复后的代码
router.post('/query-result', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { error, value } = exportQueryResultSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid request parameters: ${error.details[0].message}`,
        requestId
      });
    }

    const { queryId, format, options } = value;
    
    logger.info('Starting query result export', { requestId, queryId, format, options });

    // 获取查询状态
    const asyncQueryService = require('../services/asyncQueryService');
    const queryStatus = await asyncQueryService.getQueryStatus(queryId);
    
    if (!queryStatus) {
      return res.status(404).json({
        success: false,
        message: 'Query not found or expired',
        requestId
      });
    }
    
    if (queryStatus.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Query is not completed. Current status: ${queryStatus.status}`,
        requestId
      });
    }
    
    // 获取查询数据
    let queryData = [];
    
    if (queryStatus.result?.data && Array.isArray(queryStatus.result.data)) {
      queryData = queryStatus.result.data;
    } else if (queryStatus.result?.row_count > 0) {
      // 如果结果中没有data，但有row_count，尝试从Athena重新获取
      const athenaService = require('../services/athenaService');
      try {
        const athenaResult = await athenaService.getQueryResults(queryId);
        queryData = athenaResult.data || [];
      } catch (athenaError) {
        logger.error('Failed to get data from Athena', { requestId, queryId, error: athenaError.message });
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve query data from Athena',
          requestId
        });
      }
    }
    
    if (queryData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this query',
        requestId
      });
    }
    
    // 导出数据
    const exportOptions = { 
      ...options, 
      requestId,
      filename: options.filename || `query_${queryId}_${Date.now()}`
    };

    let result;
    if (format === 'excel') {
      result = await exportService.exportToExcel(queryData, exportOptions);
    } else if (format === 'csv') {
      result = await exportService.exportToCSV(queryData, exportOptions);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    res.json({
      success: true,
      message: 'Data exported successfully',
      requestId,
      data: result
    });

  } catch (error) {
    logger.error('Export failed', { requestId, error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Export failed',
      error: error.message,
      requestId
    });
  }
});
```

### 方案3：检查查询ID映射

需要确认n8n工作流中的queryId是否与Athena编辑器中的查询匹配：

1. **在Athena编辑器中**：
   - 查看"最近的查询"标签页
   - 找到返回1条记录的查询
   - 复制该查询的Execution ID

2. **在n8n工作流中**：
   - 确认使用的queryId是否正确
   - 检查查询是否真的完成了

### 方案4：临时解决方案

如果查询ID确实不匹配，可以：

1. **重新执行查询**：
   - 在n8n中重新启动查询
   - 获取新的queryId
   - 使用新的queryId进行导出

2. **直接使用Athena结果**：
   - 从Athena编辑器下载CSV文件
   - 手动处理数据

## 立即行动建议

1. **检查Athena编辑器中的查询Execution ID**
2. **确认n8n工作流中的queryId是否匹配**
3. **如果queryId不匹配，重新执行查询**
4. **应用上述修复代码到export.js**

## 调试步骤

1. 运行调试脚本检查查询状态
2. 检查Athena查询历史
3. 验证queryId映射关系
4. 修复export路由
5. 重新测试导出功能









