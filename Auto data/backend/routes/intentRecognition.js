/**
 * 意图识别API路由
 * 提供意图识别、澄清机制和过滤机制的API接口
 */

const express = require('express');
const router = express.Router();
const IntentRecognitionService = require('../services/intentRecognitionService');
const IntentRecognitionTestRunner = require('../tests/intentRecognitionTestRunner');
const logger = require('../utils/logger');

// 创建意图识别服务实例
const intentService = new IntentRecognitionService();
const testRunner = new IntentRecognitionTestRunner();

/**
 * POST /api/intent/recognize
 * 识别查询意图
 */
router.post('/recognize', async (req, res) => {
  try {
    const { queryText, options = {} } = req.body;

    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({
        success: false,
        error: '查询文本不能为空'
      });
    }

    logger.info('收到意图识别请求', { 
      queryText: queryText.substring(0, 100),
      userId: req.user?.id 
    });

    const result = await intentService.processQuery(queryText, options);

    res.json(result);

  } catch (error) {
    logger.error('意图识别API错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '意图识别服务异常',
      details: error.message
    });
  }
});

/**
 * POST /api/intent/clarify
 * 处理澄清回复
 */
router.post('/clarify', async (req, res) => {
  try {
    const { originalQuery, clarificationResponse, sessionId } = req.body;

    if (!originalQuery || !clarificationResponse) {
      return res.status(400).json({
        success: false,
        error: '原始查询和澄清回复不能为空'
      });
    }

    // 合并原始查询和澄清回复
    const enhancedQuery = `${originalQuery} ${clarificationResponse}`;
    
    logger.info('处理澄清回复', { 
      originalQuery: originalQuery.substring(0, 50),
      clarificationResponse: clarificationResponse.substring(0, 50),
      sessionId 
    });

    const result = await intentService.processQuery(enhancedQuery);

    res.json({
      ...result,
      sessionId,
      isFollowUp: true
    });

  } catch (error) {
    logger.error('澄清处理API错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '澄清处理服务异常',
      details: error.message
    });
  }
});

/**
 * GET /api/intent/stats
 * 获取意图识别统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = intentService.getStats();
    const systemInfo = intentService.getSystemInfo();

    res.json({
      success: true,
      stats,
      systemInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('获取统计信息错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '获取统计信息失败',
      details: error.message
    });
  }
});

/**
 * POST /api/intent/test/accuracy
 * 运行准确率测试
 */
router.post('/test/accuracy', async (req, res) => {
  try {
    const { testType = 'full' } = req.body;

    logger.info('开始准确率测试', { testType });

    let result;
    switch (testType) {
      case 'full':
        result = await testRunner.runFullAccuracyTest();
        break;
      case 'clarification':
        result = await testRunner.runClarificationTest();
        break;
      case 'filter':
        result = await testRunner.runFilterTest();
        break;
      case 'report':
        result = await testRunner.generateTestReport();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '不支持的测试类型',
          supportedTypes: ['full', 'clarification', 'filter', 'report']
        });
    }

    res.json({
      success: true,
      testType,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('准确率测试错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '准确率测试失败',
      details: error.message
    });
  }
});

/**
 * POST /api/intent/test/intent-specific
 * 测试特定意图类型
 */
router.post('/test/intent-specific', async (req, res) => {
  try {
    const { intentType } = req.body;

    if (!intentType) {
      return res.status(400).json({
        success: false,
        error: '意图类型不能为空'
      });
    }

    logger.info('开始特定意图测试', { intentType });

    const result = await testRunner.runIntentSpecificTest(intentType);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `没有找到意图类型 "${intentType}" 的测试用例`
      });
    }

    res.json({
      success: true,
      intentType,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('特定意图测试错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '特定意图测试失败',
      details: error.message
    });
  }
});

/**
 * POST /api/intent/reset-stats
 * 重置统计信息
 */
router.post('/reset-stats', async (req, res) => {
  try {
    intentService.resetStats();
    
    logger.info('统计信息已重置');

    res.json({
      success: true,
      message: '统计信息已重置',
      stats: intentService.getStats()
    });

  } catch (error) {
    logger.error('重置统计信息错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '重置统计信息失败',
      details: error.message
    });
  }
});

/**
 * GET /api/intent/supported-intents
 * 获取支持的意图类型列表
 */
router.get('/supported-intents', async (req, res) => {
  try {
    const systemInfo = intentService.getSystemInfo();
    const supportedIntents = systemInfo.enhancedIntentRecognition.supportedIntents;

    res.json({
      success: true,
      supportedIntents,
      totalIntents: supportedIntents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('获取支持意图列表错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '获取支持意图列表失败',
      details: error.message
    });
  }
});

module.exports = router;