# n8n Merge节点SQL查询问题解决方案

## 问题分析
错误 `Cannot read properties of undefined (reading 'input1')` 表明n8n的Merge节点SQL查询语法与我们使用的标准SQL不同。

## 解决方案1: 使用n8n兼容的SQL语法

```sql
SELECT 
    input2.extractedData.merchant as merchant,
    sub_merchant.merchant_id as merchantid,
    input2.extractedData.betId as betId,
    input2.extractedData.uid as uid,
    input2.extractedData.time as time,
    input2.extractedData.currency as currency,
    input2.extractedData.amount as amount,
    input2.extractedData.payout as payout,
    input2.extractedData.chatId as chatId,
    input2.extractedData.chatTitle as chatTitle,
    sub_merchant.environment as environment,
    sub_merchant.status as status,
    main_merchant.main_merchant_name as mainMerchantName
FROM input1
CROSS JOIN UNNEST(input1.grouped_sub_merchants) as main_merchant
CROSS JOIN UNNEST(main_merchant.sub_merchants) as sub_merchant
CROSS JOIN input2
WHERE 
    LOWER(TRIM(input2.extractedData.merchant)) = LOWER(TRIM(sub_merchant.sub_merchant_name))
    AND sub_merchant.environment = '生产'
    AND sub_merchant.status = '正常'
```

## 解决方案2: 使用Code节点替代Merge节点

如果SQL查询仍然有问题，建议使用Code节点：

```javascript
// 商户匹配Code节点 - 替代Merge节点
const merchantData = $input.first().json; // Input 1: 商户数据
const telegramData = $input.last().json;  // Input 2: TG消息数据

console.log('商户数据:', merchantData);
console.log('TG数据:', telegramData);

// 从TG数据中获取商户名称
const targetMerchant = telegramData.extractedData.merchant.toLowerCase().trim();
console.log('目标商户:', targetMerchant);

// 在商户数据中查找匹配
let matchedMerchant = null;
let matchedMainMerchant = null;

for (const mainMerchant of merchantData.grouped_sub_merchants) {
  for (const subMerchant of mainMerchant.sub_merchants) {
    const subMerchantName = subMerchant.sub_merchant_name.toLowerCase().trim();
    
    if (subMerchantName === targetMerchant && 
        subMerchant.environment === '生产' && 
        subMerchant.status === '正常') {
      matchedMerchant = subMerchant;
      matchedMainMerchant = mainMerchant;
      break;
    }
  }
  if (matchedMerchant) break;
}

if (matchedMerchant) {
  return {
    merchant: telegramData.extractedData.merchant,
    merchantid: matchedMerchant.merchant_id,
    betId: telegramData.extractedData.betId,
    uid: telegramData.extractedData.uid,
    time: telegramData.extractedData.time,
    currency: telegramData.extractedData.currency,
    amount: telegramData.extractedData.amount,
    payout: telegramData.extractedData.payout,
    chatId: telegramData.extractedData.chatId,
    chatTitle: telegramData.extractedData.chatTitle,
    environment: matchedMerchant.environment,
    status: matchedMerchant.status,
    mainMerchantName: matchedMainMerchant.main_merchant_name
  };
} else {
  return {
    error: `未找到匹配的商户: ${targetMerchant}`,
    targetMerchant: targetMerchant,
    availableMerchants: merchantData.grouped_sub_merchants.map(m => 
      m.sub_merchants.map(s => s.sub_merchant_name)
    ).flat()
  };
}
```

## 解决方案3: 使用Merge节点的其他模式

如果SQL查询不工作，可以尝试Merge节点的其他模式：

### 模式1: 使用"Merge By Index"
- Mode: "Merge By Index"
- 然后使用Code节点处理合并后的数据

### 模式2: 使用"Merge By Position"
- Mode: "Merge By Position"
- 然后使用Code节点处理合并后的数据

## 推荐方案

**强烈推荐使用解决方案2（Code节点）**，因为：
1. 更稳定可靠
2. 更容易调试
3. 不依赖n8n的SQL语法限制
4. 可以添加详细的日志输出
5. 更容易维护和修改

## 操作步骤

1. 删除当前的Merge节点
2. 添加一个Code节点
3. 将"清洗数据"和"处理消息"两个节点都连接到Code节点
4. 在Code节点中使用上面的JavaScript代码
5. 测试执行
