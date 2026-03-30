import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database.js';

const router = Router();

interface SnippetRow {
  id: string;
  category: string;
  name: string;
  description: string | null;
  code: string;
  env: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/snippets — list all, optional ?category=&env= filters */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    let query = 'SELECT * FROM test_snippets';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (typeof req.query.category === 'string') {
      conditions.push('category = ?');
      params.push(req.query.category);
    }
    if (typeof req.query.env === 'string') {
      conditions.push("(env = ? OR env = 'all')");
      params.push(req.query.env);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY category, name';

    const rows = db.prepare(query).all(...params) as SnippetRow[];
    res.json(rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })));
  } catch (err) {
    console.error('[snippetRoutes] GET error:', err);
    res.status(500).json({ error: 'Failed to list snippets' });
  }
});

/** POST /api/snippets — create */
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { category, name, description, code, env, tags } = req.body;
    if (!category || !name || !code) {
      res.status(400).json({ error: 'category, name, code are required' });
      return;
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO test_snippets (id, category, name, description, code, env, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(id, category, name, description || '', code, env || 'all', tags ? JSON.stringify(tags) : '[]', now, now);
    res.json({ id, category, name, description: description || '', code, env: env || 'all', tags: tags || [], created_at: now, updated_at: now });
  } catch (err) {
    console.error('[snippetRoutes] POST error:', err);
    res.status(500).json({ error: 'Failed to create snippet' });
  }
});

/** PUT /api/snippets/:id — update */
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM test_snippets WHERE id = ?').get(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Snippet not found' }); return; }

    const { category, name, description, code, env, tags } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE test_snippets SET category=?, name=?, description=?, code=?, env=?, tags=?, updated_at=? WHERE id=?'
    ).run(category, name, description || '', code, env || 'all', tags ? JSON.stringify(tags) : '[]', now, req.params.id);

    const row = db.prepare('SELECT * FROM test_snippets WHERE id = ?').get(req.params.id) as SnippetRow;
    res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
  } catch (err) {
    console.error('[snippetRoutes] PUT error:', err);
    res.status(500).json({ error: 'Failed to update snippet' });
  }
});

/** DELETE /api/snippets/:id */
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM test_snippets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Snippet not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error('[snippetRoutes] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete snippet' });
  }
});

export default router;
