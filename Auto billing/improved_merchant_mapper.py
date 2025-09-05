#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
改进的商户映射器

基于分析结果，创建更智能的主商户-子商户映射规则，确保统计时能正确识别并关联到对应的主商户。
"""

import json
import os
from datetime import datetime
from collections import defaultdict

def normalize_identifier(text: str) -> str:
    """将商户/子商户标识标准化：
    - 去掉前缀 'Production'
    - 若为邮箱，截取 @ 前部分
    - 去除空格、下划线、连字符
    - 小写
    """
    if text is None:
        return ''
    s = str(text).strip()
    if s.lower().startswith('production'):
        s = s[len('production'):].strip()
    if '@' in s:
        s = s.split('@', 1)[0]
    for ch in [' ', '_', '-']:
        s = s.replace(ch, '')
    return s.lower()

def load_mapping_analysis():
    """加载最新的映射分析结果"""
    analysis_files = [f for f in os.listdir('.') if f.startswith('merchant_mapping_analysis_') and f.endswith('.json')]
    if not analysis_files:
        print("[ERROR] 未找到映射分析文件")
        return None
    
    latest_file = max(analysis_files)
    print(f"[INFO] 加载映射分析: {latest_file}")
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_merchant_mapping_rules():
    """创建商户映射规则"""
    # 基于分析结果，创建映射规则
    mapping_rules = {
        # 直接名称匹配
        'sortebot': 'sortebot',
        'Game Plus': 'Game Plus',
        'slotsapi': 'slotsapi',
        'Betfarms': 'Betfarms',
        'Epoch Game': 'Epoch Game',
        # 'EpicWin': 'EpicWin',  # 移除：应作为 slotsapi 的子商户
        'Nicegame': 'Nicegame',
        'PUBCGAME': 'PUBCGAME',
        'JBgame': 'JBgame',
        'Jogar': 'Jogar',
        'JWgame': 'JWgame',
        'jayagaming': 'jayagaming',
        'winwinbet': 'winwinbet',
        'A99AU': 'A99AU',
        # 'Brabet06': 'Brabet06',  # 移除：应作为 Brabet 的子商户
        'Unicorn66': 'Unicorn66',
        'Mxlobo(MXN)': 'Mxlobo',
        'Mxlobo(PKR)': 'Mxlobo',
        'vg777': 'VG',
        'To game': 'Togame',
        'JR-F4': 'JR',
        'brabet01': 'Brabet',
        'MARSBINGO-M6': 'MARSBINGO',
        'JackpotParty02': 'JackpotParty',
        'MetaGaming': 'slotsmaker',
        
        # 子商户映射（这些将通过子商户检查逻辑自动映射）
        'brabet01': 'Brabet',    # 子商户
        'JR-F4': 'JR',           # 子商户
        'Mxlobo(MXN)': 'Mxlobo', # 子商户
        'Mxlobo(PKR)': 'Mxlobo', # 子商户
        'vg777': 'VG',           # 子商户
        'To game': 'Togame',     # 子商户
    }
    
    return mapping_rules

def apply_mapping_rules(transaction_data, mapping_rules, lark_merchants):
    """应用映射规则"""
    print("\n应用商户映射规则...")
    
    # 创建映射后的数据结构
    mapped_data = defaultdict(lambda: {
        'merchant_id': '',
        'merchant_name': '',
        'fee_rate': 0.0,
        'sub_merchants': [],
        'total_charge_usdt': 0.0,
        'transactions_count': 0
    })
    
    # 统计映射结果
    mapping_stats = {
        'total_transaction_merchants': len(transaction_data['merchant_data']),
        'successfully_mapped': 0,
        'unmapped': 0,
        'mapping_details': {}
    }
    
    # 预构建：规则键的标准化映射
    mapping_rules_norm = {normalize_identifier(k): v for k, v in mapping_rules.items()}

    # 预构建：Lark 主商户与子商户的标准化索引
    lark_norm_index = {}
    for lark_id, lark_info in lark_merchants.items():
        if isinstance(lark_info, dict):
            main_norm = normalize_identifier(lark_info.get('merchant_name', lark_id))
            subs = lark_info.get('sub_merchants', []) or []
            subs_norm = set(normalize_identifier(x) for x in subs)
            lark_norm_index[lark_id] = {
                'main_norm': main_norm,
                'subs_norm': subs_norm,
            }

    for transaction_merchant_name, data in transaction_data['merchant_data'].items():
        # 尝试映射
        mapped_merchant_id = None
        tn = normalize_identifier(transaction_merchant_name)
        
        # 方法1: 在Lark商户中查找（优先检查是否为某主商户的子商户）
        if not mapped_merchant_id:
            print(f"[DEBUG] 检查 {transaction_merchant_name} 是否为子商户...")
            for lark_id, lark_info in lark_merchants.items():
                if isinstance(lark_info, dict) and 'sub_merchants' in lark_info:
                    print(f"[DEBUG] 检查 {lark_id} 的子商户列表: {lark_info['sub_merchants']}")
                    norm = lark_norm_index.get(lark_id, {})
                    if tn in norm.get('subs_norm', set()):
                        mapped_merchant_id = lark_id
                        print(f"[DEBUG] 找到子商户映射: {transaction_merchant_name} -> {lark_id}")
                        break
        
        # 方法2: 使用映射规则（标准化后）
        if not mapped_merchant_id and tn in mapping_rules_norm:
            mapped_merchant_id = mapping_rules_norm[tn]

        # 方法3: 在Lark商户中查找（精确匹配主商户名称，标准化后）
        if not mapped_merchant_id:
            for lark_id, norm in lark_norm_index.items():
                if tn == norm.get('main_norm'):
                    mapped_merchant_id = lark_id
                    break
 
        # 方法4: 模糊匹配
        if not mapped_merchant_id:
            for lark_id, norm in lark_norm_index.items():
                main_norm = norm.get('main_norm', '')
                if tn in main_norm or main_norm in tn:
                    mapped_merchant_id = lark_id
                    break
        
        # 记录映射结果
        if mapped_merchant_id:
            mapping_stats['successfully_mapped'] += 1
            mapping_stats['mapping_details'][transaction_merchant_name] = {
                'status': 'mapped',
                'mapped_to': mapped_merchant_id,
                'lark_merchant_name': lark_merchants[mapped_merchant_id]['merchant_name'] if mapped_merchant_id in lark_merchants else mapped_merchant_id
            }
            
            # 添加到映射后的数据
            if mapped_merchant_id in lark_merchants:
                lark_info = lark_merchants[mapped_merchant_id]
                mapped_data[mapped_merchant_id]['merchant_id'] = mapped_merchant_id
                # 根据用户更正：使用主商户名称，而不是子商户名称
                mapped_data[mapped_merchant_id]['merchant_name'] = lark_info['merchant_name']  # 主商户名称
                mapped_data[mapped_merchant_id]['sub_merchant_name'] = lark_info.get('sub_merchant_name', '')  # 子商户名称
                mapped_data[mapped_merchant_id]['fee_rate'] = lark_info['fee_rate']
            else:
                mapped_data[mapped_merchant_id]['merchant_id'] = mapped_merchant_id
                mapped_data[mapped_merchant_id]['merchant_name'] = mapped_merchant_id
                mapped_data[mapped_merchant_id]['sub_merchant_name'] = ''
                mapped_data[mapped_merchant_id]['fee_rate'] = 0.0
            
            # 添加子商户数据
            mapped_data[mapped_merchant_id]['sub_merchants'].extend(data['sub_merchants'])
            mapped_data[mapped_merchant_id]['total_charge_usdt'] += sum(
                sum(curr['charge_usdt'] for curr in sub['currencies'])
                for sub in data['sub_merchants']
            )
            mapped_data[mapped_merchant_id]['transactions_count'] += sum(
                len(sub['currencies']) for sub in data['sub_merchants']
            )
        else:
            mapping_stats['unmapped'] += 1
            mapping_stats['mapping_details'][transaction_merchant_name] = {
                'status': 'unmapped',
                'mapped_to': None,
                'lark_merchant_name': None
            }
    
    return mapped_data, mapping_stats

def generate_master_merchant_report(mapped_data, mapping_stats):
    """生成主商户维度的报告"""
    print("\n" + "="*80)
    print("主商户维度统计报告")
    print("="*80)
    
    print(f"\n映射统计:")
    print(f"  总交易商户: {mapping_stats['total_transaction_merchants']}")
    print(f"  成功映射: {mapping_stats['successfully_mapped']}")
    print(f"  未映射: {mapping_stats['unmapped']}")
    print(f"  映射成功率: {mapping_stats['successfully_mapped']/mapping_stats['total_transaction_merchants']*100:.1f}%")
    
    # 按费率分组统计
    fee_groups = defaultdict(list)
    for merchant_id, data in mapped_data.items():
        fee_rate = data['fee_rate']
        fee_groups[fee_rate].append({
            'merchant_id': merchant_id,
            'merchant_name': data['merchant_name'],
            'total_charge_usdt': data['total_charge_usdt'],
            'sub_merchants_count': len(data['sub_merchants']),
            'transactions_count': data['transactions_count']
        })
    
    print(f"\n按费率分组的主商户统计:")
    print("-" * 80)
    
    total_charge = 0.0
    for fee_rate in sorted(fee_groups.keys()):
        merchants = fee_groups[fee_rate]
        group_total = sum(m['total_charge_usdt'] for m in merchants)
        total_charge += group_total
        
        print(f"\n费率 {fee_rate}%: {len(merchants)}个商户, 总金额: {group_total:,.2f} USDT")
        print(f"{'商户ID':<15} {'商户名称':<20} {'子商户':<8} {'交易明细':<10} {'金额(USDT)':<15}")
        print("-" * 70)
        
        for m in sorted(merchants, key=lambda x: x['total_charge_usdt'], reverse=True):
            print(f"{m['merchant_id']:<15} {m['merchant_name']:<20} {m['sub_merchants_count']:<8} {m['transactions_count']:<10} {m['total_charge_usdt']:<15.2f}")
    
    print(f"\n总计: {total_charge:,.2f} USDT")
    
    # 显示未映射商户
    if mapping_stats['unmapped'] > 0:
        print(f"\n未映射商户 ({mapping_stats['unmapped']} 个):")
        print("-" * 50)
        for merchant_name, details in mapping_stats['mapping_details'].items():
            if details['status'] == 'unmapped':
                print(f"  - {merchant_name}")
    
    return fee_groups, total_charge

def main():
    """主函数"""
    print("[INFO] 开始改进的商户映射分析...")
    
    # 目标月份
    target_yyyymm = os.environ.get('TARGET_YYYYMM')
    if not target_yyyymm or len(target_yyyymm) != 6 or not target_yyyymm.isdigit():
        print("[ERROR] 未设置或格式错误: TARGET_YYYYMM，应为YYYYMM，如202508")
        return 1
    print(f"[INFO] 目标月份: {target_yyyymm}")

    # 加载原始数据（严格匹配目标月份）
    prefix = f"matched_merchant_excel_data_{target_yyyymm}_"
    transaction_files = [f for f in os.listdir('.') if f.startswith(prefix) and f.endswith('.json')]
    if not transaction_files:
        print("[ERROR] 未找到交易数据文件")
        return 1
    
    latest_transaction_file = max(transaction_files)
    print(f"[INFO] 加载交易数据文件: {latest_transaction_file}")
    with open(latest_transaction_file, 'r', encoding='utf-8') as f:
        transaction_data = json.load(f)
    
    # 加载Lark商户数据 - 修复文件选择逻辑
    merchant_files = [f for f in os.listdir('.') if f.startswith('unified_merchants_') and f.endswith('.json')]
    if not merchant_files:
        print("[ERROR] 未找到商户数据文件")
        return 1
    
    # 选择最新的商户数据文件 - 按时间戳排序，而不是字典序
    def extract_timestamp(filename):
        """从文件名中提取时间戳部分"""
        try:
            # 格式: unified_merchants_20250903_121559.json
            if '_2025' in filename:
                parts = filename.split('_')
                if len(parts) >= 4:
                    date_part = parts[2]  # 20250903
                    time_part = parts[3].split('.')[0]  # 121559
                    return int(date_part + time_part)  # 转换为整数进行比较
            return 0  # 默认值，确保旧文件排在最后
        except:
            return 0  # 出错时返回0
    
    # 按时间戳排序，选择最新的
    latest_merchant_file = max(merchant_files, key=extract_timestamp)
    print(f"[DEBUG] 加载商户数据文件: {latest_merchant_file}")
    print(f"[DEBUG] 该文件的时间戳: {extract_timestamp(latest_merchant_file)}")
    
    with open(latest_merchant_file, 'r', encoding='utf-8') as f:
        lark_data = json.load(f)
    
    # 正确访问商户数据结构
    print(f"[DEBUG] lark_data keys: {list(lark_data.keys())}")
    
    # 检查数据结构
    if 'merchants' in lark_data:
        lark_merchants = lark_data['merchants']
        print(f"[DEBUG] 使用 'merchants' 键访问数据")
    else:
        # 如果没有 'merchants' 键，直接使用 lark_data
        lark_merchants = lark_data
        print(f"[DEBUG] 直接使用 lark_data 作为商户数据")
    
    print(f"[DEBUG] 加载了 {len(lark_merchants)} 个商户")
    if lark_merchants:
        print(f"[DEBUG] 前几个商户: {list(lark_merchants.keys())[:5]}")
        
        # 特别检查RD1商户的子商户信息
        if 'RD1' in lark_merchants:
            rd1_info = lark_merchants['RD1']
            print(f"[DEBUG] RD1商户信息: {rd1_info}")
            if 'sub_merchants' in rd1_info:
                print(f"[DEBUG] RD1子商户列表: {rd1_info['sub_merchants']}")
                print(f"[DEBUG] RD1子商户数量: {len(rd1_info['sub_merchants'])}")
            else:
                print(f"[DEBUG] RD1没有sub_merchants字段")
        else:
            print(f"[DEBUG] 未找到RD1商户")
    
    # 创建映射规则
    mapping_rules = create_merchant_mapping_rules()
    
    # 应用映射规则
    mapped_data, mapping_stats = apply_mapping_rules(transaction_data, mapping_rules, lark_merchants)
    
    # 生成报告
    fee_groups, total_charge = generate_master_merchant_report(mapped_data, mapping_stats)
    
    # 保存结果
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f'master_merchant_report_{target_yyyymm}_{timestamp}.json'
    
    output_data = {
        'timestamp': timestamp,
        'mapping_stats': mapping_stats,
        'mapped_data': dict(mapped_data),
        'fee_groups': {str(k): v for k, v in fee_groups.items()},
        'total_charge': total_charge
    }
    
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[SUCCESS] 主商户报告已保存到: {output_filename}")
    
    return 0

if __name__ == '__main__':
    exit(main())
