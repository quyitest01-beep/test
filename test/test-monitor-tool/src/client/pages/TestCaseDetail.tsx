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
  screenshots?: Array<{ step: number; path: string }>;
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
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingSteps, setEditingSteps] = useState(false);
  const [draftPreconditions, setDraftPreconditions] = useState('');
  const [draftSteps, setDraftSteps] = useState<TestStep[]>([]);
  const [draftExpectedResults, setDraftExpectedResults] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingFromIssue, setRegeneratingFromIssue] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixLogs, setFixLogs] = useState<Array<{ error_message: string; explanation: string; fixed_at: string }>>([]);
  const [reportDraft, setReportDraft] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'fixes' | 'report' | 'screenshots'>('history');
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
      fetch(`/api/test-cases/${id}/fix-logs`).then(r => r.ok ? r.json() : []),
    ]).then(([tc, hist, logs]) => {
      setTestCase(tc);
      setHistory(Array.isArray(hist) ? hist : []);
      setFixLogs(Array.isArray(logs) ? logs : []);
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

  const addStep = (atIndex?: number) => {
    setDraftSteps(prev => {
      const insertAt = atIndex !== undefined ? atIndex + 1 : prev.length;
      const next = [...prev];
      next.splice(insertAt, 0, { order: 0, action: '', expected: '' });
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const removeStep = (index: number) => {
    setDraftSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setDraftSteps(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const handleSaveSteps = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/test-cases/${id}`, {
        method: 'PUT',
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

  const handleRegenerateFromIssue = async () => {
    if (!id || !testCase?.issueLink) return;
    if (!confirm('将根据 Issue 需求内容重新生成测试步骤和脚本，当前的步骤和脚本会被覆盖。确定继续？')) return;
    setRegeneratingFromIssue(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/regenerate-from-issue`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setTestCase(updated);
        // Refresh history
        const hist = await fetch(`/api/test-run/history?testCaseId=${id}`).then(r => r.json());
        setHistory(Array.isArray(hist) ? hist : []);
      } else {
        const err = await res.json();
        alert(`生成失败: ${err.error}`);
      }
    } catch (err) {
      alert(`生成失败: ${err}`);
    } finally {
      setRegeneratingFromIssue(false);
    }
  };
  const handleFixScript = async () => {
    if (!id || history.length === 0) return;
    const lastFailed = history.find(h => h.status === 'failed');
    if (!lastFailed) { alert('没有找到失败的运行记录'); return; }
    setFixing(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/fix-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorMessage: lastFailed.errorMessage || 'Unknown error',
          logs: lastFailed.logs || '',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTestCase(updated);
        // Refresh fix logs
        const logs = await fetch(`/api/test-cases/${id}/fix-logs`).then(r => r.ok ? r.json() : []);
        setFixLogs(Array.isArray(logs) ? logs : []);
      } else {
        const err = await res.json();
        alert(`修复失败: ${err.error}`);
      }
    } catch (err) {
      alert(`修复失败: ${err}`);
    } finally {
      setFixing(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!id) return;
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/generate-report`, { method: 'POST' });
      if (res.ok) {
        const { report } = await res.json();
        setReportDraft(report);
      } else {
        const err = await res.json();
        alert(`生成报告失败: ${err.error}`);
      }
    } catch (err) {
      alert(`生成报告失败: ${err}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handlePublishReport = async () => {
    if (!id || !reportDraft) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/test-cases/${id}/publish-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportDraft }),
      });
      if (res.ok) {
        alert('✅ 报告已推送到 Issue 评论');
        setReportDraft(null);
      } else {
        const err = await res.json();
        alert(`推送失败: ${err.error}`);
      }
    } catch (err) {
      alert(`推送失败: ${err}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div style={styles.page}><p>加载中...</p></div>;
  if (!testCase) return <div style={styles.page}><p>未找到测试用例</p></div>;

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={() => navigate('/')}>← 返回</button>

      <div style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
          {editingTitle !== null ? (
            <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: '#1e293b', padding: '4px 8px', border: '2px solid #3b82f6', borderRadius: '6px', outline: 'none' }} />
              <button onClick={async () => {
                if (!id || !editingTitle.trim()) return;
                const res = await fetch(`/api/test-cases/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editingTitle }) });
                if (res.ok) { const u = await res.json(); setTestCase(u); setEditingTitle(null); }
              }} style={{ padding: '4px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>保存</button>
              <button onClick={() => setEditingTitle(null)} style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '12px', color: '#475569' }}>取消</button>
            </div>
          ) : (
            <h1 style={{ ...styles.title, flex: 1, cursor: 'pointer' }} onClick={() => setEditingTitle(testCase.title)} title="点击编辑标题">{testCase.title}</h1>
          )}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '8px' }}>ID: {testCase.id}</div>
        <div style={styles.meta}>
          <span style={styles.badge(testCase.status)}>{testCase.status}</span>
          {testCase.issueLink && (
            <>
              <a href={testCase.issueLink} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                🔗 {testCase.issueLink}
              </a>
              <button
                onClick={handleRegenerateFromIssue}
                disabled={regeneratingFromIssue}
                style={{ padding: '2px 10px', border: '1px solid #f59e0b', borderRadius: '12px', backgroundColor: '#fffbeb', cursor: 'pointer', fontSize: '12px', color: '#92400e', fontWeight: 600 }}
              >
                {regeneratingFromIssue ? '🤖 读取 Issue 中...' : '🤖 从 Issue 重新生成'}
              </button>
            </>
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
              ✏️ 编辑步骤
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>测试步骤</label>
              <button
                onClick={() => addStep()}
                style={{ padding: '3px 10px', border: '1px dashed #8b5cf6', borderRadius: '4px', backgroundColor: '#faf5ff', cursor: 'pointer', fontSize: '12px', color: '#7c3aed', fontWeight: 600 }}
              >
                ＋ 添加步骤
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ padding: '6px 4px', width: '44px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>序号</th>
                  <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '11px', color: '#64748b' }}>操作描述</th>
                  <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '11px', color: '#64748b' }}>预期结果</th>
                  <th style={{ padding: '6px 4px', width: '80px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {draftSteps.map((step, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        value={step.order}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setDraftSteps(prev => prev.map((s, idx) => idx === i ? { ...s, order: val } : s));
                        }}
                        style={{ width: '38px', padding: '4px 2px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '4px', verticalAlign: 'top' }}>
                      <textarea
                        value={step.action}
                        onChange={(e) => handleStepChange(i, 'action', e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                        placeholder="操作描述"
                      />
                    </td>
                    <td style={{ padding: '4px', verticalAlign: 'top' }}>
                      <textarea
                        value={step.expected}
                        onChange={(e) => handleStepChange(i, 'expected', e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', color: '#64748b', resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                        placeholder="预期结果"
                      />
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                        <button onClick={() => moveStep(i, 'up')} disabled={i === 0} title="上移"
                          style={{ width: '22px', height: '22px', border: '1px solid #e2e8f0', borderRadius: '3px', backgroundColor: '#fff', cursor: i === 0 ? 'default' : 'pointer', fontSize: '10px', color: i === 0 ? '#cbd5e1' : '#64748b', padding: 0 }}>▲</button>
                        <button onClick={() => moveStep(i, 'down')} disabled={i === draftSteps.length - 1} title="下移"
                          style={{ width: '22px', height: '22px', border: '1px solid #e2e8f0', borderRadius: '3px', backgroundColor: '#fff', cursor: i === draftSteps.length - 1 ? 'default' : 'pointer', fontSize: '10px', color: i === draftSteps.length - 1 ? '#cbd5e1' : '#64748b', padding: 0 }}>▼</button>
                        <button onClick={() => addStep(i)} title="插入"
                          style={{ width: '22px', height: '22px', border: '1px dashed #8b5cf6', borderRadius: '3px', backgroundColor: '#faf5ff', cursor: 'pointer', fontSize: '12px', color: '#7c3aed', padding: 0 }}>+</button>
                        <button onClick={() => removeStep(i)} disabled={draftSteps.length <= 1} title="删除"
                          style={{ width: '22px', height: '22px', border: '1px solid #fecaca', borderRadius: '3px', backgroundColor: draftSteps.length <= 1 ? '#f8fafc' : '#fef2f2', cursor: draftSteps.length <= 1 ? 'default' : 'pointer', fontSize: '12px', color: draftSteps.length <= 1 ? '#cbd5e1' : '#ef4444', padding: 0 }}>×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>预期结果</label>
              <textarea
                value={draftExpectedResults}
                onChange={(e) => setDraftExpectedResults(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', minHeight: '60px', resize: 'vertical' as const }}
              />
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
              <button
                onClick={handleSaveSteps}
                disabled={saving}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                {saving ? '💾 保存中...' : '💾 保存修改'}
              </button>
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

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' as const }}>
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
          {(testStatus === 'failed' || (history.length > 0 && history[0].status === 'failed')) && (
            <button
              onClick={handleFixScript}
              disabled={fixing}
              style={{ padding: '6px 16px', border: '1px solid #f59e0b', borderRadius: '6px', backgroundColor: '#fffbeb', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#92400e' }}
            >
              {fixing ? '🤖 AI 修复中...' : fixLogs.length >= 3 ? '🤖 再次修复' : '🤖 AI 修复脚本'}
            </button>
          )}
          {fixLogs.length >= 3 && (testStatus === 'failed' || (history.length > 0 && history[0].status === 'failed')) && (
            <span style={{ fontSize: '12px', color: '#f59e0b', padding: '4px 8px', backgroundColor: '#fffbeb', borderRadius: '4px' }}>
              ⚠ 已修复 {fixLogs.length} 次仍失败，建议精简测试步骤后重新生成脚本
            </span>
          )}
          {(testStatus === 'passed' || (history.length > 0 && history[0].status === 'passed')) && testCase.issueLink && (
            <button
              onClick={() => { setActiveTab('report'); handleGenerateReport(); }}
              disabled={generatingReport}
              style={{ padding: '6px 16px', border: '1px solid #10b981', borderRadius: '6px', backgroundColor: '#ecfdf5', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#065f46' }}
            >
              {generatingReport ? '📝 生成报告中...' : '📝 推送报告'}
            </button>
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
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0', marginBottom: '12px' }}>
          {([
            { key: 'history' as const, label: '📋 运行历史', count: history.length },
            { key: 'screenshots' as const, label: '📷 运行截图', count: history.length > 0 && history[0].screenshots ? history[0].screenshots.length : 0 },
            { key: 'fixes' as const, label: '🔧 修复记录', count: fixLogs.length },
            { key: 'report' as const, label: '📝 验收报告', count: 0 },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px', backgroundColor: 'transparent', cursor: 'pointer',
                fontSize: '13px', fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              }}
            >
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>

        {/* Tab: Run History */}
        {activeTab === 'history' && (
          history.length === 0 ? (
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
                      {run.screenshots && run.screenshots.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {run.screenshots.map((s, si) => (
                            <a key={si} href={s.path} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-block', padding: '2px 6px', backgroundColor: '#eff6ff', borderRadius: '4px', fontSize: '11px', color: '#3b82f6', textDecoration: 'none' }}>
                              📷 步骤{s.step}
                            </a>
                          ))}
                        </div>
                      ) : run.screenshot ? (
                        <a href={run.screenshot} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '12px' }}>📷 查看</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Tab: Screenshots */}
        {activeTab === 'screenshots' && (
          history.length > 0 && history[0].screenshots && history[0].screenshots.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {history[0].screenshots.map((s, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    步骤 {s.step}
                  </div>
                  <a href={s.path} target="_blank" rel="noopener noreferrer">
                    <img src={s.path} alt={`步骤 ${s.step} 截图`} style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>暂无截图，运行测试后会自动生成每个步骤的截图</p>
          )
        )}

        {/* Tab: Fix Logs */}
        {activeTab === 'fixes' && (
          fixLogs.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>暂无修复记录</p>
          ) : (
            fixLogs.map((log, i) => (
              <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>🤖 {log.explanation}</span>
                  <span style={{ color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>{new Date(log.fixed_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#ef4444', fontFamily: 'monospace', backgroundColor: '#fef2f2', padding: '4px 8px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  错误: {log.error_message}
                </div>
              </div>
            ))
          )
        )}

        {/* Tab: Report */}
        {activeTab === 'report' && (
          <div>
            {reportDraft !== null ? (
              <div>
                <textarea
                  value={reportDraft}
                  onChange={(e) => setReportDraft(e.target.value)}
                  style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', minHeight: '300px', resize: 'vertical' as const, boxSizing: 'border-box' as const, lineHeight: '1.6' }}
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button onClick={handlePublishReport} disabled={publishing}
                    style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    {publishing ? '📤 推送中...' : '📤 确认推送到 Issue'}
                  </button>
                  <button onClick={() => setReportDraft(null)}
                    style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>点击下方按钮，AI 将根据测试结果生成验收报告</p>
                <button onClick={() => { handleGenerateReport(); }} disabled={generatingReport || !testCase.issueLink}
                  style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', backgroundColor: testCase.issueLink ? '#10b981' : '#cbd5e1', color: '#fff', cursor: testCase.issueLink ? 'pointer' : 'default', fontSize: '13px', fontWeight: 600 }}>
                  {generatingReport ? '📝 生成中...' : '📝 生成验收报告'}
                </button>
                {!testCase.issueLink && <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '8px' }}>需要先关联 Issue</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
