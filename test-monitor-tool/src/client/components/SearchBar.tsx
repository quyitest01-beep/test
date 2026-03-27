import { useState } from 'react';

interface SearchFilters {
  name: string;
  issueLink: string;
  status: string;
}

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
}

const styles = {
  container: {
    display: 'flex', gap: '8px', padding: '12px', backgroundColor: '#f8fafc',
    borderRadius: '8px', flexWrap: 'wrap' as const, alignItems: 'center',
  },
  input: {
    padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '13px', outline: 'none', flex: '1', minWidth: '140px',
  },
  select: {
    padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '13px', outline: 'none', backgroundColor: '#fff', cursor: 'pointer',
  },
  btn: {
    padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
  },
};

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [filters, setFilters] = useState<SearchFilters>({ name: '', issueLink: '', status: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleClear = () => {
    const cleared = { name: '', issueLink: '', status: '' };
    setFilters(cleared);
    onSearch(cleared);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.container} role="search" aria-label="筛选测试用例">
      <input
        style={styles.input}
        placeholder="测试名称..."
        value={filters.name}
        onChange={(e) => setFilters({ ...filters, name: e.target.value })}
        aria-label="按名称筛选"
      />
      <input
        style={{ ...styles.input, maxWidth: '200px' }}
        placeholder="Issue 链接..."
        value={filters.issueLink}
        onChange={(e) => setFilters({ ...filters, issueLink: e.target.value })}
        aria-label="按 Issue 链接筛选"
      />
      <select
        style={styles.select}
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        aria-label="按状态筛选"
      >
        <option value="">全部状态</option>
        <option value="passed">通过</option>
        <option value="failed">失败</option>
        <option value="skipped">跳过</option>
        <option value="not_run">未运行</option>
        <option value="pending_info">待补充</option>
        <option value="pending_publish">待发布</option>
      </select>
      <button type="submit" style={{ ...styles.btn, backgroundColor: '#3b82f6', color: '#fff' }}>搜索</button>
      <button type="button" onClick={handleClear} style={{ ...styles.btn, backgroundColor: '#e2e8f0', color: '#475569' }}>清除</button>
    </form>
  );
}
