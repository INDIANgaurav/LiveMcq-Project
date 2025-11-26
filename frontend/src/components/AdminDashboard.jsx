import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toast from './Toast';
import VoteHistory from './VoteHistory';
import { API_BASE as API_URL, SOCKET_URL } from '../config';

function AdminDashboard() {
  const [questions, setQuestions] = useState([]);
  const [liveResults, setLiveResults] = useState({});
  const [subQuestions, setSubQuestions] = useState({});
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [questionTimers, setQuestionTimers] = useState({});
  const [timerIntervals, setTimerIntervals] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if admin is logged in
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    // Check if session exists and create if needed
    const existingSession = localStorage.getItem('adminSessionCode');
    if (!existingSession) {
      // Create new session automatically
      const createNewSession = async () => {
        try {
          const res = await fetch(`${API_URL}/admin/session/create`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          if (res.status === 401 || res.status === 403) {
            localStorage.clear();
            navigate('/admin/login');
            return;
          }

          if (!res.ok) {
            console.error('Failed to create session:', res.status);
            return;
          }

          const data = await res.json();
          console.log('Session created:', data);
          
          if (data.sessionCode) {
            localStorage.setItem('adminSessionCode', data.sessionCode);
            setSessionCode(data.sessionCode);
            setShowSessionModal(true);
          } else {
            console.error('No session code in response:', data);
          }
        } catch (error) {
          console.error('Error creating session:', error);
        }
      };
      createNewSession();
    } else {
      setSessionCode(existingSession);
    }

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    setSocket(newSocket);

    fetchQuestions();

    newSocket.on('voteUpdate', (data) => {
      setLiveResults((prev) => ({
        ...prev,
        [data.questionId]: data.results,
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);

  const fetchQuestions = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/admin/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        navigate('/admin/login');
        return;
      }

      if (!res.ok) {
        console.error('Failed to fetch questions');
        setQuestions([]);
        return;
      }

      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);

      for (const q of (Array.isArray(data) ? data : [])) {
        if (q.is_active) {
          const resResults = await fetch(`${API_URL}/questions/${q.id}/results`);
          const results = await resResults.json();
          if (results.mainResults) {
            setLiveResults((prev) => ({ ...prev, [q.id]: results.mainResults }));
          }
        }
        
        // Fetch sub-questions
        const subRes = await fetch(`${API_URL}/admin/questions/${q.id}/sub-questions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const subData = await subRes.json();
        if (subData.length > 0) {
          setSubQuestions((prev) => ({ ...prev, [q.id]: subData }));
        }
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
    }
  };

  const toggleQuestion = async (id) => {
    const token = localStorage.getItem('adminToken');
    const question = questions.find(q => q.id === id);
    
    // If activating the question, start 60 second timer
    if (!question.is_active) {
      setQuestionTimers(prev => ({ ...prev, [id]: 60 }));
      
      const timerInterval = setInterval(() => {
        setQuestionTimers(prev => {
          const newTime = (prev[id] || 0) - 1;
          if (newTime <= 0) {
            clearInterval(timerInterval);
            setTimerIntervals(prev => {
              const newIntervals = { ...prev };
              delete newIntervals[id];
              return newIntervals;
            });
            // Auto-stop the question
            fetch(`${API_URL}/admin/questions/${id}/toggle`, { 
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(() => {
              fetchQuestions();
              // Force re-render by updating expanded question state
              if (expandedQuestion === `history-${id}`) {
                setExpandedQuestion(null);
                setTimeout(() => setExpandedQuestion(`history-${id}`), 100);
              }
              setToast({
                message: 'Question automatically stopped after 60 seconds!',
                type: 'info'
              });
            });
            return { ...prev, [id]: 0 };
          }
          return { ...prev, [id]: newTime };
        });
      }, 1000);
      
      // Store interval reference
      setTimerIntervals(prev => ({ ...prev, [id]: timerInterval }));
    } else {
      // If stopping manually, clear timer
      if (timerIntervals[id]) {
        clearInterval(timerIntervals[id]);
        setTimerIntervals(prev => {
          const newIntervals = { ...prev };
          delete newIntervals[id];
          return newIntervals;
        });
      }
      setQuestionTimers(prev => ({ ...prev, [id]: 0 }));
    }
    
    await fetch(`${API_URL}/admin/questions/${id}/toggle`, { 
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchQuestions();
  };

  const toggleSubQuestion = async (subId) => {
    await fetch(`${API_URL}/admin/sub-questions/${subId}/toggle`, { method: 'PATCH' });
    fetchQuestions();
  };

  const deleteQuestion = async (id) => {
    const token = localStorage.getItem('adminToken');
    await fetch(`${API_URL}/admin/questions/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setToast({
      message: 'Question deleted successfully!',
      type: 'success'
    });
    fetchQuestions();
  };

  const createSession = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const res = await fetch(`${API_URL}/admin/session/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        navigate('/admin/login');
        return;
      }

      const data = await res.json();
      localStorage.setItem('adminSessionCode', data.sessionCode);
      setSessionCode(data.sessionCode);
      setShowSessionModal(true);
    } catch (error) {
      console.error('Error creating session');
    }
  };

  const shareLink = async () => {
    const code = sessionCode || localStorage.getItem('adminSessionCode');
    const link = `${window.location.origin}/session/${code}`;
    
    try {
      // Try modern clipboard API
      await navigator.clipboard.writeText(link);
      setToast({
        message: `Student link copied! Session Code: ${code}`,
        type: 'success'
      });
    } catch (err) {
      // Fallback for older browsers or permission issues
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setToast({
          message: `Student link copied! Session Code: ${code}`,
          type: 'success'
        });
      } catch (err2) {
        setToast({
          message: `Link: ${link}`,
          type: 'info'
        });
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div style={{ 
      maxWidth: '1000px', 
      margin: '0 auto', 
      padding: 'clamp(15px, 3vw, 20px)',
      width: '100%'
    }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Session Code Modal */}
      {showSessionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => setShowSessionModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: 'clamp(20px, 5vw, 40px)',
            borderRadius: '20px',
            maxWidth: '90vw',
            width: '500px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            margin: '0 15px'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'clamp(40px, 10vw, 60px)', marginBottom: 'clamp(15px, 3vw, 20px)' }}>🎉</div>
            <h2 style={{ 
              color: '#2c3e50', 
              marginBottom: 'clamp(15px, 3vw, 20px)',
              fontSize: 'clamp(20px, 4vw, 24px)'
            }}>
              Session Created!
            </h2>
            <p style={{ 
              color: '#7f8c8d', 
              marginBottom: 'clamp(20px, 4vw, 30px)',
              fontSize: 'clamp(14px, 3vw, 16px)'
            }}>
              Share this code with students:
            </p>
            <div style={{
              fontSize: 'clamp(32px, 8vw, 48px)',
              fontWeight: '700',
              color: '#3498db',
              letterSpacing: 'clamp(4px, 2vw, 8px)',
              marginBottom: 'clamp(20px, 4vw, 30px)',
              padding: 'clamp(15px, 3vw, 20px)',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px'
            }}>
              {sessionCode}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px'
            }}>
              <button
                onClick={() => {
                  shareLink();
                  setShowSessionModal(false);
                }}
                style={{
                  padding: 'clamp(12px, 3vw, 15px) clamp(20px, 4vw, 30px)',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 16px)',
                  fontWeight: '700',
                  transition: 'all 0.3s'
                }}
              >
                📋 Copy Link
              </button>
              <button
                onClick={() => setShowSessionModal(false)}
                style={{
                  padding: 'clamp(12px, 3vw, 15px) clamp(20px, 4vw, 30px)',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 16px)',
                  fontWeight: '700',
                  transition: 'all 0.3s'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        marginBottom: '20px',
        padding: isMobile ? '8px' : '16px',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '12px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* Title - Hide on mobile */}
          {!isMobile && (
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '20px',
                fontWeight: '700'
              }}>
                📊 Admin Dashboard
              </h1>
            </div>
          )}
          
          {/* Session Code */}
          <div style={{ 
            fontSize: isMobile ? '12px' : '13px', 
            opacity: 0.95,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '5px' : '8px',
            flex: isMobile ? 1 : 'auto'
          }}>
            {!isMobile && <span>Code:</span>}
            <span style={{ 
              fontWeight: '700', 
              fontSize: isMobile ? '14px' : '16px', 
              letterSpacing: '2px',
              backgroundColor: 'rgba(255,255,255,0.25)',
              padding: isMobile ? '5px 10px' : '4px 12px',
              borderRadius: '6px'
            }}>
              {sessionCode || '------'}
            </span>
          </div>
          
          {/* Desktop Buttons */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => navigate('/admin/create')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              >
                <span>➕</span>
                <span>Create</span>
              </button>
              <button
                onClick={shareLink}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>📋</span>
                <span>Share</span>
              </button>
            </div>
          )}
          
          {/* Mobile Hamburger */}
          {isMobile && (
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
            right: '8px',
            marginTop: '8px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            padding: '8px',
            zIndex: 1000,
            minWidth: '160px'
          }}>
            <button
              onClick={() => {
                navigate('/admin/create');
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
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>➕</span>
              <span>Create Question</span>
            </button>
            <button
              onClick={() => {
                shareLink();
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
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>📋</span>
              <span>Share Link</span>
            </button>
            <button
              onClick={() => setShowLogoutModal(true)}
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
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowLogoutModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>⚠️</div>
            <h2 style={{ color: '#2c3e50', marginBottom: '10px', fontSize: '22px' }}>
              Confirm Logout
            </h2>
            <p style={{ color: '#7f8c8d', marginBottom: '25px', fontSize: '14px' }}>
              Are you sure you want to logout?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  navigate('/admin/login');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {questions.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: 'clamp(30px, 8vw, 60px)',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            color: '#7f8c8d', 
            marginBottom: 'clamp(15px, 3vw, 20px)',
            fontSize: 'clamp(18px, 4vw, 24px)'
          }}>
            No Questions Yet
          </h2>
          <p style={{ 
            color: '#95a5a6', 
            fontSize: 'clamp(14px, 3vw, 16px)', 
            marginBottom: 'clamp(20px, 4vw, 30px)' 
          }}>
            Create your first question!
          </p>
          <button
            onClick={() => navigate('/admin/create')}
            style={{
              padding: 'clamp(12px, 3vw, 15px) clamp(20px, 5vw, 30px)',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(15px, 3vw, 18px)',
              fontWeight: 'bold',
            }}
          >
            ➕ Create First Question
          </button>
        </div>
      ) : (
        <div>
          <h2 style={{ 
            color: '#2c3e50', 
            marginBottom: 'clamp(15px, 3vw, 20px)',
            fontSize: 'clamp(18px, 4vw, 24px)'
          }}>
            All Questions
          </h2>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                padding: '25px',
                marginBottom: '20px',
                border: q.is_active ? '3px solid #27ae60' : '2px solid #ecf0f1',
                borderRadius: '10px',
                backgroundColor: 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '20px' }}>
                    {q.heading}
                    {q.is_active && (
                      <>
                        <span style={{
                          marginLeft: '15px',
                          padding: '6px 14px',
                          backgroundColor: '#27ae60',
                          color: 'white',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: 'normal',
                        }}>
                          🔴 LIVE
                        </span>
                        {questionTimers[q.id] > 0 && (
                          <span style={{
                            marginLeft: '10px',
                            padding: '6px 14px',
                            backgroundColor: questionTimers[q.id] <= 10 ? '#e74c3c' : '#3498db',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                          }}>
                            ⏱ {questionTimers[q.id]}s
                          </span>
                        )}
                      </>
                    )}
                  </h3>
                  {q.description && <p style={{ color: '#7f8c8d', margin: 0 }}>{q.description}</p>}
                </div>
                
                {/* Action Buttons - Responsive Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginTop: '15px'
                }}>
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: q.is_active ? '#e74c3c' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <span style={{ fontSize: '18px' }}>{q.is_active ? '⏸' : '▶'}</span>
                    {q.is_active ? 'Stop' : 'Activate'}
                  </button>
                  
                  <button
                    onClick={() => navigate(`/admin/edit/${q.id}`)}
                    disabled={q.is_active}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: q.is_active ? '#bdc3c7' : '#f39c12',
                      color: 'white',
                      border: 'none',
                      cursor: q.is_active ? 'not-allowed' : 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: q.is_active ? 'none' : '0 4px 12px rgba(243, 156, 18, 0.3)',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: q.is_active ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => !q.is_active && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <span style={{ fontSize: '18px' }}>✏️</span>
                    Edit
                  </button>
                  
                  <button
                    onClick={() => setExpandedQuestion(expandedQuestion === `history-${q.id}` ? null : `history-${q.id}`)}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: expandedQuestion === `history-${q.id}` ? '#16a085' : '#1abc9c',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: '0 4px 12px rgba(26, 188, 156, 0.3)',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <span style={{ fontSize: '18px' }}>📊</span>
                    History
                  </button>
                  
                  <button
                    onClick={() => {
                      if (q.is_active) return;
                      setToast({
                        message: 'Are you sure? Click again to confirm deletion.',
                        type: 'warning'
                      });
                      setTimeout(() => {
                        const btn = document.getElementById(`delete-${q.id}`);
                        if (btn) {
                          btn.onclick = () => deleteQuestion(q.id);
                          btn.style.backgroundColor = '#c0392b';
                          btn.innerHTML = '<span style="font-size: 18px">⚠️</span> Confirm';
                        }
                      }, 100);
                    }}
                    id={`delete-${q.id}`}
                    disabled={q.is_active}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: q.is_active ? '#bdc3c7' : '#e74c3c',
                      color: 'white',
                      border: 'none',
                      cursor: q.is_active ? 'not-allowed' : 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: q.is_active ? 'none' : '0 4px 12px rgba(231, 76, 60, 0.3)',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: q.is_active ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => !q.is_active && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <span style={{ fontSize: '18px' }}>🗑️</span>
                    Delete
                  </button>
                </div>
              </div>

              {q.is_active && liveResults[q.id] && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📊 Live Results</h4>
                  {liveResults[q.id].map((opt, idx) => (
                    <div key={opt.id} style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontWeight: '600' }}>
                          {String.fromCharCode(65 + idx)}. {opt.option_text}
                        </span>
                        <span style={{ fontWeight: 'bold', color: '#3498db' }}>
                          {opt.percentage}% ({opt.votes})
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '25px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${opt.percentage}%`,
                          height: '100%',
                          backgroundColor: '#3498db',
                          transition: 'width 0.5s ease',
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vote History Section */}
              {expandedQuestion === `history-${q.id}` && (
                <VoteHistory questionId={q.id} />
              )}

              {subQuestions[q.id] && subQuestions[q.id].length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={() => setExpandedQuestion(expandedQuestion === `sub-${q.id}` ? null : `sub-${q.id}`)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#9b59b6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginBottom: '15px'
                    }}
                  >
                    {expandedQuestion === `sub-${q.id}` ? '▼' : '▶'} Sub-Questions ({subQuestions[q.id].length})
                  </button>

                  {expandedQuestion === `sub-${q.id}` && (
                    <div style={{ paddingLeft: '20px' }}>
                      {subQuestions[q.id].map((subQ, idx) => (
                        <div
                          key={subQ.id}
                          style={{
                            padding: '15px',
                            marginBottom: '10px',
                            border: subQ.is_active ? '2px solid #9b59b6' : '1px solid #ecf0f1',
                            borderRadius: '6px',
                            backgroundColor: subQ.is_active ? '#f4ecf7' : '#fafafa',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                              {idx + 1}. {subQ.sub_question_text}
                              {subQ.is_active && (
                                <span style={{
                                  marginLeft: '10px',
                                  padding: '4px 10px',
                                  backgroundColor: '#9b59b6',
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                }}>
                                  🔴 LIVE
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => toggleSubQuestion(subQ.id)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: subQ.is_active ? '#e74c3c' : '#9b59b6',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 'bold',
                              }}
                            >
                              {subQ.is_active ? '⏸ Stop' : '▶ Raise'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowLogoutModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>⚠️</div>
            <h2 style={{ color: '#2c3e50', marginBottom: '10px', fontSize: '22px' }}>
              Confirm Logout
            </h2>
            <p style={{ color: '#7f8c8d', marginBottom: '25px', fontSize: '14px' }}>
              Are you sure you want to logout?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  navigate('/admin/login');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
