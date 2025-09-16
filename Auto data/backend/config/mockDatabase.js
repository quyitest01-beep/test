// 内存数据库模拟器
// 用于开发环境，当MySQL不可用时使用

const logger = require('../utils/logger');

// 模拟数据存储
const mockData = {
  users: [
    {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      password_hash: '$2b$12$8CY4ySoF.wPaLzkztEXh0e2rOtvW5t7bzQyDB8dTMnAGb36otq46S', // 密码: admin123
      full_name: '系统管理员',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      username: 'user1',
      email: 'user1@example.com',
      password_hash: '$2b$12$8CY4ySoF.wPaLzkztEXh0e2rOtvW5t7bzQyDB8dTMnAGb36otq46S', // 密码: admin123
      full_name: '普通用户',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  roles: [
    {
      id: 1,
      name: 'admin',
      display_name: '系统管理员',
      description: '拥有所有权限的系统管理员',
      level: 100,
      status: 'active',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'user',
      display_name: '普通用户',
      description: '普通用户角色',
      level: 10,
      status: 'active',
      created_at: new Date().toISOString()
    }
  ],
  user_roles: [
    { user_id: 1, role_id: 1 },
    { user_id: 2, role_id: 2 }
  ],
  audit_logs: [
    {
      id: 1,
      user_id: 1,
      action: 'login',
      resource_type: 'auth',
      resource_id: null,
      details: { ip: '127.0.0.1', user_agent: 'Mock Browser' },
      created_at: new Date().toISOString()
    }
  ],
  sessions: [],
  user_sessions: []
};

// 模拟数据库操作
class MockDatabase {
  async execute(sql, params = []) {
    const sqlLower = sql.toLowerCase().trim();
    
    // 记录查询
    logger.info('Mock DB Query:', { sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''), params: params.slice(0, 5) });
    
    // 调试：输出所有包含user_sessions的查询
    if (sqlLower.includes('user_sessions')) {
      logger.info('=== 发现user_sessions查询 ===');
      logger.info('完整SQL: ' + sql);
      logger.info('是否SELECT: ' + sqlLower.includes('select'));
      logger.info('是否包含token_hash: ' + sqlLower.includes('token_hash'));
    }
    
    // 简单的SQL解析和模拟响应
    
    if (sqlLower.includes('select') && sqlLower.includes('users')) {
      if (sqlLower.includes('where username')) {
        const username = params[0];
        const user = mockData.users.find(u => u.username === username);
        return [user ? [user] : [], []];
      }
      if (sqlLower.includes('where email')) {
        const email = params[0];
        const user = mockData.users.find(u => u.email === email);
        return [user ? [user] : [], []];
      }
      return [mockData.users, []];
    }
    
    if (sqlLower.includes('select') && sqlLower.includes('roles')) {
      return [mockData.roles, []];
    }
    
    if (sqlLower.includes('select') && sqlLower.includes('audit_logs')) {
      return [mockData.audit_logs, []];
    }
    
    if (sqlLower.includes('insert into users')) {
      const newUser = {
        id: mockData.users.length + 1,
        username: params[0],
        email: params[1],
        password_hash: params[2],
        full_name: params[3] || '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockData.users.push(newUser);
      return [{ insertId: newUser.id }, []];
    }
    
    if (sqlLower.includes('insert into audit_logs')) {
      const newLog = {
        id: mockData.audit_logs.length + 1,
        user_id: params[0],
        action: params[1],
        resource_type: params[2],
        resource_id: params[3],
        details: params[4] ? JSON.parse(params[4]) : {},
        created_at: new Date().toISOString()
      };
      mockData.audit_logs.push(newLog);
      return [{ insertId: newLog.id }, []];
    }
    
    // 处理user_sessions查询 - 包括JOIN查询
    if (sqlLower.includes('select') && sqlLower.includes('user_sessions')) {
      logger.info('=== 处理user_sessions查询 ===');
      logger.info('SQL:', sql);
      logger.info('查询参数:', params);
      logger.info('SQL包含token_hash:', sqlLower.includes('token_hash'));
      logger.info('SQL包含join:', sqlLower.includes('join'));
      
      // 暂时处理所有user_sessions查询
      if (sqlLower.includes('token_hash')) {
        const tokenHash = params[0];
        logger.info('查找会话，token_hash:', tokenHash);
        logger.info('现有会话数量:', mockData.user_sessions.length);
        logger.info('现有会话:', mockData.user_sessions);
        
        const session = mockData.user_sessions.find(s => {
          logger.info('比较会话:', { stored: s.token_hash, query: tokenHash, match: s.token_hash === tokenHash });
          return s.token_hash === tokenHash && 
                 s.is_active && 
                 new Date(s.expires_at) > new Date();
        });
        
        logger.info('找到的会话:', session);
        
        if (session) {
          // 查找对应的用户信息
          const user = mockData.users.find(u => u.id === session.user_id);
          logger.info('找到的用户:', user);
          
          if (user) {
            const result = {
              ...session,
              username: user.username,
              email: user.email,
              user_status: user.status
            };
            logger.info('返回的结果:', result);
            return [[result], []];
          }
        }
        
        logger.info('未找到有效会话');
        return [[], []];
      }
      return [mockData.user_sessions, []];
    }
    
    // 处理user_sessions插入
    if (sqlLower.includes('insert into user_sessions')) {
      console.log('插入会话，参数:', params);
      const newSession = {
        id: params[0], // sessionId
        user_id: params[1],
        token_hash: params[2],
        refresh_token_hash: params[3],
        device_info: params[4],
        ip_address: params[5],
        user_agent: params[6],
        is_active: true,
        expires_at: params[7],
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      };
      console.log('新会话对象:', newSession);
      mockData.user_sessions.push(newSession);
      console.log('所有会话:', mockData.user_sessions);
      return [{ insertId: newSession.id }, []];
    }
    
    // 处理user_sessions更新
    if (sqlLower.includes('update user_sessions')) {
      if (sqlLower.includes('last_activity_at')) {
        const sessionId = params[0];
        const session = mockData.user_sessions.find(s => s.id === sessionId);
        if (session) {
          session.last_activity_at = new Date().toISOString();
        }
        return [{ affectedRows: session ? 1 : 0 }, []];
      }
      if (sqlLower.includes('is_active')) {
        const sessionId = params[0];
        const session = mockData.user_sessions.find(s => s.id === sessionId);
        if (session) {
          session.is_active = false;
        }
        return [{ affectedRows: session ? 1 : 0 }, []];
      }
    }
    
    // 处理角色权限查询
    if (sqlLower.includes('select') && sqlLower.includes('user_roles')) {
      const userId = params[0];
      const userRoles = mockData.user_roles.filter(ur => ur.user_id === userId);
      const roles = userRoles.map(ur => {
        const role = mockData.roles.find(r => r.id === ur.role_id);
        return role;
      }).filter(Boolean);
      return [roles, []];
    }
    
    // 默认返回空结果
    return [[], []];
  }
  
  async getConnection() {
    return {
      ping: async () => true,
      release: () => {}
    };
  }
}

const mockDb = new MockDatabase();

// 测试连接
const testConnection = async () => {
  try {
    logger.info('✅ 使用模拟数据库连接成功');
    return true;
  } catch (error) {
    logger.error('❌ 模拟数据库连接失败:', error.message);
    return false;
  }
};

module.exports = {
  execute: mockDb.execute.bind(mockDb),
  getConnection: mockDb.getConnection.bind(mockDb),
  testConnection
};