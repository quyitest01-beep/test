// HTML预览工具
// 功能：读取AI输出的JSON数据，生成HTML并在浏览器中预览
// 使用方法：node preview-html.js [输入文件路径]

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// 读取 ai-report-to-html.js 的代码
const codePath = path.join(__dirname, 'ai-report-to-html.js');
let codeContent;
try {
  codeContent = fs.readFileSync(codePath, 'utf-8');
} catch (error) {
  console.error('❌ 无法读取 ai-report-to-html.js:', error.message);
  process.exit(1);
}

// 提取函数（使用 eval 执行代码，模拟 n8n 环境）
// 注意：这是一个简化的实现，实际使用时需要重构为模块化
const mockN8n = {
  $input: {
    all: () => []
  }
};

// 创建一个简化的执行环境
const generateHtmlFromCode = (inputs) => {
  // 模拟 n8n 的 $input.all()
  const originalInput = mockN8n.$input.all;
  mockN8n.$input.all = () => inputs;
  
  try {
    // 执行代码并捕获结果
    let result = [];
    const originalReturn = global.return;
    global.return = (value) => { result = value; };
    
    // 执行代码
    eval(codeContent);
    
    // 恢复
    global.return = originalReturn;
    mockN8n.$input.all = originalInput;
    
    return result;
  } catch (error) {
    console.error('❌ 执行代码时出错:', error.message);
    console.error(error.stack);
    return [];
  }
};

// 获取输入文件路径
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ 请提供输入文件路径');
  console.log('\n使用方法:');
  console.log('  node preview-html.js <输入文件路径>');
  console.log('\n示例:');
  console.log('  node preview-html.js test-output.json');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ 文件不存在: ${inputFile}`);
  process.exit(1);
}

// 读取输入数据
let inputData;
try {
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  inputData = JSON.parse(fileContent);
} catch (error) {
  console.error(`❌ 无法读取或解析文件: ${error.message}`);
  process.exit(1);
}

// 准备输入数据（模拟 n8n 格式）
const inputs = Array.isArray(inputData) 
  ? inputData.map(item => ({ json: item }))
  : [{ json: inputData }];

// 生成HTML
console.log('📄 正在生成HTML...');
const results = generateHtmlFromCode(inputs);

if (!results || results.length === 0 || !results[0].json || !results[0].json.html) {
  console.error('❌ 未能生成HTML，请检查输入数据格式');
  console.log('输入数据示例:', JSON.stringify(inputData, null, 2).substring(0, 500));
  process.exit(1);
}

const htmlContent = results[0].json.html;

// 创建HTTP服务器
const PORT = 3000;
let server;

function startServer() {
  if (server) {
    server.close();
  }
  
  server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
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
        
        const newResults = generateHtmlFromCode(newInputs);
        if (newResults && newResults.length > 0 && newResults[0].json && newResults[0].json.html) {
          htmlContent = newResults[0].json.html;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: '数据已重新加载，请刷新页面' }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '无法生成HTML' }));
        }
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
}

// 启动服务器
startServer();

// 如果使用 --watch 参数，监听文件变化
if (process.argv.includes('--watch')) {
  try {
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(inputFile, { persistent: true });
    
    watcher.on('change', (path) => {
      console.log(`\n📝 检测到文件变化: ${path}`);
      console.log('   正在重新加载...');
      
      try {
        const fileContent = fs.readFileSync(inputFile, 'utf-8');
        const newData = JSON.parse(fileContent);
        const newInputs = Array.isArray(newData) 
          ? newData.map(item => ({ json: item }))
          : [{ json: newData }];
        
        const newResults = generateHtmlFromCode(newInputs);
        if (newResults && newResults.length > 0 && newResults[0].json && newResults[0].json.html) {
          htmlContent = newResults[0].json.html;
          console.log('   ✅ 数据已重新加载，请刷新浏览器查看最新效果');
        }
      } catch (error) {
        console.error(`   ❌ 重新加载失败: ${error.message}`);
      }
    });
    
    console.log(`👀 正在监听文件变化: ${inputFile}`);
  } catch (error) {
    console.log('⚠️ 无法启用文件监听（需要安装 chokidar: npm install chokidar）');
  }
}

// 处理退出
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务器...');
  if (server) {
    server.close();
  }
  process.exit(0);
});










