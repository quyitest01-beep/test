#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
账单发送失败重试工具
用于重新发送失败的商户账单，避免重复发送给已成功的商户

使用方法:
1. 自动模式：python retry_failed_bills.py --batch-id 20250101_120000
2. 手动模式：python retry_failed_bills.py --manual --merchants "商户A,商户B"
3. 交互模式：python retry_failed_bills.py --interactive
"""

import os
import sys
import json
import argparse
import time
import hashlib
import hmac
from datetime import datetime
from typing import Dict, Any, List, Optional, Set
from pathlib import Path
from lark_confirmation_sender import LarkConfirmationSender
from bilingual_templates import BilingualTemplates

class BillRetryManager:
    """账单重试管理器"""
    
    def __init__(self):
        self.records_dir = "records"
        self.pdf_dir = "complete_invoice_pdfs"
        self.failed_merchants = set()
        self.success_merchants = set()
        
    def load_batch_record(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """加载批次记录"""
        try:
            record_file = os.path.join(self.records_dir, f"batch_{batch_id}.json")
            if not os.path.exists(record_file):
                print(f"[ERROR] 批次记录文件不存在: {record_file}")
                return None
                
            with open(record_file, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            print(f"[ERROR] 加载批次记录失败: {str(e)}")
            return None
    
    def analyze_send_results(self, batch_record: Dict[str, Any]) -> Dict[str, List[str]]:
        """分析发送结果，识别成功和失败的商户"""
        results = {
            'success': [],
            'failed': [],
            'no_config': [],
            'timeout': [],
            'error': []
        }
        
        # 从批次记录中获取发送结果（如果有的话）
        send_results = batch_record.get('send_results', [])
        
        if not send_results:
            print("[WARNING] 批次记录中没有发送结果，将基于PDF文件分析")
            return self._analyze_from_pdfs()
        
        # 按商户分组分析结果
        merchant_status = {}
        for result in send_results:
            merchant = result.get('merchant', 'Unknown')
            status = result.get('status', 'unknown')
            reason = result.get('reason', '')
            
            if merchant not in merchant_status:
                merchant_status[merchant] = {'success': False, 'reasons': []}
            
            # 只要有一个通道成功，就认为该商户发送成功
            if status == 'success':
                merchant_status[merchant]['success'] = True
            
            merchant_status[merchant]['reasons'].append(f"{result.get('channel', 'unknown')}: {reason}")
        
        # 分类商户
        for merchant, status_info in merchant_status.items():
            if status_info['success']:
                results['success'].append(merchant)
            else:
                # 根据失败原因进一步分类
                reasons = ' '.join(status_info['reasons'])
                if '无相应配置' in reasons or '无发送通道配置' in reasons:
                    results['no_config'].append(merchant)
                elif '超时' in reasons:
                    results['timeout'].append(merchant)
                else:
                    results['failed'].append(merchant)
        
        return results
    
    def _analyze_from_pdfs(self) -> Dict[str, List[str]]:
        """基于PDF文件分析商户列表"""
        results = {
            'success': [],
            'failed': [],
            'no_config': [],
            'timeout': [],
            'error': []
        }
        
        if not os.path.exists(self.pdf_dir):
            print(f"[ERROR] PDF目录不存在: {self.pdf_dir}")
            return results
        
        # 获取所有PDF文件对应的商户
        pdf_files = [f for f in os.listdir(self.pdf_dir) if f.endswith('.pdf')]
        
        import re
        for pdf_file in pdf_files:
            # 从PDF文件名提取商户名
            match = re.match(r'^(.+)_(\d{6})_Bill\.pdf$', pdf_file)
            if match:
                merchant_name = match.group(1)
                # 默认认为所有商户都需要重试（因为没有发送结果记录）
                results['failed'].append(merchant_name)
        
        print(f"[INFO] 从PDF文件分析得到 {len(results['failed'])} 个商户需要发送")
        return results
    
    def get_merchant_channels(self) -> Dict[str, Dict[str, Any]]:
        """获取商户通道配置"""
        try:
            # 查找最新的主商户报告文件
            master_report_file = None
            for file in os.listdir('.'):
                if file.startswith('master_merchant_report_') and file.endswith('.json'):
                    if master_report_file is None or file > master_report_file:
                        master_report_file = file
            
            if not master_report_file:
                print("[ERROR] 未找到主商户报告文件")
                return {}
            
            print(f"[INFO] 使用主商户报告文件: {master_report_file}")
            
            # 查找最新的unified_merchants文件（不依赖期间匹配）
            unified_file = None
            for file in os.listdir('.'):
                if file.startswith('unified_merchants_') and file.endswith('.json'):
                    if unified_file is None or file > unified_file:
                        unified_file = file
            
            if not unified_file:
                print("[ERROR] 统一商户文件不存在，期望格式: unified_merchants_*.json")
                return {}
            
            print(f"[INFO] 使用统一商户文件: {unified_file}")
            
            with open(unified_file, 'r', encoding='utf-8') as f:
                unified_data = json.load(f)
            
            merchant_channels = {}
            merchants_data = unified_data.get('merchants', {})
            
            for merchant_id, merchant_info in merchants_data.items():
                merchant_name = merchant_info.get('merchant_name', merchant_id)
                channels = {}
                
                # 邮箱配置
                if merchant_info.get('emails'):
                    channels['emails'] = merchant_info['emails']
                
                # TG配置
                if merchant_info.get('tg_chat_id'):
                    channels['tg_chat_id'] = merchant_info['tg_chat_id']
                
                if channels:
                    merchant_channels[merchant_name] = channels
            
            print(f"[INFO] 加载了 {len(merchant_channels)} 个商户的通道配置")
            return merchant_channels
            
        except Exception as e:
            print(f"[ERROR] 获取商户通道配置失败: {str(e)}")
            return {}
    
    def retry_failed_merchants(self, failed_merchants: List[str], 
                             merchant_channels: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """重试失败商户的账单发送"""
        results = []
        
        if not failed_merchants:
            print("[INFO] 没有需要重试的商户")
            return results
        
        print(f"[INFO] 开始重试 {len(failed_merchants)} 个失败商户的账单发送")
        
        # 导入发送功能
        from confirm_handler import ConfirmHandler
        handler = ConfirmHandler()
        
        # 为每个失败商户重新发送
        for merchant_name in failed_merchants:
            print(f"\n[INFO] 重试商户: {merchant_name}")
            
            # 检查PDF文件是否存在
            pdf_files = [f for f in os.listdir(self.pdf_dir) 
                        if f.startswith(f"{merchant_name}_") and f.endswith('_Bill.pdf')]
            
            if not pdf_files:
                print(f"[ERROR] 未找到商户 {merchant_name} 的PDF文件")
                results.append({
                    'merchant': merchant_name,
                    'channel': 'file',
                    'target': 'PDF',
                    'status': 'failed',
                    'reason': 'PDF文件不存在'
                })
                continue
            
            pdf_file = pdf_files[0]  # 使用第一个匹配的文件
            pdf_path = os.path.join(self.pdf_dir, pdf_file)
            
            # 获取该商户的通道配置
            channels = merchant_channels.get(merchant_name, {})
            
            if not channels:
                print(f"[WARNING] 商户 {merchant_name} 无发送通道配置")
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
                        print(f"[INFO] 发送邮件到: {email}")
                        email_result = handler.send_email_bill(email, pdf_path, merchant_name)
                        results.append({
                            'merchant': merchant_name,
                            'channel': 'email',
                            'target': email,
                            'status': 'success' if email_result else 'failed',
                            'reason': '重试发送成功' if email_result else '重试邮件发送失败'
                        })
                    except Exception as e:
                        results.append({
                            'merchant': merchant_name,
                            'channel': 'email',
                            'target': email,
                            'status': 'failed',
                            'reason': f'重试邮件发送异常: {str(e)}'
                        })
            
            # 发送到TG
            if 'tg_chat_id' in channels:
                try:
                    print(f"[INFO] 发送TG到: {channels['tg_chat_id']}")
                    tg_result = handler.send_telegram_bill(channels['tg_chat_id'], pdf_path, merchant_name)
                    results.append({
                        'merchant': merchant_name,
                        'channel': 'telegram',
                        'target': f"Chat ID: {channels['tg_chat_id']}",
                        'status': 'success' if tg_result else 'failed',
                        'reason': '重试发送成功' if tg_result else '重试TG发送失败'
                    })
                except Exception as e:
                    results.append({
                        'merchant': merchant_name,
                        'channel': 'telegram',
                        'target': f"Chat ID: {channels['tg_chat_id']}",
                        'status': 'failed',
                        'reason': f'重试TG发送异常: {str(e)}'
                    })
        
        return results
    
    def save_retry_results(self, batch_id: str, retry_results: List[Dict[str, Any]]) -> str:
        """保存重试结果"""
        try:
            # 确保records目录存在
            os.makedirs(self.records_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            retry_file = os.path.join(self.records_dir, f"retry_{batch_id}_{timestamp}.json")
            
            retry_record = {
                'original_batch_id': batch_id,
                'retry_timestamp': datetime.now().isoformat(),
                'retry_results': retry_results,
                'summary': self._generate_retry_summary(retry_results)
            }
            
            with open(retry_file, 'w', encoding='utf-8') as f:
                json.dump(retry_record, f, ensure_ascii=False, indent=2)
            
            print(f"[INFO] 重试结果已保存: {retry_file}")
            return retry_file
            
        except Exception as e:
            print(f"[ERROR] 保存重试结果失败: {str(e)}")
            return ""
    
    def _generate_retry_summary(self, retry_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """生成重试结果摘要"""
        # 按商户去重统计
        unique_merchants = set()
        for result in retry_results:
            unique_merchants.add(result['merchant'])
        
        # 统计每个商户的重试状态
        merchant_status = {}
        for result in retry_results:
            merchant = result['merchant']
            if merchant not in merchant_status:
                merchant_status[merchant] = 'failed'
            if result.get('status') == 'success':
                merchant_status[merchant] = 'success'
        
        success_count = len([status for status in merchant_status.values() if status == 'success'])
        failed_count = len(unique_merchants) - success_count
        
        return {
            'total_merchants': len(unique_merchants),
            'success_merchants': success_count,
            'failed_merchants': failed_count,
            'success_rate': f"{success_count/len(unique_merchants)*100:.1f}%" if unique_merchants else "0%"
        }
    
    def display_analysis_results(self, analysis: Dict[str, List[str]]):
        """显示分析结果"""
        print("\n" + "="*60)
        print("📊 发送状态分析结果")
        print("="*60)
        
        print(f"✅ 发送成功: {len(analysis['success'])} 个商户")
        if analysis['success']:
            for merchant in sorted(analysis['success']):
                print(f"   - {merchant}")
        
        print(f"\n❌ 发送失败: {len(analysis['failed'])} 个商户")
        if analysis['failed']:
            for merchant in sorted(analysis['failed']):
                print(f"   - {merchant}")
        
        print(f"\n⚠️ 配置缺失: {len(analysis['no_config'])} 个商户")
        if analysis['no_config']:
            for merchant in sorted(analysis['no_config']):
                print(f"   - {merchant}")
        
        print(f"\n⏰ 发送超时: {len(analysis['timeout'])} 个商户")
        if analysis['timeout']:
            for merchant in sorted(analysis['timeout']):
                print(f"   - {merchant}")
        
        total_failed = len(analysis['failed']) + len(analysis['no_config']) + len(analysis['timeout'])
        print(f"\n📋 需要重试的商户总数: {total_failed} 个")
    
    def display_retry_results(self, retry_results: List[Dict[str, Any]]):
        """显示重试结果"""
        if not retry_results:
            print("\n[INFO] 没有重试结果")
            return
        
        print("\n" + "="*60)
        print("🔄 重试结果汇总")
        print("="*60)
        
        # 按商户分组显示结果
        merchant_results = {}
        for result in retry_results:
            merchant = result['merchant']
            if merchant not in merchant_results:
                merchant_results[merchant] = []
            merchant_results[merchant].append(result)
        
        for merchant, results in sorted(merchant_results.items()):
            print(f"\n🏪 {merchant}:")
            for result in results:
                channel = result.get('channel', 'unknown')
                target = result.get('target', 'N/A')
                status = result.get('status', 'unknown')
                reason = result.get('reason', 'N/A')
                
                status_emoji = "✅" if status == 'success' else "❌"
                print(f"  {status_emoji} {channel} -> {target} ({reason})")
        
        # 显示统计信息
        summary = self._generate_retry_summary(retry_results)
        print(f"\n📊 重试统计:")
        print(f"   总商户数: {summary['total_merchants']}")
        print(f"   成功: {summary['success_merchants']}")
        print(f"   失败: {summary['failed_merchants']}")
        print(f"   成功率: {summary['success_rate']}")
    
    def send_lark_confirmation(self, failed_merchants: List[str], retry_type: str = "manual") -> bool:
        """发送Lark确认消息"""
        try:
            # 获取当前年月
            current_date = datetime.now()
            year = str(current_date.year)
            month = str(current_date.month).zfill(2)
            
            # 创建Lark发送器
            lark_sender = LarkConfirmationSender(year, month)
            
            # 构建重试确认消息
            retry_summary = {
                'retry_type': retry_type,
                'failed_merchants': failed_merchants,
                'merchant_count': len(failed_merchants),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # 创建重试确认消息内容
            message = self._create_retry_confirmation_message(retry_summary)
            
            # 发送消息到Lark群
            success = lark_sender.send_text_message(message)
            
            if success:
                print("[INFO] Lark确认消息发送成功")
            else:
                print("[ERROR] Lark确认消息发送失败")
                
            return success
            
        except Exception as e:
            print(f"[ERROR] 发送Lark确认消息时出错: {str(e)}")
            return False
    
    def send_interactive_confirmation(self, failed_merchants: List[str], retry_type: str = "manual") -> Optional[str]:
        """发送带确认按钮的Lark消息并返回批次ID"""
        try:
            # 生成批次ID
            batch_id = f"retry_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # 创建重试汇总信息
            retry_summary = {
                'retry_type': retry_type,
                'failed_merchants': failed_merchants,
                'total_count': len(failed_merchants),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # 保存批次记录
            self._save_retry_batch_record(batch_id, retry_summary)
            
            # 发送带确认按钮的消息
            success = self._send_interactive_message(batch_id, retry_summary)
            
            return batch_id if success else None
            
        except Exception as e:
            print(f"[ERROR] 发送交互式确认消息失败: {str(e)}")
            return None
    
    def _generate_confirmation_token(self, batch_id: str, action: str) -> str:
        """生成确认/拒绝操作的签名token"""
        try:
            # 从配置中获取app_secret
            from config_loader import get_config
            config = get_config()
            lark_config = config.get_lark_config()
            app_secret = lark_config.get('app_secret', 'default_secret')
            
            # 使用app_secret作为密钥
            secret = app_secret.encode('utf-8')
            # 对于重试操作，使用当前年月作为后缀
            current_time = datetime.now()
            year_month = current_time.strftime('%Y%m')
            message = f"{batch_id}:{action}:{year_month}".encode('utf-8')
            
            # 生成HMAC签名
            signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
            return signature[:16]  # 取前16位作为token
        except Exception as e:
            print(f"[ERROR] 生成确认token失败: {str(e)}")
            return "default_token"
    
    def _save_retry_batch_record(self, batch_id: str, retry_summary: Dict[str, Any]) -> str:
        """保存重试批次记录到本地"""
        try:
            # 确保records目录存在
            os.makedirs('records', exist_ok=True)
            
            # 生成确认/拒绝链接
            confirm_token = self._generate_confirmation_token(batch_id, 'confirm')
            reject_token = self._generate_confirmation_token(batch_id, 'reject')
            
            # 构建批次记录
            batch_record = {
                "batch_id": batch_id,
                "type": "retry",
                "created_at": datetime.now().isoformat(),
                "status": "pending",
                "retry_summary": retry_summary,
                "confirm_url": f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=confirm&code={confirm_token}",
                "reject_url": f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=reject&code={reject_token}",
                "confirm_token": confirm_token,
                "reject_token": reject_token
            }
            
            # 保存到文件
            record_file = f"records/batch_{batch_id}.json"
            with open(record_file, 'w', encoding='utf-8') as f:
                json.dump(batch_record, f, ensure_ascii=False, indent=2)
            
            print(f"[INFO] 重试批次记录已保存: {record_file}")
            return record_file
            
        except Exception as e:
            print(f"[ERROR] 保存重试批次记录失败: {str(e)}")
            return ""
    
    def _send_interactive_message(self, batch_id: str, retry_summary: Dict[str, Any]) -> bool:
        """发送带确认按钮的交互式消息"""
        try:
            from config_loader import get_config
            import requests
            
            config = get_config()
            lark_config = config.get_lark_config()
            
            # 获取访问令牌
            app_id = lark_config.get('app_id')
            app_secret = lark_config.get('app_secret')
            group_id = lark_config.get('group_id') or lark_config.get('chat_id')
            
            if not all([app_id, app_secret, group_id]):
                print(f"[ERROR] Lark配置不完整: app_id={app_id}, app_secret={'***' if app_secret else None}, group_id={group_id}")
                return False
            
            # 获取access_token
            token_url = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"
            token_data = {
                "app_id": app_id,
                "app_secret": app_secret
            }
            
            token_response = requests.post(token_url, json=token_data)
            if token_response.status_code != 200:
                print(f"[ERROR] 获取访问令牌失败: {token_response.status_code}")
                return False
            
            token_result = token_response.json()
            if token_result.get('code') != 0:
                print(f"[ERROR] 获取访问令牌失败: {token_result.get('msg')}")
                return False
            
            access_token = token_result['app_access_token']
            
            # 生成确认/拒绝链接
            confirm_token = self._generate_confirmation_token(batch_id, 'confirm')
            reject_token = self._generate_confirmation_token(batch_id, 'reject')
            
            confirm_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=confirm&code={confirm_token}"
            reject_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=reject&code={reject_token}"
            
            # 构建交互式卡片内容
            card_content = self._build_retry_card_content(retry_summary, confirm_url, reject_url)
            
            # 发送消息
            message_url = "https://open.feishu.cn/open-apis/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            message_data = {
                "receive_id": group_id,
                "msg_type": "interactive",
                "content": card_content
            }
            
            params = {"receive_id_type": "chat_id"}
            
            response = requests.post(message_url, params=params, json=message_data, headers=headers)
            
            if response.status_code != 200:
                print(f"[ERROR] 发送交互式消息失败: {response.status_code}")
                return False
            
            result = response.json()
            if result.get('code') == 0:
                print(f"[INFO] 交互式确认消息发送成功")
                print(f"[INFO] 确认链接: {confirm_url}")
                print(f"[INFO] 拒绝链接: {reject_url}")
                return True
            else:
                print(f"[ERROR] 发送交互式消息失败: {result.get('msg')}")
                return False
                
        except Exception as e:
            print(f"[ERROR] 发送交互式消息异常: {str(e)}")
            return False
    
    def _build_retry_card_content(self, retry_summary: Dict[str, Any], confirm_url: str, reject_url: str) -> str:
        """构建重试确认的交互式卡片内容"""
        try:
            retry_type = retry_summary.get('retry_type', 'unknown')
            failed_merchants = retry_summary.get('failed_merchants', [])
            total_count = retry_summary.get('total_count', 0)
            timestamp = retry_summary.get('timestamp', '')
            
            # 商户列表处理
            if len(failed_merchants) <= 10:
                merchant_list = ', '.join(failed_merchants)
            else:
                merchant_list = ', '.join(failed_merchants[:10]) + f' 等{total_count}个商户'
            
            card_template = {
                "config": {
                    "wide_screen_mode": True
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "content": "🔄 **账单重试确认** Bill Retry Confirmation",
                            "tag": "lark_md"
                        }
                    },
                    {
                        "tag": "hr"
                    },
                    {
                        "tag": "div",
                        "fields": [
                            {
                                "is_short": True,
                                "text": {
                                    "content": f"**重试类型 Retry Type:**\n{retry_type}",
                                    "tag": "lark_md"
                                }
                            },
                            {
                                "is_short": True,
                                "text": {
                                    "content": f"**商户数量 Merchant Count:**\n{total_count}",
                                    "tag": "lark_md"
                                }
                            }
                        ]
                    },
                    {
                        "tag": "div",
                        "text": {
                            "content": f"**商户列表 Merchant List:**\n{merchant_list}",
                            "tag": "lark_md"
                        }
                    },
                    {
                        "tag": "div",
                        "text": {
                            "content": f"**操作时间 Operation Time:**\n{timestamp}",
                            "tag": "lark_md"
                        }
                    },
                    {
                        "tag": "hr"
                    },
                    {
                        "tag": "div",
                        "text": {
                            "content": "请确认是否执行重试操作 Please confirm whether to execute the retry operation",
                            "tag": "lark_md"
                        }
                    },
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "button",
                                "text": {
                                    "content": "✅ 确认重试 Confirm Retry",
                                    "tag": "plain_text"
                                },
                                "type": "primary",
                                "url": confirm_url
                            },
                            {
                                "tag": "button",
                                "text": {
                                    "content": "❌ 取消重试 Cancel Retry",
                                    "tag": "plain_text"
                                },
                                "type": "danger",
                                "url": reject_url
                            }
                        ]
                    }
                ]
            }
            
            return json.dumps(card_template, ensure_ascii=False)
            
        except Exception as e:
            print(f"[ERROR] 构建重试卡片内容失败: {str(e)}")
            return "{}"
    
    def wait_for_confirmation(self, batch_id: str, timeout_seconds: int = 300) -> Optional[str]:
        """等待用户确认，返回确认结果：'confirm', 'reject', 或 None（超时）"""
        try:
            print(f"[INFO] 等待用户确认，超时时间: {timeout_seconds}秒")
            print(f"[INFO] 批次ID: {batch_id}")
            
            start_time = time.time()
            record_file = f"records/batch_{batch_id}.json"
            
            while time.time() - start_time < timeout_seconds:
                # 检查批次记录状态
                if os.path.exists(record_file):
                    try:
                        with open(record_file, 'r', encoding='utf-8') as f:
                            batch_record = json.load(f)
                        
                        status = batch_record.get('status', 'pending')
                        if status == 'confirmed':
                            print(f"[INFO] 用户已确认重试操作")
                            return 'confirm'
                        elif status == 'rejected':
                            print(f"[INFO] 用户已拒绝重试操作")
                            return 'reject'
                        
                    except Exception as e:
                        print(f"[WARNING] 读取批次记录失败: {str(e)}")
                
                # 等待1秒后再次检查
                time.sleep(1)
                
                # 每30秒显示一次等待提示
                elapsed = int(time.time() - start_time)
                if elapsed % 30 == 0 and elapsed > 0:
                    remaining = timeout_seconds - elapsed
                    print(f"[INFO] 仍在等待用户确认，剩余时间: {remaining}秒")
            
            print(f"[WARNING] 等待确认超时（{timeout_seconds}秒）")
            return None
            
        except Exception as e:
            print(f"[ERROR] 等待确认过程异常: {str(e)}")
            return None
    
    def _create_retry_confirmation_message(self, retry_summary: Dict[str, Any]) -> str:
        """创建重试确认消息内容"""
        retry_type = retry_summary.get('retry_type', 'manual')
        failed_merchants = retry_summary.get('failed_merchants', [])
        merchant_count = retry_summary.get('merchant_count', 0)
        timestamp = retry_summary.get('timestamp', '')
        
        # 构建商户列表
        merchants_list = ', '.join(failed_merchants[:10])  # 最多显示10个商户
        if len(failed_merchants) > 10:
            merchants_list += f" 等{merchant_count}个商户"
        
        # 创建双语消息
        message = f"""🔄 账单重试确认 Bill Retry Confirmation

重试类型 Retry Type: {retry_type.upper()}
重试商户 Retry Merchants: {merchants_list}
商户数量 Merchant Count: {merchant_count}

⚠️ 请确认是否执行账单重试操作
Please confirm whether to execute the bill retry operation

时间 Time: {timestamp}"""
        
        return message

def main():
    parser = argparse.ArgumentParser(description='账单发送失败重试工具')
    parser.add_argument('--batch-id', help='批次ID（自动模式）')
    parser.add_argument('--manual', action='store_true', help='手动指定商户模式')
    parser.add_argument('--merchants', help='手动指定的商户列表（逗号分隔）')
    parser.add_argument('--interactive', action='store_true', help='交互模式')
    parser.add_argument('--analyze-only', action='store_true', help='仅分析不重试')
    
    args = parser.parse_args()
    
    retry_manager = BillRetryManager()
    
    if args.interactive:
        # 交互模式
        print("🔄 账单重试工具 - 交互模式")
        print("\n可用的批次记录:")
        
        # 列出可用的批次记录
        if os.path.exists(retry_manager.records_dir):
            batch_files = [f for f in os.listdir(retry_manager.records_dir) 
                          if f.startswith('batch_') and f.endswith('.json')]
            
            if batch_files:
                for i, batch_file in enumerate(sorted(batch_files), 1):
                    batch_id = batch_file.replace('batch_', '').replace('.json', '')
                    print(f"  {i}. {batch_id}")
                
                try:
                    choice = input("\n请选择批次编号（或输入批次ID）: ").strip()
                    if choice.isdigit():
                        batch_id = sorted(batch_files)[int(choice)-1].replace('batch_', '').replace('.json', '')
                    else:
                        batch_id = choice
                except (ValueError, IndexError):
                    print("[ERROR] 无效选择")
                    return 1
            else:
                batch_id = input("请输入批次ID: ").strip()
        else:
            batch_id = input("请输入批次ID: ").strip()
    
    elif args.manual and args.merchants:
        # 手动模式
        print("🔄 账单重试工具 - 手动模式")
        failed_merchants = [m.strip() for m in args.merchants.split(',')]
        
        print(f"[INFO] 手动指定重试商户: {failed_merchants}")
        
        # 获取商户通道配置
        merchant_channels = retry_manager.get_merchant_channels()
        if not merchant_channels:
            print("[ERROR] 无法获取商户通道配置")
            return 1
        
        # 发送交互式确认消息并等待用户确认
        print("[INFO] 发送交互式确认消息...")
        batch_id = retry_manager.send_interactive_confirmation(failed_merchants, "manual")
        
        if batch_id:
            print("[INFO] 交互式确认消息发送成功，等待用户确认...")
            confirmation_result = retry_manager.wait_for_confirmation(batch_id, timeout_seconds=300)
            
            if confirmation_result == 'confirm':
                print("[INFO] 用户已确认，开始执行重试...")
                # 执行重试
                retry_results = retry_manager.retry_failed_merchants(failed_merchants, merchant_channels)
            elif confirmation_result == 'reject':
                print("[INFO] 用户已拒绝重试操作")
                return 0
            else:
                print("[WARNING] 等待确认超时，取消重试操作")
                return 0
        else:
            print("[WARNING] 交互式确认消息发送失败，使用简单确认消息...")
            lark_success = retry_manager.send_lark_confirmation(failed_merchants, "manual")
            if not lark_success:
                print("[WARNING] Lark确认消息发送失败，但继续执行重试")
            
            # 执行重试
            retry_results = retry_manager.retry_failed_merchants(failed_merchants, merchant_channels)
        
        # 显示结果
        retry_manager.display_retry_results(retry_results)
        
        # 保存结果
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        retry_manager.save_retry_results(f"manual_{timestamp}", retry_results)
        
        return 0
    
    elif args.batch_id:
        # 自动模式
        batch_id = args.batch_id
        print(f"🔄 账单重试工具 - 自动模式 (批次: {batch_id})")
    
    else:
        parser.print_help()
        return 1
    
    # 加载批次记录
    print(f"\n[INFO] 加载批次记录: {batch_id}")
    batch_record = retry_manager.load_batch_record(batch_id)
    if not batch_record:
        return 1
    
    # 分析发送结果
    print("[INFO] 分析发送结果...")
    analysis = retry_manager.analyze_send_results(batch_record)
    
    # 显示分析结果
    retry_manager.display_analysis_results(analysis)
    
    if args.analyze_only:
        print("\n[INFO] 仅分析模式，不执行重试")
        return 0
    
    # 确认是否执行重试
    total_failed = len(analysis['failed']) + len(analysis['no_config']) + len(analysis['timeout'])
    if total_failed == 0:
        print("\n[INFO] 没有需要重试的商户")
        return 0
    
    if not args.interactive or input(f"\n是否重试 {total_failed} 个失败商户? (y/N): ").lower() == 'y':
        # 获取商户通道配置
        merchant_channels = retry_manager.get_merchant_channels()
        if not merchant_channels:
            print("[ERROR] 无法获取商户通道配置")
            return 1
        
        # 合并所有需要重试的商户
        failed_merchants = analysis['failed'] + analysis['no_config'] + analysis['timeout']
        
        # 发送交互式确认消息并等待用户确认
        print("[INFO] 发送交互式确认消息...")
        batch_id = retry_manager.send_interactive_confirmation(failed_merchants, "batch")
        
        if batch_id:
            print("[INFO] 交互式确认消息发送成功，等待用户确认...")
            confirmation_result = retry_manager.wait_for_confirmation(batch_id, timeout_seconds=300)
            
            if confirmation_result == 'confirm':
                print("[INFO] 用户已确认，开始执行重试...")
                # 执行重试
                retry_results = retry_manager.retry_failed_merchants(failed_merchants, merchant_channels)
            elif confirmation_result == 'reject':
                print("[INFO] 用户已拒绝重试操作")
                return 0
            else:
                print("[WARNING] 等待确认超时，取消重试操作")
                return 0
        else:
            print("[WARNING] 交互式确认消息发送失败，使用简单确认消息...")
            lark_success = retry_manager.send_lark_confirmation(failed_merchants, "batch")
            if not lark_success:
                print("[WARNING] Lark确认消息发送失败，但继续执行重试")
            
            # 执行重试
            retry_results = retry_manager.retry_failed_merchants(failed_merchants, merchant_channels)
        
        # 显示结果
        retry_manager.display_retry_results(retry_results)
        
        # 保存结果
        retry_manager.save_retry_results(batch_id, retry_results)
    
    return 0

if __name__ == '__main__':
    sys.exit(main())