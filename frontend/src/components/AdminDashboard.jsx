import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toast from './Toast';
import VoteHistory from './VoteHistory';
import { API_BASE as API_URL, SOCKET_URL } from '../config';

function AdminDashboard() {
  const [questions, setQuestions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [liveResults, setLiveResults] = useState({});
  const [subQuestions, setSubQuestions] = useState({});
  const [subResults, setSubResults] = useState({});
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMenu, setShowMenu] = useState(false);
  const [questionTimers, setQuestionTimers] = useState({});
  const timerIntervalsRef = useRef({});
  const [subQuestionTimers, setSubQuestionTimers] = useState({});
  const subTimerIntervalsRef = useRef({});
  const [expandedProjects, setExpandedProjects] = useState({});
  const [editingProject, setEditingProject] = useState(null);
  const [editProjectData, setEditProjectData] = useState({ title: '', description: '', date: '' });
  const [togglingQuestions, setTogglingQuestions] = useState({});
  const [deleteProjectModal, setDeleteProjectModal] = useState(null);
  const [clearHistoryModal, setClearHistoryModal] = useState(null);
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
            return;
          }

          const data = await res.json();
          
          if (data.sessionCode) {
            localStorage.setItem('adminSessionCode', data.sessionCode);
            setSessionCode(data.sessionCode);
            setShowSessionModal(true);
          }
        } catch (error) {
          // Session creation failed
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
      if (data.type === 'sub') {
        // Sub-question vote update
        const subQuestionId = data.questionId;
        setSubResults((prev) => {
          const updated = { ...prev };
          // Find which main question this sub-question belongs to
          Object.keys(updated).forEach(qId => {
            if (updated[qId]) {
              updated[qId] = updated[qId].map(subQ => 
                subQ.id === subQuestionId 
                  ? { ...subQ, results: data.results }
                  : subQ
              );
            }
          });
          return updated;
        });
      } else {
        // Main question vote update
        setLiveResults((prev) => ({
          ...prev,
          [data.questionId]: data.results,
        }));
      }
    });

    return () => {
      newSocket.disconnect();
      // Clear all timers on unmount
      Object.values(timerIntervalsRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      Object.values(subTimerIntervalsRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [navigate]);

  const fetchQuestions = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      // Fetch projects first
      const projectsRes = await fetch(`${API_URL}/admin/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      }
      
      const res = await fetch(`${API_URL}/admin/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        navigate('/admin/login');
        return;
      }

      if (!res.ok) {
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
          if (results.subResults) {
            setSubResults((prev) => ({ ...prev, [q.id]: results.subResults }));
          }
          
          // Calculate remaining time if activated_at exists
          if (q.activated_at) {
            const activatedTime = new Date(q.activated_at).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - activatedTime) / 1000);
            const remaining = Math.max(0, 60 - elapsed);
            
            if (remaining > 0 && !timerIntervalsRef.current[q.id]) {
              // Only start timer if one doesn't exist already
              setQuestionTimers(prev => ({ ...prev, [q.id]: remaining }));
              
              const timerInterval = setInterval(() => {
                setQuestionTimers(prev => {
                  const newTime = (prev[q.id] || 0) - 1;
                  if (newTime <= 0) {
                    clearInterval(timerInterval);
                    delete timerIntervalsRef.current[q.id];
                    // Auto-stop
                    fetch(`${API_URL}/admin/questions/${q.id}/toggle`, { 
                      method: 'PATCH',
                      headers: { 'Authorization': `Bearer ${token}` }
                    }).then(() => fetchQuestions());
                    return { ...prev, [q.id]: 0 };
                  }
                  return { ...prev, [q.id]: newTime };
                });
              }, 1000);
              
              timerIntervalsRef.current[q.id] = timerInterval;
            }
          }
        }
        
        // Fetch sub-questions
        const subRes = await fetch(`${API_URL}/admin/questions/${q.id}/sub-questions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const subData = await subRes.json();
        if (subData.length > 0) {
          setSubQuestions((prev) => ({ ...prev, [q.id]: subData }));
          
          // Start timers for active sub-questions
          for (const subQ of subData) {
            if (subQ.is_active && subQ.activated_at) {
              const activatedTime = new Date(subQ.activated_at).getTime();
              const now = Date.now();
              const elapsed = Math.floor((now - activatedTime) / 1000);
              const remaining = Math.max(0, 60 - elapsed);
              
              if (remaining > 0 && !subTimerIntervalsRef.current[subQ.id]) {
                setSubQuestionTimers(prev => ({ ...prev, [subQ.id]: remaining }));
                
                const timerInterval = setInterval(() => {
                  setSubQuestionTimers(prev => {
                    const newTime = (prev[subQ.id] || 0) - 1;
                    if (newTime <= 0) {
                      clearInterval(timerInterval);
                      delete subTimerIntervalsRef.current[subQ.id];
                      // Auto-stop
                      fetch(`${API_URL}/admin/sub-questions/${subQ.id}/toggle`, { 
                        method: 'PATCH'
                      }).then(() => fetchQuestions());
                      return { ...prev, [subQ.id]: 0 };
                    }
                    return { ...prev, [subQ.id]: newTime };
                  });
                }, 1000);
                
                subTimerIntervalsRef.current[subQ.id] = timerInterval;
              }
            }
          }
        }
      }
    } catch (error) {
      setQuestions([]);
    }
  };

  const toggleQuestion = async (id) => {
    // Prevent double-click
    if (togglingQuestions[id]) return;
    setTogglingQuestions(prev => ({ ...prev, [id]: true }));
    
    const token = localStorage.getItem('adminToken');
    const question = questions.find(q => q.id === id);
    
    // Clear any existing timer for this question using ref (synchronous)
    if (timerIntervalsRef.current[id]) {
      clearInterval(timerIntervalsRef.current[id]);
      delete timerIntervalsRef.current[id];
      setQuestionTimers(prev => ({ ...prev, [id]: 0 }));
    }
    
    // THEN: Make API call
    await fetch(`${API_URL}/admin/questions/${id}/toggle`, { 
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // FINALLY: If activating, start new timer
    if (!question.is_active) {
      setQuestionTimers(prev => ({ ...prev, [id]: 60 }));
      
      const timerInterval = setInterval(() => {
        setQuestionTimers(prev => {
          const newTime = (prev[id] || 0) - 1;
          if (newTime <= 0) {
            clearInterval(timerInterval);
            delete timerIntervalsRef.current[id];
            // Auto-stop the question
            fetch(`${API_URL}/admin/questions/${id}/toggle`, { 
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(() => {
              fetchQuestions();
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
      
      timerIntervalsRef.current[id] = timerInterval;
    }
    
    await fetchQuestions();
    setTogglingQuestions(prev => ({ ...prev, [id]: false }));
  };

  const toggleSubQuestion = async (subId, questionId) => {
    const subQuestion = subQuestions[questionId]?.find(sq => sq.id === subId);
    
    // Clear any existing timer for this sub-question
    if (subTimerIntervalsRef.current[subId]) {
      clearInterval(subTimerIntervalsRef.current[subId]);
      delete subTimerIntervalsRef.current[subId];
      setSubQuestionTimers(prev => ({ ...prev, [subId]: 0 }));
    }
    
    // Toggle the sub-question
    await fetch(`${API_URL}/admin/sub-questions/${subId}/toggle`, { method: 'PATCH' });
    
    // If activating, start timer
    if (!subQuestion.is_active) {
      setSubQuestionTimers(prev => ({ ...prev, [subId]: 60 }));
      
      const timerInterval = setInterval(() => {
        setSubQuestionTimers(prev => {
          const newTime = (prev[subId] || 0) - 1;
          if (newTime <= 0) {
            clearInterval(timerInterval);
            delete subTimerIntervalsRef.current[subId];
            // Auto-stop the sub-question
            fetch(`${API_URL}/admin/sub-questions/${subId}/toggle`, { 
              method: 'PATCH'
            }).then(() => {
              fetchQuestions();
              setToast({
                message: 'Sub-question automatically stopped after 60 seconds!',
                type: 'info'
              });
            });
            return { ...prev, [subId]: 0 };
          }
          return { ...prev, [subId]: newTime };
        });
      }, 1000);
      
      subTimerIntervalsRef.current[subId] = timerInterval;
    }
    
    // Fetch fresh results after toggle
    const resResults = await fetch(`${API_URL}/questions/${questionId}/results`);
    const results = await resResults.json();
    if (results.subResults) {
      setSubResults((prev) => ({ ...prev, [questionId]: results.subResults }));
    }
    
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

  const clearHistory = async (id) => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/questions/${id}/history`, { 
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const mainDeleted = data.deletedCount || 0;
        const subDeleted = data.subVotesDeleted || 0;
        const totalDeleted = mainDeleted + subDeleted;
        
        setToast({
          message: `Vote history cleared! (${totalDeleted} vote${totalDeleted !== 1 ? 's' : ''} removed)`,
          type: 'success'
        });
        
        // Refresh to show updated results
        fetchQuestions();
        // Force refresh vote history if expanded
        if (expandedQuestion === `history-${id}`) {
          setExpandedQuestion(null);
          setTimeout(() => setExpandedQuestion(`history-${id}`), 100);
        }
      } else {
        setToast({
          message: data.error || 'Failed to clear history',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({
        message: 'Failed to clear history: ' + error.message,
        type: 'error'
      });
    }
  };

  const deleteProject = async (projectId) => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/projects/${projectId}`, { 
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        setToast({
          message: 'Project and all its questions deleted successfully!',
          type: 'success'
        });
        fetchQuestions();
      } else {
        const data = await res.json();
        setToast({
          message: data.error || 'Failed to delete project',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({
        message: 'Failed to delete project: ' + error.message,
        type: 'error'
      });
    }
  };

  const updateProject = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/projects/${editingProject}`, { 
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editProjectData)
      });
      
      if (res.ok) {
        setToast({
          message: 'Project updated successfully!',
          type: 'success'
        });
        setEditingProject(null);
        fetchQuestions();
      } else {
        const data = await res.json();
        setToast({
          message: data.error || 'Failed to update project',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({
        message: 'Failed to update project: ' + error.message,
        type: 'error'
      });
    }
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
      // Session creation failed
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
                onClick={() => navigate('/admin/bulk-upload')}
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
                <span>📤</span>
                <span>Bulk Upload</span>
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
                navigate('/admin/bulk-upload');
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
              <span style={{ fontSize: '18px' }}>📤</span>
              <span>Bulk Upload</span>
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
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
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
        }} onClick={() => setEditingProject(null)}>
          <div style={{
            backgroundColor: 'white',
            padding: 'clamp(20px, 5vw, 30px)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50', fontSize: 'clamp(18px, 4vw, 22px)' }}>Edit Project</h2>
            
            <input
              type="text"
              placeholder="Project Title"
              value={editProjectData.title}
              onChange={(e) => setEditProjectData({...editProjectData, title: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
            
            <textarea
              placeholder="Description (optional)"
              value={editProjectData.description}
              onChange={(e) => setEditProjectData({...editProjectData, description: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '15px',
                minHeight: '80px',
                boxSizing: 'border-box'
              }}
            />
            
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '14px' }}>
                📅 Project Date
              </label>
              <input
                type="date"
                value={editProjectData.date}
                onChange={(e) => setEditProjectData({...editProjectData, date: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.showPicker && e.target.showPicker();
                }}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '42px',
                fontSize: '18px',
                pointerEvents: 'none'
              }}>
                📅
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={updateProject}
                disabled={!editProjectData.title}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: editProjectData.title ? '#27ae60' : '#bdc3c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: editProjectData.title ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Update
              </button>
              <button
                onClick={() => setEditingProject(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {questions.length === 0 && projects.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: 'clamp(30px, 8vw, 60px)',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>📁</div>
          <h2 style={{ 
            color: '#7f8c8d', 
            marginBottom: 'clamp(15px, 3vw, 20px)',
            fontSize: 'clamp(18px, 4vw, 24px)'
          }}>
            No Projects Yet
          </h2>
          <p style={{ 
            color: '#95a5a6', 
            fontSize: 'clamp(14px, 3vw, 16px)', 
            marginBottom: 'clamp(20px, 4vw, 30px)' 
          }}>
            Create a project first, then add questions to it!
          </p>
          <button
            onClick={() => navigate('/admin/create')}
            style={{
              padding: 'clamp(12px, 3vw, 15px) clamp(20px, 5vw, 30px)',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(15px, 3vw, 18px)',
              fontWeight: 'bold',
            }}
          >
            ➕ Create Project & Question
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
          {(() => {
            // Start with all projects
            const grouped = {};
            
            projects.forEach(p => {
              grouped[p.id] = {
                title: p.title,
                date: p.date,
                description: p.description,
                questions: []
              };
            });
            
            // Add questions to their projects
            questions.forEach(q => {
              if (q.project_id && grouped[q.project_id]) {
                grouped[q.project_id].questions.push(q);
              }
            });
            
            return Object.entries(grouped)
              .map(([projectId, projectData]) => (
              <div key={projectId} style={{ marginBottom: '20px' }}>
                <div 
                  onClick={() => setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }))}
                  style={{
                    padding: '20px 25px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    marginBottom: expandedProjects[projectId] ? '15px' : '0',
                    cursor: 'pointer',
                    boxShadow: expandedProjects[projectId] ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s',
                    border: expandedProjects[projectId] ? '2px solid #667eea' : '2px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', flex: 1 }}>
                      <span style={{ fontSize: '32px', lineHeight: 1 }}>📁</span>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#2c3e50', lineHeight: 1.3 }}>
                          {projectData.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {projectData.date && (
                            <span style={{ fontSize: '13px', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              📅 {new Date(projectData.date).toLocaleDateString()}
                            </span>
                          )}
                          <span style={{ 
                            padding: '4px 10px',
                            backgroundColor: '#e8eaf6',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#667eea'
                          }}>
                            {projectData.questions.length} Question{projectData.questions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {projectId !== 'no-project' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(projectId);
                            setEditProjectData({
                              title: projectData.title,
                              description: projectData.description || '',
                              date: projectData.date ? new Date(projectData.date).toISOString().split('T')[0] : ''
                            });
                          }}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 'transparent',
                            color: '#f39c12',
                            border: '1px solid #f39c12',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f39c12';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#f39c12';
                          }}
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteProjectModal({ id: projectId, title: projectData.title });
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'transparent',
                          color: '#e74c3c',
                          border: '1px solid #e74c3c',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          transition: 'all 0.3s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e74c3c';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#e74c3c';
                        }}
                      >
                        🗑️
                      </button>
                      <span style={{ fontSize: '18px', color: '#667eea', transition: 'transform 0.3s', transform: expandedProjects[projectId] ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: '4px' }}>
                        ▼
                      </span>
                    </div>
                  </div>
                </div>
                
                {expandedProjects[projectId] && projectData.questions.map((q) => (
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
                    <span style={{ color: '#667eea', fontWeight: '800', marginRight: '8px' }}>
                      Q{q.question_number}.
                    </span>
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
                    disabled={togglingQuestions[q.id]}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: togglingQuestions[q.id] ? '#95a5a6' : (q.is_active ? '#e74c3c' : '#27ae60'),
                      color: 'white',
                      border: 'none',
                      cursor: togglingQuestions[q.id] ? 'not-allowed' : 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: togglingQuestions[q.id] ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => !togglingQuestions[q.id] && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <span style={{ fontSize: '18px' }}>{togglingQuestions[q.id] ? '⏳' : (q.is_active ? '⏸' : '▶')}</span>
                    {togglingQuestions[q.id] ? 'Wait...' : (q.is_active ? 'Stop' : 'Activate')}
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
                  
                  <button
                    onClick={async () => {
                      if (q.is_active) return;
                      
                      // Check if there's any history first
                      const token = localStorage.getItem('adminToken');
                      try {
                        const checkRes = await fetch(`${API_URL}/admin/questions/${q.id}/history`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const historyData = await checkRes.json();
                        
                        // Check if history is empty
                        if (historyData.mainVotes?.length === 0 && historyData.subVotes?.length === 0) {
                          setToast({
                            message: 'Nothing to clear - no vote history found!',
                            type: 'info'
                          });
                          return;
                        }
                        
                        // If history exists, show modal
                        setClearHistoryModal({ id: q.id, heading: q.heading });
                      } catch (error) {
                        // If check fails, show modal anyway
                        setClearHistoryModal({ id: q.id, heading: q.heading });
                      }
                    }}
                    disabled={q.is_active}
                    style={{
                      padding: '14px 20px',
                      backgroundColor: q.is_active ? '#bdc3c7' : '#9b59b6',
                      color: 'white',
                      border: 'none',
                      cursor: q.is_active ? 'not-allowed' : 'pointer',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '15px',
                      boxShadow: q.is_active ? 'none' : '0 4px 12px rgba(155, 89, 182, 0.3)',
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
                    <span style={{ fontSize: '18px' }}>🔄</span>
                    Clear History
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
                          {/* Sub-question text and badges */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              color: '#2c3e50',
                              fontSize: 'clamp(14px, 3.5vw, 16px)',
                              marginBottom: '8px',
                              wordBreak: 'break-word'
                            }}>
                              {idx + 1}. {subQ.sub_question_text}
                            </div>
                            {subQ.is_active && (
                              <div style={{ 
                                display: 'flex', 
                                gap: '8px', 
                                flexWrap: 'wrap',
                                alignItems: 'center'
                              }}>
                                <span style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#9b59b6',
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  🔴 LIVE
                                </span>
                                {subQuestionTimers[subQ.id] > 0 && (
                                  <span style={{
                                    padding: '4px 10px',
                                    backgroundColor: subQuestionTimers[subQ.id] <= 10 ? '#e74c3c' : '#3498db',
                                    color: 'white',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    ⏱ {subQuestionTimers[subQ.id]}s
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Action button */}
                          <button
                            onClick={() => toggleSubQuestion(subQ.id, q.id)}
                            style={{
                              width: '100%',
                              padding: 'clamp(10px, 2.5vw, 12px) clamp(14px, 3vw, 16px)',
                              backgroundColor: subQ.is_active ? '#e74c3c' : '#9b59b6',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: '8px',
                              fontSize: 'clamp(13px, 3vw, 14px)',
                              fontWeight: 'bold',
                              marginBottom: subQ.is_active ? '15px' : '0',
                              transition: 'all 0.3s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <span style={{ fontSize: '16px' }}>{subQ.is_active ? '⏸' : '▶'}</span>
                            {subQ.is_active ? 'Stop' : 'Raise'}
                          </button>
                          
                          {subQ.is_active && subResults[q.id] && (() => {
                            const subResult = subResults[q.id].find(sr => sr.id === subQ.id);
                            if (!subResult || !subResult.results) return null;
                            
                            return (
                              <div style={{
                                marginTop: '10px',
                                padding: '15px',
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                border: '1px solid #e0e0e0'
                              }}>
                                <h5 style={{ margin: '0 0 10px 0', color: '#9b59b6', fontSize: '13px' }}>📊 Live Results</h5>
                                {subResult.results.map((opt, optIdx) => (
                                  <div key={opt.id} style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                                      <span style={{ fontWeight: '600' }}>
                                        {String.fromCharCode(65 + optIdx)}. {opt.option_text}
                                      </span>
                                      <span style={{ fontWeight: 'bold', color: '#9b59b6' }}>
                                        {opt.percentage}% ({opt.votes})
                                      </span>
                                    </div>
                                    <div style={{
                                      width: '100%',
                                      height: '20px',
                                      backgroundColor: '#f0f0f0',
                                      borderRadius: '10px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${opt.percentage}%`,
                                        height: '100%',
                                        backgroundColor: '#9b59b6',
                                        transition: 'width 0.5s ease',
                                      }}></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteProjectModal && (
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
        }} onClick={() => setDeleteProjectModal(null)}>
          <div style={{
            backgroundColor: 'white',
            padding: 'clamp(25px, 5vw, 30px)',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'clamp(45px, 10vw, 55px)', marginBottom: '15px' }}>🗑️</div>
            <h2 style={{ 
              color: '#2c3e50', 
              marginBottom: '10px', 
              fontSize: 'clamp(18px, 4vw, 22px)',
              fontWeight: '700'
            }}>
              Delete Project?
            </h2>
            <p style={{ 
              color: '#7f8c8d', 
              marginBottom: '15px', 
              fontSize: 'clamp(13px, 3vw, 14px)',
              lineHeight: '1.5'
            }}>
              Are you sure you want to delete
            </p>
            <p style={{
              color: '#e74c3c',
              fontWeight: '700',
              fontSize: 'clamp(15px, 3.5vw, 17px)',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#fee',
              borderRadius: '8px',
              wordBreak: 'break-word'
            }}>
              "{deleteProjectModal.title}"
            </p>
            <p style={{ 
              color: '#e74c3c', 
              marginBottom: '25px', 
              fontSize: 'clamp(12px, 2.8vw, 13px)',
              fontWeight: '600'
            }}>
              ⚠️ This will delete all questions in this project!
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteProjectModal(null)}
                style={{
                  flex: 1,
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 15px)',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7f8c8d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#95a5a6'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteProject(deleteProjectModal.id);
                  setDeleteProjectModal(null);
                }}
                style={{
                  flex: 1,
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 15px)',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {clearHistoryModal && (
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
        }} onClick={() => setClearHistoryModal(null)}>
          <div style={{
            backgroundColor: 'white',
            padding: 'clamp(25px, 5vw, 30px)',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'clamp(45px, 10vw, 55px)', marginBottom: '15px' }}>🔄</div>
            <h2 style={{ 
              color: '#2c3e50', 
              marginBottom: '10px', 
              fontSize: 'clamp(18px, 4vw, 22px)',
              fontWeight: '700'
            }}>
              Clear Vote History?
            </h2>
            <p style={{ 
              color: '#7f8c8d', 
              marginBottom: '15px', 
              fontSize: 'clamp(13px, 3vw, 14px)',
              lineHeight: '1.5'
            }}>
              Are you sure you want to clear all vote history for
            </p>
            <p style={{
              color: '#9b59b6',
              fontWeight: '700',
              fontSize: 'clamp(15px, 3.5vw, 17px)',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f4ecf7',
              borderRadius: '8px',
              wordBreak: 'break-word'
            }}>
              "{clearHistoryModal.heading}"
            </p>
            <p style={{ 
              color: '#e74c3c', 
              marginBottom: '25px', 
              fontSize: 'clamp(12px, 2.8vw, 13px)',
              fontWeight: '600'
            }}>
              ⚠️ This action cannot be undone!
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setClearHistoryModal(null)}
                style={{
                  flex: 1,
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 15px)',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7f8c8d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#95a5a6'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearHistory(clearHistoryModal.id);
                  setClearHistoryModal(null);
                }}
                style={{
                  flex: 1,
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  backgroundColor: '#9b59b6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3vw, 15px)',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8e44ad'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9b59b6'}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
