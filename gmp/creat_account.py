import requests
import pandas as pd

# 设置基础 URL
admin_url = "https://openplatform.pre-release.xyz/dev_manage/trader_manage"
merchant_url = "https://developerplatform.pre-release.xyz/project_manage"

# 登录信息（如果需要的话）
login_payload = {
    'username': 'admin',
    'password': '12345678',
}

# 提交登录请求（如果有的话）
session = requests.Session()
login_response = session.post('https://admin.gaming-panda.net/login', data=login_payload)

# 批量账号创建功能
def create_account(account_info):
    # 如果钱包类型为 'transfer'，则设置为空值字段
    payload = {
        'merchant_name': account_info['merchant_name'],
        'username': account_info['username'],
        'password': account_info['password'],
        'wallet_type': account_info['wallet_type'],
        'supported_currencies': ','.join(account_info['supported_currencies']),  # 支持多个货币
        'developer_status': account_info.get('developer_status', ''),  # 如果没有提供，设置为空
        'notes': account_info.get('notes', ''),  # 如果没有提供，设置为空
        'callback_url': account_info.get('callback_url', ''),  # 如果没有提供，设置为空
    }
    response = session.post(admin_url, data=payload)
    if response.status_code == 200 and 'success' in response.text.lower():
        print(f"Account {account_info['username']} created successfully.")
        return True
    else:
        print(f"Failed to create account {account_info['username']}.")
        return False

# 配置游戏权限
def configure_game_permissions(account_username):
    game_permissions_url = f"{admin_url}/configure_permissions"
    payload = {
        'username': account_username,
        'permissions': 'inhouse',
    }
    response = session.post(game_permissions_url, data=payload)
    return response.status_code == 200

# 自动登录并获取 MerchantID, Secret, URL
def get_merchant_info(account_username):
    login_payload = {
        'username': account_username,
        'password': 'account_password',  # Replace with actual account password
    }
    response = session.post(merchant_url, data=login_payload)
    if response.status_code == 200:
        # 解析响应数据（假设返回 JSON 或者 HTML 结构，依据实际情况调整）
        merchant_info = {
            'MerchantID': 'extracted_merchant_id',
            'Secret': 'extracted_secret',
            'Url': 'extracted_url',
        }
        return merchant_info
    else:
        print(f"Failed to login to merchant account {account_username}.")
        return None

# 主函数，批量创建账号并配置权限
def create_and_configure_accounts(account_data_file):
    try:
        account_data = pd.read_csv(account_data_file, encoding='ISO-8859-1', on_bad_lines='skip')
    except UnicodeDecodeError:
        print("Error: The file encoding could not be processed. Try a different encoding.")
        return

    # 打印前几行，帮助确认内容
    print("CSV Content Preview:")
    print(account_data.head())  # 查看前5行数据

    for index, row in account_data.iterrows():
        account_info = row.to_dict()

        if 'wallet_type' not in account_info:
            print(f"Warning: 'wallet_type' not found in row {index}. Skipping this row.")
            continue

        if account_info['wallet_type'] == 'transfer':
            account_info['developer_status'] = ''
            account_info['notes'] = ''
            account_info['callback_url'] = ''

        if create_account(account_info):
            configure_game_permissions(account_info['username'])
            merchant_info = get_merchant_info(account_info['username'])
            if merchant_info:
                print(f"Merchant info for {account_info['username']}: {merchant_info}")
            else:
                print(f"Failed to get merchant info for {account_info['username']}.")


if __name__ == "__main__":
    # 提供批量操作的文件路径（如 CSV）
    create_and_configure_accounts('accounts_to_create.csv')
