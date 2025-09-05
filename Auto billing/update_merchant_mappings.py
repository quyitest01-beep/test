import json
import sys
import os
sys.path.append('.')

# 从线上Lark表获取的生产环境账户映射
production_mappings = {
    'ProductionLotus11': {'main_merchant': 'winwinbet', 'sub_merchant_name': 'Lotus11'},
    'Productionwinwin': {'main_merchant': 'winwinbet', 'sub_merchant_name': 'winwin'},
    'Productionwinwinbet': {'main_merchant': 'winwinbet', 'sub_merchant_name': 'winwinbet'},
    'ProductionSortebot': {'main_merchant': 'sortebot', 'sub_merchant_name': 'sortebot'},
    'ProductionGamePlus': {'main_merchant': 'Game Plus', 'sub_merchant_name': 'Game Plus'},
    'ProductionGamePlus1': {'main_merchant': 'Game Plus', 'sub_merchant_name': 'GamePlus1'},
    'ProductionEpochGame': {'main_merchant': 'Epoch Game', 'sub_merchant_name': 'Epoch Game'},
    'ProductionBetfarms': {'main_merchant': 'Betfarms', 'sub_merchant_name': 'Betfarms'},
    'Productionslotsapi': {'main_merchant': 'slotsapi', 'sub_merchant_name': 'slotsapi'},
    'ProductionTogame': {'main_merchant': 'Togame', 'sub_merchant_name': 'To game'},
    'ProductionNicegame': {'main_merchant': 'Nicegame', 'sub_merchant_name': 'Nicegame'},
    'ProductionJBgame': {'main_merchant': 'JBgame', 'sub_merchant_name': 'JB game'},
    'ProductionWON66': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'WON66'},
    'Production1UWIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': '1UWIN'},
    'Production12POKIES': {'main_merchant': 'RichGroup', 'sub_merchant_name': '12POKIES'},
    'ProductionUPOKIES': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'UPOKIES'},
    'ProductionWAWAWIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'WAWAWIN'},
    'Production5GAMING': {'main_merchant': 'RichGroup', 'sub_merchant_name': '5GAMING'},
    'ProductionA9GAMING': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'A9GAMING'},
    'ProductionBCWIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'BCWIN'},
    'ProductionURUSWIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'URUSWIN'},
    'ProductionCASHNET': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'CASHNET'},
    'ProductionFAFA': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'FAFA'},
    'ProductionGXBET': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'GXBET'},
    'Production1XPOKIES': {'main_merchant': 'RichGroup', 'sub_merchant_name': '1XPOKIES'},
    'ProductionADVANTPLAY': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'ADVANTPLAY'},  # 修正账户名
    'ProductionRICHMAMA': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'RICHMAMA'},
    'ProductionRICHPAPA': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'RICHPAPA'},
    'ProductionUUSPIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'UUSPIN'},
    'ProductionRedSpin': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'RedSpin'},
    'ProductionYAYAWIN': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'YAYAWIN'},
    'ProductionRICHPGK': {'main_merchant': 'RichGroup', 'sub_merchant_name': 'RICHPGK'},
    'ProductionEpicWin': {'main_merchant': 'slotsapi', 'sub_merchant_name': 'EpicWin'},  # 修正账户名
    'ProductionPUBCGAME': {'main_merchant': 'PUBCGAME', 'sub_merchant_name': 'PUBCGAME'},
    'ProductionJogar': {'main_merchant': 'Jogar', 'sub_merchant_name': 'Jogar'},
    'ProductionAAFUN': {'main_merchant': 'AAFUN', 'sub_merchant_name': 'AAFUN'}
}

print('🔄 更新unified_merchant_table.json...')

try:
    # 读取现有的映射表
    with open('unified_merchant_table.json', 'r', encoding='utf-8') as f:
        existing_mappings = json.load(f)
    
    print(f'📊 现有映射数量: {len(existing_mappings)}')
    
    # 添加新的映射
    updated_count = 0
    new_count = 0
    
    for account, mapping in production_mappings.items():
        if account in existing_mappings:
            # 更新现有映射
            existing_mappings[account].update(mapping)
            updated_count += 1
            print(f'✅ 更新: {account} -> {mapping["main_merchant"]}')
        else:
            # 添加新映射
            existing_mappings[account] = mapping
            new_count += 1
            print(f'➕ 新增: {account} -> {mapping["main_merchant"]}')
    
    # 保存更新后的映射表
    with open('unified_merchant_table.json', 'w', encoding='utf-8') as f:
        json.dump(existing_mappings, f, ensure_ascii=False, indent=2)
    
    print(f'\n✅ 映射表更新完成!')
    print(f'📈 总映射数量: {len(existing_mappings)}')
    print(f'🔄 更新数量: {updated_count}')
    print(f'➕ 新增数量: {new_count}')
    
    # 验证更新
    print('\n🔍 验证新增的映射:')
    for account in production_mappings.keys():
        if account in existing_mappings:
            info = existing_mappings[account]
            print(f'  {account} -> 主商户: {info["main_merchant"]}, 子商户: {info["sub_merchant_name"]}')

except Exception as e:
    print(f'❌ 更新失败: {str(e)}')