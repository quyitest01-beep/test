# 将 PDF 上传到 Google Sheets 的完整指南

## 概述

Google Sheets **不能直接存储 PDF 文件**，但可以通过以下方式实现：
1. 将 PDF 上传到 **Google Drive**
2. 在 **Google Sheets** 中插入 PDF 的链接

## 方案一：使用 n8n 内置节点（推荐）

### 工作流结构

```
输出PDF → 准备上传数据 → 上传到Google Drive → 处理上传结果 → 写入Google Sheets
```

### 步骤详解

#### 1. 准备上传数据（Code 节点）

使用 `upload-pdf-to-google-sheets.js` 中的代码，准备上传所需的数据。

**输入要求**：
- `item.binary.pdf`: PDF 二进制数据
- `item.json.fileName` 或 `item.json.reportTitle`: 文件名

**输出**：
- `json.fileName`: PDF 文件名
- `json.driveUploadParams`: Google Drive 上传参数
- `binary.pdf`: PDF 二进制数据

#### 2. 上传到 Google Drive（HTTP Request 节点）

**配置说明**：

**方法一：使用 multipart 上传（推荐）**

```json
{
  "method": "POST",
  "url": "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
  "authentication": "oAuth2",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "multipart/related; boundary=boundary123"
      }
    ]
  },
  "sendBody": true,
  "contentType": "multipart/form-data",
  "bodyParameters": {
    "parameters": [
      {
        "name": "metadata",
        "value": "={{ JSON.stringify({ name: $json.fileName, mimeType: 'application/pdf' }) }}"
      }
    ]
  },
  "binaryPropertyName": "pdf"
}
```

**方法二：使用 resumable 上传（适合大文件）**

```json
{
  "method": "POST",
  "url": "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
  "authentication": "oAuth2",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "name",
        "value": "={{ $json.fileName }}"
      },
      {
        "name": "mimeType",
        "value": "application/pdf"
      }
    ]
  }
}
```

**认证配置**：
- 使用 **Google Drive API OAuth2** 凭证
- 需要以下权限（Scopes）：
  - `https://www.googleapis.com/auth/drive.file`（上传文件）

#### 3. 处理上传结果（Code 节点）

```javascript
// 处理上传结果，提取文件 ID 和链接
const uploadResult = $input.first().json;
const fileId = uploadResult.id;
const fileName = uploadResult.name;

// 构建 Google Drive 查看链接
const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

// 构建用于写入 Google Sheets 的数据
return [{
  json: {
    file_id: fileId,
    file_name: fileName,
    file_url: fileUrl,
    report_title: $('准备上传数据').first().json.reportTitle,
    report_period: $('准备上传数据').first().json.reportPeriod,
    generated_at: new Date().toISOString(),
    // 用于 Google Sheets 的行数据
    sheet_row: [
      $('准备上传数据').first().json.reportTitle,  // A列：报告标题
      $('准备上传数据').first().json.reportPeriod, // B列：报告周期
      new Date().toISOString().split('T')[0],      // C列：生成日期
      fileName,                                     // D列：文件名
      fileUrl                                       // E列：PDF链接
    ]
  }
}];
```

#### 4. 写入 Google Sheets（Google Sheets 节点）

**配置说明**：

- **操作类型**：`Append or Update`
- **文档 ID**：你的 Google Sheets 文档 ID（从 URL 中提取）
- **工作表名称**：`PDF报告列表`（或你自定义的名称）
- **匹配列**：`A`（报告标题列）
- **匹配值**：`={{ $json.report_title }}`
- **列映射**：
  - `报告标题`: `={{ $json.report_title }}`
  - `报告周期`: `={{ $json.report_period }}`
  - `生成日期`: `={{ $json.generated_at.split('T')[0] }}`
  - `文件名`: `={{ $json.file_name }}`
  - `PDF链接`: `={{ $json.file_url }}`

**认证配置**：
- 使用 **Google Sheets API OAuth2** 凭证
- 需要以下权限（Scopes）：
  - `https://www.googleapis.com/auth/spreadsheets`（读写表格）

## 方案二：使用 Google Drive 节点（更简单）

如果你使用的是 n8n 的 **Google Drive 节点**，可以直接使用：

### 配置步骤

1. **添加 Google Drive 节点**
   - **操作类型**：`Upload`
   - **文件名称**：`={{ $json.fileName }}`
   - **二进制数据**：`pdf`
   - **MIME 类型**：`application/pdf`
   - **父文件夹 ID**：（可选）指定上传到的文件夹

2. **处理上传结果**
   - 从返回结果中提取 `fileId`
   - 构建链接：`https://drive.google.com/file/d/${fileId}/view`

3. **写入 Google Sheets**
   - 使用 Google Sheets 节点插入包含 PDF 链接的行

## 方案三：使用 Code 节点直接调用 Google Drive API

如果你需要更多控制，可以使用 Code 节点直接调用 Google Drive API：

```javascript
// 需要先获取 access_token（通过 OAuth2 或 Service Account）
const accessToken = 'YOUR_ACCESS_TOKEN';
const fileName = $json.fileName;
const pdfBinary = $binary.pdf.data;

// 1. 创建文件元数据
const metadata = {
  name: fileName,
  mimeType: 'application/pdf',
  // parents: ['YOUR_FOLDER_ID'] // 可选：指定父文件夹
};

// 2. 构建 multipart 请求体
const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
const delimiter = `\r\n--${boundary}\r\n`;
const closeDelim = `\r\n--${boundary}--`;

const multipartBody = 
  delimiter +
  'Content-Type: application/json\r\n\r\n' +
  JSON.stringify(metadata) +
  delimiter +
  'Content-Type: application/pdf\r\n\r\n' +
  Buffer.from(pdfBinary, 'base64').toString('binary') +
  closeDelim;

// 3. 调用 Google Drive API
const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': `multipart/related; boundary=${boundary}`,
  },
  body: multipartBody
});

const result = await response.json();
const fileId = result.id;
const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

return [{
  json: {
    file_id: fileId,
    file_url: fileUrl,
    file_name: fileName
  }
}];
```

## Google Sheets 表格结构建议

建议在 Google Sheets 中创建以下列：

| 列名 | 说明 | 示例 |
|------|------|------|
| 报告标题 | 报告名称 | 周报 |
| 报告周期 | 报告时间范围 | 20251124-20251130 |
| 生成日期 | 报告生成日期 | 2025-12-01 |
| 文件名 | PDF 文件名 | 周报_20251124-20251130.pdf |
| PDF链接 | Google Drive 链接 | https://drive.google.com/file/d/.../view |

## 注意事项

1. **权限配置**：
   - Google Drive API 需要 `drive.file` 或 `drive` 权限
   - Google Sheets API 需要 `spreadsheets` 权限

2. **文件大小限制**：
   - Google Drive API 单次上传限制为 5TB
   - 对于大文件（>5MB），建议使用 resumable 上传

3. **链接权限**：
   - 默认上传的文件是私有的
   - 如果需要公开访问，需要设置文件权限：
     ```javascript
     // 在创建文件后，设置权限为"任何知道链接的人都可以查看"
     await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${accessToken}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         role: 'reader',
         type: 'anyone'
       })
     });
     ```

4. **错误处理**：
   - 检查上传是否成功
   - 处理文件已存在的情况
   - 处理权限错误

## 完整工作流示例

参考 `google-drive-upload-pdf-config.json` 文件中的完整工作流配置。

## 相关文件

- `n8n-workflows/upload-pdf-to-google-sheets.js` - 准备上传数据的代码
- `n8n-workflows/google-drive-upload-pdf-config.json` - 完整工作流配置示例




