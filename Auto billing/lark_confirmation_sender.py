#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lark确认按钮发送器
发送带确认按钮的账单消息到Lark群组
"""
import requests
import json
import os
import sys
import hashlib
import hmac
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
from config_loader import get_config

# 强制设置UTF-8编码
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass
if sys.stderr.encoding != 'utf-8':
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

class LarkConfirmationSender:
    """Lark确认按钮发送器"""
    
    def __init__(self, year: str, month: str):
        self.year = year
        self.month = month
        # 使用统一配置加载器
        config = get_config().get_lark_config()
        self.app_id = config.get('app_id')
        self.app_secret = config.get('app_secret')
        self.base_url = config.get('api_base_url', 'https://open.larksuite.com/open-apis')
        self.access_token = None
        self.setup_logging()
        print(f"[INFO] 加载Lark配置: app_id={self.app_id}, base_url={self.base_url}")
        
    def setup_logging(self):
        """设置日志"""
        # 强制使用UTF-8编码
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            force=True
        )
        self.logger = logging.getLogger(__name__)
        
        # 确保日志处理器使用UTF-8
        for handler in self.logger.handlers:
            if hasattr(handler, 'setFormatter'):
                handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        
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
        
    def get_group_id(self) -> str:
        """获取群组ID - 从配置文件读取"""
        try:
            with open('lark_config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
                group_id = config.get('group_id', 'ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
                self.logger.info(f"从配置文件读取群组ID: {group_id}")
                return group_id
        except Exception as e:
            self.logger.error(f"读取配置文件失败: {str(e)}")
            return "ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    
    def generate_confirmation_token(self, batch_id: str, action: str) -> str:
        """生成确认/拒绝操作的签名token"""
        # 使用app_secret作为密钥
        secret = self.app_secret.encode('utf-8')
        message = f"{batch_id}:{action}:{self.year}{self.month}".encode('utf-8')
        
        # 生成HMAC签名
        signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
        return signature[:16]  # 取前16位作为token
    
    def save_batch_record(self, batch_id: str, summary_data: Dict[str, Any], zip_files: List[str]) -> str:
        """保存批次记录到本地，返回记录文件路径"""
        try:
            # 确保records目录存在
            os.makedirs('records', exist_ok=True)
            
            # 生成确认/拒绝链接
            confirm_token = self.generate_confirmation_token(batch_id, 'confirm')
            reject_token = self.generate_confirmation_token(batch_id, 'reject')
            
            # 构建批次记录
            batch_record = {
                "batch_id": batch_id,
                "period": f"{self.year}年{self.month}月",
                "created_at": datetime.now().isoformat(),
                "status": "pending",
                "summary_data": summary_data,
                "zip_files": zip_files,
                "confirm_url": f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=confirm&code={confirm_token}",
                "reject_url": f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=reject&code={reject_token}",
                "confirm_token": confirm_token,
                "reject_token": reject_token
            }
            
            # 保存到文件
            record_file = f"records/batch_{batch_id}.json"
            with open(record_file, 'w', encoding='utf-8') as f:
                json.dump(batch_record, f, ensure_ascii=False, indent=2)
            
            print(f"[INFO] 批次记录已保存: {record_file}")
            print(f"[INFO] 确认链接: {batch_record['confirm_url']}")
            print(f"[INFO] 拒绝链接: {batch_record['reject_url']}")
            
            return record_file
            
        except Exception as e:
            print(f"[ERROR] 保存批次记录失败: {str(e)}")
            return ""
        
    def create_confirmation_message(self, zip_file: str, summary_data: Dict[str, Any]) -> str:
        """创建确认消息 - 避免使用emoji表情"""
        period = f"{self.year}年{self.month}月"
        
        message = f"""账单确认 - {period}

文件: {zip_file}
期间: {period}
总金额: {summary_data.get('total_amount', 0):,.2f} USDT
商户数量: {summary_data.get('total_count', 0)}个

商户明细:
"""
        
        # 获取商户数据
        merchants = summary_data.get('merchants', {})
        merchant_count = len(merchants)
        
        # 如果商户数量超过20个，只显示前20个，并添加提示
        max_display = 20
        if merchant_count > max_display:
            message += f"（显示前{max_display}个商户，共{merchant_count}个）\n\n"
            display_merchants = dict(list(merchants.items())[:max_display])
        else:
            display_merchants = merchants
        
        # 添加商户明细
        for merchant, data in display_merchants.items():
            message += f"• {merchant}: {data.get('amount', 0):,.2f} USDT\n"
        
        # 如果商户数量超过显示限制，添加提示
        if merchant_count > max_display:
            message += f"\n... 还有 {merchant_count - max_display} 个商户未显示\n"
            message += f"完整商户列表请查看ZIP文件内容\n"
            
        message += f"""
请确认账单信息无误后，点击下方按钮发送给客户。

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        # 检查消息长度
        message_length = len(message)
        if message_length > 2000:  # Lark消息长度限制
            print(f"[WARNING] 消息长度 ({message_length}) 可能超过Lark限制")
            # 截断消息，只保留基本信息
            message = f"""账单确认 - {period}

文件: {zip_file}
期间: {period}
总金额: {summary_data.get('total_amount', 0):,.2f} USDT
商户数量: {summary_data.get('total_count', 0)}个

商户明细: 共{merchant_count}个商户（详细列表请查看ZIP文件）

请确认账单信息无误后，点击下方按钮发送给客户。

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return message
        
    def create_confirmation_card(self, zip_file: str, summary_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建确认卡片 - 使用open_url链接替代按钮"""
        period = f"{self.year}年{self.month}月"
        
        # 生成批次ID
        batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 处理ZIP文件列表
        zip_files_list = summary_data.get('zip_files', [])
        if isinstance(zip_files_list, list) and zip_files_list:
            files_text = "；\n".join(zip_files_list)
        else:
            files_text = zip_file
        
        # 保存批次记录并获取确认/拒绝链接
        record_file = self.save_batch_record(batch_id, summary_data, zip_files_list)
        if record_file:
            # 读取保存的记录获取链接
            with open(record_file, 'r', encoding='utf-8') as f:
                batch_record = json.load(f)
                confirm_url = batch_record['confirm_url']
                reject_url = batch_record['reject_url']
        else:
            # 如果保存失败，使用默认链接
            confirm_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=confirm&code=default"
            reject_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=reject&code=default"
        
        # 构建商户明细文本（统一USDT）
        merchant_details = ""
        merchants = summary_data.get('merchants', {})
        merchant_count = len(merchants)
        
        # 显示所有商户，不再限制数量
        merchant_details += f"（显示全部{merchant_count}个商户）\n\n"
        display_merchants = dict(sorted(merchants.items(), key=lambda kv: kv[0].lower()))
        
        for merchant, data in display_merchants.items():
            fee_rate = data.get('fee_rate')
            rate_text = f"（费率{fee_rate}%）" if fee_rate is not None else ""
            merchant_details += f"• {merchant}{rate_text}: {data.get('amount', 0):,.2f} USDT\n"

        card = {
            "config": {
                "wide_screen_mode": True
            },
            "header": {
                "template": "blue",
                "title": {
                    "content": f"账单确认 - {period}",
                    "tag": "plain_text"
                }
            },
            "elements": [
                {
                    "tag": "markdown",
                    "content": f"**文件**: \n{files_text}\n**期间**: {period}\n**总金额**: {summary_data.get('total_amount', 0):,.2f} USDT\n**商户数量**: {summary_data.get('total_count', 0)}个"
                },
                {
                    "tag": "markdown",
                    "content": "**商户明细**:\n" + merchant_details
                },
                {
                    "tag": "markdown",
                    "content": f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n**批次ID**: {batch_id}"
                },
                {
                    "tag": "action",
                    "actions": [
                        {
                            "tag": "button",
                            "text": {
                                "tag": "plain_text",
                                "content": "确认账单"
                            },
                            "type": "primary",
                            "multi_url": {
                                "url": confirm_url,
                                "android_url": "lark://msgcard/unsupported_action",
                                "ios_url": "lark://msgcard/unsupported_action",
                                "pc_url": confirm_url
                            }
                        },
                        {
                            "tag": "button",
                            "text": {
                                "tag": "plain_text",
                                "content": "拒绝账单"
                            },
                            "type": "default",
                            "multi_url": {
                                "url": reject_url,
                                "android_url": "lark://msgcard/unsupported_action",
                                "ios_url": "lark://msgcard/unsupported_action",
                                "pc_url": reject_url
                            }
                        }
                    ]
                }
            ]
        }
        
        return card
        
    def send_text_message(self, message: str) -> bool:
        """发送纯文本消息到Lark群组"""
        try:
            access_token = self.get_access_token()
            group_id = self.get_group_id()
            
            if group_id == "ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx":
                self.logger.error("请先配置正确的群组ID")
                return False
            
            # 使用应用机器人API发送消息
            url = f"{self.base_url}/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # 构建请求体 - 发送纯文本消息
            req = {
                "receive_id": group_id,
                "msg_type": "text",
                "content": json.dumps({"text": message}, ensure_ascii=False)
            }
            
            params = {"receive_id_type": "chat_id"}
            
            print(f"[DEBUG] 发送文本消息到Lark群: {group_id}")
            
            response = requests.post(url, params=params, json=req, headers=headers)
            
            # 检查响应状态
            if response.status_code != 200:
                self.logger.error(f"发送文本消息失败，状态码: {response.status_code}")
                self.logger.error(f"响应内容: {response.text}")
                return False
            
            result = response.json()
            if result.get("code") == 0:
                self.logger.info("文本消息发送成功")
                return True
            else:
                self.logger.error(f"发送文本消息失败: {result}")
                return False
                
        except Exception as e:
            self.logger.error(f"发送文本消息异常: {str(e)}")
            return False
        
    def build_template_content(self, zip_file: str, summary_data: Dict[str, Any], confirm_url: str, reject_url: str) -> str:
        """构建模板内容"""
        period = f"{self.year}年{self.month}月"
        
        # 处理ZIP文件列表
        zip_files_list = summary_data.get('zip_files', [])
        if isinstance(zip_files_list, list) and zip_files_list:
            files_text = "；\n".join(zip_files_list)
        else:
            files_text = zip_file
        
        # 构建商户明细文本
        merchant_details = ""
        merchants = summary_data.get('merchants', {})
        merchant_count = len(merchants)
        
        # 按A→Z排序显示商户
        display_merchants = dict(sorted(merchants.items(), key=lambda kv: kv[0].lower()))
        
        for merchant, data in display_merchants.items():
            fee_rate = data.get('fee_rate')
            rate_text = f"（费率{fee_rate}%）" if fee_rate is not None else ""
            merchant_details += f"• {merchant}{rate_text}: {data.get('amount', 0):,.2f} USDT\n"
        
        # 构建完整内容
        content = f"""文件: {files_text}
期间: {period}
总金额: {summary_data.get('total_amount', 0):,.2f} USDT
商户数量: {summary_data.get('total_count', 0)}个

商户明细:
{merchant_details}

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""
        
        # 构建模板请求体
        template_data = {
            "type": "template",
            "data": {
                "template_id": "ctp_AAz5rLnkluZX",  # 你的模板ID
                "template_variable": {
                    "date": period,
                    "content": content,
                    "confirm": confirm_url,
                    "reject": reject_url
                }
            }
        }
        
        return json.dumps(template_data, ensure_ascii=False)
        
    def send_confirmation_message(self, zip_file: str, summary_data: Dict[str, Any]) -> bool:
        """发送确认消息到Lark群组 - 使用模板格式"""
        try:
            access_token = self.get_access_token()
            group_id = self.get_group_id()
            
            if group_id == "ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx":
                self.logger.error("请先配置正确的群组ID")
                return False
                
            # 生成批次ID和确认/拒绝链接
            batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
            confirm_token = self.generate_confirmation_token(batch_id, "confirm")
            reject_token = self.generate_confirmation_token(batch_id, "reject")
            
            confirm_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=confirm&code={confirm_token}"
            reject_url = f"http://127.0.0.1:8787/confirm?bid={batch_id}&action=reject&code={reject_token}"
            
            # 保存批次记录
            self.save_batch_record(batch_id, summary_data, summary_data.get('zip_files', []))
            
            # 构建模板内容
            template_content = self.build_template_content(zip_file, summary_data, confirm_url, reject_url)
            
            # 生成唯一的UUID
            import uuid
            message_uuid = str(uuid.uuid4())
            
            # 使用应用机器人API发送消息
            url = f"{self.base_url}/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # 构建请求体 - 使用模板格式
            req = {
                "receive_id": group_id,
                "msg_type": "interactive",
                "content": template_content,
                "uuid": message_uuid
            }
            
            params = {"receive_id_type": "chat_id"}
            
            print(f"[DEBUG] 发送卡片到Lark群: {group_id}")
            print(f"[DEBUG] 请求体: {json.dumps(req, ensure_ascii=False, indent=2)}")
            
            response = requests.post(url, params=params, json=req, headers=headers)
            
            # 检查响应状态
            if response.status_code != 200:
                self.logger.error(f"HTTP错误: {response.status_code}")
                return False
            
            try:
                result = response.json()
            except json.JSONDecodeError:
                self.logger.error(f"响应不是有效JSON: {response.text}")
                return False
            
            if result.get("code") == 0:
                self.logger.info(f"确认消息发送成功到群组 {group_id}")
                
                # 发送文件附件
                if os.path.exists(zip_file):
                    print(f"[INFO] 开始发送文件附件: {zip_file}")
                    file_success = self.send_file_attachment(zip_file, access_token, group_id)
                    if file_success:
                        self.logger.info("文件附件发送成功")
                    else:
                        self.logger.warning("文件附件发送失败")
                else:
                    self.logger.warning(f"文件不存在，跳过附件发送: {zip_file}")
                
                return True
            else:
                error_msg = result.get("msg", "未知错误")
                self.logger.error(f"发送失败: {result.get('code')} - {error_msg}")
                return False
                
        except Exception as e:
            self.logger.error(f"发送确认消息异常: {str(e)}")
            return False

    def send_simple_confirmation_message(self, zip_file: str, summary_data: Dict[str, Any]) -> bool:
        """发送简单的确认消息，用户可以通过私聊机器人来确认"""
        try:
            access_token = self.get_access_token()
            group_id = self.get_group_id()
            
            if group_id == "ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx":
                self.logger.error("请先配置正确的群组ID")
                return False
                
            # 创建简单的确认消息
            message = self.create_confirmation_message(zip_file, summary_data)
            message += "\n\n" + "="*50 + "\n"
            message += "确认方式：\n"
            message += "• 私聊机器人发送 '确认' 来确认账单\n"
            message += "• 私聊机器人发送 '拒绝' 来拒绝账单\n"
            message += "• 或者点击上方按钮跳转确认\n"
            
            # 发送文本消息
            url = f"{self.base_url}/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            req = {
                "receive_id": group_id,
                "msg_type": "text",
                "content": json.dumps({"text": message}, ensure_ascii=False)
            }
            
            params = {"receive_id_type": "chat_id"}
            
            print(f"[DEBUG] 发送简单确认消息到Lark群: {group_id}")
            
            response = requests.post(url, params=params, json=req, headers=headers)
            
            if response.status_code != 200:
                self.logger.error(f"HTTP错误: {response.status_code}")
                return False
            
            try:
                result = response.json()
            except json.JSONDecodeError:
                self.logger.error(f"响应不是有效JSON: {response.text}")
                return False
            
            if result.get("code") == 0:
                self.logger.info(f"简单确认消息发送成功到群组 {group_id}")
                
                # 发送文件附件
                if os.path.exists(zip_file):
                    print(f"[INFO] 开始发送文件附件: {zip_file}")
                    file_success = self.send_file_attachment(zip_file, access_token, group_id)
                    if file_success:
                        self.logger.info("文件附件发送成功")
                    else:
                        self.logger.warning("文件附件发送失败")
                else:
                    self.logger.warning(f"文件不存在，跳过附件发送: {zip_file}")
                
                return True
            else:
                error_msg = result.get("msg", "未知错误")
                self.logger.error(f"发送失败: {result.get('code')} - {error_msg}")
                return False
                
        except Exception as e:
            self.logger.error(f"发送简单确认消息异常: {str(e)}")
            return False
    
    def send_file_attachment(self, file_path: str, access_token: str, group_id: str) -> bool:
        """发送文件附件到Lark群 - 使用正确的MultipartEncoder格式"""
        try:
            # 检查文件是否存在
            if not os.path.exists(file_path):
                self.logger.error(f"文件不存在: {file_path}")
                return False
            
            # 获取文件大小
            file_size = os.path.getsize(file_path)
            if file_size > 100 * 1024 * 1024:  # 100MB限制
                self.logger.error(f"文件过大: {file_size / 1024 / 1024:.2f}MB")
                return False
            
            print(f"[INFO] 开始上传文件: {file_path} (大小: {file_size / 1024 / 1024:.2f}MB)")
            
            # 上传文件到Lark - 使用正确的MultipartEncoder格式
            upload_url = f"{self.base_url}/im/v1/files"
            
            # 获取文件MIME类型
            file_name = os.path.basename(file_path)
            if file_path.endswith('.zip'):
                mime_type = 'application/zip'
            elif file_path.endswith('.pdf'):
                mime_type = 'application/pdf'
            else:
                mime_type = 'application/octet-stream'
            
            # 使用MultipartEncoder构建请求
            try:
                from requests_toolbelt import MultipartEncoder
                
                form = {
                    'file_type': 'stream',
                    'file_name': file_name,
                    'file': (file_name, open(file_path, 'rb'), mime_type)
                }
                
                multi_form = MultipartEncoder(form)
                headers = {
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': multi_form.content_type
                }
                
                print(f"[DEBUG] 文件上传请求头: {headers}")
                print(f"[DEBUG] 文件上传表单: {form}")
                
                response = requests.post(upload_url, headers=headers, data=multi_form)
                
            except ImportError:
                # 如果没有requests_toolbelt，使用原生requests
                print("[WARNING] 未安装requests_toolbelt，使用原生requests上传")
                with open(file_path, 'rb') as f:
                    files = {'file': (file_name, f, mime_type)}
                    response = requests.post(upload_url, headers={'Authorization': f'Bearer {access_token}'}, files=files)
            
            print(f"[DEBUG] 文件上传响应: {response.status_code}")
            print(f"[DEBUG] 文件上传响应内容: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get("code") == 0:
                    file_key = result.get("data", {}).get("file_key")
                    if file_key:
                        print(f"[INFO] 文件上传成功，file_key: {file_key}")
                        # 发送文件消息
                        return self.send_file_message(file_key, access_token, group_id)
                    else:
                        self.logger.error("文件上传成功但未获取到file_key")
                        return False
                else:
                    error_msg = result.get("msg", "未知错误")
                    self.logger.error(f"文件上传失败: {result.get('code')} - {error_msg}")
                    return False
            else:
                self.logger.error(f"文件上传HTTP错误: {response.status_code}")
                return False
            
        except Exception as e:
            self.logger.error(f"发送文件附件异常: {str(e)}")
            return False
    
    def send_file_message(self, file_key: str, access_token: str, group_id: str) -> bool:
        """发送文件消息"""
        try:
            url = f"{self.base_url}/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            req = {
                "receive_id": group_id,
                "msg_type": "file",
                "content": json.dumps({"file_key": file_key})
            }
            
            params = {"receive_id_type": "chat_id"}
            
            print(f"[DEBUG] 发送文件消息，file_key: {file_key}")
            
            response = requests.post(url, params=params, json=req, headers=headers)
            print(f"[DEBUG] 文件消息发送响应: {response.status_code}")
            print(f"[DEBUG] 文件消息发送响应内容: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get("code") == 0:
                    print("[INFO] 文件消息发送成功")
                    return True
                else:
                    error_msg = result.get("msg", "未知错误")
                    self.logger.error(f"文件消息发送失败: {result.get('code')} - {error_msg}")
                    return False
            else:
                self.logger.error(f"文件消息发送HTTP错误: {response.status_code}")
                return False
            
        except Exception as e:
            self.logger.error(f"发送文件消息异常: {str(e)}")
            return False
            
    def test_send(self) -> bool:
        """测试发送功能"""
        test_data = {
            "merchants": {
                "TestMerchant": {"amount": 100.0}
            },
            "total_count": 1,
            "total_amount": 100.0,
            "period": f"{self.year}年{self.month}月"
        }
        
        return self.send_confirmation_message("test.zip", test_data)

if __name__ == "__main__":
    sender = LarkConfirmationSender("2025", "07")
    
    # 测试发送
    if sender.test_send():
        print("测试发送成功！")
    else:
        print("测试发送失败，请检查配置")
