// Trigger a title update to rename the file to ID-based name
const id = 'f3efd757-12d7-41ed-90f9-c3bf9d46ad56';
const res = await fetch(`http://localhost:3001/api/test-cases/${id}`);
const tc = await res.json();
const updateRes = await fetch(`http://localhost:3001/api/test-cases/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: tc.title }),
});
const updated = await updateRes.json();
console.log('Done. Check e2e folder for renamed file.');
