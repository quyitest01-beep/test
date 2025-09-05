#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强版PDF账单数据检验器
专门针对账单数据进行精确验证，包括费率计算、商户映射、金额一致性等
"""

import os
import json
import glob
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import PyPDF2
import re
from decimal import Decimal, ROUND_HALF_UP

class EnhancedPDFValidator:
    def __init__(self):
        self.output_dir = "complete_invoice_pdfs"
        self.validation_results = {}
        self.total_issues = 0
        self.total_warnings = 0
        
    def validate_billing_pdfs(self, target_period: str = None) -> Dict[str, Any]:
        """验证账单PDF的完整性和准确性"""
        print("[🔍] 开始增强版PDF账单数据检验...")
        
        # 查找所有PDF文件
        pdf_files = glob.glob(os.path.join(self.output_dir, "*.pdf"))
        
        if not pdf_files:
            print("[⚠️] 未找到PDF文件，请先生成PDF账单")
            return {}
        
        print(f"[📊] 找到 {len(pdf_files)} 个PDF文件")
        
        # 加载源数据用于对比
        source_data = self._load_source_data(target_period)
        if not source_data:
            print("[❌] 无法加载源数据，检验终止")
            return {}
        
        # 逐个验证PDF
        for pdf_file in pdf_files:
            self._validate_billing_pdf(pdf_file, source_data)
        
        # 生成检验报告
        report = self._generate_enhanced_report()
        
        # 保存检验结果
        self._save_validation_results(report, target_period)
        
        return report
    
    def _load_source_data(self, target_period: str = None) -> Optional[Dict[str, Any]]:
        """加载源数据用于对比"""
        # 尝试加载主商户统计报告
        master_report_files = glob.glob('master_merchant_report_*.json')
        if master_report_files:
            latest_report = max(master_report_files, key=os.path.getctime)
            try:
                with open(latest_report, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                print(f"[✅] 加载源数据: {latest_report}")
                return data
            except Exception as e:
                print(f"[❌] 加载源数据失败: {e}")
        
        return None
    
    def _validate_billing_pdf(self, pdf_file: str, source_data: Dict[str, Any]):
        """验证单个账单PDF文件"""
        filename = os.path.basename(pdf_file)
        print(f"\n[🔍] 验证账单PDF: {filename}")
        
        try:
            # 提取PDF中的关键信息
            pdf_info = self._extract_billing_info(pdf_file)
            
            # 从文件名提取商户信息
            merchant_info = self._extract_merchant_from_filename(filename)
            
            # 执行详细的账单验证
            validation_result = self._validate_billing_data(pdf_info, merchant_info, source_data)
            
            # 存储验证结果
            self.validation_results[filename] = {
                'pdf_info': pdf_info,
                'merchant_info': merchant_info,
                'validation_result': validation_result,
                'issues': validation_result.get('issues', []),
                'warnings': validation_result.get('warnings', []),
                'status': 'PASS' if not validation_result.get('issues') else 'FAIL'
            }
            
            # 统计问题数量
            if validation_result.get('issues'):
                self.total_issues += len(validation_result.get('issues'))
            if validation_result.get('warnings'):
                self.total_warnings += len(validation_result.get('warnings'))
            
            # 显示验证结果
            if validation_result.get('issues'):
                print(f"   [❌] 发现问题: {len(validation_result.get('issues'))} 个")
                for issue in validation_result.get('issues', [])[:3]:
                    print(f"      - {issue}")
            if validation_result.get('warnings'):
                print(f"   [⚠️] 发现警告: {len(validation_result.get('warnings'))} 个")
                for warning in validation_result.get('warnings', [])[:2]:
                    print(f"      - {warning}")
            if not validation_result.get('issues') and not validation_result.get('warnings'):
                print(f"   [✅] 验证通过")
                
        except Exception as e:
            print(f"   [❌] 验证失败: {str(e)}")
            self.validation_results[filename] = {
                'error': str(e),
                'status': 'ERROR'
            }
    
    def _extract_billing_info(self, pdf_file: str) -> Dict[str, Any]:
        """从PDF中提取账单关键信息"""
        pdf_info = {
            'file_size': os.path.getsize(pdf_file),
            'pages': 0,
            'text_content': '',
            'total_amount': 0.0,
            'fee_rate': 0.0,
            'fee_amount': 0.0,
            'merchant_name': '',
            'period': '',
            'sub_merchants': [],
            'amounts': [],
            'currency': 'USDT'
        }
        
        try:
            with open(pdf_file, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                pdf_info['pages'] = len(pdf_reader.pages)
                
                # 提取文本内容
                text_content = ""
                for page in pdf_reader.pages:
                    text_content += page.extract_text() or ""
                
                pdf_info['text_content'] = text_content
                
                # 提取账单关键信息
                self._extract_billing_details(pdf_info, text_content)
                
        except Exception as e:
            print(f"      [⚠️] PDF解析失败: {e}")
        
        return pdf_info
    
    def _extract_billing_details(self, pdf_info: Dict[str, Any], text_content: str):
        """提取账单详细信息"""
        # 提取总金额
        total_amount = self._extract_total_amount(text_content)
        if total_amount:
            pdf_info['total_amount'] = total_amount
        
        # 提取费率
        fee_rate = self._extract_fee_rate(text_content)
        if fee_rate:
            pdf_info['fee_rate'] = fee_rate
        
        # 提取手续费金额
        fee_amount = self._extract_fee_amount(text_content)
        if fee_amount:
            pdf_info['fee_amount'] = fee_amount
        
        # 提取商户名称
        merchant_name = self._extract_merchant_name(text_content)
        if merchant_name:
            pdf_info['merchant_name'] = merchant_name
        
        # 提取期间
        period = self._extract_period(text_content)
        if period:
            pdf_info['period'] = period
        
        # 提取子商户信息
        sub_merchants = self._extract_sub_merchants(text_content)
        if sub_merchants:
            pdf_info['sub_merchants'] = sub_merchants
        
        # 提取所有金额
        amounts = self._extract_all_amounts(text_content)
        if amounts:
            pdf_info['amounts'] = amounts
    
    def _extract_total_amount(self, text: str) -> Optional[float]:
        """提取总金额"""
        # 匹配总金额模式 - 修复以匹配PDF中的实际格式
        patterns = [
            # 原始模式
            r'总金额[：:]\s*\$?([\d,]+\.?\d*)',
            r'Total Amount[：:]\s*\$?([\d,]+\.?\d*)',
            r'金额[：:]\s*\$?([\d,]+\.?\d*)',
            r'Amount[：:]\s*\$?([\d,]+\.?\d*)',
            # 新增：匹配PDF中的实际格式
            r'應付縂金額[^0-9]*([\d,]+\.?\d*)\s*USDT',
            r'Total Payable[^0-9]*([\d,]+\.?\d*)\s*USDT',
            r'GGR[^0-9]*([\d,]+\.?\d*)\s*USDT',
            # 通用金额模式
            r'([\d,]+\.?\d*)\s*USDT',
            r'\$([\d,]+\.?\d*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    amount_str = match.group(1).replace(',', '')
                    amount = float(amount_str)
                    # 过滤掉0.00这样的无效金额
                    if amount > 0:
                        return amount
                except ValueError:
                    continue
        
        return None
    
    def _extract_fee_rate(self, text: str) -> Optional[float]:
        """提取费率"""
        # 匹配费率模式 - 修复以匹配PDF中的实际格式
        patterns = [
            # 原始模式
            r'费率[：:]\s*([\d.]+)%',
            r'Fee Rate[：:]\s*([\d.]+)%',
            r'([\d.]+)%\s*费率',
            r'([\d.]+)%\s*Fee Rate',
            # 新增：匹配PDF中的实际格式
            r'收費率[：:]\s*([\d.]+)%',
            r'Fee Rate[：:]\s*([\d.]+)%',
            r'([\d.]+)%\s*收費率',
            r'([\d.]+)%\s*Fee Rate'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        
        return None
    
    def _extract_fee_amount(self, text: str) -> Optional[float]:
        """提取手续费金额"""
        # 匹配手续费模式
        patterns = [
            r'手续费[：:]\s*\$?([\d,]+\.?\d*)',
            r'Fee[：:]\s*\$?([\d,]+\.?\d*)',
            r'服务费[：:]\s*\$?([\d,]+\.?\d*)',
            r'Service Fee[：:]\s*\$?([\d,]+\.?\d*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    amount_str = match.group(1).replace(',', '')
                    return float(amount_str)
                except ValueError:
                    continue
        
        return None
    
    def _extract_merchant_name(self, text: str) -> Optional[str]:
        """提取商户名称"""
        # 匹配商户名称模式 - 修复以匹配PDF中的实际格式
        patterns = [
            # 原始模式
            r'商户[：:]\s*([^\n\r]+)',
            r'Merchant[：:]\s*([^\n\r]+)',
            r'客户[：:]\s*([^\n\r]+)',
            r'Customer[：:]\s*([^\n\r]+)',
            # 新增：匹配PDF中的实际格式
            r'主商戶[：:]\s*([^\n\r]+)',
            r'Main Merchant[：:]\s*([^\n\r]+)',
            r'商戶[：:]\s*([^\n\r]+)',
            r'Merchant[：:]\s*([^\n\r]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                merchant_name = match.group(1).strip()
                if len(merchant_name) < 50:  # 过滤过长的名称
                    return merchant_name
        
        return None
    
    def _extract_period(self, text: str) -> Optional[str]:
        """提取账单期间"""
        # 匹配期间模式
        patterns = [
            r'期间[：:]\s*([^\n\r]+)',
            r'Period[：:]\s*([^\n\r]+)',
            r'账单期间[：:]\s*([^\n\r]+)',
            r'Billing Period[：:]\s*([^\n\r]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                period = match.group(1).strip()
                if len(period) < 30:  # 过滤过长的期间
                    return period
        
        return None
    
    def _extract_sub_merchants(self, text: str) -> List[str]:
        """提取子商户信息"""
        sub_merchants = []
        
        # 查找包含子商户信息的行
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            # 简单的子商户识别逻辑
            if line and len(line) < 30 and not line.startswith('$') and not line.isdigit():
                if not re.match(r'^[\d\s\-\.]+$', line):  # 不是纯数字
                    if 'merchant' in line.lower() or '商户' in line:
                        sub_merchants.append(line)
        
        return sub_merchants[:5]  # 只返回前5个
    
    def _extract_all_amounts(self, text: str) -> List[float]:
        """提取所有金额"""
        # 匹配美元金额格式
        amount_pattern = r'\$[\d,]+\.?\d*'
        amounts = []
        
        matches = re.findall(amount_pattern, text)
        for match in matches:
            try:
                amount_str = match.replace('$', '').replace(',', '')
                amount = float(amount_str)
                amounts.append(amount)
            except ValueError:
                continue
        
        return amounts
    
    def _extract_merchant_from_filename(self, filename: str) -> Dict[str, Any]:
        """从文件名提取商户信息"""
        # 文件名格式: {merchant_name}_{period}_賬單.pdf
        parts = filename.replace('_賬單.pdf', '').split('_')
        
        if len(parts) >= 2:
            merchant_name = parts[0]
            period = '_'.join(parts[1:])
            return {
                'merchant_name': merchant_name,
                'period': period,
                'filename': filename
            }
        
        return {
            'merchant_name': 'unknown',
            'period': 'unknown',
            'filename': filename
        }
    
    def _validate_billing_data(self, pdf_info: Dict[str, Any], merchant_info: Dict[str, Any], source_data: Dict[str, Any]) -> Dict[str, Any]:
        """验证账单数据的完整性和准确性"""
        issues = []
        warnings = []
        
        # 1. 文件完整性检查
        if pdf_info['file_size'] < 1000:
            issues.append("PDF文件过小，可能生成失败")
        
        if pdf_info['pages'] == 0:
            issues.append("PDF页数为0，文件可能损坏")
        
        # 2. 账单信息完整性检查
        if not pdf_info['total_amount']:
            issues.append("未检测到总金额信息")
        
        if not pdf_info['fee_rate']:
            warnings.append("未检测到费率信息")
        
        if not pdf_info['merchant_name']:
            warnings.append("未检测到商户名称")
        
        if not pdf_info['period']:
            warnings.append("未检测到账单期间")
        
        # 3. 数据一致性检查
        if source_data and 'mapped_data' in source_data:
            mapped_data = source_data['mapped_data']
            merchant_name = merchant_info['merchant_name']
            
            if merchant_name in mapped_data:
                source_info = mapped_data[merchant_name]
                
                # 对比总金额
                source_amount = source_info.get('total_charge_usdt', 0)
                if pdf_info['total_amount'] and abs(pdf_info['total_amount'] - source_amount) > 0.01:
                    issues.append(f"PDF总金额({pdf_info['total_amount']:.2f})与源数据金额({source_amount:.2f})不匹配")
                
                # 对比费率
                source_fee_rate = source_info.get('fee_rate', 0)
                if pdf_info['fee_rate'] and abs(pdf_info['fee_rate'] - source_fee_rate) > 0.001:
                    issues.append(f"PDF费率({pdf_info['fee_rate']:.3f}%)与源数据费率({source_fee_rate:.3f}%)不匹配")
                
                # 检查子商户数量
                source_sub_count = len(source_info.get('sub_merchants', []))
                if source_sub_count > 0:
                    warnings.append(f"源数据包含{source_sub_count}个子商户，建议在PDF中显示")
                
            else:
                warnings.append(f"商户 {merchant_name} 在源数据中未找到")
        
        # 4. 费率计算验证
        if pdf_info['total_amount'] and pdf_info['fee_rate'] and pdf_info['fee_amount']:
            calculated_fee = pdf_info['total_amount'] * (pdf_info['fee_rate'] / 100)
            if abs(calculated_fee - pdf_info['fee_amount']) > 0.01:
                warnings.append(f"手续费计算可能不准确: 计算值({calculated_fee:.2f}) vs 显示值({pdf_info['fee_amount']:.2f})")
        
        # 5. 金额合理性检查
        if pdf_info['total_amount']:
            if pdf_info['total_amount'] > 1000000:
                warnings.append(f"检测到异常大金额: ${pdf_info['total_amount']:,.2f}")
            if pdf_info['total_amount'] < 0:
                issues.append("总金额为负数，数据异常")
        
        return {
            'issues': issues,
            'warnings': warnings,
            'source_data_available': bool(source_data),
            'data_completeness': self._calculate_completeness_score(pdf_info)
        }
    
    def _calculate_completeness_score(self, pdf_info: Dict[str, Any]) -> float:
        """计算数据完整性评分"""
        required_fields = ['total_amount', 'fee_rate', 'merchant_name', 'period']
        optional_fields = ['fee_amount', 'sub_merchants']
        
        required_score = sum(1 for field in required_fields if pdf_info.get(field)) / len(required_fields)
        optional_score = sum(1 for field in optional_fields if pdf_info.get(field)) / len(optional_fields)
        
        # 权重：必需字段70%，可选字段30%
        total_score = required_score * 0.7 + optional_score * 0.3
        return round(total_score * 100, 1)
    
    def _generate_enhanced_report(self) -> Dict[str, Any]:
        """生成增强版验证报告"""
        total_pdfs = len(self.validation_results)
        passed_pdfs = sum(1 for result in self.validation_results.values() if result.get('status') == 'PASS')
        failed_pdfs = sum(1 for result in self.validation_results.values() if result.get('status') == 'FAIL')
        error_pdfs = sum(1 for result in self.validation_results.values() if result.get('status') == 'ERROR')
        
        # 计算平均完整性评分
        completeness_scores = []
        for result in self.validation_results.values():
            if 'validation_result' in result and 'data_completeness' in result['validation_result']:
                completeness_scores.append(result['validation_result']['data_completeness'])
        
        avg_completeness = sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0
        
        report = {
            'summary': {
                'total_pdfs': total_pdfs,
                'passed': passed_pdfs,
                'failed': failed_pdfs,
                'error': error_pdfs,
                'total_issues': self.total_issues,
                'total_warnings': self.total_warnings,
                'average_completeness': round(avg_completeness, 1),
                'validation_time': datetime.now().isoformat()
            },
            'details': self.validation_results,
            'recommendations': self._generate_enhanced_recommendations(),
            'quality_metrics': {
                'data_completeness': avg_completeness,
                'error_rate': (failed_pdfs + error_pdfs) / total_pdfs * 100 if total_pdfs > 0 else 0,
                'warning_rate': self.total_warnings / total_pdfs if total_pdfs > 0 else 0
            }
        }
        
        return report
    
    def _generate_enhanced_recommendations(self) -> List[str]:
        """生成增强版改进建议"""
        recommendations = []
        
        if self.total_issues > 0:
            recommendations.append("发现数据问题，建议检查源数据准确性和PDF生成逻辑")
        
        if self.total_warnings > 0:
            recommendations.append("存在数据警告，建议完善PDF内容显示")
        
        if any(result.get('status') == 'ERROR' for result in self.validation_results.values()):
            recommendations.append("存在PDF解析错误，建议检查PDF生成过程")
        
        # 基于完整性评分的建议
        avg_completeness = 0
        completeness_scores = []
        for result in self.validation_results.values():
            if 'validation_result' in result and 'data_completeness' in result['validation_result']:
                completeness_scores.append(result['validation_result']['data_completeness'])
        
        if completeness_scores:
            avg_completeness = sum(completeness_scores) / len(completeness_scores)
            
            if avg_completeness < 70:
                recommendations.append("数据完整性较低，建议完善PDF模板和内容提取逻辑")
            elif avg_completeness < 90:
                recommendations.append("数据完整性良好，建议优化可选字段的显示")
            else:
                recommendations.append("数据完整性优秀，PDF质量很高")
        
        if not recommendations:
            recommendations.append("所有PDF验证通过，数据质量优秀")
        
        return recommendations
    
    def _save_validation_results(self, report: Dict[str, Any], target_period: str = None):
        """保存验证结果"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        period_suffix = f"_{target_period}" if target_period else ""
        filename = f"enhanced_pdf_validation_report{period_suffix}_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"\n[💾] 增强版验证报告已保存: {filename}")
        except Exception as e:
            print(f"\n[❌] 保存验证报告失败: {e}")
    
    def print_enhanced_summary(self):
        """打印增强版验证摘要"""
        if not self.validation_results:
            return
        
        print(f"\n{'='*70}")
        print(f"📊 增强版PDF账单数据检验完成")
        print(f"{'='*70}")
        
        total = len(self.validation_results)
        passed = sum(1 for r in self.validation_results.values() if r.get('status') == 'PASS')
        failed = sum(1 for r in self.validation_results.values() if r.get('status') == 'FAIL')
        error = sum(1 for r in self.validation_results.values() if r.get('status') == 'ERROR')
        
        print(f"📁 总PDF数量: {total}")
        print(f"✅ 验证通过: {passed}")
        print(f"❌ 验证失败: {failed}")
        print(f"⚠️  解析错误: {error}")
        print(f"🔍 发现问题: {self.total_issues} 个")
        print(f"⚠️  发现警告: {self.total_warnings} 个")
        
        # 显示质量指标
        if 'quality_metrics' in self.validation_results.get(list(self.validation_results.keys())[0], {}).get('validation_result', {}):
            completeness_scores = []
            for result in self.validation_results.values():
                if 'validation_result' in result and 'data_completeness' in result['validation_result']:
                    completeness_scores.append(result['validation_result']['data_completeness'])
            
            if completeness_scores:
                avg_completeness = sum(completeness_scores) / len(completeness_scores)
                print(f"📈 平均完整性评分: {avg_completeness:.1f}%")
        
        if self.total_issues > 0:
            print(f"\n🚨 主要问题:")
            all_issues = []
            for filename, result in self.validation_results.items():
                if result.get('issues'):
                    all_issues.extend([f"{filename}: {issue}" for issue in result.get('issues', [])])
            
            for issue in all_issues[:5]:
                print(f"   - {issue}")
        
        print(f"{'='*70}")

def main(target_period: str = None):
    """主函数"""
    validator = EnhancedPDFValidator()
    
    # 执行验证
    report = validator.validate_billing_pdfs(target_period)
    
    # 打印摘要
    validator.print_enhanced_summary()
    
    return report

if __name__ == "__main__":
    import sys
    target_period = sys.argv[1] if len(sys.argv) > 1 else None
    main(target_period)
