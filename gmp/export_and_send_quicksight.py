import boto3
import time
import requests
import datetime
import os
from gmp.aws_config import (
    aws_config
)

# AWS 配置
aws_account_id = aws_config["aws_account_id"]
dashboard_id = aws_config["dashboard_id"]
region = aws_config["region"]
user_arn = aws_config["user_arn"]

# 1. 获取仪表盘 sheet 信息
client = boto3.client(
    'quicksight',
    region_name=region,
    aws_access_key_id=aws_config["aws_access_key_id"],
    aws_secret_access_key=aws_config["aws_secret_access_key"]
)
dashboard = client.describe_dashboard(
    AwsAccountId=aws_account_id,
    DashboardId=dashboard_id
)
sheets = dashboard['Dashboard']['Version']['Sheets']
sheet_selections = [
    {'SheetId': sheet['SheetId'], 'SelectionScope': 'ALL_VISUALS'} for sheet in sheets
]

# 2. 发起导出任务
print("sheet_selections:", sheet_selections)
try:
    response = client.start_dashboard_snapshot_job(
        AwsAccountId=aws_account_id,
        DashboardId=dashboard_id,
        SnapshotConfiguration={
            'FileGroups': [
                {
                    'Files': [
                        {
                            'FormatType': 'PDF',
                            'SheetSelections': sheet_selections
                        }
                    ]
                }
            ]
        },
        UserConfiguration={
            'AnonymousUsers': [
                {}
            ]
        }
    )
    print("API返回内容：", response)
    print("response类型：", type(response))
    job_id = response['JobId']
except Exception as e:
    print("start_dashboard_snapshot_job 调用异常：", e)
    import sys
    sys.exit(1)

# 3. 轮询导出任务状态
while True:
    try:
        job_status = client.describe_dashboard_snapshot_job(
            AwsAccountId=aws_account_id,
            DashboardId=dashboard_id,
            SnapshotJobId=job_id
        )
        status = job_status['DashboardSnapshotJobStatus']
        print("当前任务状态：", status)
        if status in ['COMPLETED', 'FAILED', 'CANCELLED']:
            break
        time.sleep(10)
    except Exception as e:
        print("describe_dashboard_snapshot_job 调用异常：", e)
        import sys
        sys.exit(1)

# 4. 获取导出文件下载链接并下载PDF
if status == 'COMPLETED':
    try:
        files = job_status['DashboardSnapshotJobResult']['FileGroups'][0]['Files']
        pdf_url = files[0]['Uri']
        print("PDF下载链接：", pdf_url)
        pdf_response = requests.get(pdf_url)
        pdf_filename = f"quicksight_dashboard_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        with open(pdf_filename, 'wb') as f:
            f.write(pdf_response.content)
        print("PDF已下载：", pdf_filename)
    except Exception as e:
        print("下载PDF异常：", e)
        import sys
        sys.exit(1)
else:
    print("导出失败，状态：", status)
    import sys
    sys.exit(1)