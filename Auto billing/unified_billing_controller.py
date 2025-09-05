#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一账单控制器
整合所有功能，实现完整的账单生成流程
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from unified_merchant_manager import UnifiedMerchantManager
from excel_merchant_matcher import ExcelMerchantMatcher
from merchant_billing_calculator import MerchantBillingCalculator
from merchant_bill_output import MerchantBillOutput
from billing_sender_controller import BillingSenderController

class UnifiedBillingController:
    def __init__(self):
        self.merchant_manager = UnifiedMerchantManager()
        self.excel_matcher = ExcelMerchantMatcher()
        self.billing_calculator = MerchantBillingCalculator()
        self.bill_output = MerchantBillOutput()
        self.sender_controller = BillingSenderController()
        
        # 数据存储
        self.unified_merchants = {}
        self.matched_data = {}
        self.billing_results = {}
        self.generated_bills = []
        self.send_results = []
        
    def run_complete_billing_process(self, target_month: str = "202507", period: str = "2025年07月"):
        """运行完整的账单生成流程"""
        print("🚀 开始完整账单生成流程...")
        print(f"📅 目标月份: {target_month}")
        print(f"📅 账单期间: {period}")
        
        try:
            # 步骤1: 生成统一商户信息表
            print("\n" + "="*80)
            print("📊 步骤1: 生成统一商户信息表")
            print("="*80)
            
            self.unified_merchants = self.merchant_manager.get_unified_merchant_data()
            if not self.unified_merchants:
                print("❌ 统一商户信息表生成失败")
                return False
            
            # 保存统一商户信息表
            unified_filename = self.merchant_manager.save_unified_merchants()
            
            # 步骤2: 匹配Excel数据
            print("\n" + "="*80)
            print("📊 步骤2: 匹配Excel数据")
            print("="*80)
            
            self.excel_matcher.load_unified_merchants(unified_filename)
            self.excel_matcher.load_excel_data(target_month)
            self.matched_data = self.excel_matcher.match_merchants_with_excel()
            
            if not self.matched_data:
                print("❌ Excel数据匹配失败")
                return False
            
            # 保存匹配结果
            matched_filename = self.excel_matcher.save_matched_data()
            
            # 步骤3: 计算账单
            print("\n" + "="*80)
            print("📊 步骤3: 计算账单")
            print("="*80)
            
            self.billing_calculator.load_matched_data(matched_filename)
            self.billing_results = self.billing_calculator.calculate_merchant_bills(period)
            
            if not self.billing_results:
                print("❌ 账单计算失败")
                return False
            
            # 保存账单结果
            billing_filename = self.billing_calculator.save_billing_results()
            
            # 步骤4: 生成账单输出
            print("\n" + "="*80)
            print("📊 步骤4: 生成账单输出")
            print("="*80)
            
            self.bill_output.load_billing_results(billing_filename)
            self.generated_bills = self.bill_output.generate_all_bills()
            
            if not self.generated_bills:
                print("❌ 账单生成失败")
                return False
            
            # 保存账单列表
            bills_filename = self.bill_output.save_bill_list(self.generated_bills)
            
            # 步骤5: 生成汇总报告
            print("\n" + "="*80)
            print("📊 步骤5: 生成汇总报告")
            print("="*80)
            
            summary_file = self.bill_output.generate_summary_report(self.generated_bills)
            
            # 步骤6: 发送账单（内部确认）
            print("\n" + "="*80)
            print("📊 步骤6: 发送内部确认")
            print("="*80)
            
            internal_emails = ["finance@gaming-panda.com", "manager@gaming-panda.com"]
            send_result = self.sender_controller.send_internal_confirmation(
                billing_results=self.billing_results,
                internal_emails=internal_emails,
                summary_pdf_path=summary_file
            )
            
            if send_result['status'] == 'success':
                print(f"✅ 内部确认邮件发送成功")
                print(f"📋 确认ID: {send_result['confirmation_id']}")
                
                # 模拟自动确认（生产环境中应该等待人工确认）
                print("\n🧪 模拟自动确认...")
                confirm_result = self.sender_controller.simulate_confirmation(
                    send_result['confirmation_id'], 'confirm'
                )
                
                if confirm_result['status'] == 'confirmed':
                    print("✅ 确认成功，客户账单已发送")
                    self.send_results = confirm_result.get('send_result', [])
            else:
                print(f"❌ 内部确认邮件发送失败")
            
            # 步骤7: 显示最终结果
            self._display_final_results()
            
            # 步骤8: 生成流程报告
            self._generate_process_report(unified_filename, matched_filename, 
                                        billing_filename, bills_filename, summary_file)
            
            print("\n🎉 完整账单生成流程完成!")
            return True
            
        except Exception as e:
            print(f"\n❌ 流程执行异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def _display_final_results(self):
        """显示最终结果"""
        print("\n" + "="*80)
        print("🎉 最终结果汇总")
        print("="*80)
        
        # 统计信息
        total_merchants = len(self.unified_merchants)
        total_matched = len(self.matched_data)
        total_bills = len(self.generated_bills)
        
        # 计算总计
        total_charge = sum(
            bill['summary']['total_charge_usdt'] 
            for bill in self.billing_results.values()
        )
        total_profit = sum(
            bill['summary']['gross_profit_usdt'] 
            for bill in self.billing_results.values()
        )
        
        print(f"📊 数据统计:")
        print(f"   - 统一商户数: {total_merchants}")
        print(f"   - 匹配成功数: {total_matched}")
        print(f"   - 生成账单数: {total_bills}")
        print(f"   - 总收费USDT: {total_charge:,.2f}")
        print(f"   - 总毛利USDT: {total_profit:,.2f}")
        
        print(f"\n📋 生成的账单:")
        for i, bill_info in enumerate(self.generated_bills, 1):
            merchant = bill_info['merchant']
            bill_file = os.path.basename(bill_info['bill_file'])
            language = bill_info['language']
            print(f"   {i:2d}. {merchant} ({language}) - {bill_file}")
        
        # 显示发送结果
        if self.send_results:
            print(f"\n📧 发送结果:")
            for i, send_info in enumerate(self.send_results, 1):
                merchant = send_info['merchant']
                email_count = len(send_info.get('email_results', []))
                telegram_count = len(send_info.get('telegram_results', []))
                print(f"   {i:2d}. {merchant} - 邮件:{email_count} TG:{telegram_count}")
    
    def _generate_process_report(self, unified_filename: str, matched_filename: str, 
                               billing_filename: str, bills_filename: str, summary_file: str):
        """生成流程报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"billing_process_report_{timestamp}.json"
        
        report = {
            "process_time": datetime.now().isoformat(),
            "target_month": "202507",
            "period": "2025年07月",
            "steps": {
                "step1_unified_merchants": {
                    "status": "completed",
                    "merchants_count": len(self.unified_merchants),
                    "output_file": unified_filename
                },
                "step2_excel_matching": {
                    "status": "completed",
                    "matched_count": len(self.matched_data),
                    "output_file": matched_filename
                },
                "step3_billing_calculation": {
                    "status": "completed",
                    "bills_count": len(self.billing_results),
                    "output_file": billing_filename
                },
                "step4_bill_generation": {
                    "status": "completed",
                    "generated_count": len(self.generated_bills),
                    "output_file": bills_filename
                },
                "step5_summary_report": {
                    "status": "completed" if summary_file else "failed",
                    "output_file": summary_file
                }
            },
            "summary": {
                "total_merchants": len(self.unified_merchants),
                "total_matched": len(self.matched_data),
                "total_bills": len(self.generated_bills),
                "total_charge_usdt": sum(
                    bill['summary']['total_charge_usdt'] 
                    for bill in self.billing_results.values()
                ),
                "total_profit_usdt": sum(
                    bill['summary']['gross_profit_usdt'] 
                    for bill in self.billing_results.values()
                )
            },
            "generated_files": {
                "unified_merchants": unified_filename,
                "matched_data": matched_filename,
                "billing_results": billing_filename,
                "bills_list": bills_filename,
                "summary_report": summary_file
            }
        }
        
        try:
            with open(report_filename, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"\n✅ 流程报告已生成: {report_filename}")
        except Exception as e:
            print(f"\n❌ 流程报告生成失败: {str(e)}")
    
    def run_step_by_step(self):
        """分步执行流程"""
        print("🚀 分步执行账单生成流程...")
        
        while True:
            print("\n" + "="*60)
            print("📋 请选择执行步骤:")
            print("1. 生成统一商户信息表")
            print("2. 匹配Excel数据")
            print("3. 计算账单")
            print("4. 生成账单输出")
            print("5. 运行完整流程")
            print("0. 退出")
            print("="*60)
            
            try:
                choice = input("请输入选择 (0-5): ").strip()
                
                if choice == "0":
                    print("👋 退出程序")
                    break
                elif choice == "1":
                    self._run_step1()
                elif choice == "2":
                    self._run_step2()
                elif choice == "3":
                    self._run_step3()
                elif choice == "4":
                    self._run_step4()
                elif choice == "5":
                    self.run_complete_billing_process()
                else:
                    print("❌ 无效选择，请重新输入")
                    
            except KeyboardInterrupt:
                print("\n👋 用户中断，退出程序")
                break
            except Exception as e:
                print(f"❌ 执行异常: {str(e)}")
    
    def _run_step1(self):
        """执行步骤1"""
        print("\n📊 执行步骤1: 生成统一商户信息表")
        self.unified_merchants = self.merchant_manager.get_unified_merchant_data()
        if self.unified_merchants:
            self.merchant_manager.save_unified_merchants()
            print("✅ 步骤1完成")
        else:
            print("❌ 步骤1失败")
    
    def _run_step2(self):
        """执行步骤2"""
        print("\n📊 执行步骤2: 匹配Excel数据")
        if not self.unified_merchants:
            print("❌ 请先执行步骤1")
            return
        
        self.excel_matcher.load_unified_merchants()
        self.excel_matcher.load_excel_data("202507")
        self.matched_data = self.excel_matcher.match_merchants_with_excel()
        
        if self.matched_data:
            self.excel_matcher.save_matched_data()
            print("✅ 步骤2完成")
        else:
            print("❌ 步骤2失败")
    
    def _run_step3(self):
        """执行步骤3"""
        print("\n📊 执行步骤3: 计算账单")
        if not self.matched_data:
            print("❌ 请先执行步骤2")
            return
        
        self.billing_calculator.load_matched_data()
        self.billing_results = self.billing_calculator.calculate_merchant_bills("2025年07月")
        
        if self.billing_results:
            self.billing_calculator.save_billing_results()
            print("✅ 步骤3完成")
        else:
            print("❌ 步骤3失败")
    
    def _run_step4(self):
        """执行步骤4"""
        print("\n📊 执行步骤4: 生成账单输出")
        if not self.billing_results:
            print("❌ 请先执行步骤3")
            return
        
        self.bill_output.load_billing_results()
        self.generated_bills = self.bill_output.generate_all_bills()
        
        if self.generated_bills:
            self.bill_output.save_bill_list(self.generated_bills)
            self.bill_output.generate_summary_report(self.generated_bills)
            print("✅ 步骤4完成")
        else:
            print("❌ 步骤4失败")

def main():
    """主函数"""
    controller = UnifiedBillingController()
    
    print("🚀 统一账单控制器启动")
    print("自动运行完整流程...")
    
    try:
        # 直接运行完整流程
        controller.run_complete_billing_process()
            
    except KeyboardInterrupt:
        print("\n👋 用户中断，退出程序")
    except Exception as e:
        print(f"❌ 程序异常: {str(e)}")

if __name__ == "__main__":
    main()
