import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TestCaseDetail from './pages/TestCaseDetail';
import TestRunResults from './pages/TestRunResults';
import Settings from './pages/Settings';
import Issues from './pages/Issues';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/test-cases/:id" element={<TestCaseDetail />} />
      <Route path="/test-run" element={<TestRunResults />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/issues" element={<Issues />} />
    </Routes>
  );
}
