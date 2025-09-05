import boto3

aws_account_id = '034986963036'
dashboard_id = '20b8294f-9bcf-445a-b24b-3f8fa76eb776'
region = 'us-west-2'

client = boto3.client('quicksight', region_name=region)

response = client.describe_dashboard(
    AwsAccountId=aws_account_id,
    DashboardId=dashboard_id
)

# 打印所有 sheet 的名称和ID
sheets = response['Dashboard']['Version']['Sheets']
for sheet in sheets:
    print(f"Sheet Name: {sheet['Name']}, Sheet ID: {sheet['SheetId']}")