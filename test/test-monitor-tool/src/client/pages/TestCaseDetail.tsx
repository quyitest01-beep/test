import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

interface TestStep {
  order: number;
  action: string;
  expected: string;
}

interface TestCase {
  id: string;
  title: string;
  issueLink: string | null;
  preconditions: string;
  steps: TestStep[];
  expectedResults: string;
  automationScript: string;
  status: string;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
}

interface TestRunResult {
  testCaseId: string;
  status: string;
  duration: number;
  errorMessage?: string;
  screenshot?: string;
  logs: string;
  runAt?: string;
}

const styles = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
    border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff',
    cursor: 'pointer', fontSize: '13px', color: '#475569', marginBottom: '16px',
  },
  card: {
    backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
    padding: '20px', marginBottom: '16px',
  },
  title: { fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' },
  meta: { display: 'flex', gap: '16px', flexWrap: 'wrap' as const, marginBottom: '16px', fontSize: '13px', color: '#64748b' },
  badge: (status: string) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
    backgroundColor: status === 'complete' ? '#dcfce7' : status === 'pending_info' ? '#fef9c3' : '#fee2e2',
    color: status === 'complete' ? '#166534' : status === 'pending_info' ? '#854d0e' : '#991b1b',
  }),
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#334155', marginBottom: '8px', marginTop: '16px' },
  pre: {
    backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '12px', fontSize: '12px', fontFamily: 'monospace', overflow: 'auto' as const,
    maxHeight: '300px', whiteSpace: 'pre-wrap' as const,
  },
  stepRow: { display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  stepNum: { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 },
  runBadge: (status: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    backgroundColor: status === 'passed' ? '#dcfce7' : status === 'failed' ? '#fee2e2' : '#f1f5f9',
    color: status === 'passed' ? '#166534' : status === 'failed' ? '#991b1b' : '#475569',
  }),
  runBtn: {
    padding: '8px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, backgroundColor: '#3b82f6', color: '#fff',
  },
};

export default function TestCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [history, setHistory] = useState<TestRunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<Array<{ title: string; url: string }>>([]);
  const [linking, setLinking] = useState(false);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const [draftPreconditions, setDraftPreconditions] = useState('');
  const [draftSteps, setDraftSteps] = useState<TestStep[]>([]);
  const [draftExpectedResults, setDraftExpectedResults] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [stepMessages, setStepMessages] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Socket.IO for real-time step updates
  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('test:step', (step: { testCaseId: string; message: string; status: string }) => {
      if (step.testCaseId === id) {
        setStepMessages(prev => [...prev, step.message]);
        if (step.status === 'running') setTestStatus('running');
      }
    });

    socket.on('test:complete', () => {
      // Will be updated by the fetch after run completes
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/test-cases/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/test-run/history?testCaseId=${id}`).then(r => r.ok ? r.json() : []),
    ]).then(([tc, hist]) => {
      setTestCase(tc);
      setHistory(Array.isArray(hist) ? hist : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleRun = async () => {
    if (!id) return;
    setRunning(true);
    setTestStatus('running');
    setStepMessages([]);
    try {
      const res = await fetch(`/api/test-run/single/${id}`, { method: 'POST' });
      const result = await res.json();
      setTestStatus(result.status === 'passed' ? 'passed' : 'failed');
      const hist = await fetch(`/api/test-run/history?testCaseId=${id}`).then(r => r.json());
      setHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.error('Run failed:', err);
      setTestStatus('failed');
    } finally {
      setRunning(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch('/api/issues?perPage=50');
      if (res.ok) setIssues(await res.json());
    } catch { /* ignore */ }
  };

  const handleSaveScript = async () => {
    if (!id || editingScript === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/test-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationScript: editingScript }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTestCase(updated);
        setEditingScript(null);
      } else {
        const err = await res.json();
        alert(`保存失败: ${err.error}`);
      }
    } catch (err) {
      alert(`保存失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const startEditingSteps = () => {
    if (!testCase) return;
    setDraftPreconditions(testCase.preconditions);
    setDraftSteps(testCase.steps.map(s => ({ ...s })));
    setDraftExpectedResults(testCase.expectedResults);
    setEditingSteps(true);
  };

  const handleStepChange = (index: number, field: 'action' | 'expected', value: string) => {
    setDraftSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/regenerate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preconditions: draftPreconditions,
          steps: draftSteps,
          expectedResults: draftExpectedResults,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTestCase(updated);
        setEditingSteps(false);
        setEditingScript(null);
      } else {
        const err = await res.json();
        alert(`AI 生成失败: ${err.error}`);
      }
    } catch (err) {
      alert(`AI 生成失败: ${err}`);
    } finally {
      setRegenerating(false);
    }
  };

  const handleLinkIssue = async (issueUrl: string) => {
    if (!id) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/link-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTestCase(updated);
        setShowIssuePanel(false);
      } else {
        const err = await res.json();
        alert(`关联失败: ${err.error}`);
      }
    } catch (err) {
      alert(`关联失败: ${err}`);
    } finally {
      setLinking(false);
    }
  };

  if (loading) return <div style={styles.page}><p>加载中...</p></div>;
  if (!testCase) return <div style={styles.page}><p>未找到测试用例</p></div>;

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={() => navigate('/')}>← 返回</button>

      <div style={styles.card}>
        <h1 style={styles.title}>{testCase.title}</h1>
        <div style={styles.meta}>
          <span style={styles.badge(testCase.status)}>{testCase.status}</span>
          {testCase.issueLink && (
            <a href={testCase.issueLink} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
              🔗 {testCase.issueLink}
            </a>
          )}
          <span>创建时间: {new Date(testCase.createdAt).toLocaleString()}</span>
          <span>更新时间: {new Date(testCase.updatedAt).toLocaleString()}</span>
        </div>

        {testCase.missingFields.length > 0 && (
          <div style={{ padding: '8px 12px', backgroundColor: '#fef9c3', borderRadius: '6px', fontSize: '13px', color: '#854d0e', marginBottom: '12px' }}>
            ⚠ 缺失字段: {testCase.missingFields.join(', ')}
          </div>
        )}

        {!testCase.issueLink && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => { setShowIssuePanel(!showIssuePanel); if (!showIssuePanel && issues.length === 0) fetchIssues(); }}
              style={{ padding: '8px 16px', border: '1px solid #f59e0b', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              🔗 关联 Issue 并用 AI 增强
            </button>
            {showIssuePanel && (
              <div style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#fff' }}>
                {issues.length === 0 && <div style={{ padding: '16px', color: '#94a3b8', textAlign: 'center' }}>加载 Issues 中...</div>}
                {issues.map((issue, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => !linking && handleLinkIssue(issue.url)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{issue.title}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{issue.url.split('/').slice(-2).join('/')}</div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#3b82f6' }}>{linking ? '处理中...' : '选择'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {testCase.preconditions && !editingSteps && (
          <>
            <div style={styles.sectionTitle}>前置条件</div>
            <p style={{ fontSize: '13px', color: '#475569' }}>{testCase.preconditions}</p>
          </>
        )}

        <div style={styles.sectionTitle}>
          测试步骤
          {!editingSteps && (
            <button
              onClick={startEditingSteps}
              style={{ marginLeft: '12px', padding: '2px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '12px', color: '#475569' }}
            >
              ✏️ 编辑并用 AI 重新生成
            </button>
          )}
        </div>

        {editingSteps ? (
          <div style={{ border: '2px solid #8b5cf6', borderRadius: '8px', padding: '16px', backgroundColor: '#faf5ff' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>前置条件</label>
              <textarea
                value={draftPreconditions}
                onChange={(e) => setDraftPreconditions(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', minHeight: '60px', resize: 'vertical' as const }}
              />
            </div>

            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>测试步骤</label>
            {draftSteps.map((step, i) => (
              <div key={step.order} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <div style={styles.stepNum}>{step.order}</div>
                <div style={{ flex: 1 }}>
                  <input
                    value={step.action}
                    onChange={(e) => handleStepChange(i, 'action', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', marginBottom: '4px' }}
                    placeholder="操作描述"
                  />
                  <input
                    value={step.expected}
                    onChange={(e) => handleStepChange(i, 'expected', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', color: '#64748b' }}
                    placeholder="预期结果"
                  />
                </div>
              </div>
            ))}

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>预期结果</label>
              <textarea
                value={draftExpectedResults}
                onChange={(e) => setDraftExpectedResults(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', minHeight: '60px', resize: 'vertical' as const }}
              />
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                {regenerating ? '🤖 AI 生成中...' : '🤖 AI 重新生成脚本'}
              </button>
              <button
                onClick={() => setEditingSteps(false)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            {testCase.steps.map((step) => (
              <div key={step.order} style={styles.stepRow}>
                <div style={styles.stepNum}>{step.order}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#1e293b' }}>{step.action}</div>
                  {step.expected && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>预期: {step.expected}</div>}
                </div>
              </div>
            ))}

            <div style={styles.sectionTitle}>预期结果</div>
            <p style={{ fontSize: '13px', color: '#475569' }}>{testCase.expectedResults}</p>
          </>
        )}

        <div style={styles.sectionTitle}>
          自动化脚本
          {editingScript === null ? (
            <button
              onClick={() => setEditingScript(testCase.automationScript)}
              style={{ marginLeft: '12px', padding: '2px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '12px', color: '#475569' }}
            >
              ✏️ 编辑
            </button>
          ) : (
            <span style={{ marginLeft: '12px' }}>
              <button
                onClick={handleSaveScript}
                disabled={saving}
                style={{ padding: '2px 10px', border: 'none', borderRadius: '4px', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}
              >
                {saving ? '保存中...' : '💾 保存'}
              </button>
              <button
                onClick={() => setEditingScript(null)}
                style={{ padding: '2px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '12px', color: '#475569' }}
              >
                取消
              </button>
            </span>
          )}
        </div>
        {editingScript !== null ? (
          <textarea
            value={editingScript}
            onChange={(e) => setEditingScript(e.target.value)}
            style={{
              ...styles.pre,
              width: '100%',
              minHeight: '300px',
              resize: 'vertical' as const,
              border: '2px solid #3b82f6',
              outline: 'none',
            }}
          />
        ) : (
          <pre style={styles.pre}>{testCase.automationScript}</pre>
        )}

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={styles.runBtn} onClick={handleRun} disabled={running}>
            {running ? '⏳ 运行中...' : '▶ 运行测试'}
          </button>
          {testStatus !== 'idle' && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: testStatus === 'running' ? '#dbeafe' : testStatus === 'passed' ? '#dcfce7' : '#fee2e2',
              color: testStatus === 'running' ? '#1d4ed8' : testStatus === 'passed' ? '#166534' : '#991b1b',
            }}>
              {testStatus === 'running' ? '🔄 测试中...' : testStatus === 'passed' ? '✅ 测试通过' : '❌ 测试不通过'}
            </span>
          )}
        </div>

        {stepMessages.length > 0 && (
          <div style={{ marginTop: '12px', backgroundColor: '#1e293b', borderRadius: '6px', padding: '12px', maxHeight: '200px', overflow: 'auto' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>实时日志</div>
            {stepMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: '11px', fontFamily: 'monospace', color: msg.includes('✓') ? '#4ade80' : msg.includes('✘') || msg.includes('×') ? '#f87171' : '#e2e8f0', lineHeight: '1.6' }}>
                {msg}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>运行历史</div>
        {history.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>暂无运行记录</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>耗时</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>日期</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>错误信息</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>截图</th>
              </tr>
            </thead>
            <tbody>
              {history.map((run, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={styles.runBadge(run.status)}>{run.status}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>{run.duration}ms</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    {run.runAt ? new Date(run.runAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', color: '#ef4444', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.errorMessage?.replace(/\u001b\[\d+m/g, '') || '—'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    {run.screenshot ? (
                      <a href={run.screenshot} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '12px' }}>📷 查看</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
