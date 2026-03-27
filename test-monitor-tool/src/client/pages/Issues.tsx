import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface IssueInfo {
  title: string;
  description: string;
  labels: string[];
  url: string;
}

interface TestCaseItem {
  id: string;
  name: string;
  status: string;
  issueLink: string | null;
}

const styles = {
  page: { maxWidth: '1000px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1e293b' },
  backLink: { color: '#3b82f6', textDecoration: 'none', fontSize: '13px' },
  filters: { display: 'flex', gap: '8px', marginBottom: '16px' },
  filterBtn: (active: boolean) => ({
    padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    border: active ? '1px solid #3b82f6' : '1px solid #cbd5e1',
    backgroundColor: active ? '#eff6ff' : '#fff', color: active ? '#3b82f6' : '#475569',
  }),
  card: {
    backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
    padding: '16px', marginBottom: '12px',
  },
  issueTitle: { fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' },
  issueDesc: { fontSize: '13px', color: '#64748b', marginBottom: '8px', maxHeight: '60px', overflow: 'hidden' },
  label: { display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500, backgroundColor: '#f1f5f9', color: '#475569', marginRight: '4px' },
  link: { fontSize: '12px', color: '#3b82f6', textDecoration: 'none' },
  empty: { padding: '40px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '14px' },
  loadMore: { display: 'block', width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569', textAlign: 'center' as const },
  bindBtn: { padding: '4px 12px', border: '1px solid #f59e0b', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  tcPanel: { marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' as const, backgroundColor: '#fafafa' },
  tcRow: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' },
};

function collectLeaves(node: any): TestCaseItem[] {
  if (node.id) return [{ id: node.id, name: node.name, status: node.status || 'not_run', issueLink: node.issueLink || null }];
  return (node.children || []).flatMap(collectLeaves);
}

export default function Issues() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<IssueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [testCases, setTestCases] = useState<TestCaseItem[]>([]);
  const [bindingIssueUrl, setBindingIssueUrl] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const fetchIssues = async (p: number, s: string, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues?page=${p}&perPage=20&state=${s}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(prev => append ? [...prev, ...data] : data);
        setHasMore(data.length === 20);
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestCases = async () => {
    try {
      const res = await fetch('/api/test-cases');
      if (res.ok) {
        const tree = await res.json();
        setTestCases(collectLeaves(tree));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { setPage(1); fetchIssues(1, state); }, [state]);

  const handleBind = (issueUrl: string) => {
    if (bindingIssueUrl === issueUrl) {
      setBindingIssueUrl(null);
      return;
    }
    setBindingIssueUrl(issueUrl);
    if (testCases.length === 0) fetchTestCases();
  };

  const handleLinkTestCase = async (testCaseId: string, issueUrl: string) => {
    setLinking(true);
    try {
      const res = await fetch(`/api/test-cases/${testCaseId}/link-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl }),
      });
      if (res.ok) {
        setBindingIssueUrl(null);
        // Refresh test cases to update status
        fetchTestCases();
        alert('关联成功，AI 已增强测试用例');
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

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchIssues(next, state, true);
  };

  // Filter test cases: show unlinked ones first, then ones not linked to this issue
  const availableTestCases = testCases.filter(tc => !tc.issueLink || tc.issueLink !== bindingIssueUrl);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>GitHub Issues</h1>
        <a href="/" style={styles.backLink} onClick={(e) => { e.preventDefault(); navigate('/'); }}>← 返回面板</a>
      </div>

      <div style={styles.filters}>
        {(['open', 'closed', 'all'] as const).map((s) => (
          <button key={s} style={styles.filterBtn(state === s)} onClick={() => setState(s)}>
            {s === 'open' ? '🟢 开放' : s === 'closed' ? '🔴 已关闭' : '📋 全部'}
          </button>
        ))}
      </div>

      {!loading && issues.length === 0 && (
        <div style={styles.empty}>暂无 Issue，请检查 GitHub 仓库配置</div>
      )}

      {issues.map((issue, i) => (
        <div key={i} style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={styles.issueTitle}>{issue.title}</div>
              {issue.description && (
                <div style={styles.issueDesc}>{issue.description.slice(0, 200)}{issue.description.length > 200 ? '...' : ''}</div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {issue.labels.map((label, j) => (
                  <span key={j} style={styles.label}>{label}</span>
                ))}
                <a href={issue.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  🔗 {issue.url.split('/').slice(-2).join('/')}
                </a>
              </div>
            </div>
            <button style={styles.bindBtn} onClick={() => handleBind(issue.url)}>
              {bindingIssueUrl === issue.url ? '收起' : '📎 绑定测试文件'}
            </button>
          </div>

          {bindingIssueUrl === issue.url && (
            <div style={styles.tcPanel}>
              {availableTestCases.length === 0 && (
                <div style={{ padding: '16px', color: '#94a3b8', textAlign: 'center', fontSize: '13px' }}>
                  暂无可绑定的测试用例
                </div>
              )}
              {availableTestCases.map((tc) => (
                <div key={tc.id} style={styles.tcRow}
                  onClick={() => !linking && handleLinkTestCase(tc.id, issue.url)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f9ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{tc.name}</span>
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: tc.issueLink ? '#22c55e' : '#f59e0b' }}>
                      {tc.issueLink ? '已关联' : '未关联'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#3b82f6' }}>{linking ? '处理中...' : '选择绑定'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>加载中...</div>}

      {!loading && hasMore && issues.length > 0 && (
        <button style={styles.loadMore} onClick={loadMore}>加载更多</button>
      )}
    </div>
  );
}
