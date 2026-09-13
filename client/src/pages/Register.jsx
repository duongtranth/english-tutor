import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Tạo tài khoản</h1>
        {error && <div className="error-box">{error}</div>}
        <label>Tên</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Mật khẩu (tối thiểu 6 ký tự)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button type="submit" disabled={loading}>{loading ? 'Đang tạo...' : 'Đăng ký'}</button>
        <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </form>
    </div>
  );
}
