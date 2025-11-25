import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAdminLoggedIn = localStorage.getItem('adminToken');
  const isStudentSession = location.pathname.startsWith('/session/');

  // Hide navbar on home, login, and join pages
  if (location.pathname === '/' || location.pathname === '/admin/login' || location.pathname === '/join') {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: isMobile ? '12px 15px' : '15px 30px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      position: 'sticky',
      top: 0,
      zIndex: 10000,
      pointerEvents: 'auto'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        gap: '15px',
        position: 'relative',
        zIndex: 10001
      }}>
        {/* Back Button - Hide on student session and dashboard */}
        {!isStudentSession && location.pathname !== '/admin/dashboard' && (
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <span>←</span>
            {!isMobile && <span>Back</span>}
          </button>
        )}

        {/* Logo/Title */}
        <div 
          onClick={() => navigate('/')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            cursor: 'pointer',
            flex: 1
          }}
        >
          <span style={{ fontSize: isMobile ? '24px' : '28px' }}>🎯</span>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '16px' : '20px',
            fontWeight: '700',
            color: 'white'
          }}>
            Live MCQ System
          </h1>
        </div>

        {/* Desktop Buttons - Hide on student session */}
        {!isMobile && !isStudentSession && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                padding: '10px 18px',
                backgroundColor: location.pathname === '/admin/dashboard' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </button>
            {!isAdminLoggedIn && (
              <button
                onClick={() => navigate('/join')}
                style={{
                  padding: '10px 18px',
                  backgroundColor: location.pathname === '/join' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🎓</span>
                <span>Join</span>
              </button>
            )}
            {isAdminLoggedIn && (
              <button
                onClick={async () => {
                  const token = localStorage.getItem('adminToken');
                  try {
                    await fetch('http://localhost:5000/api/admin/session/delete', {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                  } catch (error) {
                    console.error('Session delete error:', error);
                  }
                  localStorage.clear();
                  navigate('/');
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'rgba(231, 76, 60, 0.3)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            )}
          </div>
        )}

        {/* Mobile Hamburger - Hide on student session */}
        {isMobile && !isStudentSession && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '20px',
              minWidth: '40px',
              transition: 'all 0.3s'
            }}
          >
            {showMenu ? '✕' : '☰'}
          </button>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobile && showMenu && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '15px',
          marginTop: '8px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          padding: '8px',
          minWidth: '180px',
          zIndex: 10002
        }}>
          <button
            onClick={() => {
              navigate('/admin/dashboard');
              setShowMenu(false);
            }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: '#2c3e50',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '4px',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
          >
            <span style={{ fontSize: '18px' }}>📊</span>
            <span>Dashboard</span>
          </button>
          {!isAdminLoggedIn && (
            <button
              onClick={() => {
                navigate('/join');
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#2c3e50',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '4px',
                transition: 'all 0.3s',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '18px' }}>🎓</span>
              <span>Join as Student</span>
            </button>
          )}
          {isAdminLoggedIn && (
            <button
              onClick={async () => {
                const token = localStorage.getItem('adminToken');
                try {
                  await fetch('http://localhost:5000/api/admin/session/delete', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                } catch (error) {
                  console.error('Session delete error:', error);
                }
                localStorage.clear();
                navigate('/');
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#e74c3c',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '18px' }}>🚪</span>
              <span>Logout</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Navbar;
