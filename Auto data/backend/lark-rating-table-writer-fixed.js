// n8n Code节点：Lark 游戏评级表写入器（修正版）
// 作用：
// 1. 从输入中收集 tenant_token、表名、lark_tables、Sheet 列表
// 2. 精确匹配 lark_tables 中每个表对应的 Sheet（根据 sheet_name）
// 3. 将 lark_tables 中的数据写入到对应的 Sheet
// 4. 构建 Lark values_batch_update HTTP 请求配置

const inputs = $input.all();
if (!inputs) {
  throw new Error("❌ 未收到任何输入数据 (inputs 为 null/undefined)");
}
if (!Array.isArray(inputs)) {
  throw new Error(`❌ inputs 不是数组，类型: ${typeof inputs}`);
}
if (inputs.length === 0) {
  throw new Error("❌ 未收到任何输入数据 (inputs.length === 0)");
}

console.log(`📥 收到 ${inputs.length} 个输入项`);
console.log(`📥 inputs 类型: ${typeof inputs}, 是否为数组: ${Array.isArray(inputs)}`);

// ------------------------------------------------------------------
// 基础工具函数
const normalizeString = (value) =>
  value === null || value === undefined ? null : String(value).trim();

const normalizeTitle = (value) => {
  const str = normalizeString(value);
  if (!str) return null;
  return str.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
};

const sheetTitleEquals = (a, b) => {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  return normA && normB && normA === normB;
};

const columnNumberToName = (number) => {
  let n = Number(number);
  if (!Number.isFinite(n) || n <= 0) return "A";
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

// ------------------------------------------------------------------
// 收集关键输入
let tenantToken = null;
let ratingPayload = null;
let spreadsheetToken = null;
const sheetBundles = [];

const extractSheetBundle = (node) => {
  if (!node || typeof node !== "object") return null;
  
  // 直接命中：如果节点本身包含 sheets/replies/spreadsheetToken
  if (Array.isArray(node.sheets) || Array.isArray(node.replies) || node.spreadsheetToken) {
    return {
      sheets: Array.isArray(node.sheets) ? node.sheets : [],
      replies: Array.isArray(node.replies) ? node.replies : [],
      spreadsheetToken: node.spreadsheetToken || null,
    };
  }
  
  // 递归查找：检查常见的嵌套路径
  const candidates = [
    node.data,
    node.data && node.data.data,
    node[0],
    node[0] && node[0].data,
    node[0] && node[0].data && node[0].data.data,
  ];
  
  for (const child of candidates) {
    if (child && typeof child === "object") {
      // 如果子节点包含 sheets/replies/spreadsheetToken，直接返回
      if (Array.isArray(child.sheets) || Array.isArray(child.replies) || child.spreadsheetToken) {
        return {
          sheets: Array.isArray(child.sheets) ? child.sheets : [],
          replies: Array.isArray(child.replies) ? child.replies : [],
          spreadsheetToken: child.spreadsheetToken || null,
        };
      }
      // 否则继续递归
      const hit = extractSheetBundle(child);
      if (hit) return hit;
    }
  }
  
  return null;
};

// 处理输入数据的辅助函数
const getItemData = (wrapper) => {
  // 情况1: wrapper.json 存在（n8n 标准格式）
  if (wrapper && wrapper.json) {
    return wrapper.json;
  }
  // 情况2: wrapper 本身就是数据对象
  if (wrapper && typeof wrapper === "object" && !Array.isArray(wrapper)) {
    return wrapper;
  }
  // 情况3: wrapper 是数组，取第一个元素
  if (Array.isArray(wrapper) && wrapper.length > 0) {
    return wrapper[0];
  }
  return null;
};

// 首先尝试直接从所有输入项中提取 spreadsheetToken（无论 code 是什么）
console.log("🔍 第一步：快速扫描所有输入项，查找 spreadsheetToken...");
for (let i = 0; i < inputs.length; i++) {
  const wrapper = inputs[i];
  const item = getItemData(wrapper);
  if (!item) {
    console.log(`  输入项 ${i}: 无法获取数据`);
    continue;
  }
  
  console.log(`  输入项 ${i}: 检查中...`);
  console.log(`    - code: ${item.code}, has_data: ${!!item.data}`);
  
  // 检查 item.data.spreadsheetToken
  if (item.data && item.data.spreadsheetToken) {
    const token = item.data.spreadsheetToken;
    if (typeof token === "string" && token.length > 0) {
      if (!spreadsheetToken) {
        spreadsheetToken = token;
        console.log(`✅ 快速扫描找到 spreadsheetToken (输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        
        // 同时创建 bundle
        const bundle = {
          sheets: Array.isArray(item.data.sheets) ? item.data.sheets : [],
          replies: Array.isArray(item.data.replies) ? item.data.replies : [],
          spreadsheetToken: spreadsheetToken,
        };
        sheetBundles.push(bundle);
        console.log(`✅ 快速扫描创建 Sheet bundle: sheets=${bundle.sheets.length}, replies=${bundle.replies.length}`);
        break;
      }
    } else {
      console.log(`    - data.spreadsheetToken 存在但值无效: ${typeof token}, 值: ${JSON.stringify(token)}`);
    }
  } else {
    console.log(`    - data.spreadsheetToken 不存在或 data 不存在`);
  }
}

if (spreadsheetToken) {
  console.log(`✅ 快速扫描完成，已找到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
} else {
  console.log(`⚠️ 快速扫描未找到 spreadsheetToken，将在后续处理中继续查找`);
}

inputs.forEach((wrapper, index) => {
  const item = getItemData(wrapper);
  if (!item) {
    console.warn(`⚠️ 输入项 ${index} 数据无效，跳过`);
    console.warn(`   wrapper 类型: ${typeof wrapper}, 是否为数组: ${Array.isArray(wrapper)}`);
    if (wrapper && typeof wrapper === "object") {
      console.warn(`   wrapper 键: ${Object.keys(wrapper).join(", ")}`);
    }
    return;
  }

  console.log(`🔍 处理输入项 ${index}:`, {
    has_code: item.code !== undefined,
    code: item.code,
    has_data: item.data !== undefined,
    has_sheets: Array.isArray(item.data?.sheets),
    has_spreadsheetToken: item.data?.spreadsheetToken !== undefined,
    has_lark_tables: item.lark_tables !== undefined,
    has_tenant_token: item.tenant_token !== undefined,
    item_keys: Object.keys(item).slice(0, 10).join(", "),
  });

  // 收集 tenant_token
  const tokenCandidate = item.tenant_token || item.tenant_access_token;
  if (!tenantToken && tokenCandidate) {
    tenantToken = tokenCandidate;
    console.log(`✅ 找到 tenant_token: ${tokenCandidate.substring(0, 16)}...`);
  }

  // 收集游戏评级数据（包含 lark_tables）
  // 优先查找新的格式（game-rating-fact-table-generator.js 的输出）
  if (!ratingPayload) {
    // 检查是否有 lark_tables
    if (item.lark_tables) {
      ratingPayload = item;
      console.log(`✅ 找到游戏评级数据 (输入项 ${index}): table_name=${item.table_name || '未设置'}, lark_tables 键: ${Object.keys(item.lark_tables).join(", ")}`);
    } else if (item.tenant_token && item.table_name) {
      // 备选：如果有 tenant_token 和 table_name，也认为是评级数据
      ratingPayload = item;
      console.log(`✅ 找到游戏评级数据 (备选, 输入项 ${index}): table_name=${item.table_name}`);
    }
  }

  // 收集 Sheet 信息
  // 情况1: 标准的 API 响应格式 { code: 0, data: { spreadsheetToken, sheets, replies } }
  // 支持 code 为数字 0 或字符串 "0"
  const itemCode = item.code;
  const isCodeZero = itemCode === 0 || itemCode === "0" || itemCode === 0.0;
  
  if (isCodeZero && item.data) {
    // 检查多种可能的字段名，确保找到有效的 token
    let token = null;
    if (item.data.spreadsheetToken && typeof item.data.spreadsheetToken === "string" && item.data.spreadsheetToken.length > 0) {
      token = item.data.spreadsheetToken;
    } else if (item.data.spreadsheet_token && typeof item.data.spreadsheet_token === "string" && item.data.spreadsheet_token.length > 0) {
      token = item.data.spreadsheet_token;
    } else if (item.data.token && typeof item.data.token === "string" && item.data.token.length > 0) {
      token = item.data.token;
    }
    
    const sheets = Array.isArray(item.data.sheets) ? item.data.sheets : (Array.isArray(item.data.Sheets) ? item.data.Sheets : []);
    const replies = Array.isArray(item.data.replies) ? item.data.replies : (Array.isArray(item.data.Replies) ? item.data.Replies : []);
    
    console.log(`📋 输入项 ${index} 包含 code: 0`);
    console.log(`   item.data 类型: ${typeof item.data}`);
    console.log(`   item.data 键: ${Object.keys(item.data).slice(0, 15).join(", ")}`);
    console.log(`   data.spreadsheetToken 存在: ${item.data.spreadsheetToken !== undefined}`);
    console.log(`   data.spreadsheetToken 值: ${item.data.spreadsheetToken !== undefined ? (item.data.spreadsheetToken ? `"${item.data.spreadsheetToken.substring(0, 20)}..."` : 'null') : 'undefined'}`);
    console.log(`   data.spreadsheetToken 类型: ${typeof item.data.spreadsheetToken}`);
    console.log(`   data.sheets 数量: ${sheets.length}`);
    console.log(`   data.replies 数量: ${replies.length}`);
    
    const bundle = {
      sheets: sheets,
      replies: replies,
      spreadsheetToken: token,
    };
    
    // 直接提取 spreadsheetToken（如果存在）
    if (!spreadsheetToken && token) {
      spreadsheetToken = token;
      console.log(`✅ 直接提取到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
    } else if (!spreadsheetToken && item.data.spreadsheetToken !== undefined) {
      // 即使 token 是 null 或空字符串，也尝试使用原始值
      const rawToken = item.data.spreadsheetToken;
      if (rawToken && typeof rawToken === "string" && rawToken.trim().length > 0) {
        spreadsheetToken = rawToken.trim();
        token = spreadsheetToken;
        bundle.spreadsheetToken = spreadsheetToken;
        console.log(`✅ 从原始值提取到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
      } else {
        console.warn(`⚠️ 输入项 ${index} 中 spreadsheetToken 存在但值为空:`, rawToken);
        console.warn(`   rawToken 类型: ${typeof rawToken}, 值: ${JSON.stringify(rawToken)}`);
      }
    } else if (!spreadsheetToken) {
      console.warn(`⚠️ 输入项 ${index} 中没有找到 spreadsheetToken`);
      console.warn(`   item.data 完整键:`, Object.keys(item.data));
      console.warn(`   item.data 完整内容 (前500字符):`, JSON.stringify(item.data, null, 2).substring(0, 500));
    }
    
    if (token || bundle.sheets.length > 0 || bundle.replies.length > 0) {
      sheetBundles.push(bundle);
      console.log(`✅ 从输入项 ${index} 收集到 Sheet bundle: spreadsheetToken=${token ? token.substring(0, 16) + '...' : 'null'}, sheets=${bundle.sheets.length}, replies=${bundle.replies.length}`);
    } else {
      console.warn(`⚠️ 输入项 ${index} 的 Sheet bundle 为空，跳过`);
      console.warn(`   token: ${token}, sheets: ${bundle.sheets.length}, replies: ${bundle.replies.length}`);
    }
  } else {
    // 情况2: 即使 code 不是 0，也尝试从 item.data 中提取（可能是其他格式的响应）
    if (item.data && item.data.spreadsheetToken) {
      const token = item.data.spreadsheetToken;
      if (typeof token === "string" && token.length > 0) {
        if (!spreadsheetToken) {
          spreadsheetToken = token;
          console.log(`✅ 从 item.data 中提取到 spreadsheetToken (code=${item.code}): ${spreadsheetToken.substring(0, 16)}...`);
        }
        
        const bundle = {
          sheets: Array.isArray(item.data.sheets) ? item.data.sheets : [],
          replies: Array.isArray(item.data.replies) ? item.data.replies : [],
          spreadsheetToken: token,
        };
        
        if (token || bundle.sheets.length > 0 || bundle.replies.length > 0) {
          sheetBundles.push(bundle);
          console.log(`✅ 从输入项 ${index} 提取到 Sheet bundle (从 data 中): spreadsheetToken=${token.substring(0, 16)}...`);
        }
      }
    }
    
    // 情况3: 尝试从其他格式中提取
    const fallback = extractSheetBundle(item);
    if (fallback) {
      // 直接提取 spreadsheetToken（如果存在）
      if (!spreadsheetToken && fallback.spreadsheetToken) {
        spreadsheetToken = fallback.spreadsheetToken;
        console.log(`✅ 从 fallback 提取到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
      }
      
      if (fallback.spreadsheetToken || fallback.sheets.length > 0 || fallback.replies.length > 0) {
        sheetBundles.push(fallback);
        console.log(`✅ 从输入项 ${index} 提取到 Sheet bundle (fallback): spreadsheetToken=${fallback.spreadsheetToken ? fallback.spreadsheetToken.substring(0, 16) + '...' : 'null'}, sheets=${fallback.sheets.length}, replies=${fallback.replies.length}`);
      }
    } else {
      // 尝试直接检查 item 是否有 spreadsheetToken
      if (item.spreadsheetToken) {
        const directBundle = {
          sheets: Array.isArray(item.sheets) ? item.sheets : [],
          replies: Array.isArray(item.replies) ? item.replies : [],
          spreadsheetToken: item.spreadsheetToken,
        };
        if (!spreadsheetToken) {
          spreadsheetToken = item.spreadsheetToken;
          console.log(`✅ 直接从 item 提取到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
        }
        sheetBundles.push(directBundle);
        console.log(`✅ 从输入项 ${index} 直接提取到 Sheet bundle: spreadsheetToken=${directBundle.spreadsheetToken.substring(0, 16)}...`);
      } else {
        // 最后尝试：检查 item 是否有 data 字段，即使 code 不是 0
        if (item.data && typeof item.data === "object") {
          // 深度搜索 data 对象
          const searchInData = (obj, path = "data") => {
            if (!obj || typeof obj !== "object") return null;
            if (obj.spreadsheetToken && typeof obj.spreadsheetToken === "string" && obj.spreadsheetToken.length > 0) {
              return obj.spreadsheetToken;
            }
            if (obj.spreadsheet_token && typeof obj.spreadsheet_token === "string" && obj.spreadsheet_token.length > 0) {
              return obj.spreadsheet_token;
            }
            for (const key in obj) {
              if (obj.hasOwnProperty(key) && typeof obj[key] === "object" && obj[key] !== null && path.length < 20) {
                const found = searchInData(obj[key], path + "." + key);
                if (found) return found;
              }
            }
            return null;
          };
          
          const foundToken = searchInData(item.data);
          if (foundToken && !spreadsheetToken) {
            spreadsheetToken = foundToken;
            console.log(`✅ 从 item.data 深度搜索提取到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
            
            const bundle = {
              sheets: Array.isArray(item.data.sheets) ? item.data.sheets : [],
              replies: Array.isArray(item.data.replies) ? item.data.replies : [],
              spreadsheetToken: foundToken,
            };
            sheetBundles.push(bundle);
          }
        }
        
        if (!spreadsheetToken) {
          console.warn(`⚠️ 输入项 ${index} 无法提取 Sheet bundle`);
          console.warn(`   item 类型: ${typeof item}`);
          console.warn(`   item.code: ${item.code}`);
          console.warn(`   item.data 存在: ${!!item.data}`);
          console.warn(`   item 键: ${Object.keys(item).slice(0, 10).join(", ")}`);
        }
      }
    }
  }
});

if (!tenantToken) {
  throw new Error("❌ 未找到 tenant_token");
}
if (!ratingPayload) {
  throw new Error("❌ 未找到 lark_tables 数据");
}

// ------------------------------------------------------------------
// 找到 spreadsheetToken 和所有 Sheet 信息
const sheetMap = new Map(); // normalized_title -> { sheetId, title }

console.log(`📊 开始处理 ${sheetBundles.length} 个 Sheet bundle`);

// 如果还没有找到 spreadsheetToken，从 sheetBundles 中提取
if (!spreadsheetToken) {
  for (const bundle of sheetBundles) {
    if (!bundle) continue;
    if (bundle.spreadsheetToken) {
      spreadsheetToken = bundle.spreadsheetToken;
      console.log(`✅ 从 sheetBundles 中找到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
      break;
    }
  }
}

for (const bundle of sheetBundles) {
  if (!bundle) {
    console.warn(`⚠️ 遇到空的 bundle，跳过`);
    continue;
  }

  // 如果还没有找到 spreadsheetToken，尝试从当前 bundle 中提取
  if (!spreadsheetToken && bundle.spreadsheetToken) {
    spreadsheetToken = bundle.spreadsheetToken;
    console.log(`✅ 从 bundle 中找到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
  }

  // 从 sheets 中收集所有 Sheet 信息
  if (bundle.sheets && Array.isArray(bundle.sheets)) {
    bundle.sheets.forEach((sheet) => {
      if (sheet.sheetId && sheet.title) {
        const normalizedTitle = normalizeTitle(sheet.title);
        if (normalizedTitle && !sheetMap.has(normalizedTitle)) {
          sheetMap.set(normalizedTitle, {
            sheetId: sheet.sheetId,
            title: sheet.title,
          });
        }
      }
    });
  }

  // 从 replies 中收集 Sheet 信息
  if (bundle.replies && Array.isArray(bundle.replies)) {
    bundle.replies.forEach((reply) => {
      if (reply.addSheet && reply.addSheet.properties) {
        const props = reply.addSheet.properties;
        if (props.sheetId && props.title) {
          const normalizedTitle = normalizeTitle(props.title);
          if (normalizedTitle && !sheetMap.has(normalizedTitle)) {
            sheetMap.set(normalizedTitle, {
              sheetId: props.sheetId,
              title: props.title,
            });
          }
        }
      }
    });
  }
}

// 如果还没有找到 spreadsheetToken，从 sheetBundles 中提取
if (!spreadsheetToken) {
  console.log("⚠️ 快速扫描未找到 spreadsheetToken，尝试从 sheetBundles 中提取...");
  for (const bundle of sheetBundles) {
    if (bundle && bundle.spreadsheetToken && typeof bundle.spreadsheetToken === "string" && bundle.spreadsheetToken.length > 0) {
      spreadsheetToken = bundle.spreadsheetToken;
      console.log(`✅ 从 sheetBundles 中找到 spreadsheetToken: ${spreadsheetToken.substring(0, 16)}...`);
      break;
    }
  }
}

// 如果还没有找到，最后一次尝试从所有输入项中提取
if (!spreadsheetToken) {
  console.error("❌ 未找到 spreadsheetToken");
  console.error("调试信息:");
  console.error(`  - sheetBundles 数量: ${sheetBundles.length}`);
  console.error(`  - 输入项数量: ${inputs.length}`);
  console.error(`  - inputs 类型: ${typeof inputs}, 是否为数组: ${Array.isArray(inputs)}`);
  
  // 输出所有输入项的详细信息
  inputs.forEach((wrapper, index) => {
    console.error(`\n  输入项 ${index}:`);
    console.error(`    - wrapper 类型: ${typeof wrapper}, 是否为数组: ${Array.isArray(wrapper)}`);
    if (wrapper && typeof wrapper === "object") {
      console.error(`    - wrapper 键: ${Object.keys(wrapper).join(", ")}`);
      if (wrapper.json) {
        console.error(`    - wrapper.json 键: ${Object.keys(wrapper.json).slice(0, 10).join(", ")}`);
        if (wrapper.json.code !== undefined) {
          console.error(`    - wrapper.json.code: ${wrapper.json.code}`);
        }
        if (wrapper.json.data) {
          console.error(`    - wrapper.json.data 键: ${Object.keys(wrapper.json.data).slice(0, 10).join(", ")}`);
          console.error(`    - wrapper.json.data.spreadsheetToken: ${wrapper.json.data.spreadsheetToken !== undefined ? (wrapper.json.data.spreadsheetToken ? `"${wrapper.json.data.spreadsheetToken.substring(0, 20)}..."` : 'null') : 'undefined'}`);
          console.error(`    - wrapper.json.data.spreadsheetToken 类型: ${typeof wrapper.json.data.spreadsheetToken}`);
        }
      }
      // 检查 wrapper 本身是否包含 data
      if (wrapper.data) {
        console.error(`    - wrapper.data 键: ${Object.keys(wrapper.data).slice(0, 10).join(", ")}`);
        console.error(`    - wrapper.data.spreadsheetToken: ${wrapper.data.spreadsheetToken !== undefined ? (wrapper.data.spreadsheetToken ? `"${wrapper.data.spreadsheetToken.substring(0, 20)}..."` : 'null') : 'undefined'}`);
      }
    }
  });
  
  sheetBundles.forEach((bundle, index) => {
    if (bundle) {
      console.error(`  - bundle ${index}: spreadsheetToken=${bundle.spreadsheetToken ? bundle.spreadsheetToken.substring(0, 20) + '...' : 'null'}, sheets=${bundle.sheets?.length || 0}, replies=${bundle.replies?.length || 0}`);
    } else {
      console.error(`  - bundle ${index}: null`);
    }
  });
  
  // 尝试最后一次从所有输入项中提取（使用更简单直接的方法）
  console.error("\n尝试最后一次提取...");
  for (let i = 0; i < inputs.length; i++) {
    const wrapper = inputs[i];
    
    // 方法1: 直接检查 wrapper.json.data.spreadsheetToken
    if (wrapper && wrapper.json && wrapper.json.data && wrapper.json.data.spreadsheetToken) {
      const token = wrapper.json.data.spreadsheetToken;
      if (typeof token === "string" && token.length > 0) {
        spreadsheetToken = token;
        console.error(`✅ 最后一次提取成功 (wrapper.json.data.spreadsheetToken, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        break;
      }
    }
    
    // 方法2: 直接检查 wrapper.data.spreadsheetToken
    if (wrapper && wrapper.data && wrapper.data.spreadsheetToken) {
      const token = wrapper.data.spreadsheetToken;
      if (typeof token === "string" && token.length > 0) {
        spreadsheetToken = token;
        console.error(`✅ 最后一次提取成功 (wrapper.data.spreadsheetToken, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        break;
      }
    }
    
    // 方法3: 使用 getItemData
    const item = getItemData(wrapper);
    if (item) {
      // 尝试从 item.data.spreadsheetToken 提取
      if (item.data && item.data.spreadsheetToken) {
        const token = item.data.spreadsheetToken;
        if (typeof token === "string" && token.length > 0) {
          spreadsheetToken = token;
          console.error(`✅ 最后一次提取成功 (getItemData -> item.data.spreadsheetToken, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
          break;
        }
      }
      
      // 尝试从 item.spreadsheetToken 提取（直接字段）
      if (item.spreadsheetToken && typeof item.spreadsheetToken === "string" && item.spreadsheetToken.length > 0) {
        spreadsheetToken = item.spreadsheetToken;
        console.error(`✅ 最后一次提取成功 (item.spreadsheetToken, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        break;
      }
      
      // 尝试从 extractSheetBundle 提取
      const fallback = extractSheetBundle(item);
      if (fallback && fallback.spreadsheetToken && typeof fallback.spreadsheetToken === "string" && fallback.spreadsheetToken.length > 0) {
        spreadsheetToken = fallback.spreadsheetToken;
        console.error(`✅ 最后一次提取成功 (extractSheetBundle, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        break;
      }
      
      // 尝试深度遍历整个 item
      const deepSearch = (obj, depth = 0, path = []) => {
        if (depth > 5) return null;
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
        
        // 检查常见的字段名
        const tokenFields = ["spreadsheetToken", "spreadsheet_token", "token"];
        for (const field of tokenFields) {
          if (obj[field] && typeof obj[field] === "string" && obj[field].length > 0) {
            return { token: obj[field], path: path.concat(field).join(".") };
          }
        }
        
        // 递归搜索所有对象属性
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (value && typeof value === "object" && !Array.isArray(value)) {
              const found = deepSearch(value, depth + 1, path.concat(key));
              if (found) return found;
            }
          }
        }
        return null;
      };
      
      const deepResult = deepSearch(item);
      if (deepResult && deepResult.token) {
        spreadsheetToken = deepResult.token;
        console.error(`✅ 最后一次提取成功 (深度搜索, 路径: ${deepResult.path}, 输入项 ${i}): ${spreadsheetToken.substring(0, 16)}...`);
        break;
      }
    }
  }
  
  if (!spreadsheetToken) {
    throw new Error("❌ 未找到 spreadsheetToken，请检查输入数据是否包含 spreadsheetToken。请查看上方的调试信息，了解输入数据的结构。");
  }
}

console.log(`📊 收集到 ${sheetMap.size} 个 Sheet`);
if (sheetMap.size === 0) {
  console.error("❌ sheetMap 为空，无法匹配 Sheet");
  console.error("调试信息:");
  console.error(`  - sheetBundles 数量: ${sheetBundles.length}`);
  sheetBundles.forEach((bundle, index) => {
    console.error(`  - bundle ${index}:`, {
      has_sheets: !!bundle?.sheets,
      sheets_count: bundle?.sheets?.length || 0,
      has_replies: !!bundle?.replies,
      replies_count: bundle?.replies?.length || 0,
      has_spreadsheetToken: !!bundle?.spreadsheetToken,
    });
  });
  throw new Error("❌ sheetMap 为空，无法匹配 Sheet。请检查输入数据是否包含 sheets 信息。");
}

sheetMap.forEach((sheetInfo, normalizedTitle) => {
  console.log(`  - "${sheetInfo.title}" (规范化: "${normalizedTitle}", ID: ${sheetInfo.sheetId})`);
});

// ------------------------------------------------------------------
// 验证必要数据
if (!ratingPayload) {
  console.error("❌ ratingPayload 为空");
  console.error("调试信息:");
  console.error(`  - inputs 数量: ${inputs.length}`);
  inputs.forEach((wrapper, index) => {
    const item = getItemData(wrapper);
    if (item) {
      console.error(`  - 输入项 ${index}:`, {
        has_lark_tables: !!item.lark_tables,
        has_game_level_table: !!item.game_level_table,
        has_table_name: !!item.table_name,
        table_name: item.table_name,
      });
    }
  });
  throw new Error("❌ ratingPayload 为空，无法处理数据。请检查输入数据是否包含 lark_tables 和 game_level_table。");
}

if (!ratingPayload.lark_tables) {
  throw new Error("❌ ratingPayload.lark_tables 为空，无法处理数据");
}

// ------------------------------------------------------------------
// 匹配 lark_tables 中的每个表到对应的 Sheet
const larkTables = ratingPayload.lark_tables || {};
const targetTableName = ratingPayload.table_name; // 例如: "Golazo Win-2025/07"

if (!targetTableName) {
  console.error("❌ 未找到 table_name");
  console.error("ratingPayload 键:", Object.keys(ratingPayload));
  throw new Error("❌ 未找到 table_name，无法匹配目标 Sheet");
}

console.log(`🎯 目标 Sheet 名称: "${targetTableName}"`);
console.log(`📋 sheetMap 大小: ${sheetMap.size}`);
console.log(`📋 可用 Sheet 列表:`);
sheetMap.forEach((sheetInfo, normalizedTitle) => {
  console.log(`   - "${sheetInfo.title}" (规范化: "${normalizedTitle}")`);
});

// 查找匹配的目标 Sheet
let targetSheet = null;
const normalizedTargetName = normalizeTitle(targetTableName);
console.log(`🔍 规范化后的目标名称: "${normalizedTargetName}"`);

// 1. 精确匹配（规范化后的标题）
if (normalizedTargetName && sheetMap.has(normalizedTargetName)) {
  targetSheet = sheetMap.get(normalizedTargetName);
  console.log(`✅ 精确匹配目标 Sheet: "${targetTableName}" -> "${targetSheet.title}" (ID: ${targetSheet.sheetId})`);
} else {
  console.log(`⚠️ 精确匹配失败，尝试模糊匹配...`);
  // 2. 模糊匹配（遍历所有 Sheet）
  for (const [normalizedTitle, sheetInfo] of sheetMap.entries()) {
    console.log(`   比较: "${targetTableName}" vs "${sheetInfo.title}"`);
    if (sheetTitleEquals(targetTableName, sheetInfo.title)) {
      targetSheet = sheetInfo;
      console.log(`✅ 模糊匹配目标 Sheet: "${targetTableName}" -> "${sheetInfo.title}" (ID: ${sheetInfo.sheetId})`);
      break;
    }
  }
  
  // 3. 如果还是没找到，尝试部分匹配（包含关系）
  if (!targetSheet) {
    console.log(`⚠️ 模糊匹配失败，尝试部分匹配...`);
    const targetParts = normalizedTargetName ? normalizedTargetName.split(/[\s-]+/) : [];
    for (const [normalizedTitle, sheetInfo] of sheetMap.entries()) {
      const sheetParts = normalizedTitle ? normalizedTitle.split(/[\s-]+/) : [];
      // 检查目标名称的所有部分是否都在 Sheet 标题中
      const allPartsMatch = targetParts.length > 0 && targetParts.every(part => 
        sheetParts.some(sheetPart => sheetPart.includes(part) || part.includes(sheetPart))
      );
      if (allPartsMatch) {
        targetSheet = sheetInfo;
        console.log(`✅ 部分匹配目标 Sheet: "${targetTableName}" -> "${sheetInfo.title}" (ID: ${sheetInfo.sheetId})`);
        break;
      }
    }
  }
}

if (!targetSheet) {
  console.error(`❌ 未找到标题为 "${targetTableName}" 的 Sheet`);
  console.error(`   规范化后的目标名称: "${normalizedTargetName}"`);
  console.error(`   可用 Sheet 列表:`);
  sheetMap.forEach((sheetInfo, normalizedTitle) => {
    console.error(`     - "${sheetInfo.title}" (规范化: "${normalizedTitle}")`);
  });
  throw new Error(`❌ 未找到标题为 "${targetTableName}" 的 Sheet。请检查 table_name 是否正确，或者 Sheet 是否已创建。`);
}

console.log(`✅ 找到目标 Sheet: "${targetSheet.title}" (ID: ${targetSheet.sheetId})`);

// 需要写入的表列表（按优先级排序）
const tableKeys = [
  "game_level_table",
  "platform_game_level_table",
  "platform_level_table",
  "game_platform_ratio_table",
];

console.log(`📋 lark_tables 键: ${Object.keys(larkTables).join(", ")}`);
console.log(`📋 准备处理 ${tableKeys.length} 个表`);

const tableMappings = [];
let currentStartRow = 1; // 从第1行开始写入

tableKeys.forEach((tableKey, index) => {
  console.log(`\n🔍 处理表 "${tableKey}" (${index + 1}/${tableKeys.length}):`);
  
  const tableData = larkTables[tableKey];
  if (!tableData) {
    console.warn(`  ⚠️ 表 "${tableKey}" 不存在于 lark_tables 中，跳过`);
    return;
  }
  
  console.log(`  - tableData 类型: ${typeof tableData}`);
  console.log(`  - tableData 键: ${Object.keys(tableData).join(", ")}`);
  console.log(`  - has values: ${!!tableData.values}`);
  console.log(`  - values 类型: ${Array.isArray(tableData.values) ? 'array' : typeof tableData.values}`);
  
  if (!tableData.values || !Array.isArray(tableData.values)) {
    console.warn(`  ⚠️ 表 "${tableKey}" 的 values 无效或不是数组，跳过`);
    console.warn(`     values 值: ${JSON.stringify(tableData.values).substring(0, 100)}`);
    return;
  }

  const values = tableData.values;
  const rowCount = values.length;
  const colCount = rowCount > 0 ? (Array.isArray(values[0]) ? values[0].length : 0) : 0;
  
  console.log(`  - 行数: ${rowCount}, 列数: ${colCount}`);
  console.log(`  - 第一行: ${rowCount > 0 ? JSON.stringify(values[0]).substring(0, 100) : '无'}`);
  
  if (rowCount === 0 || colCount === 0) {
    console.warn(`  ⚠️ 表 "${tableKey}" 数据为空（行数: ${rowCount}, 列数: ${colCount}），跳过`);
    return;
  }

  // 计算当前表的写入范围
  const startRow = currentStartRow;
  const endRow = currentStartRow + rowCount - 1;
  const range = `${targetSheet.sheetId}!A${startRow}:${columnNumberToName(colCount)}${endRow}`;

  console.log(`  ✅ 表 "${tableKey}": ${rowCount} 行 × ${colCount} 列, 写入范围: ${range}`);

  tableMappings.push({
    table_key: tableKey,
    sheet_name: tableData.sheet_name || tableKey,
    sheet_id: targetSheet.sheetId,
    sheet_title: targetSheet.title,
    values: values,
    range: range,
    row_count: rowCount,
    col_count: colCount,
    start_row: startRow,
    end_row: endRow,
  });

  // 更新下一个表的起始行（当前表结束行 + 2行间隔）
  currentStartRow = endRow + 3; // 每个表之间留2行空行
  console.log(`  ✅ 下一个表的起始行: ${currentStartRow}`);
});

console.log(`\n📊 表处理完成，共收集到 ${tableMappings.length} 个可写入的表`);

if (tableMappings.length === 0) {
  throw new Error("❌ 没有找到任何可写入的表");
}

// ------------------------------------------------------------------
// 构建 Lark 写入请求
// 批量写入多个表
const valueRanges = tableMappings.map((mapping) => ({
  range: mapping.range,
  values: mapping.values,
}));

const httpRequest = {
  method: "POST",
  url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
  headers: {
    Authorization: `Bearer ${tenantToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    valueRanges: valueRanges,
  }),
};

// ------------------------------------------------------------------
// 输出结果
console.log("=== Lark 游戏评级表写入数据准备完成 ===");
console.log("表名:", ratingPayload.table_name);
console.log("目标游戏:", ratingPayload.target_game?.english_name || ratingPayload.target_game?.game_code || "未知");
console.log("匹配到 Sheet 数量:", tableMappings.length);
tableMappings.forEach((mapping) => {
  console.log(`  - ${mapping.sheet_name}: ${mapping.sheet_title} (ID: ${mapping.sheet_id}, 行数: ${mapping.row_count}, 列数: ${mapping.col_count})`);
});

const output = {
  status: "success",
  table_name: ratingPayload.table_name,
  target_game: ratingPayload.target_game,
  spreadsheet_token: spreadsheetToken,
  tenant_token: tenantToken,
  table_mappings: tableMappings,
  http_request: httpRequest,
  lark_request_body: httpRequest.body,
  meta: {
    total_tables: tableMappings.length,
    total_rows: tableMappings.reduce((sum, m) => sum + m.row_count, 0),
    game_level_table_rows: tableMappings.find((m) => m.table_key === "game_level_table")?.row_count || 0,
    platform_game_level_table_rows: tableMappings.find((m) => m.table_key === "platform_game_level_table")?.row_count || 0,
    platform_level_table_rows: tableMappings.find((m) => m.table_key === "platform_level_table")?.row_count || 0,
    game_platform_ratio_table_rows: tableMappings.find((m) => m.table_key === "game_platform_ratio_table")?.row_count || 0,
    stat_date: ratingPayload.meta?.stat_date,
    week_start: ratingPayload.meta?.week_start,
    week_end: ratingPayload.meta?.week_end,
    generated_at: new Date().toISOString(),
  },
};

return [
  {
    json: output,
  },
];

