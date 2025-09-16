#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 用于创建数据库表结构和初始数据
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`)
};

/**
 * 创建数据库连接
 */
async function createConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });
    
    logger.info('数据库连接创建成功');
    return connection;
  } catch (error) {
    logger.error(`数据库连接失败: ${error.message}`);
    throw error;
  }
}

/**
 * 执行SQL文件
 */
async function executeSQLFile(connection, filePath) {
  try {
    const sqlContent = await fs.readFile(filePath, 'utf8');
    logger.info(`开始执行SQL文件: ${filePath}`);
    
    // 分割SQL语句（以分号分隔）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
      }
    }
    
    logger.success(`SQL文件执行完成: ${filePath}`);
  } catch (error) {
    logger.error(`执行SQL文件失败 ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * 创建默认管理员用户
 */
async function createDefaultAdmin(connection) {
  try {
    logger.info('开始创建默认管理员用户');
    
    // 检查是否已存在管理员用户
    const [existingUsers] = await connection.execute(
      'SELECT COUNT(*) as count FROM athena_admin.users WHERE username = ?',
      ['admin']
    );
    
    if (existingUsers[0].count > 0) {
      logger.warn('管理员用户已存在，跳过创建');
      return;
    }
    
    // 生成默认密码哈希
    const defaultPassword = 'admin123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    
    // 创建管理员用户
    const [userResult] = await connection.execute(
      `INSERT INTO athena_admin.users 
       (username, email, password_hash, full_name, status, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@athena.local', passwordHash, '系统管理员', 'active', true]
    );
    
    const adminUserId = userResult.insertId;
    
    // 为管理员分配超级管理员角色
    const [roleResult] = await connection.execute(
      'SELECT id FROM athena_admin.roles WHERE name = ?',
      ['super_admin']
    );
    
    if (roleResult.length > 0) {
      await connection.execute(
        'INSERT INTO athena_admin.user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
        [adminUserId, roleResult[0].id, adminUserId]
      );
    }
    
    logger.success(`默认管理员用户创建成功`);
    logger.info(`用户名: admin`);
    logger.info(`密码: ${defaultPassword}`);
    logger.warn('请在首次登录后立即修改默认密码！');
    
  } catch (error) {
    logger.error(`创建默认管理员用户失败: ${error.message}`);
    throw error;
  }
}

/**
 * 验证数据库结构
 */
async function validateDatabase(connection) {
  try {
    logger.info('开始验证数据库结构');
    
    const requiredTables = [
      'users', 'roles', 'permissions', 'user_roles', 
      'role_permissions', 'user_sessions', 'audit_logs', 'system_configs'
    ];
    
    for (const table of requiredTables) {
      const [result] = await connection.execute(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        ['athena_admin', table]
      );
      
      if (result[0].count === 0) {
        throw new Error(`表 ${table} 不存在`);
      }
    }
    
    // 验证权限数据
    const [permissionCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM athena_admin.permissions'
    );
    
    if (permissionCount[0].count === 0) {
      throw new Error('权限数据为空');
    }
    
    // 验证角色数据
    const [roleCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM athena_admin.roles'
    );
    
    if (roleCount[0].count === 0) {
      throw new Error('角色数据为空');
    }
    
    logger.success('数据库结构验证通过');
    logger.info(`权限数量: ${permissionCount[0].count}`);
    logger.info(`角色数量: ${roleCount[0].count}`);
    
  } catch (error) {
    logger.error(`数据库结构验证失败: ${error.message}`);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  let connection;
  
  try {
    logger.info('=== Athena 数据库初始化开始 ===');
    
    // 检查环境变量
    if (!process.env.DB_PASSWORD) {
      throw new Error('请设置 DB_PASSWORD 环境变量');
    }
    
    // 创建数据库连接
    connection = await createConnection();
    
    // 执行初始化SQL
    const sqlFilePath = path.join(__dirname, '../database/init.sql');
    await executeSQLFile(connection, sqlFilePath);
    
    // 创建默认管理员用户
    await createDefaultAdmin(connection);
    
    // 验证数据库结构
    await validateDatabase(connection);
    
    logger.success('=== 数据库初始化完成 ===');
    
  } catch (error) {
    logger.error(`数据库初始化失败: ${error.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      logger.info('数据库连接已关闭');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('初始化脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  createConnection,
  executeSQLFile,
  createDefaultAdmin,
  validateDatabase
};