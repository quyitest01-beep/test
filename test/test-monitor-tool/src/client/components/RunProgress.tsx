interface RunProgressProps {
  isRunning: boolean;
  currentTestCase: string;
  progress: number;
  total: number;
  completed: number;
}

const styles = {
  container: {
    padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px',
    border: '1px solid #bfdbfe',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  title: { fontWeight: 600, fontSize: '14px', color: '#1e40af' },
  counter: { fontSize: '13px', color: '#3b82f6' },
  barOuter: {
    width: '100%', height: '8px', backgroundColor: '#dbeafe', borderRadius: '4px',
    overflow: 'hidden' as const,
  },
  barInner: (pct: number) => ({
    width: `${pct}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '4px',
    transition: 'width 0.3s ease',
  }),
  currentLabel: { marginTop: '8px', fontSize: '12px', color: '#64748b' },
  idle: { padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' as const },
};

export default function RunProgress({ isRunning, currentTestCase, progress, total, completed }: RunProgressProps) {
  if (!isRunning) {
    return <div style={styles.idle}>当前没有运行中的测试</div>;
  }

  return (
    <div style={styles.container} role="status" aria-live="polite" aria-label="测试执行进度">
      <div style={styles.header}>
        <span style={styles.title}>⏳ 正在运行测试...</span>
        <span style={styles.counter}>{completed} / {total}</span>
      </div>
      <div style={styles.barOuter}>
        <div style={styles.barInner(progress)} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
      </div>
      {currentTestCase && (
        <div style={styles.currentLabel}>当前: {currentTestCase}</div>
      )}
    </div>
  );
}
