// n8n Code 节点：拆分多意图查数请求
// 功能：
// 1. 保留原始主请求（status = "需依次查数"）
// 2. 将序号段落拆成多个子请求（status = "需执行查数"）
// 3. 继承 chatid/senderid/messagid/reason 等字段，保证“一条 SQL → 一个 item”

const items = $input.all();
if (!items.length) {
  throw new Error('未收到上游数据');
}

const MAIN_STATUS = '需依次查数';
const SUB_STATUS = '需执行查数';

const SECTION_REGEX = /^\s*(\d+)[\.\、]\s*/;

function cloneJson(json = {}) {
  return JSON.parse(JSON.stringify(json));
}

function splitSections(text = '') {
  const lines = text.split(/\r?\n/);
  const prefixLines = [];
  const sections = [];

  let current = null;

  for (const rawLine of lines) {
    const line = rawLine || '';
    const trimmed = line.trim();

    const match = trimmed.match(SECTION_REGEX);
    if (match) {
      if (current) {
        sections.push(current.content.trim());
      }
      current = {
        index: parseInt(match[1], 10),
        content: trimmed.replace(SECTION_REGEX, '').trim(),
      };
      continue;
    }

    if (current) {
      current.content += (current.content ? '\n' : '') + trimmed;
    } else if (trimmed) {
      prefixLines.push(trimmed);
    }
  }

  if (current && current.content) {
    sections.push(current.content.trim());
  }

  const prefix = prefixLines.join('\n').trim();
  return { prefix, sections };
}

function buildSubText(prefix, sectionText) {
  if (!prefix) return sectionText;
  const cleanPrefix = prefix.replace(/[:：]\s*$/, '');
  return `${cleanPrefix}：${sectionText}`;
}

const outputs = [];

function normalizeId(value) {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  return str;
}

function buildSubId(baseId, index) {
  if (!baseId) return '';
  return `${baseId}-${index}`;
}

items.forEach(item => {
  const json = cloneJson(item.json || {});
  const text = json.text || json.messageText || '';
  const baseId = normalizeId(json.id);
  const { prefix, sections } = splitSections(text);

  if (!sections.length) {
    outputs.push({
      json: {
        ...json,
        id: baseId,
        status: SUB_STATUS,
        processingStatus: SUB_STATUS,
        requestIndex: 1,
        isSubRequest: false,
        subIntent: text.trim() || null,
      },
    });
    return;
  }

  const mainJson = {
    ...json,
    id: baseId,
    status: MAIN_STATUS,
    processingStatus: MAIN_STATUS,
    requestIndex: 0,
    isSubRequest: false,
    subIntent: null,
  };
  outputs.push({ json: mainJson });

  sections.forEach((section, idx) => {
    const sectionIndex = idx + 1;
    const subJson = {
      ...json,
      text: buildSubText(prefix, section),
      id: buildSubId(baseId, sectionIndex),
      status: SUB_STATUS,
      processingStatus: SUB_STATUS,
      requestIndex: sectionIndex,
      isSubRequest: true,
      subIntent: section,
    };
    outputs.push({ json: subJson });
  });
});

console.log(`✅ 输出 ${outputs.length} 条记录（含主请求与子请求）`);

return outputs;

