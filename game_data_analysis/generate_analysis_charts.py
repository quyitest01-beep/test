#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
游戏数据分析图表生成器
根据CSV数据生成各种分析图表
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from matplotlib import font_manager
import warnings
warnings.filterwarnings('ignore')

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 设置图表样式
sns.set_style("whitegrid")
plt.style.use('seaborn-v0_8')

def load_and_clean_data():
    """加载和清理数据"""
    # 读取CSV文件
    df = pd.read_csv('d:/cursor/测试数据.csv')
    
    # 清理数据
    df = df.dropna(subset=['类型', '游戏'])  # 删除类型和游戏为空的行
    df = df[df['类型'] != '#N/A']  # 删除类型为#N/A的行
    df = df[df['游戏'] != '#N/A']  # 删除游戏为#N/A的行
    
    # 转换数值列
    numeric_columns = ['user_count', 'total_bet_amount', 'total_rounds', 'total_pay_out', 'net_win']
    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def create_user_count_chart(df):
    """创建用户数量排名图表"""
    # 获取用户数量前15的游戏
    top_users = df.nlargest(15, 'user_count')
    
    plt.figure(figsize=(14, 8))
    bars = plt.barh(range(len(top_users)), top_users['user_count'], 
                    color=plt.cm.viridis(np.linspace(0, 1, len(top_users))))
    
    plt.yticks(range(len(top_users)), 
               [f"{row['游戏']} ({row['类型']})" for _, row in top_users.iterrows()])
    plt.xlabel('用户数量')
    plt.title('用户数量排名前15的游戏', fontsize=16, fontweight='bold')
    plt.grid(axis='x', alpha=0.3)
    
    # 添加数值标签
    for i, (idx, row) in enumerate(top_users.iterrows()):
        plt.text(row['user_count'] + max(top_users['user_count']) * 0.01, 
                i, f"{row['user_count']:,}", 
                va='center', fontsize=9)
    
    plt.tight_layout()
    plt.savefig('用户数量排名.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_bet_amount_chart(df):
    """创建投注金额排名图表"""
    # 获取投注金额前15的游戏
    top_bets = df.nlargest(15, 'total_bet_amount')
    
    plt.figure(figsize=(14, 8))
    bars = plt.barh(range(len(top_bets)), top_bets['total_bet_amount'], 
                    color=plt.cm.plasma(np.linspace(0, 1, len(top_bets))))
    
    plt.yticks(range(len(top_bets)), 
               [f"{row['游戏']} ({row['类型']})" for _, row in top_bets.iterrows()])
    plt.xlabel('投注金额')
    plt.title('投注金额排名前15的游戏', fontsize=16, fontweight='bold')
    plt.grid(axis='x', alpha=0.3)
    
    # 添加数值标签（转换为万）
    for i, (idx, row) in enumerate(top_bets.iterrows()):
        amount_wan = row['total_bet_amount'] / 10000
        plt.text(row['total_bet_amount'] + max(top_bets['total_bet_amount']) * 0.01, 
                i, f"{amount_wan:.1f}万", 
                va='center', fontsize=9)
    
    plt.tight_layout()
    plt.savefig('投注金额排名.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_net_win_chart(df):
    """创建净盈利排名图表"""
    # 获取净盈利前15的游戏
    top_profit = df.nlargest(15, 'net_win')
    
    plt.figure(figsize=(14, 8))
    colors = ['green' if x > 0 else 'red' for x in top_profit['net_win']]
    bars = plt.barh(range(len(top_profit)), top_profit['net_win'], color=colors, alpha=0.7)
    
    plt.yticks(range(len(top_profit)), 
               [f"{row['游戏']} ({row['类型']})" for _, row in top_profit.iterrows()])
    plt.xlabel('净盈利')
    plt.title('净盈利排名前15的游戏', fontsize=16, fontweight='bold')
    plt.grid(axis='x', alpha=0.3)
    
    # 添加数值标签
    for i, (idx, row) in enumerate(top_profit.iterrows()):
        profit_wan = row['net_win'] / 10000
        plt.text(row['net_win'] + max(abs(top_profit['net_win'])) * 0.01, 
                i, f"{profit_wan:.1f}万", 
                va='center', fontsize=9)
    
    plt.tight_layout()
    plt.savefig('净盈利排名.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_game_type_analysis(df):
    """创建游戏类型分析图表"""
    # 按游戏类型汇总数据
    type_summary = df.groupby('类型').agg({
        'user_count': 'sum',
        'total_bet_amount': 'sum',
        'net_win': 'sum',
        '游戏': 'count'
    }).reset_index()
    type_summary.columns = ['游戏类型', '总用户数', '总投注金额', '总净盈利', '游戏数量']
    
    # 创建子图
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    
    # 1. 游戏类型用户数分布
    colors1 = plt.cm.Set3(np.linspace(0, 1, len(type_summary)))
    wedges, texts, autotexts = ax1.pie(type_summary['总用户数'], 
                                       labels=type_summary['游戏类型'],
                                       autopct='%1.1f%%',
                                       colors=colors1,
                                       startangle=90)
    ax1.set_title('各游戏类型用户数分布', fontsize=14, fontweight='bold')
    
    # 2. 游戏类型投注金额分布
    bars2 = ax2.bar(type_summary['游戏类型'], type_summary['总投注金额'], 
                    color=colors1, alpha=0.8)
    ax2.set_title('各游戏类型投注金额', fontsize=14, fontweight='bold')
    ax2.set_ylabel('投注金额')
    ax2.tick_params(axis='x', rotation=45)
    
    # 添加数值标签
    for bar in bars2:
        height = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., height + max(type_summary['总投注金额']) * 0.01,
                f'{height/10000:.1f}万', ha='center', va='bottom', fontsize=9)
    
    # 3. 游戏类型净盈利分布
    colors3 = ['green' if x > 0 else 'red' for x in type_summary['总净盈利']]
    bars3 = ax3.bar(type_summary['游戏类型'], type_summary['总净盈利'], 
                    color=colors3, alpha=0.8)
    ax3.set_title('各游戏类型净盈利', fontsize=14, fontweight='bold')
    ax3.set_ylabel('净盈利')
    ax3.tick_params(axis='x', rotation=45)
    ax3.axhline(y=0, color='black', linestyle='-', alpha=0.3)
    
    # 添加数值标签
    for bar in bars3:
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height + max(abs(type_summary['总净盈利'])) * 0.01,
                f'{height/10000:.1f}万', ha='center', va='bottom' if height > 0 else 'top', fontsize=9)
    
    # 4. 游戏数量分布
    bars4 = ax4.bar(type_summary['游戏类型'], type_summary['游戏数量'], 
                    color=colors1, alpha=0.8)
    ax4.set_title('各游戏类型游戏数量', fontsize=14, fontweight='bold')
    ax4.set_ylabel('游戏数量')
    ax4.tick_params(axis='x', rotation=45)
    
    # 添加数值标签
    for bar in bars4:
        height = bar.get_height()
        ax4.text(bar.get_x() + bar.get_width()/2., height + max(type_summary['游戏数量']) * 0.01,
                f'{int(height)}', ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    plt.savefig('游戏类型分析.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_correlation_heatmap(df):
    """创建相关性热力图"""
    # 选择数值列进行相关性分析
    numeric_df = df[['user_count', 'total_bet_amount', 'total_rounds', 'total_pay_out', 'net_win']]
    
    plt.figure(figsize=(10, 8))
    correlation_matrix = numeric_df.corr()
    
    # 创建热力图
    mask = np.triu(np.ones_like(correlation_matrix, dtype=bool))
    sns.heatmap(correlation_matrix, 
                mask=mask,
                annot=True, 
                cmap='RdYlBu_r', 
                center=0,
                square=True,
                fmt='.2f',
                cbar_kws={"shrink": .8})
    
    plt.title('游戏数据相关性分析', fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.savefig('数据相关性分析.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_profitability_scatter(df):
    """创建盈利能力散点图"""
    plt.figure(figsize=(12, 8))
    
    # 按游戏类型设置不同颜色
    type_colors = {'Lottery': 'blue', 'Crash': 'red', 'Slot': 'green', 
                   'Arcade': 'orange', 'Table': 'purple', 'other': 'gray'}
    
    for game_type in df['类型'].unique():
        if game_type in type_colors:
            type_data = df[df['类型'] == game_type]
            plt.scatter(type_data['user_count'], type_data['net_win'], 
                       c=type_colors[game_type], label=game_type, alpha=0.7, s=60)
    
    plt.xlabel('用户数量')
    plt.ylabel('净盈利')
    plt.title('用户数量 vs 净盈利关系图', fontsize=16, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # 添加趋势线
    z = np.polyfit(df['user_count'], df['net_win'], 1)
    p = np.poly1d(z)
    plt.plot(df['user_count'], p(df['user_count']), "r--", alpha=0.8, linewidth=2)
    
    plt.tight_layout()
    plt.savefig('盈利能力分析.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_top_performers_summary(df):
    """创建顶级表现者汇总图表"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    # 获取各项指标的前5名
    top_users = df.nlargest(5, 'user_count')
    top_profit = df.nlargest(5, 'net_win')
    
    # 用户数量前5
    bars1 = ax1.barh(range(len(top_users)), top_users['user_count'], 
                     color=plt.cm.Blues(np.linspace(0.4, 1, len(top_users))))
    ax1.set_yticks(range(len(top_users)))
    ax1.set_yticklabels([f"{row['游戏']}" for _, row in top_users.iterrows()])
    ax1.set_xlabel('用户数量')
    ax1.set_title('用户数量前5名', fontsize=14, fontweight='bold')
    ax1.grid(axis='x', alpha=0.3)
    
    # 净盈利前5
    bars2 = ax2.barh(range(len(top_profit)), top_profit['net_win'], 
                     color=plt.cm.Greens(np.linspace(0.4, 1, len(top_profit))))
    ax2.set_yticks(range(len(top_profit)))
    ax2.set_yticklabels([f"{row['游戏']}" for _, row in top_profit.iterrows()])
    ax2.set_xlabel('净盈利')
    ax2.set_title('净盈利前5名', fontsize=14, fontweight='bold')
    ax2.grid(axis='x', alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('顶级表现者汇总.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_revenue_analysis(df):
    """创建收入分析图表"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    # 1. 投注金额 vs 支出金额散点图
    ax1.scatter(df['total_bet_amount'], df['total_pay_out'], alpha=0.6, s=50)
    ax1.plot([df['total_bet_amount'].min(), df['total_bet_amount'].max()], 
             [df['total_bet_amount'].min(), df['total_bet_amount'].max()], 
             'r--', alpha=0.8, label='盈亏平衡线')
    ax1.set_xlabel('投注金额')
    ax1.set_ylabel('支出金额')
    ax1.set_title('投注金额 vs 支出金额', fontsize=14, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # 2. 净盈利分布直方图
    ax2.hist(df['net_win'], bins=30, alpha=0.7, color='skyblue', edgecolor='black')
    ax2.axvline(x=0, color='red', linestyle='--', alpha=0.8, label='盈亏平衡线')
    ax2.set_xlabel('净盈利')
    ax2.set_ylabel('游戏数量')
    ax2.set_title('净盈利分布', fontsize=14, fontweight='bold')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('收入分析.png', dpi=300, bbox_inches='tight')
    plt.close()

def main():
    """主函数"""
    print("开始生成游戏数据分析图表...")
    
    # 加载数据
    df = load_and_clean_data()
    print(f"数据加载完成，共{len(df)}条记录")
    
    # 生成各种图表
    print("生成用户数量排名图表...")
    create_user_count_chart(df)
    
    print("生成投注金额排名图表...")
    create_bet_amount_chart(df)
    
    print("生成净盈利排名图表...")
    create_net_win_chart(df)
    
    print("生成游戏类型分析图表...")
    create_game_type_analysis(df)
    
    print("生成数据相关性分析图表...")
    create_correlation_heatmap(df)
    
    print("生成盈利能力分析图表...")
    create_profitability_scatter(df)
    
    print("生成顶级表现者汇总图表...")
    create_top_performers_summary(df)
    
    print("生成收入分析图表...")
    create_revenue_analysis(df)
    
    print("所有图表生成完成！")
    print("生成的PNG文件：")
    print("- 用户数量排名.png")
    print("- 投注金额排名.png") 
    print("- 净盈利排名.png")
    print("- 游戏类型分析.png")
    print("- 数据相关性分析.png")
    print("- 盈利能力分析.png")
    print("- 顶级表现者汇总.png")
    print("- 收入分析.png")

if __name__ == "__main__":
    main()
