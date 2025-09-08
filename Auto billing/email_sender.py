import smtplib
import json
import os
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.application import MIMEApplication
from email import encoders
from email.utils import formataddr
import urllib.parse
from typing import List, Dict, Any, Optional
import logging
from config_loader import get_config
from bilingual_templates import BilingualTemplates

class EmailSender:
    """邮件发送器 - 支持HTML正文、多收件人、附件"""
    
    def __init__(self):
        self.config = get_config().get_email_send_config()
        self.setup_logging()
        
    
    def setup_logging(self):
        """设置日志"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('email_logs.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def create_internal_confirmation_email(self, merchant_data: Dict[str, Any], 
                                         confirmation_url: str) -> str:
        """创建内部确认邮件HTML内容（中英双语）"""
        return BilingualTemplates.format_email_internal_confirmation(merchant_data, confirmation_url)
    
    def create_customer_email(self, merchant_name: str, merchant_data: Dict[str, Any]) -> str:
        """创建客户邮件HTML内容（中英双语）"""
        return BilingualTemplates.format_email_customer_bill(merchant_name, merchant_data)
    
    def send_email(self, to_emails: List[str], subject: str, html_content: str, 
                   attachments: List[str] = None, cc_emails: List[str] = None) -> Dict[str, Any]:
        """发送邮件"""
        try:
            # 创建邮件对象
            msg = MIMEMultipart()
            msg['From'] = f"{self.config['from_name']} <{self.config['from_email']}>"
            msg['To'] = ', '.join(to_emails)
            if cc_emails:
                msg['Cc'] = ', '.join(cc_emails)
            msg['Subject'] = subject
            
            # 添加HTML正文
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
            
            # 添加附件
            if attachments:
                for file_path in attachments:
                    if os.path.exists(file_path):
                        with open(file_path, 'rb') as attachment:
                            filename = os.path.basename(file_path)
                            file_data = attachment.read()
                            
                            # 根据文件扩展名设置正确的MIME类型
                            if filename.lower().endswith('.pdf'):
                                part = MIMEApplication(file_data, _subtype='pdf')
                                part.add_header('Content-Type', 'application/pdf')
                            elif filename.lower().endswith(('.jpg', '.jpeg')):
                                part = MIMEBase('image', 'jpeg')
                                part.set_payload(file_data)
                                encoders.encode_base64(part)
                            elif filename.lower().endswith('.png'):
                                part = MIMEBase('image', 'png')
                                part.set_payload(file_data)
                                encoders.encode_base64(part)
                            else:
                                part = MIMEBase('application', 'octet-stream')
                                part.set_payload(file_data)
                                encoders.encode_base64(part)
                            
                            # 正确编码文件名，支持中文字符
                            encoded_filename = urllib.parse.quote(filename.encode('utf-8'))
                            part.add_header(
                                'Content-Disposition',
                                f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'
                            )
                            msg.attach(part)
            
            # 发送邮件
            if self.config['smtp_port'] == 465:
                # 飞书邮箱和其他使用465端口的邮箱需要SSL
                server = smtplib.SMTP_SSL(self.config['smtp_server'], self.config['smtp_port'])
            else:
                # 其他端口使用STARTTLS
                server = smtplib.SMTP(self.config['smtp_server'], self.config['smtp_port'])
                server.starttls()
            
            server.login(self.config['username'], self.config['password'])
            
            all_recipients = to_emails + (cc_emails or [])
            text = msg.as_string()
            server.sendmail(self.config['from_email'], all_recipients, text)
            server.quit()
            
            # 记录成功日志
            result = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'recipients': all_recipients,
                'subject': subject,
                'attachments': attachments or []
            }
            
            self.logger.info(f"[SUCCESS] 邮件发送成功: {subject} -> {', '.join(all_recipients)}")
            return result
            
        except Exception as e:
            # 记录失败日志
            result = {
                'status': 'failed',
                'timestamp': datetime.now().isoformat(),
                'recipients': to_emails + (cc_emails or []),
                'subject': subject,
                'error': str(e),
                'attachments': attachments or []
            }
            
            self.logger.error(f"[ERROR] 邮件发送失败: {subject} -> {str(e)}")
            return result
    
    def send_internal_confirmation(self, merchant_data: Dict[str, Any], 
                                 internal_emails: List[str],
                                 confirmation_url: str,
                                 cc_emails: List[str] = None,
                                 attachments: List[str] = None,
                                 summary_pdf: str = None) -> Dict[str, Any]:
        """发送内部确认邮件"""
        subject = f"[INFO] 月度账单内部确认 - {len(merchant_data)}个商户 - {datetime.now().strftime('%Y年%m月')}"
        html_content = self.create_internal_confirmation_email(merchant_data, confirmation_url)
        
        # 使用提供的附件，如果没有则使用summary_pdf
        if not attachments:
            attachments = []
            if summary_pdf and os.path.exists(summary_pdf):
                attachments.append(summary_pdf)
        
        return self.send_email(internal_emails, subject, html_content, attachments, cc_emails)
    
    def send_customer_bill(self, merchant_name: str, merchant_data: Dict[str, Any],
                          customer_emails: List[str]) -> Dict[str, Any]:
        """发送客户账单邮件（中英双语）"""
        # 使用双语模板生成邮件主题
        template = BilingualTemplates.get_email_customer_bill_template()
        period = datetime.now().strftime('%Y年%m月')
        subject = template['subject'].format(merchant_name=merchant_name, period=period)
        
        html_content = self.create_customer_email(merchant_name, merchant_data)
        
        # 准备附件
        pdf_path = f"invoice_pdfs/{merchant_name}_{period}_modified_invoice.pdf"
        attachments = [pdf_path] if os.path.exists(pdf_path) else []
        
        return self.send_email(customer_emails, subject, html_content, attachments)