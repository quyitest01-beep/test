/**
 * 增强版意图识别系统
 * 支持游戏业务场景、置信度评分、澄清机制和过滤机制
 */

const logger = require('../utils/logger');

class EnhancedIntentRecognition {
  constructor() {
    // 扩展的意图模板，包含游戏业务场景
    this.intentTemplates = {
      // 游戏相关查询
      game_round_query: {
        keywords: ['回合', '游戏记录', 'round', 'biz_id', 'round_id', '异常', '检查', '游戏', '记录'],
        required_params: ['merchant_id', 'round_id'],
        optional_params: ['biz_id', 'game_id'],
        tables: ['game_rounds', 'game_transactions'],
        confidence_boost: 0.2,
        description: '游戏回合记录查询'
      },
      game_revenue_query: {
        keywords: ['游戏收入', '营收', 'GGR', '投注', '派奖', '游戏数据', '游戏', '收入', '营业额', '昨天', '今天', '本月'],
        required_params: ['time_range'],
        optional_params: ['merchant_id', 'game_id', 'currency'],
        tables: ['game_revenue', 'merchant_revenue'],
        confidence_boost: 0.15,
        description: '游戏收入数据查询'
      },
      merchant_analysis: {
        keywords: ['商户', '平台', 'merchant', '对比', '分析', '业绩', '表现', '商户ID'],
        required_params: ['merchant_id'],
        optional_params: ['time_range', 'comparison_period'],
        tables: ['merchants', 'merchant_stats'],
        confidence_boost: 0.1,
        description: '商户数据分析'
      },
      time_range_query: {
        keywords: ['时间', '日期', '范围', '号到', '月份', '周', '日', '1号到31号', '2024', '到'],
        required_params: ['start_date', 'end_date'],
        optional_params: ['currency', 'merchant_id'],
        tables: ['daily_stats', 'time_series'],
        confidence_boost: 0.1,
        description: '时间范围数据查询'
      },
      currency_query: {
        keywords: ['PHP', 'INR', 'USD', 'MYR', '币种', '货币', '汇率', '交易数据', '三种币种'],
        required_params: ['currency'],
        optional_params: ['time_range', 'merchant_id'],
        tables: ['currency_data', 'exchange_rates'],
        confidence_boost: 0.15,
        description: '币种相关查询'
      },
      user_behavior_query: {
        keywords: ['用户', '行为', '活跃', '留存', '新用户', 'DAU', 'MAU', '留存率', '统计'],
        required_params: ['metric_type'],
        optional_params: ['time_range', 'user_segment'],
        tables: ['user_stats', 'user_behavior'],
        confidence_boost: 0.1,
        description: '用户行为分析'
      },
      report_generation: {
        keywords: ['报表', '报告', '月报', '周报', '日报', '生成', '发送', '月活', '日活', '净营收', '指标'],
        required_params: ['report_type'],
        optional_params: ['metrics', 'recipients', 'schedule'],
        tables: ['reports', 'report_templates'],
        confidence_boost: 0.2,
        description: '报表生成请求'
      },
      anomaly_detection: {
        keywords: ['异常', '检测', '风险', '问题', '错误', '不正常', '数据异常', '风险数据'],
        required_params: ['data_source'],
        optional_params: ['threshold', 'time_range'],
        tables: ['anomaly_logs', 'data_quality'],
        confidence_boost: 0.25,
        description: '异常检测查询'
      }
    };

    // 非查数请求模式（用于过滤）
    this.nonQueryPatterns = {
      greetings: {
        keywords: ['你好', 'hello', 'hi', '早上好', '下午好', '晚上好'],
        confidence_threshold: 0.8,
        description: '问候语'
      },
      chitchat: {
        keywords: ['怎么样', '如何', '天气', '吃饭', '休息', '聊天'],
        confidence_threshold: 0.6,
        description: '闲聊'
      },
      system_commands: {
        keywords: ['帮助', 'help', '指令', '命令', '功能', '使用方法'],
        confidence_threshold: 0.7,
        description: '系统指令'
      },
      complaints: {
        keywords: ['投诉', '抱怨', '不满', '问题', '故障', '错误'],
        confidence_threshold: 0.5,
        description: '投诉反馈'
      }
    };

    // 参数提取模式
    this.parameterPatterns = {
      merchant_id: {
        patterns: [
          /MerchantID[：:]\s*(\d+)/i,
          /商户ID[：:]\s*(\d+)/i,
          /merchant[：:]\s*(\d+)/i
        ],
        type: 'number'
      },
      round_id: {
        patterns: [
          /round_id[：:]\s*(\d+)/i,
          /回合ID[：:]\s*(\d+)/i,
          /回合[：:]\s*(\d+)/i
        ],
        type: 'string'
      },
      biz_id: {
        patterns: [
          /biz_id[：:]\s*([a-zA-Z0-9\-_]+)/i,
          /业务ID[：:]\s*([a-zA-Z0-9\-_]+)/i
        ],
        type: 'string'
      },
      time_range: {
        patterns: [
          /(\d+)号到(\d+)号/,
          /(\d{4}-\d{2}-\d{2})\s*到\s*(\d{4}-\d{2}-\d{2})/,
          /最近(\d+)天/,
          /(\d+)月份?/
        ],
        type: 'date_range'
      },
      currency: {
        patterns: [
          /(PHP|INR|USD|MYR|CNY|EUR|GBP)/gi,
          /([A-Z]{3})\s*数据/gi
        ],
        type: 'string'
      }
    };
  }

  /**
   * 主要的意图识别方法
   * @param {string} queryText - 用户查询文本
   * @returns {Object} 识别结果
   */
  async recognizeIntent(queryText) {
    try {
      logger.info('开始意图识别', { queryText });

      // 1. 预处理文本
      const processedText = this.preprocessText(queryText);

      // 2. 检查是否为非查数请求
      const nonQueryResult = this.checkNonQueryRequest(processedText);
      if (nonQueryResult.isNonQuery) {
        return {
          intent: 'non_query',
          confidence: nonQueryResult.confidence,
          type: nonQueryResult.type,
          description: nonQueryResult.description,
          shouldFilter: true,
          message: '这似乎不是一个数据查询请求。如需查询数据，请描述您需要的具体数据。'
        };
      }

      // 3. 进行意图匹配
      const intentResult = this.matchIntent(processedText);

      // 4. 提取参数
      const parameters = this.extractParameters(queryText);

      // 5. 检查参数完整性
      const missingParams = this.checkMissingParameters(intentResult, parameters);

      // 6. 生成澄清问题（如果需要）
      const clarificationQuestions = this.generateClarificationQuestions(
        intentResult, 
        missingParams
      );

      // 7. 计算最终置信度
      const finalConfidence = this.calculateFinalConfidence(
        intentResult, 
        parameters, 
        missingParams
      );

      const result = {
        intent: intentResult.type,
        confidence: finalConfidence,
        description: intentResult.description,
        parameters,
        missingParams,
        clarificationQuestions,
        needsClarification: missingParams.length > 0,
        shouldFilter: false,
        tables: intentResult.tables,
        keywords: intentResult.keywords
      };

      logger.info('意图识别完成', { 
        intent: result.intent, 
        confidence: result.confidence,
        needsClarification: result.needsClarification
      });

      return result;

    } catch (error) {
      logger.error('意图识别失败', { error: error.message, queryText });
      return {
        intent: 'unknown',
        confidence: 0,
        error: error.message,
        shouldFilter: false
      };
    }
  }

  /**
   * 预处理文本
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[，。！？；：]/g, ' ') // 替换中文标点
      .replace(/[,.!?;:]/g, ' ')     // 替换英文标点
      .replace(/\s+/g, ' ');         // 合并多个空格
  }

  /**
   * 检查是否为非查数请求
   */
  checkNonQueryRequest(text) {
    let maxConfidence = 0;
    let matchedType = null;
    let matchedDescription = '';

    for (const [type, pattern] of Object.entries(this.nonQueryPatterns)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of pattern.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += keyword.length * 2; // 提高非查数请求的权重
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length > 0) {
        // 改进置信度计算，考虑匹配关键词的数量和质量
        const keywordCoverage = matchedKeywords.length / pattern.keywords.length;
        const textCoverage = score / Math.max(text.length, 1);
        const confidence = Math.min((keywordCoverage * 0.7 + textCoverage * 0.3), 1);
        
        if (confidence > maxConfidence && confidence >= pattern.confidence_threshold) {
          maxConfidence = confidence;
          matchedType = type;
          matchedDescription = pattern.description;
        }
      }
    }

    // 特殊处理：空字符串或很短的无意义文本
    if (text.length === 0 || (text.length < 3 && !/\d/.test(text))) {
      return {
        isNonQuery: true,
        confidence: 0.9,
        type: 'invalid_input',
        description: '无效输入'
      };
    }

    return {
      isNonQuery: maxConfidence > 0.5, // 提高过滤阈值
      confidence: maxConfidence,
      type: matchedType,
      description: matchedDescription
    };
  }

  /**
   * 匹配查询意图
   */
  matchIntent(text) {
    let bestMatch = { 
      type: 'general', 
      score: 0, 
      tables: ['general_data'], 
      keywords: [],
      description: '通用查询',
      confidence_boost: 0
    };

    for (const [intentType, template] of Object.entries(this.intentTemplates)) {
      let score = 0;
      const matchedKeywords = [];

      // 关键词匹配
      for (const keyword of template.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += keyword.length * 3; // 提高关键词权重
          matchedKeywords.push(keyword);
        }
      }

      // 表名匹配
      const matchedTables = [];
      for (const table of template.tables) {
        if (text.includes(table)) {
          score += 15; // 表名匹配权重很高
          matchedTables.push(table);
        }
      }

      // 应用置信度提升
      score += template.confidence_boost * 100;

      // 只有当得分大于0时才考虑这个意图
      if (score > 0 && score > bestMatch.score) {
        bestMatch = {
          type: intentType,
          score,
          tables: matchedTables.length > 0 ? matchedTables : template.tables,
          keywords: matchedKeywords,
          description: template.description,
          confidence_boost: template.confidence_boost,
          template
        };
      }
    }

    // 如果没有找到任何匹配的关键词，保持为general而不是异常检测
    if (bestMatch.score === 0) {
      bestMatch.type = 'general';
    }

    return bestMatch;
  }

  /**
   * 提取查询参数
   */
  extractParameters(text) {
    const parameters = {};

    for (const [paramName, config] of Object.entries(this.parameterPatterns)) {
      for (const pattern of config.patterns) {
        try {
          const match = text.match(pattern);
          if (match && match[1]) {
            let value = match[1];
            
            // 根据类型转换值
            switch (config.type) {
              case 'number':
                value = parseInt(value);
                if (isNaN(value)) continue;
                break;
              case 'date_range':
                if (match[2]) {
                  value = { start: match[1], end: match[2] };
                } else {
                  value = match[1];
                }
                break;
              case 'string':
              default:
                value = value.toString().trim();
                if (!value) continue;
                break;
            }

            parameters[paramName] = value;
            break; // 找到第一个匹配就停止
          }
        } catch (error) {
          // 忽略参数提取错误，继续处理其他参数
          continue;
        }
      }
    }

    return parameters;
  }

  /**
   * 检查缺失的必需参数
   */
  checkMissingParameters(intentResult, parameters) {
    const missingParams = [];
    
    if (intentResult.template && intentResult.template.required_params) {
      for (const requiredParam of intentResult.template.required_params) {
        if (!parameters[requiredParam]) {
          missingParams.push(requiredParam);
        }
      }
    }

    return missingParams;
  }

  /**
   * 生成澄清问题
   */
  generateClarificationQuestions(intentResult, missingParams) {
    const questions = [];

    const paramQuestions = {
      merchant_id: '请提供商户ID（MerchantID）',
      round_id: '请提供回合ID（round_id）',
      biz_id: '请提供业务ID（biz_id）',
      time_range: '请指定时间范围（如：1号到31号，或具体日期）',
      currency: '请指定币种（如：PHP、INR、USD等）',
      game_id: '请提供游戏ID',
      report_type: '请指定报表类型（日报、周报、月报）',
      metric_type: '请指定要查询的指标类型',
      data_source: '请指定要检查的数据源'
    };

    for (const param of missingParams) {
      if (paramQuestions[param]) {
        questions.push(paramQuestions[param]);
      }
    }

    return questions;
  }

  /**
   * 计算最终置信度
   */
  calculateFinalConfidence(intentResult, parameters, missingParams) {
    let baseConfidence = Math.min(intentResult.score / 50, 0.9); // 调整基础分数计算
    
    // 应用置信度提升
    baseConfidence += intentResult.confidence_boost;
    
    // 参数完整性影响置信度
    if (intentResult.template && intentResult.template.required_params) {
      const totalRequired = intentResult.template.required_params.length;
      const providedRequired = totalRequired - missingParams.length;
      const parameterCompleteness = totalRequired > 0 ? providedRequired / totalRequired : 1;
      
      // 如果有必需参数但都缺失，大幅降低置信度
      if (totalRequired > 0 && providedRequired === 0) {
        baseConfidence *= 0.3;
      } else {
        baseConfidence *= (0.6 + 0.4 * parameterCompleteness);
      }
    }

    // 关键词匹配度影响
    const keywordBonus = Math.min(intentResult.keywords.length * 0.1, 0.3);
    baseConfidence += keywordBonus;

    // 确保置信度在合理范围内
    return Math.max(0.1, Math.min(baseConfidence, 1.0));
  }

  /**
   * 获取意图统计信息
   */
  getIntentStats() {
    return {
      totalIntents: Object.keys(this.intentTemplates).length,
      nonQueryPatterns: Object.keys(this.nonQueryPatterns).length,
      parameterPatterns: Object.keys(this.parameterPatterns).length,
      supportedIntents: Object.keys(this.intentTemplates),
      version: '1.0.0'
    };
  }
}

module.exports = EnhancedIntentRecognition;