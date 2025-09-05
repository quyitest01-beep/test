import os
import requests

# 1. 配置
APP_ID = "cli_a698dd91f9a15010"
APP_SECRET = "yr5RJYKTFzevhnBYxGK7DedhBv4QSyzt"
FOLDER_PATH = r"C:\Users\poonw\Desktop\labubu mines"
UPLOAD_URL = "https://r2-upload.pre-release.xyz/upload"
LARK_SHEET_TOKEN = "JsPEsAfAQhyzHqtE29wlRSKfgEb"
LARK_SHEET_ID = "895008"

# 2. 获取 tenant_access_token
def get_tenant_access_token(app_id, app_secret):
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/"
    resp = requests.post(url, json={"app_id": app_id, "app_secret": app_secret})
    resp.raise_for_status()
    return resp.json()["tenant_access_token"]

# 3. 登录并上传图片
def upload_image(filepath):
    session = requests.Session()
    # 登录
    login_resp = session.post(
        "https://r2-upload.pre-release.xyz/login",
        json={"username": "admin", "password": "Admin@123456"}
    )
    login_resp.raise_for_status()
    # 上传
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        upload_resp = session.post(UPLOAD_URL, files=files)
    upload_resp.raise_for_status()
    url = upload_resp.json().get("url") or upload_resp.json().get("data", {}).get("url")
    return url

# 4. 图片名与列的映射
name_to_col = {
    "icon": "L",
    "cover": "M",
    "card": "N",
    "heroImageFg": "P",
    "heroImageBg": "Q",
    "heroImageMobile": "R",
    "screenshots1": "S",
    "screenshots2": "S",
    "screenshots3": "S",
}

def main():
    # 1. 上传所有图片
    urls = {}
    screenshots = []
    for fname in os.listdir(FOLDER_PATH):
        name, ext = os.path.splitext(fname)
        if name in name_to_col:
            print(f"正在上传: {fname}")
            url = upload_image(os.path.join(FOLDER_PATH, fname))
            print(f"上传成功: {url}")
            if name.startswith("screenshots"):
                screenshots.append(url)
            else:
                urls[name_to_col[name]] = url
    urls["S"] = ",".join(screenshots)

    # 2. 获取token
    token = get_tenant_access_token(APP_ID, APP_SECRET)
    headers = {"Authorization": f"Bearer {token}"}

    # 3. 获取表格列ID
    meta_url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{LARK_SHEET_TOKEN}/sheets/{LARK_SHEET_ID}/"
    meta_resp = requests.get(meta_url, headers=headers)
    meta_resp.raise_for_status()
    columns = meta_resp.json()["data"]["sheet"]["column_list"]
    col_map = {col["column_name"]: col["column_id"] for col in columns}

    # 4. 构造插入数据
    insert_data = []
    for col in ["L", "M", "N", "P", "Q", "R", "S"]:
        insert_data.append({
            "column_id": col_map[col],
            "value": urls.get(col, "")
        })

    # 5. 插入新行（在第2行后插入）
    insert_url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{LARK_SHEET_TOKEN}/sheets/{LARK_SHEET_ID}/rows"
    insert_resp = requests.post(
        insert_url,
        headers=headers,
        json={
            "index": 2,  # 在第2行后插入
            "rows": [{"values": insert_data}]
        }
    )
    print("插入结果：", insert_resp.json())

if __name__ == "__main__":
    main() 