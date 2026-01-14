// n8n Code 节点：周度/月度趋势计算器（环比/同比）
// 功能：计算环比/同比指标，识别异常，生成Top排名

const inputs = $input.all();
if (!inputs || !inputs.length) {
  throw new Error('❌ 未收到任何输入数据');
}

const currentData = inputs[0]?.json || {};
const reportType = currentData.report_type || 'monthly';

console.log(`📊 计算趋势数据（${reportType === 'weekly' ? '周度' : '月度'}）`);

// 注意：这里假设上游已经提供了历史数据用于对比
// 如果没有历史数据，环比/同比将显示为 null

function calculateGrowthRate(current, previous) {
  if (!current || !previous || previous === 0) return null;
  return Number(((current - previous) / previous * 100).toFixed(2));
}

function calculateTrend(current, previous) {
  if (current === null || previous === null) return null;
  const growth = calculateGrowthRate(current, previous);
  if (growth === null) return null;
  return growth > 0 ? '📈' : growth < 0 ? '📉' : '➡️';
}

// 处理全局汇总
const globalSummary = currentData.global_summary || {};
const previousGlobalSummary = currentData.previous_period_summary || {};

const globalTrends = {
  total_new_users: {
    current: globalSummary.total_new_users || 0,
    previous: previousGlobalSummary.total_new_users || null,
    growth_rate: calculateGrowthRate(
      globalSummary.total_new_users,
      previousGlobalSummary.total_new_users
    ),
    trend: calculateTrend(
      globalSummary.total_new_users,
      previousGlobalSummary.total_new_users
    ),
  },
  total_ggr_usd: {
    current: globalSummary.total_ggr_usd || 0,
    previous: previousGlobalSummary.total_ggr_usd || null,
    growth_rate: calculateGrowthRate(
      globalSummary.total_ggr_usd,
      previousGlobalSummary.total_ggr_usd
    ),
    trend: calculateTrend(
      globalSummary.total_ggr_usd,
      previousGlobalSummary.total_ggr_usd
    ),
  },
  avg_d1_retention: {
    current: globalSummary.avg_d1_retention || null,
    previous: previousGlobalSummary.avg_d1_retention || null,
    growth_rate: calculateGrowthRate(
      globalSummary.avg_d1_retention,
      previousGlobalSummary.avg_d1_retention
    ),
    trend: calculateTrend(
      globalSummary.avg_d1_retention,
      previousGlobalSummary.avg_d1_retention
    ),
  },
  avg_d7_retention: {
    current: globalSummary.avg_d7_retention || null,
    previous: previousGlobalSummary.avg_d7_retention || null,
    growth_rate: calculateGrowthRate(
      globalSummary.avg_d7_retention,
      previousGlobalSummary.avg_d7_retention
    ),
    trend: calculateTrend(
      globalSummary.avg_d7_retention,
      previousGlobalSummary.avg_d7_retention
    ),
  },
};

// 处理游戏数据（Top 10 + 异常检测）
const games = (currentData.games || []).map(game => {
  const previousGame = (currentData.previous_period_games || [])
    .find(g => g.game_name === game.game_name);
  
  return {
    ...game,
    trends: {
      total_ggr_usd: {
        current: game.total_ggr_usd,
        previous: previousGame?.total_ggr_usd || null,
        growth_rate: calculateGrowthRate(
          game.total_ggr_usd,
          previousGame?.total_ggr_usd
        ),
        trend: calculateTrend(
          game.total_ggr_usd,
          previousGame?.total_ggr_usd
        ),
      },
      total_new_users: {
        current: game.total_new_users,
        previous: previousGame?.total_new_users || null,
        growth_rate: calculateGrowthRate(
          game.total_new_users,
          previousGame?.total_new_users
        ),
        trend: calculateTrend(
          game.total_new_users,
          previousGame?.total_new_users
        ),
      },
    },
    // 异常标记
    anomalies: {
      negative_ggr: game.total_ggr_usd < 0,
      low_retention: game.avg_d1_retention !== null && game.avg_d1_retention < 3,
      low_users: game.total_new_users < 100,
    },
  };
});

// Top 10 游戏（按GGR）
const top10Games = games
  .sort((a, b) => b.total_ggr_usd - a.total_ggr_usd)
  .slice(0, 10);

// 异常游戏（负GGR、低留存、低用户数）
const anomalyGames = games.filter(game => 
  game.anomalies.negative_ggr || 
  game.anomalies.low_retention || 
  game.anomalies.low_users
);

// 处理商户数据（Top 10 + 异常检测）
const merchants = (currentData.merchants || []).map(merchant => {
  const previousMerchant = (currentData.previous_period_merchants || [])
    .find(m => m.merchant_name === merchant.merchant_name);
  
  return {
    ...merchant,
    trends: {
      total_ggr_usd: {
        current: merchant.total_ggr_usd,
        previous: previousMerchant?.total_ggr_usd || null,
        growth_rate: calculateGrowthRate(
          merchant.total_ggr_usd,
          previousMerchant?.total_ggr_usd
        ),
        trend: calculateTrend(
          merchant.total_ggr_usd,
          previousMerchant?.total_ggr_usd
        ),
      },
    },
    anomalies: {
      negative_ggr: merchant.total_ggr_usd < 0,
      low_users: merchant.total_new_users < 50,
    },
  };
});

// Top 10 商户（按GGR）
const top10Merchants = merchants
  .sort((a, b) => b.total_ggr_usd - a.total_ggr_usd)
  .slice(0, 10);

// 异常商户
const anomalyMerchants = merchants.filter(m => 
  m.anomalies.negative_ggr || 
  m.anomalies.low_users
);

// 构建输出
const output = {
  ...currentData,
  trends: {
    global: globalTrends,
  },
  rankings: {
    top10_games: top10Games.map((game, idx) => ({
      rank: idx + 1,
      ...game,
    })),
    top10_merchants: top10Merchants.map((merchant, idx) => ({
      rank: idx + 1,
      ...merchant,
    })),
  },
  anomalies: {
    games: anomalyGames.map(game => ({
      game_name: game.game_name,
      issues: [
        game.anomalies.negative_ggr && '负GGR',
        game.anomalies.low_retention && '低留存率',
        game.anomalies.low_users && '低用户数',
      ].filter(Boolean),
      severity: game.anomalies.negative_ggr ? 'P0' : 
               (game.anomalies.low_retention || game.anomalies.low_users) ? 'P1' : 'P2',
    })),
    merchants: anomalyMerchants.map(merchant => ({
      merchant_name: merchant.merchant_name,
      issues: [
        merchant.anomalies.negative_ggr && '负GGR',
        merchant.anomalies.low_users && '低用户数',
      ].filter(Boolean),
      severity: merchant.anomalies.negative_ggr ? 'P0' : 'P1',
    })),
  },
  meta: {
    ...currentData.meta,
    calculated_at: new Date().toISOString(),
  },
};

console.log(`✅ 趋势计算完成:`);
console.log(`   Top 10 游戏: ${top10Games.length}`);
console.log(`   异常游戏: ${anomalyGames.length}`);
console.log(`   异常商户: ${anomalyMerchants.length}`);

return [{ json: output }];






