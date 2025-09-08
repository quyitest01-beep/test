import requests
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
from bilingual_templates import BilingualTemplates

class TelegramSender:
    """Telegram发送器 - 支持消息、文件发送"""
    
    def __init__(self, config_file: str = "telegram_config.json"):
        self.config = self.load_config(config_file)
        self.setup_logging()
        
    def load_config(self, config_file: str) -> Dict[str, Any]:
        """加载Telegram配置"""
        default_config = {
            "bot_token": "",
            "finance_chat_id": "",
            "reconciliation_chat_id": "",
            "api_base_url": "https://api.telegram.org/bot"
        }
        
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return {**default_config, **config}
        else:
            # 创建默认配置文件
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
            print(f"[WARNING]  请配置Telegram设置: {config_file}")
            return default_config
    
    def setup_logging(self):
        """设置日志"""
        self.logger = logging.getLogger(__name__)
    
    def send_message(self, chat_id: str, message: str, parse_mode: str = "HTML", 
                     inline_keyboard: Optional[List[List[Dict]]] = None) -> Dict[str, Any]:
        """发送消息，支持内联键盘"""
        # 检查是否为测试模式或占位符chat_id
        if (self.config.get('test_mode', False) or 
            chat_id == "PLACEHOLDER_CHAT_ID" or 
            chat_id.startswith("@test_")):
            
            self.logger.info(f"🧪 测试模式 - 模拟Telegram消息发送: {chat_id}")
            if inline_keyboard:
                self.logger.info(f"🧪 测试模式 - 内联键盘: {inline_keyboard}")
            return {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'message_id': 999999,
                'test_mode': True
            }
        
        try:
            url = f"{self.config['api_base_url']}{self.config['bot_token']}/sendMessage"
            
            payload = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': parse_mode
            }
            
            # 添加内联键盘
            if inline_keyboard:
                payload['reply_markup'] = {
                    'inline_keyboard': inline_keyboard
                }
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            result = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'message_id': response.json().get('result', {}).get('message_id')
            }
            
            self.logger.info(f"[SUCCESS] Telegram消息发送成功: {chat_id}")
            return result
            
        except Exception as e:
            result = {
                'status': 'failed',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'error': str(e)
            }
            
            self.logger.error(f"[ERROR] Telegram消息发送失败: {chat_id} -> {str(e)}")
            return result
    
    def answer_callback_query(self, callback_query_id: str, text: str = "", show_alert: bool = False) -> Dict[str, Any]:
        """回答回调查询"""
        try:
            url = f"{self.config['api_base_url']}{self.config['bot_token']}/answerCallbackQuery"
            
            payload = {
                'callback_query_id': callback_query_id,
                'text': text,
                'show_alert': show_alert
            }
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            result = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'callback_query_id': callback_query_id
            }
            
            self.logger.info(f"[SUCCESS] 回调查询回答成功: {callback_query_id}")
            return result
            
        except Exception as e:
            result = {
                'status': 'failed',
                'timestamp': datetime.now().isoformat(),
                'callback_query_id': callback_query_id,
                'error': str(e)
            }
            
            self.logger.error(f"[ERROR] 回调查询回答失败: {callback_query_id} -> {str(e)}")
            return result
    
    def send_document(self, chat_id: str, file_path: str, caption: str = "") -> Dict[str, Any]:
        """发送文件"""
        try:
            url = f"{self.config['api_base_url']}{self.config['bot_token']}/sendDocument"
            
            with open(file_path, 'rb') as file:
                files = {'document': file}
                data = {
                    'chat_id': chat_id,
                    'caption': caption,
                    'parse_mode': 'HTML'
                }
                
                response = requests.post(url, files=files, data=data)
                response.raise_for_status()
            
            result = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'file_path': file_path,
                'message_id': response.json().get('result', {}).get('message_id')
            }
            
            self.logger.info(f"[SUCCESS] Telegram文件发送成功: {file_path} -> {chat_id}")
            return result
            
        except Exception as e:
            result = {
                'status': 'failed',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'file_path': file_path,
                'error': str(e)
            }
            
            self.logger.error(f"[ERROR] Telegram文件发送失败: {file_path} -> {str(e)}")
            return result
    
    def create_bill_notification(self, merchant_name: str, merchant_data: Dict[str, Any]) -> str:
        """创建账单通知消息（中英双语）"""
        return BilingualTemplates.format_telegram_bill_notification(merchant_name, merchant_data)
    
    def send_bill_notification(self, merchant_name: str, merchant_data: Dict[str, Any],
                             pdf_path: str, chat_type: str = "finance") -> List[Dict[str, Any]]:
        """发送账单通知到指定群组"""
        results = []
        
        # 选择聊天群组
        if chat_type == "finance":
            chat_id = self.config['finance_chat_id']
        elif chat_type == "reconciliation":
            chat_id = self.config['reconciliation_chat_id']
        else:
            chat_id = chat_type  # 直接使用提供的chat_id
        
        if not chat_id:
            return [{
                'status': 'failed',
                'error': f'未配置{chat_type}群组ID',
                'timestamp': datetime.now().isoformat()
            }]
        
        # 发送通知消息
        message = self.create_bill_notification(merchant_name, merchant_data)
        message_result = self.send_message(chat_id, message)
        results.append(message_result)
        
        # 发送PDF文件
        if os.path.exists(pdf_path):
            template = BilingualTemplates.get_telegram_bill_send_template()
            caption = template['caption_template'].format(merchant_name=merchant_name)
            file_result = self.send_document(chat_id, pdf_path, caption)
            results.append(file_result)
        
        return results