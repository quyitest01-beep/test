# 查数工具 V1.0 里程碑规划

## 🎯 目标

通过 n8n 工作流实现 3 个核心功能，快速交付可用的查数工具

---

## 📅 整体计划

**开发周期**：10.11 - 10.18（8 天）  
**实现方式**：100% 基于 n8n 工作流配置  
**技术依赖**：已完成的 Webhook API + Athena 查询

---

## 🚀 里程碑 1：智能查询工作流（10.11 - 10.12，2天）

### 功能描述
用户输入自然语言查询需求，系统自动转化为 SQL 并执行 Athena 查询，最终导出 Excel 结果。

### 用户流程
```
用户在 Lark/Web 输入
  ↓
"查询最近7天 PHP 和 INR 的充值金额"
  ↓
n8n 接收请求
  ↓
调用 Webhook API (自然语言查询)
  ↓
获取查询结果
  ↓
生成 Excel 文件
  ↓
返回下载链接 / 发送到 Lark
```

### n8n 工作流设计

#### 方案 A：Webhook 触发（推荐）

```yaml
工作流名称: "智能查询 - Webhook"

节点 1: Webhook Trigger
  - Method: POST
  - Path: /query
  - 接收参数:
      query: 自然语言查询
      user_id: 用户ID
      channel: 来源渠道 (lark/web/telegram)

节点 2: HTTP Request - 调用查询 API
  - Method: POST
  - URL: http://your-server:8000/api/webhook/query/natural
  - Headers:
      X-API-Key: {{$credentials.athenaApiKey}}
  - Body:
      {
        "query": "{{$json.query}}",
        "maxRows": 10000,
        "timeout": 120000
      }

节点 3: Function - 处理查询结果
  - 代码:
      const response = $input.item.json;
      
      if (!response.success) {
        throw new Error('查询失败: ' + response.message);
      }
      
      return {
        json: {
          rows: response.data.rows,
          columns: response.data.columns,
          rowCount: response.data.rowCount,
          generatedSQL: response.data.generatedSQL,
          executionTime: response.data.executionTime,
          query: $node["Webhook"].json.query,
          userId: $node["Webhook"].json.user_id
        }
      };

节点 4: Spreadsheet File - 生成 Excel
  - 使用: 将 rows 数据写入 Excel
  - 文件名: query_result_{{$now}}.xlsx
  - 包含表头: 是

节点 5: HTTP Request - 上传到 S3/本地存储
  - 存储 Excel 文件
  - 生成下载链接

节点 6: IF - 判断来源渠道
  - 条件: {{$node["Webhook"].json.channel}}

节点 7a: Lark - 发送消息（如果来自 Lark）
  - 类型: 发送卡片消息
  - 内容:
      标题: ✅ 查询完成
      字段:
        - 查询内容: {{$node["Function"].json.query}}
        - 生成的SQL: {{$node["Function"].json.generatedSQL}}
        - 结果行数: {{$node["Function"].json.rowCount}}
        - 执行时间: {{$node["Function"].json.executionTime}}ms
      按钮:
        - 下载结果: {{$node["HTTP Request - Upload"].json.downloadUrl}}

节点 7b: Respond to Webhook（如果来自 Web）
  - 返回:
      {
        "success": true,
        "downloadUrl": "{{$node["HTTP Request - Upload"].json.downloadUrl}}",
        "rowCount": {{$node["Function"].json.rowCount}},
        "sql": "{{$node["Function"].json.generatedSQL}}"
      }

节点 8: Error Trigger - 错误处理
  - 捕获所有节点的错误
  - 发送错误通知到 Lark
```

#### 方案 B：Lark 斜杠命令触发

```yaml
工作流名称: "智能查询 - Lark 命令"

节点 1: Lark Trigger
  - 触发方式: 斜杠命令
  - 命令: /query
  - 参数: 自然语言查询

节点 2-8: 同方案 A
```

### 实现步骤

#### Day 1（10.11）
- [ ] 在 n8n 中创建工作流
- [ ] 配置 Webhook Trigger
- [ ] 配置 Athena API 调用
- [ ] 测试基本查询流程

#### Day 2（10.12）
- [ ] 实现 Excel 生成
- [ ] 配置文件存储和下载
- [ ] 集成 Lark 消息推送
- [ ] 完整测试和优化

### 测试用例

```json
// 测试 1: 简单查询
{
  "query": "查询最近7天的用户数",
  "user_id": "user123",
  "channel": "lark"
}

// 测试 2: 复杂查询
{
  "query": "查询10月1日到10月7日，PHP和INR货币的充值金额和笔数",
  "user_id": "user123",
  "channel": "web"
}

// 测试 3: 聚合查询
{
  "query": "按游戏统计最近30天的收入，只显示收入前10的游戏",
  "user_id": "user123",
  "channel": "lark"
}
```

### 验收标准
- ✅ 能够理解自然语言并生成正确的 SQL
- ✅ 查询成功率 > 95%
- ✅ 查询响应时间 < 30 秒
- ✅ Excel 文件格式正确，可以下载
- ✅ Lark 消息推送成功

---

## 📊 里程碑 2：定时查询报告工作流（10.13 - 10.15，3天）

### 功能描述
设置定时任务，按固定时间自动执行查询，生成报告并发送到 Lark 邮箱。

### 业务场景

**场景 1：每日数据报表**
```
每天上午 9:00
  ↓
自动查询昨日核心指标
  - 新增用户数
  - 活跃用户数
  - 充值金额
  - 充值笔数
  ↓
生成 Excel 报表
  ↓
发送到运营团队 Lark 邮箱
```

**场景 2：每周汇总报表**
```
每周一上午 10:00
  ↓
自动查询上周数据汇总
  - 按游戏统计收入
  - Top 10 充值用户
  - 充值成功率
  ↓
生成 Excel 报表
  ↓
发送到管理层 Lark 邮箱
```

### n8n 工作流设计

#### 工作流 1: 每日数据报表

```yaml
工作流名称: "定时报表 - 每日数据"

节点 1: Schedule Trigger
  - Cron: 0 9 * * *  (每天上午9点)
  - Timezone: Asia/Shanghai

节点 2: Function - 构建查询
  - 代码:
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      return {
        json: {
          reportDate: dateStr,
          queries: [
            {
              name: "新增用户数",
              sql: `SELECT COUNT(DISTINCT user_id) as new_users 
                    FROM users 
                    WHERE DATE(created_at) = DATE '${dateStr}'`
            },
            {
              name: "活跃用户数",
              sql: `SELECT COUNT(DISTINCT user_id) as active_users 
                    FROM user_activity 
                    WHERE DATE(activity_date) = DATE '${dateStr}'`
            },
            {
              name: "充值数据",
              sql: `SELECT 
                      COUNT(*) as total_transactions,
                      SUM(amount) as total_amount,
                      COUNT(DISTINCT user_id) as paying_users
                    FROM transactions 
                    WHERE DATE(transaction_date) = DATE '${dateStr}'
                    AND status = 'success'`
            }
          ]
        }
      };

节点 3: Loop Over Items
  - 遍历每个查询

节点 4: HTTP Request - 执行查询
  - Method: POST
  - URL: http://your-server:8000/api/webhook/query/sql
  - Headers:
      X-API-Key: {{$credentials.athenaApiKey}}
  - Body:
      {
        "sql": "{{$json.sql}}",
        "maxRows": 1000
      }

节点 5: Function - 汇总结果
  - 代码:
      const allResults = [];
      
      for (const item of $input.all()) {
        const queryName = item.json.name;
        const result = item.json.result;
        
        allResults.push({
          metric: queryName,
          ...result.data.rows[0]
        });
      }
      
      return {
        json: {
          reportDate: $node["Function - 构建查询"].json.reportDate,
          metrics: allResults,
          generatedAt: new Date().toISOString()
        }
      };

节点 6: Function - 格式化为 Excel 数据
  - 代码:
      const { reportDate, metrics } = $input.item.json;
      
      // 构建 Excel 数据行
      const rows = [
        ['日期', reportDate],
        ['生成时间', new Date().toLocaleString('zh-CN')],
        [''],
        ['指标名称', '数值'],
        ...metrics.map(m => {
          const key = Object.keys(m).find(k => k !== 'metric');
          return [m.metric, m[key]];
        })
      ];
      
      return {
        json: {
          rows: rows,
          fileName: `日报_${reportDate}.xlsx`
        }
      };

节点 7: Spreadsheet File - 生成 Excel
  - 文件名: {{$json.fileName}}
  - 数据: {{$json.rows}}

节点 8: Lark - 发送邮件
  - 收件人: operation-team@company.com
  - 主题: 📊 每日数据报表 - {{$node["Function - 汇总结果"].json.reportDate}}
  - 正文:
      各位好，
      
      附件是 {{$node["Function - 汇总结果"].json.reportDate}} 的数据报表。
      
      核心指标：
      {{$node["Function - 格式化为 Excel 数据"].json.metrics}}
      
      详细数据请查看附件。
      
      ---
      自动生成于 {{$now}}
  - 附件: {{$node["Spreadsheet File"].binary}}

节点 9: Lark - 发送群消息（备份）
  - 群ID: 运营数据群
  - 消息类型: 卡片
  - 内容:
      标题: 📊 每日数据报表已生成
      描述: {{$node["Function - 汇总结果"].json.reportDate}}
      字段:
        - 新增用户: {{新增用户数}}
        - 活跃用户: {{活跃用户数}}
        - 充值金额: {{充值金额}}
      备注: 详细报表已发送到邮箱

节点 10: Error Trigger
  - 捕获错误
  - 发送告警到技术群
```

#### 工作流 2: 每周汇总报表

```yaml
工作流名称: "定时报表 - 每周汇总"

节点 1: Schedule Trigger
  - Cron: 0 10 * * 1  (每周一上午10点)
  - Timezone: Asia/Shanghai

节点 2: Function - 构建查询
  - 代码:
      // 计算上周日期范围
      const today = new Date();
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - today.getDay() - 6);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      const startDate = lastMonday.toISOString().split('T')[0];
      const endDate = lastSunday.toISOString().split('T')[0];
      
      return {
        json: {
          startDate: startDate,
          endDate: endDate,
          query: `
            SELECT 
              game_name,
              COUNT(DISTINCT user_id) as paying_users,
              COUNT(*) as transactions,
              SUM(amount) as total_revenue,
              AVG(amount) as avg_amount
            FROM transactions
            WHERE DATE(transaction_date) >= DATE '${startDate}'
              AND DATE(transaction_date) <= DATE '${endDate}'
              AND status = 'success'
            GROUP BY game_name
            ORDER BY total_revenue DESC
            LIMIT 20
          `
        }
      };

节点 3-9: 类似工作流 1，执行查询并发送邮件
```

### 报表模板配置表

为了灵活管理定时报表，创建一个配置管理：

```yaml
工作流名称: "报表模板管理"

# 在 n8n 中使用 Google Sheets 或 Airtable 存储配置

配置表结构:
  - id: 报表ID
  - name: 报表名称
  - schedule: Cron 表达式
  - sql_template: SQL 模板
  - recipients: 收件人列表
  - enabled: 是否启用
  - last_run: 最后执行时间
  - status: 状态 (active/paused/failed)

示例数据:
  1. 每日新增用户报表
     - schedule: "0 9 * * *"
     - sql_template: "SELECT COUNT(DISTINCT user_id) FROM users WHERE DATE(created_at) = DATE '{{yesterday}}'"
     - recipients: ["operation@company.com"]
     
  2. 每周收入汇总
     - schedule: "0 10 * * 1"
     - sql_template: "SELECT game_name, SUM(amount) FROM transactions WHERE..."
     - recipients: ["management@company.com"]
```

### 实现步骤

#### Day 1（10.13）
- [ ] 设计报表配置表结构
- [ ] 创建每日报表工作流
- [ ] 测试查询和数据汇总

#### Day 2（10.14）
- [ ] 实现 Excel 生成和格式化
- [ ] 配置 Lark 邮件发送
- [ ] 测试完整流程

#### Day 3（10.15）
- [ ] 创建每周报表工作流
- [ ] 创建报表模板管理系统
- [ ] 编写使用文档

### 验收标准
- ✅ 定时任务准时触发（误差 < 5分钟）
- ✅ 查询结果准确
- ✅ Excel 格式美观易读
- ✅ 邮件成功送达
- ✅ 异常情况有告警

---

## 🎮 里程碑 3：游戏评级报告工作流（10.16 - 10.18，3天）

### 功能描述
在 Lark 输入游戏名字，自动查询游戏相关数据，按评级规则生成游戏评级报告。

### 业务场景

```
运营人员在 Lark 群输入
  ↓
"/game_rating 王者荣耀"
  ↓
Bot 回复：正在生成评级报告...
  ↓
系统查询游戏数据：
  - 近30天收入
  - 活跃用户数
  - 付费率
  - 留存率
  - 人均充值
  ↓
按评级规则计算分数
  ↓
生成评级报告（S/A/B/C/D）
  ↓
发送到 Lark（卡片 + Excel）
```

### 评级规则

```javascript
评级维度：
1. 收入表现（40%权重）
   - S级: > 1000万/月
   - A级: 500-1000万/月
   - B级: 100-500万/月
   - C级: 10-100万/月
   - D级: < 10万/月

2. 用户活跃度（30%权重）
   - S级: DAU > 10万
   - A级: DAU 5-10万
   - B级: DAU 1-5万
   - C级: DAU 1000-1万
   - D级: DAU < 1000

3. 付费率（20%权重）
   - S级: > 10%
   - A级: 5-10%
   - B级: 2-5%
   - C级: 0.5-2%
   - D级: < 0.5%

4. 留存率（10%权重）
   - S级: 次日留存 > 50%
   - A级: 次日留存 30-50%
   - B级: 次日留存 15-30%
   - C级: 次日留存 5-15%
   - D级: 次日留存 < 5%
```

### n8n 工作流设计

```yaml
工作流名称: "游戏评级报告生成器"

节点 1: Lark Trigger
  - 触发方式: 斜杠命令
  - 命令: /game_rating
  - 参数: 游戏名称

节点 2: Lark - 发送即时反馈
  - 消息: "🎮 正在生成 {{$json.game_name}} 的评级报告，请稍候..."

节点 3: Function - 构建查询SQL
  - 代码:
      const gameName = $node["Lark Trigger"].json.game_name;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      return {
        json: {
          gameName: gameName,
          queries: {
            // 查询1: 收入数据
            revenue: `
              SELECT 
                SUM(amount) as total_revenue,
                COUNT(*) as transactions,
                COUNT(DISTINCT user_id) as paying_users
              FROM transactions
              WHERE game_name = '${gameName}'
                AND DATE(transaction_date) >= DATE '${dateStr}'
                AND status = 'success'
            `,
            
            // 查询2: 活跃用户
            activeUsers: `
              SELECT 
                COUNT(DISTINCT user_id) as dau,
                COUNT(DISTINCT CASE WHEN activity_date = CURRENT_DATE THEN user_id END) as today_dau
              FROM user_activity
              WHERE game_name = '${gameName}'
                AND DATE(activity_date) >= DATE '${dateStr}'
            `,
            
            // 查询3: 留存率
            retention: `
              SELECT 
                COUNT(DISTINCT a.user_id) as day1_users,
                COUNT(DISTINCT b.user_id) as day2_retained
              FROM user_activity a
              LEFT JOIN user_activity b 
                ON a.user_id = b.user_id 
                AND b.activity_date = a.activity_date + INTERVAL '1' DAY
              WHERE a.game_name = '${gameName}'
                AND DATE(a.activity_date) >= DATE '${dateStr}'
            `,
            
            // 查询4: 总用户数
            totalUsers: `
              SELECT COUNT(DISTINCT user_id) as total_users
              FROM user_activity
              WHERE game_name = '${gameName}'
                AND DATE(activity_date) >= DATE '${dateStr}'
            `
          }
        }
      };

节点 4: Split Out - 拆分查询
  - 将 queries 对象拆分为多个查询项

节点 5: HTTP Request - 执行查询
  - Method: POST
  - URL: http://your-server:8000/api/webhook/query/sql
  - Headers: X-API-Key
  - Body: {"sql": "{{$json.value}}"}

节点 6: Function - 汇总查询结果
  - 代码:
      const results = {};
      
      for (const item of $input.all()) {
        const queryName = item.json.key;
        const queryResult = item.json.result;
        results[queryName] = queryResult.data.rows[0];
      }
      
      return {
        json: {
          gameName: $node["Function - 构建查询SQL"].json.gameName,
          data: results
        }
      };

节点 7: Function - 计算评级
  - 代码:
      const { data } = $input.item.json;
      
      // 计算各维度分数
      function getRevenueGrade(revenue) {
        if (revenue > 10000000) return { grade: 'S', score: 100 };
        if (revenue > 5000000) return { grade: 'A', score: 85 };
        if (revenue > 1000000) return { grade: 'B', score: 70 };
        if (revenue > 100000) return { grade: 'C', score: 50 };
        return { grade: 'D', score: 30 };
      }
      
      function getActiveUsersGrade(dau) {
        if (dau > 100000) return { grade: 'S', score: 100 };
        if (dau > 50000) return { grade: 'A', score: 85 };
        if (dau > 10000) return { grade: 'B', score: 70 };
        if (dau > 1000) return { grade: 'C', score: 50 };
        return { grade: 'D', score: 30 };
      }
      
      function getPayingRateGrade(rate) {
        if (rate > 0.1) return { grade: 'S', score: 100 };
        if (rate > 0.05) return { grade: 'A', score: 85 };
        if (rate > 0.02) return { grade: 'B', score: 70 };
        if (rate > 0.005) return { grade: 'C', score: 50 };
        return { grade: 'D', score: 30 };
      }
      
      function getRetentionGrade(rate) {
        if (rate > 0.5) return { grade: 'S', score: 100 };
        if (rate > 0.3) return { grade: 'A', score: 85 };
        if (rate > 0.15) return { grade: 'B', score: 70 };
        if (rate > 0.05) return { grade: 'C', score: 50 };
        return { grade: 'D', score: 30 };
      }
      
      // 提取数据
      const revenue = data.revenue.total_revenue || 0;
      const dau = data.activeUsers.dau || 0;
      const payingUsers = data.revenue.paying_users || 0;
      const totalUsers = data.totalUsers.total_users || 1;
      const payingRate = payingUsers / totalUsers;
      const retentionRate = data.retention.day2_retained / data.retention.day1_users || 0;
      
      // 计算各维度评级
      const revenueGrade = getRevenueGrade(revenue);
      const activeGrade = getActiveUsersGrade(dau);
      const payingGrade = getPayingRateGrade(payingRate);
      const retentionGrade = getRetentionGrade(retentionRate);
      
      // 计算加权总分
      const totalScore = 
        revenueGrade.score * 0.4 +
        activeGrade.score * 0.3 +
        payingGrade.score * 0.2 +
        retentionGrade.score * 0.1;
      
      // 确定总评级
      let finalGrade = 'D';
      if (totalScore >= 90) finalGrade = 'S';
      else if (totalScore >= 75) finalGrade = 'A';
      else if (totalScore >= 60) finalGrade = 'B';
      else if (totalScore >= 45) finalGrade = 'C';
      
      return {
        json: {
          gameName: $input.item.json.gameName,
          finalGrade: finalGrade,
          totalScore: Math.round(totalScore),
          metrics: {
            revenue: {
              value: revenue,
              grade: revenueGrade.grade,
              score: revenueGrade.score,
              weight: '40%'
            },
            activeUsers: {
              value: dau,
              grade: activeGrade.grade,
              score: activeGrade.score,
              weight: '30%'
            },
            payingRate: {
              value: (payingRate * 100).toFixed(2) + '%',
              grade: payingGrade.grade,
              score: payingGrade.score,
              weight: '20%'
            },
            retention: {
              value: (retentionRate * 100).toFixed(2) + '%',
              grade: retentionGrade.grade,
              score: retentionGrade.score,
              weight: '10%'
            }
          },
          rawData: data
        }
      };

节点 8: Function - 生成报告文本
  - 代码:
      const { gameName, finalGrade, totalScore, metrics } = $input.item.json;
      
      // 评级颜色和emoji
      const gradeEmoji = {
        'S': '🌟',
        'A': '⭐',
        'B': '✨',
        'C': '💫',
        'D': '⚡'
      };
      
      const gradeColor = {
        'S': 'green',
        'A': 'blue',
        'B': 'orange',
        'C': 'yellow',
        'D': 'red'
      };
      
      return {
        json: {
          report: {
            title: `${gradeEmoji[finalGrade]} 游戏评级报告`,
            gameName: gameName,
            finalGrade: finalGrade,
            totalScore: totalScore,
            gradeColor: gradeColor[finalGrade],
            summary: `综合评分: ${totalScore}/100，评级: ${finalGrade}`,
            details: [
              {
                name: '💰 收入表现',
                value: `¥${(metrics.revenue.value / 10000).toFixed(2)}万`,
                grade: metrics.revenue.grade,
                weight: metrics.revenue.weight
              },
              {
                name: '👥 用户活跃',
                value: `${metrics.activeUsers.value}人`,
                grade: metrics.activeUsers.grade,
                weight: metrics.activeUsers.weight
              },
              {
                name: '💳 付费率',
                value: metrics.payingRate.value,
                grade: metrics.payingRate.grade,
                weight: metrics.payingRate.weight
              },
              {
                name: '🔄 次日留存',
                value: metrics.retention.value,
                grade: metrics.retention.grade,
                weight: metrics.retention.weight
              }
            ],
            generatedAt: new Date().toLocaleString('zh-CN')
          }
        }
      };

节点 9: Spreadsheet File - 生成详细报告Excel
  - 包含详细数据和图表

节点 10: Lark - 发送评级报告卡片
  - 消息类型: 交互式卡片
  - 卡片配置:
      {
        "header": {
          "title": "{{$json.report.title}}",
          "template": "{{$json.report.gradeColor}}"
        },
        "elements": [
          {
            "tag": "div",
            "text": {
              "tag": "lark_md",
              "content": "**游戏名称**: {{$json.report.gameName}}\n**综合评级**: {{$json.report.finalGrade}} ({{$json.report.totalScore}}/100)"
            }
          },
          {
            "tag": "hr"
          },
          {
            "tag": "div",
            "text": {
              "tag": "lark_md",
              "content": "**各维度评分**"
            }
          },
          // 遍历 details
          {
            "tag": "action",
            "actions": [
              {
                "tag": "button",
                "text": "下载详细报告",
                "type": "primary",
                "url": "{{下载链接}}"
              }
            ]
          }
        ]
      }

节点 11: Error Trigger
  - 错误处理
  - 发送失败通知
```

### 实现步骤

#### Day 1（10.16）
- [ ] 设计评级规则和算法
- [ ] 创建基础工作流
- [ ] 实现数据查询部分

#### Day 2（10.17）
- [ ] 实现评级计算逻辑
- [ ] 设计 Lark 卡片样式
- [ ] 生成 Excel 报告

#### Day 3（10.18）
- [ ] 完整联调测试
- [ ] 优化评级算法
- [ ] 编写使用文档

### 验收标准
- ✅ 能够正确识别游戏名称
- ✅ 查询数据准确完整
- ✅ 评级算法合理（与业务逻辑对齐）
- ✅ Lark 卡片美观易读
- ✅ Excel 报告包含详细数据
- ✅ 处理时间 < 30秒

---

## 📋 总体实施计划

### Week 1（10.11 - 10.12）
- [x] ✅ 已完成：Webhook API 和基础设施
- [ ] 里程碑 1：智能查询工作流

### Week 2（10.13 - 10.18）
- [ ] 里程碑 2：定时查询报告（10.13-10.15）
- [ ] 里程碑 3：游戏评级报告（10.16-10.18）

---

## 🎯 成功指标

### 功能指标
- ✅ 智能查询成功率 > 95%
- ✅ 定时报表准点率 100%
- ✅ 评级报告准确率 > 90%

### 性能指标
- ✅ 智能查询响应时间 < 30秒
- ✅ 定时报表生成时间 < 2分钟
- ✅ 评级报告生成时间 < 30秒

### 业务指标
- ✅ 每日使用次数 > 20次
- ✅ 用户满意度 > 4.5/5
- ✅ 报表按时送达率 100%

---

## 🛠️ 技术依赖清单

### 已完成 ✅
- [x] 后端 Webhook API
- [x] Athena 查询服务
- [x] API Key 认证
- [x] 测试工具和文档

### 需要配置
- [ ] n8n 实例（可使用 n8n Cloud 或自建）
- [ ] Lark 应用（企业自建应用或机器人）
- [ ] 文件存储（AWS S3 / 本地 / 其他）
- [ ] Lark 邮箱配置

---

## 📚 文档清单

### 用户文档
- [ ] 智能查询使用指南
- [ ] 定时报表配置手册
- [ ] 游戏评级使用说明
- [ ] 常见问题 FAQ

### 技术文档
- [ ] n8n 工作流配置指南
- [ ] 评级规则说明文档
- [ ] 故障排除手册
- [ ] API 对接文档

---

## 🔄 后续优化方向

### V1.1 增强版（可选）
- [ ] 支持更多自然语言查询场景
- [ ] 添加更多报表模板
- [ ] 优化评级算法（机器学习）
- [ ] 增加数据可视化图表

### V2.0 高级版（未来）
- [ ] Telegram Bot 集成
- [ ] 移动端 App
- [ ] 实时数据监控和告警
- [ ] 多维度数据分析平台

---

## 📞 支持和反馈

- **技术支持**: 查看 [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)
- **问题反馈**: 提交 Issue 或联系开发团队
- **功能建议**: 欢迎提出改进建议

---

**更新时间**: 2025-10-10  
**版本**: V1.0  
**状态**: 开发中









