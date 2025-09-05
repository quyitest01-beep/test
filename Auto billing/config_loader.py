#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一配置加载器
从 .env 文件加载所有配置，替代分散的配置文件
"""

import os
from dotenv import load_dotenv
from typing import Dict, Any, Optional

class ConfigLoader:
    """统一配置加载器"""
    
    def __init__(self):
        """初始化配置加载器"""
        load_dotenv()
        self._config = {}
        self._load_all_configs()
    
    def _load_all_configs(self):
        """加载所有配置"""
        # Lark 配置
        self._config['lark'] = {
            'app_id': os.getenv('LARK_APP_ID', ''),
            'app_secret': os.getenv('LARK_APP_SECRET', ''),
            'group_id': os.getenv('LARK_GROUP_ID', ''),
            'api_base_url': 'https://open.larksuite.com/open-apis',
            'spreadsheet_token': os.getenv('LARK_SPREADSHEET_TOKEN', ''),
            'sheet_id': os.getenv('LARK_SHEET_ID', ''),
            'spreadsheet_token2': os.getenv('LARK_SPREADSHEET_TOKEN2', ''),
            'sheet_id2': os.getenv('LARK_SHEET_ID2', ''),
            'chat_id': os.getenv('chat_id', '')
        }
        
        # 邮件配置（发送）
        self._config['email_send'] = {
            'smtp_server': os.getenv('EMAIL_HOST', 'smtp.gmail.com'),
            'smtp_port': int(os.getenv('EMAIL_PORT_PUT', '465')), # SMTP端口
            'username': os.getenv('EMAIL_USER', ''),
            'password': os.getenv('EMAIL_PASSWORD_PUT', ''),
            'from_email': os.getenv('EMAIL_USER', ''),
            'from_name': 'Gaming Panda Finance'
        }
        
        # 邮件配置（接收）
        self._config['email_receive'] = {
            'server': os.getenv('EMAIL_SERVER', 'imap.gmail.com'),
            'port': int(os.getenv('EMAIL_PORT_IN', '993')),  # IMAP端口
            'username': os.getenv('EMAIL_USERNAME', ''),
            'password': os.getenv('EMAIL_PASSWORD_IN', ''),
            'folder': os.getenv('EMAIL_FOLDER', 'INBOX')
        }
        
        # Telegram 配置
        self._config['telegram'] = {
            'bot_token': os.getenv('TELEGRAM_BOT_TOKEN', ''),
            'api_base_url': 'https://api.telegram.org/bot'
        }
        
        # 目标月份配置
        self._config['target'] = {
            'yyyy_mm': os.getenv('TARGET_YYYYMM', ''),
            'year': os.getenv('TARGET_YYYY', ''),
            'month': os.getenv('TARGET_MM', '')
        }
    
    def get_lark_config(self) -> Dict[str, Any]:
        """获取Lark配置"""
        return self._config['lark']
    
    def get_email_send_config(self) -> Dict[str, Any]:
        """获取邮件发送配置"""
        return self._config['email_send']
    
    def get_email_receive_config(self) -> Dict[str, Any]:
        """获取邮件接收配置"""
        return self._config['email_receive']
    
    def get_telegram_config(self) -> Dict[str, Any]:
        """获取Telegram配置"""
        return self._config['telegram']
    
    def get_target_config(self) -> Dict[str, Any]:
        """获取目标月份配置"""
        return self._config['target']
    
    def get_all_config(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config
    
    def validate_config(self) -> Dict[str, bool]:
        """验证配置完整性"""
        validation = {
            'lark': bool(self._config['lark']['app_id'] and self._config['lark']['app_secret']),
            'email_send': bool(self._config['email_send']['username'] and self._config['email_send']['password']),
            'email_receive': bool(self._config['email_receive']['username'] and self._config['email_receive']['password']),
            'telegram': bool(self._config['telegram']['bot_token']),
            'target': bool(self._config['target']['yyyy_mm'])
        }
        return validation
    
    def print_config_status(self):
        """打印配置状态"""
        print("=== 配置状态检查 ===")
        validation = self.validate_config()
        
        for config_type, is_valid in validation.items():
            status = "✅" if is_valid else "❌"
            print(f"{status} {config_type.upper()}: {'配置完整' if is_valid else '配置不完整'}")
        
        print("\n=== 详细配置信息 ===")
        for config_type, config in self._config.items():
            print(f"\n{config_type.upper()}:")
            for key, value in config.items():
                if 'password' in key.lower() or 'secret' in key.lower() or 'token' in key.lower():
                    display_value = '已设置' if value else '未设置'
                else:
                    display_value = value
                print(f"  {key}: {display_value}")

# 全局配置实例
config = ConfigLoader()

def get_config() -> ConfigLoader:
    """获取全局配置实例"""
    return config
