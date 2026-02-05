/* ========== n8n Code节点：XLSX文件处理 + Webhook发送（修复版）========== */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

console.log(`📥 接收到 ${inputItems.length} 个输入项`);

/* ---------- 工具函数 ---------- */
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToSubtract);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  return `${formatDate(lastMonday)}-${formatDate(lastSunday)}`;
}

function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/* ---------- 处理文件 ---------- */
const processedFiles = [];
const binaryOutput = {};

inputItems.forEach((item, index) => {
  const binary = item.binary || {};
  
  // 查找XLSX文件
  Object.keys(binary).forEach(key => {
    const bin = binary[key];
    if (!bin || !bin.data) return;
    
    // 检查是否是XLSX文件
    const isXlsx = 
      bin.mimeType?.includes('spreadsheet') ||
      bin.fileName?.match(/\.(xlsx?|csv)$/i) ||
      key.includes('xlsx') || key.includes('excel');
    
    if (isXlsx) {
      const fileName = bin.fileName || `report_${index + 1}.xlsx`;
      
      // 直接复制binary数据到输出
      const outputKey = `attachment_${processedFiles.length + 1}`;
      binaryOutput[outputKey] = {
        data: bin.data,
        fileName: fileName,
        mimeType: bin.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: 'xlsx'
      };
      
      processedFiles.push({
        fileName: fileName,
        key: outputKey
      });
      
      console.log(`✅ 处理文件: ${fileName}`);
    }
  });
});

if (processedFiles.length === 0) {
  throw new Error("❌ 未找到XLSX文件");
}

// 如果只有一个文件，也添加到'data'字段
if (processedFiles.length === 1) {
  binaryOutput.data = binaryOutput.attachment_1;
}

/* ---------- 计算周期信息 ---------- */
const lastWeekRange = getLastWeekRange();
const lastMonth = getLastMonth();

/* ---------- 构建Webhook卡片 ---------- */
const reportTitle = '📊 数据报告';
const reportPeriod = lastWeekRange;
const fileList = processedFiles.map(f => f.fileName).join('、');

// 为外部群构建卡片（显示文件信息，提供联系方式）
const card = {
  config: { wide_screen_mode: true, enable_forward: true },
  header: {
    template: 'blue',
    title: { tag: 'plain_text', content: reportTitle },
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**报告周期：** ${reportPeriod}\n**生成时间：** ${new Date().toLocaleString('zh-CN')}`
      }
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `📄 **报告文件：** ${fileList}\n\n📊 **文件数量：** ${processedFiles.length} 个\n\n💡 **获取方式：** 请联系管理员获取文件下载链接`
      }
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '💬 联系管理员' },
          type: 'primary',
          value: { action: 'contact_admin', files: fileList }
        }
      ]
    }
  ]
};

/* ---------- 构建输出 ---------- */
const jsonOutput = {
  // 文件信息
  file_count: processedFiles.length,
  file_names: processedFiles.map(f => f.fileName),
  attachment_keys: processedFiles.map(f => f.key),
  
  // 周期信息
  period: {
    last_week: lastWeekRange,
    last_month: lastMonth,
    current: reportPeriod
  },
  
  // Webhook请求配置
  webhookRequest: {
    url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
    body: {
      msg_type: 'interactive',
      card: card
    }
  },
  
  // 兼容字段
  httpRequest: {
    url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
    body: {
      msg_type: 'interactive',
      card: card
    }
  },
  
  // 元数据
  generated_at: new Date().toISOString(),
  report_title: reportTitle,
  report_period: reportPeriod
};

console.log(`📤 输出完成: ${processedFiles.length} 个文件, Binary keys: ${Object.keys(binaryOutput).join(', ')}`);

// ✅ 关键：返回包含json和binary的完整结构
return [{
  json: jsonOutput,
  binary: binaryOutput
}];