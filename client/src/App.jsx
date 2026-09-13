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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
