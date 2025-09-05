#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单一确认发送器 - 解决重复确认请求问题
只发送一个完整的确认请求，包含：
1. 完整商户列表和正确数据
2. PDF打包压缩文件
3. 清晰的确认信息，无意义不明单词
"""

import os
import sys
import json
import zipfile
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Union
import glob

class SingleConfirmationSender:
    def __init__(self, year: str, month: str):
        self.year = year
        self.month = month
        self.month_str = f"{year}年{month}月"
        self.pdf_dir = "complete_invoice_pdfs"
        
    def create_pdf_package(self) -> Optional[Union[str, List[str]]]:
        """创建PDF打包文件 - 集成优化逻辑，超过10个PDF时自动分割
        返回：单个ZIP包路径 或 多个ZIP包路径列表"""
        if not os.path.exists(self.pdf_dir):
            print(f"[ERROR] PDF目录不存在: {self.pdf_dir}")
            return None
            
        pdf_files = [f for f in os.listdir(self.pdf_dir) if f.endswith('.pdf')]
        if not pdf_files:
            print("[ERROR] 未找到PDF文件")
            return None
        
        print(f"[INFO] 找到 {len(pdf_files)} 个PDF文件")
        
        # 检查是否需要分割ZIP包
        max_files_per_package = 10  # 每个包最多10个PDF
        
        if len(pdf_files) <= max_files_per_package:
            # 文件数量不超过限制，创建单个ZIP包
            return self._create_single_zip(pdf_files)
        else:
            # 文件数量超过限制，创建多个优化ZIP包
            return self._create_optimized_zip_packages(pdf_files, max_files_per_package)
    
    def _create_single_zip(self, pdf_files: List[str]) -> str:
        """创建单个ZIP包"""
        try:
            # 创建ZIP文件
            zip_filename = f"账单PDF包_{self.year}{self.month}_{datetime.now().strftime('%H%M%S')}.zip"
            zip_path = os.path.join("output", zip_filename)
            
            # 确保output目录存在
            os.makedirs("output", exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for pdf_file in pdf_files:
                    pdf_path = os.path.join(self.pdf_dir, pdf_file)
                    zipf.write(pdf_path, pdf_file)
                    print(f"   📄 添加: {pdf_file}")
            
            file_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
            print(f"[SUCCESS] 单个PDF打包完成: {zip_filename} ({file_size_mb:.1f}MB, {len(pdf_files)}个PDF)")
            return zip_path
            
        except Exception as e:
            print(f"[ERROR] 创建单个ZIP包失败: {str(e)}")
            return None
    
    def _create_optimized_zip_packages(self, pdf_files: List[str], max_files_per_package: int) -> str:
        """创建优化的ZIP包，自动分割成多个包"""
        try:
            timestamp = datetime.now().strftime('%H%M%S')
            
            # 计算需要多少个包
            total_files = len(pdf_files)
            num_packages = (total_files + max_files_per_package - 1) // max_files_per_package
            
            print(f"[INFO] PDF数量({total_files})超过限制({max_files_per_package})，将分割成{num_packages}个ZIP包")
            
            # 创建第一个包作为主包
            main_package_files = pdf_files[:max_files_per_package]
            main_zip_path = self._create_single_zip(main_package_files)
            
            if not main_zip_path:
                return None
            
            # 创建额外的ZIP包
            additional_zips = []
            for i in range(1, num_packages):
                start_idx = i * max_files_per_package
                end_idx = min(start_idx + max_files_per_package, total_files)
                package_files = pdf_files[start_idx:end_idx]
                
                package_filename = f"账单PDF包_{self.year}{self.month}_包{i+1}_{len(package_files)}个PDF_{timestamp}.zip"
                package_path = os.path.join("output", package_filename)
                
                # 确保output目录存在
                os.makedirs("output", exist_ok=True)
                
                with zipfile.ZipFile(package_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for pdf_file in package_files:
                        pdf_path = os.path.join(self.pdf_dir, pdf_file)
                        zipf.write(pdf_path, pdf_file)
                        print(f"   📄 添加: {pdf_file}")
                
                package_size_mb = os.path.getsize(package_path) / (1024 * 1024)
                print(f"[SUCCESS] 包{i+1}创建成功: {package_filename} ({package_size_mb:.1f}MB, {len(package_files)}个PDF)")
                additional_zips.append(package_path)
            
            # 记录优化结果
            print(f"[INFO] ZIP包优化完成:")
            print(f"   📦 主包: {os.path.basename(main_zip_path)} ({len(main_package_files)}个PDF)")
            for i, zip_path in enumerate(additional_zips, 2):
                file_count = len([f for f in pdf_files if f in pdf_files[(i-1)*max_files_per_package:i*max_files_per_package]])
                print(f"   📦 包{i}: {os.path.basename(zip_path)} ({file_count}个PDF)")
            
            # 返回所有包的路径列表
            all_packages = [main_zip_path] + additional_zips
            print(f"[INFO] 返回所有ZIP包路径: {len(all_packages)}个包")
            return all_packages
            
        except Exception as e:
            print(f"[ERROR] 创建优化ZIP包失败: {str(e)}")
            return None
    
    def _normalize_name(self, name: str) -> str:
        mapping = {
            'Barbet': 'Brabet',
        }
        return mapping.get(name, name)

    def _load_final_amounts(self) -> Optional[Dict[str, float]]:
        """优先读取统一金额JSON，若不存在返回None。"""
        final_file_candidates = [
            f"final_merchant_amounts_{self.year}_{self.month}.json",  # 仅尝试目标年月
        ]
        for path in final_file_candidates:
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    amounts = data.get('amounts') if isinstance(data, dict) else None
                    if isinstance(amounts, dict):
                        # 键名做一次规范化，避免 Barbet/Brabet 分裂
                        normalized: Dict[str, float] = {}
                        for k, v in amounts.items():
                            normalized[self._normalize_name(k)] = float(v)
                        print(f"[INFO] 使用统一金额JSON: {path} (商户数: {len(normalized)})")
                        return normalized
                except Exception as e:
                    print(f"[WARNING] 读取统一金额JSON失败 {path}: {e}")
        return None

    def get_merchant_summary(self) -> Dict:
        """获取完整商户列表和数据"""
        if not os.path.exists(self.pdf_dir):
            return {}
            
        pdf_files = sorted([f for f in os.listdir(self.pdf_dir) if f.endswith('.pdf')], key=lambda x: x.lower())
        
        # 1) 优先读取统一金额JSON；若加载成功，严格以其为准
        final_amounts = self._load_final_amounts()
        use_final_only = final_amounts is not None
        if not use_final_only:
            print("[INFO] 未找到统一金额JSON，回退到原始计算逻辑")
            billing_data = self.load_billing_data_like_pdf_generator()
        else:
            billing_data = None
        
        # 整理商户信息
        merchants = {}
        total_amount = 0
        
        for pdf_file in pdf_files:
            # 从文件名提取商户名，兼容两种命名：
            # 1) "商户名_YYYY年MM月_賬單.pdf"
            # 2) "YYYY年MM月_商户名_賬單.pdf"
            base_name = pdf_file[:-4] if pdf_file.lower().endswith('.pdf') else pdf_file
            # 去掉尾部的 "_賬單"
            if base_name.endswith('_賬單'):
                base_name = base_name[:-3]
            parts = base_name.split('_')
            candidate_name = base_name
            if len(parts) >= 2:
                # 判断第一段是否为期间
                first, second = parts[0], parts[1]
                if first.endswith('月') and first.startswith(f"{self.year}年{self.month}"):
                    candidate_name = second
                elif len(parts) >= 2 and parts[1].endswith('月') and parts[1].startswith(f"{self.year}年{self.month}"):
                    candidate_name = parts[0]
                else:
                    # 默认取第一段为商户名
                    candidate_name = parts[0]
            merchant_name = self._normalize_name(candidate_name)
            
            # 获取账单金额
            amount = 0.0
            if use_final_only:
                amount = float(final_amounts.get(merchant_name, 0.0))
                if merchant_name not in final_amounts:
                    print(f"[WARNING] 统一金额JSON缺少商户: {merchant_name}，默认0.00")
            else:
                if merchant_name in billing_data:
                    amount = float(billing_data[merchant_name].get('total_amount', 0.0))
                else:
                    print(f"[WARNING] 计算逻辑缺少商户: {merchant_name}，默认0.00")
            
            merchants[merchant_name] = {
                'amount': amount,
                'pdf_file': pdf_file
            }
            total_amount += amount
        
        summary = {
            'merchants': merchants,
            'total_count': len(merchants),
            'total_amount': total_amount,
            'period': self.month_str
        }
        print(f"[INFO] 汇总完成：商户{summary['total_count']}个，总金额{summary['total_amount']:.2f} USDT（{'统一金额JSON' if use_final_only else '原始计算'}）")
        return summary
    
    def load_billing_data_like_pdf_generator(self) -> Dict:
        """使用与PDF生成器相同的数据加载逻辑"""
        # 数据源优先级：使用最新的数据文件
        august_files = [
            'matched_merchant_excel_data_20250901_112555.json',  # 最新：完整交易明细
            'matched_merchant_excel_data_20250901_101424.json',  # 备选：较早的完整数据
            'billing_data_2025_08.json',  # 备选：详细数据但可能缺少映射
            'main_merchant_bills_summary.json'  # 最后：仅汇总数据
        ]
        
        for file_path in august_files:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # 使用与PDF生成器完全相同的处理逻辑
                    if isinstance(data, dict):
                        billing_data = {}
                        for merchant_name, merchant_info in data.items():
                            sub_merchants = merchant_info.get('sub_merchants', [])
                            fee_rate = merchant_info.get('fee', 0.0)
                            
                            if sub_merchants:  # 只处理有子商户数据的主商户
                                total_amount = 0
                                details = []
                                
                                for sub_merchant in sub_merchants:
                                    account = sub_merchant.get('C_merchant_name', '')
                                    currencies = sub_merchant.get('currencies', [])
                                    
                                    for currency_data in currencies:
                                        total_bet = currency_data.get('total_bet', 0)
                                        total_prize = currency_data.get('total_prize', 0)
                                        net_win = currency_data.get('net_win', 0)
                                        usd_rate = currency_data.get('usd_rate', 1.0)
                                        charge_usdt = currency_data.get('charge_usdt', 0)
                                        
                                        # 使用与PDF生成器完全相同的数据过滤规则
                                        if total_bet > 0 or total_prize > 0:
                                            total_amount += charge_usdt
                                
                                # 修正：保留所有有子商户的商户，即使金额为0
                                # 这样可以确保商户列表的完整性
                                billing_data[merchant_name] = {
                                    'merchant': merchant_name,
                                    'period': '2025年08月',
                                    'fee_rate': fee_rate,
                                    'total_amount': total_amount
                                }
                        
                        if billing_data:
                            print(f"[SUCCESS] 加载账单数据: {file_path}")
                            print(f"[INFO] 使用与PDF生成器完全相同的计算逻辑")
                            print(f"[INFO] 加载了 {len(billing_data)} 个商户")
                            return billing_data
                            
                except Exception as e:
                    print(f"[WARNING] 加载文件失败 {file_path}: {e}")
                    continue
        
        print("[WARNING] 未找到有效的账单数据")
        return {}
    
    def get_merchant_summary_with_master_merchant(self) -> Dict:
        """优先获取主商户维度的汇总信息"""
        # 1. 尝试按目标年月加载主商户统计报告
        month_tag = f"{self.year}{str(self.month).zfill(2)}"
        pattern = f"master_merchant_report_{month_tag}_*.json"
        master_report_files = glob.glob(pattern)
        if not master_report_files:
            # 回退：任意主商户报告（兼容老文件）
            print(f"[WARNING] 未找到当月主商户报告: {pattern}，回退到任意报告")
            master_report_files = [f for f in os.listdir('.') if f.startswith('master_merchant_report_') and f.endswith('.json')]
        if master_report_files:
            latest_report = max(master_report_files, key=os.path.getctime)
            try:
                with open(latest_report, 'r', encoding='utf-8') as f:
                    master_data = json.load(f)
                
                # 检查是否是目标年月的数据
                if 'mapping_stats' in master_data and 'mapped_data' in master_data:
                    print(f"[INFO] 使用主商户统计报告: {latest_report}")
                    
                    # 转换为主商户维度的汇总（采用与PDF一致的计算公式）
                    mapped_data = master_data['mapped_data']
                    merchants = {}
                    total_amount = 0.0
                    
                    for merchant_id, data in mapped_data.items():
                        fee_rate_pct = float(data.get('fee_rate', 0) or 0)
                        fee_rate = fee_rate_pct / 100.0
                        sub_merchants = data.get('sub_merchants', []) or []
                        # 计算：Charge = Σ(GGR × USD Rate × Fee Rate%)
                        merchant_charge = 0.0
                        for sub in sub_merchants:
                            for cur in sub.get('currencies', []) or []:
                                total_prize = float(cur.get('total_prize', 0) or 0)
                                total_bet = float(cur.get('total_bet', 0) or 0)
                                ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                                usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                                merchant_charge += ggr * usd_rate * fee_rate
                        # 包含所有有子商户/交易记录的主商户，即使金额为0
                        if sub_merchants:
                            merchants[merchant_id] = {
                                'amount': merchant_charge,
                                'fee_rate': fee_rate_pct,
                                'sub_merchants_count': len(sub_merchants),
                                'transactions_count': data.get('transactions_count', 0)
                            }
                            total_amount += merchant_charge
                     
                     # 按费率分组排序
                    fee_groups = {}
                    for merchant_id, data in merchants.items():
                        fee_rate = data['fee_rate']
                        if fee_rate not in fee_groups:
                            fee_groups[fee_rate] = []
                        fee_groups[fee_rate].append({
                            'merchant_id': merchant_id,
                            'amount': data['amount'],
                            'sub_merchants_count': data['sub_merchants_count']
                        })
                     
                     # 构建主商户维度的汇总
                    summary = {
                        'merchants': merchants,
                        'total_count': len(merchants),
                        'total_amount': total_amount,
                        'period': self.month_str,
                        'fee_groups': fee_groups,
                        'is_master_merchant': True
                    }
                     
                    print(f"[SUCCESS] 主商户维度统计: {len(merchants)}个主商户, 总金额: {total_amount:.2f} USDT")
                    return summary
                     
            except Exception as e:
                print(f"[WARNING] 读取主商户统计报告失败: {e}")
         
         # 2. 如果主商户统计不可用，回退到原来的方法
        print("[INFO] 主商户统计不可用，回退到原始汇总方法")
        return self.get_merchant_summary()
    
    def create_confirmation_message(self, zip_path: str, summary: Dict) -> str:
        """创建确认消息"""
        merchants = summary['merchants']
        total_count = summary['total_count']
        total_amount = summary['total_amount']
        period = summary['period']
        
        # 检查是否是主商户维度的汇总
        is_master_merchant = summary.get('is_master_merchant', False)
        
        if is_master_merchant and 'fee_groups' in summary:
            # 主商户维度的汇总消息
            message = f"""[SUMMARY] 主商户维度账单汇总

[ID] 批次ID: {datetime.now().strftime('%Y%m%d_%H%M%S')}
[SENT] 已发送: {total_count} 个主商户账单
[AMOUNT] 應付縂金額: {total_amount:.2f} USDT (主商户汇总)
[PERIOD] 账期: {period}

主商户维度统计 (按费率分组):"""
            
            # 按费率分组显示
            for fee_rate in sorted(summary['fee_groups'].keys()):
                fee_merchants = summary['fee_groups'][fee_rate]
                group_total = sum(m['amount'] for m in fee_merchants)
                message += f"\n\n费率 {fee_rate}%: {len(fee_merchants)}个主商户, 总金额: {group_total:.2f} USDT"
                
                for m in sorted(fee_merchants, key=lambda x: x['amount'], reverse=True):
                    message += f"\n  • {m['merchant_id']}: {m['amount']:.2f} USDT ({m['sub_merchants_count']}个子商户)"
            
            message += f"""

请仔细核对以上主商户维度统计信息:
/confirm {datetime.now().strftime('%Y%m%d_%H%M%S')}

或回复 /reject {datetime.now().strftime('%Y%m%d_%H%M%S')} 拒绝发送"""
            
        else:
            # 原来的子商户级别消息
            message = f"""[SUMMARY] 聚单发送总览

[ID] 批次ID: {datetime.now().strftime('%Y%m%d_%H%M%S')}
[SENT] 已发送: {total_count} 个账单
[AMOUNT] 應付縂金額: {total_amount:.2f} USDT (所有子商戶的exchange_rate之和)
[PERIOD] 账期: {period}

商户列表 (共{total_count}个):"""
            
            # 添加商户列表
            for i, (merchant_name, data) in enumerate(sorted(merchants.items(), key=lambda kv: kv[0].lower()), 1):
                amount = data['amount']
                message += f"\n- {merchant_name}: {amount:.2f} USDT"
            
            message += f"""

请仔细核对以下合规信息发送给客户:
/confirm {datetime.now().strftime('%Y%m%d_%H%M%S')}

或回复 /reject {datetime.now().strftime('%Y%m%d_%H%M%S')} 拒绝发送"""
        
        return message
    
    def save_confirmation_record(self, zip_path: str, summary: Dict, message: str) -> str:
        """保存确认记录"""
        record = {
            'batch_id': datetime.now().strftime('%Y%m%d_%H%M%S'),
            'timestamp': datetime.now().isoformat(),
            'period': self.month_str,
            'pdf_package': zip_path,
            'merchant_count': summary['total_count'],
            'total_amount': summary['total_amount'],
            'merchants': summary['merchants'],
            'message': message,
            'status': 'pending'
        }
        
        record_file = f"confirmation_{self.year}{self.month}_{datetime.now().strftime('%H%M%S')}.json"
        
        try:
            with open(record_file, 'w', encoding='utf-8') as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
            
            print(f"[SUCCESS] 确认记录已保存: {record_file}")
            return record_file
            
        except Exception as e:
            print(f"[ERROR] 保存确认记录失败: {str(e)}")
            return ""
    
    def send_single_confirmation(self) -> bool:
        """发送单一确认请求"""
        print(f"[INFO] 开始发送{self.month_str}账单确认...")
        # 0. 先重新生成PDF，确保与统一金额JSON一致
        try:
            print("[INFO] 先生成最新PDF...")
            ret = subprocess.run([sys.executable, '-X', 'utf8', 'complete_invoice_pdf_generator.py', self.month_str], cwd=os.getcwd())
            if ret.returncode != 0:
                print("[WARNING] 生成PDF返回非0，继续使用现有PDF目录")
        except Exception as e:
            print(f"[WARNING] 生成PDF时发生异常: {e}")
        
        # 1. 创建PDF打包文件
        print("[INFO] 创建PDF打包文件...")
        zip_result = self.create_pdf_package()
        if not zip_result:
            return False
        
        # 处理ZIP包结果（可能是单个路径或路径列表）
        if isinstance(zip_result, str):
            zip_paths = [zip_result]
            print(f"[INFO] 单个ZIP包: {zip_result}")
        else:
            zip_paths = zip_result
            print(f"[INFO] 多个ZIP包: {len(zip_paths)}个")
            for i, path in enumerate(zip_paths, 1):
                print(f"   📦 包{i}: {os.path.basename(path)}")
        
        # 2. 获取商户汇总信息（优先使用主商户统计结果）
        print("[INFO] 获取商户汇总信息...")
        summary = self.get_merchant_summary_with_master_merchant()
        if not summary['merchants']:
            print("[ERROR] 未找到商户信息")
            return False
        
        # 3. 创建确认消息（使用第一个包作为主要包）
        print("[INFO] 创建确认消息...")
        main_zip_path = zip_paths[0]
        message = self.create_confirmation_message(main_zip_path, summary)
        
        # 4. 保存确认记录
        print("[INFO] 保存确认记录...")
        record_file = self.save_confirmation_record(main_zip_path, summary, message)
        
        # 5. 发送确认到Lark群
        print(f"[FILE] 主要PDF打包文件: {main_zip_path}")
        print("="*50)
        
        # 将所有ZIP包文件名注入summary用于卡片展示
        summary['zip_files'] = [os.path.basename(p) for p in zip_paths]
        lark_success = self.send_to_lark(zip_paths, summary)
        if not lark_success:
            print("[ERROR] Lark群确认消息发送失败")
            return False
        
        print(f"\n[SUCCESS] {self.month_str}账单确认发送完成")
        print(f"[INFO] 商户数量: {summary['total_count']}")
        print(f"[INFO] 总金额: {summary['total_amount']:.2f} USDT")
        print(f"[INFO] PDF打包: {len(zip_paths)}个ZIP包")
        for i, path in enumerate(zip_paths, 1):
            print(f"   📦 包{i}: {os.path.basename(path)}")
        
        return True
    
    def start_on_demand_listener(self):
        """启动智能按需监听器"""
        try:
            import subprocess
            import sys
            import threading
            
            print("[INFO] 启动智能按需监听器...")
            
            # 在后台线程中启动监听器
            def start_listener():
                try:
                    # 获取当前批次ID
                    batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
                    
                    # 启动智能监听器
                    process = subprocess.Popen([
                        sys.executable, '-X', 'utf8', 'smart_listener.py',
                        '--batch-id', batch_id,
                        '--timeout', '30'
                    ], cwd=os.getcwd())
                    
                    print(f"[SUCCESS] 智能监听器已启动 (PID: {process.pid})")
                    print("[INFO] 监听器将在30分钟后自动超时停止")
                    print("[INFO] 或在步骤5完成后10秒自动停止")
                    print("[INFO] 现在可以在TG群中发送 /confirm 命令")
                    
                except Exception as e:
                    print(f"[ERROR] 启动监听器失败: {str(e)}")
            
            # 启动后台线程
            thread = threading.Thread(target=start_listener)
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            print(f"[ERROR] 启动智能监听器异常: {str(e)}")
    
    def send_to_telegram(self, message: str, zip_path: str, summary: dict) -> bool:
        """发送确认消息到TG群"""
        try:
            # 导入TG发送器
            from telegram_sender import TelegramSender
            
            # 创建TG发送器
            tg_sender = TelegramSender()
            
            # 获取finance_chat_id
            chat_id = tg_sender.config.get('finance_chat_id')
            if not chat_id:
                print("[ERROR] 未配置finance_chat_id")
                return False
            
            print(f"[INFO] 发送确认消息到TG群: {chat_id}")
            
            # 发送消息
            result = tg_sender.send_message(chat_id, message)
            if result.get('status') == 'success':
                print("[SUCCESS] TG确认消息发送成功")
                
                # 发送PDF打包文件
                if os.path.exists(zip_path):
                    file_result = tg_sender.send_document(chat_id, zip_path, 
                                                        caption=f"2025年08月账单PDF包 - 共{summary['total_count']}个商户")
                    if file_result.get('status') == 'success':
                        print("[SUCCESS] PDF打包文件发送成功")
                        return True
                    else:
                        print(f"[WARNING] PDF文件发送失败: {file_result.get('error', '未知错误')}")
                        return True  # 消息发送成功就算成功
                else:
                    print("[WARNING] PDF打包文件不存在，只发送了消息")
                    return True
            else:
                print(f"[ERROR] TG消息发送失败: {result.get('error', '未知错误')}")
                return False
                
        except Exception as e:
            print(f"[ERROR] TG发送异常: {str(e)}")
            return False
    
    def send_to_lark(self, zip_paths: Union[str, List[str]], summary: dict) -> bool:
        """发送确认消息到Lark群，带确认按钮
        支持单个ZIP包路径或ZIP包路径列表"""
        try:
            # 导入Lark发送器
            from lark_confirmation_sender import LarkConfirmationSender
            
            # 创建Lark发送器
            lark_sender = LarkConfirmationSender(self.year, self.month)
            
            print(f"[INFO] 发送确认消息到Lark群...")
            
            # 处理ZIP包路径（可能是单个路径或路径列表）
            if isinstance(zip_paths, str):
                zip_paths = [zip_paths]
            
            print(f"[INFO] 准备发送 {len(zip_paths)} 个ZIP包到Lark")
            
            # 发送带确认按钮的交互式消息（使用第一个包作为主要包）
            main_zip_path = zip_paths[0]
            success = lark_sender.send_confirmation_message(main_zip_path, summary)
            if not success:
                print("[ERROR] Lark确认消息发送失败")
                return False
            
            print("[SUCCESS] Lark确认消息发送成功")
            print("[INFO] 确认按钮已添加到Lark群")
            
            # 如果有多个ZIP包，发送额外的包作为附件
            if len(zip_paths) > 1:
                print(f"[INFO] 发送额外的 {len(zip_paths)-1} 个ZIP包...")
                for i, zip_path in enumerate(zip_paths[1:], 2):
                    try:
                        # 发送额外的ZIP包
                        file_success = lark_sender.send_file_attachment(
                            zip_path, 
                            lark_sender.get_access_token(), 
                            lark_sender.get_group_id()
                        )
                        if file_success:
                            print(f"[SUCCESS] 包{i}发送成功: {os.path.basename(zip_path)}")
                        else:
                            print(f"[WARNING] 包{i}发送失败: {os.path.basename(zip_path)}")
                    except Exception as e:
                        print(f"[WARNING] 包{i}发送异常: {str(e)}")
                        continue
            
            return True
                
        except Exception as e:
            print(f"[ERROR] Lark发送异常: {str(e)}")
            return False

def main():
    if len(sys.argv) != 3:
        print("使用方法: python single_confirmation_sender.py <年> <月>")
        print("例如: python single_confirmation_sender.py 2025 08")
        sys.exit(1)
    
    year = sys.argv[1]
    month = sys.argv[2]
    
    sender = SingleConfirmationSender(year, month)
    success = sender.send_single_confirmation()
    
    if success:
        print("\n[SUCCESS] 单一确认发送完成")
        sys.exit(0)
    else:
        print("\n[ERROR] 确认发送失败")
        sys.exit(1)

if __name__ == "__main__":
    main()