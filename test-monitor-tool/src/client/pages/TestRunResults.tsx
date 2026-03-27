import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import RunProgress from '../components/RunProgress';

interface TestRunResult {
  testCaseId: string;
  status: string;
  duration: number;
  errorMessage?: string;
  screenshot?: string;
  logs: string;
}

interface RunningStatus {
  isRunning: boolean;
  currentTestCase: string;
  progress: number;
  total: number;
  completed: number;
}

const styles = {
  page: { maxWidth: '1000px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1e293b' },
  backLink: { color: '#3b82f6', textDecoration: 'none', fontSize: '13px' },
  actions: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const },
  btn: (primary: boolean) => ({
    padding: '8px 16px', border: primary ? 'none' : '1px solid #cbd5e1', borderRadius: '6px',
    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
    backgroundColor: primary ? '#3b82f6' : '#fff', color: primary ? '#fff' : '#475569',
  }),
  dirInput: {
    padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '13px', outline: 'none', width: '200px',
  },
  card: {
    backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
    padding: '20px', marginBottom: '16px',
  },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' },
  summaryItem: (color: string) => ({
    padding: '12px', borderRadius: '6px', backgroundColor: `${color}10`, textAlign: 'center' as const,
  }),
  summaryVal: (color: string) => ({ fontSize: '24px', fontWeight: 700, color }),
  summaryLabel: { fontSize: '11px', color: '#64748b', marginTop: '2px' },
  badge: (status: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    backgroundColor: status === 'passed' ? '#dcfce7' : status === 'failed' ? '#fee2e2' : '#f1f5f9',
    color: status === 'passed' ? '#166534' : status === 'failed' ? '#991b1b' : '#475569',
  }),
  errorBox: {
    marginTop: '4px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px',
    fontSize: '12px', color: '#991b1b', fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const,
    maxHeight: '100px', overflow: 'auto' as const,
  },
};

export default function TestRunResults() {
  const [runStatus, setRunStatus] = useState<RunningStatus>({ isRunning: false, currentTestCase: '', progress: 0, total: 0, completed: 0 });
  const [results, setResults] = useState<TestRunResult[]>([]);
  const [summary, setSummary] = useState<{ totalCount: number; passedCount: number; failedCount: number; skippedCount: number; totalDuration: number } | null>(null);
  const [dirPath, setDirPath] = useState('');
  const [history, setHistory] = useState<TestRunResult[]>([]);
  const { socket } = useSocket();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/test-run/status');
      if (res.ok) setRunStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/test-run/history');
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStatus(); fetchHistory(); }, [fetchStatus, fetchHistory]);

  useEffect(() => {
    if (!socket) return;
    const onProgress = (data: RunningStatus) => setRunStatus(data);
    const onComplete = (data: { summary: typeof summary; results: TestRunResult[] }) => {
      setSummary(data.summary);
      setResults(data.results || []);
      setRunStatus({ isRunning: false, currentTestCase: '', progress: 100, total: 0, completed: 0 });
      fetchHistory();
    };
    socket.on('test:progress', onProgress);
    socket.on('test:complete', onComplete);
    return () => { socket.off('test:progress', onProgress); socket.off('test:complete', onComplete); };
  }, [socket, fetchHistory]);

  const runAll = async () => {
    try {
      const res = await fetch('/api/test-run/all', { method: 'POST' });
      if (res.ok) { const data = await res.json(); setSummary(data); setResults(data.results || []); }
    } catch (err) { console.error('Run all failed:', err); }
  };

  const runDirectory = async () => {
    if (!dirPath.trim()) return;
    try {
      const res = await fetch('/api/test-run/directory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath }),
      });
      if (res.ok) { const data = await res.json(); setSummary(data); setResults(data.results || []); }
    } catch (err) { console.error('Run directory failed:', err); }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>测试运行结果</h1>
        <a href="/" style={styles.backLink}>← 返回面板</a>
      </div>

      <RunProgress {...runStatus} />

      <div style={{ ...styles.actions, marginTop: '16px' }}>
        <button style={styles.btn(true)} onClick={runAll} disabled={runStatus.isRunning}>▶ 运行全部测试</button>
        <input style={styles.dirInput} placeholder="目录路径..." value={dirPath}
          onChange={(e) => setDirPath(e.target.value)} aria-label="批量运行的目录路径" />
        <button style={styles.btn(false)} onClick={runDirectory} disabled={runStatus.isRunning || !dirPath.trim()}>
          📁 按目录运行
        </button>
      </div>

      {summary && (
        <div style={styles.card}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>最近运行摘要</h2>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem('#3b82f6')}>
              <div style={styles.summaryVal('#3b82f6')}>{summary.totalCount}</div>
              <div style={styles.summaryLabel}>总计</div>
            </div>
            <div style={styles.summaryItem('#22c55e')}>
              <div style={styles.summaryVal('#22c55e')}>{summary.passedCount}</div>
              <div style={styles.summaryLabel}>通过</div>
            </div>
            <div style={styles.summaryItem('#ef4444')}>
              <div style={styles.summaryVal('#ef4444')}>{summary.failedCount}</div>
              <div style={styles.summaryLabel}>失败</div>
            </div>
            <div style={styles.summaryItem('#f59e0b')}>
              <div style={styles.summaryVal('#f59e0b')}>{summary.skippedCount}</div>
              <div style={styles.summaryLabel}>跳过</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>总耗时: {summary.totalDuration}ms</div>
        </div>
      )}

      {results.length > 0 && (
        <div style={styles.card}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>详细结果</h2>
          {results.map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{r.testCaseId}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{r.duration}ms</span>
                  <span style={styles.badge(r.status)}>{r.status}</span>
                </div>
              </div>
              {r.errorMessage && <div style={styles.errorBox}>{r.errorMessage}</div>}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div style={styles.card}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>运行历史</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>测试用例</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>耗时</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>{r.testCaseId}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}><span style={styles.badge(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>{r.duration}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
