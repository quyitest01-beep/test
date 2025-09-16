# 数据库集成方案设计

## 当前架构分析

### 现有组件
1. **前端系统**：React + Vite，包含查询页面和结果展示
2. **后端服务**：Node.js + Express，提供API接口
3. **SQL生成器**：基于模板匹配的SQL生成逻辑
4. **Athena服务**：AWS Athena集成（当前主要用于云端查询）
5. **数据库配置**：MySQL连接池 + 模拟数据库fallback

### 改造需求
- 从模拟数据转向真实数据库查询
- 支持多种数据库类型（MySQL、PostgreSQL、SQLite等）
- 实现Python代码生成而非仅SQL生成
- 增强大数据处理和自动拆分能力

## 新架构设计

### 1. 查询流程重构
```
用户输入自然语言 → 意图分析 → Python代码生成 → 数据库执行 → 结果处理 → 前端展示
```

### 2. 核心组件设计

#### A. Python代码生成器 (PythonCodeGenerator)
- **功能**：将自然语言转换为Python数据库查询代码
- **支持库**：pandas, sqlalchemy, pymysql, psycopg2等
- **输出**：完整的Python脚本，包含连接、查询、处理逻辑

#### B. 数据库连接器 (DatabaseConnector)
- **支持类型**：MySQL, PostgreSQL, SQLite, SQL Server
- **连接池管理**：自动连接池配置和管理
- **安全性**：参数化查询，防SQL注入

#### C. 查询执行器 (QueryExecutor)
- **Python环境**：沙箱化Python执行环境
- **资源限制**：内存、时间、CPU使用限制
- **错误处理**：完善的异常捕获和错误报告

#### D. 结果处理器 (ResultProcessor)
- **数据格式化**：JSON、CSV、Excel格式转换
- **大数据拆分**：自动检测数据量，智能拆分策略
- **分页处理**：支持流式处理和分页查询

### 3. 技术实现方案

#### A. Python代码生成模板
```python
# 基础模板结构
import pandas as pd
from sqlalchemy import create_engine
import logging

def execute_query():
    try:
        # 数据库连接
        engine = create_engine('{connection_string}')
        
        # 执行查询
        query = """
        {generated_sql}
        """
        
        # 数据处理
        df = pd.read_sql(query, engine)
        
        # 结果处理
        {data_processing_code}
        
        return {
            'success': True,
            'data': df.to_dict('records'),
            'row_count': len(df),
            'columns': df.columns.tolist()
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'data': []
        }
```

#### B. 数据库配置管理
```javascript
// 数据库类型配置
const dbConfigs = {
  mysql: {
    driver: 'mysql+pymysql',
    port: 3306,
    charset: 'utf8mb4'
  },
  postgresql: {
    driver: 'postgresql+psycopg2',
    port: 5432,
    charset: 'utf8'
  },
  sqlite: {
    driver: 'sqlite',
    file_based: true
  }
}
```

#### C. 大数据处理策略
1. **阈值检测**：
   - < 10万条：直接返回
   - 10万-100万条：分页处理
   - > 100万条：自动拆分

2. **拆分策略**：
   - 时间范围拆分（按日期、月份）
   - ID范围拆分（按主键范围）
   - 哈希分区拆分（按哈希值）

3. **导出优化**：
   - 多文件导出（超大数据集）
   - 多工作表导出（中等数据集）
   - 压缩导出（减少文件大小）

### 4. API接口设计

#### A. 新增接口
```
POST /api/query/generate-python  # 生成Python代码
POST /api/query/execute-python   # 执行Python查询
GET  /api/query/status/:id       # 查询执行状态
POST /api/query/split-large      # 大数据拆分处理
```

#### B. 请求/响应格式
```json
// 生成Python代码请求
{
  "queryText": "查询2023年销售额最高的产品",
  "database": {
    "type": "mysql",
    "host": "localhost",
    "database": "sales_db"
  },
  "options": {
    "limit": 1000,
    "optimize": true
  }
}

// 响应
{
  "success": true,
  "data": {
    "python_code": "...",
    "estimated_time": 5000,
    "estimated_rows": 1500,
    "requires_split": false
  }
}
```

### 5. 安全性考虑

1. **代码沙箱**：限制Python执行环境，禁止文件系统访问
2. **SQL注入防护**：使用参数化查询
3. **资源限制**：限制查询时间、内存使用
4. **权限控制**：数据库连接权限最小化
5. **审计日志**：记录所有查询操作

### 6. 性能优化

1. **查询优化**：
   - 自动添加LIMIT子句
   - 索引建议
   - 查询计划分析

2. **缓存策略**：
   - 查询结果缓存
   - 代码生成缓存
   - 数据库连接池

3. **异步处理**：
   - 长时间查询异步执行
   - 进度实时反馈
   - 结果推送通知

## 实施计划

### 阶段1：核心组件开发
1. Python代码生成器实现
2. 数据库连接器重构
3. 查询执行器开发

### 阶段2：大数据处理
1. 结果处理器实现
2. 自动拆分逻辑
3. 导出功能增强

### 阶段3：前端集成
1. API接口对接
2. 用户界面优化
3. 实时状态展示

### 阶段4：测试与优化
1. 性能测试
2. 安全测试
3. 用户体验优化

## 技术栈选择

- **后端**：Node.js + Express（保持现有）
- **Python执行**：child_process + 沙箱环境
- **数据库**：支持多种类型，统一接口
- **缓存**：Redis（可选）
- **队列**：Bull Queue（异步任务）
- **监控**：Winston + 自定义监控

## 预期效果

1. **用户体验**：自然语言输入，自动生成查询代码
2. **性能提升**：智能拆分，支持超大数据集
3. **扩展性**：支持多种数据库，易于扩展
4. **安全性**：沙箱执行，权限控制
5. **可维护性**：模块化设计，清晰的接口