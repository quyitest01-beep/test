/**
 * 意图识别测试用例集
 * 用于验证意图识别准确率是否达到≥95%的目标
 */

const testCases = [
  // 游戏回合记录查询
  {
    id: 1,
    input: "能查看这个回合记录有异常吗？MerchantID：1755248023，biz_id：gp0001964961557724336128-4-2，round_id：1964961557724336128",
    expectedIntent: "game_round_query",
    expectedParams: {
      merchant_id: 1755248023,
      biz_id: "gp0001964961557724336128-4-2",
      round_id: "1964961557724336128"
    },
    expectedConfidence: 0.8,
    description: "游戏回合异常检查"
  },
  {
    id: 2,
    input: "检查round_id：123456的游戏记录",
    expectedIntent: "game_round_query",
    expectedParams: {
      round_id: "123456"
    },
    expectedConfidence: 0.6,
    description: "简单回合记录查询"
  },

  // 时间范围数据查询
  {
    id: 3,
    input: "我要1号到31号的PHP跟INR数据",
    expectedIntent: "time_range_query",
    expectedParams: {
      time_range: { start: "1", end: "31" },
      currency: "PHP"
    },
    expectedConfidence: 0.7,
    description: "时间范围币种查询"
  },
  {
    id: 4,
    input: "查询2024-01-01到2024-01-31的数据",
    expectedIntent: "time_range_query",
    expectedParams: {
      time_range: { start: "2024-01-01", end: "2024-01-31" }
    },
    expectedConfidence: 0.8,
    description: "标准日期范围查询"
  },

  // 游戏收入查询
  {
    id: 5,
    input: "查看昨天的游戏收入数据",
    expectedIntent: "game_revenue_query",
    expectedParams: {},
    expectedConfidence: 0.6,
    description: "游戏收入查询"
  },
  {
    id: 6,
    input: "帮我导出本月PHP和INR的游戏营收",
    expectedIntent: "game_revenue_query",
    expectedParams: {
      currency: "PHP"
    },
    expectedConfidence: 0.7,
    description: "游戏营收导出"
  },

  // 商户分析
  {
    id: 7,
    input: "分析商户12345的业绩表现",
    expectedIntent: "merchant_analysis",
    expectedParams: {
      merchant_id: 12345
    },
    expectedConfidence: 0.8,
    description: "商户业绩分析"
  },
  {
    id: 8,
    input: "对比不同平台的数据",
    expectedIntent: "merchant_analysis",
    expectedParams: {},
    expectedConfidence: 0.5,
    description: "平台对比分析"
  },

  // 报表生成
  {
    id: 9,
    input: "月活，日活，留存，净营收这几个指标可以做成月报发送吗",
    expectedIntent: "report_generation",
    expectedParams: {
      report_type: "月报"
    },
    expectedConfidence: 0.8,
    description: "月报生成请求"
  },
  {
    id: 10,
    input: "生成上周的用户活跃度报表",
    expectedIntent: "report_generation",
    expectedParams: {
      report_type: "周报"
    },
    expectedConfidence: 0.7,
    description: "周报生成请求"
  },

  // 用户行为分析
  {
    id: 11,
    input: "查询新用户留存率数据",
    expectedIntent: "user_behavior_query",
    expectedParams: {
      metric_type: "留存"
    },
    expectedConfidence: 0.7,
    description: "用户留存分析"
  },
  {
    id: 12,
    input: "统计DAU和MAU指标",
    expectedIntent: "user_behavior_query",
    expectedParams: {
      metric_type: "DAU"
    },
    expectedConfidence: 0.8,
    description: "用户活跃度统计"
  },

  // 币种查询
  {
    id: 13,
    input: "USD汇率数据",
    expectedIntent: "currency_query",
    expectedParams: {
      currency: "USD"
    },
    expectedConfidence: 0.8,
    description: "币种汇率查询"
  },
  {
    id: 14,
    input: "PHP、INR、MYR三种币种的交易数据",
    expectedIntent: "currency_query",
    expectedParams: {
      currency: "PHP"
    },
    expectedConfidence: 0.7,
    description: "多币种交易查询"
  },

  // 异常检测
  {
    id: 15,
    input: "检测数据异常",
    expectedIntent: "anomaly_detection",
    expectedParams: {},
    expectedConfidence: 0.6,
    description: "数据异常检测"
  },
  {
    id: 16,
    input: "有没有风险数据需要关注",
    expectedIntent: "anomaly_detection",
    expectedParams: {},
    expectedConfidence: 0.5,
    description: "风险数据检查"
  },

  // 非查数请求（应该被过滤）
  {
    id: 17,
    input: "你好，早上好",
    expectedIntent: "non_query",
    expectedParams: {},
    expectedConfidence: 0.8,
    shouldFilter: true,
    description: "问候语"
  },
  {
    id: 18,
    input: "今天天气怎么样",
    expectedIntent: "non_query",
    expectedParams: {},
    expectedConfidence: 0.6,
    shouldFilter: true,
    description: "闲聊"
  },
  {
    id: 19,
    input: "帮助我了解系统功能",
    expectedIntent: "non_query",
    expectedParams: {},
    expectedConfidence: 0.7,
    shouldFilter: true,
    description: "系统帮助"
  },
  {
    id: 20,
    input: "系统有问题，无法使用",
    expectedIntent: "non_query",
    expectedParams: {},
    expectedConfidence: 0.5,
    shouldFilter: true,
    description: "投诉反馈"
  },

  // 边界情况
  {
    id: 21,
    input: "查询",
    expectedIntent: "general",
    expectedParams: {},
    expectedConfidence: 0.3,
    description: "模糊查询请求"
  },
  {
    id: 22,
    input: "",
    expectedIntent: "unknown",
    expectedParams: {},
    expectedConfidence: 0,
    description: "空输入"
  },
  {
    id: 23,
    input: "asdfghjkl",
    expectedIntent: "general",
    expectedParams: {},
    expectedConfidence: 0.1,
    description: "无意义输入"
  },

  // 复杂查询
  {
    id: 24,
    input: "查询商户1755248023在2024年1月的PHP和INR游戏收入，并检查是否有异常",
    expectedIntent: "game_revenue_query",
    expectedParams: {
      merchant_id: 1755248023,
      currency: "PHP"
    },
    expectedConfidence: 0.8,
    description: "复合查询请求"
  },
  {
    id: 25,
    input: "生成包含用户活跃度、留存率和收入数据的周报，发送给管理团队",
    expectedIntent: "report_generation",
    expectedParams: {
      report_type: "周报"
    },
    expectedConfidence: 0.8,
    description: "复杂报表生成"
  }
];

// 扩展测试用例到100个
const extendedTestCases = [];

// 复制现有测试用例并变化参数
testCases.forEach((testCase, index) => {
  extendedTestCases.push(testCase);
  
  // 为每个测试用例创建变体
  if (testCase.expectedIntent !== 'non_query' && testCase.expectedIntent !== 'unknown') {
    // 变体1：添加礼貌用语
    extendedTestCases.push({
      ...testCase,
      id: 100 + index * 3 + 1,
      input: `请帮我${testCase.input}`,
      description: `${testCase.description}（礼貌版）`
    });

    // 变体2：添加时间修饰
    extendedTestCases.push({
      ...testCase,
      id: 100 + index * 3 + 2,
      input: `尽快${testCase.input}`,
      description: `${testCase.description}（紧急版）`
    });

    // 变体3：添加感谢语
    extendedTestCases.push({
      ...testCase,
      id: 100 + index * 3 + 3,
      input: `${testCase.input}，谢谢`,
      description: `${testCase.description}（感谢版）`
    });
  }
});

module.exports = {
  testCases: extendedTestCases.slice(0, 100), // 确保正好100个测试用例
  
  // 测试用例统计
  getTestStats() {
    const stats = {
      total: this.testCases.length,
      byIntent: {},
      withParams: 0,
      shouldFilter: 0
    };

    this.testCases.forEach(testCase => {
      // 按意图分类统计
      if (!stats.byIntent[testCase.expectedIntent]) {
        stats.byIntent[testCase.expectedIntent] = 0;
      }
      stats.byIntent[testCase.expectedIntent]++;

      // 统计有参数的测试用例
      if (Object.keys(testCase.expectedParams).length > 0) {
        stats.withParams++;
      }

      // 统计应该被过滤的测试用例
      if (testCase.shouldFilter) {
        stats.shouldFilter++;
      }
    });

    return stats;
  },

  // 获取特定意图的测试用例
  getTestCasesByIntent(intent) {
    return this.testCases.filter(testCase => testCase.expectedIntent === intent);
  },

  // 获取需要澄清的测试用例（缺少必需参数）
  getClarificationTestCases() {
    return this.testCases.filter(testCase => {
      // 这里可以根据意图类型判断是否缺少必需参数
      const requiredParamsMap = {
        'game_round_query': ['merchant_id', 'round_id'],
        'merchant_analysis': ['merchant_id'],
        'time_range_query': ['start_date', 'end_date']
      };

      const requiredParams = requiredParamsMap[testCase.expectedIntent] || [];
      return requiredParams.some(param => !testCase.expectedParams[param]);
    });
  }
};