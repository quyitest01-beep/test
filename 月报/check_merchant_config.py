import pandas as pd
from sqlalchemy import create_engine, text

# 连接数据库
config = {
    'host': '192.168.16.46',
    'port': '3306',
    'user': 'root',
    'password': '123456',
    'database': 'merchant'
}
engine = create_engine(f'mysql+pymysql://{config["user"]}:{config["password"]}@{config["host"]}:{config["port"]}/{config["database"]}')

# 查询表结构
with engine.connect() as conn:
    result = conn.execute(text('DESCRIBE merchant_config')).fetchall()
    print('表结构:')
    for row in result:
        print(row)

# 查询前10行数据
print('\n前10行数据:')
df = pd.read_sql('SELECT * FROM merchant_config LIMIT 10', engine)
print(df)

# 检查是否有merchant_name字段
if 'merchant_name' in df.columns:
    print(f'\nmerchant_name字段非空值数量: {df["merchant_name"].notnull().sum()}')
    print(f'merchant_name字段空值数量: {df["merchant_name"].isnull().sum()}')
    print('merchant_name字段所有值:')
    print(df["merchant_name"].tolist())
    print('merchant_id字段所有值:')
    print(df["merchant_id"].tolist())
    
    # 检查是否有其他字段可以作为商户名称
    print('\n检查其他可能作为商户名称的字段:')
    for col in ['account', 'merchant_desc']:
        if col in df.columns:
            print(f'{col}字段示例值: {df[col].head().tolist()}')
else:
    print('\nmerchant_name字段不存在!')
    print('可用字段:', list(df.columns))