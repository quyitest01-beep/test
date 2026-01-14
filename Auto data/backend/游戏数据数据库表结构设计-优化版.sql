-- ============================================
-- 游戏数据数据库表结构设计（优化版）
-- 用途：生成数据报告、日常回复客户数据问题
-- 数据范围：仅存储GMP/popular厂商游戏数据
-- ============================================

-- ============================================
-- 一、营收数据表
-- ============================================

-- 1. 营收数据表（revenue_data）
-- 功能：存储按商户、游戏、币种的营收数据
-- 字段：商户名、游戏名、币种、总投注、总派奖、总局数
CREATE TABLE IF NOT EXISTS `revenue_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` DATE NOT NULL COMMENT '日期',
  `merchant_name` VARCHAR(200) NOT NULL COMMENT '商户名',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名',
  `currency` VARCHAR(10) NOT NULL COMMENT '币种（如：USD, MXN, BRL等）',
  `total_bet` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000 COMMENT '总投注（USD）',
  `total_payout` DECIMAL(20, 4) NOT NULL DEFAULT 0.0000 COMMENT '总派奖（USD）',
  `total_rounds` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总局数',
  `total_ggr` DECIMAL(20, 4) GENERATED ALWAYS AS (`total_bet` - `total_payout`) STORED COMMENT '总GGR（总投注-总派奖，计算字段）',
  `rtp` DECIMAL(10, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN `total_bet` > 0 THEN (`total_payout` / `total_bet`) * 100 
      ELSE 0 
    END
  ) STORED COMMENT 'RTP（Return to Player，计算字段）',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_merchant_name` (`merchant_name`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_currency` (`currency`),
  KEY `idx_provider` (`provider`),
  KEY `idx_date_merchant` (`date`, `merchant_name`),
  KEY `idx_date_game` (`date`, `game_name`),
  KEY `idx_date_currency` (`date`, `currency`),
  -- 唯一索引：防止重复数据
  UNIQUE KEY `uk_date_merchant_game_currency` (`date`, `merchant_name`, `game_name`, `currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营收数据表';

-- ============================================
-- 二、用户数据表
-- ============================================

-- 2. 游戏用户数据表（game_user_data）
-- 功能：存储按游戏、日期的投注用户数
-- 字段：游戏名、日期、投注用户数
-- 说明：date 可以为 NULL，当为 NULL 时表示汇总数据，period_range 存储周期范围
CREATE TABLE IF NOT EXISTS `game_user_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` DATE DEFAULT NULL COMMENT '日期（NULL表示汇总数据）',
  `period_range` VARCHAR(50) DEFAULT NULL COMMENT '周期范围（汇总数据使用，格式：YYYYMMDD-YYYYMMDD 或 YYYYMM）',
  `data_type` ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily' COMMENT '数据类型（daily=日数据，weekly=周汇总，monthly=月汇总）',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名',
  `bet_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '投注用户数',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_period_range` (`period_range`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_provider` (`provider`),
  KEY `idx_date_game` (`date`, `game_name`),
  KEY `idx_period_game` (`period_range`, `game_name`),
  -- 唯一索引：防止重复数据
  -- 日数据：date + game_name
  -- 汇总数据：period_range + game_name + data_type
  UNIQUE KEY `uk_date_game` (`date`, `game_name`, `data_type`),
  UNIQUE KEY `uk_period_game_type` (`period_range`, `game_name`, `data_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏用户数据表';

-- 3. 商户用户数据表（merchant_user_data）
-- 功能：存储按商户、日期的投注用户数
-- 字段：商户名、日期、投注用户数
-- 说明：date 可以为 NULL，当为 NULL 时表示汇总数据，period_range 存储周期范围
CREATE TABLE IF NOT EXISTS `merchant_user_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` DATE DEFAULT NULL COMMENT '日期（NULL表示汇总数据）',
  `period_range` VARCHAR(50) DEFAULT NULL COMMENT '周期范围（汇总数据使用，格式：YYYYMMDD-YYYYMMDD 或 YYYYMM）',
  `data_type` ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily' COMMENT '数据类型（daily=日数据，weekly=周汇总，monthly=月汇总）',
  `merchant_name` VARCHAR(200) NOT NULL COMMENT '商户名',
  `bet_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '投注用户数',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_period_range` (`period_range`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_merchant_name` (`merchant_name`),
  KEY `idx_provider` (`provider`),
  KEY `idx_date_merchant` (`date`, `merchant_name`),
  KEY `idx_period_merchant` (`period_range`, `merchant_name`),
  -- 唯一索引：防止重复数据
  -- 日数据：date + merchant_name
  -- 汇总数据：period_range + merchant_name + data_type
  UNIQUE KEY `uk_date_merchant` (`date`, `merchant_name`, `data_type`),
  UNIQUE KEY `uk_period_merchant_type` (`period_range`, `merchant_name`, `data_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户用户数据表';

-- ============================================
-- 三、留存数据表
-- ============================================

-- 4. 游戏留存数据表（game_retention_data）
-- 功能：存储按游戏、日期的留存数据
-- 字段：游戏名、日期、当天用户数、次日用户数、3日用户数、7日用户数、14日用户数、30日用户数
CREATE TABLE IF NOT EXISTS `game_retention_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` DATE NOT NULL COMMENT '日期',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名',
  `merchant_name` VARCHAR(200) DEFAULT NULL COMMENT '商户名（可选，用于区分不同商户的游戏数据）',
  `daily_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当天用户数',
  `d1_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '次日用户数（D1留存）',
  `d3_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '3日用户数（D3留存）',
  `d7_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '7日用户数（D7留存）',
  `d14_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '14日用户数（D14留存）',
  `d30_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '30日用户数（D30留存）',
  `d1_retention_rate` DECIMAL(10, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN `daily_users` > 0 THEN (`d1_users` / `daily_users`) * 100 
      ELSE 0 
    END
  ) STORED COMMENT 'D1留存率（%，计算字段）',
  `d7_retention_rate` DECIMAL(10, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN `daily_users` > 0 THEN (`d7_users` / `daily_users`) * 100 
      ELSE 0 
    END
  ) STORED COMMENT 'D7留存率（%，计算字段）',
  `user_type` ENUM('new_user', 'active_user') DEFAULT 'new_user' COMMENT '用户类型（新用户/活跃用户）',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_game_name` (`game_name`),
  KEY `idx_merchant_name` (`merchant_name`),
  KEY `idx_user_type` (`user_type`),
  KEY `idx_provider` (`provider`),
  KEY `idx_date_game` (`date`, `game_name`),
  KEY `idx_date_game_type` (`date`, `game_name`, `user_type`),
  KEY `idx_daily_users` (`daily_users`),
  -- 唯一索引：防止重复数据
  UNIQUE KEY `uk_date_game_merchant_type` (`date`, `game_name`, `merchant_name`, `user_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏留存数据表';

-- 5. 商户留存数据表（merchant_retention_data）
-- 功能：存储按商户、日期的留存数据
-- 字段：商户名、日期、当天用户数、次日用户数、3日用户数、7日用户数、14日用户数、30日用户数
CREATE TABLE IF NOT EXISTS `merchant_retention_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `date` DATE NOT NULL COMMENT '日期',
  `merchant_name` VARCHAR(200) NOT NULL COMMENT '商户名',
  `daily_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当天用户数',
  `d1_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '次日用户数（D1留存）',
  `d3_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '3日用户数（D3留存）',
  `d7_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '7日用户数（D7留存）',
  `d14_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '14日用户数（D14留存）',
  `d30_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '30日用户数（D30留存）',
  `d1_retention_rate` DECIMAL(10, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN `daily_users` > 0 THEN (`d1_users` / `daily_users`) * 100 
      ELSE 0 
    END
  ) STORED COMMENT 'D1留存率（%，计算字段）',
  `d7_retention_rate` DECIMAL(10, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN `daily_users` > 0 THEN (`d7_users` / `daily_users`) * 100 
      ELSE 0 
    END
  ) STORED COMMENT 'D7留存率（%，计算字段）',
  `user_type` ENUM('new_user', 'active_user') DEFAULT 'new_user' COMMENT '用户类型（新用户/活跃用户）',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_merchant_name` (`merchant_name`),
  KEY `idx_user_type` (`user_type`),
  KEY `idx_provider` (`provider`),
  KEY `idx_date_merchant` (`date`, `merchant_name`),
  KEY `idx_date_merchant_type` (`date`, `merchant_name`, `user_type`),
  KEY `idx_daily_users` (`daily_users`),
  -- 唯一索引：防止重复数据
  UNIQUE KEY `uk_date_merchant_type` (`date`, `merchant_name`, `user_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户留存数据表';

-- ============================================
-- 四、辅助表（可选）
-- ============================================

-- 6. 游戏信息表（game_info）
-- 功能：存储游戏基本信息，便于管理和查询
CREATE TABLE IF NOT EXISTS `game_info` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `game_id` VARCHAR(50) DEFAULT NULL COMMENT '游戏ID',
  `game_name` VARCHAR(200) NOT NULL COMMENT '游戏名称',
  `game_code` VARCHAR(100) DEFAULT NULL COMMENT '游戏代码',
  `provider` VARCHAR(50) DEFAULT NULL COMMENT '厂商（GMP/popular）',
  `status` TINYINT(1) DEFAULT 1 COMMENT '状态（1=启用，0=禁用）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_game_name` (`game_name`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_game_code` (`game_code`),
  KEY `idx_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏信息表';

-- 7. 商户信息表（merchant_info）
-- 功能：存储商户基本信息，便于管理和查询
CREATE TABLE IF NOT EXISTS `merchant_info` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `merchant_id` VARCHAR(50) DEFAULT NULL COMMENT '商户ID',
  `merchant_name` VARCHAR(200) NOT NULL COMMENT '商户名称',
  `status` TINYINT(1) DEFAULT 1 COMMENT '状态（1=启用，0=禁用）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchant_name` (`merchant_name`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户信息表';

-- ============================================
-- 五、数据插入示例
-- ============================================

-- 1. 插入营收数据
-- INSERT INTO revenue_data (date, merchant_name, game_name, currency, total_bet, total_payout, total_rounds, provider)
-- VALUES ('2025-10-31', 'Betfarms', 'Bank Heist', 'USD', 121038.3167, 114553.5091, 575922, 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   total_bet = VALUES(total_bet),
--   total_payout = VALUES(total_payout),
--   total_rounds = VALUES(total_rounds),
--   updated_at = CURRENT_TIMESTAMP;

-- 2. 插入游戏用户数据（日数据）
-- INSERT INTO game_user_data (date, game_name, bet_users, data_type, provider)
-- VALUES ('2025-10-31', 'Bank Heist', 1726, 'daily', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   bet_users = VALUES(bet_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 2.1 插入游戏用户数据（周汇总数据）
-- INSERT INTO game_user_data (date, period_range, game_name, bet_users, data_type, provider)
-- VALUES (NULL, '20251027-20251102', 'Bank Heist', 1726, 'weekly', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   bet_users = VALUES(bet_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 2.2 插入游戏用户数据（月汇总数据）
-- INSERT INTO game_user_data (date, period_range, game_name, bet_users, data_type, provider)
-- VALUES (NULL, '202511', 'Bank Heist', 5000, 'monthly', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   bet_users = VALUES(bet_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 3. 插入商户用户数据（日数据）
-- INSERT INTO merchant_user_data (date, merchant_name, bet_users, data_type, provider)
-- VALUES ('2025-10-31', 'Betfarms', 68115, 'daily', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   bet_users = VALUES(bet_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 3.1 插入商户用户数据（周汇总数据）
-- INSERT INTO merchant_user_data (date, period_range, merchant_name, bet_users, data_type, provider)
-- VALUES (NULL, '20251027-20251102', 'Betfarms', 68115, 'weekly', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   bet_users = VALUES(bet_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 4. 插入游戏留存数据（新用户）
-- INSERT INTO game_retention_data (date, game_name, merchant_name, daily_users, d1_users, d3_users, d7_users, d14_users, d30_users, user_type, provider)
-- VALUES ('2025-10-31', 'Super Ace', 'Mxlobo(MXN)', 191, 40, 0, 0, 0, 0, 'new_user', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   daily_users = VALUES(daily_users),
--   d1_users = VALUES(d1_users),
--   d3_users = VALUES(d3_users),
--   d7_users = VALUES(d7_users),
--   d14_users = VALUES(d14_users),
--   d30_users = VALUES(d30_users),
--   updated_at = CURRENT_TIMESTAMP;

-- 5. 插入商户留存数据（活跃用户）
-- INSERT INTO merchant_retention_data (date, merchant_name, daily_users, d1_users, d3_users, d7_users, d14_users, d30_users, user_type, provider)
-- VALUES ('2025-10-31', 'betfiery', 2732, 1445, 0, 0, 0, 0, 'active_user', 'GMP')
-- ON DUPLICATE KEY UPDATE 
--   daily_users = VALUES(daily_users),
--   d1_users = VALUES(d1_users),
--   d3_users = VALUES(d3_users),
--   d7_users = VALUES(d7_users),
--   d14_users = VALUES(d14_users),
--   d30_users = VALUES(d30_users),
--   updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 六、常用查询示例
-- ============================================

-- 1. 查询某日期所有游戏的营收数据
-- SELECT date, merchant_name, game_name, currency, total_bet, total_payout, total_ggr, total_rounds, rtp
-- FROM revenue_data
-- WHERE date = '2025-10-31'
-- ORDER BY total_ggr DESC;

-- 2. 查询某个游戏在某个日期范围的营收趋势
-- SELECT date, SUM(total_bet) as total_bet, SUM(total_payout) as total_payout, SUM(total_ggr) as total_ggr
-- FROM revenue_data
-- WHERE game_name = 'Bank Heist'
--   AND date BETWEEN '2025-10-01' AND '2025-10-31'
-- GROUP BY date
-- ORDER BY date;

-- 3. 查询某个商户的投注用户数趋势（日数据）
-- SELECT date, bet_users
-- FROM merchant_user_data
-- WHERE merchant_name = 'Betfarms'
--   AND date IS NOT NULL
--   AND data_type = 'daily'
--   AND date BETWEEN '2025-10-01' AND '2025-10-31'
-- ORDER BY date;

-- 3.1 查询某个商户的汇总数据
-- SELECT period_range, data_type, bet_users
-- FROM merchant_user_data
-- WHERE merchant_name = 'Betfarms'
--   AND date IS NULL
--   AND data_type IN ('weekly', 'monthly')
-- ORDER BY period_range;

-- 4. 查询某个游戏的留存数据（新用户）
-- SELECT date, daily_users, d1_users, d7_users, d1_retention_rate, d7_retention_rate
-- FROM game_retention_data
-- WHERE game_name = 'Super Ace'
--   AND user_type = 'new_user'
--   AND date BETWEEN '2025-10-01' AND '2025-10-31'
-- ORDER BY date;

-- 5. 查询Top 10游戏（按GGR）
-- SELECT game_name, SUM(total_ggr) as total_ggr, SUM(total_bet) as total_bet, SUM(total_rounds) as total_rounds
-- FROM revenue_data
-- WHERE date BETWEEN '2025-10-01' AND '2025-10-31'
-- GROUP BY game_name
-- ORDER BY total_ggr DESC
-- LIMIT 10;

-- 6. 查询Top 10商户（按GGR）
-- SELECT merchant_name, SUM(total_ggr) as total_ggr, SUM(total_bet) as total_bet
-- FROM revenue_data
-- WHERE date BETWEEN '2025-10-01' AND '2025-10-31'
-- GROUP BY merchant_name
-- ORDER BY total_ggr DESC
-- LIMIT 10;

-- 7. 查询留存率Top 20游戏（D1留存）
-- SELECT game_name, AVG(d1_retention_rate) as avg_d1_retention
-- FROM game_retention_data
-- WHERE user_type = 'new_user'
--   AND daily_users >= 50
--   AND date BETWEEN '2025-10-01' AND '2025-10-31'
-- GROUP BY game_name
-- ORDER BY avg_d1_retention DESC
-- LIMIT 20;

