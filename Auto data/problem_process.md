# 问题处理记录 (Problem Process Log)

本文档记录项目开发过程中遇到的问题及其解决方案，避免重复处理相同错误。

## 2026-01-13

### 问题1: Content-Disposition响应头包含非ASCII字符错误

**错误信息**：
```
TypeError: [ERR_INVALID_CHAR]: Invalid character in header content ["Content-Disposition"]
```

**问题描述**：
- PDF服务和导出服务在设置Content-Disposition响应头时，如果文件名包含中文等非ASCII字符，会导致Node.js抛出错误
- 用户报告"不行"、"还是不行"，说明初次修复不完整

**根本原因**：
- HTTP响应头必须是ASCII字符，不能包含中文等非ASCII字符
- 初次只修复了PDF服务（`backend/pdf-service/server.js`），但遗漏了导出服务（`backend/routes/export.js`）

**影响范围**：
1. `backend/pdf-service/server.js` - `/render`端点
2. `backend/pdf-service/server.js` - `/render-url`端点
3. `backend/routes/export.js` - `/api/export/download/:filename`端点

**解决方案**：
1. **创建ASCII安全的fallback文件名**：
   ```javascript
   let safeFilename = filename
     .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 替换非法字符
     .replace(/[^\x20-\x7E]/g, '_')  // 替换所有非ASCII字符
     .replace(/\s+/g, '_')  // 替换空格
     .substring(0, 200);  // 限制长度
   ```

2. **URL编码原始文件名**：
   ```javascript
   const encodedFilename = encodeURIComponent(filename.substring(0, 200));
   ```

3. **使用RFC 5987格式**：
   ```javascript
   res.setHeader('Content-Disposition', 
     `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
   ```

**修复文件**：
- `backend/pdf-service/server.js` - 已修复
- `backend/routes/export.js` - 已修复
- `PDF_SERVICE_TROUBLESHOOTING.md` - 已更新文档

**验证方法**：
1. 重启PDF服务：`cd backend/pdf-service && node server.js`
2. 重启主后端服务：`cd backend && node server.js`
3. 测试包含中文字符的文件名
4. 确认不再出现`ERR_INVALID_CHAR`错误

**重要提示 - 服务重启问题**：
- 修改代码后，必须完全停止旧进程并重启服务才能生效
- 如果用户报告"还是不行"，很可能是旧进程仍在运行
- 解决步骤：
  1. 查找占用端口的进程：`netstat -ano | findstr "8787 8000"`
  2. 强制终止进程：`taskkill /F /PID <进程ID>`
  3. 重新启动服务
- 验证服务已重启：检查进程ID是否改变

**经验教训**：
- 修复问题时要全局搜索相关代码，确保所有位置都已修复
- 使用`grepSearch`工具搜索关键字（如"Content-Disposition"）找到所有相关位置
- 用户反馈"不行"时，要重新排查是否有遗漏的修复点

**相关文档**：
- `worklog.md` - 2026-01-13 修复记录
- `task.md` - 2026-01-13 任务记录
- `README.md` - 项目状态更新
- `PDF_SERVICE_TROUBLESHOOTING.md` - 故障排查指南

---

## 问题处理流程

遇到问题时，请按以下流程处理：

1. **记录问题**：详细记录错误信息、复现步骤、影响范围
2. **分析原因**：深入分析问题的根本原因，不要只看表面现象
3. **全局搜索**：使用工具搜索相关代码，确保找到所有相关位置
4. **制定方案**：设计完整的解决方案，考虑所有影响点
5. **实施修复**：修改代码并测试验证
6. **更新文档**：更新worklog.md、task.md、README.md等相关文档
7. **记录经验**：在本文档中记录问题和解决方案，避免重复处理

## 常见问题快速索引

- **Content-Disposition编码错误** → 见"问题1"
- 更多问题持续更新中...
