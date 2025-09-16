#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试游戏名映射关系
"""

import pandas as pd
import logging
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

# 数据库配置
GMP_DB_CONFIG = {
    'host': os.environ.get('GMP_DB_HOST'),
    'port': os.environ.get('GMP_DB_PORT', '3306'),
    'user': os.environ.get('GMP_DB_USER'),
    'password': os.environ.get('GMP_DB_PASSWORD'),
    'database': os.environ.get('GMP_DB_DATABASE')
}

def debug_mapping():
    """调试映射关系"""
    try:
        # 创建数据库连接
        gmp_engine = create_engine(
            f"mysql+pymysql://{GMP_DB_CONFIG['user']}:{GMP_DB_CONFIG['password']}@{GMP_DB_CONFIG['host']}:{GMP_DB_CONFIG['port']}/{GMP_DB_CONFIG['database']}?charset=utf8mb4"
        )
        
        print("=== 数据库连接测试 ===")
        with gmp_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("数据库连接成功")
        
        print("\n=== gmp_game_list 表结构 ===")
        game_df = pd.read_sql("SELECT * FROM gmp_game_list LIMIT 5", gmp_engine)
        print("表结构:")
        print(game_df.columns.tolist())
        print("\n数据:")
        print(game_df)
        
        print("\n=== gmp_merchant_game_list 表结构 ===")
        merchant_df = pd.read_sql("SELECT * FROM gmp_merchant_game_list LIMIT 5", gmp_engine)
        print("表结构:")
        print(merchant_df.columns.tolist())
        print("\n数据:")
        print(merchant_df)
        
        print("\n=== 检查特定游戏ID 178678 ===")
        # 检查gmp_game_list中是否有178678
        game_178678 = pd.read_sql("SELECT * FROM gmp_game_list WHERE id = '178678' OR code = '178678'", gmp_engine)
        print("在gmp_game_list中查找178678:")
        print(game_178678)
        
        # 检查gmp_merchant_game_list中是否有178678
        merchant_178678 = pd.read_sql("SELECT * FROM gmp_merchant_game_list WHERE id = '178678' OR source_id = '178678'", gmp_engine)
        print("在gmp_merchant_game_list中查找178678:")
        print(merchant_178678)
        
        print("\n=== 检查特定游戏ID 1697709381286 ===")
        # 检查gmp_game_list中是否有1697709381286
        game_1697709381286 = pd.read_sql("SELECT * FROM gmp_game_list WHERE id = '1697709381286' OR code = '1697709381286'", gmp_engine)
        print("在gmp_game_list中查找1697709381286:")
        print(game_1697709381286)
        
        # 检查gmp_merchant_game_list中是否有1697709381286
        merchant_1697709381286 = pd.read_sql("SELECT * FROM gmp_merchant_game_list WHERE id = '1697709381286'", gmp_engine)
        print("在gmp_merchant_game_list中查找1697709381286:")
        print(merchant_1697709381286)
        
        # 检查source_id对应的游戏名称
        if not merchant_1697709381286.empty:
            source_id = merchant_1697709381286.iloc[0]['source_id']
            print(f"\n检查source_id {source_id} 对应的游戏名称:")
            source_game = pd.read_sql(f"SELECT * FROM gmp_game_list WHERE id = '{source_id}' OR code = '{source_id}'", gmp_engine)
            print(source_game)
        
        print("\n=== 完整的gmp_game_list数据 ===")
        all_games = pd.read_sql("SELECT id, code, name FROM gmp_game_list", gmp_engine)
        print("所有游戏映射:")
        print(all_games)
        
        print("\n=== 完整的gmp_merchant_game_list数据 ===")
        all_merchant_games = pd.read_sql("SELECT id, source_id FROM gmp_merchant_game_list", gmp_engine)
        print("所有商户游戏映射:")
        print(all_merchant_games.head(20))
        
        return True
        
    except Exception as e:
        logger.error(f"调试失败: {str(e)}", exc_info=True)
        return False

if __name__ == "__main__":
    debug_mapping()