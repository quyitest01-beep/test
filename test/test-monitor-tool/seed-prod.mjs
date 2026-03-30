const snippets = await fetch('http://localhost:3001/api/snippets').then(r => r.json());

// Add production login flow if not exists
const prodLogin = snippets.find(s => s.name.includes('手机号登录') && s.env === 'production');
if (!prodLogin) {
  await fetch('http://localhost:3001/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: '通用流程',
      name: '手机号登录流程',
      description: '正式环境的手机号登录流程，选择器与 staging 一致，仅域名和账号不同。',
      env: 'production',
      code: `// 1. 进入登录页
await page.goto(BASE_URL + "/login");

// 2. 切换到手机号登录 tab
await page.getByRole("button", { name: "Telefone" }).click();

// 3. 填写手机号
await page.getByRole("textbox", { name: "Telefone" }).fill("11900000036");

// 4. 填写密码
await page.getByRole("textbox", { name: "Digite sua senha" }).fill("11111111");

// 5. 点击登录按钮
await page.getByRole("button", { name: "Entrar" }).click();

// 6. 等待登录成功跳转到首页
await page.waitForURL(BASE_URL + "/", { timeout: 15000 });`,
    })
  });
  console.log('✓ Created production login flow');
} else {
  console.log('Production login flow already exists');
}

// Add production test account if not exists
const prodAccount = snippets.find(s => s.name.includes('production') && s.category === '测试账号');
if (!prodAccount) {
  await fetch('http://localhost:3001/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: '测试账号',
      name: 'production 手机号测试账号',
      description: '正式环境的手机号登录测试账号',
      env: 'production',
      code: `// production 测试账号
const TEST_PHONE = "11900000036";
const TEST_PASSWORD = "11111111";`,
    })
  });
  console.log('✓ Created production test account');
}

console.log('Done');
