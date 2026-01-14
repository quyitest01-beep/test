-- ============================================
-- 游戏数据数据库表结构设计
-- ============================================

-- 1. 游戏映射表（game_mapping）
-- 功能：存储 game_id 到 game_name 的映射关系
-- 说明：一个 game_id 可能对应多个 merchant_id（不同商户可能有不同的游戏名）
--       但根据需求，只按 game_id 匹配，所以可以只存储唯一的 game_id -> game_name 映射
CREATE TABLE IF NOT EXISTS `game_mapping` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `game_id` VARCHAR(50) NOT NULL COMMENT '游戏ID',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名称',
  `merchant_id` VARCHAR(50) DEFAULT NULL COMMENT '商户ID（可选，用于记录来源）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_game_id` (`game_id`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏映射表';

-- 2. 游戏活跃数据表（game_activity）
-- 功能：存储游戏每日/每周/每月的活跃用户数据
-- 说明：支持 daily、weekly、monthly 三种数据类型
CREATE TABLE IF NOT EXISTS `game_activity` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date_str` VARCHAR(20) DEFAULT NULL COMMENT '日期字符串（日数据使用，格式：YYYYMMDD）',
  `month_str` VARCHAR(10) DEFAULT NULL COMMENT '月份字符串（月数据使用，格式：YYYYMM）',
  `period_range` VARCHAR(50) DEFAULT NULL COMMENT '周期范围（周数据使用，格式：YYYYMMDD-YYYYMMDD）',
  `merchant` VARCHAR(100) DEFAULT NULL COMMENT '商户标识',
  `game_id` VARCHAR(50) NOT NULL COMMENT '游戏ID',
  `game_name` VARCHAR(200) DEFAULT NULL COMMENT '游戏名称（映射后的名称，如果未匹配则为game_id）',
  `data_type` ENUM('game_daily', 'game_weekly', 'game_monthly') NOT NULL COMMENT '数据类型',
  `daily_unique_users` INT UNSIGNED DEFAULT 0 COMMENT '每日活跃用户数',
  `weekly_unique_users` INT UNSIGNED DEFAULT 0 COMMENT '每周活跃用户数',
  `monthly_unique_users` INT UNSIGNED DEFAULT 0 COMMENT '每月活跃用户数',
  `is_matched` TINYINT(1) DEFAULT 0 COMMENT '是否匹配到游戏名（0=未匹配，1=已匹配）',
  `match_type` VARCHAR(50) DEFAULT NULL COMMENT '匹配类型（game_id_to_name=匹配成功，game_id_not_found=未匹配）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date_str` (`date_str`),
  KEY `idx_month_str` (`month_str`),
  KEY `idx_period_range` (`period_range`),
  KEY `idx_merchant` (`merchant`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_is_matched` (`is_matched`),
  KEY `idx_created_at` (`created_at`),
  -- 复合索引：用于查询特定日期/周期和游戏的数据
  KEY `idx_date_game` (`date_str`, `game_id`, `data_type`),
  KEY `idx_period_game` (`period_range`, `game_id`, `data_type`),
  KEY `idx_month_game` (`month_str`, `game_id`, `data_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏活跃数据表';

-- 3. 游戏数据汇总表（game_activity_summary）
-- 功能：存储合并后的游戏数据汇总（最终输出格式）
-- 说明：用于存储按日期和游戏名汇总后的数据，便于快速查询和报表生成
CREATE TABLE IF NOT EXISTS `game_activity_summary` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` VARCHAR(20) NOT NULL COMMENT '日期（"合计" 或 "YYYYMMDD"）',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名称（可能是game_id）',
  `bet_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '投注用户数',
  `data_type` ENUM('daily', 'weekly', 'monthly') DEFAULT NULL COMMENT '数据类型（可选，用于区分数据来源）',
  `period_range` VARCHAR(50) DEFAULT NULL COMMENT '周期范围（周/月数据使用）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_date_game` (`date`, `game_name`),
  -- 唯一索引：防止重复数据
  UNIQUE KEY `uk_date_game_type` (`date`, `game_name`, `data_type`, `period_range`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏数据汇总表';

-- ============================================
-- 索引说明
-- ============================================
-- game_mapping 表：
--   - uk_game_id: 确保 game_id 唯一
--   - idx_game_name: 支持按游戏名查询
--   - idx_merchant_id: 支持按商户查询

-- game_activity 表：
--   - idx_date_str: 支持按日期查询日数据
--   - idx_month_str: 支持按月份查询月数据
--   - idx_period_range: 支持按周期查询周数据
--   - idx_game_id: 支持按游戏ID查询
--   - idx_game_name: 支持按游戏名查询
--   - idx_data_type: 支持按数据类型查询
--   - idx_is_matched: 支持查询未匹配的数据
--   - 复合索引：优化常用查询组合

-- game_activity_summary 表：
--   - idx_date: 支持按日期查询
--   - idx_game_name: 支持按游戏名查询
--   - uk_date_game_type: 防止重复数据，支持快速查找

-- ============================================
-- 使用场景示例
-- ============================================

-- 1. 插入游戏映射数据
-- INSERT INTO game_mapping (game_id, game_name, merchant_id) 
-- VALUES ('1698217747704', 'Bank Heist', '1760338096')
-- ON DUPLICATE KEY UPDATE game_name = VALUES(game_name), updated_at = CURRENT_TIMESTAMP;

-- 2. 插入游戏活跃数据（日数据）
-- INSERT INTO game_activity (date_str, merchant, game_id, game_name, data_type, daily_unique_users, is_matched, match_type)
-- VALUES ('20251031', '1760338096', '1698217747804', '1698217747804', 'game_daily', 85, 0, 'game_id_not_found');

-- 3. 插入游戏活跃数据（周数据）
-- INSERT INTO game_activity (month_str, period_range, merchant, game_id, game_name, data_type, weekly_unique_users, is_matched, match_type)
-- VALUES ('202511', '20251027-20251102', '1760338096', '1698217747804', '1698217747804', 'game_weekly', 1, 0, 'game_id_not_found');

-- 4. 插入汇总数据
-- INSERT INTO game_activity_summary (date, game_name, bet_users, data_type, period_range)
-- VALUES ('合计', '1698217747804', 1, 'weekly', '20251027-20251102')
-- ON DUPLICATE KEY UPDATE bet_users = VALUES(bet_users), updated_at = CURRENT_TIMESTAMP;

-- 5. 查询某日期的所有游戏数据
-- SELECT date, game_name, bet_users 
-- FROM game_activity_summary 
-- WHERE date = '20251031' 
-- ORDER BY game_name;

-- 6. 查询某个游戏的汇总数据
-- SELECT date, bet_users 
-- FROM game_activity_summary 
-- WHERE game_name = 'Bank Heist' 
-- ORDER BY date;

-- 7. 查询未匹配的游戏ID
-- SELECT DISTINCT game_id, COUNT(*) as count 
-- FROM game_activity 
-- WHERE is_matched = 0 
-- GROUP BY game_id 
-- ORDER BY count DESC;

-- ============================================
-- 数据迁移建议
-- ============================================
-- 1. 如果已有历史数据，可以先创建表结构
-- 2. 使用批量插入（INSERT ... ON DUPLICATE KEY UPDATE）避免重复
-- 3. 定期清理旧数据（根据业务需求设置保留期限）
-- 4. 考虑分区表（如果数据量很大，可以按日期分区）

