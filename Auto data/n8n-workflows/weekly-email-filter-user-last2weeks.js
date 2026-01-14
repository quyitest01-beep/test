// 筛选目标邮件（用户数据）- 周度专用（上上周）

// 邮件示例：主题：周度用户数据报表 - 20251124-20251130  发件人：poon@gaming-panda.com

// 输出：每封命中的邮件 1 条 item，包含 message_id / attachments / target_period 等

const inputs = $input.all();

console.log('=== 筛选目标邮件-用户-周（上上周） 开始 ===');

console.log('📊 输入项数量:', inputs.length);

// 归一化字符串：去掉多余空格/全角空格

function normalize(str) {

  if (!str) return '';

  return String(str)

    .replace(/\u3000/g, ' ')   // 全角空格 -> 半角

    .replace(/\s+/g, ' ')      // 多个空白合并

    .trim();

}

// ---------- 1. 计算上上周时间范围 ----------

const today = new Date();

const dayOfWeek = today.getDay(); // 0=周日,1=周一,...,6=周六

// 先计算上周一
const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;

// 再减去7天，得到上上周一
const daysToSubtract = daysToLastMonday + 7;

const lastLastMonday = new Date(today);

lastLastMonday.setDate(today.getDate() - daysToSubtract);

const lastLastSunday = new Date(lastLastMonday);

lastLastSunday.setDate(lastLastMonday.getDate() + 6);

function fmtKey(d) {

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, '0');

  const dd = String(d.getDate()).padStart(2, '0');

  return `${y}${m}${dd}`;      // 20251124

}

const startKey = fmtKey(lastLastMonday);

const endKey = fmtKey(lastLastSunday);

// 你邮件里的标题是「周度用户数据报表 - 20251124-20251130」

const targetSubject = `周度用户数据报表 - ${startKey}-${endKey}`;

const targetSender = 'poon@gaming-panda.com';

const targetPeriod = `${startKey}-${endKey}`;

console.log('🔍 目标主题 :', targetSubject);

console.log('🔍 目标发件人:', targetSender);

console.log('🔍 周期标识 :', targetPeriod);

const results = [];

// ---------- 2. 遍历所有邮件 ----------

inputs.forEach((input, index) => {

  const emailData = input.json || {};

  const subjectRaw =

    emailData.data?.message?.subject ||

    emailData.subject ||

    '';

  const senderRaw =

    emailData.data?.message?.head_from?.mail_address ||

    emailData.head_from?.mail_address ||

    '';

  const subject = normalize(subjectRaw);

  const sender = normalize(senderRaw);

  console.log(`\n📧 检查邮件 ${index + 1}:`);

  console.log('   原始主题 :', subjectRaw);

  console.log('   规范主题 :', subject);

  console.log('   原始发件人:', senderRaw);

  console.log('   规范发件人:', sender);

  const subjectMatch = subject === normalize(targetSubject);

  const senderMatch = sender.toLowerCase() === normalize(targetSender).toLowerCase();

  console.log('   主题匹配 :', subjectMatch ? '✅' : '❌');

  console.log('   发件人匹配:', senderMatch ? '✅' : '❌');

  if (!subjectMatch || !senderMatch) {

    console.log('   ❌ 不符合条件，跳过');

    return;

  }

  const rawEmail =

    emailData.data ||

    emailData.email_data ||

    {};

  const attachments =

    rawEmail.data?.message?.attachments ||

    rawEmail.attachments ||

    emailData.attachments ||

    [];

  console.log('   附件数量:', attachments.length);

  attachments.forEach((att, i) => {

    console.log(`     附件 ${i + 1}:`, att.filename || '（无文件名）');

  });

  const messageId =

    emailData.data?.message?.message_id ||

    emailData.message_id;

  results.push({

    message_id: messageId,

    subject: subjectRaw,

    sender: senderRaw,

    report_type: 'weekly',        // 固定周报

    target_period: targetPeriod,  // 如 20251124-20251130

    attachments,

    email_data: rawEmail,

  });

  console.log('   ✅ 命中周度用户数据报表，已加入结果');

});

console.log(`\n📊 筛选结果: 共命中 ${results.length} 封周度用户数据邮件`);

return results.map(r => ({ json: r }));

