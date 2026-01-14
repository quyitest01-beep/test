// 修复商户名大小写不一致的问题
// 在商户营收数据匹配时，统一转换为小写进行比较

// ========== 4. 商户维度：用户 + 营收 ==========

const merchantRevenueMap = new Map();
merchantRevenueRows.forEach(r => {
  const name = String(r['商户名'] || '').trim();
  if (!name) return;
  // 统一转换为小写作为 key，但保留原始名称
  const key = name.toLowerCase();
  const existing = merchantRevenueMap.get(key);
  if (existing) {
    // 如果已存在，累加数据（处理同一商户多条记录的情况）
    existing.rev_total_bet_usd += num(r['总投注USD']);
    existing.rev_total_payout_usd += num(r['总派奖USD']);
    existing.rev_total_ggr_usd += num(r['总GGR_USD'] || r['GGR-USD']);
  } else {
    merchantRevenueMap.set(key, {
      merchant_name: name, // 保留原始名称（使用第一个遇到的）
      rev_total_bet_usd: num(r['总投注USD']),
      rev_total_payout_usd: num(r['总派奖USD']),
      rev_total_ggr_usd: num(r['总GGR_USD'] || r['GGR-USD']),
    });
  }
});

const merchantsAll = merchantUserRows.map(u => {
  const name = String(u['商户名'] || '').trim();
  if (!name) return null;

  // 使用小写 key 查找营收数据
  const key = name.toLowerCase();
  const rv = merchantRevenueMap.get(key) || {};
  
  // 如果找到了营收数据但名称大小写不同，使用营收数据中的名称
  const finalName = rv.merchant_name || name;
  
  const betUsers = num(u['投注用户数']);

  return {
    merchant_name: finalName,
    // 用户侧
    user_total_bet_users: betUsers,
    user_new_users: num(u['新用户数']),
    user_active_d1_ret_pct: parsePercent(u['活跃用户次日留存']),
    user_active_d3_ret_pct: parsePercent(u['活跃用户3日留存']),
    user_new_d1_ret_pct: parsePercent(u['新用户次日留存']),
    user_new_d3_ret_pct: parsePercent(u['新用户3日留存']),
    // 营收侧
    rev_total_bet_usd: rv.rev_total_bet_usd || 0,
    rev_total_payout_usd: rv.rev_total_payout_usd || 0,
    rev_total_ggr_usd: rv.rev_total_ggr_usd || 0,
    // 派生：人均 GGR（美元）
    ggr_per_user_usd:
      betUsers > 0 && rv.rev_total_ggr_usd !== undefined
        ? Number((rv.rev_total_ggr_usd / betUsers).toFixed(4))
        : null,
  };
}).filter(Boolean);

