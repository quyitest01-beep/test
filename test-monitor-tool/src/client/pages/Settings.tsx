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
};

export default function Settings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : defaultConfig)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}
