#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
账单确认处理器
处理Lark群确认/拒绝链接，更新批次状态，触发多通道发送
"""

import os
import sys
import json
import hashlib
import hmac
import argparse
from datetime import datetime
from typing import Dict, Any, List, Optional
import urllib.parse
from config_loader import get_config
from bilingual_templates import BilingualTemplates

class ConfirmHandler:
    """账单确认处理器"""
    
    def __init__(self):
        self.lark_config = get_config().get_lark_config()
    
    def verify_token(self, batch_id: str, action: str, code: str, year: str, month: str) -> bool:
        """验证token是否有效"""
        try:
            app_secret = self.lark_config.get('app_secret', '')
            if not app_secret:
                return False
        
            # 重新生成token进行对比
            secret = app_secret.encode('utf-8')
            message = f"{batch_id}:{action}:{year}{month}".encode('utf-8')
            expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
            expected_code = expected_signature[:16]
            
            return code == expected_code
            
        except Exception as e:
            print(f"[ERROR] 验证token失败: {str(e)}")
            return False
    
    def load_batch_record(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """加载批次记录"""
        try:
            record_file = f"records/batch_{batch_id}.json"
            if not os.path.exists(record_file):
                print(f"[ERROR] 批次记录文件不存在: {record_file}")
                return None
            
            with open(record_file, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            print(f"[ERROR] 加载批次记录失败: {str(e)}")
            return None
    
    def update_batch_status(self, batch_id: str, status: str, action: str) -> bool:
        """更新批次状态"""
        try:
            record_file = f"records/batch_{batch_id}.json"
            if not os.path.exists(record_file):
                print(f"[ERROR] 批次记录文件不存在: {record_file}")
                return False
            
            with open(record_file, 'r', encoding='utf-8') as f:
                batch_record = json.load(f)
            
            # 更新状态
            batch_record['status'] = status
            batch_record['action'] = action
            batch_record['updated_at'] = datetime.now().isoformat()
            
            # 保存更新
            with open(record_file, 'w', encoding='utf-8') as f:
                json.dump(batch_record, f, ensure_ascii=False, indent=2)
            
            print(f"[INFO] 批次状态已更新: {batch_id} -> {status}")
            return True
            
        except Exception as e:
            print(f"[ERROR] 更新批次状态失败: {str(e)}")
            return False

    def _extract_year_month(self, batch_record: Optional[Dict[str, Any]]) -> (str, str):
        """从环境或批次记录提取 YYYY/MM，用于token校验。"""
        y = os.environ.get('TARGET_YYYY')
        m = os.environ.get('TARGET_MM')
        if y and m:
            return str(y), str(m).zfill(2)
        # 尝试从批次记录 period 提取：如 2025年08月
        if batch_record and isinstance(batch_record, dict):
            period = batch_record.get('period') or batch_record.get('target_period')
            if isinstance(period, str):
                import re
                mt = re.search(r'(\d{4})年(\d{1,2})月', period)
                if mt:
                    return mt.group(1), mt.group(2).zfill(2)
        # 兜底为当前环境
        from datetime import datetime
        now = datetime.now()
        return str(now.year), f"{now.month:02d}"

    def handle_confirmation(self, url: str, apply: bool = True) -> bool:
        """处理确认/拒绝回调。
        url 形如: http://host/confirm?bid=...&action=confirm|reject&code=...
        apply=True 表示执行发送；False 表示仅记录拒绝。
        """
        try:
            parsed = urllib.parse.urlparse(url)
            qs = urllib.parse.parse_qs(parsed.query)
            bid = (qs.get('bid') or [''])[0]
            action = (qs.get('action') or [''])[0]
            code = (qs.get('code') or [''])[0]

            if not bid or action not in ('confirm', 'reject') or not code:
                print("[ERROR] 回调参数不完整")
                return False

            batch_record = self.load_batch_record(bid)
            year, month = self._extract_year_month(batch_record)

            if not self.verify_token(bid, action, code, year, month):
                print("[ERROR] token校验失败")
                return False

            # 确保batch_record包含period字段
            if 'period' not in batch_record:
                batch_record['period'] = f"{year}年{month.zfill(2)}月"
                print(f"[INFO] 添加期间信息到批次记录: {batch_record['period']}")

            if action == 'reject' or not apply:
                self.update_batch_status(bid, 'rejected', 'reject')
                print(f"[INFO] 批次 {bid} 已拒绝，本次不发送")
                
                # 发送拒绝操作的汇总消息到Lark群
                reject_results = [{
                    'merchant': 'System',
                    'channel': 'operation',
                    'target': 'N/A',
                    'status': 'rejected',
                    'reason': f'用户执行了{action}操作'
                }]
                print(f"[INFO] 发送拒绝操作汇总到Lark群...")
                lark_result = self.send_results_to_lark(batch_record, reject_results)
                
                if lark_result:
                    print("[SUCCESS] 拒绝操作汇总已成功发送到Lark群")
                else:
                    print("[ERROR] 拒绝操作汇总发送到Lark群失败")
                
                return True

            # 确认→执行发送
            self.update_batch_status(bid, 'confirmed', 'confirm')
            print(f"[INFO] 开始执行多通道发送...")

            # 获取商户通道配置
            master_report_file = None
            for file in os.listdir('.'):
                if file.startswith('master_merchant_report_') and file.endswith('.json'):
                    if master_report_file is None or file > master_report_file:
                        master_report_file = file
            
            if master_report_file:
                print(f"[INFO] 找到主商户报告文件: {master_report_file}")
                # 从unified_merchants文件获取商户配置，而不是master_merchant_report
                merchant_channels = self.get_merchant_channels(master_report_file)
                
                if merchant_channels:
                    print(f"[INFO] 获取到 {len(merchant_channels)} 个商户的通道配置")
                    # 执行发送
                    send_results = self.send_merchant_bills(batch_record, merchant_channels)
                    print(f"[INFO] 发送完成，共 {len(send_results)} 个结果")
                    
                    # 发送结果到Lark群
                    print(f"[INFO] 开始发送结果汇总到Lark群...")
                    lark_result = self.send_results_to_lark(batch_record, send_results)
                    
                    if lark_result:
                        print("[SUCCESS] 结果汇总已成功发送到Lark群")
                    else:
                        print("[ERROR] 结果汇总发送到Lark群失败")
                else:
                    print("[WARNING] 未找到商户通道配置，跳过发送")
                    # 即使没有商户配置，也发送一个空结果汇总
                    empty_results = [{
                        'merchant': 'System',
                        'channel': 'warning',
                        'target': 'N/A',
                        'status': 'skipped',
                        'reason': '未找到商户通道配置'
                    }]
                    print(f"[INFO] 发送空结果汇总到Lark群...")
                    lark_result = self.send_results_to_lark(batch_record, empty_results)
                    
                    if lark_result:
                        print("[SUCCESS] 空结果汇总已成功发送到Lark群")
                    else:
                        print("[ERROR] 空结果汇总发送到Lark群失败")
            else:
                print("[ERROR] 未找到主商户报告文件，无法发送")
                # 发送错误信息到Lark群
                error_results = [{
                    'merchant': 'System',
                    'channel': 'error',
                    'target': 'N/A',
                    'status': 'failed',
                    'reason': '未找到主商户报告文件'
                }]
                print(f"[INFO] 发送错误信息汇总到Lark群...")
                lark_result = self.send_results_to_lark(batch_record, error_results)
                
                if lark_result:
                    print("[SUCCESS] 错误信息汇总已成功发送到Lark群")
                else:
                    print("[ERROR] 错误信息汇总发送到Lark群失败")
            
            print(f"[SUCCESS] 确认处理完成: {bid} -> confirmed")
            return True

        except Exception as e:
            print(f"[ERROR] 处理确认失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 即使发生异常，也尝试发送错误汇总到Lark群
            try:
                if 'batch_record' in locals() and batch_record:
                    exception_results = [{
                        'merchant': 'System',
                        'channel': 'exception',
                        'target': 'N/A',
                        'status': 'failed',
                        'reason': f'处理确认时发生异常: {str(e)}'
                    }]
                    print(f"[INFO] 发送异常信息汇总到Lark群...")
                    self.send_results_to_lark(batch_record, exception_results)
            except Exception as lark_e:
                print(f"[ERROR] 发送异常信息到Lark群也失败: {str(lark_e)}")
            
            return False
    
    def get_merchant_channels(self, master_merchant_report_file: str) -> Dict[str, Dict[str, Any]]:
        """从主商户报告获取商户发送通道配置"""
        try:
            if not os.path.exists(master_merchant_report_file):
                print(f"[ERROR] 主商户报告文件不存在: {master_merchant_report_file}")
                return {}
            
            with open(master_merchant_report_file, 'r', encoding='utf-8') as f:
                report_data = json.load(f)
            
            # 从unified_merchants中获取商户配置
            unified_merchants_file = None
            for file in os.listdir('.'):
                if file.startswith('unified_merchants_') and file.endswith('.json'):
                    if unified_merchants_file is None or file > unified_merchants_file:
                        unified_merchants_file = file
            
            if not unified_merchants_file:
                print("[WARNING] 未找到unified_merchants文件")
                return {}
            
            with open(unified_merchants_file, 'r', encoding='utf-8') as f:
                unified_data = json.load(f)
            
            # 构建商户通道配置
            merchant_channels = {}
            merchants_data = unified_data.get('merchants', {})
            for merchant_id, merchant_info in merchants_data.items():
                if isinstance(merchant_info, dict):
                    channels = {}
                    
                    # 获取邮箱配置
                    emails = merchant_info.get('emails', [])
                    if emails:
                        if isinstance(emails, str):
                            # 如果是字符串，按分号分割
                            channels['emails'] = [e.strip() for e in emails.split(';') if e.strip()]
                        else:
                            channels['emails'] = emails
                    
                    # 获取TG配置
                    tg_chat_id = merchant_info.get('tg_chat_id')
                    if tg_chat_id:
                        channels['tg_chat_id'] = tg_chat_id
                    
                    tg_group_name = merchant_info.get('tg_group_name')
                    if tg_group_name:
                        channels['tg_group_name'] = tg_group_name
                    
                    if channels:  # 只有有配置的商户才添加
                        merchant_channels[merchant_id] = channels
            
            print(f"[INFO] 获取到 {len(merchant_channels)} 个商户的发送通道配置")
            return merchant_channels
            
        except Exception as e:
            print(f"[ERROR] 获取商户通道配置失败: {str(e)}")
            return {}
    
    def send_merchant_bills(self, batch_record: Dict[str, Any], merchant_channels: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """发送商户账单到配置的通道"""
        results = []
        
        try:
            # 获取PDF文件列表
            pdf_dir = "complete_invoice_pdfs"
            if not os.path.exists(pdf_dir):
                print(f"[ERROR] PDF目录不存在: {pdf_dir}")
                return results
            
            # 获取所有PDF文件
            pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
            if not pdf_files:
                print("[ERROR] 未找到PDF文件")
                return results
            
            print(f"[INFO] 开始发送 {len(pdf_files)} 个PDF到配置的通道")
            
            # 以PDF文件中的商户为准，按商户名A→Z排序
            pdf_merchants = []
            for pdf_file in pdf_files:
                # 从PDF文件名提取商户名，支持新的文件名格式
                import re
                # 匹配格式：商户名_YYYYMM_Bill.pdf
                match = re.match(r'^(.+)_(\d{6})_Bill\.pdf$', pdf_file)
                if match:
                    merchant_name = match.group(1)
                    pdf_merchants.append((merchant_name, pdf_file))
                else:
                    print(f"[WARNING] 无法解析PDF文件名: {pdf_file}")
            
            # 按商户名A→Z排序
            pdf_merchants.sort(key=lambda x: x[0].lower())
            
            for merchant_name, pdf_file in pdf_merchants:
                # 检查该商户是否有发送通道配置
                channels = merchant_channels.get(merchant_name, {})
                
                pdf_path = os.path.join(pdf_dir, pdf_file)
                print(f"[DEBUG] 处理商户 {merchant_name}，PDF: {pdf_file}")
                
                # 如果没有配置任何通道
                if not channels:
                    print(f"[DEBUG] 商户 {merchant_name} 无发送通道配置")
                    results.append({
                        'merchant': merchant_name,
                        'channel': 'config',
                        'target': 'N/A',
                        'status': 'failed',
                        'reason': '无相应配置'
                    })
                    continue
                
                # 发送到邮箱
                if 'emails' in channels:
                    for email in channels['emails']:
                        try:
                            # 使用超时机制调用邮件发送逻辑
                            from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
                            
                            with ThreadPoolExecutor(max_workers=1) as executor:
                                future = executor.submit(self.send_email_bill, email, pdf_path, merchant_name)
                                try:
                                    email_result = future.result(timeout=30)  # 30秒超时
                                    results.append({
                                        'merchant': merchant_name,
                                        'channel': 'email',
                                        'target': email,
                                        'status': 'success' if email_result else 'failed',
                                        'reason': '发送成功' if email_result else '邮件发送失败'
                                    })
                                except FutureTimeoutError:
                                    results.append({
                                        'merchant': merchant_name,
                                        'channel': 'email',
                                        'target': email,
                                        'status': 'failed',
                                        'reason': '邮件发送超时(30秒)'
                                    })
                        except Exception as e:
                            results.append({
                                'merchant': merchant_name,
                                'channel': 'email',
                                'target': email,
                                'status': 'failed',
                                'reason': f'邮件发送异常: {str(e)}'
                            })
                
                # 发送到TG
                if 'tg_chat_id' in channels:
                    try:
                        # 使用超时机制调用TG发送逻辑
                        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
                        
                        with ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(self.send_telegram_bill, channels['tg_chat_id'], pdf_path, merchant_name)
                            try:
                                tg_result = future.result(timeout=30)  # 30秒超时
                                results.append({
                                    'merchant': merchant_name,
                                    'channel': 'telegram',
                                    'target': f"Chat ID: {channels['tg_chat_id']}",
                                    'status': 'success' if tg_result else 'failed',
                                    'reason': '发送成功' if tg_result else 'TG发送失败'
                                })
                            except FutureTimeoutError:
                                results.append({
                                    'merchant': merchant_name,
                                    'channel': 'telegram',
                                    'target': f"Chat ID: {channels['tg_chat_id']}",
                                    'status': 'failed',
                                    'reason': 'TG发送超时(30秒)'
                                })
                    except Exception as e:
                        results.append({
                            'merchant': merchant_name,
                            'channel': 'telegram',
                            'target': f"Chat ID: {channels['tg_chat_id']}",
                            'status': 'failed',
                            'reason': f'TG发送异常: {str(e)}'
                        })
                
            
            print(f"[INFO] 发送完成，共处理 {len(results)} 个结果")
            return results
            
        except Exception as e:
            print(f"[ERROR] 发送商户账单失败: {str(e)}")
            return results
    
    def send_email_bill(self, email: str, pdf_path: str, merchant_id: str) -> bool:
        """发送账单到邮箱"""
        try:
            # 检查PDF文件是否存在
            if not os.path.exists(pdf_path):
                print(f"[ERROR] PDF文件不存在: {pdf_path}")
                return False
            
            # 使用现有的邮件发送器
            from email_sender import EmailSender
            
            # 从.env文件加载邮件配置
            from dotenv import load_dotenv
            load_dotenv()
            
            # 创建邮件发送器并更新配置
            email_sender = EmailSender()
            email_sender.config.update({
                'smtp_server': os.getenv('EMAIL_HOST', 'smtp.larksuite.com'),
                'smtp_port': int(os.getenv('EMAIL_PORT_PUT', 465)),
                'username': os.getenv('EMAIL_USER', ''),
                'password': os.getenv('EMAIL_PASSWORD_PUT', ''),
                'from_email': os.getenv('EMAIL_USER', ''),
                'from_name': 'Gaming Panda Finance'
            })
            
            # 从PDF文件名中提取期间信息
            import re
            period_match = re.search(r'_(\d{4})(\d{2})_Bill\.pdf', pdf_path)
            if period_match:
                period = f"{period_match.group(1)}年{period_match.group(2)}月"
            else:
                period = datetime.now().strftime('%Y年%m月')
            
            # 构建邮件内容
            subject = f"月度账单通知 - {merchant_id} - {period}"
            body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .content {{ padding: 20px; }}
        .info-box {{ background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }}
        .highlight {{ color: #007bff; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="header">
        <h2>📊 月度账单通知</h2>
        <p>Gaming Panda Finance Department</p>
    </div>
    
    <div class="content">
        <p>尊敬的 <span class="highlight">{merchant_id}</span> 客户，</p>
        
        <p>您好！</p>
        
        <p>您的月度账单已生成完成，请查收附件中的详细账单文件。</p>
        
        <div class="info-box">
            <h3>📋 账单信息</h3>
            <ul>
                <li><strong>商户名称：</strong>{merchant_id}</li>
                <li><strong>账单期间：</strong>{period}</li>
                <li><strong>生成时间：</strong>{datetime.now().strftime('%Y年%m月%d日 %H:%M')}</li>
            </ul>
        </div>
        
        <p>📎 <strong>附件说明：</strong>账单文件为PDF格式，包含详细的交易明细和费用计算。</p>
        
        <p>感谢您的合作与支持！</p>
    </div>
    
    <div class="footer">
        <p>此邮件由系统自动发送，请勿回复。</p>
        <p>Gaming Panda Finance Team | www.gaming-panda.com</p>
    </div>
</body>
</html>
            """
            
            # 发送邮件
            result = email_sender.send_email(
                to_emails=[email],
                subject=subject,
                html_content=body,
                attachments=[pdf_path]
            )
            
            if result.get('status') == 'success':
                print(f"[SUCCESS] 邮件发送成功: {email}")
                return True
            else:
                print(f"[ERROR] 邮件发送失败: {result.get('error', '未知错误')}")
                return False
            
        except Exception as e:
            print(f"[ERROR] 邮件发送异常: {str(e)}")
            return False
    
    def send_telegram_bill(self, chat_id: str, pdf_path: str, merchant_id: str) -> bool:
        """发送账单到TG"""
        try:
            # 检查PDF文件是否存在
            if not os.path.exists(pdf_path):
                print(f"[ERROR] PDF文件不存在: {pdf_path}")
                return False
            
            # 使用现有的TG发送器
            from telegram_sender import TelegramSender
            
            # 从.env文件加载TG配置
            from dotenv import load_dotenv
            load_dotenv()
            
            # 创建TG发送器并更新配置
            tg_sender = TelegramSender()
            tg_sender.config.update({
                'bot_token': os.getenv('TELEGRAM_BOT_TOKEN', ''),
                'api_base_url': 'https://api.telegram.org/bot'
            })
            
            # 检查TG配置是否完整
            if not tg_sender.config.get('bot_token'):
                print(f"[WARNING] TG配置不完整，但继续尝试发送到 {chat_id}")
                # 不要直接返回True，而是继续尝试发送
            
            # 从PDF文件名中提取期间信息
            import re
            period_match = re.search(r'(\d{4})年(\d{2})月', pdf_path)
            if period_match:
                period = f"{period_match.group(1)}年{period_match.group(2)}月"
            else:
                # 从文件名中提取YYYYMM格式
                filename = os.path.basename(pdf_path)
                date_match = re.search(r'_(\d{6})_', filename)
                if date_match:
                    date_str = date_match.group(1)
                    year = date_str[:4]
                    month = date_str[4:6]
                    period = f"{year}年{month}月"
                else:
                    period = datetime.now().strftime('%Y年%m月')
            
            # 构建消息内容（中英双语）
            message = BilingualTemplates.format_telegram_bill_send(merchant_id, period)
            
            print(f"[DEBUG] 开始发送TG文件: {pdf_path} -> {chat_id}")
            
            # 发送PDF文件
            result = tg_sender.send_document(
                chat_id=chat_id,
                file_path=pdf_path,
                caption=message
            )
            
            print(f"[DEBUG] TG发送结果: {result}")
            
            # 检查发送结果
            if isinstance(result, dict) and result.get('status') == 'success':
                print(f"[SUCCESS] TG发送成功: {chat_id}")
                return True
            else:
                error_msg = result.get('error', '未知错误') if isinstance(result, dict) else str(result)
                print(f"[ERROR] TG发送失败: {error_msg}")
                return False
            
        except Exception as e:
            print(f"[ERROR] TG发送异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def send_results_to_lark(self, batch_record: Dict[str, Any], send_results: List[Dict[str, Any]]) -> bool:
        """将发送结果回传到Lark群"""
        try:
            print(f"[DEBUG] 开始发送结果汇总到Lark群")
            print(f"[DEBUG] 批次记录: {batch_record}")
            print(f"[DEBUG] 发送结果数量: {len(send_results)}")
            
            # 获取期间信息
            period = batch_record.get('period')
            if not period:
                # 如果没有period字段，尝试从year和month构建
                year = batch_record.get('year', datetime.now().year)
                month = batch_record.get('month', datetime.now().month)
                try:
                    period = f"{int(year)}年{int(month):02d}月"
                except (ValueError, TypeError):
                    period = "未知周期"
                print(f"[DEBUG] 构建期间信息: {period}")
            
            print(f"[DEBUG] 使用期间: {period}")
            
            # 按商户去重统计
            unique_merchants = set()
            for result in send_results:
                unique_merchants.add(result['merchant'])
            total_count = len(unique_merchants)
            
            # 统计每个商户的发送状态（只要有一个通道成功就算成功）
            merchant_status = {}
            for result in send_results:
                merchant = result['merchant']
                if merchant not in merchant_status:
                    merchant_status[merchant] = 'failed'  # 默认失败
                if result.get('status') == 'success':
                    merchant_status[merchant] = 'success'  # 有成功就标记为成功
            
            success_count = len([status for status in merchant_status.values() if status == 'success'])
            failed_count = total_count - success_count
            
            print(f"[DEBUG] 统计结果 - 总数: {total_count}, 成功: {success_count}, 失败: {failed_count}")
            
            # 构建消息内容
            message_lines = [
                "📊 账单发送结果汇总",
                "",
                f"📅 周期：{period}",
                f"📈 总商户数：{total_count}",
                f"✅ 成功：{success_count}",
                f"❌ 失败：{failed_count}",
                "",
                "📋 详细结果："
            ]
            
            if send_results:
                # 按商户分组显示结果，并按商户名A→Z排序
                merchant_results = {}
                for result in send_results:
                    merchant = result['merchant']
                    if merchant not in merchant_results:
                        merchant_results[merchant] = []
                    merchant_results[merchant].append(result)
                
                # 按商户名A→Z排序
                sorted_merchants = sorted(merchant_results.items(), key=lambda kv: kv[0].lower())
                
                for merchant, results in sorted_merchants:
                    message_lines.append(f"\n🏪 {merchant}:")
                    for result in results:
                        channel = result.get('channel', 'unknown')
                        target = result.get('target', 'N/A')
                        status = result.get('status', 'unknown')
                        reason = result.get('reason', 'N/A')
                        
                        status_emoji = "✅" if status == 'success' else "❌"
                        message_lines.append(f"  {status_emoji} {channel} -> {target} ({reason})")
            else:
                message_lines.append("\n⚠️ 无发送结果")
            
            message_lines.extend([
                "",
                "---",
                f"🕐 发送时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            ])
            
            message = "\n".join(message_lines)
            
            print(f"[DEBUG] 构建的消息内容长度: {len(message)} 字符")
            print(f"[DEBUG] 消息预览: {message[:200]}...")
            
            # 调用实际的Lark发送逻辑
            try:
                # 使用现有的Lark发送功能
                from lark_confirmation_sender import LarkConfirmationSender
                
                # 解析年月信息
                import re
                match = re.match(r'(\d{4})年(\d{1,2})月', period)
                if match:
                    year, month = match.groups()
                    month = month.zfill(2)  # 确保月份是两位数
                else:
                    # 如果解析失败，使用当前年月
                    now = datetime.now()
                    year, month = str(now.year), f"{now.month:02d}"
                    print(f"[WARNING] 期间解析失败，使用当前年月: {year}-{month}")
                
                print(f"[DEBUG] 创建Lark发送器: year={year}, month={month}")
                
                # 创建Lark发送器
                lark_sender = LarkConfirmationSender(year, month)
                
                print(f"[DEBUG] 开始调用Lark发送器发送消息")
                
                # 发送结果消息到Lark群
                success = lark_sender.send_text_message(message)
                
                if success:
                    print("[SUCCESS] 结果汇总已发送到Lark群")
                    return True
                else:
                    print("[ERROR] 结果汇总发送到Lark群失败")
                    return False
                    
            except Exception as e:
                print(f"[ERROR] 调用Lark发送失败: {str(e)}")
                import traceback
                traceback.print_exc()
                return False
            
        except Exception as e:
            print(f"[ERROR] 发送结果到Lark失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def process_confirmation(self, url: str) -> bool:
        """处理确认/拒绝URL"""
        try:
            # 解析URL参数
            parsed = urllib.parse.urlparse(url)
            query_params = urllib.parse.parse_qs(parsed.query)
            
            batch_id = query_params.get('bid', [None])[0]
            action = query_params.get('action', [None])[0]
            code = query_params.get('code', [None])[0]
            
            if not all([batch_id, action, code]):
                print("[ERROR] URL参数不完整")
                return False
            
            print(f"[INFO] 处理确认请求: batch_id={batch_id}, action={action}")
            
            # 加载批次记录
            batch_record = self.load_batch_record(batch_id)
            if not batch_record:
                return False
            
            # 验证token
            import re
            period_match = re.match(r'(\d{4})年(\d{2})月', batch_record['period'])
            if not period_match:
                print(f"[ERROR] 无法解析period格式: {batch_record['period']}")
                return False
            
            year = period_match.group(1)
            month = period_match.group(2)
            print(f"[DEBUG] 从period提取: {batch_record['period']} -> year={year}, month={month}")
            if not self.verify_token(batch_id, action, code, year, month):
                print("[ERROR] Token验证失败")
                return False
            
            # 更新批次状态
            status = 'confirmed' if action == 'confirm' else 'rejected'
            if not self.update_batch_status(batch_id, status, action):
                return False
            
            # 如果是确认操作，执行多通道发送
            if action == 'confirm':
                print("[INFO] 开始执行多通道发送...")
                
                # 获取商户通道配置
                master_report_file = None
                for file in os.listdir('.'):
                    if file.startswith('master_merchant_report_') and file.endswith('.json'):
                        if master_report_file is None or file > master_report_file:
                            master_report_file = file
                
                if master_report_file:
                    # 从unified_merchants文件获取商户配置，而不是master_merchant_report
                    merchant_channels = self.get_merchant_channels(master_report_file)
                    
                    if merchant_channels:
                        # 执行发送
                        send_results = self.send_merchant_bills(batch_record, merchant_channels)
                        
                        # 发送结果到Lark群
                        self.send_results_to_lark(batch_record, send_results)
                    else:
                        print("[WARNING] 未找到商户通道配置，跳过发送")
                else:
                    print("[WARNING] 未找到主商户报告文件，跳过发送")
            
            print(f"[SUCCESS] 确认处理完成: {batch_id} -> {status}")
            return True
                
        except Exception as e:
            print(f"[ERROR] 处理确认失败: {str(e)}")
            return False

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='账单确认处理器')
    parser.add_argument('--apply', action='store_true', help='应用确认结果')
    parser.add_argument('--url', type=str, help='确认/拒绝URL')
    
    args = parser.parse_args()
    
    if not args.apply or not args.url:
        print("使用方法: python confirm_handler.py --apply --url <确认/拒绝URL>")
        print("示例: python confirm_handler.py --apply --url 'https://simulate.confirm/bill?bid=20250903_175326&action=confirm&code=abc123'")
        return
    
    handler = ConfirmHandler()
    success = handler.process_confirmation(args.url)
    
    if success:
        print("\n[SUCCESS] 确认处理完成")
        sys.exit(0)
    else:
        print("\n[ERROR] 确认处理失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
