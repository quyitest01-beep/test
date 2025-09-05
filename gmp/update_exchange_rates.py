import json
import requests
import boto3
from aws_config import aws_config

# 读取 AWS 配置
aws_access_key_id = aws_config['aws_access_key_id']
aws_secret_access_key = aws_config['aws_secret_access_key']
region_name = aws_config['region']

# Athena 配置
ATHENA_DATABASE = 'gmp'
ATHENA_OUTPUT = 's3://gmp-gamehistory/QueryResult/'
VIEW_NAME = 'exchange_rates'

# 初始化 boto3 Athena 客户端
athena = boto3.client(
    'athena',
    region_name=region_name,
    aws_access_key_id=aws_access_key_id,
    aws_secret_access_key=aws_secret_access_key
)

def fetch_binance_rates():
    url = "https://api.binance.com/api/v3/ticker/price"
    resp = requests.get(url)
    resp.raise_for_status()
    data = resp.json()
    # 过滤只要USDT交易对，构造币种和价格
    rates = []
    for item in data:
        symbol = item['symbol']
        if symbol.endswith('USDT'):
            currency = symbol[:-4]  # 去掉USDT后缀
            price = item['price']
            rates.append((currency, price))
    return rates

def build_create_view_sql(rates):
    # 生成 CREATE OR REPLACE VIEW 语句
    selects = []
    for currency, price in rates:
        # Athena中视图用单引号包字符串
        selects.append(f"SELECT '{currency}' AS currency, {price} AS rate_to_usdt")
    union_all = " UNION ALL ".join(selects)
    sql = f"""
    CREATE OR REPLACE VIEW {ATHENA_DATABASE}.{VIEW_NAME} AS
    {union_all}
    """
    return sql

def run_athena_query(sql):
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': ATHENA_DATABASE},
        ResultConfiguration={'OutputLocation': ATHENA_OUTPUT}
    )
    query_execution_id = response['QueryExecutionId']
    print(f"Query started, execution ID: {query_execution_id}")
    return query_execution_id

def wait_for_query(query_execution_id):
    import time
    while True:
        res = athena.get_query_execution(QueryExecutionId=query_execution_id)
        state = res['QueryExecution']['Status']['State']
        if state in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
            print(f"Query finished with state: {state}")
            return state
        print("Waiting for query to finish...")
        time.sleep(2)

def main():
    rates = fetch_binance_rates()
    sql = build_create_view_sql(rates)
    print("Generated SQL for Athena view:")
    print(sql)
    qid = run_athena_query(sql)
    status = wait_for_query(qid)
    if status == 'SUCCEEDED':
        print(f"View {VIEW_NAME} updated successfully.")
    else:
        print("Failed to update view.")

if __name__ == "__main__":
    main()
