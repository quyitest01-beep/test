/**
 * 意图识别服务集成层
 * 连接增强版意图识别系统与现有Python代码生成器
 */

const EnhancedIntentRecognition = require('./enhancedIntentRecognition');
const pythonCodeGenerator = require('./pythonCodeGenerator');
const logger = require('../utils/logger');

class IntentRecognitionService {
  constructor() {
    this.enhancedIntentRecognition = new EnhancedIntentRecognition();
    this.pythonCodeGenerator = pythonCodeGenerator;
    
    // 意图识别统计
    this.stats = {
      totalQueries: 0,
      successfulRecognitions: 0,
      filteredQueries: 0,
      clarificationRequests: 0,
      accuracyRate: 0
    };
  }

  /**
   * 主要的查询处理方法
   * @param {string} queryText - 用户查询文本
   * @param {Object} options - 处理选项
   * @returns {Object} 处理结果
   */
  async processQuery(queryText, options = {}) {
    try {
      this.stats.totalQueries++;
      
      logger.info('开始处理查询请求', { 
        queryText: queryText.substring(0, 100),
        totalQueries: this.stats.totalQueries
      });

      // 1. 使用增强版意图识别系统
      const intentResult = await this.enhancedIntentRecognition.recognizeIntent(queryText);
      
      // 2. 检查是否需要过滤
      if (intentResult.shouldFilter) {
        this.stats.filteredQueries++;
        return {
          success: false,
          type: 'filtered',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          message: intentResult.message,
          stats: this.getStats()
        };
      }

      // 3. 检查是否需要澄清
      if (intentResult.needsClarification) {
        this.stats.clarificationRequests++;
        return {
          success: false,
          type: 'clarification_needed',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          missingParams: intentResult.missingParams,
          clarificationQuestions: intentResult.clarificationQuestions,
          parameters: intentResult.parameters,
          stats: this.getStats()
        };
      }

      // 4. 意图识别成功，生成Python代码
      if (intentResult.confidence >= 0.7) {
        this.stats.successfulRecognitions++;
        
        // 将增强版意图结果转换为Python代码生成器格式
        const enhancedQueryText = this.enhanceQueryText(queryText, intentResult);
        
        const pythonResult = await this.pythonCodeGenerator.generatePythonCode(
          enhancedQueryText, 
          null, 
          options
        );

        // 合并结果
        const result = {
          success: true,
          type: 'query_generated',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          parameters: intentResult.parameters,
          python_code: pythonResult.python_code,
          sql_query: pythonResult.sql_query,
          estimated_time: pythonResult.estimated_time,
          estimated_rows: pythonResult.estimated_rows,
          requires_split: pythonResult.requires_split,
          tables: intentResult.tables,
          keywords: intentResult.keywords,
          stats: this.getStats()
        };

        this.updateAccuracyRate();
        
        logger.info('查询处理成功', {
          intent: result.intent,
          confidence: result.confidence,
          accuracyRate: this.stats.accuracyRate
        });

        return result;
      } else {
        // 置信度不足，返回低置信度结果
        return {
          success: false,
          type: 'low_confidence',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          message: `意图识别置信度较低 (${(intentResult.confidence * 100).toFixed(1)}%)，请提供更详细的查询描述`,
          suggestions: this.generateSuggestions(intentResult),
          stats: this.getStats()
        };
      }

    } catch (error) {
      logger.error('查询处理失败', { error: error.message, queryText });
      return {
        success: false,
        type: 'error',
        error: error.message,
        stats: this.getStats()
      };
    }
  }

  /**
   * 增强查询文本，添加识别出的参数信息
   */
  enhanceQueryText(originalText, intentResult) {
    let enhancedText = originalText;
    
    // 如果识别出了参数，将其添加到查询文本中以提高SQL生成准确性
    if (intentResult.parameters && Object.keys(intentResult.parameters).length > 0) {
      const paramStrings = [];
      
      for (const [key, value] of Object.entries(intentResult.parameters)) {
        if (value !== null && value !== undefined) {
          paramStrings.push(`${key}: ${value}`);
        }
      }
      
      if (paramStrings.length > 0) {
        enhancedText += ` [参数: ${paramStrings.join(', ')}]`;
      }
    }
    
    // 添加意图信息以指导SQL生成
    enhancedText += ` [意图: ${intentResult.intent}]`;
    
    return enhancedText;
  }

  /**
   * 生成改进建议
   */
  generateSuggestions(intentResult) {
    const suggestions = [];
    
    // 基于意图类型提供建议
    switch (intentResult.intent) {
      case 'game_round_query':
        suggestions.push('请提供具体的商户ID和回合ID');
        suggestions.push('例如：查询商户1755248023的回合记录1964961557724336128');
        break;
      case 'time_range_query':
        suggestions.push('请指定具体的时间范围');
        suggestions.push('例如：查询2024年1月1日到31日的数据');
        break;
      case 'merchant_analysis':
        suggestions.push('请提供商户ID或商户名称');
        suggestions.push('例如：分析商户12345的业绩表现');
        break;
      default:
        suggestions.push('请提供更具体的查询条件');
        suggestions.push('包括时间范围、数据类型、筛选条件等');
    }
    
    return suggestions;
  }

  /**
   * 更新准确率统计
   */
  updateAccuracyRate() {
    if (this.stats.totalQueries > 0) {
      this.stats.accuracyRate = (this.stats.successfulRecognitions / this.stats.totalQueries) * 100;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      accuracyRate: parseFloat(this.stats.accuracyRate.toFixed(2))
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalQueries: 0,
      successfulRecognitions: 0,
      filteredQueries: 0,
      clarificationRequests: 0,
      accuracyRate: 0
    };
  }

  /**
   * 批量测试意图识别准确率
   * @param {Array} testCases - 测试用例数组
   * @returns {Object} 测试结果
   */
  async runAccuracyTest(testCases) {
    const results = {
      total: testCases.length,
      correct: 0,
      incorrect: 0,
      filtered: 0,
      clarification: 0,
      details: []
    };

    for (const testCase of testCases) {
      try {
        const result = await this.enhancedIntentRecognition.recognizeIntent(testCase.input);
        
        const isCorrect = result.intent === testCase.expectedIntent;
        const shouldFilter = testCase.shouldFilter || false;
        
        if (result.shouldFilter && shouldFilter) {
          results.filtered++;
          results.correct++;
        } else if (result.needsClarification) {
          results.clarification++;
        } else if (isCorrect) {
          results.correct++;
        } else {
          results.incorrect++;
        }

        results.details.push({
          id: testCase.id,
          input: testCase.input,
          expected: testCase.expectedIntent,
          actual: result.intent,
          confidence: result.confidence,
          correct: isCorrect,
          shouldFilter: result.shouldFilter,
          needsClarification: result.needsClarification
        });

      } catch (error) {
        results.incorrect++;
        results.details.push({
          id: testCase.id,
          input: testCase.input,
          expected: testCase.expectedIntent,
          actual: 'error',
          confidence: 0,
          correct: false,
          error: error.message
        });
      }
    }

    results.accuracy = (results.correct / results.total) * 100;
    
    logger.info('意图识别准确率测试完成', {
      total: results.total,
      correct: results.correct,
      accuracy: results.accuracy.toFixed(2) + '%'
    });

    return results;
  }

  /**
   * 获取意图识别系统信息
   */
  getSystemInfo() {
    return {
      enhancedIntentRecognition: this.enhancedIntentRecognition.getIntentStats(),
      stats: this.getStats(),
      version: '1.0.0',
      features: [
        '增强版意图识别',
        '多轮对话澄清',
        '非查数请求过滤',
        '置信度评分',
        '参数提取',
        'Python代码生成集成'
      ]
    };
  }
}

module.exports = IntentRecognitionService;