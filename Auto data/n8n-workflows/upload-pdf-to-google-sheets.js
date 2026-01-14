// n8n Code 节点：准备 PDF 上传到 Google Drive 并写入 Google Sheets 链接
// 
// 输入要求：
// - item.binary.pdf: PDF 二进制数据（从上游「输出PDF」节点传入）
// - item.json.fileName: PDF 文件名（可选，默认使用 reportTitle）
// - item.json.reportTitle: 报告标题（用于文件名）
// - item.json.reportPeriod: 报告周期（用于文件名）
//
// 输出：
// - json.fileName: PDF 文件名
// - json.fileId: Google Drive 文件 ID（上传后返回）
// - json.fileUrl: Google Drive 文件查看链接
// - json.sheetRowData: 用于写入 Google Sheets 的行数据（包含链接）

const items = $input.all();

if (!items.length) {
  throw new Error('❌ 未收到任何输入数据');
}

// 从上游获取 PDF 二进制数据
let pdfBinaryItem = null;
for (const item of items) {
  if (item.binary && item.binary.pdf) {
    pdfBinaryItem = item;
    break;
  }
}

if (!pdfBinaryItem || !pdfBinaryItem.binary || !pdfBinaryItem.binary.pdf) {
  throw new Error('❌ 未找到 PDF 二进制数据，请确认「输出PDF」节点已接入本节点');
}

// 获取文件名
const jsonData = pdfBinaryItem.json || {};
const reportTitle = jsonData.reportTitle || jsonData.title || '周报';
const reportPeriod = jsonData.reportPeriod || jsonData.period || '';
const fileName = jsonData.fileName || 
  (reportPeriod ? `${reportTitle}_${reportPeriod}.pdf` : `${reportTitle}.pdf`);

// 准备 Google Drive 上传所需的数据
// 注意：实际的上传需要使用 HTTP Request 节点调用 Google Drive API
// 这里只是准备数据

const output = {
  json: {
    // PDF 文件信息
    fileName: fileName,
    reportTitle: reportTitle,
    reportPeriod: reportPeriod,
    
    // 二进制数据引用（传递给下游 HTTP Request 节点）
    binaryPropertyName: 'pdf',
    
    // 用于 Google Sheets 的行数据
    sheetRowData: {
      // 报告标题
      report_title: reportTitle,
      // 报告周期
      report_period: reportPeriod,
      // 生成时间
      generated_at: new Date().toISOString(),
      // PDF 文件名
      file_name: fileName,
      // PDF 链接（上传后需要更新）
      file_url: '', // 将在上传后填充
      // Google Drive 文件 ID（上传后需要更新）
      file_id: '', // 将在上传后填充
    },
    
    // Google Drive 上传参数（用于下游 HTTP Request 节点）
    driveUploadParams: {
      // 文件名
      name: fileName,
      // 父文件夹 ID（可选，如果需要指定上传到特定文件夹）
      // parents: ['YOUR_FOLDER_ID'],
      // MIME 类型
      mimeType: 'application/pdf',
    },
  },
  binary: pdfBinaryItem.binary, // 传递二进制数据
};

return [output];




