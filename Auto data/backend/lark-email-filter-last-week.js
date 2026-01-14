// Lark动态邮件筛选器：上周周度筛选
const inputs = $input.all();

console.log("=== Lark上周周度邮件筛选器开始 ===");
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

// 计算上周（往前推一周）
function getPrevWeekRange(ref = new Date()) {
  const thisMon = mondayOfWeek(ref);
  const start = addDays(thisMon, -7);
  const end = addDays(start, 6);
  return {
    start,
    end,
    startStr: fmtDate(start),
    endStr: fmtDate(end),
    display: `${fmtDate(start)} 至 ${fmtDate(end)}`
  };
}

const now = new Date();
const targetSender = "billing@gaming-panda.com";

const targetWeekRange = getPrevWeekRange(now);
const targetSubject = `【即时】周度详细汇总报表 - ${targetWeekRange.display}`;

console.log(`📅 目标周度: ${targetWeekRange.display}`);
console.log(`🔍 目标主题: ${targetSubject}`);

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
      // 周度：直接记录匹配结果（不强制附件名）
      const messageId = emailData.data?.message?.message_id || emailData.message_id;
      targetEmails.push({
        message_id: messageId,
        subject,
        sender,
        internal_date: emailData.data?.message?.internal_date || emailData.internal_date,
        email_data: emailData,
        mode: 'weekly_last_week',
        target_week_range: targetWeekRange.display,
        target_week_start: targetWeekRange.startStr,
        target_week_end: targetWeekRange.endStr
      });
      console.log(`   ✅ 周度匹配成功: ${targetWeekRange.display}`);
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
