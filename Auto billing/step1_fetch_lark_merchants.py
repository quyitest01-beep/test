#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
步骤1：从Lark表拉取商户信息和费率
生成 unified_merchants_*.json 文件
"""

import os
import json
import sys
from datetime import datetime
from lark_client import LarkClient
from dotenv import load_dotenv

def main():
    print("[INFO] 开始从Lark表拉取商户信息和费率...")
    
    try:
        # 创建Lark客户端
        lark_client = LarkClient()
        
        # 获取表格数据
        print("[INFO] 正在获取Lark表格数据...")
        
        # 加载 .env 文件
        load_dotenv()
        
        # 从环境变量读取表格信息
        spreadsheet_token1 = os.getenv('LARK_SPREADSHEET_TOKEN')   # 表1的token
        spreadsheet_token2 = os.getenv('LARK_SPREADSHEET_TOKEN2')  # 表2的token
        sheet1_id = os.getenv('LARK_SHEET_ID')      # 表1的sheet ID
        sheet2_id = os.getenv('LARK_SHEET_ID2')    # 表2的sheet ID
        
        if not all([spreadsheet_token1, spreadsheet_token2, sheet1_id, sheet2_id]):
            print("[ERROR] Lark配置不完整，请检查 .env 文件")
            print("[INFO] 需要配置以下环境变量：")
            print("  LARK_SPREADSHEET_TOKEN - 表格1的token")
            print("  LARK_SPREADSHEET_TOKEN2 - 表格2的token")
            print("  LARK_SHEET_ID - 表格1的sheet ID")
            print("  LARK_SHEET_ID2 - 表格2的sheet ID")
            sys.exit(1)
        
        # 获取主商户信息（表1）
        print("[INFO] 获取主商户信息...")
        print(f"[DEBUG] 使用 token: {spreadsheet_token1}, sheet_id: {sheet1_id}")
        main_merchants_data = lark_client.get_sheet_data(spreadsheet_token1, sheet1_id)
        
        if main_merchants_data:
            print(f"[DEBUG] 表1数据行数: {len(main_merchants_data)}")
            if main_merchants_data:
                print(f"[DEBUG] 表1第一行: {main_merchants_data[0]}")
        else:
            print("[WARNING] 表1数据为空")
        
        # 获取费率信息（表2）
        print("[INFO] 获取费率信息...")
        print(f"[DEBUG] 使用 token: {spreadsheet_token2}, sheet_id: {sheet2_id}")
        fee_rate_data = lark_client.get_sheet_data(spreadsheet_token2, sheet2_id)
        
        if fee_rate_data:
            print(f"[DEBUG] 表2数据行数: {len(fee_rate_data)}")
            if fee_rate_data:
                print(f"[DEBUG] 表2第一行: {fee_rate_data[0]}")
        else:
            print("[WARNING] 表2数据为空")
        
        # 处理主商户数据
        main_merchants = {}
        if main_merchants_data and len(main_merchants_data) > 1:
            headers = main_merchants_data[0]
            
            # 查找关键列索引
            merchant_idx = None
            merchant_name_idx = None
            email_idx = None
            tg_group_idx = None
            status_idx = None
            environment_idx = None
            
            # 添加调试信息
            print(f"[DEBUG] 表1第一行: {headers}")
            
            for i, header in enumerate(headers):
                header_lower = str(header).lower()
                if '主商户' in header_lower or 'merchant' in header_lower:
                    merchant_idx = i  # 主商户字段 - 存储主商户名称
                    print(f"[DEBUG] 找到主商户列: 索引{i}, 值'{header}'")
                elif '子商户名称' in header_lower or 'merchant_name' in header_lower:
                    merchant_name_idx = i  # 子商户名称字段 - 存储子商户名称
                    print(f"[DEBUG] 找到子商户名称列: 索引{i}, 值'{header}'")
                elif '邮箱' in header_lower or 'email' in header_lower:
                    email_idx = i
                    print(f"[DEBUG] 找到邮箱列: 索引{i}, 值'{header}'")
                elif 'tg群' in header_lower or 'telegram' in header_lower:
                    tg_group_idx = i
                    print(f"[DEBUG] 找到TG群列: 索引{i}, 值'{header}'")
                elif '状态' in header_lower or 'status' in header_lower:
                    status_idx = i
                    print(f"[DEBUG] 找到状态列: 索引{i}, 值'{header}'")
                elif '环境' in header_lower or 'environment' in header_lower:
                    environment_idx = i
                    print(f"[DEBUG] 找到环境列: 索引{i}, 值'{header}'")
            
            print(f"[DEBUG] 列索引: merchant_idx={merchant_idx}, merchant_name_idx={merchant_name_idx}, status_idx={status_idx}, environment_idx={environment_idx}")
            
            # 处理数据行
            processed_count = 0
            skipped_count = 0
            
            for row_idx, row in enumerate(main_merchants_data[1:], 1):
                if len(row) > max(filter(None, [merchant_idx, merchant_name_idx, email_idx, tg_group_idx, status_idx, environment_idx])):
                    # 根据用户更正：merchant_idx对应主商户字段，merchant_name_idx对应子商户名称字段
                    master_merchant_name = str(row[merchant_idx]).strip() if merchant_idx is not None else ''  # 主商户名称
                    sub_merchant_name = str(row[merchant_name_idx]).strip() if merchant_name_idx is not None else ''  # 子商户名称
                    email = str(row[email_idx]).strip() if email_idx is not None else ''
                    tg_group = str(row[tg_group_idx]).strip() if tg_group_idx is not None else ''
                    status = str(row[status_idx]).strip() if status_idx is not None else ''
                    environment = str(row[environment_idx]).strip() if environment_idx is not None else ''
                    
                    # 调试信息：检查betfiery行
                    if 'betfiery' in str(row).lower():
                        print(f"[DEBUG] 找到betfiery行 {row_idx}: master='{master_merchant_name}', sub='{sub_merchant_name}', status='{status}', environment='{environment}'")
                    
                    # 关键修复：只处理环境为"生产"且状态为"正常"的商户
                    if (master_merchant_name and sub_merchant_name and 
                        environment == '生产' and status == '正常'):
                        
                        processed_count += 1
                        
                        # 检查这个主商户是否已经存在
                        if master_merchant_name not in main_merchants:
                            # 使用主商户名称作为key，存储主商户信息
                            main_merchants[master_merchant_name] = {
                                'merchant_id': master_merchant_name,  # 主商户名称作为ID
                                'merchant_name': master_merchant_name,  # 主商户名称
                                'sub_merchant_name': sub_merchant_name,  # 子商户名称
                                'emails': [],  # 邮箱列表，将从表2更新
                                'tg_chat_id': None,  # TG Chat ID，将从表2更新
                                'status': status,
                                'environment': environment,
                                'fee_rate': 0.0,  # 默认费率，将从sheet2更新
                                'sub_merchants': [sub_merchant_name]  # 初始化子商户数组，包含第一个子商户
                            }
                            
                            # 调试信息：创建新的主商户
                            if master_merchant_name == 'RD1':
                                print(f"[DEBUG] 创建RD1主商户，子商户: {sub_merchant_name}")
                                print(f"[DEBUG] RD1初始子商户列表: {main_merchants[master_merchant_name]['sub_merchants']}")
                        else:
                            # 如果主商户已存在，更新子商户信息（可能是多个子商户）
                            existing = main_merchants[master_merchant_name]
                            if 'sub_merchants' not in existing:
                                existing['sub_merchants'] = []
                            # 避免重复添加相同的子商户
                            if sub_merchant_name not in existing['sub_merchants']:
                                existing['sub_merchants'].append(sub_merchant_name)
                                
                                # 调试信息：添加子商户到RD1
                                if master_merchant_name == 'RD1':
                                    print(f"[DEBUG] 添加子商户到RD1: {sub_merchant_name}")
                                    print(f"[DEBUG] RD1当前子商户列表: {existing['sub_merchants']}")
                    else:
                        skipped_count += 1
                        # 调试信息：检查被跳过的betfiery行
                        if 'betfiery' in str(row).lower():
                            print(f"[DEBUG] betfiery行被跳过: master='{master_merchant_name}', sub='{sub_merchant_name}', status='{status}', environment='{environment}'")
            
            print(f"[DEBUG] 处理统计: 处理{processed_count}行, 跳过{skipped_count}行")
        
        # 处理费率数据
        if fee_rate_data and len(fee_rate_data) > 1:
            fee_headers = fee_rate_data[0]
            
            # 查找费率相关列
            fee_merchant_idx = None
            fee_rate_idx = None
            fee_email_idx = None
            fee_tg_chat_id_idx = None
            
            for i, header in enumerate(fee_headers):
                if header is None:
                    continue
                header_lower = str(header).lower()
                if '主商户' in header_lower or 'merchant' in header_lower:
                    fee_merchant_idx = i
                elif '费率' in header_lower or 'fee' in header_lower or 'rate' in header_lower:
                    fee_rate_idx = i
                elif '对账邮箱' in header_lower or 'email' in header_lower:
                    fee_email_idx = i
                elif '对账tg群的chat_id' in header_lower or 'tg_chat_id' in header_lower or 'chat_id' in header_lower:
                    fee_tg_chat_id_idx = i
            
            print(f"[DEBUG] 费率表列索引: fee_merchant_idx={fee_merchant_idx}, fee_rate_idx={fee_rate_idx}, fee_email_idx={fee_email_idx}, fee_tg_chat_id_idx={fee_tg_chat_id_idx}")
            
            # 更新主商户的费率信息和邮箱/TG配置
            if fee_merchant_idx is not None and fee_rate_idx is not None:
                for row in fee_rate_data[1:]:
                    if len(row) > max(filter(None, [fee_merchant_idx, fee_rate_idx, fee_email_idx, fee_tg_chat_id_idx])):
                        fee_merchant = str(row[fee_merchant_idx]).strip()
                        try:
                            fee_rate = float(row[fee_rate_idx]) if row[fee_rate_idx] else 0.0
                        except (ValueError, TypeError):
                            fee_rate = 0.0
                        
                        # 获取邮箱和TG配置
                        email_raw = row[fee_email_idx] if fee_email_idx is not None and row[fee_email_idx] else ""
                        tg_chat_id = str(row[fee_tg_chat_id_idx]).strip() if fee_tg_chat_id_idx is not None and row[fee_tg_chat_id_idx] else ""
                        
                        # 处理邮箱数据格式（可能是复杂对象或字符串）
                        email = ""
                        if email_raw:
                            if isinstance(email_raw, str):
                                email = email_raw.strip()
                            elif isinstance(email_raw, list) and len(email_raw) > 0:
                                # 处理复杂对象格式
                                email_item = email_raw[0]
                                if isinstance(email_item, dict) and 'text' in email_item:
                                    email = email_item['text'].strip()
                        
                        # 匹配商户并更新费率、邮箱和TG配置
                        for merchant_id, merchant_info in main_merchants.items():
                            # 根据用户更正：使用主商户名称进行匹配
                            if (merchant_info['merchant_name'] == fee_merchant or 
                                merchant_id == fee_merchant):
                                merchant_info['fee_rate'] = fee_rate
                                
                                # 更新邮箱配置
                                if email:
                                    if 'emails' not in merchant_info:
                                        merchant_info['emails'] = []
                                    # 如果邮箱是分号分隔的多个邮箱，分割并添加
                                    if ';' in email:
                                        email_list = [e.strip() for e in email.split(';') if e.strip()]
                                        merchant_info['emails'].extend(email_list)
                                    else:
                                        if email not in merchant_info['emails']:
                                            merchant_info['emails'].append(email)
                                
                                # 更新TG Chat ID配置
                                if tg_chat_id:
                                    merchant_info['tg_chat_id'] = tg_chat_id
                                
                                print(f"[DEBUG] 更新商户 {merchant_id}: 费率={fee_rate}, 邮箱={email}, TG Chat ID={tg_chat_id}")
                                break
        
        # 生成输出文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f'unified_merchants_{timestamp}.json'
        
        # 保存数据
        output_data = {
            'timestamp': timestamp,
            'total_merchants': len(main_merchants),
            'merchants': main_merchants
        }
        
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"[SUCCESS] 商户信息拉取完成，共 {len(main_merchants)} 个商户")
        print(f"[SUCCESS] 数据已保存到: {output_filename}")
        
        # 显示商户统计
        print("\n[INFO] 商户统计:")
        for merchant_id, info in main_merchants.items():
            email_info = f", 邮箱: {len(info.get('emails', []))}个" if info.get('emails') else ""
            tg_info = ""
            if info.get('tg_chat_id'):
                tg_info += f", TG Chat ID: {info['tg_chat_id']}"
            
            print(f"  - {info['merchant_name']} (ID: {merchant_id}): 费率 {info['fee_rate']:.4f}{email_info}{tg_info}")
        
        return 0
        
    except Exception as e:
        print(f"[ERROR] 拉取商户信息失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
