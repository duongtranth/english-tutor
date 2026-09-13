import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout, examType, setExamType } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">📚 English Tutor</div>
      <div className="navbar-links">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/vocabulary">Vocabulary</NavLink>
        <NavLink to="/grammar">Grammar</NavLink>
        <NavLink to="/reading">Reading</NavLink>
        <NavLink to="/listening">Listening</NavLink>
        <NavLink to="/tests">Tests</NavLink>
        <NavLink to="/mistakes">Mistakes</NavLink>
      </div>
      <div className="navbar-right">
        <select value={examType} onChange={(e) => setExamType(e.target.value)}>
          <option value="TOEIC">TOEIC</option>
          <option value="IELTS">IELTS</option>
        </select>
        <span className="navbar-user">{user.name}</span>
        <button
          className="btn-link"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
