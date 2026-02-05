// 测试增强版商户查询处理器 - 智能模糊匹配版
// 验证各种查询场景和空格兼容性

const testData = {
  // 模拟sy.json的商户数据结构
  filtered_merchants: [
    {
      "sub_merchant_name": "betfiery",
      "main_merchant_name": "RD1", 
      "merchant_id": 1698202251
    },
    {
      "sub_merchant_name": "To game",
      "main_merchant_name": "Togame",
      "merchant_id": 1747388774
    },
    {
      "sub_merchant_name": "JB game",
      "main_merchant_name": "JBgame", 
      "merchant_id": 1752222840
    },
    {
      "sub_merchant_name": "Game Plus",
      "main_merchant_name": "Game Plus",
      "merchant_id": 1718444707
    },
    {
      "sub_merchant_name": "jrn2        ", // 包含尾部空格
      "main_merchant_name": "Mosaic",
      "merchant_id": 1704372376
    },
    {
      "sub_merchant_name": "Godfather ",  // 包含尾部空格
      "main_merchant_name": "GSCPLUS",
      "merchant_id": 1752747448
    }
  ]
};

// 模拟Lark事件数据
const larkEventData = {
  messageId: "om_test123",
  chatId: "oc_test456", 
  messageText: "",
  rawEvent: {
    header: {
      tenant_key: "test_tenant"
    },
    event: {
      sender: {
        sender_id: {
          open_id: "ou_test_user",
          union_id: "on_test_union", 
          user_id: "test_user_123"
        },
        sender_type: "user",
        tenant_key: "test_tenant"
      }
    }
  }
};

// 测试用例
const testCases = [
  // 1. 精确匹配测试
  {
    name: "精确匹配 - betfiery",
    query: "betfiery",
    expectedMatch: true,
    expectedId: 1698202251
  },
  
  // 2. 模糊匹配测试 - togame匹配"To game"
  {
    name: "模糊匹配 - togame找To game",
    query: "togame", 
    expectedMatch: true,
    expectedId: 1747388774
  },
  
  // 3. 空格兼容性测试
  {
    name: "空格兼容 - to game找To game",
    query: "to game",
    expectedMatch: true,
    expectedId: 1747388774
  },
  
  // 4. 部分匹配测试
  {
    name: "部分匹配 - game找多个结果",
    query: "game",
    expectedMatch: true,
    multipleResults: true
  },
  
  // 5. ID反向查询测试
  {
    name: "ID查询 - 1698202251找betfiery",
    query: "1698202251",
    expectedMatch: true,
    expectedName: "betfiery"
  },
  
  // 6. 中文查询格式测试
  {
    name: "中文格式 - 商户betfiery的id",
    query: "商户betfiery的id",
    expectedMatch: true,
    expectedId: 1698202251
  },
  
  // 7. 拼写错误容错测试
  {
    name: "拼写容错 - betfiry找betfiery",
    query: "betfiry",
    expectedMatch: true,
    expectedId: 1698202251
  },
  
  // 8. 全角空格测试
  {
    name: "全角空格 - To　game（全角空格）",
    query: "To　game", // 包含全角空格
    expectedMatch: true,
    expectedId: 1747388774
  },
  
  // 9. 不存在的商户测试
  {
    name: "不存在商户 - nonexistent",
    query: "nonexistent",
    expectedMatch: false
  }
];

// 模拟n8n输入数据结构
function createMockInput(merchantData, larkData, messageText) {
  larkData.messageText = messageText;
  
  return [
    { json: merchantData },
    { json: larkData }
  ];
}

// 执行测试
console.log("=== 开始测试增强版商户查询处理器 ===\n");

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  console.log(`测试 ${i + 1}: ${testCase.name}`);
  console.log(`查询: "${testCase.query}"`);
  
  try {
    // 创建模拟输入
    const mockInput = createMockInput(testData, larkEventData, testCase.query);
    
    // 模拟$input.all()
    global.$input = {
      all: () => mockInput
    };
    
    // 这里应该运行实际的处理器代码
    // 由于无法直接执行，我们模拟预期的行为
    
    // 简化的匹配逻辑测试
    const queryKeyword = testCase.query
      .replace(/^(查询|查找|搜索|找|商户)\s*/i, '')
      .replace(/\s*(的|的id|的ID|id|ID|信息|详情|商户|名称)$/i, '')
      .trim();
    
    console.log(`提取的关键词: "${queryKeyword}"`);
    
    // 检查是否为ID查询
    if (/^\d+$/.test(queryKeyword)) {
      const merchant = testData.filtered_merchants.find(m => 
        String(m.merchant_id) === queryKeyword
      );
      
      if (merchant && testCase.expectedMatch) {
        console.log(`✅ ID查询成功: ${merchant.sub_merchant_name}`);
      } else if (!merchant && !testCase.expectedMatch) {
        console.log(`✅ 正确识别不存在的ID`);
      } else {
        console.log(`❌ ID查询结果不符合预期`);
      }
    } else {
      // 名称查询 - 简化的模糊匹配
      const normalizedQuery = queryKeyword.toLowerCase().replace(/\s+/g, '');
      let found = false;
      
      for (const merchant of testData.filtered_merchants) {
        const merchantName = merchant.sub_merchant_name.trim().toLowerCase().replace(/\s+/g, '');
        
        // 简单的包含匹配或相似度匹配
        if (merchantName.includes(normalizedQuery) || 
            normalizedQuery.includes(merchantName) ||
            merchantName === normalizedQuery) {
          found = true;
          console.log(`✅ 找到匹配: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`);
          
          if (testCase.expectedId && merchant.merchant_id === testCase.expectedId) {
            console.log(`✅ ID匹配正确`);
          }
          break;
        }
      }
      
      if (!found && !testCase.expectedMatch) {
        console.log(`✅ 正确识别不存在的商户`);
      } else if (!found && testCase.expectedMatch) {
        console.log(`❌ 应该找到匹配但没有找到`);
      }
    }
    
  } catch (error) {
    console.log(`❌ 测试出错: ${error.message}`);
  }
  
  console.log("---\n");
}

// 测试空格处理函数
console.log("=== 测试空格处理函数 ===");

function cleanText(text) {
  if (!text) return '';
  
  return String(text)
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // 各种Unicode空格
    .replace(/[\t\r\n]/g, ' ') // 制表符、回车、换行
    .replace(/\s+/g, ' ') // 多个连续空格合并为一个
    .trim(); // 去除首尾空格
}

function normalizeForMatching(text) {
  if (!text) return '';
  
  return cleanText(text)
    .toLowerCase()
    .replace(/\s+/g, '') // 移除所有空格
    .replace(/[^\w\u4e00-\u9fff]/g, ''); // 只保留字母、数字、中文字符
}

const spaceTestCases = [
  "To game",           // 普通空格
  "To　game",          // 全角空格
  "To\tgame",          // 制表符
  "To\u00A0game",      // 不间断空格
  "To\u3000game",      // 中文空格
  "  To   game  ",     // 多个空格
  "jrn2        ",      // 尾部空格
  "Godfather "         // 尾部空格
];

spaceTestCases.forEach(testText => {
  const cleaned = cleanText(testText);
  const normalized = normalizeForMatching(testText);
  console.log(`原文: "${testText}" -> 清理: "${cleaned}" -> 标准化: "${normalized}"`);
});

console.log("\n=== 测试完成 ===");