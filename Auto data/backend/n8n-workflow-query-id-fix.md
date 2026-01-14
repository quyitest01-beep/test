# 修复n8n工作流中的查询ID问题

## 问题描述
- **Athena查询ID**: `7ffc0445-0b82-42e8-acef-039325ad0dd3` (有1条记录)
- **n8n工作流查询ID**: `c1244fc7-407c-45ab-9128-1b014cb1b6b8` (返回0条记录)

## 解决方案

### 方案1：更新n8n工作流中的查询ID

1. **在n8n工作流中找到HTTP Request节点**
   - 找到用于查询结果数量的HTTP Request节点
   - 该节点URL应该是：`https://ebooks-life-point-interactions.trycloudflare.com/api/query-count/count/{{ $json.queryId }}`

2. **更新查询ID**
   - 将URL改为：`https://ebooks-life-point-interactions.trycloudflare.com/api/query-count/count/7ffc0445-0b82-42e8-acef-039325ad0dd3`
   - 或者修改上游节点，确保`$json.queryId`的值是`7ffc0445-0b82-42e8-acef-039325ad0dd3`

### 方案2：检查查询ID来源

1. **检查"数据转换"节点**
   - 确认该节点输出的`queryId`字段值
   - 如果输出的是错误的ID，需要修正

2. **检查上游查询节点**
   - 确认哪个节点生成了查询ID
   - 确保使用的是正确的Athena查询ID

### 方案3：直接测试正确的查询ID

让我先测试一下使用正确的Athena查询ID是否能获取到结果：

```bash
# 测试查询结果数量
curl -X GET "https://ebooks-life-point-interactions.trycloudflare.com/api/query-count/count/7ffc0445-0b82-42e8-acef-039325ad0dd3" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3"

# 测试导出查询结果
curl -X POST "https://ebooks-life-point-interactions.trycloudflare.com/api/export/query-result" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3" \
  -H "Content-Type: application/json" \
  -d '{
    "queryId": "7ffc0445-0b82-42e8-acef-039325ad0dd3",
    "format": "csv"
  }'
```

## 立即行动步骤

1. **在n8n工作流中**：
   - 找到HTTP Request节点
   - 将URL中的查询ID改为`7ffc0445-0b82-42e8-acef-039325ad0dd3`
   - 重新执行工作流

2. **或者修改上游节点**：
   - 找到生成`queryId`的节点
   - 确保输出正确的查询ID

3. **测试结果**：
   - 执行工作流
   - 检查是否返回正确的记录数量

## 预期结果

使用正确的查询ID后，应该返回：
```json
{
  "success": true,
  "queryId": "7ffc0445-0b82-42e8-acef-039325ad0dd3",
  "status": "completed",
  "rowCount": 1,
  "message": "查询完成，共返回 1 条记录"
}
```
