# n8n 工作流配置文件

本目录包含查数工具 V1.0 的 3 个核心工作流配置。

## 📁 文件说明

| 文件名 | 功能 | 优先级 |
|--------|------|--------|
| `1-intelligent-query.json` | 智能查询 - 自然语言转SQL | 高 ⭐⭐⭐ |
| `2-scheduled-reports.json` | 定时查询报告 - 每日数据报表 | 高 ⭐⭐⭐ |
| `3-game-rating-report.json` | 游戏评级报告生成器 | 中 ⭐⭐ |

## 🚀 快速开始

### 1. 导入工作流

在 n8n 中：
1. 点击右上角 **"..."** → **Import from File**
2. 选择对应的 JSON 文件
3. 工作流将自动导入

### 2. 配置凭证

每个工作流需要以下凭证：

#### A. Athena API Key（必需）
- **类型**: HTTP Header Auth
- **名称**: `Athena API Key`
- **Header Name**: `X-API-Key`
- **Header Value**: 你的 API 密钥

#### B. Lark API（可选，用于通知）
- **类型**: Lark API
- **名称**: `Lark Bot`
- **App ID**: 你的飞书应用 ID
- **App Secret**: 你的飞书应用密钥

#### C. SMTP（可选，用于邮件）
- **类型**: SMTP
- **名称**: `Lark SMTP`
- **Host**: `smtp.feishu.cn` 或你的 SMTP 服务器
- **Port**: 465
- **Username**: 你的邮箱
- **Password**: 你的密码

### 3. 修改配置

在导入后，需要修改以下配置：

#### 所有工作流
- 将 `http://your-server:8000` 替换为你的实际服务器地址

#### 智能查询工作流
- 修改 Webhook 路径（可选）
- 配置 Lark 群ID（如果使用）

#### 定时报告工作流
- 修改 Cron 表达式（默认每天 9:00）
- 修改收件人邮箱地址
- 根据实际数据库调整 SQL 查询

#### 游戏评级工作流
- 根据业务需求调整评级阈值
- 根据实际数据库调整 SQL 查询

## 📖 使用说明

### 工作流 1: 智能查询

**触发方式**: Webhook POST 请求

**请求示例**:
```bash
curl -X POST http://your-n8n-server/webhook/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询最近7天的PHP和INR充值数据",
    "user_id": "user123",
    "channel": "web"
  }'
```

**参数说明**:
- `query` (必需): 自然语言查询
- `user_id` (可选): 用户ID
- `channel` (可选): 来源渠道 (`web` / `lark`)
- `maxRows` (可选): 最大返回行数，默认 10000

**返回格式**:
```json
{
  "success": true,
  "data": {
    "query": "查询最近7天的PHP和INR充值数据",
    "generatedSQL": "SELECT ...",
    "rowCount": 1523,
    "executionTime": 2340,
    "rows": [...]
  }
}
```

---

### 工作流 2: 定时查询报告

**触发方式**: 定时任务（Cron）

**默认时间**: 每天上午 9:00

**功能**:
1. 自动查询昨日核心指标
2. 生成 Excel 报表
3. 发送邮件到指定邮箱
4. 发送通知到 Lark 群

**修改查询内容**:

编辑 "构建查询" 节点的代码：

```javascript
queries: [
  {
    name: "你的指标名称",
    sql: "SELECT ...",
    description: "指标说明"
  },
  // 添加更多查询...
]
```

**修改定时时间**:

编辑 "定时触发" 节点的 Cron 表达式：

```
0 9 * * *     # 每天 09:00
0 10 * * 1    # 每周一 10:00
0 18 * * 1-5  # 工作日 18:00
```

---

### 工作流 3: 游戏评级报告

**触发方式**: Webhook POST 请求

**请求示例**:
```bash
curl -X POST http://your-n8n-server/webhook/game-rating \
  -H "Content-Type: application/json" \
  -d '{
    "game_name": "王者荣耀"
  }'
```

**参数说明**:
- `game_name` (必需): 游戏名称

**评级规则**:

| 维度 | 权重 | S级 | A级 | B级 | C级 | D级 |
|------|------|-----|-----|-----|-----|-----|
| 收入 | 40% | >1000万 | 500-1000万 | 100-500万 | 10-100万 | <10万 |
| 活跃 | 30% | >10万DAU | 5-10万 | 1-5万 | 1000-1万 | <1000 |
| 付费率 | 20% | >10% | 5-10% | 2-5% | 0.5-2% | <0.5% |
| 留存 | 10% | >50% | 30-50% | 15-30% | 5-15% | <5% |

**修改评级规则**:

编辑 "计算评级" 节点中的阈值：

```javascript
const revenueGrade = getGradeAndScore(revenue, {
  S: 10000000,  // 修改为你的阈值
  A: 5000000,
  B: 1000000,
  C: 100000
});
```

---

## 🔧 常见问题

### Q1: 导入工作流后无法执行

**A**: 检查以下配置：
1. ✅ Athena API 服务是否正常运行
2. ✅ API Key 是否正确配置
3. ✅ 服务器地址是否正确
4. ✅ 网络连接是否正常

测试命令：
```bash
curl -H "X-API-Key: your-key" http://your-server:8000/api/webhook/health
```

### Q2: SQL 查询报错

**A**: 常见原因：
1. 表名或字段名不正确 - 根据实际数据库调整
2. 日期格式不匹配 - 检查日期字段格式
3. 权限不足 - 检查 Athena IAM 权限

### Q3: 邮件发送失败

**A**: 检查 SMTP 配置：
1. 确认 SMTP 服务器地址和端口
2. 确认用户名和密码正确
3. 检查是否需要开启"允许不够安全的应用"

### Q4: Lark 消息发送失败

**A**: 检查 Lark 配置：
1. 确认应用权限（需要消息发送权限）
2. 确认群聊已添加机器人
3. 检查 Webhook 地址是否正确

### Q5: 工作流执行超时

**A**: 优化建议：
1. 增加 HTTP Request 节点的 timeout 设置
2. 优化 SQL 查询（添加索引、使用分区）
3. 减少查询数据量（添加 LIMIT）

---

## 🎨 自定义扩展

### 添加新的报表模板

复制 `2-scheduled-reports.json`，修改：

1. **工作流名称**: 改为你的报表名称
2. **定时时间**: 修改 Cron 表达式
3. **查询内容**: 修改 SQL 查询
4. **收件人**: 修改邮件收件人

### 添加更多通知渠道

在工作流末尾添加新节点：

- **Slack**: 使用 Slack 节点
- **Telegram**: 使用 Telegram 节点
- **Webhook**: 使用 HTTP Request 节点
- **Discord**: 使用 Discord 节点

### 集成数据可视化

在生成 Excel 前添加图表生成：

1. 使用 Google Sheets 节点
2. 使用 Chart.js 生成图表
3. 将图表嵌入到邮件或消息中

---

## 📊 监控和维护

### 查看执行历史

在 n8n 中：
1. 打开工作流
2. 点击 "Executions" 标签
3. 查看成功/失败记录

### 设置执行通知

配置 n8n 的错误通知：
1. Settings → Notifications
2. 添加邮件或 Webhook 通知
3. 选择通知类型（失败/成功/全部）

### 定期检查

建议每周检查：
- [ ] 定时任务是否正常执行
- [ ] 数据是否准确
- [ ] 邮件是否按时送达
- [ ] 错误日志

---

## 🔗 相关文档

- [MILESTONE_V1.md](../MILESTONE_V1.md) - V1.0 里程碑详细规划
- [N8N_INTEGRATION_GUIDE.md](../N8N_INTEGRATION_GUIDE.md) - n8n 集成完整指南
- [QUICK_START.md](../QUICK_START.md) - 快速开始指南
- [ATHENA_SETUP_GUIDE.md](../ATHENA_SETUP_GUIDE.md) - Athena 配置指南

---

## 🆘 获取帮助

- **技术问题**: 查看后端日志 `backend/logs/combined.log`
- **工作流问题**: 查看 n8n 执行日志
- **业务问题**: 联系产品团队
- **Bug 反馈**: 提交 Issue

---

**更新时间**: 2025-10-10  
**版本**: V1.0  
**维护者**: 开发团队











