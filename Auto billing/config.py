# 配置文件
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# Lark API 配置
LARK_APP_ID = os.getenv('LARK_APP_ID', '')
LARK_APP_SECRET = os.getenv('LARK_APP_SECRET', '')

# Lark 表格配置
CUSTOMER_INFO_SHEET_URL = "https://d4ft1c7bo4f.sg.larksuite.com/sheets/HwSzsc9tQhttUStuDjalmr1Ug5b?sheet=0qVymZ"
CUSTOMER_RATE_SHEET_URL = "https://d4ft1c7bo4f.sg.larksuite.com/sheets/FaXdsSJKZhPwn4tHLaWlgUV4gVg?sheet=d83224"

# 邮件配置
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USER = os.getenv('EMAIL_USER', '')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', '')

# 日志配置
LOG_LEVEL = 'INFO'
LOG_FILE = 'auto_billing.log'

# 输出目录
OUTPUT_DIR = 'output'
PDF_DIR = os.path.join(OUTPUT_DIR, 'pdfs')
