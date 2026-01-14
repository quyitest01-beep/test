# AWS Athena 凭证获取完整指南

## 📋 需要获取的配置项

```bash
AWS_REGION=us-east-1                    # AWS 区域
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # 访问密钥 ID
AWS_SECRET_ACCESS_KEY=wJalrXUtn...      # 访问密钥密文
ATHENA_DATABASE=my_database             # Athena 数据库名
ATHENA_OUTPUT_LOCATION=s3://my-bucket/  # 查询结果存储位置
```

---

## 🚀 获取步骤

### 步骤 1: 获取 AWS 凭证（AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY）

#### 1.1 登录 AWS 控制台

访问：https://console.aws.amazon.com/

#### 1.2 进入 IAM 服务

1. 在顶部搜索框输入 `IAM`
2. 点击 **IAM** 服务

或直接访问：https://console.aws.amazon.com/iam/

#### 1.3 创建 IAM 用户（如果没有）

1. 在左侧菜单点击 **用户 (Users)**
2. 点击右上角 **添加用户 (Add users)**
3. 填写信息：
   - **用户名**: `athena-query-user`（可自定义）
   - **访问类型**: 勾选 ✓ **编程访问 (Programmatic access)**
4. 点击 **下一步: 权限**

#### 1.4 附加权限策略

**方法 A: 使用现有策略（快速，权限较大）**

在权限页面：
1. 选择 **直接附加现有策略**
2. 搜索并勾选以下策略：
   - ✓ `AmazonAthenaFullAccess` - Athena 完全访问
   - ✓ `AmazonS3FullAccess` - S3 完全访问（用于存储查询结果）
   - ✓ `AWSGlueConsoleFullAccess` - Glue 访问（用于数据目录）
3. 点击 **下一步**

**方法 B: 创建自定义策略（推荐，最小权限）**

1. 点击 **直接附加现有策略** 旁边的 **创建策略**
2. 选择 **JSON** 标签
3. 粘贴以下策略：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:StopQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:GetWorkGroup",
        "athena:ListWorkGroups",
        "athena:ListDataCatalogs",
        "athena:ListDatabases",
        "athena:GetDatabase",
        "athena:ListTableMetadata",
        "athena:GetTableMetadata"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::你的bucket名称/*",
        "arn:aws:s3:::你的bucket名称"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:GetPartitions",
        "glue:GetDatabases",
        "glue:GetTables"
      ],
      "Resource": "*"
    }
  ]
}
```

4. 点击 **下一步: 标签**（可跳过）
5. 点击 **下一步: 审核**
6. 策略名称: `AthenaQueryPolicy`
7. 点击 **创建策略**

#### 1.5 创建访问密钥

1. 用户创建完成后，会显示：
   ```
   访问密钥 ID (Access key ID): AKIAIOSFODNN7EXAMPLE
   私有访问密钥 (Secret access key): wJalrXUtnFEMI/K7MDENG/bPxRfiCY
   ```

2. **⚠️ 重要**: 
   - 立即复制保存这两个值！
   - 私有密钥只显示这一次，关闭后无法再查看
   - 建议下载 `.csv` 文件备份

3. 点击 **下载 .csv** 保存凭证

---

### 步骤 2: 获取 AWS_REGION（AWS 区域）

#### 2.1 查看当前区域

在 AWS 控制台右上角可以看到当前区域，例如：
- 美国东部（弗吉尼亚北部）→ `us-east-1`
- 美国西部（俄勒冈）→ `us-west-2`
- 亚太地区（新加坡）→ `ap-southeast-1`
- 亚太地区（东京）→ `ap-northeast-1`

#### 2.2 常用区域代码

| 区域名称 | 区域代码 | 位置 |
|---------|---------|------|
| 美国东部（弗吉尼亚北部） | `us-east-1` | 美国 |
| 美国西部（俄勒冈） | `us-west-2` | 美国 |
| 欧洲（爱尔兰） | `eu-west-1` | 欧洲 |
| 亚太地区（新加坡） | `ap-southeast-1` | 亚太 |
| 亚太地区（东京） | `ap-northeast-1` | 亚太 |
| 亚太地区（首尔） | `ap-northeast-2` | 亚太 |

**建议**：选择离你最近的区域以获得最佳性能

---

### 步骤 3: 获取 ATHENA_DATABASE（数据库名）

#### 3.1 查看现有数据库

1. 在 AWS 控制台搜索 `Athena`
2. 进入 Athena 服务
3. 在左侧 **Database** 下拉菜单可以看到所有数据库

或访问：https://console.aws.amazon.com/athena/

#### 3.2 如果没有数据库，创建一个

**方法 A: 使用 Athena 控制台**

1. 进入 Athena 控制台
2. 在查询编辑器中输入：
   ```sql
   CREATE DATABASE my_database;
   ```
3. 点击 **Run** 执行
4. 数据库名就是 `my_database`

**方法 B: 使用 AWS CLI**

```bash
aws athena start-query-execution \
  --query-string "CREATE DATABASE my_database" \
  --result-configuration "OutputLocation=s3://your-bucket/results/"
```

#### 3.3 如果使用现有数据库

直接使用现有的数据库名，例如：
- `default`
- `analytics_db`
- `production_db`

---

### 步骤 4: 配置 ATHENA_OUTPUT_LOCATION（S3 存储桶）

Athena 查询结果需要存储到 S3 存储桶。

#### 4.1 创建 S3 存储桶

1. 在 AWS 控制台搜索 `S3`
2. 点击 **创建存储桶 (Create bucket)**
3. 填写信息：
   - **存储桶名称**: `my-athena-query-results`（全球唯一，如果重复请换一个）
   - **AWS 区域**: 选择与 Athena 相同的区域
   - **阻止所有公共访问**: ✓ 勾选（保持私有）
4. 点击 **创建存储桶**

#### 4.2 获取存储桶 URL

存储桶创建后，URL 格式为：
```
s3://存储桶名称/路径/
```

示例：
```bash
# 基本格式
ATHENA_OUTPUT_LOCATION=s3://my-athena-query-results/

# 可以指定子目录
ATHENA_OUTPUT_LOCATION=s3://my-athena-query-results/query-results/

# 或按日期组织
ATHENA_OUTPUT_LOCATION=s3://my-athena-query-results/athena-results/
```

#### 4.3 配置 S3 生命周期（可选，建议）

自动清理旧的查询结果：

1. 进入你的 S3 存储桶
2. 点击 **管理 (Management)** 标签
3. 点击 **创建生命周期规则**
4. 配置：
   - **规则名称**: `Delete old query results`
   - **作用域**: `限制于特定前缀` → `query-results/`
   - **生命周期规则操作**: 
     - ✓ 使当前版本的对象过期
     - 过期天数: `7` 天（根据需求调整）
5. 点击 **创建规则**

---

## 📝 完整配置示例

### 示例 1: 美国东部区域

```bash
# AWS 区域
AWS_REGION=us-east-1

# AWS 凭证（从 IAM 用户获取）
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Athena 配置
ATHENA_DATABASE=production_db
ATHENA_OUTPUT_LOCATION=s3://my-athena-results/query-results/
ATHENA_WORKGROUP=primary
```

### 示例 2: 亚太区域（新加坡）

```bash
# AWS 区域
AWS_REGION=ap-southeast-1

# AWS 凭证
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Athena 配置
ATHENA_DATABASE=analytics_db
ATHENA_OUTPUT_LOCATION=s3://singapore-athena-results/
ATHENA_WORKGROUP=primary
```

---

## ✅ 验证配置

### 测试 1: 测试 AWS 凭证

```bash
# 使用 AWS CLI 测试（需要先安装 AWS CLI）
aws sts get-caller-identity \
  --region us-east-1 \
  --profile default
```

**成功输出**：
```json
{
  "UserId": "AIDACKCEVSQ6C2EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/athena-query-user"
}
```

### 测试 2: 测试 Athena 连接

使用我们提供的测试脚本：

```bash
cd backend
npm run test:athena
```

**成功输出**：
```
✓ 配置检查完成
✓ 查询已启动 (Query ID: abc-123-def)
✓ 查询执行成功
✓ 结果获取成功
✅ 所有测试通过！Athena 连接正常！
```

### 测试 3: 手动执行简单查询

1. 进入 Athena 控制台
2. 选择数据库（右上角下拉菜单）
3. 在查询编辑器输入：
   ```sql
   SELECT 1 as test_column, 'Hello Athena' as message;
   ```
4. 点击 **Run**
5. 应该看到查询结果

---

## 🔐 安全最佳实践

### 1. 凭证安全

✅ **应该做的**：
- 使用 IAM 用户而不是根账户
- 只授予必需的最小权限
- 定期轮换访问密钥（每 90 天）
- 将凭证保存在 `.env` 文件（不要提交到 Git）

❌ **不应该做的**：
- 使用根账户的访问密钥
- 授予过多权限（如 `AdministratorAccess`）
- 在代码中硬编码凭证
- 将凭证提交到 Git 仓库

### 2. .gitignore 配置

确保 `.env` 文件在 `.gitignore` 中：

```bash
# .gitignore
.env
.env.local
.env.production
*.pem
```

### 3. 监控访问

在 AWS CloudTrail 中监控 API 调用：
1. 进入 CloudTrail 服务
2. 查看事件历史
3. 筛选用户活动

---

## 🐛 常见问题

### Q1: 找不到访问密钥 ID

**A**: 访问密钥只在创建时显示一次

**解决方案**：
1. 删除旧的访问密钥
2. 创建新的访问密钥
3. 更新 `.env` 配置

```bash
# 在 IAM 用户页面
1. 选择用户
2. 点击"安全证书"标签
3. 在"访问密钥"部分
4. 点击"停用"或"删除"旧密钥
5. 点击"创建访问密钥"
```

### Q2: Access Denied 错误

**A**: 权限不足

**检查清单**：
- [ ] IAM 用户有 Athena 权限？
- [ ] IAM 用户有 S3 权限？
- [ ] IAM 用户有 Glue 权限？
- [ ] S3 存储桶在同一区域？

**解决方案**：
附加必需的权限策略（参见步骤 1.4）

### Q3: InvalidRequestException: Database not found

**A**: 数据库不存在或名称错误

**解决方案**：
```sql
-- 查看所有数据库
SHOW DATABASES;

-- 创建新数据库
CREATE DATABASE my_database;

-- 验证
SHOW DATABASES;
```

### Q4: S3 路径错误

**常见错误**：
```bash
# ❌ 错误
ATHENA_OUTPUT_LOCATION=https://s3.amazonaws.com/bucket-name/
ATHENA_OUTPUT_LOCATION=bucket-name/query-results/

# ✅ 正确
ATHENA_OUTPUT_LOCATION=s3://bucket-name/query-results/
```

**格式要求**：
- 必须以 `s3://` 开头
- 必须以 `/` 结尾
- 存储桶名称和区域要匹配

### Q5: 如何找回区域代码？

**方法 1**: 查看 S3 存储桶属性
1. 进入 S3 控制台
2. 选择存储桶
3. 点击"属性"
4. 查看"AWS 区域"

**方法 2**: 使用 AWS CLI
```bash
aws s3api get-bucket-location --bucket my-bucket-name
```

---

## 📊 配置获取流程图

```
┌─────────────────────┐
│ 1. 登录 AWS 控制台  │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 2. 进入 IAM 服务    │
│    创建用户         │
│    附加权限         │
│    创建访问密钥     │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 3. 获取凭证         │
│    AWS_ACCESS_KEY_ID│
│    AWS_SECRET_KEY   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 4. 选择 AWS 区域    │
│    AWS_REGION       │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 5. 进入 Athena      │
│    查看/创建数据库  │
│    ATHENA_DATABASE  │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 6. 创建 S3 存储桶   │
│    ATHENA_OUTPUT    │
│    _LOCATION        │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 7. 配置到 .env 文件 │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 8. 测试连接         │
└─────────────────────┘
```

---

## 🎓 快速配置命令

**完整的配置步骤（复制执行）**：

```bash
# 1. 创建 .env 文件
cd backend
cat > .env << 'EOF'
# AWS 配置
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=你的访问密钥ID
AWS_SECRET_ACCESS_KEY=你的访问密钥密文

# Athena 配置
ATHENA_DATABASE=你的数据库名
ATHENA_OUTPUT_LOCATION=s3://你的存储桶名称/query-results/
ATHENA_WORKGROUP=primary

# API 密钥
API_KEYS=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 其他配置
PORT=8000
MAX_QUERY_TIMEOUT=300000
MAX_RESULT_SIZE=1000000
EOF

# 2. 编辑 .env 填入真实值
nano .env

# 3. 安装依赖
npm install

# 4. 测试连接
npm run test:athena

# 5. 启动服务
npm start
```

---

## 📚 相关资源

- [AWS IAM 用户指南](https://docs.aws.amazon.com/IAM/latest/UserGuide/)
- [AWS Athena 文档](https://docs.aws.amazon.com/athena/)
- [AWS S3 文档](https://docs.aws.amazon.com/s3/)
- [AWS 区域列表](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/)

---

## ✅ 配置完成检查清单

- [ ] 已创建 IAM 用户
- [ ] 已附加必要的权限策略
- [ ] 已创建访问密钥并保存
- [ ] 已知道 AWS 区域代码
- [ ] 已有 Athena 数据库（或创建了新的）
- [ ] 已创建 S3 存储桶
- [ ] 已配置 `.env` 文件
- [ ] 已运行 `npm run test:athena` 测试通过
- [ ] 已在 Athena 控制台成功执行查询

---

## 🎉 完成！

现在你已经获取了所有必需的 AWS 配置！

**下一步**：
1. 将配置填入 `backend/.env` 文件
2. 重启后端服务
3. 运行测试验证
4. 开始使用查数工具

**需要帮助？**
- 运行测试脚本: `npm run test:athena`
- 查看日志: `backend/logs/combined.log`
- 查看完整指南: [ATHENA_SETUP_GUIDE.md](./ATHENA_SETUP_GUIDE.md)













