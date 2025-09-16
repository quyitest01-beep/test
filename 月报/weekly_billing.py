import pandas as pd
from sqlalchemy import create_engine, text
import re
import requests
from tqdm import tqdm
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import logging
from datetime import datetime, timedelta
import os
import traceback
import socket
import urllib3
from email.header import Header
import argparse
from dotenv import load_dotenv
import psutil  # 用于监控系统资源
import pymysql  # 补充依赖
from functools import lru_cache
import time
import gc
import glob

# 加载.env配置
load_dotenv()

# 配置日志
def setup_logging():
    """配置日志输出格式和位置"""
    log_filename = f'weekly_export_and_send_{datetime.now().strftime("%Y%m%d")}.log'
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

# 邮件配置
EMAIL_CONFIG = {
    'sender': os.environ.get('EMAIL_SENDER'),
    'password': os.environ.get('EMAIL_PASSWORD'),
    'smtp_host': os.environ.get('EMAIL_SMTP_HOST'),
    'smtp_port': int(os.environ.get('EMAIL_SMTP_PORT', 465)),
    'receivers': [i.strip() for i in os.environ.get('EMAIL_RECEIVERS', '').split(',') if i.strip()],
    'cc': [i.strip() for i in os.environ.get('EMAIL_CC', '').split(',') if i.strip()]
}

# 数据库配置
DB_CONFIG = {
    'host': os.environ.get('DB_HOST'),
    'port': os.environ.get('DB_PORT', '3306'),
    'user': os.environ.get('DB_USER'),
    'password': os.environ.get('DB_PASSWORD'),
    'database': os.environ.get('DB_DATABASE')
}

# 新增gmp_game_platform数据库配置
GMP_DB_CONFIG = {
    'host': os.environ.get('GMP_DB_HOST'),
    'port': os.environ.get('GMP_DB_PORT', '3306'),
    'user': os.environ.get('GMP_DB_USER'),
    'password': os.environ.get('GMP_DB_PASSWORD'),
    'database': os.environ.get('GMP_DB_DATABASE')
}

# 新增merchant数据库配置
MERCHANT_DB_CONFIG = {
    'host': os.environ.get('MERCHANT_DB_HOST'),
    'port': os.environ.get('MERCHANT_DB_PORT', '3306'),
    'user': os.environ.get('MERCHANT_DB_USER'),
    'password': os.environ.get('MERCHANT_DB_PASSWORD'),
    'database': os.environ.get('MERCHANT_DB_DATABASE')
}

# 导出目录
EXPORT_DIR = os.environ.get('EXPORT_DIR', 'excel')

def validate_config():
    """验证所有必需的配置项"""
    required_configs = {
        'EMAIL': ['EMAIL_SENDER', 'EMAIL_PASSWORD', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT'],
        'DB': ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'],
        'GMP_DB': ['GMP_DB_HOST', 'GMP_DB_USER', 'GMP_DB_PASSWORD', 'GMP_DB_DATABASE'],
        'MERCHANT_DB': ['MERCHANT_DB_HOST', 'MERCHANT_DB_USER', 'MERCHANT_DB_PASSWORD', 'MERCHANT_DB_DATABASE']
    }
    missing_configs = []
    for category, vars in required_configs.items():
        for var in vars:
            if not os.environ.get(var):
                missing_configs.append(f"{category}: {var}")
    # 邮件接收者和抄送不能为空
    if not EMAIL_CONFIG['receivers']:
        missing_configs.append("EMAIL: EMAIL_RECEIVERS")
    if not EMAIL_CONFIG['cc']:
        logging.warning("EMAIL_CC 未配置，将不会抄送")
    if missing_configs:
        raise ValueError(f"缺少必需的环境变量配置:\n" + "\n".join(missing_configs))
    return True

def test_database_connection(logger):
    """测试数据库连接"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}?charset=utf8mb4"
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, "数据库连接成功"
    except Exception as e:
        error_msg = f"数据库连接失败: {str(e)}"
        if "Access denied" in str(e):
            error_msg += "\n可能原因：用户名或密码错误"
        elif "Connection refused" in str(e):
            error_msg += "\n可能原因：数据库服务未启动或IP/端口错误"
        logger.error(error_msg)
        return False, error_msg

def test_smtp_connection(logger):
    """测试SMTP服务器连接"""
    try:
        with smtplib.SMTP_SSL(EMAIL_CONFIG['smtp_host'], EMAIL_CONFIG['smtp_port']) as server:
            server.login(EMAIL_CONFIG['sender'], EMAIL_CONFIG['password'])
        return True, "SMTP服务器连接成功"
    except smtplib.SMTPAuthenticationError:
        error_msg = "SMTP认证失败：邮箱账号或授权码错误"
        logger.error(error_msg)
        return False, error_msg
    except socket.gaierror:
        error_msg = "SMTP服务器连接失败：服务器地址错误或网络问题"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"SMTP连接异常: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def ensure_directory_exists(filepath):
    """确保目录存在且有写入权限"""
    try:
        directory = os.path.dirname(filepath) or '.'
        if not os.path.exists(directory):
            os.makedirs(directory)
        test_file = os.path.join(directory, '.test_write')
        try:
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
            return True, None
        except Exception as e:
            return False, f"目录无写入权限: {str(e)}"
    except Exception as e:
        return False, f"创建目录失败: {str(e)}"

def get_available_filename(base_filename):
    """获取可用的文件名（如果文件被占用，自动加上序号）"""
    if not os.path.exists(base_filename):
        return base_filename
    
    name, ext = os.path.splitext(base_filename)
    counter = 1
    while True:
        new_filename = f"{name}_{counter}{ext}"
        if not os.path.exists(new_filename):
            return new_filename
        counter += 1

def set_excel_format(workbook, worksheet, columns, header_names):
    """统一设置Excel列宽、格式和表头"""
    for col_range, width, fmt in columns:
        worksheet.set_column(col_range, width, fmt)
    header_format = workbook.add_format({
        'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#D9D9D9'
    })
    for col_num, value in enumerate(header_names):
        worksheet.write(0, col_num, value, header_format)

def get_last_week_dates():
    """获取上周一到周日的日期"""
    today = datetime.now()
    # 获取上周一
    last_monday = today - timedelta(days=today.weekday() + 7)
    # 获取上周日
    last_sunday = last_monday + timedelta(days=6)
    
    return last_monday, last_sunday

def get_week_range_string(start_date, end_date):
    """获取周范围字符串"""
    return f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}"

# 新增：ID标准化工具函数，统一字符串化、去空格，并处理类似"123.0"的情况
def normalize_id(value):
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ''
        s = str(value).strip().strip('"').strip("'")
        # 将形如 123 或 123.0 的字符串统一为无小数形式
        if re.fullmatch(r"\d+(\.0+)?", s):
            s = s.split('.', 1)[0]
        return s
    except Exception:
        return str(value)

# 游戏名映射函数
def get_game_name(row, game_id_to_name, gp_game_to_name):
    """
    根据游戏ID和厂商信息映射游戏名称
    """
    # 调试：检查row对象的内容
    try:
        # 检查provider字段是否存在，如果不存在则检查厂商字段（重命名后的字段名）
        provider_value = row.get('provider')
        if provider_value is None:
            # 如果provider字段不存在，尝试厂商字段
            provider_value = row.get('厂商')
        
        if provider_value in ['gp', 'popular']:
            # 当provider=gp或popular时，使用特殊的两步映射：game_id -> source_id -> game_name
            return gp_game_to_name.get(row['game'], row['game'])
        else:
            # 其他情况使用id字段映射
            return game_id_to_name.get(row['game'], row['game'])
    except KeyError as e:
        # 调试：输出row对象的所有可用字段
        available_fields = [str(key) for key in row.keys()]
        raise KeyError(f"字段 {e} 不存在！可用字段: {available_fields}")

def get_game_mappings(gmp_engine, logger):
    """获取游戏映射字典"""
    try:
        # 获取所有游戏的映射：id -> name, code -> name
        game_map_df = pd.read_sql("SELECT id, code, name FROM gmp_game_list", gmp_engine)
        game_map_df['id'] = game_map_df['id'].astype(str).str.strip()
        game_map_df['code'] = game_map_df['code'].astype(str).str.strip()
        game_map_df['name'] = game_map_df['name'].astype(str).str.strip()
        logger.info(f"gmp_game_list 映射表行数: {game_map_df.shape[0]}")
        game_id_to_name = dict(zip(game_map_df['id'], game_map_df['name']))
        game_code_to_name = dict(zip(game_map_df['code'], game_map_df['name']))
        
        # 获取gp厂商的特殊映射：id -> source_id -> game_name
        gp_merchant_game_df = pd.read_sql("SELECT id, source_id FROM gmp_merchant_game_list", gmp_engine)
        gp_merchant_game_df['id'] = gp_merchant_game_df['id'].astype(str).str.strip()
        gp_merchant_game_df['source_id'] = gp_merchant_game_df['source_id'].astype(str).str.strip()
        logger.info(f"gmp_merchant_game_list 映射表行数: {gp_merchant_game_df.shape[0]}")
        
        # 创建gp厂商的id到source_id的映射
        gp_id_to_source = dict(zip(gp_merchant_game_df['id'], gp_merchant_game_df['source_id']))
        
        # 创建gp厂商的完整映射：id -> source_id -> game_name
        gp_game_to_name = {}
        for game_id, source_id in gp_id_to_source.items():
            # 优先使用game_id_to_name（id->name映射），其次使用game_code_to_name（code->name映射）
            # 如果都找不到，尝试使用source_id在game_list中查找对应的游戏名称
            game_name = game_id_to_name.get(source_id, game_code_to_name.get(source_id, game_id))
            
            # 如果映射结果仍然是数字ID，说明映射关系不完整，尝试从game_list中查找
            if game_name == game_id and source_id.isdigit():
                try:
                    # 查询gmp_game_list表，根据source_id查找游戏名称（参数化，避免SQL注入）
                    from sqlalchemy import text as _text
                    with gmp_engine.connect() as conn:
                        result = conn.execute(_text("SELECT name FROM gmp_game_list WHERE id = :sid"), {"sid": int(source_id)}).fetchone()
                        if result and result[0]:
                            game_name = str(result[0]).strip()
                except Exception:
                    # 如果查询失败，保持原值
                    pass
            
            gp_game_to_name[game_id] = game_name
        
        return game_id_to_name, gp_game_to_name
        
    except Exception as e:
        logger.error(f"读取gmp_game_list或gmp_merchant_game_list失败: {str(e)}", exc_info=True)
        return {}, {}

# 币安API：获取加密货币对USDT价格

def get_binance_price(symbol, logger=None):
    """
    获取币安现货市场的实时价格（优化版）
    symbol: 币安交易对，如 'BTCUSDT', 'ETHUSDT'
    """
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    
    for attempt in range(3):  # 增加重试机制
        try:
            if logger:
                logger.info(f"尝试获取{symbol}价格，第{attempt+1}次尝试")
            
            resp = requests.get(url, timeout=15)  # 增加超时时间
            if resp.status_code == 200:
                data = resp.json()
                price = float(data['price'])
                if logger:
                    logger.info(f"成功获取{symbol}价格: {price}")
                return price
            else:
                if logger:
                    logger.warning(f"币安API获取{symbol}失败，状态码: {resp.status_code}")
                    
        except Exception as e:
            if logger:
                logger.warning(f"币安API获取{symbol}第{attempt+1}次尝试异常: {str(e)}")
            if attempt < 2:  # 不是最后一次尝试
                time.sleep(2)  # 延迟2秒后重试
                continue
            else:
                break
    
    if logger:
        logger.error(f"币安API获取{symbol}所有尝试都失败")
    return 0

# 币安API：获取USDT对法币的价格

def get_binance_usdt_to_fiat(fiat, logger=None):
    """
    获取币安USDT对法币的实时价格，如USDT/EUR、USDT/TRY等（优化版）
    返回：1 USDT = ? 法币
    """
    symbol = f"USDT{fiat.upper()}"
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    
    for attempt in range(3):  # 增加重试机制
        try:
            if logger:
                logger.info(f"尝试获取{symbol}价格，第{attempt+1}次尝试")
            
            resp = requests.get(url, timeout=15)  # 增加超时时间
            if resp.status_code == 200:
                data = resp.json()
                price = float(data['price'])
                if logger:
                    logger.info(f"成功获取{symbol}价格: {price}")
                return price
            else:
                if logger:
                    logger.warning(f"币安API获取{symbol}失败，状态码: {resp.status_code}")
                    
        except Exception as e:
            if logger:
                logger.warning(f"币安API获取{symbol}第{attempt+1}次尝试异常: {str(e)}")
            if attempt < 2:  # 不是最后一次尝试
                time.sleep(2)  # 延迟2秒后重试
                continue
            else:
                break
    
    if logger:
        logger.error(f"币安API获取{symbol}所有尝试都失败")
    return 0

@lru_cache(maxsize=128)
def get_exchange_rate(currency, logger=None):
    """
    获取币种对USD的汇率（优化版）
    - 加密货币：用币安API获取对USDT的价格
    - 法币：优先用币安API，备用外汇API，最后本地缓存
    - 增加重试机制和备用API源
    """
    if not currency or currency.upper() == 'USD':
        return 1.0
    currency = currency.upper()
    
    # 本地汇率缓存（作为最后备用）
    local_rates = {
        'BRL': 0.21,   # 1 BRL = 0.21 USD
        'EUR': 1.08,   # 1 EUR = 1.08 USD
        'GBP': 1.27,   # 1 GBP = 1.27 USD
        'JPY': 0.0067, # 1 JPY = 0.0067 USD
        'CNY': 0.14,   # 1 CNY = 0.14 USD
        'KRW': 0.00075, # 1 KRW = 0.00075 USD
        'INR': 0.012,  # 1 INR = 0.012 USD
        'RUB': 0.011,  # 1 RUB = 0.011 USD
        'TRY': 0.031,  # 1 TRY = 0.031 USD
        'UAH': 0.027,  # 1 UAH = 0.027 USD
        'NGN': 0.0013, # 1 NGN = 0.0013 USD
        'ZAR': 0.054,  # 1 ZAR = 0.054 USD
        'PLN': 0.25,   # 1 PLN = 0.25 USD
        'IDR': 0.000065, # 1 IDR = 0.000065 USD
        'AUD': 0.66,   # 1 AUD = 0.66 USD
        'MXN': 0.059,  # 1 MXN = 0.059 USD
        'CAD': 0.74,   # 1 CAD = 0.74 USD
        'CHF': 1.12,   # 1 CHF = 1.12 USD
        'CZK': 0.044,  # 1 CZK = 0.044 USD
        'DKK': 0.15,   # 1 DKK = 0.15 USD
        'HKD': 0.13,   # 1 HKD = 0.13 USD
        'HUF': 0.0028, # 1 HUF = 0.0028 USD
        'ILS': 0.27,   # 1 ILS = 0.27 USD
    }
    
    # 币安支持的法币
    binance_fiats = [
        'EUR', 'TRY', 'RUB', 'BRL', 'UAH', 'NGN', 'ZAR', 'PLN', 'IDR', 'GBP', 'AUD', 'MXN', 'CAD', 'CHF',
        'CZK', 'DKK', 'HKD', 'HUF', 'ILS', 'NOK', 'NZD', 'SEK', 'SGD', 'THB', 'VND'
    ]
    
    # 加密货币优先
    binance_cryptos = ['USDT', 'BTC', 'ETH', 'BNB', 'BUSD', 'USDC']
    
    # 策略1：加密货币用币安API
    if currency in binance_cryptos:
        symbol = f"{currency}USDT" if currency != 'USDT' else 'USDTUSDT'
        if symbol == 'USDTUSDT':
            return 1.0
        price = get_binance_price(symbol, logger)
        if price > 0:
            return price
    
    # 策略2：法币优先用币安API
    if currency in binance_fiats:
        price = get_binance_usdt_to_fiat(currency, logger)
        if price > 0:
            # 1 USDT = price 法币，1 法币 = 1/price USDT
            return 1 / price
    
    # 策略3：备用外汇API（增加重试次数）
    backup_apis = [
        f"https://open.er-api.com/v6/latest/{currency}",
        f"https://api.exchangerate-api.com/v4/latest/{currency}",
        f"https://api.fixer.io/latest?base={currency}"
    ]
    
    for api_url in backup_apis:
        for attempt in range(3):  # 减少到3次重试
            try:
                if logger:
                    logger.info(f"尝试获取{currency}汇率，API: {api_url}，第{attempt+1}次尝试")
                
                resp = requests.get(api_url, timeout=15)  # 增加超时时间
                if resp.status_code == 200:
                    data = resp.json()
                    # 不同API的响应格式
                    if 'rates' in data and 'USD' in data['rates']:
                        rate = data['rates']['USD']
                    elif 'conversion_rates' in data and 'USD' in data['conversion_rates']:
                        rate = data['conversion_rates']['USD']
                    elif 'rates' in data and 'USD' in data['rates']:
                        rate = data['rates']['USD']
                    else:
                        continue
                    
                    if rate and rate > 0:
                        if logger:
                            logger.info(f"成功获取{currency}汇率: {rate} (API: {api_url})")
                        return round(rate, 6)
                
                if logger:
                    logger.warning(f"API {api_url} 返回状态码: {resp.status_code})")
                    
            except Exception as e:
                if logger:
                    logger.warning(f"API {api_url} 第{attempt+1}次尝试失败: {str(e)}")
                if attempt < 2:  # 不是最后一次尝试
                    time.sleep(3)  # 增加延迟时间
                    continue
                else:
                    break
    
    # 策略4：使用本地缓存汇率
    if currency in local_rates:
        if logger:
            logger.warning(f"网络获取{currency}汇率失败，使用本地缓存汇率: {local_rates[currency]}")
        return local_rates[currency]
    
    # 策略5：最后备用
    if logger:
        logger.error(f"所有汇率获取方式都失败，币种: {currency}")
    return 0

def get_data_and_export_weekly(logger, start_date, end_date):
    """从数据库获取周数据并导出Excel"""
    try:
        validate_config()
        db_success, db_message = test_database_connection(logger)
        if not db_success:
            return False, db_message

        engine = create_engine(
            f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}?charset=utf8mb4"
        )
        gmp_engine = create_engine(
            f"mysql+pymysql://{GMP_DB_CONFIG['user']}:{GMP_DB_CONFIG['password']}@{GMP_DB_CONFIG['host']}:{GMP_DB_CONFIG['port']}/{GMP_DB_CONFIG['database']}?charset=utf8mb4"
        )
        merchant_engine = create_engine(
            f"mysql+pymysql://{MERCHANT_DB_CONFIG['user']}:{MERCHANT_DB_CONFIG['password']}@{MERCHANT_DB_CONFIG['host']}:{MERCHANT_DB_CONFIG['port']}/{MERCHANT_DB_CONFIG['database']}?charset=utf8mb4"
        )

        # 获取所有stat_表
        sql = "SHOW TABLES LIKE 'stat_%'"
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            all_stat_tables = [row[0] for row in result.fetchall()]
        
        if not all_stat_tables:
            error_msg = "没有找到任何stat_表！"
            logger.error(error_msg, exc_info=True)
            return False, error_msg

        temp_dfs = []
        for table in all_stat_tables:
            logger.info(f"正在处理表：{table}")
            try:
                # 查询表结构，自动检测时间字段
                with engine.connect() as conn:
                    columns_result = conn.execute(text(f"SHOW COLUMNS FROM {table}"))
                    columns = [row[0] for row in columns_result.fetchall()]
                
                # 字段自动适配
                def find_column(possible_names, columns):
                    for name in possible_names:
                        if name in columns:
                            return name
                    return None
                
                field_map = {}
                field_map['pay_in'] = find_column(['pay_in', 'bet_amount', 'amount', 'total_bet'], columns)
                field_map['pay_out'] = find_column(['pay_out', 'payout', 'win_amount', 'total_payout'], columns)
                field_map['count'] = find_column(['count', 'bet_count', 'round_count', 'total_count'], columns)
                field_map['merchant'] = find_column(['merchant', 'merchant_id', 'mid'], columns)
                field_map['provider'] = find_column(['provider', 'provider_id'], columns)
                field_map['currency'] = find_column(['currency', 'currency_id'], columns)
                field_map['game'] = find_column(['game', 'game_id'], columns)
                field_map['date_field'] = find_column(['time', 'date', 'create_time', 'update_time', 'stat_date'], columns)
                
                useful_fields = [field_map[k] for k in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'game', 'count', 'date_field'] if field_map[k] is not None]
                
                logger.info(f"自动适配字段: {field_map}")
                
                if not field_map['date_field']:
                    logger.warning(f"表 {table} 没有找到时间字段，跳过")
                    continue
                
                fields_str = ', '.join(useful_fields)
                
                # 构建时间筛选条件
                sql = f"SELECT {fields_str} FROM {table} WHERE {field_map['merchant']} != '10001' AND {field_map['date_field']} BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d 23:59:59')}'"
                
                logger.info(f"执行SQL: {sql}")
                df = pd.read_sql(sql, engine)
                
                if df.empty:
                    logger.info(f"表 {table} 在指定时间范围内无数据，跳过")
                    continue
                
                logger.info(f"{table} 字段: {df.columns.tolist()}")
                logger.info(f"{table} 数据样例:\n{df.head()}\n")
                
                # 字段补齐并全部做str.strip()
                for col in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'game', 'count']:
                    if col not in df.columns:
                        df[col] = None
                
                for col in ['merchant', 'provider', 'currency', 'game']:
                    if col in df.columns:
                        df[col] = df[col].astype(str).str.strip()
                
                df['pay_in'] = pd.to_numeric(df.get(field_map['pay_in'], 0), errors='coerce').fillna(0)
                df['pay_out'] = pd.to_numeric(df.get(field_map['pay_out'], 0), errors='coerce').fillna(0)
                df['count'] = pd.to_numeric(df.get(field_map['count'], 0), errors='coerce').fillna(0)
                
                # 检查数值字段是否全为0
                for col in ['pay_in', 'pay_out', 'count']:
                    if df[col].sum() == 0:
                        logger.warning(f"表 {table} 字段 {col} 全为0 或缺失，请检查源表数据！")
                
                # 按商户、提供商、货币、游戏分组聚合
                agg = df.groupby(['merchant', 'provider', 'currency', 'game']).agg(
                    pay_in=('pay_in', 'sum'),
                    pay_out=('pay_out', 'sum'),
                    count=('count', 'sum')
                ).reset_index()
                
                if agg.empty:
                    logger.info(f"表 {table} 聚合后为空，跳过")
                    continue
                
                logger.info(f'{table} 聚合后行数: {agg.shape[0]}')
                temp_dfs.append(agg)
                del df, agg
                gc.collect()
                
            except Exception as e:
                logger.error(f"处理表 {table} 失败: {str(e)}", exc_info=True)
                continue
        
        if not temp_dfs:
            logger.error("所有表在指定时间范围内均无有效数据，导出终止")
            return False, "所有表均无有效数据"
        
        # 合并所有表的聚合结果
        all_data = pd.concat(temp_dfs, ignore_index=True)
        logger.info(f'最终all_data行数: {all_data.shape[0]}')
        del temp_dfs
        gc.collect()
        
        # 再做一次全局groupby，确保所有分批聚合结果合并
        all_data = all_data.groupby(['merchant', 'provider', 'currency', 'game']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        
        logger.info(f'最终all_data全局groupby后行数: {all_data.shape[0]}')

        # 补齐字段（只在字段不存在时添加，不覆盖已有数据）
        for col in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'game', 'count']:
            if col not in all_data.columns:
                all_data[col] = None
                logger.warning(f"字段 {col} 不存在，已用空值填充")
        
        logger.info(f'all_data 字段: {all_data.columns.tolist()}')
        logger.info(f'all_data 数据样例:\n{all_data.head()}')

        # 汇总（不包含game字段，避免金额被拆分）
        grouped = all_data.groupby(['merchant', 'provider', 'currency', 'game']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        logger.info(f'最终grouped行数: {grouped.shape[0]}')
        logger.info(f'grouped 数据样例:\n{grouped.head()}')

        # 获取汇率信息（与月度版本相同的逻辑）
        currency_list = grouped['currency'].drop_duplicates().tolist()
        exchange_rate_dict = {}
        failed_currencies = []
        logger.info("正在获取汇率...")
        for currency in currency_list:
            rate = get_exchange_rate(currency, logger)
            exchange_rate_dict[currency] = rate
            if rate == 0:
                failed_currencies.append(currency)
        if failed_currencies:
            logger.warning(f"以下币种获取汇率失败: {set(failed_currencies)}")

        # merchant到merchant_name映射
        # 调试：检查MERCHANT_DB_CONFIG配置
        print(f"MERCHANT_DB_CONFIG配置: {MERCHANT_DB_CONFIG}")
        
        # 检查merchant_engine连接是否成功
        try:
            with merchant_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("merchant_engine连接成功")
        except Exception as e:
            print(f"merchant_engine连接失败: {str(e)}")
            merchant_to_name = {}
        else:
            try:
                merchant_map_df = pd.read_sql("SELECT merchant_id, merchant_name, merchant_desc, account FROM merchant_config", merchant_engine)
                merchant_map_df['merchant_id'] = merchant_map_df['merchant_id'].astype(str).str.strip()
                merchant_map_df['merchant_name'] = merchant_map_df['merchant_name'].astype(str).str.strip()
                merchant_map_df['merchant_desc'] = merchant_map_df['merchant_desc'].astype(str).str.strip()
                merchant_map_df['account'] = merchant_map_df['account'].astype(str).str.strip()
                
                # 优先使用merchant_name作为商户名称，如果为空则使用account，如果都为空则使用merchant_id
                merchant_to_name = {}
                for _, row in merchant_map_df.iterrows():
                    merchant_id = row['merchant_id']
                    if pd.notnull(row['merchant_name']) and row['merchant_name'].strip() != '':
                        merchant_to_name[merchant_id] = row['merchant_name']
                    else:
                        merchant_to_name[merchant_id] = merchant_id
                
                # 调试：检查merchant_config数据
                print(f"merchant_config表数据: {merchant_map_df.head().to_string()}")
                print(f"merchant_config表行数: {len(merchant_map_df)}")
                print(f"merchant_to_name字典示例: {dict(list(merchant_to_name.items())[:5])}")
                
                # 检查是否有数据
                if len(merchant_map_df) == 0:
                    print("merchant_config表为空！")
                    merchant_to_name = {}
                
            except Exception as e:
                print(f"读取merchant_config失败: {str(e)}")
                traceback.print_exc()
                merchant_to_name = {}
        
        # 调试：检查merchant_to_name是否为空
        print(f"merchant_to_name字典大小: {len(merchant_to_name)}")
        if len(merchant_to_name) == 0:
            print("merchant_to_name字典为空，商户名映射将无法正常工作！")
            
            # 临时解决方案：手动创建商户名映射
            print("使用临时商户名映射...")
            merchant_to_name = {
                '169820225': '商户A',
                '1698202251': '商户B'
            }
        else:
            # 检查实际数据中的商户ID是否在映射字典中
            actual_merchant_ids = grouped['merchant'].astype(str).unique()
            print(f"实际数据中的商户ID: {actual_merchant_ids}")
            
            missing_ids = [mid for mid in actual_merchant_ids if mid not in merchant_to_name]
            if missing_ids:
                print(f"以下商户ID在merchant_config表中不存在: {missing_ids}")
                
                # 为缺失的商户ID添加默认名称
                for mid in missing_ids:
                    merchant_to_name[mid] = f"商户_{mid}"
                
                print(f"已添加默认商户名: {merchant_to_name}")

        # 强制转换为数值类型，防止object类型导致的乘法报错
        grouped['pay_in'] = pd.to_numeric(grouped['pay_in'], errors='coerce').fillna(0)
        grouped['pay_out'] = pd.to_numeric(grouped['pay_out'], errors='coerce').fillna(0)
        grouped['count'] = pd.to_numeric(grouped['count'], errors='coerce').fillna(0)
        grouped['USD汇率'] = grouped['currency'].map(exchange_rate_dict).round(6)
        grouped['USD汇率'] = pd.to_numeric(grouped['USD汇率'], errors='coerce').fillna(0)

        grouped['总投注'] = grouped['pay_in'].round(2)
        grouped['总派奖'] = grouped['pay_out'].round(2)
        grouped['总投注USD'] = (grouped['总投注'] * grouped['USD汇率']).round(4)
        grouped['总派奖USD'] = (grouped['总派奖'] * grouped['USD汇率']).round(4)
        grouped['总局数'] = grouped['count']
        grouped['RTP'] = grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1
        )
        grouped['GGR'] = (grouped['总投注'] - grouped['总派奖']).round(2)
        grouped['GGR-USD'] = (grouped['GGR'] * grouped['USD汇率']).round(4)
        grouped.rename(columns={'currency': '货币', 'merchant': '商户ID', 'provider': '厂商'}, inplace=True)
        grouped['商户ID'] = grouped['商户ID'].astype(str).str.strip()
        grouped['商户名'] = grouped['商户ID'].map(merchant_to_name)
        grouped['商户名'] = grouped.apply(lambda row: row['商户名'] if pd.notnull(row['商户名']) and row['商户名'] != '' else row['商户ID'], axis=1)
        unknown_merchants = grouped[grouped['商户名'] == grouped['商户ID']]['商户ID'].unique()
        if len(unknown_merchants) > 0:
            logger.warning(f"未匹配到商户名的商户ID: {unknown_merchants[:10]} 共{len(unknown_merchants)}个")

        # 获取游戏映射字典
        game_id_to_name, gp_game_to_name = get_game_mappings(gmp_engine, logger)

        # 根据provider决定使用不同的映射策略
        grouped['游戏名'] = grouped.apply(lambda row: get_game_name(row, game_id_to_name, gp_game_to_name), axis=1)
        unknown_games = grouped[grouped['游戏名'] == grouped['game']]['game'].unique()
        if len(unknown_games) > 0:
            logger.warning(f"未匹配到游戏名的 game: {unknown_games[:10]} 共{len(unknown_games)}个")

        final_cols = [
            '商户名', '厂商', '游戏名', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD', '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        grouped = grouped[final_cols]
        
        # 导出到一个总Excel文件，包含三个工作表
        week_str = f"{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"
        output_file = os.path.join(EXPORT_DIR, f'weekly_summary_{week_str}.xlsx')
        output_file = get_available_filename(output_file)
        
        success, result = ensure_directory_exists(output_file)
        if not success:
            return False, result
        
        # 准备 商户厂商汇总表 (商户、厂商、货币维度)
        # 过滤掉商户名为demo的数据
        merchant_provider_data = all_data[all_data['merchant'] != 'demo']
        merchant_provider_grouped = merchant_provider_data.groupby(['merchant', 'provider', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        
        # 先进行商户名映射（使用更新后的merchant_to_name字典）
        merchant_provider_grouped['商户名'] = merchant_provider_grouped['merchant'].astype(str).map(merchant_to_name)
        merchant_provider_grouped['商户名'] = merchant_provider_grouped['商户名'].fillna(merchant_provider_grouped['merchant'].astype(str))
        
        # 调试：检查商户名映射结果
        logger.info(f"商户厂商汇总表商户名映射结果: {merchant_provider_grouped[['merchant', '商户名']].head().to_string()}")
        unknown_merchants = merchant_provider_grouped[merchant_provider_grouped['商户名'] == merchant_provider_grouped['merchant']]['merchant'].unique()
        if len(unknown_merchants) > 0:
            logger.warning(f"商户厂商汇总表中未匹配到商户名的商户ID: {unknown_merchants[:10]} 共{len(unknown_merchants)}个")
        
        # 先进行所有计算，然后再重命名字段
        merchant_provider_grouped['总投注'] = pd.to_numeric(merchant_provider_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        merchant_provider_grouped['总派奖'] = pd.to_numeric(merchant_provider_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        merchant_provider_grouped['总局数'] = pd.to_numeric(merchant_provider_grouped['count'], errors='coerce').fillna(0)
        merchant_provider_grouped['USD汇率'] = merchant_provider_grouped['currency'].map(exchange_rate_dict).round(6)
        
        # 重命名字段
        merchant_provider_grouped.rename(columns={
            'provider': '厂商',
            'currency': '货币'
        }, inplace=True)
        merchant_provider_grouped['USD汇率'] = pd.to_numeric(merchant_provider_grouped['USD汇率'], errors='coerce').fillna(0)
        merchant_provider_grouped['总投注USD'] = (merchant_provider_grouped['总投注'] * merchant_provider_grouped['USD汇率']).round(4)
        merchant_provider_grouped['总派奖USD'] = (merchant_provider_grouped['总派奖'] * merchant_provider_grouped['USD汇率']).round(4)
        merchant_provider_grouped['RTP'] = merchant_provider_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        merchant_provider_grouped['GGR'] = (merchant_provider_grouped['总投注'] - merchant_provider_grouped['总派奖']).round(2)
        merchant_provider_grouped['GGR-USD'] = (merchant_provider_grouped['GGR'] * merchant_provider_grouped['USD汇率']).round(4)
        merchant_provider_final_cols = [
            '商户名', '厂商', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        merchant_provider_grouped = merchant_provider_grouped[merchant_provider_final_cols]
        
        # 准备 厂商货币汇总表 (厂商、货币维度)
        # 过滤掉商户名为demo的数据
        provider_currency_data = all_data[all_data['merchant'] != 'demo']
        provider_currency_grouped = provider_currency_data.groupby(['provider', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        provider_currency_grouped['总投注'] = pd.to_numeric(provider_currency_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_currency_grouped['总派奖'] = pd.to_numeric(provider_currency_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_currency_grouped['总局数'] = pd.to_numeric(provider_currency_grouped['count'], errors='coerce').fillna(0)
        provider_currency_grouped['USD汇率'] = provider_currency_grouped['currency'].map(exchange_rate_dict).round(6)
        provider_currency_grouped['USD汇率'] = pd.to_numeric(provider_currency_grouped['USD汇率'], errors='coerce').fillna(0)
        provider_currency_grouped['总投注USD'] = (provider_currency_grouped['总投注'] * provider_currency_grouped['USD汇率']).round(4)
        provider_currency_grouped['总派奖USD'] = (provider_currency_grouped['总派奖'] * provider_currency_grouped['USD汇率']).round(4)
        provider_currency_grouped['RTP'] = provider_currency_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        provider_currency_grouped['GGR'] = (provider_currency_grouped['总投注'] - provider_currency_grouped['总派奖']).round(2)
        provider_currency_grouped['GGR-USD'] = (provider_currency_grouped['GGR'] * provider_currency_grouped['USD汇率']).round(4)
        provider_currency_grouped.rename(columns={
            'provider': '厂商',
            'currency': '货币'
        }, inplace=True)
        provider_currency_final_cols = [
            '厂商', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        provider_currency_grouped = provider_currency_grouped[provider_currency_final_cols]
        
        # 准备 厂商游戏汇总表 (厂商、游戏、货币维度)
        # 过滤掉商户名为demo的数据
        provider_game_data = all_data[all_data['merchant'] != 'demo']
        provider_game_grouped = provider_game_data.groupby(['provider', 'game', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        
        # 先进行游戏名映射（此时字段名还是原始的provider，不是厂商）
        logger.info(f"厂商游戏汇总表字段: {list(provider_game_grouped.columns)}")
        logger.info(f"厂商游戏汇总表前几行:\n{provider_game_grouped.head().to_string()}")
        
        # 调试：检查是否有provider字段
        if 'provider' not in provider_game_grouped.columns:
            logger.error(f"ERROR: provider字段不存在！可用字段: {list(provider_game_grouped.columns)}")
        else:
            logger.info(f"provider字段存在，值示例: {provider_game_grouped['provider'].head().tolist()}")
        
        # 在字段重命名之前进行游戏名映射
        provider_game_grouped['游戏名'] = provider_game_grouped.apply(lambda row: get_game_name(row, game_id_to_name, gp_game_to_name), axis=1)
        
        # 先计算USD汇率，再重命名字段
        provider_game_grouped['USD汇率'] = provider_game_grouped['currency'].map(exchange_rate_dict)
        provider_game_grouped['USD汇率'] = pd.to_numeric(provider_game_grouped['USD汇率'], errors='coerce').fillna(0).round(6)
        
        provider_game_grouped.rename(columns={
            'provider': '厂商',
            'currency': '货币',
            'pay_in': '总投注',
            'pay_out': '总派奖',
            'count': '总局数'
        }, inplace=True)
        provider_game_grouped['总投注'] = pd.to_numeric(provider_game_grouped['总投注'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总派奖'] = pd.to_numeric(provider_game_grouped['总派奖'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总局数'] = pd.to_numeric(provider_game_grouped['总局数'], errors='coerce').fillna(0)
        provider_game_grouped['总投注USD'] = (provider_game_grouped['总投注'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['总派奖USD'] = (provider_game_grouped['总派奖'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['RTP'] = provider_game_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        provider_game_grouped['GGR'] = (provider_game_grouped['总投注'] - provider_game_grouped['总派奖']).round(2)
        provider_game_grouped['GGR-USD'] = (provider_game_grouped['GGR'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_final_cols = [
            '厂商', '游戏名', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        provider_game_grouped = provider_game_grouped[provider_game_final_cols]
        
        # 准备 商户游戏汇总表 (商户、游戏、货币维度，仅统计厂商=gp、popular的数据，过滤demo商户)
        merchant_game_filtered = all_data[(all_data['provider'].isin(['gp', 'popular'])) & (all_data['merchant'] != 'demo')]
        merchant_game_grouped = merchant_game_filtered.groupby(['merchant', 'game', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        merchant_game_grouped['总投注'] = pd.to_numeric(merchant_game_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        merchant_game_grouped['总派奖'] = pd.to_numeric(merchant_game_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        merchant_game_grouped['总局数'] = pd.to_numeric(merchant_game_grouped['count'], errors='coerce').fillna(0)
        merchant_game_grouped['USD汇率'] = merchant_game_grouped['currency'].map(exchange_rate_dict).round(6)
        merchant_game_grouped['USD汇率'] = pd.to_numeric(merchant_game_grouped['USD汇率'], errors='coerce').fillna(0)
        merchant_game_grouped['总投注USD'] = (merchant_game_grouped['总投注'] * merchant_game_grouped['USD汇率']).round(4)
        merchant_game_grouped['总派奖USD'] = (merchant_game_grouped['总派奖'] * merchant_game_grouped['USD汇率']).round(4)
        merchant_game_grouped['RTP'] = merchant_game_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        merchant_game_grouped['GGR'] = (merchant_game_grouped['总投注'] - merchant_game_grouped['总派奖']).round(2)
        merchant_game_grouped['GGR-USD'] = (merchant_game_grouped['GGR'] * merchant_game_grouped['USD汇率']).round(4)
        
        # 应用商户名映射
        merchant_game_grouped['商户名'] = merchant_game_grouped['merchant'].map(
            lambda x: merchant_to_name.get(str(x).strip(), str(x).strip())
        )
        
        # 应用游戏名映射（使用get_game_name函数）
        # 由于商户游戏汇总表只包含gp和popular厂商的数据，直接使用gp_game_to_name映射
        merchant_game_grouped['游戏名'] = merchant_game_grouped['game'].map(
            lambda game_id: gp_game_to_name.get(normalize_id(game_id), normalize_id(game_id))
        )
        
        merchant_game_grouped.rename(columns={
            'currency': '货币'
        }, inplace=True)
        merchant_game_final_cols = [
            '商户名', '游戏名', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        merchant_game_grouped = merchant_game_grouped[merchant_game_final_cols]
        
        # 添加商户+货币合计行
        # 按商户名和货币分组计算合计
        merchant_currency_summary = merchant_game_grouped.groupby(['商户名', '货币']).agg({
            '总投注': 'sum',
            '总投注USD': 'sum', 
            '总派奖': 'sum',
            '总派奖USD': 'sum',
            '总局数': 'sum',
            'GGR': 'sum',
            'GGR-USD': 'sum'
        }).reset_index()
        
        # 计算RTP
        merchant_currency_summary['RTP'] = merchant_currency_summary.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1
        )
        
        # 设置USD汇率（使用原数据中的汇率，这里取平均值）
        merchant_currency_summary['USD汇率'] = merchant_game_grouped.groupby(['商户名', '货币'])['USD汇率'].mean().values
        
        # 设置游戏名为"合计"
        merchant_currency_summary['游戏名'] = '合计'
        
        # 重新排列列顺序
        merchant_currency_summary = merchant_currency_summary[merchant_game_final_cols]
        
        # 合并原数据和合计行
        merchant_game_with_summary = pd.concat([merchant_game_grouped, merchant_currency_summary], ignore_index=True)
        
        # 按商户名、货币、游戏名排序，确保合计行在对应商户数据的最后
        merchant_game_with_summary = merchant_game_with_summary.sort_values(['商户名', '货币', '游戏名'], 
                                                                          ascending=[True, True, False])
        
        # 导出到一个Excel文件的四个工作表
        with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
            # 商户厂商维度汇总表
            merchant_provider_grouped.to_excel(writer, index=False, sheet_name='商户厂商汇总')
            
            # 厂商货币维度汇总表
            provider_currency_grouped.to_excel(writer, index=False, sheet_name='厂商货币汇总')
            
            # 厂商游戏货币维度汇总表
            provider_game_grouped.to_excel(writer, index=False, sheet_name='厂商游戏汇总')
            
            # 商户游戏维度汇总表（包含商户+货币合计行）
            merchant_game_with_summary.to_excel(writer, index=False, sheet_name='商户游戏汇总')
            
            # 设置Excel格式
            workbook = writer.book
            
            # 设置商户厂商汇总表格式
            worksheet1 = writer.sheets['商户厂商汇总']
            num_format_4 = workbook.add_format({'num_format': '0.0000', 'align': 'right'})
            num_format_6 = workbook.add_format({'num_format': '0.000000', 'align': 'right'})
            num_format_2 = workbook.add_format({'num_format': '0.00', 'align': 'right'})
            num_format_int = workbook.add_format({'num_format': '0', 'align': 'right'})
            percent_format = workbook.add_format({'num_format': '0.00%', 'align': 'right'})
            text_format = workbook.add_format({'align': 'left'})
            
            columns1 = [
                ('A:A', 15, text_format),   # 商户名
                ('B:B', 15, text_format),   # 厂商
                ('C:C', 10, text_format),   # 货币
                ('D:D', 12, num_format_6),  # USD汇率
                ('E:E', 15, num_format_2),  # 总投注
                ('F:F', 15, num_format_4),  # 总投注USD
                ('G:G', 15, num_format_2),  # 总派奖
                ('H:H', 15, num_format_4),  # 总派奖USD
                ('I:I', 10, num_format_int),  # 总局数
                ('J:J', 10, percent_format),  # RTP
                ('K:K', 15, num_format_2),  # GGR
                ('L:L', 15, num_format_4),  # GGR-USD
            ]
            for col, width, fmt in columns1:
                worksheet1.set_column(col, width, fmt)
            
            # 设置厂商货币汇总表格式
            worksheet2 = writer.sheets['厂商货币汇总']
            columns2 = [
                ('A:A', 15, text_format),   # 厂商
                ('B:B', 10, text_format),   # 货币
                ('C:C', 12, num_format_6),  # USD汇率
                ('D:D', 15, num_format_2),  # 总投注
                ('E:E', 15, num_format_4),  # 总投注USD
                ('F:F', 15, num_format_2),  # 总派奖
                ('G:G', 15, num_format_4),  # 总派奖USD
                ('H:H', 10, num_format_int),  # 总局数
                ('I:I', 10, percent_format),  # RTP
                ('J:J', 15, num_format_2),  # GGR
                ('K:K', 15, num_format_4),  # GGR-USD
            ]
            for col, width, fmt in columns2:
                worksheet2.set_column(col, width, fmt)
            
            # 设置厂商游戏汇总表格式
            worksheet3 = writer.sheets['厂商游戏汇总']
            columns3 = [
                ('A:A', 15, text_format),   # 厂商
                ('B:B', 20, text_format),   # 游戏名
                ('C:C', 10, text_format),   # 货币
                ('D:D', 12, num_format_6),  # USD汇率
                ('E:E', 15, num_format_2),  # 总投注
                ('F:F', 15, num_format_4),  # 总投注USD
                ('G:G', 15, num_format_2),  # 总派奖
                ('H:H', 15, num_format_4),  # 总派奖USD
                ('I:I', 10, num_format_int),  # 总局数
                ('J:J', 10, percent_format),  # RTP
                ('K:K', 15, num_format_2),  # GGR
                ('L:L', 15, num_format_4),  # GGR-USD
            ]
            for col, width, fmt in columns3:
                worksheet3.set_column(col, width, fmt)
            
            # 设置商户游戏汇总表格式
            worksheet4 = writer.sheets['商户游戏汇总']
            columns4 = [
                ('A:A', 15, text_format),   # 商户名
                ('B:B', 25, text_format),   # 游戏名（加宽）
                ('C:C', 10, text_format),   # 货币
                ('D:D', 12, num_format_6),  # USD汇率
                ('E:E', 15, num_format_2),  # 总投注
                ('F:F', 15, num_format_4),  # 总投注USD
                ('G:G', 15, num_format_2),  # 总派奖
                ('H:H', 15, num_format_4),  # 总派奖USD
                ('I:I', 10, num_format_int),  # 总局数
                ('J:J', 10, percent_format),  # RTP
                ('K:K', 15, num_format_2),  # GGR
                ('L:L', 15, num_format_4),  # GGR-USD
            ]
            for col, width, fmt in columns4:
                worksheet4.set_column(col, width, fmt)
            
            # 为合计行添加加粗格式和空白行
            # 创建不同列的加粗格式，保持原有对齐方式
            bold_text_format = workbook.add_format({'bold': True, 'align': 'left'})
            bold_num_format_2 = workbook.add_format({'bold': True, 'align': 'right', 'num_format': '#,##0.00'})
            bold_num_format_4 = workbook.add_format({'bold': True, 'align': 'right', 'num_format': '#,##0.0000'})
            bold_num_format_6 = workbook.add_format({'bold': True, 'align': 'right', 'num_format': '#,##0.000000'})
            bold_num_format_int = workbook.add_format({'bold': True, 'align': 'right', 'num_format': '#,##0'})
            bold_percent_format = workbook.add_format({'bold': True, 'align': 'right', 'num_format': '0.00%'})
            
            # 获取商户游戏汇总表数据
            last_row = len(merchant_game_with_summary)
            
            # 遍历所有行，为游戏名为"合计"的行设置加粗格式
            for row_num in range(1, last_row + 1):
                game_name = merchant_game_with_summary.iloc[row_num - 1]['游戏名']
                if game_name == '合计':
                    # 根据列类型设置不同的加粗格式
                    for col_num, col_name in enumerate(merchant_game_with_summary.columns):
                        cell_value = merchant_game_with_summary.iloc[row_num - 1, col_num]
                        
                        # 根据列名设置对应的格式
                        if col_name == 'USD汇率':
                            worksheet4.write(row_num, col_num, cell_value, bold_num_format_6)
                        elif col_name in ['总投注USD', '总派奖USD', 'GGR-USD']:
                            worksheet4.write(row_num, col_num, cell_value, bold_num_format_4)
                        elif col_name in ['总投注', '总派奖', 'GGR']:
                            worksheet4.write(row_num, col_num, cell_value, bold_num_format_2)
                        elif col_name == '总局数':
                            worksheet4.write(row_num, col_num, cell_value, bold_num_format_int)
                        elif col_name == 'RTP':
                            worksheet4.write(row_num, col_num, cell_value, bold_percent_format)
                        else:
                            worksheet4.write(row_num, col_num, cell_value, bold_text_format)
                    
                    # 在合计行后插入空白行
                    if row_num < last_row:
                        worksheet4.set_row(row_num + 1, None, None, {'hidden': False, 'level': 0, 'collapsed': False})
        
        logger.info(f"周度汇总数据导出完成，文件名：{output_file}")
        logger.info("包含四个工作表：商户厂商汇总、厂商货币汇总、厂商游戏汇总、商户游戏汇总")
        
        return True, output_file
        
    except Exception as e:
        error_msg = f"周度数据处理失败：{str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg

def send_weekly_email(file_paths, logger, week_range_str, mode='manual'):
    """发送周度邮件"""
    try:
        # 测试SMTP连接
        smtp_success, smtp_message = test_smtp_connection(logger)
        if not smtp_success:
            return False, smtp_message

        msg = MIMEMultipart('mixed')
        msg['From'] = EMAIL_CONFIG['sender']
        msg['To'] = ', '.join(EMAIL_CONFIG['receivers'])
        
        if EMAIL_CONFIG.get('cc') and len(EMAIL_CONFIG['cc']) > 0:
            msg['Cc'] = ', '.join(EMAIL_CONFIG['cc'])
            all_receivers = EMAIL_CONFIG['receivers'] + EMAIL_CONFIG['cc']
        else:
            all_receivers = EMAIL_CONFIG['receivers']
        
        # 邮件主题和正文
        if mode == 'auto':
            subject = f'【定时】周度详细汇总报表 - {week_range_str}'
            body_text = f'''您好：

本邮件为【定时自动发送】，统计周期：{week_range_str}。
请查收附件中的周度详细汇总报表（包含四个工作表：商户厂商汇总、厂商货币汇总、厂商游戏汇总、商户游戏汇总）。

此邮件为系统自动发送，请勿直接回复。
如有问题请联系相关负责人。

祝好！'''
            body_html = f'''<html>
<head></head>
<body>
<h2>周度详细汇总报表</h2>
<p><strong>发送模式：</strong>定时自动发送</p>
<p><strong>统计周期：</strong>{week_range_str}</p>
<p>请查收附件中的周度详细汇总报表，包含以下四个工作表：</p>
<ul>
<li><strong>商户厂商汇总表</strong>：商户、厂商和货币维度统计数据</li>
<li><strong>厂商货币汇总表</strong>：厂商和货币维度统计数据</li>
<li><strong>厂商游戏汇总表</strong>：厂商、游戏和货币维度统计数据</li>
<li><strong>商户游戏汇总表</strong>：商户、游戏和货币维度统计数据（仅统计GP和Popular厂商）</li>
</ul>
<p><em>此邮件为系统自动发送，请勿直接回复。<br>
如有问题请联系相关负责人。</em></p>
<p>祝好！</p>
</body>
</html>'''
        else:
            subject = f'【即时】周度详细汇总报表 - {week_range_str}'
            body_text = f'''您好：

本邮件为【即时发送】，统计周期：{week_range_str}。
请查收附件中的周度详细汇总报表（包含四个工作表：商户厂商汇总、厂商货币汇总、厂商游戏汇总、商户游戏汇总）。

此邮件为系统自动发送，请勿直接回复。
如有问题请联系相关负责人。

祝好！'''
            body_html = f'''<html>
<head></head>
<body>
<h2>周度详细汇总报表</h2>
<p><strong>发送模式：</strong>即时发送</p>
<p><strong>统计周期：</strong>{week_range_str}</p>
<p>请查收附件中的周度详细汇总报表，包含以下四个工作表：</p>
<ul>
<li><strong>商户厂商汇总表</strong>：商户、厂商和货币维度统计数据</li>
<li><strong>厂商货币汇总表</strong>：厂商和货币维度统计数据</li>
<li><strong>厂商游戏汇总表</strong>：厂商、游戏和货币维度统计数据</li>
<li><strong>商户游戏汇总表</strong>：商户、游戏和货币维度统计数据（仅统计GP和Popular厂商）</li>
</ul>
<p><em>此邮件为系统自动发送，请勿直接回复。<br>
如有问题请联系相关负责人。</em></p>
<p>祝好！</p>
</body>
</html>'''
        
        msg['Subject'] = Header(subject, 'utf-8')
        
        # 创建multipart/alternative容器
        msg_body = MIMEMultipart('alternative')
        
        # 添加文本和HTML内容
        textpart = MIMEText(body_text.encode('utf-8'), 'plain', 'utf-8')
        htmlpart = MIMEText(body_html.encode('utf-8'), 'html', 'utf-8')
        
        msg_body.attach(textpart)
        msg_body.attach(htmlpart)
        msg.attach(msg_body)

        # 添加多个附件
        if not isinstance(file_paths, list):
            file_paths = [file_paths]
            
        for file_path in file_paths:
            try:
                with open(file_path, 'rb') as f:
                    part = MIMEApplication(f.read(), Name=os.path.basename(file_path))
                    filename = os.path.basename(file_path)
                    try:
                        filename.encode('ascii')
                        part.add_header('Content-Disposition', 'attachment', filename=filename)
                    except UnicodeEncodeError:
                        part.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', filename))
                    msg.attach(part)
                    logger.info(f"成功添加附件: {filename}")
            except FileNotFoundError:
                error_msg = f"附件文件不存在: {file_path}"
                logger.error(error_msg)
                return False, error_msg
            except Exception as e:
                error_msg = f"添加附件失败: {str(e)}"
                logger.error(error_msg)
                return False, error_msg

        # 发送邮件
        try:
            logger.info(f"正在连接SMTP服务器: {EMAIL_CONFIG['smtp_host']}:{EMAIL_CONFIG['smtp_port']}")
            with smtplib.SMTP_SSL(EMAIL_CONFIG['smtp_host'], EMAIL_CONFIG['smtp_port']) as server:
                logger.info("SMTP服务器连接成功")
                server.login(EMAIL_CONFIG['sender'], EMAIL_CONFIG['password'])
                logger.info("SMTP服务器登录成功")
                errors = server.send_message(msg)
                if not errors:
                    logger.info("邮件发送成功！")
                    return True, "邮件发送成功"
                else:
                    error_msg = f"发送失败的收件人: {errors}"
                    logger.error(error_msg)
                    return False, error_msg
        except Exception as e:
            error_msg = f"发送邮件失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    except Exception as e:
        error_msg = f"邮件处理失败：{str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return False, error_msg

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['auto', 'manual'], default='manual', help='auto:定时发送, manual:即时发送')
    parser.add_argument('--date', type=str, default=None, help='指定统计周期的起始日期，格式如2025-09-14')
    return parser.parse_args()

def get_target_week_dates(args):
    """根据参数获取目标周的日期范围"""
    if args.date:
        # 尝试多种日期格式
        date_formats = ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m']
        dt = None
        for fmt in date_formats:
            try:
                dt = datetime.strptime(args.date, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            # 如果所有格式都失败，使用当前时间
            dt = datetime.now()
            logger = setup_logging()
            logger.warning(f"无法解析日期参数: {args.date}，使用当前时间: {dt}")
    else:
        dt = datetime.now()
    
    # 计算上周的周一和周日（基于指定日期或当前日期）
    target_monday = dt - timedelta(days=dt.weekday() + 7)  # 减去7天得到上周
    target_sunday = target_monday + timedelta(days=6)
    
    return target_monday, target_sunday

def main():
    """主函数"""
    logger = setup_logging()
    logger.info("=== 开始执行周度导出和发送任务 ===")

    try:
        # 解析命令行参数
        args = parse_args()
        
        # 获取目标周的日期范围
        last_monday, last_sunday = get_target_week_dates(args)
        week_range_str = get_week_range_string(last_monday, last_sunday)
        
        logger.info(f"本次统计周期: {week_range_str}")
        logger.info(f"运行模式: {args.mode}")
        
        # 获取数据并导出Excel
        success, result = get_data_and_export_weekly(logger, last_monday, last_sunday)
        
        if not success:
            logger.error(f"数据导出失败：{result}")
            return
        
        # 发送邮件
        # 将返回的文件路径元组转换为列表
        if isinstance(result, tuple):
            file_paths = list(result)
        else:
            file_paths = [result]
        success, message = send_weekly_email(file_paths, logger, week_range_str, mode=args.mode)
        if success:
            logger.info("周度任务完成！")
        else:
            logger.error(f"任务失败：{message}")

    except Exception as e:
        logger.error(f"程序执行失败：{str(e)}\n{traceback.format_exc()}")
    
    finally:
        logger.info("=== 周度任务执行结束 ===")

if __name__ == "__main__":
    main()