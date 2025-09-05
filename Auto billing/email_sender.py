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
        """创建内部确认邮件HTML内容"""
        total_amount = sum(data.get('total_amount', 0) for data in merchant_data.values())
        merchant_count = len(merchant_data)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; }}
                .summary {{ background-color: #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px; }}
                .merchant-list {{ margin: 20px 0; }}
                .merchant-item {{ padding: 10px; border-bottom: 1px solid #dee2e6; }}
                .confirm-button {{ 
                    background-color: #28a745; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block; 
                    margin: 20px 0;
                }}
                .reject-button {{ 
                    background-color: #dc3545; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block; 
                    margin: 20px 10px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>[INFO] 月度账单内部确认</h2>
                <p>账单月份: 2025年07月</p>
                <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            
            <div class="summary">
                <h3>[INFO] 账单汇总</h3>
                <p><strong>商户数量:</strong> {merchant_count} 个</p>
                <p><strong>总应付金额:</strong> ${total_amount:,.2f} USD</p>
            </div>
            
            <div class="merchant-list">
                <h3>[EMOJI] 商户明细</h3>
        """
        
        for merchant_name, data in merchant_data.items():
            amount = data.get('total_amount', 0)
            sub_merchant_count = data.get('sub_merchant_count', 0)
            html_content += f"""
                <div class="merchant-item">
                    <strong>{merchant_name}</strong> - ${amount:,.2f} USD ({sub_merchant_count} 个子账户)
                </div>
            """
        
        html_content += f"""
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{confirmation_url}?action=confirm" class="confirm-button">[SUCCESS] 确认发送账单</a>
                <a href="{confirmation_url}?action=reject" class="reject-button">[ERROR] 拒绝发送</a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d;">
                <p><small>Gaming Panda | 财务系统自动生成</small></p>
                <p><small>若对账单存疑，可联系客服 | If you have any questions about the bill, please contact customer service.</small></p>
            </div>
        </body>
        </html>
        """
        
        return html_content
    
    def create_customer_email(self, merchant_name: str, merchant_data: Dict[str, Any]) -> str:
        """创建客户邮件HTML内容"""
        total_amount = merchant_data.get('total_amount', 0)
        sub_merchant_count = merchant_data.get('sub_merchant_count', 0)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }}
                .content {{ margin: 20px 0; }}
                .summary {{ background-color: #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>月度账单 Monthly Bill</h2>
                <p>www.gaming-panda.com</p>
            </div>
            
            <div class="content">
                <h3>尊敬的 {merchant_name} 客户，</h3>
                <p>您好！以下是您的月度账单详情：</p>
                
                <div class="summary">
                    <h4>[INFO] 账单信息</h4>
                    <p><strong>商户名称:</strong> {merchant_name}</p>
                    <p><strong>账单月份:</strong> 2025年07月</p>
                    <p><strong>子商户数:</strong> {sub_merchant_count}</p>
                    <p><strong>应付金额:</strong> ${total_amount:,.2f} USD</p>
                    <p><strong>生成日期:</strong> {datetime.now().strftime('%Y-%m-%d')}</p>
                </div>
                
                <p>请查看附件中的详细账单PDF文件。</p>
                <p>如有任何疑问，请及时联系我们。</p>
            </div>
            
            <div class="footer">
                <p>若对账单存疑，可联系客服</p>
                <p>If you have any questions about the bill, please contact customer service.</p>
                <p><strong>Gaming Panda | 汇款链接: TMuwXuWKd4az3KuYHZgssLj3WqvVSHyKfr</strong></p>
            </div>
        </body>
        </html>
        """
        
        return html_content
    
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
        """发送客户账单邮件"""
        subject = f"月度账单 Monthly Bill - {merchant_name} - {datetime.now().strftime('%Y年%m月')}"
        html_content = self.create_customer_email(merchant_name, merchant_data)
        
        # 准备附件
        pdf_path = f"invoice_pdfs/{merchant_name}_2025年07月_modified_invoice.pdf"
        attachments = [pdf_path] if os.path.exists(pdf_path) else []
        
        return self.send_email(customer_emails, subject, html_content, attachments)