-- n8n Merge节点SQL查询 - 商户匹配
-- 目标：将TG消息中的商户名称与商户数据中的sub_merchant_name匹配，获取对应的merchant_id
-- Input 1: 清洗数据 (商户信息) - 包含grouped_sub_merchants数组
-- Input 2: 处理消息 (TG消息) - 包含extractedData对象

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
