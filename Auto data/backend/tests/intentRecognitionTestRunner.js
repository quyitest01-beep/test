/**
 * 意图识别测试运行器
 * 用于验证意图识别准确率是否达到≥95%的目标
 */

const IntentRecognitionService = require('../services/intentRecognitionService');
const { testCases } = require('./intentRecognitionTestCases');
const logger = require('../utils/logger');

class IntentRecognitionTestRunner {
  constructor() {
    this.intentService = new IntentRecognitionService();
  }

  /**
   * 运行完整的准确率测试
   */
  async runFullAccuracyTest() {
    console.log('🚀 开始意图识别准确率测试...');
    console.log(`📊 测试用例总数: ${testCases.length}`);
    console.log('=' * 50);

    const startTime = Date.now();
    const results = await this.intentService.runAccuracyTest(testCases);
    const endTime = Date.now();

    // 输出详细结果
    this.printTestResults(results, endTime - startTime);

    // 分析结果
    this.analyzeResults(results);

    return results;
  }

  /**
   * 运行特定意图类型的测试
   */
  async runIntentSpecificTest(intentType) {
    const filteredTestCases = testCases.filter(tc => tc.expectedIntent === intentType);
    
    if (filteredTestCases.length === 0) {
      console.log(`❌ 没有找到意图类型 "${intentType}" 的测试用例`);
      return null;
    }

    console.log(`🎯 测试意图类型: ${intentType}`);
    console.log(`📊 测试用例数量: ${filteredTestCases.length}`);
    console.log('-' * 30);

    const results = await this.intentService.runAccuracyTest(filteredTestCases);
    this.printTestResults(results);

    return results;
  }

  /**
   * 运行澄清机制测试
   */
  async runClarificationTest() {
    console.log('🔍 测试澄清机制...');
    
    const clarificationTestCases = [
      {
        id: 'c1',
        input: '查询游戏数据',
        expectedIntent: 'game_revenue_query',
        expectClarification: true
      },
      {
        id: 'c2', 
        input: '我要商户数据',
        expectedIntent: 'merchant_analysis',
        expectClarification: true
      },
      {
        id: 'c3',
        input: '生成报表',
        expectedIntent: 'report_generation',
        expectClarification: true
      }
    ];

    let clarificationCount = 0;
    const results = [];

    for (const testCase of clarificationTestCases) {
      const result = await this.intentService.processQuery(testCase.input);
      
      const needsClarification = result.type === 'clarification_needed';
      if (needsClarification) {
        clarificationCount++;
      }

      results.push({
        ...testCase,
        needsClarification,
        clarificationQuestions: result.clarificationQuestions || [],
        success: needsClarification === testCase.expectClarification
      });

      console.log(`${needsClarification ? '✅' : '❌'} ${testCase.input} - ${needsClarification ? '需要澄清' : '无需澄清'}`);
      if (needsClarification && result.clarificationQuestions) {
        result.clarificationQuestions.forEach(q => console.log(`   💬 ${q}`));
      }
    }

    const clarificationAccuracy = (results.filter(r => r.success).length / results.length) * 100;
    console.log(`\n📈 澄清机制准确率: ${clarificationAccuracy.toFixed(1)}%`);

    return { clarificationCount, results, accuracy: clarificationAccuracy };
  }

  /**
   * 运行过滤机制测试
   */
  async runFilterTest() {
    console.log('🚫 测试过滤机制...');
    
    const filterTestCases = testCases.filter(tc => tc.shouldFilter);
    let filteredCount = 0;
    const results = [];

    for (const testCase of filterTestCases) {
      const result = await this.intentService.processQuery(testCase.input);
      
      const isFiltered = result.type === 'filtered';
      if (isFiltered) {
        filteredCount++;
      }

      results.push({
        ...testCase,
        isFiltered,
        success: isFiltered
      });

      console.log(`${isFiltered ? '✅' : '❌'} ${testCase.input} - ${isFiltered ? '已过滤' : '未过滤'}`);
    }

    const filterAccuracy = (filteredCount / filterTestCases.length) * 100;
    console.log(`\n📈 过滤机制准确率: ${filterAccuracy.toFixed(1)}%`);

    return { filteredCount, results, accuracy: filterAccuracy };
  }

  /**
   * 打印测试结果
   */
  printTestResults(results, executionTime = null) {
    console.log('\n📊 测试结果统计:');
    console.log('=' * 30);
    console.log(`总测试用例: ${results.total}`);
    console.log(`正确识别: ${results.correct} (${(results.correct/results.total*100).toFixed(1)}%)`);
    console.log(`错误识别: ${results.incorrect} (${(results.incorrect/results.total*100).toFixed(1)}%)`);
    console.log(`已过滤: ${results.filtered} (${(results.filtered/results.total*100).toFixed(1)}%)`);
    console.log(`需澄清: ${results.clarification} (${(results.clarification/results.total*100).toFixed(1)}%)`);
    console.log(`\n🎯 总体准确率: ${results.accuracy.toFixed(2)}%`);
    
    if (executionTime) {
      console.log(`⏱️  执行时间: ${executionTime}ms`);
      console.log(`⚡ 平均处理时间: ${(executionTime/results.total).toFixed(1)}ms/条`);
    }

    // 准确率评估
    if (results.accuracy >= 95) {
      console.log('🎉 恭喜！准确率达到≥95%的目标要求！');
    } else if (results.accuracy >= 90) {
      console.log('⚠️  准确率接近目标，需要进一步优化');
    } else {
      console.log('❌ 准确率未达标，需要大幅改进');
    }
  }

  /**
   * 分析测试结果，提供改进建议
   */
  analyzeResults(results) {
    console.log('\n🔍 结果分析:');
    console.log('-' * 20);

    // 按意图类型分析错误
    const errorsByIntent = {};
    const correctByIntent = {};

    results.details.forEach(detail => {
      if (!detail.correct && !detail.shouldFilter) {
        if (!errorsByIntent[detail.expected]) {
          errorsByIntent[detail.expected] = [];
        }
        errorsByIntent[detail.expected].push(detail);
      }
      
      if (detail.correct) {
        correctByIntent[detail.expected] = (correctByIntent[detail.expected] || 0) + 1;
      }
    });

    // 输出各意图类型的准确率
    console.log('\n📈 各意图类型准确率:');
    const intentTypes = [...new Set(results.details.map(d => d.expected))];
    
    intentTypes.forEach(intent => {
      const totalForIntent = results.details.filter(d => d.expected === intent).length;
      const correctForIntent = correctByIntent[intent] || 0;
      const accuracy = (correctForIntent / totalForIntent * 100).toFixed(1);
      
      console.log(`  ${intent}: ${accuracy}% (${correctForIntent}/${totalForIntent})`);
    });

    // 输出需要改进的意图类型
    if (Object.keys(errorsByIntent).length > 0) {
      console.log('\n⚠️  需要改进的意图类型:');
      Object.entries(errorsByIntent).forEach(([intent, errors]) => {
        console.log(`  ${intent}: ${errors.length}个错误`);
        errors.slice(0, 3).forEach(error => {
          console.log(`    - "${error.input}" -> 识别为: ${error.actual}`);
        });
      });
    }

    // 置信度分析
    const confidences = results.details.map(d => d.confidence).filter(c => c > 0);
    if (confidences.length > 0) {
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const lowConfidenceCount = confidences.filter(c => c < 0.7).length;
      
      console.log('\n📊 置信度分析:');
      console.log(`  平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`  低置信度(<70%): ${lowConfidenceCount}个 (${(lowConfidenceCount/confidences.length*100).toFixed(1)}%)`);
    }
  }

  /**
   * 生成测试报告
   */
  async generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Intent Recognition Accuracy Test',
      target: '≥95% accuracy',
      results: {}
    };

    // 运行各项测试
    console.log('📋 生成完整测试报告...\n');
    
    report.results.fullTest = await this.runFullAccuracyTest();
    console.log('\n');
    
    report.results.clarificationTest = await this.runClarificationTest();
    console.log('\n');
    
    report.results.filterTest = await this.runFilterTest();
    console.log('\n');

    // 计算综合评分
    const overallAccuracy = report.results.fullTest.accuracy;
    const clarificationAccuracy = report.results.clarificationTest.accuracy;
    const filterAccuracy = report.results.filterTest.accuracy;
    
    report.overallScore = (overallAccuracy * 0.7 + clarificationAccuracy * 0.15 + filterAccuracy * 0.15);
    report.passed = report.overallScore >= 95;

    console.log('📊 综合评估:');
    console.log('=' * 30);
    console.log(`意图识别准确率: ${overallAccuracy.toFixed(2)}% (权重70%)`);
    console.log(`澄清机制准确率: ${clarificationAccuracy.toFixed(2)}% (权重15%)`);
    console.log(`过滤机制准确率: ${filterAccuracy.toFixed(2)}% (权重15%)`);
    console.log(`\n🏆 综合得分: ${report.overallScore.toFixed(2)}%`);
    console.log(`📋 测试结果: ${report.passed ? '✅ 通过' : '❌ 未通过'}`);

    return report;
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const testRunner = new IntentRecognitionTestRunner();
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  switch (command) {
    case 'full':
      testRunner.runFullAccuracyTest();
      break;
    case 'clarification':
      testRunner.runClarificationTest();
      break;
    case 'filter':
      testRunner.runFilterTest();
      break;
    case 'report':
      testRunner.generateTestReport();
      break;
    case 'intent':
      if (args[1]) {
        testRunner.runIntentSpecificTest(args[1]);
      } else {
        console.log('请指定意图类型，例如: node intentRecognitionTestRunner.js intent game_round_query');
      }
      break;
    default:
      console.log('可用命令:');
      console.log('  full - 运行完整准确率测试');
      console.log('  clarification - 测试澄清机制');
      console.log('  filter - 测试过滤机制');
      console.log('  report - 生成完整测试报告');
      console.log('  intent <type> - 测试特定意图类型');
  }
}

module.exports = IntentRecognitionTestRunner;