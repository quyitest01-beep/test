# 数据导出与邮件发送工具

## 简介
本工具用于从数据库导出月度数据并通过邮件发送，支持多种数据库和多附件发送。

## 安装依赖

```bash
pip install -r requirements.txt
pip install python-dotenv
```

## 配置方法

1. 复制 `.env.example` 为 `.env`，并填写你的配置信息。
2. `.env` 文件内容示例：

    ```
    EMAIL_SENDER=xxx@xxx.com
    EMAIL_PASSWORD=your_email_password
    EMAIL_SMTP_HOST=smtp.xxx.com
    EMAIL_SMTP_PORT=465
    EMAIL_RECEIVERS=xxx@xxx.com,yyy@xxx.com
    EMAIL_CC=
    DB_HOST=127.0.0.1
    DB_PORT=3306
    DB_USER=root
    DB_PASSWORD=your_db_password
    DB_DATABASE=sink
    GMP_DB_HOST=127.0.0.1
    GMP_DB_PORT=3306
    GMP_DB_USER=root
    GMP_DB_PASSWORD=your_db_password
    GMP_DB_DATABASE=gmp_game_platform
    MERCHANT_DB_HOST=127.0.0.1
    MERCHANT_DB_PORT=3306
    MERCHANT_DB_USER=root
    MERCHANT_DB_PASSWORD=your_db_password
    MERCHANT_DB_DATABASE=merchant
    ```

3. `.env` 文件已被 `.gitignore` 忽略，不会上传到 git。

## 使用方法

- 手动发送（即时）：
    ```bash
    python D:\cursor\importyagmail.py --mode manual
    ```
- 定时发送（自动）：
    ```bash
    python D:\cursor\importyagmail.py --mode auto --date "2024-06-30 00:00:00"
    ```

## 注意事项

- 请确保 `.env` 配置正确，否则程序无法连接数据库或发送邮件。
- 导出的 Excel 文件和日志文件会自动忽略，不会上传到 git。 