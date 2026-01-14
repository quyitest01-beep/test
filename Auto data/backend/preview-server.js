// HTML预览服务器
// 功能：读取包含 output 字段的JSON文件，实时生成HTML并在浏览器中预览
// 使用方法：node preview-server.js <输入文件路径>

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// 导入HTML生成模块
const { generateHtmlReport } = require('./html-generator-module.js');

// 获取输入文件路径
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ 请提供输入文件路径');
  console.log('\n使用方法:');
  console.log('  node preview-server.js <输入文件路径>');
  console.log('\n示例:');
  console.log('  node preview-server.js test-output.json');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ 文件不存在: ${inputFile}`);
  process.exit(1);
}

// 读取输入数据并生成HTML
function loadAndGenerateHTML() {
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
      return null;
    }
    
    // 生成HTML
    const html = generateHtmlReport(markdownContent);
    return html;
  } catch (error) {
    console.error(`❌ 处理文件时出错: ${error.message}`);
    return null;
  }
}

// 创建HTTP服务器
const PORT = 3000;
let htmlContent = loadAndGenerateHTML();

if (!htmlContent) {
  console.error('❌ 无法生成HTML，请检查输入文件');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // 每次请求时重新加载数据（实现热更新）
    const freshHTML = loadAndGenerateHTML();
    if (freshHTML) {
      htmlContent = freshHTML;
    }
    
    res.writeHead(200, { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(htmlContent || '<html><body><h1>无法生成HTML</h1></body></html>');
  } else if (req.url === '/reload') {
    // 手动重新加载
    const freshHTML = loadAndGenerateHTML();
    if (freshHTML) {
      htmlContent = freshHTML;
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, message: '数据已重新加载，请刷新页面' }));
    } else {
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: false, error: '无法重新加载数据' }));
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
  console.log(`\n💡 使用提示:`);
  console.log(`   - 修改 ${inputFile} 后，刷新浏览器页面即可看到最新效果（自动重新加载）`);
  console.log(`   - 或访问 ${url}/reload 手动重新加载`);
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

