import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import DirectoryTree from '../components/DirectoryTree';
import TestCaseList from '../components/TestCaseList';
import SearchBar from '../components/SearchBar';

interface Stats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  id?: string;
  status?: string;
  issueLink?: string | null;
  lastRunAt?: string | null;
}

const styles = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#1e293b' },
  nav: { display: 'flex', gap: '12px' },
  navLink: {
    padding: '6px 14px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px',
    color: '#475569', backgroundColor: '#f1f5f9', fontWeight: 500,
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: (color: string) => ({
    padding: '16px', borderRadius: '8px', backgroundColor: '#fff',
    border: `1px solid ${color}20`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }),
  statValue: (color: string) => ({ fontSize: '28px', fontWeight: 700, color }),
  statLabel: { fontSize: '12px', color: '#64748b', marginTop: '4px' },
  layout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' },
  sidebar: {
    backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
    padding: '12px', maxHeight: '600px', overflowY: 'auto' as const,
  },
  main: { backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' },
};

function collectLeaves(node: TreeNode): Array<{ id: string; name: string; status: string; issueLink: string | null; lastRunAt: string | null }> {
  if (node.id) return [{ id: node.id, name: node.name, status: node.status || 'not_run', issueLink: node.issueLink || null, lastRunAt: node.lastRunAt || null }];
  return (node.children || []).flatMap(collectLeaves);
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, skipped: 0 });
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [listItems, setListItems] = useState<Array<{ id: string; name: string; status: string; issueLink: string | null; lastRunAt: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(async (filters?: { name?: string; issueLink?: string; status?: string }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.name) params.set('name', filters.name);
      if (filters?.issueLink) params.set('issueLink', filters.issueLink);
      if (filters?.status) params.set('status', filters.status);
      const qs = params.toString();

      const [statsRes, treeRes] = await Promise.all([
        fetch('/api/stats'),
        fetch(`/api/test-cases${qs ? `?${qs}` : ''}`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        setTree(treeData);
        setListItems(collectLeaves(treeData));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on('testcase:created', refresh);
    socket.on('test:complete', refresh);
    socket.on('file:change', refresh);
    return () => {
      socket.off('testcase:created', refresh);
      socket.off('test:complete', refresh);
      socket.off('file:change', refresh);
    };
  }, [socket, fetchData]);

  const handleSelectDirectory = (path: string) => {
    setSelectedDir(path);
    if (tree) {
      const findNode = (node: TreeNode): TreeNode | null => {
        if (node.path === path) return node;
        for (const child of node.children || []) {
          const found = findNode(child);
          if (found) return found;
        }
        return null;
      };
      const dirNode = findNode(tree);
      setListItems(dirNode ? collectLeaves(dirNode) : []);
    }
  };

  const handleRunSingle = async (id: string) => {
    try {
      await fetch(`/api/test-run/single/${id}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to run test:', err);
    }
  };

  const handleSearch = (filters: { name: string; issueLink: string; status: string }) => {
    setLoading(true);
    setSelectedDir(null);
    fetchData(filters);
  };

  const [scanning, setScanning] = useState(false);
  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        console.info(`Scanned ${data.filesScanned} files`);
        // Refresh data after scan
        await fetchData();
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
  const failRate = stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : '0';

  if (loading) return <div style={styles.page}><p>加载中...</p></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>测试监控面板</h1>
        <nav style={styles.nav}>
          <button onClick={handleScan} disabled={scanning} style={{
            padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
            border: '1px solid #3b82f6', backgroundColor: scanning ? '#93c5fd' : '#eff6ff',
            color: '#3b82f6', cursor: scanning ? 'default' : 'pointer',
          }}>
            {scanning ? '🔄 扫描中...' : '🔍 扫描已有文件'}
          </button>
          <a href="/issues" style={styles.navLink}>GitHub Issues</a>
          <a href="/test-run" style={styles.navLink}>测试运行</a>
          <a href="/settings" style={styles.navLink}>系统设置</a>
        </nav>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard('#3b82f6')}>
          <div style={styles.statValue('#3b82f6')}>{stats.total}</div>
          <div style={styles.statLabel}>测试总数</div>
        </div>
        <div style={styles.statCard('#22c55e')}>
          <div style={styles.statValue('#22c55e')}>{stats.passed}</div>
          <div style={styles.statLabel}>通过 ({passRate}%)</div>
        </div>
        <div style={styles.statCard('#ef4444')}>
          <div style={styles.statValue('#ef4444')}>{stats.failed}</div>
          <div style={styles.statLabel}>失败 ({failRate}%)</div>
        </div>
        <div style={styles.statCard('#f59e0b')}>
          <div style={styles.statValue('#f59e0b')}>{stats.skipped}</div>
          <div style={styles.statLabel}>跳过</div>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} />

      <div style={{ ...styles.layout, marginTop: '16px' }}>
        <aside style={styles.sidebar}>
          <div style={styles.sectionTitle}>目录树</div>
          <DirectoryTree
            tree={tree}
            onSelectTestCase={(id) => window.location.href = `/test-cases/${id}`}
            onSelectDirectory={handleSelectDirectory}
          />
        </aside>
        <main style={styles.main}>
          <div style={styles.sectionTitle}>
            {selectedDir ? `${selectedDir} 中的测试` : '全部测试用例'}
          </div>
          <TestCaseList items={listItems} onRun={handleRunSingle} />
        </main>
      </div>
    </div>
  );
}
