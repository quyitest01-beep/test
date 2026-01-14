# AWS_SESSION_TOKEN 获取指南

## 📋 什么是 AWS_SESSION_TOKEN？

`AWS_SESSION_TOKEN` 是 AWS **临时凭证**的一部分，通常与以下场景一起使用：

1. **AWS STS AssumeRole** - 通过角色获取临时访问权限
2. **AWS SSO (Single Sign-On)** - 单点登录获取临时凭证
3. **EC2 实例角色** - 在 EC2 上使用 IAM 角色
4. **跨账户访问** - 临时访问其他 AWS 账户的资源

## 🔑 临时凭证 vs 永久凭证

### 永久凭证（不需要 SESSION_TOKEN）
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# 不需要 AWS_SESSION_TOKEN
```

### 临时凭证（需要 SESSION_TOKEN）
```bash
AWS_ACCESS_KEY_ID=ASIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjE...（很长的字符串）
```

## 🚀 获取 AWS_SESSION_TOKEN 的方法

### 方法 1: 使用 AWS CLI AssumeRole（推荐）

#### 步骤 1: 安装 AWS CLI
```bash
# Windows (使用 Chocolatey)
choco install awscli

# 或下载安装包
# https://aws.amazon.com/cli/
```

#### 步骤 2: 配置基础凭证
```bash
aws configure
# 输入你的 AWS_ACCESS_KEY_ID
# 输入你的 AWS_SECRET_ACCESS_KEY
# 输入默认区域（如 us-west-2）
# 输入默认输出格式（json）
```

#### 步骤 3: 使用 AssumeRole 获取临时凭证
```bash
# 假设你有一个角色 ARN
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/AthenaQueryRole \
  --role-session-name my-session \
  --duration-seconds 3600
```

#### 步骤 4: 解析输出并设置环境变量
输出示例：
```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "SessionToken": "IQoJb3JpZ2luX2VjE...",
    "Expiration": "2024-01-01T12:00:00Z"
  }
}
```

**Windows PowerShell:**
```powershell
$response = aws sts assume-role --role-arn arn:aws:iam::123456789012:role/AthenaQueryRole --role-session-name my-session | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID = $response.Credentials.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $response.Credentials.SecretAccessKey
$env:AWS_SESSION_TOKEN = $response.Credentials.SessionToken
```

**Linux/Mac:**
```bash
export AWS_ACCESS_KEY_ID=$(aws sts assume-role --role-arn arn:aws:iam::123456789012:role/AthenaQueryRole --role-session-name my-session --query 'Credentials.AccessKeyId' --output text)
export AWS_SECRET_ACCESS_KEY=$(aws sts assume-role --role-arn arn:aws:iam::123456789012:role/AthenaQueryRole --role-session-name my-session --query 'Credentials.SecretAccessKey' --output text)
export AWS_SESSION_TOKEN=$(aws sts assume-role --role-arn arn:aws:iam::123456789012:role/AthenaQueryRole --role-session-name my-session --query 'Credentials.SessionToken' --output text)
```

### 方法 2: 使用 AWS SSO

#### 步骤 1: 配置 SSO
```bash
aws configure sso
```

#### 步骤 2: 登录
```bash
aws sso login --profile your-profile
```

#### 步骤 3: 获取临时凭证
SSO 登录后，凭证会自动包含 `AWS_SESSION_TOKEN`，可以通过以下命令查看：
```bash
aws configure list
```

### 方法 3: 使用 Node.js 代码获取

创建文件 `get-temp-credentials.js`:

```javascript
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');

async function getTempCredentials() {
  const stsClient = new STSClient({
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const command = new AssumeRoleCommand({
    RoleArn: 'arn:aws:iam::123456789012:role/AthenaQueryRole',
    RoleSessionName: 'my-session',
    DurationSeconds: 3600
  });

  try {
    const response = await stsClient.send(command);
    const credentials = response.Credentials;
    
    console.log('临时凭证获取成功:');
    console.log(`AWS_ACCESS_KEY_ID=${credentials.AccessKeyId}`);
    console.log(`AWS_SECRET_ACCESS_KEY=${credentials.SecretAccessKey}`);
    console.log(`AWS_SESSION_TOKEN=${credentials.SessionToken}`);
    console.log(`过期时间: ${credentials.Expiration}`);
    
    return credentials;
  } catch (error) {
    console.error('获取临时凭证失败:', error);
    throw error;
  }
}

getTempCredentials();
```

运行：
```bash
node get-temp-credentials.js
```

### 方法 4: 在 EC2 实例上使用 IAM 角色

如果你在 EC2 实例上运行代码，并且 EC2 实例附加了 IAM 角色，AWS SDK 会自动获取临时凭证（包括 SESSION_TOKEN），**无需手动配置**。

只需确保：
1. EC2 实例附加了具有必要权限的 IAM 角色
2. 代码中不设置 `credentials`，让 SDK 自动从实例元数据获取

```javascript
// 在 EC2 上，不需要手动设置 credentials
const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'us-east-1'
  // credentials 会自动从 EC2 实例元数据获取
});
```

## 📝 在 .env 文件中配置

### 方式 1: 永久凭证（不需要 SESSION_TOKEN）
```env
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# AWS_SESSION_TOKEN 留空或不设置
```

### 方式 2: 临时凭证（需要 SESSION_TOKEN）
```env
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=ASIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjE...（很长的字符串）
```

## ⚠️ 重要注意事项

1. **临时凭证会过期** - 通常 1-12 小时，需要定期刷新
2. **SESSION_TOKEN 很长** - 可能包含特殊字符，确保在 .env 文件中正确转义
3. **安全性** - 临时凭证比永久凭证更安全，建议在生产环境使用
4. **权限** - 确保角色或用户有必要的 Athena 和 S3 权限

## 🔍 如何判断是否需要 SESSION_TOKEN？

### 检查凭证类型：

**永久凭证的 AccessKeyId 通常以 `AKIA` 开头**
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # 永久凭证，不需要 SESSION_TOKEN
```

**临时凭证的 AccessKeyId 通常以 `ASIA` 开头**
```bash
AWS_ACCESS_KEY_ID=ASIAIOSFODNN7EXAMPLE  # 临时凭证，需要 SESSION_TOKEN
```

## 🛠️ 故障排查

### 错误: "The security token included in the request is invalid"

**原因**: SESSION_TOKEN 缺失、过期或无效

**解决方案**:
1. 检查是否提供了 `AWS_SESSION_TOKEN`
2. 如果使用临时凭证，重新获取新的凭证
3. 检查凭证是否过期

### 错误: "Access Denied"

**原因**: 角色或用户权限不足

**解决方案**:
1. 检查 IAM 角色/用户的策略
2. 确保有 Athena 和 S3 的访问权限
3. 检查资源策略（如 S3 bucket 策略）

## 📚 相关资源

- [AWS STS 文档](https://docs.aws.amazon.com/STS/latest/APIReference/Welcome.html)
- [AWS SSO 文档](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)




