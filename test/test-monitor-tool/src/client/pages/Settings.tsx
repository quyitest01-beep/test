import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AppConfig {
  watchDir: string;
  issueProvider: 'github' | 'jira';
  issueApiUrl: string;
  issueApiToken: string;
  issueRepo?: string;
  testCaseDir: string;
  serverPort: number;
  retryCount: number;
  retryInterval: number;
  aiProvider: 'openai' | 'none';
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  testEnv: 'staging' | 'production';
}

interface Snippet {
  id: string;
  category: string;
  name: string;
  description: string;
  code: string;
  env: string;
  tags: string[];
}

const styles = {
  page: { maxWidth: '700px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1e293b' },
  backLink: { color: '#3b82f6', textDecoration: 'none', fontSize: '13px' },
  card: {
    backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
    padding: '24px', marginBottom: '16px',
  },
  sectionTitle: { fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '16px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '4px' },
  input: {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '14px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' as const,
  },
  hint: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
  btnRow: { display: 'flex', gap: '8px', marginTop: '20px' },
  btn: (primary: boolean) => ({
    padding: '8px 20px', border: primary ? 'none' : '1px solid #cbd5e1', borderRadius: '6px',
    cursor: 'pointer', fontSize: '14px', fontWeight: 600,
    backgroundColor: primary ? '#3b82f6' : '#fff', color: primary ? '#fff' : '#475569',
  }),
  toast: (type: 'success' | 'error') => ({
    padding: '10px 16px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px',
    backgroundColor: type === 'success' ? '#dcfce7' : '#fee2e2',
    color: type === 'success' ? '#166534' : '#991b1b',
    border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`,
  }),
};

const defaultConfig: AppConfig = {
  watchDir: './tests/recorded',
  issueProvider: 'github',
  issueApiUrl: 'https://api.github.com',
  issueApiToken: '',
  issueRepo: '',
  testCaseDir: './tests/cases',
  serverPort: 3001,
  retryCount: 3,
  retryInterval: 10000,
  aiProvider: 'openai',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: 'https://api.openai.com/v1',
  testEnv: 'staging',
};

export default function Settings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingSnippet, setEditingSnippet] = useState<Partial<Snippet> | null>(null);
  const [snippetSaving, setSnippetSaving] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : defaultConfig)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
    fetch('/api/snippets').then(r => r.ok ? r.json() : []).then(setSnippets).catch(() => {});
  }, []);

  const loadSnippets = () => {
    fetch('/api/snippets').then(r => r.ok ? r.json() : []).then(setSnippets).catch(() => {});
  };

  const handleSaveSnippet = async () => {
    if (!editingSnippet?.category || !editingSnippet?.name || !editingSnippet?.code) {
      alert('分类、名称、代码为必填项');
      return;
    }
    setSnippetSaving(true);
    try {
      const isNew = !editingSnippet.id;
      const url = isNew ? '/api/snippets' : `/api/snippets/${editingSnippet.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSnippet),
      });
      if (res.ok) {
        loadSnippets();
        setEditingSnippet(null);
      } else {
        const err = await res.json();
        alert(`保存失败: ${err.error}`);
      }
    } catch { alert('保存失败'); }
    finally { setSnippetSaving(false); }
  };

  const handleDeleteSnippet = async (id: string) => {
    if (!confirm('确定删除此知识条目？')) return;
    await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
    loadSnippets();
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Don't send token if user didn't change it
      const payload = { ...config };
      if (!payload.issueApiToken || payload.issueApiToken === '***') {
        delete (payload as Partial<AppConfig>).issueApiToken;
      }
      if (!payload.aiApiKey || payload.aiApiKey === '***') {
        delete (payload as Partial<AppConfig>).aiApiKey;
      }

      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '配置保存成功' });
      } else {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        setMessage({ type: 'error', text: err.error || '保存配置失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setMessage(null);
  };

  const updateField = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div style={styles.page}><p>加载配置中...</p></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>系统设置</h1>
        <a href="/" style={styles.backLink} onClick={(e) => { e.preventDefault(); navigate('/'); }}>← 返回面板</a>
      </div>

      {message && <div style={styles.toast(message.type)}>{message.text}</div>}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>🌍 测试环境</div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="testEnv">当前测试环境</label>
          <select id="testEnv" style={styles.select} value={config.testEnv}
            onChange={(e) => updateField('testEnv', e.target.value as 'staging' | 'production')}>
            <option value="staging">🧪 测试环境 (staging)</option>
            <option value="production">🚀 正式环境 (production)</option>
          </select>
          <div style={styles.hint}>AI 生成脚本时会根据此设置加载对应环境的知识库（域名、账号等）</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>📁 监听设置</div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="watchDir">监听目录</label>
          <input id="watchDir" style={styles.input} value={config.watchDir}
            onChange={(e) => updateField('watchDir', e.target.value)} />
          <div style={styles.hint}>监听 .spec.ts 文件的目录</div>
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="testCaseDir">测试用例目录</label>
          <input id="testCaseDir" style={styles.input} value={config.testCaseDir}
            onChange={(e) => updateField('testCaseDir', e.target.value)} />
          <div style={styles.hint}>存放生成的测试用例的目录</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>🔗 Issue 管理</div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="issueProvider">平台</label>
          <select id="issueProvider" style={styles.select} value={config.issueProvider}
            onChange={(e) => updateField('issueProvider', e.target.value as 'github' | 'jira')}>
            <option value="github">GitHub</option>
            <option value="jira">Jira</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="issueApiUrl">API URL</label>
          <input id="issueApiUrl" style={styles.input} value={config.issueApiUrl}
            onChange={(e) => updateField('issueApiUrl', e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="issueApiToken">API 令牌</label>
          <input id="issueApiToken" style={styles.input} type="password"
            value={config.issueApiToken === '***' ? '' : config.issueApiToken}
            onChange={(e) => updateField('issueApiToken', e.target.value)}
            placeholder={config.issueApiToken === '***' ? '已配置（留空则保持不变）' : '输入令牌...'} />
          <div style={styles.hint}>令牌已安全存储，留空保存则保持原值不变</div>
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="issueRepo">仓库 (owner/repo)</label>
          <input id="issueRepo" style={styles.input} value={config.issueRepo || ''}
            onChange={(e) => updateField('issueRepo', e.target.value)}
            placeholder="例如 owner/repo" />
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>🤖 AI 增强设置</div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="aiProvider">AI 服务</label>
          <select id="aiProvider" style={styles.select} value={config.aiProvider}
            onChange={(e) => updateField('aiProvider', e.target.value as 'openai' | 'none')}>
            <option value="openai">OpenAI</option>
            <option value="none">不使用 AI</option>
          </select>
          <div style={styles.hint}>启用后会用 AI 增强录制脚本，生成更完善的测试用例</div>
        </div>
        {config.aiProvider === 'openai' && (
          <>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="aiBaseUrl">API 地址</label>
              <input id="aiBaseUrl" style={styles.input} value={config.aiBaseUrl}
                onChange={(e) => updateField('aiBaseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1" />
              <div style={styles.hint}>支持 OpenAI 兼容的第三方 API 地址</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="aiApiKey">API Key</label>
              <input id="aiApiKey" style={styles.input} type="password"
                value={config.aiApiKey === '***' ? '' : config.aiApiKey}
                onChange={(e) => updateField('aiApiKey', e.target.value)}
                placeholder={config.aiApiKey === '***' ? '已配置（留空则保持不变）' : '输入 API Key...'} />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="aiModel">模型</label>
              <input id="aiModel" style={styles.input} value={config.aiModel}
                onChange={(e) => updateField('aiModel', e.target.value)}
                placeholder="gpt-4o-mini" />
            </div>
          </>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>⚙ 高级设置</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="serverPort">服务端口</label>
            <input id="serverPort" style={styles.input} type="number" value={config.serverPort}
              onChange={(e) => updateField('serverPort', parseInt(e.target.value) || 3000)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="retryCount">重试次数</label>
            <input id="retryCount" style={styles.input} type="number" value={config.retryCount}
              onChange={(e) => updateField('retryCount', parseInt(e.target.value) || 3)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="retryInterval">重试间隔 (ms)</label>
            <input id="retryInterval" style={styles.input} type="number" value={config.retryInterval}
              onChange={(e) => updateField('retryInterval', parseInt(e.target.value) || 10000)} />
          </div>
        </div>
      </div>

      <div style={styles.btnRow}>
        <button style={styles.btn(true)} onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '💾 保存配置'}
        </button>
        <button style={styles.btn(false)} onClick={handleReset}>恢复默认</button>
      </div>

      {/* Knowledge Base Section */}
      <div style={{ ...styles.card, marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={styles.sectionTitle as React.CSSProperties}>🧠 测试知识库</div>
          <button
            onClick={() => setEditingSnippet({ category: '通用流程', name: '', description: '', code: '', env: 'staging', tags: [] })}
            style={{ padding: '6px 14px', border: '1px dashed #8b5cf6', borderRadius: '6px', backgroundColor: '#faf5ff', cursor: 'pointer', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}
          >
            ＋ 添加知识条目
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
          AI 生成脚本时会自动参考知识库中的代码片段、页面地址、API 信息等。请区分环境（staging/production/all）。
        </div>

        {editingSnippet && (
          <div style={{ border: '2px solid #8b5cf6', borderRadius: '8px', padding: '16px', backgroundColor: '#faf5ff', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={styles.label}>分类 *</label>
                <input style={styles.input} value={editingSnippet.category || ''} onChange={e => setEditingSnippet(p => ({ ...p, category: e.target.value }))}
                  placeholder="如: 通用流程 / 页面地址 / API" list="snippet-categories" />
                <datalist id="snippet-categories">
                  {[...new Set(snippets.map(s => s.category))].map(c => <option key={c} value={c} />)}
                  <option value="通用流程" /><option value="页面地址" /><option value="API 接口" /><option value="测试账号" /><option value="选择器" />
                </datalist>
              </div>
              <div>
                <label style={styles.label}>名称 *</label>
                <input style={styles.input} value={editingSnippet.name || ''} onChange={e => setEditingSnippet(p => ({ ...p, name: e.target.value }))} placeholder="如: 手机号登录流程" />
              </div>
              <div>
                <label style={styles.label}>环境</label>
                <select style={styles.select} value={editingSnippet.env || 'all'} onChange={e => setEditingSnippet(p => ({ ...p, env: e.target.value }))}>
                  <option value="all">全部环境</option>
                  <option value="staging">测试环境 (staging)</option>
                  <option value="production">正式环境 (production)</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>描述</label>
              <input style={styles.input} value={editingSnippet.description || ''} onChange={e => setEditingSnippet(p => ({ ...p, description: e.target.value }))} placeholder="简要说明这个知识条目的用途" />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>代码/内容 *</label>
              <textarea value={editingSnippet.code || ''} onChange={e => setEditingSnippet(p => ({ ...p, code: e.target.value }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', minHeight: '120px', resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                placeholder={'// 示例：手机号登录流程\nconst phoneTab = page.getByRole(\'button\', { name: \'Telefone\' });\nawait phoneTab.click();\nawait page.getByRole(\'textbox\', { name: \'Telefone\' }).fill(\'11900000103\');\nawait page.getByRole(\'textbox\', { name: \'Digite sua senha\' }).fill(\'11111111\');\nawait page.getByRole(\'button\', { name: \'Entrar\' }).click();'} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveSnippet} disabled={snippetSaving}
                style={{ padding: '6px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {snippetSaving ? '保存中...' : editingSnippet.id ? '💾 更新' : '💾 保存'}
              </button>
              <button onClick={() => setEditingSnippet(null)}
                style={{ padding: '6px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>
                取消
              </button>
            </div>
          </div>
        )}

        {snippets.length === 0 && !editingSnippet && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            暂无知识条目。添加常用的登录流程、页面地址、API 信息等，AI 生成脚本时会自动参考。
          </div>
        )}

        {snippets.map(s => (
          <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#3b82f6', marginRight: '6px' }}>{s.category}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
                {s.env !== 'all' && <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: s.env === 'staging' ? '#fef9c3' : '#dcfce7', color: s.env === 'staging' ? '#854d0e' : '#166534', marginLeft: '6px' }}>{s.env}</span>}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setEditingSnippet(s)} style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '11px', color: '#475569' }}>编辑</button>
                <button onClick={() => handleDeleteSnippet(s.id)} style={{ padding: '2px 8px', border: '1px solid #fecaca', borderRadius: '4px', backgroundColor: '#fef2f2', cursor: 'pointer', fontSize: '11px', color: '#ef4444' }}>删除</button>
              </div>
            </div>
            {s.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{s.description}</div>}
            <pre style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px', marginTop: '6px', overflow: 'auto', maxHeight: '150px', whiteSpace: 'pre-wrap' as const }}>{s.code}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
