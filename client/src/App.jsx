import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vocabulary from './pages/Vocabulary';
import Grammar from './pages/Grammar';
import Reading from './pages/Reading';
import Listening from './pages/Listening';
import TestLibrary from './pages/TestLibrary';
import ImportTest from './pages/ImportTest';
import TestPreview from './pages/TestPreview';
import TakeTest from './pages/TakeTest';
import MistakeBook from './pages/MistakeBook';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <NavBar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
        <Route path="/grammar" element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
        <Route path="/reading" element={<ProtectedRoute><Reading /></ProtectedRoute>} />
        <Route path="/listening" element={<ProtectedRoute><Listening /></ProtectedRoute>} />
        <Route path="/tests" element={<ProtectedRoute><TestLibrary /></ProtectedRoute>} />
        <Route path="/tests/import" element={<ProtectedRoute><ImportTest /></ProtectedRoute>} />
        <Route path="/tests/:id/take" element={<ProtectedRoute><TakeTest /></ProtectedRoute>} />
        <Route path="/tests/:id" element={<ProtectedRoute><TestPreview /></ProtectedRoute>} />
        <Route path="/mistakes" element={<ProtectedRoute><MistakeBook /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
