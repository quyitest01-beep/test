#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
步骤2：从邮箱拉取指定月份的邮件附件
根据 TARGET_YYYYMM 环境变量拉取对应月份的数据
生成 matched_merchant_excel_data_*.json 文件
"""

import os
import sys
import json
import imaplib
import email
import pandas as pd
import socket
from datetime import datetime, date
from email.header import decode_header
import glob
from dotenv import load_dotenv

def get_target_month():
    """获取目标月份"""
    target_yyyymm = os.environ.get('TARGET_YYYYMM')
    if not target_yyyymm:
        print("[ERROR] 未设置 TARGET_YYYYMM 环境变量")
        print("[INFO] 请设置环境变量，例如: TARGET_YYYYMM=202507")
        sys.exit(1)
    
    if len(target_yyyymm) != 6 or not target_yyyymm.isdigit():
        print(f"[ERROR] TARGET_YYYYMM 格式错误: {target_yyyymm}")
        print("[INFO] 正确格式: YYYYMM (例如: 202507)")
        sys.exit(1)
    
    year = target_yyyymm[:4]
    month = target_yyyymm[4:6]
    period_cn = f"{year}年{month}月"
    
    print(f"[INFO] 目标月份: {period_cn} ({target_yyyymm})")
    return target_yyyymm, year, month, period_cn

def connect_email():
    """连接邮箱"""
    print("[INFO] 正在连接邮箱...")
    
    # 使用统一配置加载器
    from config_loader import get_config
    email_config = get_config().get_email_receive_config()
    email_config['use_ssl'] = True  # 默认使用SSL
    
    # 检查必要的配置
    if not email_config['username'] or not email_config['password']:
        print("[ERROR] 邮箱配置不完整，请检查 .env 文件")
        print("[INFO] 需要配置以下环境变量：")
        print("  EMAIL_SERVER - 邮箱服务器地址")
        print("  EMAIL_PORT_IN - 邮箱端口")
        print("  EMAIL_USERNAME - 邮箱用户名")
        print("  EMAIL_PASSWORD_IN - 邮箱密码或应用专用密码")
        print("  EMAIL_FOLDER - 邮箱文件夹 (默认: INBOX)")
        print(f"[DEBUG] 当前配置: username={email_config['username']}, password={'***' if email_config['password'] else 'None'}")
        return None
    
    try:
        # 连接到邮箱服务器
        if email_config['use_ssl']:
            mail = imaplib.IMAP4_SSL(email_config['server'], email_config['port'])
            mail.sock.settimeout(30)  # 设置连接超时
        else:
            mail = imaplib.IMAP4(email_config['server'], email_config['port'])
        
        mail.login(email_config['username'], email_config['password'])
        mail.sock.settimeout(30)  # 设置30秒超时
        print("[SUCCESS] 邮箱连接成功")
        return mail, email_config
    except Exception as e:
        print(f"[ERROR] 邮箱连接失败: {str(e)}")
        print("[INFO] 请检查邮箱配置信息")
        return None

def _imap_date(y: int, m: int, d: int) -> str:
    """构造 IMAP 要求的日期格式: DD-Mon-YYYY（英文月份缩写）"""
    return date(y, m, d).strftime("%d-%b-%Y")


def _normalize_subject(text: str) -> str:
    """标准化邮件主题：去常见前缀、统一破折号与空白。"""
    if not text:
        return ''
    s = text.strip()
    # 去常见回复/转发前缀
    for prefix in [
        'Re:', 'RE:', 'Fw:', 'FW:', 'Fwd:', 'FWD:', '转发：', '转发:', '回复：', '回复:'
    ]:
        if s.startswith(prefix):
            s = s[len(prefix):].strip()
    # 统一破折号
    for dash in ['—', '–', '−', '—', '―']:
        s = s.replace(dash, '-')
    # 多空白压缩为单空格
    s = ' '.join(s.split())
    return s


def search_monthly_emails(mail, year, month, email_config, period_cn: str):
    """在目标月份内，按标题优先规则选择一封最新邮件。
    规则：标题为【即时】月度详细汇总报表 - YYYY年MM月 或【定时】月度详细汇总报表 - YYYY年MM月；
    若两者都存在取日期(内部时间)最新的一封。
    返回：单个最佳 message id（bytes），无则返回 None。
    """
    print(f"[INFO] 搜索 {year}年{month}月 的邮件并按标题筛选...")
    import re
    # 构建搜索条件（IMAP 使用英文月份缩写，例如 01-Aug-2025）
    y = int(year)
    m = int(month)
    next_y = y + 1 if m == 12 else y
    next_m = 1 if m == 12 else m + 1
    
    # 搜索范围：下月1号到当天
    from datetime import datetime
    today = datetime.now()
    current_day = today.day
    
    since_s = _imap_date(next_y, next_m, 1)        # 下月1号
    before_s = _imap_date(next_y, next_m, current_day + 1)  # 下月当天+1（BEFORE是开区间）
    search_criteria = f'(SINCE "{since_s}" BEFORE "{before_s}")'

    try:
        print(f"[INFO] 选中邮箱文件夹: {email_config['folder']}")
        mail.select(email_config['folder'])
        status, message_numbers = mail.search(None, search_criteria)
        if status != 'OK':
            print("[ERROR] 邮件搜索失败")
            return None

        message_list = message_numbers[0].split()
        print(f"[INFO] 搜索条件: {search_criteria}")
        print(f"[INFO] 找到 {len(message_list)} 封候选邮件，开始按标题匹配...")

        # 标题关键字与当期中文期间
        # 标题匹配：容忍额外空格/不同破折号/前后缀，核心锚点为“【即时|定时】月度详细汇总报表 - {period_cn}”
        title_pattern = re.compile(rf'【(即时|定时)】\s*月度详细汇总报表\s*[-]\s*{re.escape(period_cn)}')

        best_id = None
        best_ts = None
        best_subject = None
        # 从后往前遍历，优先选择最新的邮件
        for mid in reversed(message_list):
            try:
                # 仅抓取主题，简化请求
                typ, data = mail.fetch(mid, '(BODY.PEEK[HEADER.FIELDS (SUBJECT)])')
                if typ != 'OK' or not data:
                    continue
                
                subj_raw = b''
                for part in data:
                    if isinstance(part, tuple):
                        chunk = part[1]
                        if b'Subject:' in chunk:
                            subj_raw = chunk
                
                # 解码与标准化主题
                from email.header import decode_header
                subject = ''
                if subj_raw:
                    try:
                        header_line = subj_raw.decode(errors='ignore')
                        subject_value = header_line.split(':', 1)[-1].strip()
                        dh = decode_header(subject_value)
                        subject = ''.join([(t[0].decode(t[1] or 'utf-8') if isinstance(t[0], bytes) else str(t[0])) for t in dh])
                        subject = _normalize_subject(subject)
                    except Exception:
                        subject = ''

                matched = bool(title_pattern.match(subject))
                print(f"[DEBUG] 邮件: id={mid.decode()}, matched={matched}, subject={subject}")
                
                if matched:
                    # 找到第一个匹配的邮件（由于是倒序遍历，这就是最新的）
                    best_id = mid
                    best_subject = subject
                    break
                    
            except (socket.timeout, OSError) as e:
                print(f"[WARNING] 邮件 {mid} 获取超时或网络错误: {e}")
                continue
            except Exception:
                continue

        if best_id:
            print(f"[SUCCESS] 命中最新邮件: id={best_id.decode()}, subject={best_subject}")
        else:
            print("[WARNING] 未命中符合标题规则的邮件")
        return best_id

    except Exception as e:
        print(f"[ERROR] 邮件搜索异常: {str(e)}")
        return None

def download_attachments(mail, best_message_id, target_month):
    """下载目标邮件的指定附件（YYYYMM_merchant_provider_currency(_1).xlsx）"""
    print("[INFO] 开始下载目标邮件的附件...")
    import re
    attachments = []
    if not best_message_id:
        return attachments

    for num in [best_message_id]:
        try:
            status, msg_data = mail.fetch(num, '(RFC822)')
            if status != 'OK':
                continue
            
            email_body = msg_data[0][1]
            email_message = email.message_from_bytes(email_body)
            
            # 获取邮件主题
            subject = decode_header(email_message["subject"])[0][0]
            if isinstance(subject, bytes):
                subject = subject.decode()
            
            print(f"[INFO] 处理邮件: {subject}")
            
            # 检查附件
            for part in email_message.walk():
                if part.get_content_maintype() == 'multipart':
                    continue
                
                # 兼容不同邮件服务：优先 filename，其次 Content-Type; name
                filename = part.get_filename()
                if not filename:
                    try:
                        filename = part.get_param('name', header='content-type')
                    except Exception:
                        filename = None
                if filename:
                    # 兼容 RFC2047/RFC2231 编码的附件名（避免局部变量遮蔽）
                    if isinstance(filename, bytes):
                        try:
                            filename = filename.decode('utf-8')
                        except Exception:
                            filename = filename.decode(errors='ignore')
                    else:
                        try:
                            # 有些实现会返回形如 '=?utf-8?...?='
                            dh = decode_header(filename)
                            filename = ''.join([(t[0].decode(t[1] or 'utf-8') if isinstance(t[0], bytes) else str(t[0])) for t in dh])
                        except Exception:
                            filename = str(filename)

                    original_filename = filename
                    filename_norm = filename.strip().replace(' ', '')
                    filename_norm_lower = filename_norm.lower()
                    
                    # 仅接收符合命名的Excel附件（更宽松：支持 *_1.xlsx / *_2.xlsx / ... / 无后缀编号）
                    prefix = f"{target_month}_merchant_provider_currency".replace(' ', '').lower()
                    is_target = (
                        filename_norm_lower == f"{prefix}.xlsx" or
                        (filename_norm_lower.startswith(prefix + "_") and filename_norm_lower.endswith('.xlsx'))
                    )

                    print(f"[DEBUG] 附件候选: {original_filename}")
                    if is_target:
                        print(f"[INFO] 找到Excel附件: {filename}")
                        
                        # 保存附件
                        attachment_path = f"temp_{target_month}_{filename}"
                        with open(attachment_path, 'wb') as f:
                            f.write(part.get_payload(decode=True))
                        
                        attachments.append({
                            'filename': filename,
                            'path': attachment_path,
                            'subject': subject
                        })
                    else:
                        print(f"[DEBUG] 非目标附件，已忽略: {original_filename}")
        
        except Exception as e:
            print(f"[WARNING] 处理邮件 {num} 失败: {str(e)}")
            continue
    
    print(f"[INFO] 共下载 {len(attachments)} 个Excel附件")
    return attachments

def process_excel_files(attachments, target_month, period_cn):
    """处理Excel文件，提取账单数据（按主商户聚合，生成 sub_merchants/currencies 结构）"""
    print("[INFO] 开始处理Excel文件...")
    
    all_merchant_data: dict = {}
    
    def norm_col(name: str) -> str:
        return str(name).strip().replace('\u3000', '').replace(' ', '').lower()
    
    for attachment in attachments:
        try:
            file_path = attachment['path']
            print(f"[INFO] 处理文件: {attachment['filename']}")
            
            # 读取Excel文件
            df = pd.read_excel(file_path, engine='openpyxl')
            
            # 映射列
            columns = df.columns.tolist()
            print(f"[INFO] Excel列名: {columns}")
            col_map = {norm_col(c): c for c in columns}
            required = {
                '商户名': None,
                '厂商': None,
                '货币': None,
                'usd汇率': None,
                '总投注': None,
                '总派奖': None,
                'ggr': None,
                'ggr-usd': None,
            }
            for k in list(required.keys()):
                key_norm = norm_col(k)
                # 兼容大小写/符号差异
                for cand in col_map.keys():
                    if key_norm in cand:
                        required[k] = col_map[cand]
                        break
            missing = [k for k, v in required.items() if v is None and k in ['商户名','厂商','货币']]
            if missing:
                print(f"[WARNING] 缺少必要列: {missing}，跳过该文件")
                os.remove(file_path)
                continue
            
            # 行遍历
            for _, row in df.iterrows():
                merchant_name = str(row.get(required['商户名'], '')).strip()
                provider = str(row.get(required['厂商'], '')).strip()
                currency = str(row.get(required['货币'], '')).strip()
                
                # 数据过滤：只处理厂商=gp或popular且商户名≠demo的数据
                if not merchant_name or not currency:
                    continue
                if provider.lower() not in ['gp', 'popular']:
                    continue
                if merchant_name.lower() == 'demo':
                    continue
                
                # 数值列
                def fget(col):
                    try:
                        v = row.get(col, 0)
                        return float(v) if pd.notna(v) else 0.0
                    except Exception:
                        return 0.0
                usd_rate = fget(required['usd汇率'])
                total_bet = fget(required['总投注'])
                total_prize = fget(required['总派奖'])
                ggr = fget(required['ggr'])
                ggr_usd = fget(required['ggr-usd'])
                
                # 组织为 sub_merchants/currencies 结构
                merchant_bucket = all_merchant_data.setdefault(merchant_name, {
                    'sub_merchants': [],
                    'fee': 0.0,
                })
                # 以 provider+merchant_name 作为子商户分组键
                sub_key = f"{provider}::{merchant_name}"
                sub_obj = None
                for sm in merchant_bucket['sub_merchants']:
                    if sm.get('_k') == sub_key:
                        sub_obj = sm
                        break
                if sub_obj is None:
                    sub_obj = {
                        '_k': sub_key,
                        'merchant_name': merchant_name,
                        'provider': provider,
                        'currencies': []
                    }
                    merchant_bucket['sub_merchants'].append(sub_obj)
                sub_obj['currencies'].append({
                    'currency': currency,
                    'total_bet': total_bet,
                    'total_prize': total_prize,
                    'net_win': ggr,
                    'usd_rate': usd_rate if usd_rate else 1.0,
                    'charge_usdt': ggr_usd,
                })
            
            # 删除临时文件
            os.remove(file_path)
            
        except Exception as e:
            print(f"[ERROR] 处理文件 {attachment['filename']} 失败: {str(e)}")
            continue
    
    # 生成输出文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f'matched_merchant_excel_data_{target_month}_{timestamp}.json'
    
    # 保存数据
    output_data = {
        'period': period_cn,
        'target_month': target_month,
        'timestamp': timestamp,
        'total_merchants': len(all_merchant_data),
        'merchant_data': all_merchant_data
    }
    
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"[SUCCESS] Excel数据处理完成，共 {len(all_merchant_data)} 个商户")
    print(f"[SUCCESS] 数据已保存到: {output_filename}")
    
    return output_filename

def main():
    print("[INFO] 开始从邮箱拉取邮件附件...")
    
    try:
        # 获取目标月份
        target_month, year, month, period_cn = get_target_month()
        
        # 连接邮箱
        result = connect_email()
        if not result:
            return 1
        
        mail, email_config = result
        
        try:
            # 搜索并选取当月最佳邮件
            best_message_id = search_monthly_emails(mail, year, month, email_config, period_cn)
            if not best_message_id:
                print(f"[WARNING] 未找到 {period_cn} 的邮件")
                return 0
            
            # 下载附件
            attachments = download_attachments(mail, best_message_id, target_month)
            if not attachments:
                print(f"[WARNING] 未找到 {period_cn} 的Excel附件")
                return 0
            
            # 处理Excel文件
            output_file = process_excel_files(attachments, target_month, period_cn)
            
            print(f"[SUCCESS] 步骤2完成，输出文件: {output_file}")
            return 0
            
        finally:
            mail.close()
            mail.logout()
        
    except Exception as e:
        print(f"[ERROR] 邮箱附件拉取失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())