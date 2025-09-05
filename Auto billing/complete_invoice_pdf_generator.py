#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整版发票风格PDF生成器 - 包含完整数据表格
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

class CompleteInvoicePDFGenerator:
    def __init__(self):
        self.output_dir = "complete_invoice_pdfs"
        
        # 清理旧文件
        self.clean_old_files()
        
        # 创建输出目录
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 注册中文字体
        self.setup_fonts()
        
        # 创建样式
        self.styles = self.create_styles()
        self.final_amounts = self._load_final_amounts()

    # Wrapper methods to call module-level helpers (which are defined at module scope)
    def create_header(self, merchant_data: Dict[str, Any]):
        return globals()['create_header'](self, merchant_data)

    def create_merchant_info(self, merchant_data: Dict[str, Any]):
        return globals()['create_merchant_info'](self, merchant_data)

    def create_invoice_info(self, merchant_data: Dict[str, Any]):
        return globals()['create_invoice_info'](self, merchant_data)

    def create_complete_data_table(self, merchant_data: Dict[str, Any]):
        return globals()['create_complete_data_table'](self, merchant_data)

    def create_summary(self, merchant_data: Dict[str, Any]):
        return globals()['create_summary'](self, merchant_data)

    def create_footer(self, merchant_data: Dict[str, Any]):
        return globals()['create_footer'](self, merchant_data)

    def _normalize_name(self, name: str) -> str:
        mapping = {
            'Barbet': 'Brabet',
        }
        return mapping.get(name, name)
    
    def _convert_period_to_yyyymm(self, period: str) -> str:
        """将中文期间格式转换为YYYYMM格式
        例如: '2025年08月' -> '202508'
        """
        import re
        # 匹配中文期间格式，如 "2025年08月"
        match = re.match(r'(\d{4})年(\d{1,2})月', period)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)  # 确保月份是两位数
            return f"{year}{month}"
        # 如果格式不匹配，返回原始字符串
        return period

    def _load_final_amounts(self) -> Optional[Dict[str, float]]:
        # 仅按目标年月尝试加载 final_merchant_amounts_{YYYY}_{MM}.json
        target_year = os.environ.get('TARGET_YYYY')
        target_month = os.environ.get('TARGET_MM')
        candidates = []
        if target_year and target_month:
            candidates.append(f"final_merchant_amounts_{target_year}_{target_month}.json")
        for path in candidates:
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    amounts = data.get('amounts') if isinstance(data, dict) else None
                    if isinstance(amounts, dict):
                        normalized: Dict[str, float] = {}
                        for k, v in amounts.items():
                            normalized[self._normalize_name(k)] = float(v)
                        print(f"[INFO] 使用统一金额JSON渲染PDF: {path} (商户数: {len(normalized)})")
                        return normalized
                except Exception as e:
                    print(f"[WARNING] 读取统一金额JSON失败 {path}: {e}")
        return None
    
    def clean_old_files(self):
        """清理所有旧的PDF文件"""
        directories_to_clean = [
            "complete_invoice_pdfs",
            "final_invoice_pdfs",
            "fixed_enhanced_invoice_pdfs",
            "enhanced_invoice_pdfs",
            "invoice_pdfs",
            "enhanced_pdfs", 
            "output/pdfs",
            "pdf_bills"
        ]
        
        for dir_path in directories_to_clean:
            if os.path.exists(dir_path):
                try:
                    import shutil
                    shutil.rmtree(dir_path)
                    print(f"[EMOJI]️  已清理目录: {dir_path}")
                except Exception as e:
                    print(f"[WARNING]  清理目录失败 {dir_path}: {e}")
    
    def setup_fonts(self):
        """设置中文字体"""
        try:
            font_paths = [
                "C:/Windows/Fonts/msyh.ttc",  # 微软雅黑
                "C:/Windows/Fonts/simsun.ttc",  # 宋体
                "C:/Windows/Fonts/simhei.ttf",  # 黑体
            ]
            
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        if font_path.endswith('msyh.ttc'):
                            pdfmetrics.registerFont(TTFont('YaHei', font_path, subfontIndex=0))
                            print("[SUCCESS] 成功注册微软雅黑字体")
                            break
                        elif font_path.endswith('simsun.ttc'):
                            pdfmetrics.registerFont(TTFont('SimSun', font_path, subfontIndex=0))
                            print("[SUCCESS] 成功注册宋体字体")
                            break
                        elif font_path.endswith('simhei.ttf'):
                            pdfmetrics.registerFont(TTFont('SimHei', font_path))
                            print("[SUCCESS] 成功注册黑体字体")
                            break
                    except Exception as e:
                        continue
            
            self.chinese_font = 'YaHei' if 'YaHei' in pdfmetrics.getRegisteredFontNames() else \
                               'SimSun' if 'SimSun' in pdfmetrics.getRegisteredFontNames() else \
                               'SimHei' if 'SimHei' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
                               
        except Exception as e:
            print(f"[WARNING]  字体注册失败，使用默认字体: {str(e)}")
            self.chinese_font = 'Helvetica'
    
    def create_styles(self):
        """创建完整版样式"""
        styles = getSampleStyleSheet()
        
        # 标题样式
        styles.add(ParagraphStyle(
            name='CompleteTitle',
            parent=styles['Title'],
            fontName=self.chinese_font,
            fontSize=24,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=40,
            spaceBefore=20
        ))
        
        # 主商户样式
        styles.add(ParagraphStyle(
            name='MainMerchant',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=16,
            textColor=colors.black,
            fontWeight='bold',
            spaceAfter=12,
            spaceBefore=8,
            leading=24  # 增加行间距支持换行
        ))
        
        # 信息样式
        styles.add(ParagraphStyle(
            name='InfoText',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=11,
            textColor=colors.black,
            spaceAfter=8,
            leading=18  # 增加行间距支持换行
        ))
        
        # 页脚样式
        styles.add(ParagraphStyle(
            name='CompleteFooter',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=10,
            textColor=colors.black,
            alignment=TA_CENTER,
            leading=16  # 增加行间距支持换行
        ))
        
        return styles
    
    def load_master_merchant_data(self, target_period: str = None):
        """优先加载主商户统计报告数据"""
        if target_period is None:
            from datetime import datetime
            now = datetime.now()
            target_period = f"{now.year}年{now.month:02d}月"
        
        print(f"[INFO] 尝试加载主商户统计报告: {target_period}")
        
        # 按目标月份查找主商户统计报告
        import glob
        target_yyy = os.environ.get('TARGET_YYYY')
        target_mm = os.environ.get('TARGET_MM')
        month_tag = None
        if target_yyy and target_mm:
            month_tag = f"{target_yyy}{str(target_mm).zfill(2)}"
        pattern = f"master_merchant_report_{month_tag}_*.json" if month_tag else 'master_merchant_report_*.json'
        master_report_files = glob.glob(pattern)
        
        if master_report_files:
            latest_report = max(master_report_files, key=os.path.getctime)
            try:
                with open(latest_report, 'r', encoding='utf-8') as f:
                    master_data = json.load(f)
                
                # 检查是否是目标年月的数据
                if 'mapping_stats' in master_data and 'mapped_data' in master_data:
                    print(f"[SUCCESS] 使用主商户统计报告: {latest_report}")
                    
                    # 转换为主商户维度的数据结构
                    billing_data = {}
                    mapped_data = master_data['mapped_data']
                    mapping_stats = master_data['mapping_stats']
                    
                    # 创建子商户到主商户的映射
                    sub_to_master_mapping = {}
                    for sub_merchant, details in mapping_stats['mapping_details'].items():
                        if details['status'] == 'mapped' and details['mapped_to']:
                            sub_to_master_mapping[sub_merchant] = details['mapped_to']
                    
                    # 按主商户分组数据
                    master_merchant_data = {}
                    for sub_merchant_id, data in mapped_data.items():
                        # 获取主商户ID和名称（不再按金额过滤）
                        master_merchant_id = sub_to_master_mapping.get(sub_merchant_id, sub_merchant_id)

                        # 初始化主商户容器
                        if master_merchant_id not in master_merchant_data:
                            lark_merchant_name = master_merchant_id
                            if master_merchant_id in mapping_stats['mapping_details']:
                                lark_info = mapping_stats['mapping_details'][master_merchant_id]
                                if lark_info['status'] == 'mapped' and lark_info['mapped_to']:
                                    lark_merchant_name = lark_info['mapped_to']

                            master_merchant_data[master_merchant_id] = {
                                'merchant_name': lark_merchant_name,
                                'fee_rate': float(data.get('fee_rate', 0.0) or 0.0),
                                'total_amount': 0.0,
                                'sub_merchants_count': 0,
                                'transactions_count': 0,
                                'sub_merchants': [],
                                'is_master_merchant': True
                            }

                        # 追加子商户并用与PDF/Lark一致的公式计算总额
                        fee_rate_pct = float(data.get('fee_rate', 0.0) or 0.0)
                        fee_rate = fee_rate_pct / 100.0
                        sub_list = data.get('sub_merchants', []) or []
                        master_merchant_data[master_merchant_id]['sub_merchants'].extend(sub_list)
                        # 注意：不在这里累加sub_merchants_count，避免重复计算
                        master_merchant_data[master_merchant_id]['transactions_count'] += data.get('transactions_count', 0)
                        # 计算 Charge = Σ(GGR × USD Rate × Fee Rate%)
                        for sub in sub_list:
                            for cur in sub.get('currencies', []) or []:
                                total_prize = float(cur.get('total_prize', 0) or 0)
                                total_bet = float(cur.get('total_bet', 0) or 0)
                                ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                                usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                                master_merchant_data[master_merchant_id]['total_amount'] += ggr * usd_rate * fee_rate
                    
                    if master_merchant_data:
                        # 修复：统一计算每个主商户的唯一子商户数量，避免重复计算
                        for master_id, master_info in master_merchant_data.items():
                            # 通过子商户名称去重来计算实际的子商户数量
                            unique_sub_merchants = set()
                            for sub in master_info.get('sub_merchants', []):
                                sub_name = (
                                    sub.get('merchant_name') or 
                                    sub.get('C_merchant_name') or 
                                    sub.get('name') or 
                                    sub.get('Account') or 
                                    sub.get('D_account') or 
                                    ''
                                ).strip()
                                if sub_name:
                                    unique_sub_merchants.add(sub_name)
                            master_info['sub_merchants_count'] = len(unique_sub_merchants)
                            print(f"[DEBUG] {master_info.get('merchant_name', master_id)}: 实际子商户数 = {len(unique_sub_merchants)}")
                        
                        print(f"[SUCCESS] 主商户数据加载完成: {len(master_merchant_data)}个主商户")
                        total_amount = sum(m['total_amount'] for m in master_merchant_data.values())
                        print(f"[SUCCESS] 主商户总金额: {total_amount:.2f} USDT")
                        return master_merchant_data
                        
            except Exception as e:
                print(f"[WARNING] 读取主商户统计报告失败: {e}")
        
        print("[INFO] 主商户统计报告不可用，回退到原始数据加载")
        return None
    
    def load_complete_monthly_data(self, target_period: str = None):
        """加载指定月份的完整数据"""
        # 如果没有指定期间，使用当前月份
        if target_period is None:
            from datetime import datetime
            now = datetime.now()
            target_period = f"{now.year}年{now.month:02d}月"
        
        print(f"[INFO] 目标期间: {target_period}")
        
        # 根据目标期间选择数据源，优先使用步骤1和步骤2生成的最新数据
        year_month = target_period.replace('年', '').replace('月', '')
        
        # 按优先级选择数据源（修复：优先使用对应月份的数据）
        data_files = [
            # 1. 优先：对应月份的最新数据文件（步骤2生成）
            f'matched_merchant_excel_data_{year_month}_*.json',
            # 2. 备选：对应月份的通用数据文件
            f'matched_merchant_excel_data_*{year_month}*.json',
            # 3. 兜底：原始账单数据
            f'billing_data_{year_month}.json',
            f'billing_data_{year_month[:4]}_{year_month[4:]}.json',
            # 4. 最后：其他可用数据
            'fixed_matched_data.json',
            'main_merchant_bills_summary.json'
        ]
        
        # 查找匹配的文件
        import glob
        actual_data_files = []
        
        for pattern in data_files:
            if '*' in pattern:
                # 使用通配符查找文件
                matches = glob.glob(pattern)
                if matches:
                    # 选择最新的文件
                    latest_file = max(matches, key=os.path.getctime)
                    actual_data_files.append(latest_file)
            else:
                # 直接检查文件是否存在
                if os.path.exists(pattern):
                    actual_data_files.append(pattern)
        
        print("[INFO] 数据源选择优先级:")
        for i, file in enumerate(actual_data_files, 1):
            print(f"   {i}. {file} - [SUCCESS] 存在")
        
        for file_path in actual_data_files:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # fixed_matched_data.json 格式 - 修复的匹配数据
                    if file_path == 'fixed_matched_data.json' and 'matched_data' in data:
                        billing_data = data.get('matched_data', {})
                        if billing_data:
                            print(f"[SUCCESS] 加载修复的匹配数据: {file_path}")
                            print(f"[SUCCESS] 找到 {len(billing_data)} 个有真实交易数据的主商户")
                            
                            # 显示数据统计
                            total_details = sum(len(merchant.get('details', [])) for merchant in billing_data.values())
                            print(f"[SUCCESS] 总交易明细条数: {total_details}")
                            return billing_data
                    
                    # billing_data_2025_XX.json 格式 - 原始账单数据
                    elif file_path.startswith('billing_data_2025_') and file_path.endswith('.json'):
                        billing_data = {}
                        for merchant_id, merchant_data in data.items():
                            merchant_name = merchant_data.get('merchant_name', f'merchant_{merchant_id}')
                            currencies = merchant_data.get('currencies', {})
                            
                            if currencies:  # 只处理有货币数据的商户
                                details = []
                                total_amount = 0
                                
                                for currency, currency_data in currencies.items():
                                    total_bet = currency_data.get('total_bet', 0)
                                    total_prize = currency_data.get('total_prize', 0)
                                    total_win_lose = currency_data.get('total_win_lose', 0)
                                    
                                    # 数据过滤规则：包含所有有实际交易的记录
                                    if total_bet > 0 or total_prize > 0:
                                        detail = {
                                            'account': merchant_name,
                                            'currency': currency,
                                            'total_prize': total_prize,
                                            'total_bet': total_bet,
                                            'total_win_lose': total_win_lose,
                                            'fee_rate': 0.0,  # 默认费率，需要从其他地方获取
                                            'exchange_rate': 1.0,  # 默认汇率
                                            'payable_usd': total_win_lose  # 使用净赢分作为应付金额
                                        }
                                        details.append(detail)
                                        total_amount += total_win_lose
                                
                                if details:  # 保留有交易数据的商户
                                    billing_data[merchant_name] = {
                                        'merchant': merchant_name,
                                        'period': target_period,
                                        'fee_rate': 0.0,  # 默认费率
                                        'total_amount': total_amount,
                                        'details': details
                                    }
                        
                        if billing_data:
                            print(f"[SUCCESS] 加载原始账单数据: {file_path}")
                            print(f"[SUCCESS] 找到 {len(billing_data)} 个有真实交易数据的主商户")
                            
                            # 显示数据统计
                            total_details = sum(len(merchant['details']) for merchant in billing_data.values())
                            print(f"[SUCCESS] 总交易明细条数: {total_details}")
                            return billing_data
                    
                    # matched_merchant_excel_data_20250901_101424.json 格式 - 包含完整真实交易数据
                    elif isinstance(data, dict):
                        # 兼容步骤2的输出结构：如果包含 merchant_data，则下钻
                        if 'merchant_data' in data and isinstance(data['merchant_data'], dict):
                            data = data['merchant_data']
                        billing_data = {}
                        for merchant_name, merchant_info in data.items():
                            sub_merchants = merchant_info.get('sub_merchants') or []
                            fee_rate = merchant_info.get('fee', 0.0)
                            
                            if sub_merchants:  # 只处理有子商户数据的主商户
                                details = []
                                total_amount = 0
                                
                                for sub_merchant in (sub_merchants or []):
                                    # 优先使用子商户名称，其次兼容旧字段
                                    account = (
                                        sub_merchant.get('merchant_name')
                                        or sub_merchant.get('C_merchant_name')
                                        or sub_merchant.get('D_account')
                                        or sub_merchant.get('Account')
                                        or ''
                                    )
                                    currencies = sub_merchant.get('currencies') or []
                                    provider = str(sub_merchant.get('provider', '')).strip().lower()
                                    
                                    for currency_data in currencies:
                                        currency = currency_data.get('currency', '')
                                        total_bet = currency_data.get('total_bet', 0)
                                        total_prize = currency_data.get('total_prize', 0)
                                        net_win = currency_data.get('net_win', 0)
                                        usd_rate = currency_data.get('usd_rate', 1.0)
                                        charge_usdt = currency_data.get('charge_usdt', 0)
                                        
                                        # 数据过滤规则：包含所有有实际交易的记录（修正：基于交易数据而非费用）
                                        # 生成规则：
                                        # 1) 只要有交易明细(总投或派奖任一>0)，即使最终应付为0也生成；
                                        # 2) 当来源为邮箱表时，若厂商=gp或popular 且 子商户名(account) != demo，也应生成。
                                        should_include = (total_bet > 0 or total_prize > 0)
                                        if not should_include:
                                            if provider in ['gp', 'popular'] and str(account).strip().lower() != 'demo':
                                                should_include = True
                                        if should_include:
                                                                                    detail = {
                                            'account': account,
                                            'currency': currency,
                                            'total_prize': total_prize,
                                            'total_bet': total_bet,
                                            'total_win_lose': net_win,
                                            'fee_rate': fee_rate,
                                            'exchange_rate': charge_usdt * fee_rate,  # 应付金额（USDT）
                                            'payable_usd': charge_usdt
                                        }
                                        details.append(detail)
                                        total_amount += charge_usdt
                                
                                if details:  # 保留有交易数据的商户
                                    billing_data[merchant_name] = {
                                        'merchant': merchant_name,
                                        'period': target_period,  # 使用动态月份
                                        'fee_rate': fee_rate,
                                        'total_amount': total_amount,
                                        'details': details
                                    }
                        
                        if billing_data:
                            print(f"[SUCCESS] 加载完整真实交易数据: {file_path}")
                            print(f"[SUCCESS] 找到 {len(billing_data)} 个有真实交易数据的主商户")
                            
                            # 显示数据统计
                            total_details = sum(len(merchant['details']) for merchant in billing_data.values())
                            print(f"[SUCCESS] 总交易明细条数: {total_details}")
                            return billing_data
                        
                except Exception as e:
                    print(f"[WARNING]  加载文件失败 {file_path}: {e}")
                    continue
        
        print(f"[ERROR] 未找到包含完整交易数据的{target_period}文件")
        print(f"[WARNING]  注意：当前只能生成主商户汇总账单，缺少详细交易明细数据")
        return None
    
    def create_invoice_pdf(self, merchant_data: Dict[str, Any], filepath: str) -> Optional[str]:
        """生成完整版发票风格PDF"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # 创建文档
            doc = SimpleDocTemplate(
                filepath,
                pagesize=A4,
                rightMargin=40,
                leftMargin=40,
                topMargin=50,
                bottomMargin=40
            )
            
            story = []
            
            # 头部区域
            _sec = self.create_header(merchant_data)
            if _sec: story.extend(_sec)
            
            # 主商户信息区域
            _sec = self.create_merchant_info(merchant_data)
            if _sec: story.extend(_sec)
            
            # 发票信息区域
            _sec = self.create_invoice_info(merchant_data)
            if _sec: story.extend(_sec)
            
            # 主要数据表格 - 完整版
            _sec = self.create_complete_data_table(merchant_data)
            if _sec: story.extend(_sec)
            
            # 汇总区域
            _sec = self.create_summary(merchant_data)
            if _sec: story.extend(_sec)
            
            # 页脚区域
            _sec = self.create_footer(merchant_data)
            if _sec: story.extend(_sec)
            
            # 生成PDF
            doc.build(story)
            
            print(f"[SUCCESS] 生成完整版PDF: {os.path.basename(filepath)}")
            return filepath
            
        except Exception as e:
            print(f"[ERROR] 生成PDF失败 {merchant_data.get('merchant', 'Unknown')}: {str(e)}")
            return None
    
    def create_header(self, merchant_data: Dict[str, Any]):
        """创建头部"""
        elements = []
        
        # 添加顶部空白
        elements.append(Spacer(1, 30))
        
        # 标题区域
        title_data = [
            ['', '月度賬單\n\n\nMonthly Bill', 'www.gaming-panda.com']
        ]
    def create_styles(self):
        """创建完整版样式"""
        styles = getSampleStyleSheet()
        
        # 标题样式
        styles.add(ParagraphStyle(
            name='CompleteTitle',
            parent=styles['Title'],
            fontName=self.chinese_font,
            fontSize=24,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=40,
            spaceBefore=20
        ))
        
        # 主商户样式
        styles.add(ParagraphStyle(
            name='MainMerchant',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=16,
            textColor=colors.black,
            fontWeight='bold',
            spaceAfter=12,
            spaceBefore=8,
            leading=24  # 增加行间距支持换行
        ))
        
        # 信息样式
        styles.add(ParagraphStyle(
            name='InfoText',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=11,
            textColor=colors.black,
            spaceAfter=8,
            leading=18  # 增加行间距支持换行
        ))
        
        # 页脚样式
        styles.add(ParagraphStyle(
            name='CompleteFooter',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=10,
            textColor=colors.black,
            alignment=TA_CENTER,
            leading=16  # 增加行间距支持换行
        ))
        
        return styles

def create_details_table(self, merchant_data: Dict[str, Any]) -> List:
        """创建详细数据表格"""
        elements = []
        
        # 检查是否是主商户数据结构
        if merchant_data.get('is_master_merchant'):
            # 主商户数据结构处理
            sub_merchants = merchant_data.get('sub_merchants') or []
            details = []
            for sub in (sub_merchants or []):
                for currency in (sub.get('currencies') or []):
                    details.append({
                        'account': sub.get('name', ''),
                        'currency': currency.get('currency', ''),
                        'total_prize': currency.get('total_prize', 0),
                        'total_bet': currency.get('total_bet', 0),
                        'total_win_lose': currency.get('net_win', 0),
                        'fee_rate': merchant_data.get('fee_rate', 0),
                        'exchange_rate': currency.get('usd_rate', 1.0),
                        'payable_usd': currency.get('net_win', 0) * currency.get('usd_rate', 1.0) * (merchant_data.get('fee_rate', 0) / 100.0)
                    })
        else:
            details = merchant_data.get('details', [])
            
            if not details:
                return elements
            
            # 表头 - 中英雙語（统一以USDT展示应付金额）
            table_data = [
                ['子商戶\nAccount', '幣別\nCurrency', '總贏分\nTotal Prize', '總下注\nTotal Bet', 
                 '實際輸贏\nGGR', '收費率\nRate', '應付金額（USDT）\nCharge', '應付總金額（USDT）\nTotal Charge']
            ]
            
            # 数据行
            for detail in details:
                account = detail.get('account', '')
                # 清理account名称
                if account.startswith('Production'):
                    account = account.replace('Production', '', 1)
                
                currency = detail.get('currency', '')
                total_prize = detail.get('total_prize', 0)
                total_bet = detail.get('total_bet', 0)
                total_win_lose = detail.get('total_win_lose', 0)
                fee_rate = detail.get('fee_rate', 0)
                exchange_rate = detail.get('exchange_rate', 1.0)
                payable_usd = detail.get('payable_usd', 0)
                
                table_data.append([
                    account,
                    currency,
                    f"{total_prize:,.2f}",
                    f"{total_bet:,.2f}",
                    f"{total_win_lose:,.2f}",
                    f"{fee_rate}%",
                    f"{payable_usd:,.2f} USDT",
                    f"{exchange_rate:,.2f} USDT"
                ])
            
            # 创建表格 - 使用自适应行高解决内容超出问题
            col_width = 7*inch / 7
            # 使用自适应高度（None 表示根据内容自动调整）
            row_heights = [None] * len(table_data)
            main_table = Table(table_data, colWidths=[col_width] * 7, rowHeights=row_heights)
            main_table.setStyle(TableStyle([
                # 表头样式
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), self.chinese_font),
                ('FONTSIZE', (0, 0), (-1, 0), 8),  # 表头字体减小2号：从10号到8号
                ('FONTWEIGHT', (0, 0), (-1, 0), 'bold'),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                
                # 数据行样式
                ('FONTNAME', (0, 1), (-1, -1), self.chinese_font),
                ('FONTSIZE', (0, 1), (-1, -1), 7),  # 表内容字体减小2号：从9号到7号
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),    # Account左对齐
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # 其他右对齐
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                
                # 边框
                ('BOX', (0, 0), (-1, -1), 1, colors.black),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
                
                # 内边距 - 增加内边距确保内容不超出
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 15),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ]))
            
            elements.append(main_table)
            elements.append(Spacer(1, 30))
        
        return elements

def create_summary(self, merchant_data: Dict[str, Any]):
        """创建汇总区域"""
        elements = []
        
        # 计算汇总数据 - 支持主商户数据结构
        details = merchant_data.get('details', [])
        merchant_name = self._normalize_name(merchant_data.get('merchant_name', merchant_data.get('merchant', 'Unknown')))
        
        # 如果是主商户数据结构，直接使用total_amount
        if merchant_data.get('is_master_merchant'):
            # 修正：应付总金额为所有子商户行的 Charge 之和
            # Charge = GGR × USD Rate × Fee Rate%
            # GGR (USDT) = Σ(GGR × USD Rate)
            fee_rate_pct = float(merchant_data.get('fee_rate', 0) or 0)
            fee_rate = fee_rate_pct / 100.0
            total_payable_usd = 0.0
            total_ggr_usd = 0.0
            for sub in (merchant_data.get('sub_merchants') or []):
                for cur in (sub.get('currencies') or []):
                    total_prize = float(cur.get('total_prize', 0) or 0)
                    total_bet = float(cur.get('total_bet', 0) or 0)
                    ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                    usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                    # 计算GGR(USDT)
                    total_ggr_usd += ggr * usd_rate
                    # 计算Charge
                    calculated_charge = ggr * usd_rate * fee_rate
                    # 若存在历史字段，仍以公式为准（避免来源差异导致不一致）
                    total_payable_usd += calculated_charge
        else:
            # 原始数据结构处理
            using_final_amount = self.final_amounts is not None and merchant_name in self.final_amounts
            if using_final_amount:
                total_payable_usd = float(self.final_amounts[merchant_name])
            else:
                total_payable_usd = 0.0
            total_ggr_usd = 0.0

            for detail in details:
                payable_usd = float(detail.get('payable_usd', 0) or 0)
                exchange_rate = float(detail.get('exchange_rate', 0) or 0)

                # 按照用户确认的逻辑：
                # 應付縂金額=所有子商戶的exchange_rate之和
                # GGR（USDT）=所有子商戶的payable_usd之和
                if not using_final_amount:
                    total_payable_usd += exchange_rate  # 累加应付总金额
                total_ggr_usd += payable_usd  # 累加GGR（USDT）
        
        # 汇总区：应付金额统一以USDT展示；GGR保持原计算（若为USD则标注USD）
        # 按照用户确认的逻辑：
        # 應付縂金額=所有子商戶的exchange_rate之和
        # GGR（USDT）=所有子商戶的payable_usd之和
        summary_data = [
            ['', '', '應付縂金額\nTotal Payable', f"{total_payable_usd:.2f} USDT"],
            ['', '', 'GGR（USDT）\nGGR (USDT)', f"{total_ggr_usd:.2f} USDT"]
        ]
        
        summary_table = Table(summary_data, colWidths=[1.2*inch, 1.5*inch, 1.3*inch, 1.3*inch], rowHeights=[None, None])  # 自适应行高
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (2, 0), (-1, -1), self.chinese_font),
            ('FONTSIZE', (2, 0), (-1, -1), 11),
            ('ALIGN', (2, 0), (2, -1), 'LEFT'),    # 标签列左对齐
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),   # 数值列右对齐
            ('VALIGN', (2, 0), (-1, -1), 'MIDDLE'),
            
            # 边框
            ('BOX', (2, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (2, 0), (-1, -1), 0.5, colors.black),
            
            # 内边距 - 适当调整内边距
            ('LEFTPADDING', (2, 0), (-1, -1), 8),
            ('RIGHTPADDING', (2, 0), (-1, -1), 8),
            ('TOPPADDING', (2, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (2, 0), (-1, -1), 8),
        ]))
        
        elements.append(summary_table)
        elements.append(Spacer(1, 70))

def create_styles(self):
        """创建完整版样式"""
        styles = getSampleStyleSheet()
        
        # 标题样式
        styles.add(ParagraphStyle(
            name='CompleteTitle',
            parent=styles['Title'],
            fontName=self.chinese_font,
            fontSize=24,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=40,
            spaceBefore=20
        ))
        
        # 主商户样式
        styles.add(ParagraphStyle(
            name='MainMerchant',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=16,
            textColor=colors.black,
            fontWeight='bold',
            spaceAfter=12,
            spaceBefore=8,
            leading=24  # 增加行间距支持换行
        ))
        
        # 信息样式
        styles.add(ParagraphStyle(
            name='InfoText',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=11,
            textColor=colors.black,
            spaceAfter=8,
            leading=18  # 增加行间距支持换行
        ))
        
        # 页脚样式
        styles.add(ParagraphStyle(
            name='CompleteFooter',
            parent=styles['Normal'],
            fontName=self.chinese_font,
            fontSize=10,
            textColor=colors.black,
            alignment=TA_CENTER,
            leading=16  # 增加行间距支持换行
        ))
        
        return styles

def create_details_table(self, merchant_data: Dict[str, Any]):
        """创建详细数据表格"""
        elements = []
        
        # 检查是否是主商户数据结构
        if merchant_data.get('is_master_merchant'):
            # 主商户数据结构处理
            sub_merchants = merchant_data.get('sub_merchants') or []
            details = []
            for sub in (sub_merchants or []):
                for currency in (sub.get('currencies') or []):
                    details.append({
                        'account': sub.get('name', ''),
                        'currency': currency.get('currency', ''),
                        'total_prize': currency.get('total_prize', 0),
                        'total_bet': currency.get('total_bet', 0),
                        'total_win_lose': currency.get('net_win', 0),
                        'fee_rate': merchant_data.get('fee_rate', 0),
                        'exchange_rate': currency.get('usd_rate', 1.0),
                        'payable_usd': currency.get('net_win', 0) * currency.get('usd_rate', 1.0) * (merchant_data.get('fee_rate', 0) / 100.0)
                    })
        else:
            details = merchant_data.get('details', [])
            
            if not details:
                return elements
            
            # 表头 - 中英雙語（统一以USDT展示应付金额）
            table_data = [
                ['子商戶\nAccount', '幣別\nCurrency', '總贏分\nTotal Prize', '總下注\nTotal Bet', 
                 '實際輸贏\nGGR', '收費率\nRate', '應付金額（USDT）\nCharge', '應付總金額（USDT）\nTotal Charge']
            ]
            
            # 数据行
            for detail in details:
                account = detail.get('account', '')
                # 清理account名称
                if account.startswith('Production'):
                    account = account.replace('Production', '', 1)
                
                currency = detail.get('currency', '')
                total_prize = detail.get('total_prize', 0)
                total_bet = detail.get('total_bet', 0)
                total_win_lose = detail.get('total_win_lose', 0)
                fee_rate = detail.get('fee_rate', 0)
                exchange_rate = detail.get('exchange_rate', 1.0)
                payable_usd = detail.get('payable_usd', 0)
                
                table_data.append([
                    account,
                    currency,
                    f"{total_prize:,.2f}",
                    f"{total_bet:,.2f}",
                    f"{total_win_lose:,.2f}",
                    f"{fee_rate}%",
                    f"{payable_usd:,.2f} USDT",
                    f"{exchange_rate:,.2f} USDT"
                ])
            
            # 创建表格 - 使用固定行高解决内容超出问题
            col_width = 7*inch / 7
            # 设置固定行高，表头稍高，数据行适中
            row_heights = [35] + [30] * (len(table_data) - 1)  # 表头35pt，数据行30pt
            main_table = Table(table_data, colWidths=[col_width] * 7, rowHeights=row_heights)
            main_table.setStyle(TableStyle([
                # 表头样式
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), self.chinese_font),
                ('FONTSIZE', (0, 0), (-1, 0), 8),  # 表头字体减小2号：从10号到8号
                ('FONTWEIGHT', (0, 0), (-1, 0), 'bold'),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                
                # 数据行样式
                ('FONTNAME', (0, 1), (-1, -1), self.chinese_font),
                ('FONTSIZE', (0, 1), (-1, -1), 7),  # 表内容字体减小2号：从9号到7号
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),    # Account左对齐
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # 其他右对齐
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                
                # 边框
                ('BOX', (0, 0), (-1, -1), 1, colors.black),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
                
                # 内边距 - 增加内边距确保内容不超出
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            
            elements.append(main_table)
            elements.append(Spacer(1, 30))
        
        return elements

def create_summary(self, merchant_data: Dict[str, Any]):
        """创建汇总区域"""
        elements = []
        
        # 计算汇总数据 - 支持主商户数据结构
        details = merchant_data.get('details', [])
        merchant_name = self._normalize_name(merchant_data.get('merchant_name', merchant_data.get('merchant', 'Unknown')))
        
        # 如果是主商户数据结构，直接使用total_amount
        if merchant_data.get('is_master_merchant'):
            # 修正：应付总金额为所有子商户行的 Charge 之和
            # Charge = GGR × USD Rate × Fee Rate%
            # GGR (USDT) = Σ(GGR × USD Rate)
            fee_rate_pct = float(merchant_data.get('fee_rate', 0) or 0)
            fee_rate = fee_rate_pct / 100.0
            total_payable_usd = 0.0
            total_ggr_usd = 0.0
            for sub in (merchant_data.get('sub_merchants') or []):
                for cur in (sub.get('currencies') or []):
                    total_prize = float(cur.get('total_prize', 0) or 0)
                    total_bet = float(cur.get('total_bet', 0) or 0)
                    ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                    usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                    # 计算GGR(USDT)
                    total_ggr_usd += ggr * usd_rate
                    # 计算Charge
                    calculated_charge = ggr * usd_rate * fee_rate
                    # 若存在历史字段，仍以公式为准（避免来源差异导致不一致）
                    total_payable_usd += calculated_charge
        else:
            # 原始数据结构处理
            using_final_amount = self.final_amounts is not None and merchant_name in self.final_amounts
            if using_final_amount:
                total_payable_usd = float(self.final_amounts[merchant_name])
            else:
                total_payable_usd = 0.0
            total_ggr_usd = 0.0

            for detail in details:
                payable_usd = float(detail.get('payable_usd', 0) or 0)
                exchange_rate = float(detail.get('exchange_rate', 0) or 0)

                # 按照用户确认的逻辑：
                # 應付縂金額=所有子商戶的exchange_rate之和
                # GGR（USDT）=所有子商戶的payable_usd之和
                if not using_final_amount:
                    total_payable_usd += exchange_rate  # 累加应付总金额
                total_ggr_usd += payable_usd  # 累加GGR（USDT）
        
        # 汇总区：应付金额统一以USDT展示；GGR保持原计算（若为USD则标注USD）
        # 按照用户确认的逻辑：
        # 應付縂金額=所有子商戶的exchange_rate之和
        # GGR（USDT）=所有子商戶的payable_usd之和
        summary_data = [
            ['', '', '應付縂金額\nTotal Payable', f"{total_payable_usd:.2f} USDT"],
            ['', '', 'GGR（USDT）\nGGR (USDT)', f"{total_ggr_usd:.2f} USDT"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 1.5*inch, 1.3*inch, 1.3*inch], rowHeights=[35, 35])  # 固定行高
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (2, 0), (-1, -1), self.chinese_font),
            ('FONTSIZE', (2, 0), (-1, -1), 11),
            ('ALIGN', (2, 0), (2, -1), 'LEFT'),    # 标签列左对齐
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),   # 数值列右对齐
            ('VALIGN', (2, 0), (-1, -1), 'MIDDLE'),
            
            # 边框
            ('BOX', (2, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (2, 0), (-1, -1), 0.5, colors.black),
            
            # 内边距 - 适当调整内边距
            ('LEFTPADDING', (2, 0), (-1, -1), 8),
            ('RIGHTPADDING', (2, 0), (-1, -1), 8),
            ('TOPPADDING', (2, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (2, 0), (-1, -1), 8),
        ]))
        
        elements.append(summary_table)
        elements.append(Spacer(1, 70))

def create_header(self, merchant_data: Dict[str, Any]):
        """创建头部"""
        elements = []
        
        # 添加顶部空白
        elements.append(Spacer(1, 30))
        
        # 标题区域
        title_data = [
            ['', '月度賬單\n\n\nMonthly Bill', 'www.gaming-panda.com']
        ]
    
        title_table = Table(title_data, colWidths=[2*inch, 3*inch, 2*inch], rowHeights=[100])
        title_table.setStyle(TableStyle([
            # 标题样式
            ('FONTNAME', (1, 0), (1, 0), self.chinese_font),
            ('FONTSIZE', (1, 0), (1, 0), 28),
            ('FONTWEIGHT', (1, 0), (1, 0), 'bold'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('VALIGN', (1, 0), (1, 0), 'MIDDLE'),
            
            # 网址样式
            ('FONTNAME', (2, 0), (2, 0), self.chinese_font),
            ('FONTSIZE', (2, 0), (2, 0), 9),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
            ('VALIGN', (2, 0), (2, 0), 'TOP'),
            
            # 内边距
            ('TOPPADDING', (0, 0), (-1, -1), 30),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 30),
        ]))
        
        elements.append(title_table)
        elements.append(Spacer(1, 80))
        
        return elements
    
def create_merchant_info(self, merchant_data: Dict[str, Any]):
        """创建主商户信息区域"""
        elements = []
        
        # 主商户名称 - 修复字段名，确保不为None，支持换行符
        merchant_name = merchant_data.get('merchant_name', merchant_data.get('merchant', 'Unknown'))
        if merchant_name is None:
            merchant_name = 'Unknown'
        merchant_text = f"主商戶：{merchant_name} /n 收費率：{merchant_data.get('fee_rate', 0)}% /n 子商戶數：{merchant_data.get('sub_merchants_count') or len(merchant_data.get('sub_merchants') or [])} /nMain Merchant: {merchant_name} /nFee Rate: {merchant_data.get('fee_rate', 0)}% /nSub-Merchant Count: {merchant_data.get('sub_merchants_count') or len(merchant_data.get('sub_merchants') or [])}"
        # 将/n替换为<br/>以支持换行，处理所有可能的/n格式
        merchant_text = merchant_text.replace(' /n ', '<br/>').replace(' /n', '<br/>').replace('/n ', '<br/>').replace('/n', '<br/>')
        elements.append(Paragraph(merchant_text, self.styles['MainMerchant']))
        elements.append(Spacer(1, 35))
        
        return elements
    
def create_invoice_info(self, merchant_data: Dict[str, Any]):
        """创建发票信息区域"""
        elements = []
        
        # 使用目标期间或数据中的期间，而不是硬编码
        target_yyyy = os.environ.get('TARGET_YYYY', '2025')
        target_mm = os.environ.get('TARGET_MM', '08')
        target_period = f"{target_yyyy}年{target_mm}月"
        period = merchant_data.get('period', target_period)
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        info_data = [
            [f'賬單月份：{period}\nBilling Period: {period}'],
            [f'生成日期：{current_date}\nGeneration Date: {current_date}']
        ]
        
        info_table = Table(info_data, colWidths=[7*inch], rowHeights=[None, None])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.chinese_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        
        elements.append(info_table)
        elements.append(Spacer(1, 30))
        
        return elements
    
def create_complete_data_table(self, merchant_data: Dict[str, Any]):
        """创建完整的数据表格"""
        elements = []
        
        # 检查是否是主商户数据结构
        if merchant_data.get('is_master_merchant'):
            # 主商户数据结构 - 显示子商户汇总信息（优先显示子商户明细表）
            sub_merchants = merchant_data.get('sub_merchants') or []
            # 添加None检查
            if sub_merchants is None:
                sub_merchants = []
            if sub_merchants:
                # 生成8列子商户明细表
                table_data: List[List[str]] = [
                    ['子商戶\nMerchant', '幣種\nCurrency', '總贏分\nTotal Prize', '總下注\nTotal Bet',
                     '實際輸贏\nGGR', '收費率\nFee Rate', '匯率\nUSDT Rate', '應付金額\nCharge']
                ]

                # 汇总所有子商户的每种货币行
                detail_rows: List[List[Any]] = []
                for sub in sub_merchants:
                    # 修复：优先使用merchant_name字段（来自lark表的C_merchant_name）
                    sub_name = str(sub.get('merchant_name') or sub.get('C_merchant_name') or sub.get('name') or sub.get('Account') or sub.get('D_account') or '').strip()
                    if not sub_name:
                        continue
                    currencies = sub.get('currencies') or []
                    for cur in currencies:
                        currency = cur.get('currency', '')
                        total_prize = float(cur.get('total_prize', 0) or 0)
                        total_bet = float(cur.get('total_bet', 0) or 0)
                        ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                        usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                        fee_rate = float(merchant_data.get('fee_rate', 0) or 0)
                        # 按公式计算：Charge = GGR × USD Rate × Fee Rate
                        charge_usdt = ggr * usd_rate * (fee_rate / 100.0)  # 费率需要除以100转换为小数

                        detail_rows.append([
                            sub_name,
                            currency,
                            total_prize,
                            total_bet,
                            ggr,
                            fee_rate,
                            usd_rate,
                            charge_usdt,
                        ])

                # 按应付金额降序
                detail_rows.sort(key=lambda r: r[7], reverse=True)

                # 填充格式化后的数据
                for r in detail_rows:
                    table_data.append([
                        r[0],
                        r[1],
                        f"{r[2]:,.2f}",
                        f"{r[3]:,.2f}",
                        f"{r[4]:,.2f}",
                        f"{r[5]}%",
                        f"{r[6]:,.6f}",
                        f"{r[7]:,.2f} USDT",
                    ])

                # 创建表格
                col_width = 7*inch / 8
                main_table = Table(table_data, colWidths=[col_width] * 8, rowHeights=[None] * len(table_data))
                main_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), self.chinese_font),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),  # 表头字体减小2号：从10号到8号
                    ('FONTWEIGHT', (0, 0), (-1, 0), 'bold'),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),

                    ('FONTNAME', (0, 1), (-1, -1), self.chinese_font),
                    ('FONTSIZE', (0, 1), (-1, -1), 6),  # 表内容字体再减小2号：从8号到6号
                    ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                    ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                    ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),

                    ('BOX', (0, 0), (-1, -1), 1, colors.black),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),

                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ]))

                elements.append(main_table)
                elements.append(Spacer(1, 30))
                return elements
            else:
                # 如果没有子商户明细，显示主商户汇总信息
                table_data = [
                    ['主商戶\nMain Merchant', '總金額\nTotal Amount', '子商戶數\nSub-Merchants', '交易數\nTransactions', '費率\nFee Rate'],
                    [
                        merchant_data.get('merchant_name', 'Unknown') or 'Unknown',
                        f"{merchant_data.get('total_amount', 0) or 0:,.2f} USDT",
                        str(merchant_data.get('sub_merchants_count', 0) or 0),
                        str(merchant_data.get('transactions_count', 0) or 0),
                        f"{merchant_data.get('fee_rate', 0) or 0}%"
                    ]
                ]

                col_width = 7*inch / 5
                main_table = Table(table_data, colWidths=[col_width] * 5, rowHeights=[None, None])
                main_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), self.chinese_font),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),  # 表头字体减小2号：从10号到8号
                    ('FONTWEIGHT', (0, 0), (-1, 0), 'bold'),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                    ('FONTNAME', (0, 1), (-1, -1), self.chinese_font),
                    ('FONTSIZE', (0, 1), (-1, -1), 7),  # 表内容字体减小2号：从9号到7号
                    ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                    ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                    ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                    ('BOX', (0, 0), (-1, -1), 1, colors.black),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
                    ('LEFTPADDING', (0, 0), (-1, -1), 12),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                    ('TOPPADDING', (0, 0), (-1, -1), 15),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
                ]))

                elements.append(main_table)
                elements.append(Spacer(1, 30))
                return elements
        else:
            # 原始数据结构 - 显示详细交易明细
            details = merchant_data.get('details', [])
            if not details:
                return elements
            
            # 表头 - 中英雙語（统一以USDT展示应付金额）
            table_data = [
                ['子商戶\nAccount', '幣別\nCurrency', '總贏分\nTotal Prize', '總下注\nTotal Bet', 
                 '實際輸贏\nGGR', '收費率\nRate', '應付金額\nCharge', '應付總金額（USDT）\nTotal Charge']
            ]
            
            # 数据行
            for detail in details:
                account = detail.get('account', '')
                # 清理account名称
                if account.startswith('Production'):
                    account = account.replace('Production', '', 1)
                
                currency = detail.get('currency', '')
                total_prize = detail.get('total_prize', 0)
                total_bet = detail.get('total_bet', 0)
                total_win_lose = detail.get('total_win_lose', 0)
                fee_rate = detail.get('fee_rate', 0)
                exchange_rate = detail.get('exchange_rate', 1.0)
                payable_usd = detail.get('payable_usd', 0)
                
                table_data.append([
                    account,
                    currency,
                    f"{total_prize:,.2f}",
                    f"{total_bet:,.2f}",
                    f"{total_win_lose:,.2f}",
                    f"{fee_rate}%",
                    f"{payable_usd:,.2f} USDT",
                    f"{exchange_rate:,.2f} USDT"
                ])
            
            # 创建表格 - 使用自适应行高
            col_width = 7*inch / 7
            # 计算行数，为每行设置自适应高度
            row_heights = [None] * len(table_data)  # None表示自适应高度
            main_table = Table(table_data, colWidths=[col_width] * 7, rowHeights=row_heights)
            main_table.setStyle(TableStyle([
                # 表头样式
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), self.chinese_font),
                ('FONTSIZE', (0, 0), (-1, 0), 8),  # 表头字体减小2号：从10号到8号
                ('FONTWEIGHT', (0, 0), (-1, 0), 'bold'),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                
                # 数据行样式
                ('FONTNAME', (0, 1), (-1, -1), self.chinese_font),
                ('FONTSIZE', (0, 1), (-1, -1), 7),  # 表内容字体减小2号：从9号到7号
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),    # Account左对齐
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # 其他右对齐
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                
                # 边框
                ('BOX', (0, 0), (-1, -1), 1, colors.black),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
                
                # 内边距 - 增加内边距确保内容不超出
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 15),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ]))
            
            elements.append(main_table)
            elements.append(Spacer(1, 30))
        
        return elements
    
def create_summary(self, merchant_data: Dict[str, Any]):
        """创建汇总区域"""
        elements = []
        
        # 计算汇总数据 - 支持主商户数据结构
        details = merchant_data.get('details', [])
        merchant_name = self._normalize_name(merchant_data.get('merchant_name', merchant_data.get('merchant', 'Unknown')))
        
        # 如果是主商户数据结构，直接使用total_amount
        if merchant_data.get('is_master_merchant'):
            # 修正：应付总金额为所有子商户行的 Charge 之和
            # Charge = GGR × USD Rate × Fee Rate%
            # GGR (USDT) = Σ(GGR × USD Rate)
            fee_rate_pct = float(merchant_data.get('fee_rate', 0) or 0)
            fee_rate = fee_rate_pct / 100.0
            total_payable_usd = 0.0
            total_ggr_usd = 0.0
            for sub in (merchant_data.get('sub_merchants') or []):
                for cur in (sub.get('currencies') or []):
                    total_prize = float(cur.get('total_prize', 0) or 0)
                    total_bet = float(cur.get('total_bet', 0) or 0)
                    ggr = float(cur.get('net_win', total_bet - total_prize) or 0)
                    usd_rate = float(cur.get('usd_rate', 1.0) or 1.0)
                    # 计算GGR(USDT)
                    total_ggr_usd += ggr * usd_rate
                    # 计算Charge
                    calculated_charge = ggr * usd_rate * fee_rate
                    # 若存在历史字段，仍以公式为准（避免来源差异导致不一致）
                    total_payable_usd += calculated_charge
        else:
            # 原始数据结构处理
            using_final_amount = self.final_amounts is not None and merchant_name in self.final_amounts
            if using_final_amount:
                total_payable_usd = float(self.final_amounts[merchant_name])
            else:
                total_payable_usd = 0.0
            total_ggr_usd = 0.0

            for detail in details:
                payable_usd = float(detail.get('payable_usd', 0) or 0)
                exchange_rate = float(detail.get('exchange_rate', 0) or 0)

                # 按照用户确认的逻辑：
                # 應付縂金額=所有子商戶的exchange_rate之和
                # GGR（USDT）=所有子商戶的payable_usd之和
                if not using_final_amount:
                    total_payable_usd += exchange_rate  # 累加应付总金额
                total_ggr_usd += payable_usd  # 累加GGR（USDT）
        
        # 汇总区：应付金额统一以USDT展示；GGR保持原计算（若为USD则标注USD）
        # 按照用户确认的逻辑：
        # 應付縂金額=所有子商戶的exchange_rate之和
        # GGR（USDT）=所有子商戶的payable_usd之和
        summary_data = [
            ['', '', '應付縂金額\nTotal Payable', f"{total_payable_usd:.2f} USDT"],
            ['', '', 'GGR', f"{total_ggr_usd:.2f} USDT"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 1.5*inch, 1.3*inch, 1.3*inch], rowHeights=[None, None])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (2, 0), (-1, -1), self.chinese_font),
            ('FONTSIZE', (2, 0), (-1, -1), 10),
            ('ALIGN', (2, 0), (2, -1), 'LEFT'),    # 标签列左对齐
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),   # 数值列右对齐
            ('VALIGN', (2, 0), (-1, -1), 'MIDDLE'),
            
            # 边框
            ('BOX', (2, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (2, 0), (-1, -1), 0.5, colors.black),
            
            # 内边距 - 增加内边距确保内容不超出
            ('LEFTPADDING', (2, 0), (-1, -1), 12),
            ('RIGHTPADDING', (2, 0), (-1, -1), 12),
            ('TOPPADDING', (2, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (2, 0), (-1, -1), 15),
        ]))
        
        elements.append(summary_table)
        elements.append(Spacer(1, 70))
        
        return elements
    
def create_footer(self, merchant_data: Dict[str, Any]):
        """创建页脚区域"""
        elements = []
        
        # 中英雙語上下結構，支持换行符
        footer_text = "若對賬單存疑，可聯係客服/n If you have any questions about the bill, please contact customer service."
        # 将/n替换为<br/>以支持换行
        footer_text = footer_text.replace('/n ', '<br/>')
        elements.append(Paragraph(footer_text, self.styles['CompleteFooter']))
        elements.append(Spacer(1, 20))
        
        # Gaming Panda信息
        elements.append(Paragraph("Gaming Panda | 匯款鏈接: TMuwXuWKd4az3KuYHZgssLj3WqvVSHyKfr", self.styles['CompleteFooter']))
        
        return elements

def main(target_period: str = None):
    """主函数"""
    print("[EMOJI] 开始生成完整版发票风格PDF（包含完整数据表格）...")
    
    # 创建生成器
    generator = CompleteInvoicePDFGenerator()
    
    # 优先尝试加载主商户统计报告数据
    billing_data = generator.load_master_merchant_data(target_period)
    if not billing_data:
        print("[INFO] 主商户数据不可用，回退到原始数据加载逻辑")
        billing_data = generator.load_complete_monthly_data(target_period)
    
    if not billing_data:
        print(f"[ERROR] 无法加载完整{target_period}数据")
        return
    
    print(f"[SUCCESS] 数据加载完成: {len(billing_data)} 个商户")
    
    success_count = 0
    fail_count = 0
    total_amount = 0
    
    print(f"\n[INFO] 开始生成完整版发票风格PDF...")
    
    for merchant_id, merchant_data in billing_data.items():
        try:
            # 检查是否是主商户数据结构
            if merchant_data.get('is_master_merchant'):
                # 主商户数据结构
                amount = merchant_data.get('total_amount', 0)
                merchant_name = merchant_data.get('merchant_name', merchant_id)
                fee_rate = merchant_data.get('fee_rate', 0)
                sub_merchants_count = merchant_data.get('sub_merchants_count', 0)
                print(f"\n[EMOJI] 生成主商户 {merchant_name} 完整版发票 (金额: ${amount:.2f}, 费率: {fee_rate}%, 子商户: {sub_merchants_count}个)...")
                
                # 生成文件名
                period = target_period or "2025年08月"
                period_ym = generator._convert_period_to_yyyymm(period)
                filename = f"{merchant_name}_{period_ym}_Bill.pdf"
                filepath = os.path.join(generator.output_dir, filename)
                
                # 生成PDF
                result = generator.create_invoice_pdf(merchant_data, filepath)
                
                if result and os.path.exists(result):
                    file_size = os.path.getsize(result)
                    print(f"   [SUCCESS] 成功生成: {filename} ({file_size} bytes)")
                    success_count += 1
                    total_amount += amount
                else:
                    print(f"   [ERROR] 生成失败")
                    fail_count += 1
            else:
                # 原始数据结构（兼容性）
                amount = merchant_data.get('total_amount', 0)
                detail_count = len(merchant_data.get('details', []))
                print(f"\n[EMOJI] 生成 {merchant_id} 完整版发票 (金额: ${amount:.2f}, 明细: {detail_count}条)...")
                
                # 生成文件名
                period = target_period or "2025年08月"
                period_ym = generator._convert_period_to_yyyymm(period)
                filename = f"{merchant_id}_{period_ym}_Bill.pdf"
                filepath = os.path.join(generator.output_dir, filename)
                
                # 生成PDF
                result = generator.create_invoice_pdf(merchant_data, filepath)
                
                if result and os.path.exists(result):
                    file_size = os.path.getsize(result)
                    print(f"   [SUCCESS] 成功生成: {filename} ({file_size} bytes)")
                    success_count += 1
                    total_amount += amount
                else:
                    print(f"   [ERROR] 生成失败")
                    fail_count += 1
                
        except Exception as e:
            print(f"   [ERROR] 生成失败: {str(e)}")
            fail_count += 1
    
    print(f"\n[INFO] 完整版发票风格PDF生成完成:")
    print(f"   [SUCCESS] 成功: {success_count} 个")
    print(f"   [ERROR] 失败: {fail_count} 个")
    print(f"   [EMOJI] 总金额: ${total_amount:,.2f}")
    print(f"   [EMOJI] 输出目录: {generator.output_dir}/")

if __name__ == "__main__":
    import sys
    target_period = sys.argv[1] if len(sys.argv) > 1 else None
    main(target_period)