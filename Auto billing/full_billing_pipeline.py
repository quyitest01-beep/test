#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整的自动化账单处理流程
包含PDF生成后的数据检验步骤
支持自动模式和手动模式
"""

import os
import sys
from datetime import datetime, timedelta
import subprocess
import time

def get_previous_month():
    """获取上个月的年份和月份"""
    today = datetime.now()
    # 计算上个月
    if today.month == 1:
        prev_year = today.year - 1
        prev_month = 12
    else:
        prev_year = today.year
        prev_month = today.month - 1
    
    return str(prev_year), f"{prev_month:02d}"

def run_step(step_name: str, command: str, description: str, background: bool = False):
    """运行单个步骤"""
    print(f"\n{'='*60}")
    print(f"🚀 步骤: {step_name}")
    print(f"📝 描述: {description}")
    print(f"{'='*60}")
    
    try:
        if background and "confirm_webhook.py" in command:
            # 后台启动回调服务
            process = subprocess.Popen(
                command.split(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            time.sleep(2)  # 等待服务启动
            if process.poll() is None:
                print(f"✅ {step_name} 后台启动成功")
                print(f"🔗 回调服务地址: http://127.0.0.1:8787/confirm")
                print(f"📱 请在Lark中点击确认按钮，系统将自动处理后续步骤")
                return True
            else:
                print(f"❌ {step_name} 启动失败")
                return False
        else:
            result = os.system(command)
            if result == 0:
                print(f"✅ {step_name} 执行成功")
                return True
            else:
                print(f"❌ {step_name} 执行失败 (退出码: {result})")
                return False
    except Exception as e:
        print(f"❌ {step_name} 执行异常: {e}")
        return False

def main():
    """主函数"""
    # 检查参数
    if len(sys.argv) == 1:
        print("使用方法:")
        print("  自动模式: python full_billing_pipeline.py auto")
        print("  手动模式: python full_billing_pipeline.py <年份> <月份>")
        print("示例:")
        print("  python full_billing_pipeline.py auto")
        print("  python full_billing_pipeline.py 2025 08")
        return
    
    # 自动模式
    if len(sys.argv) == 2 and sys.argv[1].lower() == 'auto':
        year, month = get_previous_month()
        current_time = datetime.now()
        print(f"🤖 自动模式启动")
        print(f"📅 当前时间: {current_time.strftime('%Y年%m月%d日 %H:%M:%S')}")
        print(f"🎯 自动处理上个月账单: {year}年{month}月")
    # 手动模式
    elif len(sys.argv) == 3:
        year = sys.argv[1]
        month = sys.argv[2]
        print(f"👤 手动模式启动")
        print(f"🎯 处理指定月份账单: {year}年{month}月")
    else:
        print("❌ 参数错误！")
        print("使用方法:")
        print("  自动模式: python full_billing_pipeline.py auto")
        print("  手动模式: python full_billing_pipeline.py <年份> <月份>")
        return
    
    target_period = f"{year}年{month}月"
    
    # 格式化月份为两位数
    month_formatted = month.zfill(2)  # 确保月份是两位数，如 "08"
    target_yyyymm = f"{year}{month_formatted}"  # 如 "202508"
    
    print(f"\n🎯 开始执行 {target_period} 自动化账单处理流程")
    print(f"⏰ 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 设置环境变量
    os.environ['TARGET_YYYY'] = year
    os.environ['TARGET_MM'] = month
    os.environ['TARGET_YYYYMM'] = target_yyyymm  # 添加这个环境变量
    
    print(f"[INFO] 环境变量已设置:")
    print(f"  - TARGET_YYYY: {year}")
    print(f"  - TARGET_MM: {month}")
    print(f"  - TARGET_YYYYMM: {target_yyyymm}")
    
    steps = [
        {
            "name": "拉取Lark商户信息",
            "command": "python step1_fetch_lark_merchants.py",
            "description": "从线上Lark表拉取最新的商户信息和映射关系"
        },
        {
            "name": "处理邮件附件",
            "command": "python step2_fetch_mail_attachment.py",
            "description": "下载并处理邮件附件，提取Excel数据"
        },
        {
            "name": "商户映射分析",
            "command": "python improved_merchant_mapper.py",
            "description": "分析商户映射关系，生成主商户统计报告"
        },
        {
            "name": "生成PDF账单",
            "command": f'python complete_invoice_pdf_generator.py "{target_period}"',
            "description": "生成完整的PDF账单文件"
        },
        {
            "name": "PDF数据检验",
            "command": f'python enhanced_pdf_validator.py "{target_period}"',
            "description": "检验生成的PDF账单数据的准确性和完整性"
        },
        {
            "name": "发送确认消息",
            "command": f"python single_confirmation_sender.py {year} {month}",
            "description": "发送Lark确认消息，包含ZIP包和商户明细"
        },
        {
            "name": "启动回调服务",
            "command": "python confirm_webhook.py --port 8787",
            "description": "启动确认回调服务，等待Lark确认按钮点击"
        }
    ]
    
    success_count = 0
    total_steps = len(steps)
    
    for i, step in enumerate(steps, 1):
        print(f"\n📋 进度: {i}/{total_steps}")
        
        # 检查是否是回调服务步骤
        is_webhook = "confirm_webhook.py" in step["command"]
        
        if run_step(step["name"], step["command"], step["description"], background=is_webhook):
            success_count += 1
            if is_webhook:
                # 回调服务启动后，脚本继续运行等待确认
                print(f"\n🎉 自动化账单流程执行完成！")
                print(f"📱 请在Lark群中点击'确认账单'按钮")
                print(f"🔄 系统将自动处理确认并发送结果汇总")
                print(f"⏹️  按 Ctrl+C 停止回调服务")
                break
        else:
            print(f"\n❌ 步骤 {i} 失败，流程终止")
            break
    
    # 流程总结
    print(f"\n{'='*60}")
    print(f"📊 流程执行完成")
    print(f"{'='*60}")
    print(f"✅ 成功步骤: {success_count}/{total_steps}")
    print(f"❌ 失败步骤: {total_steps - success_count}")
    
    if success_count == total_steps:
        print(f"🎉 所有步骤执行成功！{target_period} 账单处理完成")
    else:
        print(f"⚠️  部分步骤失败，请检查错误日志")
    
    print(f"⏰ 结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()


