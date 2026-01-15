import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Toast from './Toast';
import VoteHistory from './VoteHistory';
import { API_BASE as API_URL, SOCKET_URL } from '../config';

function ProjectDetail() {
  const { projectId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [projectInfo, setProjectInfo] = useState(null);
  const [liveResults, setLiveResults] = useState({});
  const [subQuestions, setSubQuestions] = useState({});
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);
  const [questionTimers, setQuestionTimers] = useState({});
  const [timerIntervals, setTimerIntervals] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

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
      Object.values(timerIntervals).forEach(interval => clearInterval(interval));
    };
  }, [navigate, projectId]);

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
        return;
      }

      const data = await res.json();
      const filteredQuestions = data.filter(q => 
        (projectId === 'no-project' && !q.project_id) || 
        (q.project_id && q.project_id.toString() === projectId)
      );
      
      setQuestions(filteredQuestions);
      
      if (filteredQuestions.length > 0) {
        setProjectInfo({
          title: filteredQuestions[0].project_title || 'No Project',
          date: filteredQuestions[0].project_date
        });
      }

      for (const q of filteredQuestions) {
        if (q.is_active) {
          const resResults = await fetch(`${API_URL}/questions/${q.id}/results`);
          const results = await resResults.json();
          if (results.mainResults) {
            setLiveResults((prev) => ({ ...prev, [q.id]: results.mainResults }));
          }
        }
        
        const subRes = await fetch(`${API_URL}/admin/questions/${q.id}/sub-questions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const subData = await subRes.json();
        if (subData.length > 0) {
          setSubQuestions((prev) => ({ ...prev, [q.id]: subData }));
        }
      }
    } catch (error) {
      // Error fetching questions
    }
  };

  const toggleQuestion = async (id) => {
    const token = localStorage.getItem('adminToken');
    const question = questions.find(q => q.id === id);
    
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
      
      setTimerIntervals(prev => ({ ...prev, [id]: timerInterval }));
    } else {
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

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '25px',
        backgroundColor: '#667eea',
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700' }}>
            📁 {projectInfo?.title || 'Loading...'}
          </h1>
          {projectInfo?.date && (
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
              📅 {new Date(projectInfo.date).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/admin/dashboard')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
        >
          ← Back to Projects
        </button>
      </div>

      {questions.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '60px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#7f8c8d', marginBottom: '20px' }}>
            No Questions in this Project
          </h2>
          <button
            onClick={() => navigate('/admin/create')}
            style={{
              padding: '15px 30px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            ➕ Create Question
          </button>
        </div>
      ) : (
        <div>
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
                    <span style={{ 
                      color: '#667eea', 
                      fontWeight: '800',
                      marginRight: '8px'
                    }}>
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
    </div>
  );
}

export default ProjectDetail;
