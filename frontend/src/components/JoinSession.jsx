import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function JoinSession() {
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/session/verify/${sessionCode.toUpperCase()}`);
      const data = await res.json();

      if (data.valid) {
        localStorage.setItem('studentSessionCode', sessionCode.toUpperCase());
        navigate(`/session/${sessionCode.toUpperCase()}`);
      } else {
        alert('Invalid or expired session code!');
      }
    } catch (error) {
      alert('Error joining session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 100px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '50px',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        maxWidth: '500px',
        width: '100%'
      }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎓</div>
          <h1 style={{ color: '#2c3e50', marginBottom: '10px', fontSize: '32px' }}>
            Join Session
          </h1>
          <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
            Enter the session code provided by your instructor
          </p>
        </div>

        <form onSubmit={handleJoin}>
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '16px'
            }}>
              Session Code
            </label>
            <input
              type="text"
              placeholder="ENTER CODE"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              style={{
                width: '100%',
                padding: '20px',
                fontSize: '24px',
                fontWeight: '700',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                boxSizing: 'border-box',
                textAlign: 'center',
                letterSpacing: '4px',
                textTransform: 'uppercase',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3498db'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <button
            type="submit"
            disabled={loading || sessionCode.length !== 6}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              fontWeight: '700',
              background: (loading || sessionCode.length !== 6) ? '#bdc3c7' : '#27ae60',
              color: 'white',
              border: 'none',
              cursor: (loading || sessionCode.length !== 6) ? 'not-allowed' : 'pointer',
              borderRadius: '12px',
              boxShadow: (loading || sessionCode.length !== 6) ? 'none' : '0 8px 20px rgba(39, 174, 96, 0.3)'
            }}
          >
            {loading ? 'Joining...' : '✓ Join Session'}
          </button>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px solid #e0e0e0'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#7f8c8d', lineHeight: '1.6' }}>
            💡 <strong>Tip:</strong> Ask your instructor for the session code to participate in live MCQ polls.
          </p>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#e3f2fd',
          borderRadius: '12px',
          border: '1px solid #bbdefb',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#7f8c8d' }}>
            Are you an admin?
          </p>
          <button
            onClick={() => navigate('/admin/login')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s',
              margin: '0 auto'
            }}
          >
            <span>👨‍💼</span>
            <span>Login as Admin</span>
          </button>
        </div>

        <div style={{
          marginTop: '20px',
          textAlign: 'center'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
          >
            <span>←</span>
            <span>Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinSession;
