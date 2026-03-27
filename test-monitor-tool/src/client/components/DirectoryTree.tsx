import { useState } from 'react';

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  id?: string;
  status?: string;
  issueLink?: string | null;
  lastRunAt?: string | null;
}

interface DirectoryTreeProps {
  tree: TreeNode | null;
  onSelectTestCase?: (id: string) => void;
  onSelectDirectory?: (path: string) => void;
  selectedId?: string | null;
}

const styles = {
  container: { fontFamily: 'monospace', fontSize: '13px', userSelect: 'none' as const },
  dirRow: {
    display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer',
    borderRadius: '4px', gap: '4px',
  },
  leafRow: {
    display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer',
    borderRadius: '4px', gap: '6px', marginLeft: '4px',
  },
  children: { marginLeft: '16px' },
  statusDot: (status: string) => ({
    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
    backgroundColor: status === 'passed' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#94a3b8',
  }),
};

function isLeaf(node: TreeNode): boolean {
  return !!node.id;
}

function DirectoryNode({ node, onSelectTestCase, onSelectDirectory, selectedId, depth }: DirectoryTreeProps & { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (isLeaf(node)) {
    const isSelected = selectedId === node.id;
    return (
      <div
        style={{ ...styles.leafRow, backgroundColor: isSelected ? '#e0e7ff' : 'transparent' }}
        onClick={() => onSelectTestCase?.(node.id!)}
        role="treeitem"
        aria-selected={isSelected}
      >
        <span style={styles.statusDot(node.status || 'not_run')} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
    );
  }

  return (
    <div role="group">
      <div
        style={{ ...styles.dirRow, fontWeight: 600 }}
        onClick={() => { setExpanded(!expanded); onSelectDirectory?.(node.path); }}
        role="treeitem"
        aria-expanded={expanded}
      >
        <span style={{ width: '16px', textAlign: 'center' }}>{expanded ? '▼' : '▶'}</span>
        <span>📁 {node.name}</span>
        {node.children && <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>({node.children.length})</span>}
      </div>
      {expanded && node.children && (
        <div style={styles.children}>
          {node.children.map((child, i) => (
            <DirectoryNode
              key={child.id || child.path || i}
              node={child}
              tree={null}
              onSelectTestCase={onSelectTestCase}
              onSelectDirectory={onSelectDirectory}
              selectedId={selectedId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DirectoryTree({ tree, onSelectTestCase, onSelectDirectory, selectedId }: DirectoryTreeProps) {
  if (!tree) return <div style={{ padding: '16px', color: '#94a3b8' }}>暂无测试用例</div>;

  return (
    <div style={styles.container} role="tree" aria-label="测试用例目录树">
      <DirectoryNode
        node={tree}
        tree={tree}
        onSelectTestCase={onSelectTestCase}
        onSelectDirectory={onSelectDirectory}
        selectedId={selectedId}
        depth={0}
      />
    </div>
  );
}
