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
    log_filename = f'export_and_send_{datetime.now().strftime("%Y%m")}.log'
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
EXPORT_DIR = os.environ.get('EXPORT_DIR', 'D:/cursor/excel')

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
    获取币种对USD的汇率（纯线上版）
    - 加密货币：用币安API获取对USDT的价格
    - 法币：优先用币安API，备用外汇API
    - 增加重试机制和备用API源
    """
    if not currency or currency.upper() == 'USD':
        return 1.0
    currency = currency.upper()
    
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
                        return round(rate, 4)
                
                if logger:
                    logger.warning(f"API {api_url} 返回状态码: {resp.status_code}")
                    
            except Exception as e:
                if logger:
                    logger.warning(f"API {api_url} 第{attempt+1}次尝试失败: {str(e)}")
                if attempt < 2:  # 不是最后一次尝试
                    time.sleep(3)  # 增加延迟时间
                    continue
                else:
                    break
    
    # 所有线上API都失败
    if logger:
        logger.error(f"所有线上汇率获取方式都失败，币种: {currency}")
    return 0

def get_data_and_export(month, logger):
    """从数据库获取数据并导出Excel（优化内存版）"""
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

        # 只获取前缀为stat_且后缀为YYYYMM的表
        sql = f"SHOW TABLES LIKE 'stat_{month}'"
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            table_names = [row[0] for row in result.fetchall()]
        # 只保留表名完全等于stat_YYYYMM的表
        table_names = [t for t in table_names if t == f'stat_{month}']
        if not table_names:
            error_msg = f"没有找到{month}月的stat_表！"
            logger.error(error_msg, exc_info=True)
            return False, error_msg

        temp_dfs = []
        for table in table_names:
            logger.info(f"正在读取表：{table}")
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
                useful_fields = [field_map[k] for k in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'game', 'count'] if field_map[k] is not None]
                logger.info(f"自动适配字段: {field_map}")
                fields_str = ', '.join(useful_fields)
                sql = f"SELECT {fields_str} FROM {table}"
                logger.info(f"{table} 不做任何时间筛选, SQL: {sql}")
                df = pd.read_sql(sql, engine)
                logger.info(f"{table} 字段: {df.columns.tolist()}")
                logger.info(f"{table} 数据样例:\n{df.head()}\n")
                if df.empty:
                    logger.info(f"{table} 为空，跳过")
                    return False, "所有表均无有效数据"
                m = re.search(r'stat_(\d{6})', table)
                df['date'] = m.group(1) if m else ''
                # 字段补齐并全部做str.strip()
                for col in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'date', 'game', 'count']:
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
                        logger.warning(f"{table} 字段 {col} 全为0 或缺失，请检查源表数据！")
                agg = df.groupby(['date', 'merchant', 'provider', 'currency', 'game']).agg(
                    pay_in=('pay_in', 'sum'),
                    pay_out=('pay_out', 'sum'),
                    count=('count', 'sum')
                ).reset_index()
                if agg.empty:
                    logger.info(f"{table} 聚合后为空，跳过")
                    return False, "所有表均无有效数据"
                logger.info(f'{table} 聚合后行数: {agg.shape[0]}')
                temp_dfs.append(agg)
                del df, agg
                gc.collect()
            except Exception as e:
                logger.error(f"读取表 {table} 失败: {str(e)}", exc_info=True)
                continue
        if not temp_dfs:
            logger.error("所有表均无有效数据，导出终止")
            return False, "所有表均无有效数据"
        # 合并所有表的聚合结果
        all_data = pd.concat(temp_dfs, ignore_index=True)
        logger.info(f'最终all_data行数: {all_data.shape[0]}')
        del temp_dfs
        gc.collect()
        # 再做一次全局groupby，确保所有分批聚合结果合并
        all_data = all_data.groupby(['date', 'merchant', 'provider', 'currency', 'game']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        logger.info(f'最终all_data全局groupby后行数: {all_data.shape[0]}')

        # 补齐字段（只在字段不存在时添加，不覆盖已有数据）
        for col in ['merchant', 'provider', 'currency', 'pay_in', 'pay_out', 'date', 'game', 'count']:
            if col not in all_data.columns:
                all_data[col] = None
                logger.warning(f"字段 {col} 不存在，已用空值填充")
        logger.info(f'all_data 字段: {all_data.columns.tolist()}')
        logger.info(f'all_data 数据样例:\n{all_data.head()}')

        # 汇总（不包含game字段，避免金额被拆分）
        grouped = all_data.groupby(['date', 'merchant', 'provider', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        logger.info(f'最终grouped行数: {grouped.shape[0]}')
        logger.info(f'grouped 数据样例:\n{grouped.head()}')

        def safe_year_month(x):
            try:
                if isinstance(x, str) and len(x) == 6 and x.isdigit():
                    return f"{x[:4]}/{x[4:6]}"
                else:
                    return ""
            except Exception:
                return ""

        grouped['时间'] = grouped['date'].apply(safe_year_month)

        # 汇率获取优化
        currency_list = grouped['currency'].drop_duplicates().tolist()
        exchange_rate_dict = {}
        failed_currencies = []
        logger.info("正在获取汇率...")
        for currency in tqdm(currency_list):
            rate = get_exchange_rate(currency, logger)
            exchange_rate_dict[currency] = rate
            if rate == 0:
                failed_currencies.append(currency)
        if failed_currencies:
            logger.warning(f"以下币种获取汇率失败: {set(failed_currencies)}")

        # merchant到merchant_name映射
        try:
            merchant_map_df = pd.read_sql("SELECT merchant_id, merchant_name FROM merchant_config", merchant_engine)
            merchant_map_df['merchant_id'] = merchant_map_df['merchant_id'].astype(str).str.strip()
            merchant_map_df['merchant_name'] = merchant_map_df['merchant_name'].astype(str).str.strip()
            merchant_to_name = dict(zip(merchant_map_df['merchant_id'], merchant_map_df['merchant_name']))
        except Exception as e:
            logger.error(f"读取merchant_config失败: {str(e)}", exc_info=True)
            merchant_to_name = {}

        # 强制转换为数值类型，防止object类型导致的乘法报错
        grouped['pay_in'] = pd.to_numeric(grouped['pay_in'], errors='coerce').fillna(0)
        grouped['pay_out'] = pd.to_numeric(grouped['pay_out'], errors='coerce').fillna(0)
        grouped['count'] = pd.to_numeric(grouped['count'], errors='coerce').fillna(0)
        grouped['USD汇率'] = grouped['currency'].map(exchange_rate_dict).round(4)
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
        final_cols = [
            '时间', '商户名', '厂商', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD', '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        grouped = grouped[final_cols]

        output_file = os.path.join(EXPORT_DIR, f'{month}_merchant_provider_currency.xlsx')
        dir_ok, error_msg = ensure_directory_exists(output_file)
        if not dir_ok:
            raise Exception(error_msg)
        output_file = get_available_filename(output_file)
        with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
            grouped.to_excel(writer, index=False, sheet_name='Sheet1')
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            num_format_4 = workbook.add_format({'num_format': '0.0000', 'align': 'right'})
            num_format_2 = workbook.add_format({'num_format': '0.00', 'align': 'right'})
            num_format_int = workbook.add_format({'num_format': '0', 'align': 'right'})
            percent_format = workbook.add_format({'num_format': '0.00%', 'align': 'right'})
            text_format = workbook.add_format({'align': 'left'})
            columns = [
                ('A:A', 10, text_format),   # 时间
                ('B:B', 15, text_format),   # 商户名
                ('C:C', 15, text_format),   # 厂商
                ('D:D', 10, text_format),   # 货币
                ('E:E', 12, num_format_4),  # USD汇率
                ('F:F', 15, num_format_2),  # 总投注（2位小数）
                ('G:G', 15, num_format_4),  # 总投注USD
                ('H:H', 15, num_format_2),  # 总派奖（2位小数）
                ('I:I', 15, num_format_4),  # 总派奖USD
                ('J:J', 10, num_format_int),  # 总局数
                ('K:K', 10, percent_format),  # RTP
                ('L:L', 15, num_format_2),  # GGR
                ('M:M', 15, num_format_4),  # GGR-USD
            ]
            set_excel_format(workbook, worksheet, columns, grouped.columns.values)
        logger.info(f"导出完成，文件名：{output_file}")

        # 导出 provider_currency 汇总表
        provider_output_file = os.path.join(EXPORT_DIR, f'{month}_provider_currency.xlsx')
        if os.path.exists(provider_output_file):
            os.remove(provider_output_file)
        provider_grouped = all_data.groupby(['date', 'provider', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        provider_grouped['时间'] = provider_grouped['date'].apply(safe_year_month)
        provider_grouped['总投注'] = pd.to_numeric(provider_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_grouped['总派奖'] = pd.to_numeric(provider_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_grouped['总局数'] = pd.to_numeric(provider_grouped['count'], errors='coerce').fillna(0)
        provider_grouped['USD汇率'] = provider_grouped['currency'].map(exchange_rate_dict).round(4)
        provider_grouped['USD汇率'] = pd.to_numeric(provider_grouped['USD汇率'], errors='coerce').fillna(0)
        provider_grouped['总投注'] = pd.to_numeric(provider_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_grouped['总派奖'] = pd.to_numeric(provider_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_grouped['总投注USD'] = (provider_grouped['总投注'] * provider_grouped['USD汇率']).round(4)
        provider_grouped['总派奖USD'] = (provider_grouped['总派奖'] * provider_grouped['USD汇率']).round(4)
        provider_grouped['总投注'] = pd.to_numeric(provider_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_grouped['总派奖'] = pd.to_numeric(provider_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_grouped['总投注USD'] = (provider_grouped['总投注'] * provider_grouped['USD汇率']).round(4)
        provider_grouped['总派奖USD'] = (provider_grouped['总派奖'] * provider_grouped['USD汇率']).round(4)
        provider_grouped['总局数'] = pd.to_numeric(provider_grouped['count'], errors='coerce').fillna(0)
        provider_grouped['RTP'] = provider_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        provider_grouped['GGR'] = (provider_grouped['总投注'] - provider_grouped['总派奖']).round(2)
        provider_grouped['GGR-USD'] = (provider_grouped['总投注USD'] - provider_grouped['总派奖USD']).round(4)
        provider_grouped.rename(columns={
            'provider': '厂商',
            'currency': '货币'
        }, inplace=True)
        provider_final_cols = [
            '时间', '厂商', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        provider_grouped = provider_grouped[provider_final_cols]
        with pd.ExcelWriter(provider_output_file, engine='xlsxwriter') as writer:
            provider_grouped.to_excel(writer, index=False, sheet_name='Sheet1')
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            num_format_4 = workbook.add_format({'num_format': '0.0000', 'align': 'right'})
            num_format_2 = workbook.add_format({'num_format': '0.00', 'align': 'right'})
            num_format_int = workbook.add_format({'num_format': '0', 'align': 'right'})
            percent_format = workbook.add_format({'num_format': '0.00%', 'align': 'right'})
            text_format = workbook.add_format({'align': 'left'})
            worksheet.set_column('A:A', 10, text_format)   # 时间
            worksheet.set_column('B:B', 15, text_format)   # 厂商
            worksheet.set_column('C:C', 10, text_format)   # 货币
            worksheet.set_column('D:D', 12, num_format_4)  # USD汇率
            worksheet.set_column('E:E', 15, num_format_2)  # 总投注（2位小数）
            worksheet.set_column('F:F', 15, num_format_4)  # 总投注USD
            worksheet.set_column('G:G', 15, num_format_2)  # 总派奖（2位小数）
            worksheet.set_column('H:H', 15, num_format_4)  # 总派奖USD
            worksheet.set_column('I:I', 10, num_format_int)  # 总局数
            worksheet.set_column('J:J', 10, percent_format)  # RTP
            worksheet.set_column('K:K', 15, num_format_2)  # GGR
            worksheet.set_column('L:L', 15, num_format_4)  # GGR-USD
            header_format = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#D9D9D9'})
            for col_num, value in enumerate(provider_grouped.columns.values):
                worksheet.write(0, col_num, value, header_format)
        logger.info(f"导出完成，文件名：{provider_output_file}")

        # 保证 all_data['game'] 为字符串且去除小数点和空格
        all_data['game'] = all_data['game'].astype(str).str.strip().str.replace(r'\\.0$', '', regex=True)

        # 连接gmp_game_platform数据库，获取game到name的映射
        try:
            # 获取基础游戏列表映射
            game_map_df = pd.read_sql("SELECT id, code, name FROM gmp_game_list", gmp_engine)
            game_map_df['id'] = game_map_df['id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
            game_map_df['code'] = game_map_df['code'].astype(str).str.strip()
            game_map_df['name'] = game_map_df['name'].astype(str).str.strip()
            logger.info(f"gmp_game_list 映射表行数: {game_map_df.shape[0]}")
            game_id_to_name = dict(zip(game_map_df['id'], game_map_df['name']))
            game_code_to_name = dict(zip(game_map_df['code'], game_map_df['name']))
            
            # 调试：检查game_id_to_name字典的内容
            logger.info(f"调试：game_id_to_name字典的前5个键值对: {list(game_id_to_name.items())[:5]}")
            logger.info(f"调试：检查字典中是否有id=14: {'14' in game_id_to_name}")
            logger.info(f"调试：检查字典中是否有id=178678: {'178678' in game_id_to_name}")
            if '14' in game_id_to_name:
                logger.info(f"调试：id=14对应的游戏名: {game_id_to_name['14']}")
            
            # 先查看gmp_merchant_game_list表结构
            try:
                columns_result = pd.read_sql("SHOW COLUMNS FROM gmp_merchant_game_list", gmp_engine)
                logger.info(f"gmp_merchant_game_list表字段: {columns_result['Field'].tolist()}")
            except Exception as e:
                logger.warning(f"无法查看gmp_merchant_game_list表结构: {str(e)}")
            
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
                game_name = game_id_to_name.get(source_id, game_id)
                gp_game_to_name[game_id] = game_name
            
            logger.info(f"gp厂商游戏映射数量: {len(gp_game_to_name)}")
            
            # 调试：检查具体的映射情况
            logger.info(f"调试：检查game_id=1697709381286的映射")
            if '1697709381286' in gp_id_to_source:
                source_id = gp_id_to_source['1697709381286']
                logger.info(f"game_id=1697709381286 -> source_id={source_id}")
                if source_id in game_id_to_name:
                    game_name = game_id_to_name[source_id]
                    logger.info(f"source_id={source_id} -> game_name={game_name}")
                else:
                    logger.warning(f"source_id={source_id} 在game_id_to_name中未找到")
            else:
                logger.warning(f"game_id=1697709381286 在gp_id_to_source中未找到")
            
            # 调试：检查game_id=178678的映射
            logger.info(f"调试：检查game_id=178678的映射")
            if '178678' in game_id_to_name:
                game_name = game_id_to_name['178678']
                logger.info(f"game_id=178678 -> game_name={game_name}")
            else:
                logger.warning(f"game_id=178678 在game_id_to_name中未找到")
            
        except Exception as e:
            logger.error(f"读取游戏映射表失败: {str(e)}")
            game_id_to_name = {}
            game_code_to_name = {}
            gp_game_to_name = {}

        # 导出 provider_game_currency 汇总表
        provider_game_output_file = os.path.join(EXPORT_DIR, f'{month}_provider_game_currency.xlsx')
        if os.path.exists(provider_game_output_file):
            os.remove(provider_game_output_file)
        provider_game_grouped = all_data.groupby(['date', 'provider', 'game', 'currency']).agg(
            pay_in=('pay_in', 'sum'),
            pay_out=('pay_out', 'sum'),
            count=('count', 'sum')
        ).reset_index()
        provider_game_grouped['时间'] = provider_game_grouped['date'].apply(safe_year_month)
        provider_game_grouped['总投注'] = pd.to_numeric(provider_game_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总派奖'] = pd.to_numeric(provider_game_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总局数'] = pd.to_numeric(provider_game_grouped['count'], errors='coerce').fillna(0)
        provider_game_grouped['USD汇率'] = provider_game_grouped['currency'].map(exchange_rate_dict).round(4)
        provider_game_grouped['USD汇率'] = pd.to_numeric(provider_game_grouped['USD汇率'], errors='coerce').fillna(0)
        provider_game_grouped['总投注'] = pd.to_numeric(provider_game_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总派奖'] = pd.to_numeric(provider_game_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总投注USD'] = (provider_game_grouped['总投注'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['总派奖USD'] = (provider_game_grouped['总派奖'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['总投注'] = pd.to_numeric(provider_game_grouped['pay_in'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总派奖'] = pd.to_numeric(provider_game_grouped['pay_out'], errors='coerce').fillna(0).round(2)
        provider_game_grouped['总投注USD'] = (provider_game_grouped['总投注'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['总派奖USD'] = (provider_game_grouped['总派奖'] * provider_game_grouped['USD汇率']).round(4)
        provider_game_grouped['总局数'] = pd.to_numeric(provider_game_grouped['count'], errors='coerce').fillna(0)
        provider_game_grouped['RTP'] = provider_game_grouped.apply(
            lambda row: f"{(row['总派奖'] / row['总投注'] * 100):.2f}%" if row['总投注'] > 0 else "0.00%", axis=1)
        provider_game_grouped['GGR'] = (provider_game_grouped['总投注'] - provider_game_grouped['总派奖']).round(2)
        provider_game_grouped['GGR-USD'] = (provider_game_grouped['总投注USD'] - provider_game_grouped['总派奖USD']).round(4)
        provider_game_grouped['game'] = provider_game_grouped['game'].astype(str).str.strip()
        # 根据provider决定使用不同的映射策略
        def get_game_name(row):
            if row['provider'] in ['gp', 'popular']:
                # 当provider=gp或popular时，使用特殊的两步映射：game_id -> source_id -> game_name
                return gp_game_to_name.get(row['game'], row['game'])
            else:
                # 其他情况使用id字段映射
                return game_id_to_name.get(row['game'], row['game'])
        
        provider_game_grouped['游戏名'] = provider_game_grouped.apply(get_game_name, axis=1)
        unknown_games = provider_game_grouped[provider_game_grouped['游戏名'] == provider_game_grouped['game']]['game'].unique()
        if len(unknown_games) > 0:
            logger.warning(f"未匹配到游戏名的 game: {unknown_games[:10]} 共{len(unknown_games)}个")
        provider_game_grouped.rename(columns={
            'provider': '厂商',
            'currency': '货币'
        }, inplace=True)
        provider_game_final_cols = [
            '时间', '厂商', '游戏名', '货币', 'USD汇率',
            '总投注', '总投注USD', '总派奖', '总派奖USD',
            '总局数', 'RTP', 'GGR', 'GGR-USD'
        ]
        provider_game_grouped = provider_game_grouped[provider_game_final_cols]
        with pd.ExcelWriter(provider_game_output_file, engine='xlsxwriter') as writer:
            provider_game_grouped.to_excel(writer, index=False, sheet_name='Sheet1')
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            num_format_4 = workbook.add_format({'num_format': '0.0000', 'align': 'right'})
            num_format_2 = workbook.add_format({'num_format': '0.00', 'align': 'right'})
            num_format_int = workbook.add_format({'num_format': '0', 'align': 'right'})
            percent_format = workbook.add_format({'num_format': '0.00%', 'align': 'right'})
            text_format = workbook.add_format({'align': 'left'})
            worksheet.set_column('A:A', 10, text_format)   # 时间
            worksheet.set_column('B:B', 15, text_format)   # 厂商
            worksheet.set_column('C:C', 20, text_format)   # 游戏名
            worksheet.set_column('D:D', 10, text_format)   # 货币
            worksheet.set_column('E:E', 12, num_format_4)  # USD汇率
            worksheet.set_column('F:F', 15, num_format_2)  # 总投注（2位小数）
            worksheet.set_column('G:G', 15, num_format_4)  # 总投注USD
            worksheet.set_column('H:H', 15, num_format_2)  # 总派奖（2位小数）
            worksheet.set_column('I:I', 15, num_format_4)  # 总派奖USD
            worksheet.set_column('J:J', 10, num_format_int)  # 总局数
            worksheet.set_column('K:K', 10, percent_format)  # RTP
            worksheet.set_column('L:L', 15, num_format_2)  # GGR
            worksheet.set_column('M:M', 15, num_format_4)  # GGR-USD
            header_format = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#D9D9D9'})
            for col_num, value in enumerate(provider_game_grouped.columns.values):
                worksheet.write(0, col_num, value, header_format)
        logger.info(f"导出完成，文件名：{provider_game_output_file}")

        # 导出无汇率明细
        no_rate = grouped[grouped['USD汇率'] == 0]
        if not no_rate.empty:
            no_rate_file = os.path.join(EXPORT_DIR, f'{month}_无汇率币种明细.xlsx')
            no_rate_file = get_available_filename(no_rate_file)
            with pd.ExcelWriter(no_rate_file, engine='xlsxwriter') as writer:
                no_rate.to_excel(writer, index=False)
                logger.info(f"已导出无汇率币种明细：{no_rate_file}")

        return True, (output_file, provider_output_file, provider_game_output_file)

    except Exception as e:
        error_msg = f"数据处理失败：{str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['auto', 'manual'], default='manual', help='auto:定时发送, manual:即时发送')
    parser.add_argument('--date', type=str, default=None, help='定时任务传递的时间，格式如2024-06-30 00:00:00')
    return parser.parse_args()

def get_target_month(args):
    if args.date:
        dt = datetime.strptime(args.date, '%Y-%m-%d %H:%M:%S')
    else:
        dt = datetime.now()
    return dt.strftime('%Y%m'), dt

def send_email(file_paths, logger, mode='manual', month_str=None):
    """发送邮件，支持多个附件"""
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
        
        # 邮件主题和正文根据模式调整
        if not month_str:
            month_str = datetime.now().strftime('%Y年%m月')
        else:
            month_str = f"{month_str[:4]}年{month_str[4:]}月"
        if mode == 'auto':
            subject = f'【定时】月度详细汇总报表 - {month_str}'
            body_text = f'''您好：

本邮件为【定时自动发送】，统计月份：{month_str}。
请查收附件中的月度详细汇总报表。

此邮件为系统自动发送，请勿直接回复。
如有问题请联系相关负责人。

祝好！'''
            body_html = f'''<html>
<head></head>
<body>
<h2>月度详细汇总报表</h2>
<p><strong>发送模式：</strong>定时自动发送</p>
<p><strong>统计月份：</strong>{month_str}</p>
<p>请查收附件中的月度详细汇总报表。</p>
<p><em>此邮件为系统自动发送，请勿直接回复。<br>
如有问题请联系相关负责人。</em></p>
<p>祝好！</p>
</body>
</html>'''
        else:
            subject = f'【即时】月度详细汇总报表 - {month_str}'
            body_text = f'''您好：

本邮件为【即时发送】，统计月份：{month_str}。
请查收附件中的月度详细汇总报表。

此邮件为系统自动发送，请勿直接回复。
如有问题请联系相关负责人。

祝好！'''
            body_html = f'''<html>
<head></head>
<body>
<h2>月度详细汇总报表</h2>
<p><strong>发送模式：</strong>即时发送</p>
<p><strong>统计月份：</strong>{month_str}</p>
<p>请查收附件中的月度详细汇总报表。</p>
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

def main():
    """主函数"""
    logger = setup_logging()
    logger.info("=== 开始执行导出和发送任务 ===")

    try:
        # 解析参数，确定月份
        args = parse_args()
        month, dt = get_target_month(args)
        logger.info(f"本次统计月份: {month}，模式: {args.mode}，基准时间: {dt}")
        # 获取数据并导出Excel
        success, result = get_data_and_export(month, logger)
        
        if not success:
            logger.error(f"数据导出失败：{result}")
            return
        
        # 组装三个要发送的文件名
        main_file, provider_file, provider_game_file = result
        file_paths = [main_file, provider_file, provider_game_file]
        
        # 发送邮件，传递模式和月份
        success, message = send_email(file_paths, logger, mode=args.mode, month_str=month)
        if success:
            logger.info("任务完成！")
        else:
            logger.error(f"任务失败：{message}")

    except Exception as e:
        logger.error(f"程序执行失败：{str(e)}\n{traceback.format_exc()}")
    
    finally:
        logger.info("=== 任务执行结束 ===")

if __name__ == "__main__":
    main()