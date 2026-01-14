# Lark群消息智能查数系统（知识库版）使用指南

## 📋 功能概述

这个工作流实现了完整的Lark群消息监听和智能查数系统：

```
Lark群消息 → 写入Google表格 → AI识别查数意图 → 查询知识库 → 使用匹配SQL或生成新SQL → 保存到知识库 → 回复用户
```

## 🎯 核心功能

### 1. 实时监听Lark群消息
- 使用Lark Webhook Trigger监听群消息
- 支持文本消息类型
- 自动提取消息内容和发送者信息

### 2. 消息记录到Google表格
- 所有消息自动写入Google表格
- 记录字段：时间、消息ID、群ID、发送者、消息内容、处理状态
- 便于后续分析和审计

### 3. AI识别查数意图
- 使用OpenAI GPT-3.5-turbo识别查数意图
- 返回置信度评分（0-1）
- 自动过滤非查数请求（问候、闲聊等）

### 4. 知识库智能匹配
- 查询GetNote知识库，查找相似查询
- 如果相似度 > 0.8，直接使用已有SQL
- 否则生成新SQL并保存到知识库

## 🔧 配置步骤

### 步骤1: 配置Lark Webhook

**详细配置步骤请参考**：[LARK_WEBHOOK_TRIGGER_SETUP.md](./LARK_WEBHOOK_TRIGGER_SETUP.md)

**快速配置步骤**：

1. **创建Lark应用**
   - 登录 [Lark开放平台](https://open.larksuite.com/)
   - 创建新应用，获取 App ID 和 App Secret
   - 配置事件订阅：`im.message.receive_v1`

2. **配置n8n凭证**
   - 在n8n中创建 `Lark API` 凭证
   - 输入 App ID 和 App Secret
   - 命名为 `Lark Bot`

3. **配置Webhook URL**
   - 激活n8n工作流
   - 复制"Lark Webhook 触发"节点显示的Webhook URL
   - 在Lark应用后台的"事件订阅"页面配置这个URL
   - 确保n8n服务器可被Lark访问（需要公网IP或域名）

4. **配置应用权限**
   - 在Lark开放平台的"权限管理"页面
   - 申请以下权限：
     - `im:message` - 获取与发送消息
     - `im:message.group_at_msg:readonly` - 接收群聊消息
     - `im:message:send` - 发送消息
   - 等待管理员审批权限

### 步骤2: 配置Google Sheets

1. **创建Google表格**
   - 在Google Sheets中创建新表格
   - 创建名为"消息记录"的工作表
   - 设置表头：时间、消息ID、群ID、发送者ID、发送者名称、消息内容、处理状态

2. **配置n8n凭证**
   - 在n8n中创建 `Google Sheets OAuth2 API` 凭证
   - 授权访问Google Sheets
   - 命名为 `Google Sheets`

3. **更新工作流配置**
   - 打开"写入Google表格"节点
   - 将 `YOUR_GOOGLE_SHEET_ID` 替换为实际的表格ID
   - 表格ID可以从Google Sheets URL中获取：
     ```
     https://docs.google.com/spreadsheets/d/[表格ID]/edit
     ```

### 步骤3: 配置OpenAI API

1. **获取OpenAI API Key**
   - 登录 [OpenAI平台](https://platform.openai.com/)
   - 创建API Key

2. **配置n8n凭证**
   - 在n8n中创建 `OpenAI API` 凭证
   - 输入API Key
   - 命名为 `OpenAI API`

### 步骤4: 配置GetNote知识库API

1. **获取GetNote API凭证**
   - 登录GetNote平台
   - 获取API Key或Token

2. **配置n8n凭证**
   - 在n8n中创建 `HTTP Header Auth` 凭证
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_GETNOTE_API_KEY`
   - 命名为 `GetNote API`

3. **更新API端点**
   - 打开"获取知识库内容"节点
   - 将URL更新为实际的GetNote API端点
   - 打开"保存到知识库"节点
   - 将URL更新为实际的GetNote API端点

## 📊 工作流节点说明

### 节点1: Lark Webhook 触发
- **类型**: Lark Trigger
- **事件**: `im.message.receive_v1`
- **功能**: 监听Lark群消息

### 节点2: 提取消息内容
- **类型**: Code
- **功能**: 解析Lark Webhook事件，提取消息内容、发送者信息等

### 节点3: 写入Google表格
- **类型**: Google Sheets
- **操作**: Append
- **功能**: 将消息记录写入Google表格

### 节点4: AI识别查数意图
- **类型**: OpenAI
- **模型**: gpt-3.5-turbo
- **功能**: 判断消息是否是查数请求

### 节点5: 解析意图识别结果
- **类型**: Code
- **功能**: 解析AI返回的JSON结果

### 节点6: 判断是否查数请求
- **类型**: IF
- **条件**: 
  - `isQueryRequest === true`
  - `confidence >= 0.5`
- **功能**: 过滤非查数请求

### 节点7: 获取知识库内容
- **类型**: HTTP Request
- **方法**: GET
- **功能**: 查询GetNote知识库，查找相似查询

### 节点8: 处理知识库结果
- **类型**: Code
- **功能**: 解析知识库返回结果，查找匹配的SQL

### 节点9: 判断是否有匹配SQL
- **类型**: IF
- **条件**: `hasMatch === true`
- **功能**: 判断是否需要生成新SQL

### 节点10: 生成新SQL
- **类型**: OpenAI
- **模型**: gpt-3.5-turbo
- **功能**: 根据自然语言生成SQL语句

### 节点11: 提取SQL语句
- **类型**: Code
- **功能**: 从AI响应中提取SQL语句

### 节点12: 合并SQL
- **类型**: Code
- **功能**: 使用匹配的SQL或新生成的SQL

### 节点13: 判断是否新SQL
- **类型**: IF
- **条件**: `sqlSource === 'new'`
- **功能**: 判断是否需要保存到知识库

### 节点14: 保存到知识库
- **类型**: HTTP Request
- **方法**: POST
- **功能**: 将新SQL保存到GetNote知识库

### 节点15: 发送Lark回复
- **类型**: Lark
- **功能**: 向用户发送处理结果

### 节点16: 发送非查数回复
- **类型**: Lark
- **功能**: 向用户发送非查数请求的提示

## 🔍 数据流程

```
1. Lark群消息触发
   ↓
2. 提取消息内容（消息ID、群ID、发送者、消息文本等）
   ↓
3. 写入Google表格（记录所有消息）
   ↓
4. AI识别查数意图（返回 isQueryRequest、confidence、reason）
   ↓
5. 判断是否查数请求
   ├─ 是 → 继续处理
   └─ 否 → 发送非查数回复
   ↓
6. 查询知识库（查找相似查询）
   ↓
7. 处理知识库结果（查找匹配SQL，相似度 > 0.8）
   ↓
8. 判断是否有匹配SQL
   ├─ 有 → 使用匹配SQL
   └─ 无 → 生成新SQL
   ↓
9. 判断是否新SQL
   ├─ 是 → 保存到知识库
   └─ 否 → 直接使用
   ↓
10. 发送Lark回复（告知用户处理结果）
```

## 📝 自定义配置

### 修改置信度阈值

在"判断是否查数请求"节点中，可以调整置信度阈值：

```javascript
// 当前阈值：0.5
// 可以调整为 0.6、0.7 等
```

### 修改知识库相似度阈值

在"处理知识库结果"节点中，可以调整相似度阈值：

```javascript
// 当前阈值：0.8
// 可以调整为 0.7、0.9 等
if ((bestMatch.similarity || bestMatch.score || 0) > 0.8) {
  // 使用匹配的SQL
}
```

### 修改Google表格字段

在"写入Google表格"节点中，可以添加或修改字段：

```javascript
"columns": {
  "mappingMode": "defineBelow",
  "value": {
    "时间": "={{ $json.messageTime }}",
    "消息ID": "={{ $json.messageId }}",
    // 添加更多字段...
  }
}
```

## 🐛 故障排查

### 问题1: Lark消息无法触发

**检查项**：
1. ✅ Lark应用是否已配置事件订阅
2. ✅ Webhook URL是否正确配置
3. ✅ n8n服务器是否可被Lark访问
4. ✅ Lark凭证是否正确配置

### 问题2: Google表格写入失败

**检查项**：
1. ✅ Google Sheets凭证是否正确授权
2. ✅ 表格ID是否正确
3. ✅ 工作表名称是否存在
4. ✅ 字段映射是否正确

### 问题3: AI识别不准确

**解决方案**：
1. 调整AI提示词，更明确地定义查数请求特征
2. 调整置信度阈值
3. 增加训练样本到知识库

### 问题4: 知识库查询失败

**检查项**：
1. ✅ GetNote API凭证是否正确
2. ✅ API端点URL是否正确
3. ✅ 网络连接是否正常
4. ✅ API返回格式是否符合预期

## 📈 优化建议

### 1. 提升意图识别准确率
- 收集更多查数请求样本
- 优化AI提示词
- 建立查数请求特征库

### 2. 优化知识库匹配
- 使用向量相似度搜索
- 建立查询类型分类
- 定期清理无效SQL

### 3. 增强错误处理
- 添加重试机制
- 记录错误日志
- 发送错误通知

### 4. 性能优化
- 缓存常用SQL
- 异步处理知识库查询
- 批量写入Google表格

## 🔗 相关文档

- [n8n工作流配置指南](./n8n-workflows/README.md)
- [Lark Bot设计文档](./lark_bot_design.json)
- [AI智能查询项目交付目标](./AI_QUERY_DELIVERY_TARGET.md)

---

**更新时间**: 2025-11-19  
**版本**: V1.0  
**维护者**: 开发团队

