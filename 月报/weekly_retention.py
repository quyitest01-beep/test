import os, argparse, logging
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv  # 新增导入

# 加载.env配置（确保与脚本一致）
load_dotenv()

# 复用 weekly_billing 的配置与工具
from weekly_billing import (
    setup_logging,
    get_last_week_dates,
    get_week_range_string,
    ensure_directory_exists,
    get_game_mappings,
    get_game_name,
    normalize_id,
    EMAIL_CONFIG,
    DB_CONFIG,
    GMP_DB_CONFIG,
    MERCHANT_DB_CONFIG,
    EXPORT_DIR,
)

# 构建数据库引擎

def build_engine(cfg):
    return create_engine(
        f"mysql+pymysql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{cfg['port']}/{cfg['database']}?charset=utf8mb4",
        pool_pre_ping=True,
    )


def pick_column(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None


def read_day_records(engine, day, logger):
    # day: datetime.date
    date_str = day.strftime('%Y%m%d')
    tables = [f"user_game_record_{date_str}_0", f"user_game_record_{date_str}_1"]
    frames = []
    for t in tables:
        try:
            # 优先只取所需字段，若失败再退化为SELECT *
            sql = text(f"SELECT merchant, provider, game, uid FROM `{t}`")
            df = pd.read_sql(sql, engine)
        except Exception:
            try:
                df = pd.read_sql(text(f"SELECT * FROM `{t}`"), engine)
            except Exception as e:
                logger.warning(f"读取表 {t} 失败: {e}")
                continue
        # 统一字段名
        merchant_col = pick_column(df, ['merchant', 'merchant_id'])
        # 修正provider_id筛选与字段命名
        provider_col = pick_column(df, ['provider_id', 'provider'])
        game_col = pick_column(df, ['game', 'game_id'])
        uid_col = pick_column(df, ['uid', 'user_id'])
        if not all([merchant_col, game_col, uid_col]):
            logger.warning(f"表 {t} 缺少必要字段，已跳过。检测到列: {list(df.columns)[:10]}")
            continue
        # 选择实际列
        cols = [merchant_col, game_col, uid_col]
        if provider_col:
            cols.insert(1, provider_col)
        df = df[cols].copy()
        # 重命名
        rename_map = {merchant_col: 'merchant', game_col: 'game', uid_col: 'uid'}
        if provider_col:
            rename_map[provider_col] = 'provider_id'
        df.rename(columns=rename_map, inplace=True)
        # 仅保留gp/popular（provider_id=gp/popular，兼容字符串类型）
        if 'provider_id' in df.columns:
            df = df[df['provider_id'].isin(['gp', 'popular'])]
        else:
            logger.warning(f"{t} 无provider_id列，无法按gp/popular筛选，将包含全部记录。")
        # 标准化ID
        df['merchant'] = df['merchant'].map(normalize_id)
        df['game'] = df['game'].map(normalize_id)
        df['uid'] = df['uid'].astype(str).str.strip()
        df['day'] = day.strftime('%Y-%m-%d')  # 日期格式化为YYYY-MM-DD字符串
        frames.append(df[['merchant'] + (['provider_id'] if 'provider_id' in df.columns else []) + ['game', 'uid', 'day']])
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=['merchant','provider','game','uid','day'])


def build_merchant_map(logger):
    """获取商户映射字典，优先使用merchant_desc，其次account，最后merchant_id"""
    engine = build_engine(MERCHANT_DB_CONFIG)
    try:
        df = pd.read_sql(text("SELECT merchant_id, merchant_name, merchant_desc, account FROM merchant_config"), engine)
        df['merchant_id'] = df['merchant_id'].map(lambda x: str(x).strip())
        m = {}
        for _, row in df.iterrows():
            mid = str(row['merchant_id']).strip()
            if pd.notnull(row.get('merchant_desc')) and str(row['merchant_desc']).strip():
                m[mid] = str(row['merchant_desc']).strip()
            elif pd.notnull(row.get('account')) and str(row['account']).strip():
                m[mid] = str(row['account']).strip()
            else:
                m[mid] = mid
        logger.info(f"merchant_config 映射表行数: {len(df)}")
        if len(df) == 0:
            logger.warning("merchant_config表为空，商户名映射将使用原始ID！")
        return m
    except Exception as e:
        logger.error(f"读取 merchant_config 失败: {e}", exc_info=True)
        return {}

def get_game_mappings(gmp_engine, logger):
    """获取游戏映射字典，支持gp/popular厂商的特殊映射"""
    try:
        # 获取所有游戏的映射：id -> name, code -> name
        game_map_df = pd.read_sql("SELECT id, code, name FROM gmp_game_list", gmp_engine)
        game_map_df['id'] = game_map_df['id'].astype(str).str.strip()
        game_map_df['code'] = game_map_df['code'].astype(str).str.strip()
        game_map_df['name'] = game_map_df['name'].astype(str).str.strip()
        logger.info(f"gmp_game_list 映射表行数: {game_map_df.shape[0]}")
        game_id_to_name = dict(zip(game_map_df['id'], game_map_df['name']))
        game_code_to_name = dict(zip(game_map_df['code'], game_map_df['name']))
        
        # 获取gp厂商的特殊映射：id -> source_id -> game_name
        gp_merchant_game_df = pd.read_sql("SELECT id, source_id FROM gmp_merchant_game_list", gmp_engine)
        gp_merchant_game_df['id'] = gp_merchant_game_df['id'].astype(str).str.strip()
        gp_merchant_game_df['source_id'] = gp_merchant_game_df['source_id'].astype(str).str.strip()
        logger.info(f"gmp_merchant_game_list 映射表行数: {gp_merchant_game_df.shape[0]}")
        
        # 创建gp厂商的id到source_id的映射
        gp_id_to_source = dict(zip(gp_merchant_game_df['id'], gp_merchant_game_df['source_id']))
        
        # 创建gp厂商的完整映射：id -> source_id -> game_name
        gp_game_to_name = {}
        for game_id, source_id in gp_id_to_source.items():
            # 优先使用game_id_to_name（id->name映射），其次使用game_code_to_name（code->name映射）
            game_name = game_id_to_name.get(source_id, game_code_to_name.get(source_id, game_id))
            if not game_name or game_name == game_id:
                logger.warning(f"[映射调试] source_id未查到，game_id={game_id}, source_id={source_id}, game_id_to_name.keys={list(game_id_to_name.keys())}, game_code_to_name.keys={list(game_code_to_name.keys())}")
            
            # 如果映射结果仍然是数字ID，说明映射关系不完整，尝试从game_list中查找
            if game_name == game_id and source_id.isdigit():
                try:
                    # 查询gmp_game_list表，根据source_id查找游戏名称（参数化，避免SQL注入）
                    from sqlalchemy import text as _text
                    with gmp_engine.connect() as conn:
                        result = conn.execute(_text("SELECT name FROM gmp_game_list WHERE id = :sid"), {"sid": int(source_id)}).fetchone()
                        if result and result[0]:
                            game_name = str(result[0]).strip()
                except Exception:
                    # 如果查询失败，保持原值
                    pass
            
            gp_game_to_name[game_id] = game_name
        
        # 调试日志：检查映射结果
        logger.info(f"游戏映射数量 - game_id_to_name: {len(game_id_to_name)}, gp_game_to_name: {len(gp_game_to_name)}")
        if len(game_id_to_name) == 0:
            logger.warning("gmp_game_list表为空，游戏名映射将使用原始ID！")
        if len(gp_game_to_name) == 0:
            logger.warning("gp厂商游戏映射为空，gp/popular游戏将使用原始ID！")
        
        return game_id_to_name, gp_game_to_name
        
    except Exception as e:
        logger.error(f"读取gmp_game_list或gmp_merchant_game_list失败: {str(e)}", exc_info=True)
        return {}, {}


def compute_retention(all_df, start_date, end_date, logger):
    if all_df.empty:
        return pd.DataFrame(columns=['商户ID','商户名','厂商','游戏ID','游戏名','D0','D1','D1率','D3','D3率','D7','D7率','周开始','周结束'])
    # 构建 (merchant, provider, game, day) -> set(uid)
    key_cols = ['merchant','game']
    if 'provider' in all_df.columns:
        key_cols = ['merchant','provider','game']
    all_df = all_df[key_cols + ['uid','day']].drop_duplicates()
    # 分日聚合
    groups = all_df.groupby(key_cols + ['day'])['uid'].agg(lambda s: set(s)).reset_index(name='uids')
    # 便于查找
    index = {}
    for _, r in groups.iterrows():
        k = tuple([r[c] for c in key_cols] + [r['day']])
        index[k] = r['uids']
    # 计算留存
    rows = []
    # 为D1/D3/D7准备最大需求到 end_date + 7
    for key_vals, sub in groups.groupby(key_cols):
        D0 = D1 = D3 = D7 = 0
        # 遍历周内的每天作为cohort
        d = start_date
        while d <= end_date:
            u0 = index.get(tuple(list(key_vals)+[d]))
            if u0:
                D0 += len(u0)
                u1 = index.get(tuple(list(key_vals)+[d + timedelta(days=1)]))
                u3 = index.get(tuple(list(key_vals)+[d + timedelta(days=3)]))
                u7 = index.get(tuple(list(key_vals)+[d + timedelta(days=7)]))
                if u1: D1 += len(u0 & u1)
                if u3: D3 += len(u0 & u3)
                if u7: D7 += len(u0 & u7)
            d += timedelta(days=1)
        if D0 == 0:
            continue
        merchant = key_vals[0]
        if len(key_cols) == 3:
            provider, game = key_vals[1], key_vals[2]
        else:
            provider, game = 'unknown', key_vals[1]
        rows.append({'merchant':merchant,'provider':provider,'game':game,'D0':D0,'D1':D1,'D3':D3,'D7':D7})
    ret = pd.DataFrame(rows)
    if ret.empty:
        return pd.DataFrame(columns=['商户ID','商户名','厂商','游戏ID','游戏名','D0','D1','D1率','D3','D3率','D7','D7率','周开始','周结束'])
    ret['D1率'] = (ret['D1']/ret['D0']).round(4)
    ret['D3率'] = (ret['D3']/ret['D0']).round(4)
    ret['D7率'] = (ret['D7']/ret['D0']).round(4)
    ret['周开始'] = start_date
    ret['周结束'] = end_date
    return ret

# 新增：按“商户-游戏-日期”输出的日留存（D+1/D+7/D+14/D+30），支持按历史首次出现定义“当天新用户数”

def compute_daily_retention(all_df, start_date, end_date, logger, merchant_to_name, game_id_to_name, gp_game_to_name, first_seen_map=None):
    if all_df.empty:
        return pd.DataFrame(columns=['merchant','game','provider_id','商户名','游戏名','日期','活跃用户D0','活跃用户D1','活跃用户D1率','活跃用户D3','活跃用户D3率','活跃用户D7','活跃用户D7率'])
    # 按（商户、provider、游戏、日期）分组，统计唯一uid
    key_cols = ['merchant','game']
    if 'provider' in all_df.columns:
        key_cols = ['merchant','provider','game']
    all_df = all_df[key_cols + ['uid','day']].drop_duplicates()
    groups = all_df.groupby(key_cols + ['day'])['uid'].agg(lambda s: set(s)).reset_index(name='uids')
    index = {}
    for _, r in groups.iterrows():
        k = tuple([r[c] for c in key_cols] + [r['day']])
        index[k] = r['uids']
    rows = []
    d = start_date
    while d <= end_date:
        day_str = d.strftime('%Y-%m-%d')
        for key_vals in groups.groupby(key_cols).groups.keys():
            day_key = tuple(list(key_vals)+[day_str])
            u0_all = index.get(day_key)
            merchant = key_vals[0]
            provider_id = key_vals[1] if len(key_cols) > 2 else None
            game = key_vals[-1]
            # 游戏名映射
            game_name = get_game_name({'provider_id': provider_id, 'game': game}, game_id_to_name, gp_game_to_name) if provider_id else get_game_name({'game': game}, game_id_to_name, gp_game_to_name)
            if not u0_all:
                daily_row = {
                    'merchant': merchant,
                    'provider_id': provider_id,
                    'game': game,
                    '商户名': merchant_to_name.get(str(merchant), str(merchant)),
                    '游戏名': game_name,
                    '日期': day_str,
                    '当天用户数': 0,
                    '次日用户数': 0,
                    '次日留存': 0.0,
                    '3日用户数': 0,
                    '3日留存': 0.0,
                    '7日用户数': 0,
                    '7日留存': 0.0,
                }
                rows.append(daily_row)
                continue
            u0 = u0_all  # 统计有记录用户数
            if not u0:
                continue
            u1 = index.get(tuple(list(key_vals)+[ (d + timedelta(days=1)).strftime('%Y-%m-%d') ]))
            u3 = index.get(tuple(list(key_vals)+[ (d + timedelta(days=3)).strftime('%Y-%m-%d') ]))
            u7 = index.get(tuple(list(key_vals)+[ (d + timedelta(days=7)).strftime('%Y-%m-%d') ]))
            c_d0 = len(u0)
            c_d1 = len(u0 & u1) if u1 else 0
            c_d3 = len(u0 & u3) if u3 else 0
            c_d7 = len(u0 & u7) if u7 else 0
            rate = lambda c: round(c / c_d0, 4) if c_d0 else 0.0
            daily_row = {
                'merchant': merchant,
                'provider_id': provider_id,
                'game': game,
                '商户名': merchant_to_name.get(str(merchant), str(merchant)),
                '游戏名': game_name,
                '日期': day_str,
                '当天用户数': c_d0,
                '次日用户数': c_d1,
                '次日留存': rate(c_d1),
                '3日用户数': c_d3,
                '3日留存': rate(c_d3),
                '7日用户数': c_d7,
                '7日留存': rate(c_d7),
            }
            rows.append(daily_row)
        d += timedelta(days=1)
    return pd.DataFrame(rows)


def export_and_send(logger, start_date, end_date, no_email=False, lookback_days=0):
    logger.info("=== 开始计算周度留存 ===")
    # 引擎
    sink_engine = build_engine(DB_CONFIG)
    gmp_engine = build_engine(GMP_DB_CONFIG)
    # 读取映射
    game_id_to_name, gp_game_to_name = get_game_mappings(gmp_engine, logger)
    merchant_to_name = build_merchant_map(logger)
    # 读取数据：周维度只取统计周期7天，无需前瞻30天
    all_days = []
    d = start_date
    while d <= end_date:
        all_days.append(d)
        d += timedelta(days=1)
    frames = []
    for the_day in all_days:
        df = read_day_records(sink_engine, the_day, logger)
        if not df.empty:
            frames.append(df)
    if not frames:
        logger.warning("未读取到任何用户记录，任务结束。")
        return False, "无数据"
    all_df = pd.concat(frames, ignore_index=True)
    # 周留存
    ret_df = compute_retention(all_df, start_date, end_date, logger)
    # 计算 first_seen（仅当需要真正新增时）
    first_seen_map = None
    if lookback_days and not all_df.empty:
        key_cols = ['merchant','game']
        if 'provider' in all_df.columns:
            key_cols = ['merchant','provider','game']
        tmp = all_df[key_cols + ['uid','day']].drop_duplicates()
        grp = tmp.groupby(key_cols + ['uid'])['day'].min().reset_index(name='first_day')
        # 构造查询用映射： (key..., uid) -> first_day
        first_seen_map = {tuple([row[c] for c in key_cols] + [row['uid']]): row['first_day'] for _, row in grp.iterrows()}
        logger.info(f"已构建 first_seen_map，键数：{len(first_seen_map)}")
    # 日留存
    daily_df = compute_daily_retention(all_df, start_date, end_date, logger, merchant_to_name, game_id_to_name, gp_game_to_name, first_seen_map=first_seen_map)
    if ret_df.empty and daily_df.empty:
        logger.warning("留存结果为空。")
        return False, "留存结果为空"
    # 映射展示字段 - 周
    if not ret_df.empty:
        ret_df['商户ID'] = ret_df['merchant']
        ret_df['商户名'] = ret_df['merchant'].map(lambda x: merchant_to_name.get(str(x), str(x)))
        ret_df['厂商'] = ret_df['provider']
        ret_df['游戏ID'] = ret_df['game']
        def _map_game_name_w(row):
            return get_game_name({'provider': row['provider'], 'game': row['game']}, game_id_to_name, gp_game_to_name)
        ret_df['游戏名'] = ret_df.apply(_map_game_name_w, axis=1)
        cols_w = ['周开始','周结束','商户ID','商户名','厂商','游戏ID','游戏名','D0','D1','D1率','D3','D3率','D7','D7率']
        ret_df = ret_df[cols_w].sort_values(['商户名','厂商','游戏名'])
    # 映射展示字段 - 日
    if not daily_df.empty:
        # 商户名映射（优先merchant_desc，其次account，否则merchant_id）
        daily_df['商户名'] = daily_df['merchant'].map(lambda x: merchant_to_name.get(str(x), str(x)))
        # 游戏名映射（GP/Popular两步映射，其他直接id/code->name）
        def _map_game_name_d(row):
            try:
                return get_game_name(row, game_id_to_name, gp_game_to_name)
            except Exception as e:
                logger.warning(f"游戏名映射失败: {row['game']} provider={row.get('provider')} 错误: {e}")
                return row['game']
        daily_df['游戏名'] = daily_df.apply(_map_game_name_d, axis=1)
        # 检查商户名/游戏名缺失情况，补充日志
        missing_merchants = daily_df[daily_df['商户名'] == daily_df['merchant']]['merchant'].unique()
        if len(missing_merchants) > 0:
            logger.warning(f"未匹配到商户名的商户ID: {missing_merchants}")
        missing_games = daily_df[daily_df['游戏名'] == daily_df['game']]['game'].unique()
        if len(missing_games) > 0:
            logger.warning(f"未匹配到游戏名的game_id: {missing_games}")
        daily_cols = ['商户名','游戏名','日期','当天用户数','次日用户数','次日留存','3日用户数','3日留存','7日用户数','7日留存']
        daily_df = daily_df[daily_cols].sort_values(['商户名','游戏名','日期'])
    # 导出
    ensure_directory_exists(EXPORT_DIR)
    week_str = get_week_range_string(start_date, end_date)
    out_path = os.path.join(EXPORT_DIR, f"weekly_retention_{week_str}.xlsx")
    with pd.ExcelWriter(out_path, engine='xlsxwriter') as writer:
        # 商户-游戏维度日留存Sheet
        if not daily_df.empty:
            daily_df.to_excel(writer, sheet_name='商户游戏日留存', index=False)
        # 商户维度Sheet（只统计gp/popular）
        merchant_daily_df = daily_df.groupby(['商户名','日期']).agg({
            '当天用户数':'sum','次日用户数':'sum','次日留存':'mean','3日用户数':'sum','3日留存':'mean','7日用户数':'sum','7日留存':'mean'
        }).reset_index()
        merchant_daily_df.to_excel(writer, sheet_name='商户维度日留存', index=False)
        # 游戏维度Sheet（只统计gp/popular）
        game_daily_df = daily_df.groupby(['游戏名','日期']).agg({
            '当天用户数':'sum','次日用户数':'sum','次日留存':'mean','3日用户数':'sum','3日留存':'mean','7日用户数':'sum','7日留存':'mean'
        }).reset_index()
        game_daily_df.to_excel(writer, sheet_name='游戏维度日留存', index=False)
        # 新用户相关统计（统计日期当天首次出现的用户）
        lookback_days = 60
        all_days_ext = []
        d_ext = start_date - timedelta(days=lookback_days)
        while d_ext <= end_date:
            all_days_ext.append(d_ext)
            d_ext += timedelta(days=1)
        frames_ext = []
        for the_day in all_days_ext:
            df_ext = read_day_records(sink_engine, the_day, logger)
            if not df_ext.empty:
                frames_ext.append(df_ext)
        if frames_ext:
            all_df_ext = pd.concat(frames_ext, ignore_index=True)
            key_cols = ['merchant','game']
            if 'provider' in all_df_ext.columns:
                key_cols = ['merchant','provider','game']
            tmp_ext = all_df_ext[key_cols + ['uid','day']].drop_duplicates()
            grp_ext = tmp_ext.groupby(key_cols + ['uid'])['day'].min().reset_index(name='first_day')
            first_seen_map_ext = {tuple([row[c] for c in key_cols] + [row['uid']]): row['first_day'] for _, row in grp_ext.iterrows()}
        else:
            first_seen_map_ext = {}
        # 新用户留存统计
        if not daily_df.empty:
            # 先筛出所有新用户（cohort）
            daily_df['新用户D0'] = 0
            daily_df['新用户D1'] = 0
            daily_df['新用户D1率'] = 0.0
            daily_df['新用户D3'] = 0
            daily_df['新用户D3率'] = 0.0
            daily_df['新用户D7'] = 0
            daily_df['新用户D7率'] = 0.0
            for idx, row in daily_df.iterrows():
                merchant_name = row['商户名']
                game_name = row['游戏名']
                date = row['日期']
                # all_df_ext中merchant、game需映射为商户名、游戏名
                uids = all_df_ext[(all_df_ext['day']==date)].copy()
                uids['商户名'] = uids['merchant'].map(merchant_to_name)
                uids['游戏名'] = uids['game'].map(lambda x: get_game_name({'game': x}, game_id_to_name, gp_game_to_name))
                uids = uids[(uids['商户名']==merchant_name) & (uids['游戏名']==game_name)]
                new_user_ids = []
                for _, urow in uids.iterrows():
                    k_uid = tuple([urow[c] for c in key_cols] + [urow['uid']])
                    first_day = first_seen_map_ext.get(k_uid)
                    if first_day == date:
                        new_user_ids.append(urow['uid'])
                # 新用户D0
                daily_df.at[idx, '新用户D0'] = len(new_user_ids)
                # 新用户D1/D3/D7
                def get_next_day_users(offset):
                    next_day = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=offset)).strftime('%Y-%m-%d')
                    next_uids = all_df_ext[(all_df_ext['day']==next_day)].copy()
                    next_uids['商户名'] = next_uids['merchant'].map(merchant_to_name)
                    next_uids['游戏名'] = next_uids['game'].map(lambda x: get_game_name({'game': x}, game_id_to_name, gp_game_to_name))
                    next_uids = next_uids[(next_uids['商户名']==merchant_name) & (next_uids['游戏名']==game_name)]
                    return set(next_uids['uid'])
                d1_users = get_next_day_users(1)
                d3_users = get_next_day_users(3)
                d7_users = get_next_day_users(7)
                daily_df.at[idx, '新用户D1'] = len(set(new_user_ids) & d1_users)
                daily_df.at[idx, '新用户D1率'] = round(daily_df.at[idx, '新用户D1'] / daily_df.at[idx, '新用户D0'], 4) if daily_df.at[idx, '新用户D0'] else 0.0
                daily_df.at[idx, '新用户D3'] = len(set(new_user_ids) & d3_users)
                daily_df.at[idx, '新用户D3率'] = round(daily_df.at[idx, '新用户D3'] / daily_df.at[idx, '新用户D0'], 4) if daily_df.at[idx, '新用户D0'] else 0.0
                daily_df.at[idx, '新用户D7'] = len(set(new_user_ids) & d7_users)
                daily_df.at[idx, '新用户D7率'] = round(daily_df.at[idx, '新用户D7'] / daily_df.at[idx, '新用户D0'], 4) if daily_df.at[idx, '新用户D0'] else 0.0
        # 新用户留存子表导出
        if not daily_df.empty:
            # 商户-游戏维度新用户留存Sheet
            daily_newuser_ret_df = daily_df[['商户名','游戏名','日期','新用户D0','新用户D1','新用户D1率','新用户D3','新用户D3率','新用户D7','新用户D7率']].copy()
            daily_newuser_ret_df.to_excel(writer, sheet_name='商户游戏新用户留存', index=False)
            # 商户维度新用户留存Sheet
            merchant_newuser_ret_df = daily_df.groupby(['商户名','日期']).agg({
                '新用户D0':'sum','新用户D1':'sum','新用户D1率':'mean','新用户D3':'sum','新用户D3率':'mean','新用户D7':'sum','新用户D7率':'mean'
            }).reset_index()
            merchant_newuser_ret_df.to_excel(writer, sheet_name='商户维度新用户留存', index=False)
            # 游戏维度新用户留存Sheet
            game_newuser_ret_df = daily_df.groupby(['游戏名','日期']).agg({
                '新用户D0':'sum','新用户D1':'sum','新用户D1率':'mean','新用户D3':'sum','新用户D3率':'mean','新用户D7':'sum','新用户D7率':'mean'
            }).reset_index()
            game_newuser_ret_df.to_excel(writer, sheet_name='游戏维度新用户留存', index=False)
    logger.info(f"日留存导出完成：{out_path}")
    if no_email:
        return True, out_path
    # 发送邮件流程对齐 weekly_billing.py
    try:
        from email.header import Header
        from email.mime.application import MIMEApplication
        import smtplib, traceback
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        # 测试SMTP连接（可选：如有test_smtp_connection函数可复用）
        msg = MIMEMultipart('mixed')
        msg['From'] = EMAIL_CONFIG['sender']
        msg['To'] = ', '.join(EMAIL_CONFIG['receivers'])
        if EMAIL_CONFIG.get('cc') and len(EMAIL_CONFIG['cc']) > 0:
            msg['Cc'] = ', '.join(EMAIL_CONFIG['cc'])
            all_receivers = EMAIL_CONFIG['receivers'] + EMAIL_CONFIG['cc']
        else:
            all_receivers = EMAIL_CONFIG['receivers']
        subject = f'【即时】周度留存报表 - {week_str}'
        body_text = f'''您好：\n\n本邮件为【即时发送】，统计周期：{week_str}。\n请查收附件中的周度留存报表（含日留存Sheet）。\n\n此邮件为系统自动发送，请勿直接回复。\n如有问题请联系相关负责人。\n\n祝好！'''
        body_html = f'''<html><head></head><body><h2>周度留存报表</h2><p><strong>发送模式：</strong>即时发送</p><p><strong>统计周期：</strong>{week_str}</p><p>请查收附件中的周度留存报表（含日留存Sheet）。</p><p><em>此邮件为系统自动发送，请勿直接回复。<br>如有问题请联系相关负责人。</em></p><p>祝好！</p></body></html>'''
        msg['Subject'] = Header(subject, 'utf-8')
        msg_body = MIMEMultipart('alternative')
        textpart = MIMEText(body_text.encode('utf-8'), 'plain', 'utf-8')
        htmlpart = MIMEText(body_html.encode('utf-8'), 'html', 'utf-8')
        msg_body.attach(textpart)
        msg_body.attach(htmlpart)
        msg.attach(msg_body)
        # 添加附件
        with open(out_path, 'rb') as f:
            part = MIMEApplication(f.read(), Name=os.path.basename(out_path))
            filename = os.path.basename(out_path)
            try:
                filename.encode('ascii')
                part.add_header('Content-Disposition', 'attachment', filename=filename)
            except UnicodeEncodeError:
                part.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', filename))
            msg.attach(part)
            logger.info(f"成功添加附件: {filename}")
        # 发送邮件
        logger.info(f"正在连接SMTP服务器: {EMAIL_CONFIG['smtp_host']}:{EMAIL_CONFIG['smtp_port']}")
        with smtplib.SMTP_SSL(EMAIL_CONFIG['smtp_host'], EMAIL_CONFIG['smtp_port']) as server:
            logger.info("SMTP服务器连接成功")
            server.login(EMAIL_CONFIG['sender'], EMAIL_CONFIG['password'])
            logger.info("SMTP服务器登录成功")
            errors = server.send_message(msg)
            if not errors:
                logger.info("邮件发送成功！")
                return True, out_path
            err = f"发送失败的收件人: {errors}"
            logger.error(err)
            return False, err
    except Exception as e:
        err = f"发送邮件失败: {e}\n{traceback.format_exc()}"
        logger.error(err)
        return False, err


def main():
    logger = setup_logging()
    parser = argparse.ArgumentParser(description='周度商户-游戏留存统计（GP/Popular）')
    parser.add_argument('--start-date', type=str, help='统计周开始日期 YYYY-MM-DD')
    parser.add_argument('--end-date', type=str, help='统计周结束日期 YYYY-MM-DD')
    parser.add_argument('--lookback-days', type=int, default=0, help='识别“当天新用户数”的历史回溯天数，0表示按当日活跃UID作为cohort')
    parser.add_argument('--no-email', action='store_true', help='仅导出Excel，不发送邮件')
    args = parser.parse_args()

    if args.start_date and args.end_date:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(args.end_date, '%Y-%m-%d').date()
    else:
        start_date, end_date = get_last_week_dates()
    logger.info(f"统计周期: {get_week_range_string(start_date, end_date)}")
    if args.lookback_days and args.lookback_days > 0:
        logger.info(f"启用真正新增口径：lookback={args.lookback_days} 天")

    ok, path_or_msg = export_and_send(logger, start_date, end_date, no_email=args.no_email, lookback_days=args.lookback_days)
    if ok:
        logger.info("周度留存任务完成！")
    else:
        logger.error(f"任务失败：{path_or_msg}")
    logger.info("=== 任务结束 ===")


if __name__ == '__main__':
    main()