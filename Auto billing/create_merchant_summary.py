#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建匹配表1和表2的商户信息汇总表
"""
import json

def create_merchant_summary():
    """创建商户信息汇总表"""
    try:
        # 读取表1数据
        with open('table1_merchant_data.json', 'r', encoding='utf-8') as f:
            table1_data = json.load(f)
        
        # 读取表2数据
        with open('table2_fee_data.json', 'r', encoding='utf-8') as f:
            table2_data = json.load(f)
        
        print("=" * 80)
        print("📊 商户信息汇总表 (匹配表1和表2)")
        print("=" * 80)
        
        # 创建主商户汇总
        merchant_summary = {}
        
        # 处理表1数据，按主商户分组
        for key, value in table1_data.items():
            if key == "merchant_name":
                continue
                
            # 获取主商户信息
            main_merchant = value.get("B_merchant", "")  # 主商户
            if not main_merchant:
                continue
                
            # 初始化主商户记录
            if main_merchant not in merchant_summary:
                merchant_summary[main_merchant] = {
                    "主商户": main_merchant,
                    "费率": 0.0,
                    "对账邮箱": "",
                    "对账TG群": "",
                    "语言": "",
                    "子商户列表": []
                }
            
            # 处理子商户账号（邮箱地址）
            account_data = value.get("D_account", "")
            account_address = ""
            if isinstance(account_data, list) and len(account_data) > 0:
                if isinstance(account_data[0], dict) and "text" in account_data[0]:
                    account_address = account_data[0]["text"]
            elif isinstance(account_data, str):
                account_address = account_data
            
            # 添加子商户信息
            sub_merchant = {
                "子商户名": value.get("C_merchant_name", ""),  # 子商户名称
                "子商户账号": account_address,  # 子商户账号（邮箱地址）
                "子商户密码": value.get("E_password", ""),  # 子商户密码
                "子商户id": value.get("F_merchant_id", ""),  # 商户ID
                "子商户状态": value.get("G_status", ""),  # 状态
                "子商户环境": value.get("H_evel", "")  # 环境
            }
            
            merchant_summary[main_merchant]["子商户列表"].append(sub_merchant)
        
        # 匹配表2的费率信息
        for key, value in table2_data.items():
            if key == "merchant":
                continue
                
            merchant_name = value.get("A_merchant", "")
            if merchant_name in merchant_summary:
                merchant_summary[merchant_name]["费率"] = value.get("B_fee", 0.0)
                
                # 处理对账邮箱
                email_data = value.get("E_method_email", "")
                if isinstance(email_data, list) and len(email_data) > 0:
                    if isinstance(email_data[0], dict) and "text" in email_data[0]:
                        merchant_summary[merchant_name]["对账邮箱"] = email_data[0]["text"]
                elif isinstance(email_data, str):
                    merchant_summary[merchant_name]["对账邮箱"] = email_data
                
                merchant_summary[merchant_name]["对账TG群"] = value.get("F_method_TG", "")
                merchant_summary[merchant_name]["语言"] = value.get("G_language", "")
        
        # 显示汇总结果
        count = 0
        for main_merchant, info in merchant_summary.items():
            count += 1
            print(f"\n{count}. 主商户：{info['主商户']}")
            print(f"   费率：{info['费率']}%")
            print(f"   对账邮箱：{info['对账邮箱']}")
            print(f"   对账TG群：{info['对账TG群']}")
            print(f"   语言：{info['语言']}")
            print(f"   子商户列表：")
            
            for i, sub_merchant in enumerate(info['子商户列表'], 1):
                print(f"     {i}. 子商户名：{sub_merchant['子商户名']}")
                print(f"        子商户账号：{sub_merchant['子商户账号']}")
                print(f"        子商户密码：{sub_merchant['子商户密码']}")
                print(f"        子商户id：{sub_merchant['子商户id']}")
                print(f"        子商户状态：{sub_merchant['子商户状态']}")
                print(f"        子商户环境：{sub_merchant['子商户环境']}")
            
            print("-" * 60)
            
            if count >= 10:  # 只显示前10个主商户
                break
        
        # 保存汇总数据到JSON文件
        with open('merchant_summary.json', 'w', encoding='utf-8') as f:
            json.dump(merchant_summary, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ 商户信息汇总完成！共 {len(merchant_summary)} 个主商户")
        print("💾 数据已保存到: merchant_summary.json")
        
        return merchant_summary
        
    except Exception as e:
        print(f"❌ 创建汇总失败: {str(e)}")
        return {}

if __name__ == "__main__":
    create_merchant_summary()
