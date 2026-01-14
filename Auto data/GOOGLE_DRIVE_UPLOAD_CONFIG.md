# Google Drive 上传 PDF 节点配置指南

## 问题诊断

你的配置中缺少了**二进制数据字段**的指定。Google Drive 节点需要知道从哪个二进制字段读取 PDF 数据。

## 完整配置步骤

### 1. 检查上游节点（输出PDF）

确保上游 HTTP Request 节点的配置如下：

```json
{
  "options": {
    "response": {
      "response": {
        "responseFormat": "file",
        "outputPropertyName": "pdf"  // ← 这里定义了二进制字段名为 "pdf"
      }
    }
  }
}
```

### 2. Google Drive 节点配置

在 Google Drive 节点的配置中，需要添加以下关键参数：

#### 方法一：通过 UI 配置

1. **Resource（资源）**: `File`
2. **Operation（操作）**: `Upload`
3. **File Name（文件名）**: `={{ $json.title }}.pdf`
4. **Binary Data（二进制数据）**: ✅ **勾选此选项**
5. **Binary Property Name（二进制属性名）**: `pdf` ← **这是关键！**
6. **Parent Drive（父驱动器）**: `My Drive`（或你选择的驱动器）
7. **Parent Folder（父文件夹）**: `GamingPanda报告`（或你选择的文件夹）

#### 方法二：通过 JSON 配置

```json
{
  "parameters": {
    "resource": "file",
    "operation": "upload",
    "name": "={{ $json.title }}.pdf",
    "binaryData": true,                    // ← 启用二进制数据
    "binaryPropertyName": "pdf",           // ← 指定二进制字段名（必须与上游一致）
    "driveId": {
      "__rl": true,
      "value": "My Drive",
      "mode": "list"
    },
    "folderId": {
      "__rl": true,
      "value": "1VMCTZTzp-HE7nGugZ-fDNBdgB8kYozq0",
      "mode": "list",
      "cachedResultName": "GamingPanda报告"
    },
    "options": {}
  }
}
```

## 关键配置项说明

### `binaryData: true`
- 告诉 Google Drive 节点这是一个二进制文件上传操作

### `binaryPropertyName: "pdf"`
- **必须与上游节点的 `outputPropertyName` 一致**
- 如果上游是 `outputPropertyName: "pdf"`，这里就填 `"pdf"`
- 如果上游是 `outputPropertyName: "data"`，这里就填 `"data"`

## 常见错误

### 错误 1: `The item has no binary field 'pdf'`
**原因**: `binaryPropertyName` 与上游输出的字段名不一致

**解决**: 
- 检查上游节点的 `outputPropertyName`
- 确保 Google Drive 节点的 `binaryPropertyName` 与之匹配

### 错误 2: `File name is required`
**原因**: 文件名表达式解析失败

**解决**: 
- 检查 `$json.title` 是否存在
- 可以先用固定值测试：`"周报.pdf"`
- 确认表达式语法：`={{ $json.title }}.pdf`

### 错误 3: `Permission denied`
**原因**: Google Drive API 凭证权限不足

**解决**: 
- 检查 OAuth2 凭证的 Scopes
- 需要 `https://www.googleapis.com/auth/drive.file` 权限
- 重新授权凭证

## 完整工作流示例

参考 `google-drive-upload-config-complete.json` 文件中的完整配置。

## 验证步骤

1. **检查上游输出**:
   - 在 "输出PDF" 节点的 OUTPUT 中，查看 Binary 标签
   - 应该能看到 `pdf` 字段，包含 PDF 文件信息

2. **测试上传**:
   - 执行 Google Drive 节点
   - 检查 OUTPUT 是否返回文件 ID
   - 在 Google Drive 中确认文件已上传

3. **检查文件**:
   - 访问 Google Drive 文件夹
   - 确认文件名和内容正确

## 额外配置（可选）

### 设置文件权限（如果需要公开访问）

上传后，可以添加一个 Code 节点来设置文件权限：

```javascript
// 设置文件为"任何知道链接的人都可以查看"
const fileId = $json.id;
const accessToken = 'YOUR_ACCESS_TOKEN'; // 从凭证中获取

// 调用 Google Drive API 设置权限
// 这里需要额外的 HTTP Request 节点
```

### 获取文件链接

上传成功后，Google Drive 节点会返回文件信息，包括：
- `id`: 文件 ID
- `name`: 文件名
- `webViewLink`: 查看链接
- `webContentLink`: 下载链接

可以在下游节点中使用：
```javascript
const fileUrl = $json.webViewLink; // 或 $json.webContentLink
```

## 相关文件

- `n8n-workflows/google-drive-upload-config-complete.json` - 完整配置示例




