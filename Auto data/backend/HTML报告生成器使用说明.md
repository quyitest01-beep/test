# HTML报告生成器使用说明

## 功能概述

`markdown-to-html-rating-report.js` 是一个 n8n Code 节点，用于将 AI 输出的 Markdown 格式评级分析报告转换为精美的 HTML 格式，适合用于生成 PDF 报告。

## 输入格式

输入数据应该包含 AI 输出的 Markdown 文本，可以通过以下字段传递：

- `output` - AI Agent 节点的输出内容
- `content` - 格式化后的内容
- `text` - 纯文本内容

**示例输入**：

```json
{
  "output": "# Aero Rush 游戏评级分析报告\n\n## 一、基本信息\n..."
}
```

## 输出格式

输出是一个包含完整 HTML 文档的对象：

```json
{
  "html": "<!DOCTYPE html>...",
  "gameName": "Aero Rush",
  "score": "40",
  "scoreColor": "#f59e0b",
  "timestamp": "2025-01-XX..."
}
```

## 功能特性

### 1. Markdown 解析
- 支持标题（H1、H2、H3）
- 支持列表项（无序列表）
- 支持粗体文本
- 支持段落

### 2. 样式特性
- **评分徽章**：根据评分显示不同颜色的徽章
  - 100分：绿色
  - 80分：蓝色
  - 60分：橙色
  - 40分：橙色
  - 20分：红色

- **高亮显示**：
  - 百分比数值：蓝色背景高亮
  - 货币数值：绿色背景高亮
  - 评级标准：紫色背景高亮
  - 评级结果：根据结果类型显示不同颜色

- **特殊部分样式**：
  - 基本信息：渐变背景卡片
  - 优势部分：绿色背景
  - 不足部分：红色背景
  - 评级依据：灰色背景
  - 风险提示：黄色背景
  - 改进建议：蓝色背景

### 3. PDF 优化
- A4 页面大小
- 页眉页脚（页眉：报告标题，页脚：页码）
- 分页控制（避免标题和列表项被分页断开）
- 打印样式优化

### 4. 响应式设计
- 支持移动设备查看
- 自适应布局

## 使用方法

### 在 n8n 工作流中配置

1. **添加 Code 节点**
   - 将 `markdown-to-html-rating-report.js` 的代码复制到 Code 节点

2. **连接上游节点**
   - 上游应该是 AI Agent 节点，输出 Markdown 格式的报告

3. **获取输出**
   - 输出中的 `html` 字段包含完整的 HTML 文档
   - 可以保存为文件或传递给 PDF 生成节点

### 工作流示例

```
AI Agent节点 
  → markdown-to-html-rating-report.js 
  → HTTP Request（保存HTML文件）或 PDF生成节点
```

## PDF 生成

### 方法1：使用浏览器打印
1. 将 HTML 保存为文件
2. 在浏览器中打开
3. 使用"打印"功能，选择"另存为PDF"

### 方法2：使用 n8n HTTP Request + PDF服务
1. 将 HTML 发送到 PDF 生成服务（如 Puppeteer、wkhtmltopdf 等）
2. 获取生成的 PDF 文件

### 方法3：使用 n8n PDF 节点（如果有）
1. 直接使用 n8n 的 PDF 生成节点
2. 输入 HTML 内容

## 样式自定义

如果需要自定义样式，可以修改代码中的 CSS 部分：

### 修改颜色主题

```javascript
// 根据评分确定颜色主题
function getScoreColor(score) {
  const s = parseInt(score) || 0;
  if (s >= 80) return '#10b981'; // 绿色
  if (s >= 60) return '#3b82f6'; // 蓝色
  if (s >= 40) return '#f59e0b'; // 橙色
  return '#ef4444'; // 红色
}
```

### 修改字体

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', ...;
}
```

### 修改页面大小

```css
@page {
  size: A4;  // 可以改为 Letter, Legal 等
  margin: 2cm;
}
```

## 注意事项

1. **Markdown 格式要求**：
   - 确保 AI 输出的 Markdown 格式正确
   - 标题使用 `#`、`##`、`###`
   - 列表项使用 `-`、`*` 或 `+`
   - 粗体使用 `**文本**`

2. **数据提取**：
   - 代码会自动提取游戏名称和评分
   - 如果无法提取，会使用默认值

3. **HTML 转义**：
   - 代码会自动转义 HTML 特殊字符
   - 确保安全性

4. **PDF 生成**：
   - 某些 CSS 特性可能在不同 PDF 生成工具中表现不同
   - 建议使用 Chromium 内核的 PDF 生成工具（如 Puppeteer）

## 故障排查

### 问题1：HTML 显示不正确
- **检查**：确保 Markdown 格式正确
- **解决**：检查 AI 输出的 Markdown 是否符合规范

### 问题2：样式丢失
- **检查**：确保 CSS 样式完整
- **解决**：检查代码中的 `<style>` 标签是否完整

### 问题3：PDF 生成失败
- **检查**：确保 PDF 生成工具支持所使用的 CSS 特性
- **解决**：简化 CSS 或使用 Chromium 内核的 PDF 生成工具

### 问题4：评分徽章颜色不对
- **检查**：确保评分提取正确
- **解决**：检查 Markdown 中是否包含"综合评分：XX分"的格式

## 示例输出

生成的 HTML 会包含：
- 精美的标题样式
- 颜色区分的评分徽章
- 高亮的数值和百分比
- 不同背景色的分析部分
- 适合打印的页面布局

## 后续优化建议

1. **添加图表支持**：可以集成 Chart.js 等图表库
2. **添加Logo**：可以在页眉添加公司Logo
3. **自定义主题**：可以根据不同游戏类型使用不同主题
4. **多语言支持**：可以支持英文等其他语言












