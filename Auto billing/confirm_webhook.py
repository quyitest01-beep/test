#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lark 确认/拒绝 回调服务
用法：python confirm_webhook.py --port 8787
"""

import argparse
import logging
import os
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler, HTTPServer

from confirm_handler import ConfirmHandler

# 配置日志
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'webhook.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ConfirmRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        client_ip = self.client_address[0]
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        logger.info(f"[{timestamp}] 收到请求 - IP: {client_ip}, Path: {self.path}")
        
        try:
            url = urlparse(self.path)
            if url.path != "/confirm":
                logger.warning(f"[{timestamp}] 无效路径: {url.path}")
                self._send(404, "Not Found")
                return

            qs = parse_qs(url.query)
            bid = (qs.get("bid") or [""])[0]
            action = (qs.get("action") or [""])[0]
            code = (qs.get("code") or [""])[0]

            logger.info(f"[{timestamp}] 解析参数 - bid: {bid}, action: {action}, code: {code}")

            if not bid or action not in ("confirm", "reject") or not code:
                logger.error(f"[{timestamp}] 参数缺失或无效 - bid: {bid}, action: {action}, code: {code}")
                self._send(400, "Bad Request: missing params")
                return

            logger.info(f"[{timestamp}] 开始处理{action}请求 - 批次ID: {bid}")
            
            handler = ConfirmHandler()
            # 将完整原始URL传入，以便沿用现有解析/校验逻辑
            full_url = f"http://{self.headers.get('Host')}{self.path}"
            ok = handler.handle_confirmation(full_url, apply=(action == "confirm"))

            if ok:
                msg = "确认已受理，正在发送..." if action == "confirm" else "已拒绝账单，本次不发送"
                logger.info(f"[{timestamp}] 处理成功 - {msg}")
                self._send(200, msg)
            else:
                logger.error(f"[{timestamp}] 处理失败 - 批次ID: {bid}")
                self._send(500, "处理失败，请查看日志")
        except Exception as e:
            logger.error(f"[{timestamp}] 服务器异常: {str(e)}", exc_info=True)
            self._send(500, f"Server Error: {e}")

    def log_message(self, format, *args):
        # 使用自定义日志记录
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"[{timestamp}] HTTP请求: {format % args}")

    def _send(self, code: int, text: str):
        body = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"[{timestamp}] 响应发送 - 状态码: {code}, 内容: {text}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    httpd = HTTPServer(("0.0.0.0", args.port), ConfirmRequestHandler)
    logger.info(f"Confirm webhook 启动成功 - 监听地址: http://127.0.0.1:{args.port}/confirm")
    print(f"[INFO] Confirm webhook listening on http://127.0.0.1:{args.port}/confirm")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在关闭服务...")
    finally:
        httpd.server_close()
        logger.info("回调服务已关闭")


if __name__ == "__main__":
    main()


