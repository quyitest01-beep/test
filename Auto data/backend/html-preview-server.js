// HTML预览服务器
// 功能：读取JSON数据，生成HTML，并在浏览器中实时预览
// 使用方法：node html-preview-server.js [输入文件路径]

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// 从 ai-report-to-html.js 中提取相关函数
// （这里简化版，实际应该导入完整模块）

// 转义HTML特殊字符
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// 读取 ai-report-to-html.js 中的函数（简化版）
// 实际使用时，应该通过 require 或 import 导入完整模块
let markdownToHtml, processInlineFormatting, extractReportTitle, generateHtmlReport;

try {
  // 尝试读取 ai-report-to-html.js 文件
  const codePath = path.join(__dirname, 'ai-report-to-html.js');
  const codeContent = fs.readFileSync(codePath, 'utf-8');
  
  // 使用 eval 执行代码（注意：这不是最佳实践，但用于快速预览）
  // 更好的方法是重构代码为模块化
  eval(codeContent);
} catch (error) {
  console.error('❌ 无法加载 ai-report-to-html.js:', error.message);
  process.exit(1);
}

// 获取输入文件路径
const inputFile = process.argv[2] || 'test-input.json';

// 检查输入文件是否存在
if (!fs.existsSync(inputFile)) {
  console.error(`❌ 输入文件不存在: ${inputFile}`);
  console.log('\n使用方法:');
  console.log('  node html-preview-server.js [输入文件路径]');
  console.log('\n示例:');
  console.log('  node html-preview-server.js test-input.json');
  process.exit(1);
}

// 读取输入数据
let inputData;
try {
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  inputData = JSON.parse(fileContent);
} catch (error) {
  console.error(`❌ 无法读取或解析输入文件: ${error.message}`);
  process.exit(1);
}

// 处理输入数据（模拟 n8n 的 $input.all()）
const inputs = Array.isArray(inputData) 
  ? inputData.map(item => ({ json: item }))
  : [{ json: inputData }];

// 生成HTML（使用 ai-report-to-html.js 的逻辑）
let htmlContent = '';
let markdownContent = '';

if (inputs.length > 0) {
  const item = inputs[0].json;
  
  // 提取AI输出内容
  if (item.output) {
    markdownContent = item.output;
  } else if (item.content) {
    markdownContent = item.content;
  } else if (item.text) {
    markdownContent = item.text;
  } else if (typeof item === 'string') {
    markdownContent = item;
  } else {
    markdownContent = JSON.stringify(item, null, 2);
  }
  
  // 生成HTML
  htmlContent = generateHtmlReport(markdownContent);
}

// 创建HTTP服务器
const PORT = 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
  } else if (req.url === '/reload') {
    // 重新加载数据
    try {
      const fileContent = fs.readFileSync(inputFile, 'utf-8');
      const newData = JSON.parse(fileContent);
      const newInputs = Array.isArray(newData) 
        ? newData.map(item => ({ json: item }))
        : [{ json: newData }];
      
      if (newInputs.length > 0) {
        const item = newInputs[0].json;
        let newMarkdown = '';
        if (item.output) {
          newMarkdown = item.output;
        } else if (item.content) {
          newMarkdown = item.content;
        } else if (item.text) {
          newMarkdown = item.text;
        } else if (typeof item === 'string') {
          newMarkdown = item;
        } else {
          newMarkdown = JSON.stringify(item, null, 2);
        }
        htmlContent = generateHtmlReport(newMarkdown);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: '数据已重新加载' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
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
  console.log(`   - 修改 ${inputFile} 后，访问 ${url}/reload 重新加载`);
  console.log(`   - 或直接刷新浏览器页面查看最新效果`);
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

// 监听文件变化（可选）
if (process.argv.includes('--watch')) {
  const chokidar = require('chokidar');
  const watcher = chokidar.watch(inputFile, { persistent: true });
  
  watcher.on('change', (path) => {
    console.log(`\n📝 检测到文件变化: ${path}`);
    console.log('   请访问 http://localhost:3000/reload 重新加载数据');
  });
  
  console.log(`👀 正在监听文件变化: ${inputFile}`);
}










