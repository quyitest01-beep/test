// n8n Function节点：游戏数据映射器（修复版）
// 将game_id替换为对应的game_name，支持daily、weekly、monthly数据
// 未匹配时输出 game: null

async function execute() {
  try {
    console.log("=== 开始处理游戏数据映射 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    const mappingCandidates = [];
    const activityCandidates = [];

    const allowedActivityTypes = new Set([
      "game_daily",
      "game_weekly",
      "game_monthly",
      "game_users",
      "game_act",
      "game_new",
      "game_revenue"
    ]);

    const metricKeys = new Set([
      "daily_unique_users",
      "weekly_unique_users",
      "monthly_unique_users",
      "d0_users",
      "d1_users",
      "d7_users",
      "total_amount",
      "total_pay_out",
      "ggr",
      "bet_users",
      "bet_count"
    ]);

    const normalizeGameId = (value) => {
      if (value === null || value === undefined) return null;
      const str = String(value).trim();
      return str.length ? str : null;
    };

    const extractGameName = (record) => {
      const possible = [
        record.game,
        record.game_name,
        record.english_name,
        record.title,
      ];
      for (const candidate of possible) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
      return null;
    };

    const isMappingRecord = (record) => {
      if (!record || typeof record !== "object") return false;
      const id = normalizeGameId(record.game_id);
      if (!id) return false;
      return Boolean(extractGameName(record));
    };

    const isActivityRecord = (record) => {
      if (!record || typeof record !== "object") return false;
      const id = normalizeGameId(record.game_id);
      if (!id) return false;
      if (isMappingRecord(record)) return false;
  const dataType = normalizeString(record.dataType || record.stat_type);
  if (dataType) {
    return true;
  }
      if (record.dataType && allowedActivityTypes.has(record.dataType)) {
        return true;
      }
      for (const key of metricKeys) {
        if (record[key] !== undefined) {
          return true;
        }
      }
      return false;
    };

    const collectRecords = (node, path = []) => {
      if (node === null || node === undefined) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, idx) => collectRecords(item, path.concat(idx)));
        return;
      }
      if (typeof node !== "object") {
        return;
      }

      if (isMappingRecord(node)) {
        mappingCandidates.push(node);
      } else if (isActivityRecord(node)) {
        activityCandidates.push(node);
      }

      Object.values(node).forEach((value, keyIdx) => {
        collectRecords(value, path.concat(keyIdx));
      });
    };

    inputItems.forEach((item, index) => {
      collectRecords(item?.json, [index]);
    });

    console.log(`📊 收集到游戏映射数据候选: ${mappingCandidates.length} 条`);
    console.log(`📈 收集到游戏活跃数据候选: ${activityCandidates.length} 条`);

    if (mappingCandidates.length === 0) {
      throw new Error("没有找到游戏映射数据，无法进行映射");
    }

    if (activityCandidates.length === 0) {
      console.warn("⚠️ 没有找到游戏活跃数据");
      return [];
    }

    const gameIdToNameMap = new Map();
    mappingCandidates.forEach((record) => {
      const id = normalizeGameId(record.game_id);
      const name = extractGameName(record);
      if (!id || !name) return;
      const existing = gameIdToNameMap.get(id);
      if (!existing || existing.priority < 0) {
        gameIdToNameMap.set(id, {
          name,
          merchant: record.merchant || record.merchant_id || null,
          priority: 0,
        });
      }
    });

    console.log(`📊 构建游戏映射表完成，共 ${gameIdToNameMap.size} 个游戏`);
    console.log(
      "映射表示例:",
      Array.from(gameIdToNameMap.entries())
        .slice(0, 5)
        .map(([id, info]) => [id, info.name, info.merchant || "-"])
    );

    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    activityCandidates.forEach((record) => {
      const gameId = normalizeGameId(record.game_id);
      const mapping = gameId ? gameIdToNameMap.get(gameId) : null;
      const matchedName = mapping?.name ?? null;
      const enriched = {
        ...record,
        game_id: gameId,
        game: matchedName,
        isMatched: Boolean(matchedName),
        matchType: matchedName ? "game_id_to_name" : "game_id_not_found",
      };

      if (matchedName) {
        matchedCount++;
        console.log(
          `✅ 映射成功: ${gameId} -> ${matchedName} (类型: ${record.dataType || "unknown"})`
        );
      } else {
        unmatchedCount++;
        console.log(
          `❌ 映射失败: 游戏ID ${gameId} 未找到对应游戏名，已设置 game: null`
        );
      }

      results.push({ json: enriched });
    });

    console.log("=== 游戏数据映射完成 ===");
    console.log(`📊 总共处理游戏活跃数据: ${activityCandidates.length}`);
    console.log(`✅ 映射成功: ${matchedCount}`);
    console.log(`❌ 映射失败: ${unmatchedCount}`);
    console.log(
      `📈 映射率: ${
        activityCandidates.length > 0
          ? ((matchedCount / activityCandidates.length) * 100).toFixed(1) + "%"
          : "0%"
      }`
    );

    return results;
  } catch (error) {
    console.error("=== 处理游戏数据映射时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [
      {
        json: {
          status: "error",
          error: error.message,
          timestamp: new Date().toISOString(),
          debug_info: {
            input_items_count: $input.all ? $input.all().length : "无法获取",
          },
        },
      },
    ];
  }
}

return execute();

