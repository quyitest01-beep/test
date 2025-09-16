#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试游戏名映射功能
"""

import pandas as pd
import logging
from sqlalchemy import create_engine
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
                    # 查询gmp_game_list表，根据source_id查找游戏名称
                    query = f"SELECT name FROM gmp_game_list WHERE id = {source_id}"
                    result = gmp_engine.execute(query).fetchone()
                    if result and result[0]:
                        game_name = result[0]
                except Exception:
                    # 如果查询失败，保持原值
                    pass
            
            gp_game_to_name[game_id] = game_name
        
        return game_id_to_name, gp_game_to_name
        
    except Exception as e:
        logger.error(f"读取gmp_game_list或gmp_merchant_game_list失败: {str(e)}", exc_info=True)
        return {}, {}

def test_mapping():
    """测试游戏名映射"""
    try:
        # 创建数据库连接
        gmp_engine = create_engine(
            f"mysql+pymysql://{GMP_DB_CONFIG['user']}:{GMP_DB_CONFIG['password']}@{GMP_DB_CONFIG['host']}:{GMP_DB_CONFIG['port']}/{GMP_DB_CONFIG['database']}?charset=utf8mb4"
        )
        
        # 获取游戏映射
        game_id_to_name, gp_game_to_name = get_game_mappings(gmp_engine, logger)
        
        print("=== 游戏映射测试 ===")
        print(f"game_id_to_name 映射数量: {len(game_id_to_name)}")
        print(f"gp_game_to_name 映射数量: {len(gp_game_to_name)}")
        
        # 测试特定的游戏ID
        test_game_ids = ['178678', '1697709381286']
        
        print("\n=== 特定游戏ID映射测试 ===")
        for game_id in test_game_ids:
            # 测试普通映射
            normal_mapping = game_id_to_name.get(game_id, f"未找到映射({game_id})")
            # 测试GP映射
            gp_mapping = gp_game_to_name.get(game_id, f"未找到GP映射({game_id})")
            
            print(f"游戏ID {game_id}:")
            print(f"  普通映射: {normal_mapping}")
            print(f"  GP映射: {gp_mapping}")
        
        # 显示部分映射示例
        print("\n=== 映射表示例 ===")
        print("game_id_to_name 前5项:")
        for i, (k, v) in enumerate(list(game_id_to_name.items())[:5]):
            print(f"  {k} -> {v}")
        
        print("\ngp_game_to_name 前5项:")
        for i, (k, v) in enumerate(list(gp_game_to_name.items())[:5]):
            print(f"  {k} -> {v}")
        
        return True
        
    except Exception as e:
        logger.error(f"测试失败: {str(e)}", exc_info=True)
        return False

if __name__ == "__main__":
    test_mapping()