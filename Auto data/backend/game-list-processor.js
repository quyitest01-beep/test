// n8n Code节点：游戏列表处理器（新游戏筛选版）
// 功能：根据当前执行时间筛选新游戏（当前月份或上个月上线），仅输出英文名称

const inputs = $input.all();
console.log("=== 新游戏筛选器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 获取当前执行时间
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1; // 0-11 -> 1-12

// 计算当前月份和上个月（YYYY/MM格式）
const currentMonthStr = `${currentYear}/${String(currentMonth).padStart(2, '0')}`;

// 计算上个月
let previousYear = currentYear;
let previousMonth = currentMonth - 1;
if (previousMonth < 1) {
  previousMonth = 12;
  previousYear = currentYear - 1;
}
const previousMonthStr = `${previousYear}/${String(previousMonth).padStart(2, '0')}`;

console.log(`📅 当前月份: ${currentMonthStr}`);
console.log(`📅 上个月: ${previousMonthStr}`);
console.log(`🔍 筛选条件: release_date = "${currentMonthStr}" 或 "${previousMonthStr}"`);

// 存储新游戏信息的数组
const newGames = [];

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 兼容两种数据格式：
  // 1. 原始格式（row_number, col_5等）
  // 2. 已处理格式（english_name, release_date等）
  
  let releaseDate, englishName;
  
  if (item.release_date && item.english_name) {
    // 已处理格式
    releaseDate = item.release_date;
    englishName = item.english_name;
  } else {
    // 原始格式：从第一列提取上线时间，从第5列提取英文名称
    const rowNumber = item.row_number || item.rowNumber;
    if (!rowNumber || rowNumber <= 4) {
      return; // 跳过标题行
    }
    
    releaseDate = item['2025 GMP Games Info'];
    englishName = item.col_5;
  }
  
  // 验证数据有效性
  if (!releaseDate || !englishName) {
    return;
  }
  
  // 验证上线时间格式
  const cleanReleaseDate = releaseDate.trim();
  if (!/^\d{4}\/\d{2}$/.test(cleanReleaseDate)) {
    return;
  }
  
  // 清理英文名称
  const cleanEnglishName = englishName.trim();
  if (!cleanEnglishName) {
    return;
  }
  
  // 判断是否为新游戏（当前月份或上个月）
  if (cleanReleaseDate === currentMonthStr || cleanReleaseDate === previousMonthStr) {
    newGames.push({
      english_name: cleanEnglishName,
      release_date: cleanReleaseDate
    });
    console.log(`✅ 新游戏: ${cleanEnglishName} (${cleanReleaseDate})`);
  }
});

console.log(`\n🎮 找到 ${newGames.length} 个新游戏`);

// 输出处理结果（仅输出英文名称）
const output = newGames.map(game => ({
  json: {
    english_name: game.english_name,
    release_date: game.release_date
  }
}));

// 输出统计信息
if (newGames.length > 0) {
  console.log("\n📋 新游戏列表:");
  newGames.forEach(game => {
    console.log(`  - ${game.english_name} (${game.release_date})`);
  });
} else {
  console.log("\n⚠️ 未找到新游戏");
}

console.log(`\n✅ 输出 ${output.length} 条数据`);
return output;

