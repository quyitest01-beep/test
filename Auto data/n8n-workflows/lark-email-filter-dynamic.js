// Lark动态邮件筛选器 - 根据当前月份动态筛选月度报表邮件

const inputs = $input.all();

console.log("=== Lark动态邮件筛选器开始 ===");

console.log("📊 输入邮件数量:", inputs.length);

// 动态计算目标月份（当前月-1）
function getTargetMonth() {
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  let targetYear = currentYear;
  let targetMonth = currentMonth - 1;
  
  // 处理跨年情况
  if (targetMonth <= 0) {
    targetMonth = 12;
    targetYear = currentYear - 1;
  }
  
  return {
    year: targetYear,
    month: targetMonth,
    yearMonth: `${targetYear}${String(targetMonth).padStart(2, '0')}`,
    chineseFormat: `${targetYear}年${String(targetMonth).padStart(2, '0')}月`,
    attachmentFormat: `${targetYear}-${String(targetMonth).padStart(2, '0')}`
  };
}

const targetMonth = getTargetMonth();
console.log(`📅 目标月份: ${targetMonth.chineseFormat} (${targetMonth.yearMonth})`);

// 构建筛选条件 - 支持多种主题格式
const targetSubjectVariants = [
  `【${targetMonth.chineseFormat}】月度用户数据报表`,  // 【2025年11月】月度用户数据报表
  `【${targetMonth.month}月】月度用户数据报表`,        // 【11月】月度用户数据报表
  `月度用户数据报表 - ${targetMonth.yearMonth}`,       // 月度用户数据报表 - 202511
];
const targetSender = "poon@gaming-panda.com";

// 目标附件名（仅游戏相关，支持多种格式）
const targetAttachments = [
  // 格式1：游戏相关附件（无月份前缀）
  `游戏新用户留存数据.xlsx`,
  `游戏活跃用户留存数据.xlsx`,
  `游戏投注用户数据.xlsx`,
  // 格式2：GMP-月份格式（中文月份）
  `GMP-${targetMonth.month}月投注用户数据.xlsx`,
  `GMP-${targetMonth.month}月留存数据.xlsx`,
  // 格式3：GMP-数字格式
  `GMP-${targetMonth.yearMonth}投注用户数据.xlsx`,
  `GMP-${targetMonth.yearMonth}留存数据.xlsx`,
];

console.log(`🔍 筛选条件:`);
console.log(`   目标主题（多种格式）: ${targetSubjectVariants.join(' / ')}`);
console.log(`   目标发件人: ${targetSender}`);
console.log(`   目标附件: ${targetAttachments.join(' / ')}`);

const targetEmails = [];
const filteredEmails = [];

inputs.forEach((input, index) => {
  try {
    const emailData = input.json;
    
    // 检查邮件主题 - 使用$input.first().json.data.message.subject路径
    const subject = emailData.data?.message?.subject || emailData.subject || "";
    const sender = emailData.data?.message?.head_from?.mail_address
      || emailData.head_from?.mail_address
      || emailData.sender
      || "";
    const safeSubject = subject ? subject.normalize("NFKC").trim() : "";
    
    console.log(`\n📧 检查邮件 ${index + 1}:`);
    console.log(`   主题: ${subject}`);
    console.log(`   发件人: ${sender}`);
    
    const hasPreFilteredAttachment =
      Boolean(emailData.target_attachment) ||
      (Array.isArray(emailData.target_attachments) && emailData.target_attachments.length > 0);
    
    // 主题匹配：支持多种格式
    const subjectMatches = targetSubjectVariants.some(targetSubj => {
      const safeTargetSubj = targetSubj.normalize("NFKC").trim();
      return safeSubject === safeTargetSubj;
    }) || (
      // 兜底：包含目标月份和"月度用户数据报表"
      (safeSubject.includes(`${targetMonth.month}月`) || safeSubject.includes(targetMonth.chineseFormat)) &&
      safeSubject.includes("月度用户数据报表")
    );
    
    const senderMatches = typeof sender === "string" &&
      sender.toLowerCase().trim() === targetSender.toLowerCase();
    
    console.log(`   匹配判断 => subject:${subjectMatches ? "✅" : "❌"} sender:${senderMatches ? "✅" : "❌"} preFiltered:${hasPreFilteredAttachment ? "✅" : "❌"}`);
    
    // 如果上游已经标注 target_attachment，则直接视为命中
    if (hasPreFilteredAttachment || (subjectMatches && senderMatches)) {
      
      // 检查附件 - 使用$input.first().json.data.message.attachments路径
      const attachments = emailData.data?.message?.attachments ||
        emailData.email_data?.data?.message?.attachments ||
        emailData.attachments ||
        [];
      console.log(`   附件数量: ${attachments.length}`);
      
      // 查找目标附件（支持多个附件名）
      let matchedAttachments = attachments.filter(att =>
        att.filename && targetAttachments.includes(att.filename)
      );
      
      // 如果上游已经给定 target_attachment，但我们没有匹配到，手动加入
      if (matchedAttachments.length === 0 && emailData.target_attachment) {
        matchedAttachments = [emailData.target_attachment];
        console.log("   ⚠️ 使用上游 target_attachment 作为兜底附件");
      }
      
      // 如果没有精准命中，尝试用关键词兜底（投注/留存）
      if (matchedAttachments.length === 0) {
        const fallbackKeywords = ["投注", "留存"];
        matchedAttachments = attachments.filter(att =>
          att.filename && fallbackKeywords.some(keyword => att.filename.includes(keyword))
        );
        if (matchedAttachments.length > 0) {
          console.log(`   ⚠️ 精准匹配失败，使用关键词兜底命中 ${matchedAttachments.length} 个附件`);
        }
      }
      const targetAttachmentFile = matchedAttachments[0];
      
      if (matchedAttachments.length > 0) {
        console.log(`   ✅ 找到目标附件 ${matchedAttachments.length} 个: ${matchedAttachments.map(att => att.filename).join(' / ')}`);
        
        // 构建附件下载URL
        const messageId = emailData.data?.message?.message_id || emailData.message_id;
        const attachmentDownloadUrl = `https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/poon@gaming-panda.com/messages/${messageId}/attachments/download_url`;
        
        console.log(`   📎 附件下载URL: ${attachmentDownloadUrl}`);
        
        targetEmails.push({
          message_id: messageId,
          subject: subject,
          sender: sender,
          internal_date: emailData.data?.message?.internal_date || emailData.internal_date,
          target_attachment: targetAttachmentFile,
          target_attachments: matchedAttachments,
          attachment_download_url: attachmentDownloadUrl,
          email_data: emailData,
          target_month: targetMonth.chineseFormat,
          target_year_month: targetMonth.yearMonth,
          target_attachment_name: targetAttachmentFile.filename
        });
      } else {
        console.log(`   ⚠️ 未找到目标附件`);
        // 不记录过滤详情，只统计数量
        filteredEmails.push({});
      }
    } else {
      console.log(`   ❌ 不符合筛选条件 -> subject="${subject}", sender="${sender}"`);
      // 不记录过滤详情，只统计数量
      filteredEmails.push({});
    }
    
  } catch (error) {
    console.error(`❌ 处理邮件${index + 1}时出错:`, error);
    // 不记录详细错误信息，只统计数量
    filteredEmails.push({});
  }
});

console.log(`\n📊 筛选结果:`);
console.log(`✅ 目标邮件: ${targetEmails.length} 个`);
console.log(`❌ 过滤邮件: ${filteredEmails.length} 个`);

if (targetEmails.length === 0) {
  console.log("⚠️ 没有找到符合条件的邮件");
  return [];
}

console.log(`\n🎉 找到 ${targetEmails.length} 个目标邮件！`);

// 只返回匹配成功的邮件信息，不包含任何失败信息
return targetEmails.map(email => ({
  json: email
}));

