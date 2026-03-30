const snippets = [
  {
    category: '通用流程',
    name: '邮箱登录流程',
    description: '正式环境的邮箱登录流程（非手机号登录）',
    env: 'production',
    code: `// 邮箱登录流程
await page.goto(BASE_URL + "/login");
await page.getByRole("textbox", { name: "E-mail" }).fill("ptest36@test.com");
await page.getByRole("textbox", { name: "Digite sua senha" }).fill("11111111");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(BASE_URL + "/", { timeout: 15000 });`,
  },
  {
    category: '通用流程',
    name: '邮箱注册流程（被邀请人）',
    description: '通过邀请链接用邮箱注册新账号，需要在新浏览器上下文中执行',
    env: 'production',
    code: `// 邮箱注册流程（需要新的浏览器上下文 newPage）
// refCode 是邀请码，如 "OMW4ZK"
await newPage.goto(BASE_URL + "/register?ref=" + refCode);
await newPage.getByRole("textbox", { name: "Nome completo" }).fill("新用户名");
await newPage.getByRole("textbox", { name: "E-mail" }).fill("新邮箱@test.com");
await newPage.getByRole("textbox", { name: "Digite sua senha" }).fill("11111111");
// 勾选协议复选框
await newPage.getByRole("main").getByRole("button").filter({ hasText: /^\$/ }).click();
await newPage.getByRole("button", { name: "Criar Conta" }).click();`,
  },
  {
    category: '通用流程',
    name: '手机号注册流程（被邀请人）',
    description: '通过邀请链接用手机号注册新账号，需要在新浏览器上下文中执行',
    env: 'production',
    code: `// 手机号注册流程（需要新的浏览器上下文 newPage）
// refCode 是邀请码
await newPage.goto(BASE_URL + "/register?ref=" + refCode);
await newPage.getByRole("button", { name: "Telefone" }).click();
await newPage.getByRole("textbox", { name: "Nome completo" }).fill("新用户名");
await newPage.getByRole("textbox", { name: "Telefone" }).fill("手机号");
await newPage.getByRole("textbox", { name: "Digite sua senha" }).fill("11111111");
// 勾选协议复选框
await newPage.getByRole("main").getByRole("button").filter({ hasText: /^\$/ }).click();
await newPage.getByRole("button", { name: "Criar Conta" }).click();`,
  },
  {
    category: '通用流程',
    name: '获取邀请码',
    description: '登录后进入邀请页面复制邀请码',
    env: 'all',
    code: `// 进入邀请页面获取邀请码
await page.goto(BASE_URL + "/referral");
// 点击复制邀请码按钮
await page.getByRole("button", { name: "Copiar" }).nth(1).click();`,
  },
  {
    category: '通用流程',
    name: '退出登录',
    description: '从当前账号退出登录',
    env: 'all',
    code: `// 退出登录
await page.getByRole("button", { name: "Sair" }).click();
await page.waitForURL(BASE_URL + "/", { timeout: 10000 });`,
  },
  {
    category: '选择器',
    name: '注册页选择器',
    description: '注册页面的关键元素选择器',
    env: 'all',
    code: `// 注册页关键选择器
const REGISTER_SELECTORS = {
  fullName: () => page.getByRole("textbox", { name: "Nome completo" }),
  email: () => page.getByRole("textbox", { name: "E-mail" }),
  phone: () => page.getByRole("textbox", { name: "Telefone" }),
  password: () => page.getByRole("textbox", { name: "Digite sua senha" }),
  phoneTab: () => page.getByRole("button", { name: "Telefone" }),
  createAccount: () => page.getByRole("button", { name: "Criar Conta" }),
  // 协议复选框
  agreeCheckbox: () => page.getByRole("main").getByRole("button").filter({ hasText: /^\$/ }),
};`,
  },
  {
    category: '测试账号',
    name: 'production 邮箱测试账号',
    description: '正式环境的邮箱登录测试账号（邀请人A）',
    env: 'production',
    code: `// production 邮箱测试账号（邀请人）
const INVITER_EMAIL = "ptest36@test.com";
const INVITER_PASSWORD = "11111111";
const INVITER_REF_CODE = "OMW4ZK";`,
  },
  {
    category: '页面地址',
    name: '注册页',
    description: '注册页面地址，支持 ref 邀请码参数',
    env: 'all',
    code: `// 注册页（带邀请码）
const REGISTER_URL = BASE_URL + "/register?ref=" + refCode;
// 邀请页
const REFERRAL_URL = BASE_URL + "/referral";`,
  },
];

for (const s of snippets) {
  const res = await fetch('http://localhost:3001/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  const data = await res.json();
  console.log(`✓ ${s.category} / ${s.name} (${s.env})`);
}
console.log('Done');
