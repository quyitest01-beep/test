import boto3
import time
import requests
import yagmail

# 1. 配置参数
aws_account_id = '034986963036'
dashboard_id = '20b8294f-9bcf-445a-b24b-3f8fa76eb776'
user_arn = 'arn:aws:quicksight:us-west-2:034986963036:user/default/gmp-records'
region = 'us-west-2'

# 2. 创建 QuickSight 客户端
client = boto3.client('quicksight', region_name=region)

# 3. 发起导出任务
response = client.start_dashboard_snapshot_job(
    AwsAccountId=aws_account_id,
    DashboardId=dashboard_id,
    SnapshotConfiguration={
        'FileGroups': [
            {
                'Files': [
                    {
                        'FormatType': 'PDF'
                    }
                ]
            }
        ]
    },
    UserConfiguration={
        'AnonymousUsers': []
    }
)
job_id = response['Arn'].split('/')[-1]

# 4. 轮询任务状态
while True:
    status_response = client.describe_dashboard_snapshot_job(
        AwsAccountId=aws_account_id,
        DashboardId=dashboard_id,
        SnapshotJobId=job_id
    )
    status = status_response['DashboardSnapshotJobStatus']
    if status == 'COMPLETED':
        break
    elif status == 'FAILED':
        raise Exception('导出失败')
    print('导出中，请稍候...')
    time.sleep(5)

# 5. 获取下载链接
files = status_response['DashboardSnapshotJobResult']['FileGroups'][0]['Files']
download_url = files[0]['Uri']

# 6. 下载 PDF 文件
pdf_file = 'dashboard.pdf'
r = requests.get(download_url)
with open(pdf_file, 'wb') as f:
    f.write(r.content)
print('PDF 已下载:', pdf_file)

# 7. 发送邮件到 Lark 邮箱
yag = yagmail.SMTP('poon@gaming-panda.com', '825278246p')
yag.send(
    to='poon@gaming-panda.com',
    subject='QuickSight日报',
    contents='见附件',
    attachments=pdf_file
)
print('邮件已发送到 Lark 邮箱')