# 定时查询推送与智能查询功能设计

## 📋 功能概述

### （二）定时查询推送功能
**核心流程：** 用户创建任务→自动执行预定查询并生成结果报告到用户邮箱/TG

### （三）智能查询功能  
**核心流程：** 用户在TG/Lark群@机器人/应用提查询数据需求→机器人/应用接收并执行数据查询→自动将查询结果发送至用户所在的TG/飞书群

---

## 🕐 （二）定时查询推送功能详细设计

### 1. 核心组件架构

```
定时查询推送系统
├── 任务调度器 (Task Scheduler)
├── 查询执行引擎 (Query Executor) 
├── 报告生成器 (Report Generator)
├── 消息推送服务 (Notification Service)
├── 任务管理API (Task Management API)
└── 监控告警系统 (Monitoring & Alerting)
```

### 2. 数据库表设计

#### 定时任务表 (scheduled_tasks)
```sql
CREATE TABLE scheduled_tasks (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query_text TEXT NOT NULL,
    sql_query TEXT,
    database_name VARCHAR(100),
    
    -- 调度配置
    schedule_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
    schedule_config JSON NOT NULL,
    
    -- 执行配置
    timeout_seconds INT DEFAULT 300,
    max_rows INT DEFAULT 100000,
    
    -- 通知配置
    notification_channels JSON NOT NULL, -- ['email', 'telegram', 'lark']
    recipients JSON NOT NULL,
    
    -- 报告配置
    report_format ENUM('excel', 'csv', 'pdf') DEFAULT 'excel',
    include_summary BOOLEAN DEFAULT true,
    
    -- 状态管理
    status ENUM('active', 'paused', 'completed', 'failed') DEFAULT 'active',
    last_run_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NOT NULL,
    
    -- 执行历史
    total_runs INT DEFAULT 0,
    success_runs INT DEFAULT 0,
    
    -- 元数据
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_next_run (next_run_at),
    INDEX idx_created_by (created_by)
);
```

#### 任务执行历史表 (task_execution_history)
```sql
CREATE TABLE task_execution_history (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 执行结果
    status ENUM('success', 'failed', 'timeout') NOT NULL,
    row_count INT,
    execution_duration INT,
    error_message TEXT,
    
    -- 输出文件
    output_file_path VARCHAR(500),
    file_size BIGINT,
    
    -- 通知状态
    notifications_sent BOOLEAN DEFAULT false,
    notification_errors TEXT,
    
    FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id),
    INDEX idx_task_id (task_id),
    INDEX idx_execution_time (execution_time)
);
```

### 3. 调度配置示例

#### 每日调度
```json
{
  "schedule_type": "daily",
  "time": "09:00",
  "timezone": "Asia/Shanghai"
}
```

#### 每周调度  
```json
{
  "schedule_type": "weekly", 
  "days": [1, 3, 5], // 周一、周三、周五
  "time": "18:00",
  "timezone": "Asia/Shanghai"
}
```

#### 自定义Cron表达式
```json
{
  "schedule_type": "custom",
  "cron_expression": "0 0 9 * * 1-5", // 工作日早上9点
  "timezone": "Asia/Shanghai"
}
```

### 4. 消息推送服务集成

#### 邮件通知服务
```javascript
class EmailNotificationService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  async sendTaskReport(task, executionResult, reportFile) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: task.recipients.join(','),
      subject: `[定时报告] ${task.name} - ${new Date().toLocaleDateString()}`,
      html: this.generateEmailTemplate(task, executionResult),
      attachments: [{
        filename: reportFile.filename,
        path: reportFile.path,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    };
    
    return await this.transporter.sendMail(mailOptions);
  }
}
```

#### Telegram机器人通知
```javascript
class TelegramNotificationService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  }
  
  async sendTaskReport(task, executionResult, reportFile) {
    const caption = `📊 ${task.name}\n✅ 执行成功\n📈 数据行数: ${executionResult.row_count}\n⏱️ 耗时: ${executionResult.execution_duration}ms`;
    
    // 发送文档
    await this.bot.sendDocument(
      task.telegram_chat_id,
      reportFile.path,
      { caption }
    );
    
    // 发送统计摘要
    await this.bot.sendMessage(
      task.telegram_chat_id,
      this.generateSummaryMessage(executionResult)
    );
  }
}
```

#### 飞书机器人通知
```javascript
class LarkNotificationService {
  constructor() {
    this.client = new Lark.Client({
      appId: process.env.LARK_APP_ID,
      appSecret: process.env.LARK_APP_SECRET
    });
  }
  
  async sendTaskReport(task, executionResult, reportFile) {
    // 上传文件到飞书
    const fileKey = await this.uploadFile(reportFile);
    
    // 发送消息卡片
    await this.client.message.send({
      receive_id: task.lark_chat_id,
      msg_type: 'interactive',
      content: JSON.stringify({
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: `📊 ${task.name}` },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: this.generateLarkMessage(executionResult) }
          },
          {
            tag: 'action',
            actions: [{
              tag: 'button',
              text: { tag: 'plain_text', content: '📥 下载报告' },
              url: `https://open.feishu.cn/file/${fileKey}`,
              type: 'primary'
            }]
          }
        ]
      })
    });
  }
}
```

### 5. 任务调度器实现

```javascript
class TaskScheduler {
  constructor() {
    this.schedule = new Map();
    this.jobs = new Map();
  }
  
  async start() {
    // 从数据库加载所有活跃任务
    const activeTasks = await this.loadActiveTasks();
    
    for (const task of activeTasks) {
      this.scheduleTask(task);
    }
    
    // 启动监控
    this.startMonitoring();
  }
  
  scheduleTask(task) {
    const job = schedule.scheduleJob(
      this.parseSchedule(task.schedule_config),
      async () => {
        try {
          await this.executeScheduledTask(task);
        } catch (error) {
          logger.error('定时任务执行失败', { taskId: task.id, error });
        }
      }
    );
    
    this.jobs.set(task.id, job);
  }
  
  async executeScheduledTask(task) {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      // 执行查询
      const result = await queryService.executeQuery({
        sql: task.sql_query,
        database: task.database_name,
        timeout: task.timeout_seconds * 1000
      });
      
      // 生成报告
      const reportFile = await reportService.generateReport(result.data, {
        format: task.report_format,
        filename: `${task.name}_${new Date().toISOString().split('T')[0]}`
      });
      
      // 发送通知
      await notificationService.sendNotifications(task, {
        executionId,
        rowCount: result.row_count,
        duration: Date.now() - startTime,
        reportFile
      });
      
      // 更新任务状态
      await this.updateTaskExecution(task.id, {
        status: 'success',
        rowCount: result.row_count,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      await this.updateTaskExecution(task.id, {
        status: 'failed',
        errorMessage: error.message
      });
      
      // 发送失败通知
      await notificationService.sendErrorNotification(task, error);
    }
  }
}
```

---

## 🤖 （三）智能查询功能详细设计

### 1. 机器人集成架构

```
智能查询机器人系统
├── 消息接收器 (Message Receiver)
├── 意图识别器 (Intent Recognizer) 
├── 查询处理器 (Query Processor)
├── 结果格式化器 (Result Formatter)
├── 消息发送器 (Message Sender)
├── 会话管理器 (Session Manager)
└── 权限控制器 (Access Control)
```

### 2. 数据库表设计

#### 机器人会话表 (bot_sessions)
```sql
CREATE TABLE bot_sessions (
    id VARCHAR(36) PRIMARY KEY,
    platform ENUM('telegram', 'lark', 'wechat') NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- 会话状态
    current_state VARCHAR(50) DEFAULT 'idle',
    context JSON,
    
    -- 权限控制
    allowed_databases JSON,
    max_rows_per_query INT DEFAULT 1000,
    query_timeout INT DEFAULT 60,
    
    -- 使用统计
    total_queries INT DEFAULT 0,
    last_query_at TIMESTAMP NULL,
    
    -- 会话管理
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    
    UNIQUE KEY uk_platform_chat_user (platform, chat_id, user_id),
    INDEX idx_platform_chat (platform, chat_id),
    INDEX idx_user_id (user_id)
);
```

#### 查询历史表 (bot_query_history)
```sql
CREATE TABLE bot_query_history (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    message_id VARCHAR(255),
    
    -- 查询信息
    original_message TEXT NOT NULL,
    processed_query TEXT,
    generated_sql TEXT,
    
    -- 执行结果
    status ENUM('success', 'failed', 'timeout', 'cancelled') NOT NULL,
    row_count INT,
    execution_time INT,
    error_message TEXT,
    
    -- 响应信息
    response_type ENUM('text', 'table', 'file', 'error') NOT NULL,
    response_content TEXT,
    file_path VARCHAR(500),
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES bot_sessions(id),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
);
```

### 3. Telegram机器人实现

#### 机器人初始化
```javascript
class TelegramBotService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: true
    });
    
    this.setupHandlers();
  }
  
  setupHandlers() {
    // 处理文本消息
    this.bot.on('text', async (msg) => {
      await this.handleMessage(msg);
    });
    
    // 处理命令
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStartCommand(msg);
    });
    
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelpCommand(msg);
    });
    
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatusCommand(msg);
    });
  }
  
  async handleMessage(msg) {
    const { chat, text, from } = msg;
    
    try {
      // 检查是否@了机器人
      if (this.isMentioned(text)) {
        await this.processQuery(chat.id, from.id, text);
      }
    } catch (error) {
      await this.sendError(chat.id, error);
    }
  }
  
  async processQuery(chatId, userId, message) {
    // 创建或获取会话
    const session = await this.getOrCreateSession('telegram', chatId, userId);
    
    // 识别查询意图
    const intent = await intentRecognizer.recognize(message);
    
    // 生成SQL查询
    const sqlQuery = await sqlGenerator.generateSQL(intent);
    
    // 执行查询
    const result = await queryExecutor.execute({
      sql: sqlQuery,
      timeout: session.query_timeout * 1000,
      maxRows: session.max_rows_per_query
    });
    
    // 格式化结果
    const formattedResult = await resultFormatter.format(result, {
      platform: 'telegram',
      maxRows: 50 // Telegram消息行数限制
    });
    
    // 发送响应
    await this.sendResponse(chatId, formattedResult);
    
    // 保存查询历史
    await this.saveQueryHistory(session.id, {
      originalMessage: message,
      sqlQuery,
      result,
      formattedResult
    });
  }
  
  async sendResponse(chatId, result) {
    if (result.type === 'text') {
      await this.bot.sendMessage(chatId, result.content, {
        parse_mode: 'Markdown'
      });
    } else if (result.type === 'table') {
      // 发送表格格式数据
      await this.sendTable(chatId, result.data);
    } else if (result.type === 'file') {
      // 发送文件
      await this.bot.sendDocument(chatId, result.filePath, {
        caption: result.caption
      });
    }
  }
  
  async sendTable(chatId, data) {
    if (data.length <= 10) {
      // 小数据直接发送表格
      const tableText = this.formatAsMarkdownTable(data);
      await this.bot.sendMessage(chatId, tableText, {
        parse_mode: 'Markdown'
      });
    } else {
      // 大数据生成文件发送
      const filePath = await fileService.generateCsvFile(data, 'query_result');
      await this.bot.sendDocument(chatId, filePath, {
        caption: `查询结果 (${data.length} 行数据)`
      });
    }
  }
}
```

### 4. 飞书机器人实现

#### 飞书消息处理
```javascript
class LarkBotService {
  constructor() {
    this.client = new Lark.Client({
      appId: process.env.LARK_APP_ID,
      appSecret: process.env.LARK_APP_SECRET
    });
    
    this.setupWebhook();
  }
  
  async handleMessage(event) {
    const { message, sender } = event;
    
    try {
      // 检查是否@了机器人
      if (this.isMentioned(message.content, process.env.LARK_BOT_ID)) {
        const response = await this.processQuery(
          message.chat_id,
          sender.sender_id,
          message.content
        );
        
        await this.sendResponse(message.chat_id, response);
      }
    } catch (error) {
      await this.sendError(message.chat_id, error);
    }
  }
  
  async sendResponse(chatId, result) {
    if (result.type === 'text') {
      await this.client.message.send({
        receive_id: chatId,
        content: JSON.stringify({ text: result.content }),
        msg_type: 'text'
      });
    } else if (result.type === 'interactive') {
      await this.client.message.send({
        receive_id: chatId,
        content: result.content,
        msg_type: 'interactive'
      });
    } else if (result.type === 'file') {
      // 上传文件到飞书
      const fileKey = await this.uploadFile(result.filePath);
      
      await this.client.message.send({
        receive_id: chatId,
        content: JSON.stringify({
          text: result.caption,
          file_key: fileKey
        }),
        msg_type: 'file'
      });
    }
  }
  
  formatAsInteractiveCard(result) {
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '📊 查询结果' },
        template: 'blue'
      },
      elements: [
        {
          tag: 'div',
          text: { 
            tag: 'lark_md', 
            content: `**查询成功**\n• 数据行数: ${result.rowCount}\n• 执行时间: ${result.executionTime}ms`
          }
        },
        {
          tag: 'hr'
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: this.formatTablePreview(result.data)
          }
        },
        {
          tag: 'action',
          actions: [{
            tag: 'button',
            text: { tag: 'plain_text', content: '📥 下载完整数据' },
            url: result.downloadUrl,
            type: 'primary'
          }]
        }
      ]
    };
  }
}
```

### 5. 智能查询流程优化

#### 查询结果分页处理
```javascript
class ResultPagination {
  constructor() {
    this.pageSize = 20;
    this.pages = new Map();
  }
  
  async paginateResults(chatId, messageId, data) {
    const totalPages = Math.ceil(data.length / this.pageSize);
    const pageData = [];
    
    for (let i = 0; i < totalPages; i++) {
      const start = i * this.pageSize;
      const end = start + this.pageSize;
      pageData.push(data.slice(start, end));
    }
    
    this.pages.set(`${chatId}_${messageId}`, {
      data: pageData,
      currentPage: 0,
      totalPages
    });
    
    return this.getPage(chatId, messageId, 0);
  }
  
  getPage(chatId, messageId, pageNum) {
    const session = this.pages.get(`${chatId}_${messageId}`);
    if (!session || pageNum < 0 || pageNum >= session.totalPages) {
      return null;
    }
    
    session.currentPage = pageNum;
    return {
      data: session.data[pageNum],
      currentPage: pageNum + 1,
      totalPages: session.totalPages
    };
  }
}
```

#### 智能结果格式化
```javascript
class SmartResultFormatter {
  format(result, options = {}) {
    const { platform, maxRows = 100 } = options;
    
    if (result.rowCount === 0) {
      return { type: 'text', content: '🔍 未找到匹配的数据' };
    }
    
    if (result.rowCount <= 10) {
      // 小数据直接显示
      return this.formatAsTable(result.data, platform);
    } else if (result.rowCount <= maxRows) {
      // 中等数据提供下载链接
      return this.formatWithDownloadOption(result, platform);
    } else {
      // 大数据需要分页或文件下载
      return this.formatAsFile(result, platform);
    }
  }
  
  formatAsTable(data, platform) {
    if (platform === 'telegram') {
      return {
        type: 'text',
        content: this.formatMarkdownTable(data)
      };
    } else if (platform === 'lark') {
      return {
        type: 'interactive',
        content: JSON.stringify(this.formatLarkTable(data))
      };
    }
  }
}
```

---

## 🚀 实施建议

### 第一阶段：基础功能实现（1-2周）
1. **定时查询推送**
   - 实现任务调度器核心功能
   - 集成邮件通知服务
   - 开发基础的任务管理API

2. **智能查询**  
   - 实现Telegram机器人基础功能
   - 开发意图识别和SQL生成
   - 实现简单的文本结果返回

### 第二阶段：功能增强（2-3周）
1. **定时查询推送增强**
   - 集成Telegram和飞书通知
   - 实现报告生成和附件发送
   - 添加任务监控和告警

2. **智能查询增强**
   - 集成飞书机器人
   - 实现文件下载功能
   - 添加查询分页和会话管理

### 第三阶段：高级功能（1-2周）
1. **性能优化**
   - 查询结果缓存
   - 异步处理优化
   - 资源使用监控

2. **用户体验提升**
   - 智能结果摘要
   - 交互式消息卡片
   - 多语言支持

## 📊 监控指标

- 定时任务执行成功率
- 平均查询响应时间
- 机器人消息处理延迟
- 用户查询满意度
- 系统资源使用率

这个设计方案为您提供了完整的定时查询推送和智能查询功能架构，可以根据实际需求分阶段实施。