# 邮件配置设置说明

## 1. 创建 .env 文件

请在项目根目录创建 `.env` 文件，并填入以下配置：

```env
# Lark API 配置
LARK_APP_ID=your_app_id_here
LARK_APP_SECRET=your_app_secret_here

# 邮件配置
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
```

## 2. Gmail 应用专用密码设置

1. 登录您的 Gmail 账户
2. 进入 Google 账户设置
3. 启用两步验证
4. 生成应用专用密码
5. 将应用专用密码填入 `EMAIL_PASSWORD` 字段

## 3. 使用自动邮件下载器

运行以下命令下载指定月份的邮件附件：

```bash
python auto_email_downloader.py 2025 7
```

## 4. 集成到账单生成系统

新的邮件下载器已经集成到账单生成系统中，会自动在步骤2中调用。





