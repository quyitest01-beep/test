-- 智能数据查询系统数据库初始化脚本
-- 创建时间: 2024-01-10
-- 描述: 创建基础系统配置表

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS athena_query DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE athena_query;

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '配置类型',
    category VARCHAR(50) DEFAULT 'general' COMMENT '配置分类',
    description TEXT COMMENT '配置描述',
    is_public BOOLEAN DEFAULT FALSE COMMENT '是否公开配置',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_config_key (config_key),
    INDEX idx_category (category),
    INDEX idx_is_public (is_public)
) COMMENT='系统配置表';

-- 查询历史表（可选）
CREATE TABLE IF NOT EXISTS query_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_text TEXT NOT NULL COMMENT '查询描述',
    generated_sql TEXT COMMENT '生成的SQL',
    execution_time INT COMMENT '执行时间(毫秒)',
    record_count INT COMMENT '结果记录数',
    status ENUM('success', 'error', 'cancelled') DEFAULT 'success' COMMENT '执行状态',
    error_message TEXT COMMENT '错误信息',
    ip_address VARCHAR(45) COMMENT 'IP地址',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_ip_address (ip_address)
) COMMENT='查询历史表';

-- 插入默认系统配置
INSERT INTO system_configs (config_key, config_value, config_type, category, description, is_public) VALUES
('system.name', 'Athena智能数据查询系统', 'string', 'general', '系统名称', TRUE),
('system.version', '1.0.0', 'string', 'general', '系统版本', TRUE),
('query.max_execution_time', '300', 'number', 'query', '查询最大执行时间(秒)', FALSE),
('query.max_result_rows', '100000', 'number', 'query', '查询结果最大行数', FALSE),
('export.max_file_size', '104857600', 'number', 'export', '导出文件最大大小(字节)', FALSE),
('export.cleanup_days', '7', 'number', 'export', '导出文件保留天数', FALSE);

COMMIT;