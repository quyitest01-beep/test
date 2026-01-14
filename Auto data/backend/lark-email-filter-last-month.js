// Lark动态邮件筛选器：上月月度筛选
const inputs = $input.all();

console.log("=== Lark上月月度邮件筛选器开始 ===");
console.log("📊 输入邮件数量:", inputs.length);

// utils
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOfWeek(d) {
  // 周一为一周第一天
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  return addDays(new Date(x.getFullYear(), x.getMonth(), x.getDate()), -day);
}

// 计算上个月
function getPrevMonthMeta(ref = new Date()) {
  let y = ref.getFullYear();
  let m = ref.getMonth(); // 0..11（当前月），上个月索引即 m
  if (m === 0) { y = y - 1; m = 12; }
  const mm = pad2(m);
  return {
    year: y,
    month: Number(mm),
    yearMonth: `${y}${mm}`,
    chineseFormat: `${y}年${mm}月`,
    attachmentFormat: `${y}-${mm}`
  };
}

const now = new Date();
const targetSender = "billing@gaming-panda.com";

const targetMonthMeta = getPrevMonthMeta(now);
const targetSubject = `【即时】月度详细汇总报表 - ${targetMonthMeta.chineseFormat}`;
const targetAttachment = `${targetMonthMeta.yearMonth}_merchant_provider_currency.xlsx`;

console.log(`📅 目标月份: ${targetMonthMeta.chineseFormat} (${targetMonthMeta.yearMonth})`);
console.log(`🔍 目标主题: ${targetSubject}`);
console.log(`📎 目标附件: ${targetAttachment}`);

const targetEmails = [];
const filteredEmails = [];

inputs.forEach((input, index) => {
  try {
    const emailData = input.json;

    const subject = emailData.data?.message?.subject || emailData.subject || "";
    const sender = emailData.data?.message?.head_from?.mail_address || emailData.head_from?.mail_address || "";

    console.log(`\n📧 检查邮件 ${index + 1}:`);
    console.log(`   主题: ${subject}`);
    console.log(`   发件人: ${sender}`);

    // 基础条件：主题 + 发件人
    if (subject === targetSubject && sender === targetSender) {
      // 月度需要校验附件名
      const attachments = emailData.data?.message?.attachments || emailData.attachments || [];
      console.log(`   附件数量: ${attachments.length}`);

      const targetAttachmentFile = attachments.find(att => att.filename && att.filename === targetAttachment);
      if (!targetAttachmentFile) {
        console.log(`   ⚠️ 未找到目标附件: ${targetAttachment}`);
        filteredEmails.push({});
        return;
      }
      console.log(`   ✅ 找到目标附件: ${targetAttachmentFile.filename}`);

      const messageId = emailData.data?.message?.message_id || emailData.message_id;
      const attachmentDownloadUrl =
        `https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/poon@gaming-panda.com/messages/${messageId}/attachments/download_url`;

      targetEmails.push({
        message_id: messageId,
        subject,
        sender,
        internal_date: emailData.data?.message?.internal_date || emailData.internal_date,
        target_attachment: targetAttachmentFile,
        attachment_download_url: attachmentDownloadUrl,
        email_data: emailData,
        mode: 'monthly_last_month',
        target_month: targetMonthMeta.chineseFormat,
        target_year_month: targetMonthMeta.yearMonth,
        target_attachment_name: targetAttachment
      });
    } else {
      console.log(`   ❌ 不符合筛选条件`);
      filteredEmails.push({});
    }
  } catch (err) {
    console.error(`❌ 处理邮件 ${index + 1} 出错:`, err);
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

return targetEmails.map(email => ({ json: email }));
