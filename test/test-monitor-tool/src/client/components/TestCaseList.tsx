import { useNavigate } from 'react-router-dom';

interface TestCaseItem {
  id: string;
  name: string;
  status: string;
  issueLink: string | null;
  lastRunAt: string | null;
}

interface TestCaseListProps {
  items: TestCaseItem[];
  onRun?: (id: string) => void;
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: {
    textAlign: 'left' as const, padding: '8px 12px', borderBottom: '2px solid #e2e8f0',
    color: '#64748b', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' as const,
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9' },
  row: { cursor: 'pointer', transition: 'background 0.15s' },
  statusBadge: (status: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    backgroundColor: status === 'passed' ? '#dcfce7' : status === 'failed' ? '#fee2e2' : status === 'skipped' ? '#fef9c3' : '#f1f5f9',
    color: status === 'passed' ? '#166534' : status === 'failed' ? '#991b1b' : status === 'skipped' ? '#854d0e' : '#475569',
  }),
  runBtn: {
    padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer',
    backgroundColor: '#fff', fontSize: '12px',
  },
  empty: { padding: '24px', textAlign: 'center' as const, color: '#94a3b8' },
};

export default function TestCaseList({ items, onRun }: TestCaseListProps) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return <div style={styles.empty}>该目录下暂无测试用例</div>;
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>名称</th>
          <th style={styles.th}>状态</th>
          <th style={styles.th}>Issue</th>
          <th style={styles.th}>最近运行</th>
          {onRun && <th style={styles.th}>操作</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            style={styles.row}
            onClick={() => navigate(`/test-cases/${item.id}`)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
          >
            <td style={styles.td}>{item.name}</td>
            <td style={styles.td}><span style={styles.statusBadge(item.status)}>{item.status}</span></td>
            <td style={styles.td}>
              {item.issueLink ? (
                <a href={item.issueLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ color: '#3b82f6', textDecoration: 'none' }}>
                  {item.issueLink.split('/').pop()}
                </a>
              ) : <span style={{ color: '#94a3b8' }}>—</span>}
            </td>
            <td style={styles.td}>
              {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : <span style={{ color: '#94a3b8' }}>从未运行</span>}
            </td>
            {onRun && (
              <td style={styles.td}>
                <button style={styles.runBtn} onClick={(e) => { e.stopPropagation(); onRun(item.id); }}
                  aria-label={`运行测试 ${item.name}`}>
                  ▶ 运行
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
