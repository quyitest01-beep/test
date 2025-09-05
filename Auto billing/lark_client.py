"""
Lark API 客户端
用于从Lark表格拉取客户信息和费率信息
"""
import requests
import json
import logging
from typing import List, Dict, Any
from config import LARK_APP_ID, LARK_APP_SECRET

class LarkClient:
    def __init__(self):
        self.app_id = LARK_APP_ID
        self.app_secret = LARK_APP_SECRET
        self.base_url = "https://open.larksuite.com/open-apis"
        self.access_token = None
        self.logger = logging.getLogger(__name__)
        
    def get_access_token(self) -> str:
        """获取访问令牌"""
        if self.access_token:
            return self.access_token
            
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        
        try:
            response = requests.post(url, json=data)
            response.raise_for_status()
            result = response.json()
            
            if result.get("code") == 0:
                self.access_token = result.get("tenant_access_token")
                self.logger.info("成功获取Lark访问令牌")
                return self.access_token
            else:
                self.logger.error(f"获取访问令牌失败: {result}")
                raise Exception(f"获取访问令牌失败: {result}")
                
        except Exception as e:
            self.logger.error(f"获取访问令牌异常: {str(e)}")
            raise
    
    def get_sheet_data(self, spreadsheet_token: str, sheet_id: str) -> List[Dict[str, Any]]:
        """获取表格数据"""
        token = self.get_access_token()
        url = f"{self.base_url}/sheets/v2/spreadsheets/{spreadsheet_token}/values/{sheet_id}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            if result.get("code") == 0:
                data = result.get("data", {}).get("valueRange", {}).get("values", [])
                self.logger.info(f"成功获取表格数据，共{len(data)}行")
                return data
            else:
                self.logger.error(f"获取表格数据失败: {result}")
                raise Exception(f"获取表格数据失败: {result}")
                
        except Exception as e:
            self.logger.error(f"获取表格数据异常: {str(e)}")
            raise
    
    def extract_customer_info(self, sheet_data: List[List[str]]) -> List[Dict[str, str]]:
        """提取客户信息"""
        if not sheet_data or len(sheet_data) < 2:
            self.logger.warning("表格数据为空或格式不正确")
            return []
        
        # 假设第一行是表头
        headers = sheet_data[0]
        customers = []
        
        # 查找需要的列索引
        merchant_idx = None  # 主商户字段
        merchant_name_idx = None  # 子商户名称字段
        merchant_id_idx = None
        email_idx = None
        tg_group_idx = None
        tg_number_idx = None
        
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if '主商户' in header_lower or 'merchant' in header_lower:
                merchant_idx = i
            elif '子商户名称' in header_lower or 'merchant_name' in header_lower:
                merchant_name_idx = i
            elif '商户id' in header_lower or '子商户id' in header_lower:
                merchant_id_idx = i
            elif '邮箱' in header_lower:
                email_idx = i
            elif 'tg群' in header_lower:
                tg_group_idx = i
            elif 'tg号' in header_lower or 'tg号码' in header_lower:
                tg_number_idx = i
        
        # 处理数据行
        for row in sheet_data[1:]:
            if len(row) >= max(filter(None, [merchant_idx, merchant_name_idx, merchant_id_idx, email_idx, tg_group_idx, tg_number_idx] or [0])):
                customer = {
                    'merchant': row[merchant_idx] if merchant_idx is not None and len(row) > merchant_idx else '',
                    'merchant_name': row[merchant_name_idx] if merchant_name_idx is not None and len(row) > merchant_name_idx else '',
                    'merchant_id': row[merchant_id_idx] if merchant_id_idx is not None and len(row) > merchant_id_idx else '',
                    'email': row[email_idx] if email_idx is not None and len(row) > email_idx else '',
                    'tg_group': row[tg_group_idx] if tg_group_idx is not None and len(row) > tg_group_idx else '',
                    'tg_number': row[tg_number_idx] if tg_number_idx is not None and len(row) > tg_number_idx else ''
                }
                customers.append(customer)
        
        self.logger.info(f"成功提取{len(customers)}个客户信息")
        return customers
    
    def extract_rate_info(self, sheet_data: List[List[str]]) -> Dict[str, float]:
        """提取费率信息"""
        if not sheet_data or len(sheet_data) < 2:
            self.logger.warning("费率表格数据为空或格式不正确")
            return {}
        
        headers = sheet_data[0]
        rates = {}
        
        # 查找需要的列索引
        merchant_idx = None
        rate_idx = None
        
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if '商户' in header_lower:
                merchant_idx = i
            elif '费率' in header_lower or '收费率' in header_lower:
                rate_idx = i
        
        # 处理数据行
        for row in sheet_data[1:]:
            if len(row) >= max(filter(None, [merchant_idx, rate_idx] or [0])):
                merchant = row[merchant_idx] if merchant_idx is not None and len(row) > merchant_idx else ''
                rate_str = row[rate_idx] if rate_idx is not None and len(row) > rate_idx else '0'
                
                try:
                    # 处理费率格式（可能是百分比或小数）
                    rate_str = rate_str.replace('%', '').strip()
                    rate = float(rate_str) / 100 if '%' in row[rate_idx] else float(rate_str)
                    rates[merchant] = rate
                except ValueError:
                    self.logger.warning(f"无法解析费率: {rate_str} for {merchant}")
                    continue
        
        self.logger.info(f"成功提取{len(rates)}个费率信息")
        return rates

