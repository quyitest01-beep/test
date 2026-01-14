# HTML预览工具使用说明

## 方案一：使用 n8n 工作流 + 浏览器预览（推荐）

### 步骤：
1. **在 n8n 工作流中**：
   - 将 AI Agent 的输出连接到 "转换为HTML" Code 节点
   - 在 "转换为HTML" 节点后添加一个 "Write Binary File" 节点（或使用 HTTP Response 节点）
   - 将 HTML 内容保存到本地文件（如 `output.html`）

2. **在浏览器中预览**：
   - 直接打开生成的 HTML 文件
   - 或者使用 VS Code 的 Live Server 扩展
   - 或者使用浏览器插件（如 "Live Server" Chrome 扩展）

### 优点：
- 简单直接
- 无需额外工具
- 修改代码后重新运行工作流即可

---

## 方案二：使用本地预览服务器

### 安装依赖（可选）：
```bash
npm install chokidar  # 用于文件监听
```

### 使用方法：
```bash
# 1. 将 n8n 输出的 JSON 保存到文件（例如：test-output.json）
# 文件格式：{ "output": "### 业务数据统计报告..." }

# 2. 运行预览服务器
node preview-server.js test-output.json

# 3. 浏览器会自动打开 http://localhost:3000
# 修改 test-output.json 后，刷新浏览器即可看到最新效果
```

### 文件格式要求：
```json
{
  "output": "### 业务数据统计报告\n\n**当前周期：** 20251027 - 20251102\n..."
}
```

或：
```json
[
  {
    "output": "### 业务数据统计报告..."
  }
]
```

---

## 方案三：使用 VS Code Live Server（最简单）

1. **安装 Live Server 扩展**（VS Code）
2. **在 n8n 中生成 HTML 并保存为文件**
3. **右键 HTML 文件 → "Open with Live Server"**
4. **修改代码后重新运行 n8n 工作流，浏览器会自动刷新**

---

## 方案四：使用 n8n HTTP Response 节点

在 n8n 工作流中：
1. "转换为HTML" Code 节点 → HTTP Response 节点
2. 在 HTTP Response 节点中：
   - Response Code: `200`
   - Response Headers: `Content-Type: text/html`
   - Response Body: `{{ $json.html }}`
3. 启用 n8n 的 Webhook，然后通过浏览器访问 Webhook URL 即可实时预览

---

## 快速测试

### 创建测试文件：
```json
{
  "output": "### 业务数据统计报告\n\n**当前周期：** 20251027 - 20251102\n**报告类型：** **周报**\n\n---\n\n**一、 整体表现概览**\n\n本周总GGR达到 `$905,807`，较上一周增长 `$115,626`，环比增长 **14.63%**。"
}
```

### 运行预览：
```bash
node preview-server.js test-output.json
```

---

## 注意事项

1. **标题生成**：标题会自动从 Markdown 中提取周期信息，格式为 `20251027 - 20251102周度数据报告`
2. **数值高亮**：货币、百分比、大数字会自动高亮显示
3. **颜色区分**：
   - 正百分比：绿色背景
   - 负百分比：红色背景
   - 货币金额：蓝色背景
   - 大数字：灰色背景










