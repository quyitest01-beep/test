// 简易HTML预览工具
// 功能：读取包含 output 字段的JSON文件，生成HTML并在浏览器中预览
// 使用方法：node preview-html-simple.js <输入文件路径>

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// 从 ai-report-to-html.js 中提取核心函数（简化版）
// 注意：这里需要复制 ai-report-to-html.js 中的相关函数

// 由于代码太长，这里提供一个简化版本
// 实际使用时，建议将 ai-report-to-html.js 重构为模块

// 读取输入文件
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ 请提供输入文件路径');
  console.log('\n使用方法:');
  console.log('  node preview-html-simple.js <输入文件路径>');
  console.log('\n示例:');
  console.log('  node preview-html-simple.js test-output.json');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ 文件不存在: ${inputFile}`);
  process.exit(1);
}

// 读取并解析 ai-report-to-html.js
const codePath = path.join(__dirname, 'ai-report-to-html.js');
let generateHtmlReport;
try {
  // 读取代码文件
  const codeContent = fs.readFileSync(codePath, 'utf-8');
  
  // 创建一个模拟的 n8n 环境
  const mockN8nEnv = {
    $input: {
      all: () => []
    },
    console: console
  };
  
  // 提取生成HTML的函数
  // 由于代码使用了 $input，我们需要提取核心函数
  // 这里我们直接读取代码并执行关键部分
  
  // 简化方案：直接读取输入文件，提取 output 字段，然后生成HTML
  console.log('📄 正在读取输入文件...');
  
} catch (error) {
  console.error('❌ 无法读取 ai-report-to-html.js:', error.message);
  process.exit(1);
}

// 读取输入数据
function loadInputData() {
  try {
    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // 提取 output 字段
    let markdownContent = '';
    if (Array.isArray(data)) {
      if (data[0] && data[0].output) {
        markdownContent = data[0].output;
      } else if (data[0] && data[0].json && data[0].json.output) {
        markdownContent = data[0].json.output;
      }
    } else if (data.output) {
      markdownContent = data.output;
    } else if (data.json && data.json.output) {
      markdownContent = data.json.output;
    }
    
    if (!markdownContent) {
      console.error('❌ 无法找到 output 字段');
      console.log('文件内容示例:', JSON.stringify(data, null, 2).substring(0, 500));
      return null;
    }
    
    return markdownContent;
  } catch (error) {
    console.error(`❌ 无法读取或解析文件: ${error.message}`);
    return null;
  }
}

// 生成HTML（调用 ai-report-to-html.js 的逻辑）
// 由于代码复杂，这里提供一个替代方案：直接调用 Node.js 执行
function generateHTML(markdownContent) {
  // 创建一个临时脚本
  const tempScript = `
    // 这里需要复制 ai-report-to-html.js 中的 generateHtmlReport 函数
    // 为了简化，我们直接使用 require 执行
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    // 创建临时输入文件
    const tempInput = {
      json: {
        output: ${JSON.stringify(markdownContent)}
      }
    };
    fs.writeFileSync('temp-input.json', JSON.stringify([tempInput]));
    
    // 执行 ai-report-to-html.js（需要修改为模块化）
    // 这里简化处理...
  `;
  
  // 更好的方案：直接在这里实现 HTML 生成逻辑
  // 或者使用动态导入
}

console.log('💡 提示：由于代码复杂，建议使用以下方法：');
console.log('   1. 在 n8n 工作流中，将 HTML 输出保存到文件');
console.log('   2. 使用浏览器直接打开生成的 HTML 文件');
console.log('   3. 或者使用 Live Server 等工具实时预览');

// 简化版：直接读取输入文件，如果已经是 HTML，直接显示
let htmlContent = '';

function loadHTML() {
  const markdown = loadInputData();
  if (!markdown) return false;
  
  // 如果输入已经是 HTML，直接使用
  if (markdown.trim().startsWith('<!DOCTYPE html>')) {
    htmlContent = markdown;
    return true;
  }
  
  // 否则需要调用生成函数
  // 这里提供一个简单的 HTML 包装
  htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>预览</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <h1>Markdown 内容预览</h1>
  <pre>${markdown}</pre>
  <hr>
  <p><small>提示：这是 Markdown 原始内容。要查看渲染后的 HTML，请使用完整的 ai-report-to-html.js 代码。</small></p>
</body>
</html>`;
  
  return true;
}

if (!loadHTML()) {
  process.exit(1);
}

// 创建HTTP服务器
const PORT = 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // 重新加载数据
    if (loadHTML()) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
    } else {
      res.writeHead(500);
      res.end('无法加载数据');
    }
  } else if (req.url === '/reload') {
    if (loadHTML()) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: '数据已重新加载' }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '无法加载数据' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n✅ HTML预览服务器已启动`);
  console.log(`📄 预览地址: ${url}`);
  console.log(`📁 输入文件: ${inputFile}`);
  console.log(`\n💡 提示:`);
  console.log(`   - 修改 ${inputFile} 后，刷新浏览器页面即可看到最新效果`);
  console.log(`   - 或访问 ${url}/reload 重新加载`);
  console.log(`   - 按 Ctrl+C 停止服务器\n`);
  
  // 自动打开浏览器
  const platform = process.platform;
  const openCommand = platform === 'win32' ? 'start' : 
                      platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${openCommand} ${url}`, (error) => {
    if (error) {
      console.log(`⚠️ 无法自动打开浏览器，请手动访问: ${url}`);
    }
  });
});

// 处理退出
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务器...');
  server.close();
  process.exit(0);
});










