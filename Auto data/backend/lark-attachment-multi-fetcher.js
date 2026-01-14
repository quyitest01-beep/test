// Lark附件下载聚合器 - 兼容月度/周度：处理多个邮件及其附件
const inputs = $input.all();

console.log("=== Lark附件下载聚合器开始 ===");
console.log("📊 输入项数量:", inputs.length);

// 查找tenant_access_token
let tenantAccessToken = null;

inputs.forEach((input, index) => {
  const data = input.json || {};
  // 查找token
  if (!tenantAccessToken && typeof data.tenant_access_token === 'string' && data.tenant_access_token) {
    tenantAccessToken = data.tenant_access_token;
    console.log(`✅ 从输入项 ${index + 1} 找到tenant_access_token`);
  }
});

console.log("📊 聚合结果:");
console.log("   token:", tenantAccessToken ? tenantAccessToken.substring(0, 20) + "..." : "无");

if (!tenantAccessToken) {
  console.error("❌ 未找到tenant_access_token");
  return [{
    json: {
      status: "failed",
      error: "未找到tenant_access_token",
      timestamp: new Date().toISOString()
    }
  }];
}

// 遍历所有输入，构建下载请求
const downloadRequests = [];
const userMailboxId = "poon@gaming-panda.com";

inputs.forEach((input, index) => {
  try {
    const emailData = input.json || {};
    
    // 只处理包含message_id的邮件数据
    if (!emailData.message_id) {
      console.log(`⚠️ 输入项 ${index + 1} 不是邮件数据，跳过`);
      return;
    }
    
    console.log(`\n📧 处理邮件 ${index + 1}: ${emailData.message_id}`);
    console.log(`   主题: ${emailData.subject}`);
    console.log(`   模式: ${emailData.mode}`);
    
    const messageId = emailData.message_id;
    
    // 确定要下载的附件列表（按优先级检查多个路径）
    let attachmentsToDownload = [];
    
    // 优先级1：顶层 target_attachments（多个附件）
    if (Array.isArray(emailData.target_attachments) && emailData.target_attachments.length > 0) {
      attachmentsToDownload = emailData.target_attachments;
      console.log(`   📎 从顶层 target_attachments 获取: ${attachmentsToDownload.length} 个`);
    }
    // 优先级2：嵌套在 email_data 中的 target_attachments（多个附件）
    else if (Array.isArray(emailData.email_data?.target_attachments) && 
             emailData.email_data.target_attachments.length > 0) {
      attachmentsToDownload = emailData.email_data.target_attachments;
      console.log(`   📎 从 email_data.target_attachments 获取: ${attachmentsToDownload.length} 个`);
    }
    // 优先级3：顶层 target_attachment（单个附件）
    else if (emailData.target_attachment) {
      attachmentsToDownload = [emailData.target_attachment];
      console.log(`   📎 从顶层 target_attachment 获取: 1 个`);
    }
    // 优先级4：嵌套在 email_data 中的 target_attachment（单个附件）
    else if (emailData.email_data?.target_attachment) {
      attachmentsToDownload = [emailData.email_data.target_attachment];
      console.log(`   📎 从 email_data.target_attachment 获取: 1 个`);
    }
    // 优先级5：从原始邮件数据中获取所有附件（周度邮件）
    else if (emailData.email_data?.data?.message?.attachments && 
             emailData.email_data.data.message.attachments.length > 0) {
      attachmentsToDownload = emailData.email_data.data.message.attachments;
      console.log(`   📎 从原始邮件数据获取: ${attachmentsToDownload.length} 个`);
    }
    
    // 输出附件列表
    if (attachmentsToDownload.length > 0) {
      attachmentsToDownload.forEach((att, idx) => {
        console.log(`      ${idx + 1}. ${att.filename} (id: ${att.id})`);
      });
    }
    
    if (attachmentsToDownload.length === 0) {
      console.log(`   ⚠️ 未找到附件信息，跳过此邮件`);
      return;
    }
    
    // 为每个附件生成下载请求
    attachmentsToDownload.forEach((att, attIdx) => {
      const attachmentId = att.id;
      const attachmentFilename = att.filename;
      const attachmentType = att.attachment_type;
      
      const httpRequest = {
        method: "GET",
        url: `https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/${userMailboxId}/messages/${messageId}/attachments/download_url`,
        headers: {
          "Authorization": `Bearer ${tenantAccessToken}`,
          "Content-Type": "application/json"
        },
        // 透传给下游HTTP节点用的上下文信息
        message_id: messageId,
        message_index: index,
        attachment_id: attachmentId,
        attachment_filename: attachmentFilename,
        attachment_type: attachmentType,
        attachment_index: attIdx,
        subject: emailData.subject,
        sender: emailData.sender,
        mode: emailData.mode,
        target_month: emailData.target_month,
        target_year_month: emailData.target_year_month,
        target_attachment_name: emailData.target_attachment_name || att.filename,
        target_week_range: emailData.target_week_range,
        target_week_start: emailData.target_week_start,
        target_week_end: emailData.target_week_end,
        email_data: emailData
      };
      
      downloadRequests.push(httpRequest);
      
      console.log(`   ✅ 生成下载请求: ${attachmentFilename}`);
    });
    
  } catch (err) {
    console.error(`❌ 处理输入项 ${index + 1} 出错:`, err);
  }
});

console.log(`\n📊 下载请求汇总:`);
console.log(`✅ 成功生成 ${downloadRequests.length} 个下载请求`);

if (downloadRequests.length === 0) {
  console.log("⚠️ 没有可下载的附件");
  return [{
    json: {
      status: "empty",
      message: "没有可下载的附件",
      timestamp: new Date().toISOString()
    }
  }];
}

// 返回所有下载请求
return downloadRequests.map(req => ({ json: req }));
