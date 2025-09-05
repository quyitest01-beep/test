#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一商户信息管理器
整合表1和表2数据，生成统一的商户信息表
"""

import json
from datetime import datetime
from typing import Dict, List, Optional
from lark_data_fetcher import LarkDataFetcher

class UnifiedMerchantManager:
    def __init__(self):
        self.lark_fetcher = LarkDataFetcher()
        self.unified_merchants = {}
        
    def get_unified_merchant_data(self) -> Dict:
        """获取统一的商户信息表"""
        print("🚀 开始生成统一商户信息表...")
        
        # 1. 获取表1和表2数据
        print("\n📊 步骤1: 获取原始数据")
        table1_data = self.lark_fetcher.get_table1_data()
        table2_data = self.lark_fetcher.get_table2_data()
        
        print(f"   - 表1数据: {len(table1_data)} 个记录")
        print(f"   - 表2数据: {len(table2_data)} 个记录")
        
        # 2. 处理表1数据，按B_merchant分组
        print("\n📊 步骤2: 处理表1数据")
        table1_grouped = self._group_table1_by_merchant(table1_data)
        print(f"   - 按主商户分组后: {len(table1_grouped)} 个主商户")
        
        # 3. 处理表2数据
        print("\n📊 步骤3: 处理表2数据")
        table2_processed = self._process_table2_data(table2_data)
        print(f"   - 有效费率数据: {len(table2_processed)} 个")
        
        # 4. 整合数据生成统一商户信息表
        print("\n📊 步骤4: 整合数据")
        self.unified_merchants = self._integrate_merchant_data(table1_grouped, table2_processed)
        print(f"   - 统一商户信息表: {len(self.unified_merchants)} 个商户")
        
        # 5. 显示结果
        self._display_unified_merchants()
        
        return self.unified_merchants
    
    def _group_table1_by_merchant(self, table1_data: Dict) -> Dict:
        """按B_merchant分组表1数据"""
        grouped = {}
        
        for merchant_key, data in table1_data.items():
            # 跳过表头
            if merchant_key in ['type', 'merchant_name']:
                continue
                
            # 获取主商户名
            main_merchant = data.get('B_merchant', '').strip()
            if not main_merchant or main_merchant in ['merchant', '主商户']:
                continue
            
            # 获取子商户信息
            sub_merchant_name = data.get('C_merchant_name', '').strip()
            if not sub_merchant_name or sub_merchant_name in ['merchant_name', '子商户名称']:
                continue
            
            # 处理账号信息
            account = data.get('D_account', '')
            if isinstance(account, list) and len(account) > 0:
                account = account[0].get('text', '') if isinstance(account[0], dict) else str(account[0])
            elif isinstance(account, dict):
                account = account.get('text', '')
            else:
                account = str(account) if account else ''
            
            # 获取其他字段
            merchant_id = str(data.get('F_merchant_id', '')).strip()
            status = str(data.get('G_status', '')).strip()
            environment = str(data.get('H_evel', '')).strip()
            
            # 初始化主商户组
            if main_merchant not in grouped:
                grouped[main_merchant] = {
                    'merchant': main_merchant,
                    'sub_merchants': []
                }
            
            # 添加子商户（包含状态为正常的）
            # 显示所有重要Production账号的信息，不管状态
            if 'Production' in account and any(x in account for x in ['Sortebot', 'Betfarms', 'AAFUN', 'EpicWin']):
                print(f"   🔍 重要账号: {main_merchant} -> {sub_merchant_name} ({account}) [状态: '{status}', 环境: '{environment}']")
            
            # 添加子商户（包含状态为正常的）
            if status == '正常':
                grouped[main_merchant]['sub_merchants'].append({
                    'C_merchant_name': sub_merchant_name,
                    'D_account': account,
                    'F_merchant_id': merchant_id,
                    'status': status,
                    'environment': environment
                })
                print(f"   ✅ {main_merchant} -> {sub_merchant_name} ({account})")
            else:
                print(f"   ❌ 过滤: {main_merchant} -> {sub_merchant_name} (状态: '{status}', 环境: '{environment}')")
        
        return grouped
    
    def _process_table2_data(self, table2_data: Dict) -> Dict:
        """处理表2数据"""
        processed = {}
        
        for merchant_key, data in table2_data.items():
            # 跳过表头
            if merchant_key in ['merchant', '主商户']:
                continue
            
            # 获取商户名和费率
            merchant = data.get('A_merchant', '').strip()
            fee = data.get('B_fee', 0)
            
            if not merchant or merchant in ['merchant', '主商户']:
                continue
            
            # 处理费率
            try:
                if isinstance(fee, str):
                    fee = float(fee.replace('%', '').replace('％', ''))
                else:
                    fee = float(fee) if fee else 0
            except (ValueError, TypeError):
                fee = 0
            
            if fee > 0:
                processed[merchant] = {
                    'merchant': merchant,
                    'fee': fee,
                    'language': data.get('G_language', 'zh'),
                    'method_email': data.get('E_method_email', ''),
                    'method_TG': data.get('F_method_TG', ''),
                    'status': data.get('C_status', 'active')
                }
                print(f"   ✅ {merchant}: {fee}% 费率")
            else:
                print(f"   ❌ 过滤: {merchant} (费率: {fee})")
        
        return processed
    
    def _integrate_merchant_data(self, table1_grouped: Dict, table2_processed: Dict) -> Dict:
        """整合表1和表2数据"""
        unified = {}
        
        # 遍历表1分组数据
        for main_merchant, table1_info in table1_grouped.items():
            # 检查是否有对应的费率信息
            if main_merchant in table2_processed:
                fee_info = table2_processed[main_merchant]
                fee = fee_info['fee']
                fee_source = "配置"
            else:
                fee = 0.0  # 默认费率
                fee_source = "默认"
            
            # 创建统一商户信息
            unified[main_merchant] = {
                'merchant': main_merchant,
                'fee': fee,
                'fee_source': fee_source,
                'language': fee_info.get('language', 'zh') if main_merchant in table2_processed else 'zh',
                'method_email': fee_info.get('method_email', '') if main_merchant in table2_processed else '',
                'method_TG': fee_info.get('method_TG', '') if main_merchant in table2_processed else '',
                'sub_merchants': table1_info['sub_merchants']
            }
            
            print(f"   ✅ {main_merchant}: {fee}% 费率 ({fee_source}) - {len(table1_info['sub_merchants'])} 个子商户")
        
        return unified
    
    def _display_unified_merchants(self):
        """显示统一商户信息"""
        print("\n" + "="*80)
        print("📋 统一商户信息表")
        print("="*80)
        
        for i, (merchant, info) in enumerate(self.unified_merchants.items(), 1):
            print(f"\n{i}. 主商户: {merchant}")
            print(f"   费率: {info['fee']}% ({info['fee_source']})")
            print(f"   语言: {info['language']}")
            print(f"   邮箱: {info['method_email']}")
            print(f"   TG群: {info['method_TG']}")
            print(f"   子商户数量: {len(info['sub_merchants'])}")
            
            for j, sub_merchant in enumerate(info['sub_merchants'], 1):
                print(f"      {j}. {sub_merchant['C_merchant_name']} ({sub_merchant['D_account']})")
    
    def save_unified_merchants(self, filename: str = None):
        """保存统一商户信息表"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"unified_merchants_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.unified_merchants, f, ensure_ascii=False, indent=2)
            print(f"\n✅ 统一商户信息表已保存: {filename}")
            return filename
        except Exception as e:
            print(f"\n❌ 保存失败: {str(e)}")
            return None
    
    def get_merchant_by_name(self, merchant_name: str) -> Optional[Dict]:
        """根据商户名获取商户信息"""
        return self.unified_merchants.get(merchant_name)
    
    def get_all_accounts(self) -> List[str]:
        """获取所有账号列表"""
        accounts = []
        for merchant_info in self.unified_merchants.values():
            for sub_merchant in merchant_info['sub_merchants']:
                account = sub_merchant['D_account']
                if account and account not in accounts:
                    accounts.append(account)
        return accounts

def main():
    """主函数"""
    manager = UnifiedMerchantManager()
    
    # 生成统一商户信息表
    unified_data = manager.get_unified_merchant_data()
    
    # 保存数据
    manager.save_unified_merchants()
    
    print(f"\n🎉 统一商户信息表生成完成!")
    print(f"📊 总计: {len(unified_data)} 个主商户")

if __name__ == "__main__":
    main()
