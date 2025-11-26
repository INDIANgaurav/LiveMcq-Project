import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE as API_URL, SOCKET_URL } from '../config';

function UserPanel() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [mainQuestion, setMainQuestion] = useState(null);
  const [subQuestion, setSubQuestion] = useState(null);
  const [activeView, setActiveView] = useState('main'); // 'main' or 'sub'
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedQuestions, setVotedQuestions] = useState(new Set()); // Track voted questions
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9));
  const [socket, setSocket] = useState(null);
  const [sessionValid, setSessionValid] = useState(true);

  useEffect(() => {
    // Validate session code first
    const validateSession = async () => {
      try {
        const res = await fetch(`${API_URL}/session/verify/${code}`);
        const data = await res.json();
        if (!data.valid) {
          setSessionValid(false);
          setTimeout(() => navigate('/join'), 3000);
          return;
        }
      } catch (error) {
        console.error('Session validation error:', error);
        setSessionValid(false);
        setTimeout(() => navigate('/join'), 3000);
        return;
      }
    };

    validateSession();

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    setSocket(newSocket);

    fetchActiveQuestion();

    // Listen for new main questions
    newSocket.on('newQuestion', (newQuestion) => {
      setMainQuestion(newQuestion);
      setQuestion(newQuestion);
      setActiveView('main');
      setSubQuestion(null);
      // Check if already voted on this question
      const alreadyVoted = votedQuestions.has(`main-${newQuestion.id}`);
      setHasVoted(alreadyVoted);
      setSelectedOption(null);
      setResults([]);
      setShowResults(alreadyVoted); // Show results if already voted
    });

    // Listen for new sub-questions
    newSocket.on('newSubQuestion', (newSubQuestion) => {
      setSubQuestion(newSubQuestion);
      setQuestion(newSubQuestion);
      setActiveView('sub');
      // Check if already voted on this sub-question
      const alreadyVoted = votedQuestions.has(`sub-${newSubQuestion.id}`);
      setHasVoted(alreadyVoted);
      setSelectedOption(null);
      setResults([]);
      setShowResults(alreadyVoted); // Show results if already voted
    });

    // Listen for vote updates
    newSocket.on('voteUpdate', (data) => {
      if (question && data.questionId === question.id) {
        setResults(data.results);
        setShowResults(true);
      }
    });

    // Listen for question closed
    newSocket.on('questionClosed', () => {
      setSubQuestion(null);
      if (mainQuestion) {
        setQuestion(mainQuestion);
        setActiveView('main');
      } else {
        setQuestion(null);
        setMainQuestion(null);
      }
      setHasVoted(false);
      setSelectedOption(null);
      setResults([]);
      setShowResults(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchActiveQuestion = async () => {
    const res = await fetch(`${API_URL}/questions/active`);
    const data = await res.json();
    if (data) {
      if (data.type === 'main') {
        setMainQuestion(data);
        setQuestion(data);
        setActiveView('main');
      } else {
        setSubQuestion(data);
        setQuestion(data);
        setActiveView('sub');
      }
      // Fetch existing results if any
      const resResults = await fetch(`${API_URL}/questions/${data.id}/results`);
      const resultsData = await resResults.json();
      if (resultsData.some(r => r.votes > 0)) {
        setResults(resultsData);
        setShowResults(true);
      }
    }
  };

  const handleVote = async () => {
    if (!selectedOption || hasVoted) return;

    await fetch(`${API_URL}/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: question.id,
        optionId: selectedOption,
        userIp: userId,
        type: question.type || 'main',
      }),
    });

    setHasVoted(true);
    
    // Track this question as voted
    const questionKey = question.type === 'sub' ? `sub-${question.id}` : `main-${question.id}`;
    setVotedQuestions(prev => new Set([...prev, questionKey]));
  };

  // Show invalid session message
  if (!sessionValid) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '50px 20px',
        maxWidth: '700px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 100px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '60px 40px',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.5s ease'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ 
            color: '#e74c3c', 
            marginBottom: '20px',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            Session Expired
          </h2>
          <p style={{ color: '#95a5a6', fontSize: '18px', lineHeight: '1.6', marginBottom: '30px' }}>
            This session is no longer valid.<br/>Redirecting to join page...
          </p>
          
          <div style={{
            padding: '20px',
            backgroundColor: '#e3f2fd',
            borderRadius: '12px',
            border: '1px solid #bbdefb'
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
                transition: 'all 0.3s'
              }}
            >
              <span>👨‍💼</span>
              <span>Login as Admin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '50px 20px',
        maxWidth: '700px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 100px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '60px 40px',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.5s ease'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }} className="pulse">⏳</div>
          <h2 style={{ 
            color: '#3498db', 
            marginBottom: '20px',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            Waiting for Question...
          </h2>
          <p style={{ color: '#95a5a6', fontSize: '18px', lineHeight: '1.6' }}>
            The admin will activate a question soon.<br/>Stay tuned! 🚀
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: 'clamp(20px, 5vw, 40px) clamp(15px, 3vw, 20px)',
      minHeight: 'calc(100vh - 100px)'
    }} className="fade-in">
      {/* Toggle buttons when both main and sub questions exist */}
      {mainQuestion && subQuestion && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => {
              setQuestion(mainQuestion);
              setActiveView('main');
              setHasVoted(false);
              setSelectedOption(null);
              setResults([]);
              setShowResults(false);
            }}
            style={{
              padding: 'clamp(12px, 3vw, 15px)',
              backgroundColor: activeView === 'main' ? '#3498db' : '#ecf0f1',
              color: activeView === 'main' ? 'white' : '#7f8c8d',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontWeight: '700',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>📝</span>
            <span>Main Question</span>
          </button>
          <button
            onClick={() => {
              setQuestion(subQuestion);
              setActiveView('sub');
              setHasVoted(false);
              setSelectedOption(null);
              setResults([]);
              setShowResults(false);
            }}
            style={{
              padding: 'clamp(12px, 3vw, 15px)',
              backgroundColor: activeView === 'sub' ? '#9b59b6' : '#ecf0f1',
              color: activeView === 'sub' ? 'white' : '#7f8c8d',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontWeight: '700',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>📋</span>
            <span>Sub Question</span>
          </button>
        </div>
      )}
      
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          background: question.type === 'sub' ? '#9b59b6' : '#3498db',
          color: 'white',
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '30px',
          boxShadow: '0 10px 30px rgba(52, 152, 219, 0.2)'
        }}>
          {question.mainHeading && (
            <div style={{ 
              fontSize: '15px', 
              opacity: 0.95, 
              marginBottom: '12px',
              fontWeight: '500'
            }}>
              📌 {question.mainHeading}
            </div>
          )}
          <h1 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '32px',
            fontWeight: '700',
            textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
          }}>
            {question.type === 'sub' && '📌 '}
            {question.heading}
          </h1>
          {question.description && (
            <p style={{ 
              margin: 0, 
              fontSize: '18px', 
              opacity: 0.95,
              lineHeight: '1.6'
            }}>
              {question.description}
            </p>
          )}
        </div>

        {!hasVoted && !showResults ? (
          <div>
            <h3 style={{ 
              marginBottom: '25px', 
              color: '#2c3e50',
              fontSize: '22px',
              fontWeight: '600'
            }}>
              Select your answer:
            </h3>
            {question.options.map((opt, idx) => (
              <div key={opt.id} style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '20px',
                    border: selectedOption === opt.id ? '3px solid #3498db' : '2px solid #e0e0e0',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    backgroundColor: selectedOption === opt.id ? '#ebf5fb' : 'white',
                    transition: 'all 0.3s ease',
                    boxShadow: selectedOption === opt.id ? '0 8px 20px rgba(52, 152, 219, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedOption !== opt.id) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedOption !== opt.id) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="option"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => setSelectedOption(opt.id)}
                    style={{ 
                      marginRight: '16px', 
                      width: '22px', 
                      height: '22px',
                      accentColor: '#3498db'
                    }}
                  />
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: '#2c3e50'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '32px',
                      height: '32px',
                      backgroundColor: selectedOption === opt.id ? '#3498db' : '#e0e0e0',
                      color: selectedOption === opt.id ? 'white' : '#666',
                      borderRadius: '50%',
                      textAlign: 'center',
                      lineHeight: '32px',
                      marginRight: '12px',
                      fontWeight: 'bold',
                      fontSize: '16px'
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt.option_text}
                  </span>
                </label>
              </div>
            ))}
            <button
              onClick={handleVote}
              disabled={!selectedOption}
              style={{
                width: '100%',
                padding: '18px',
                fontSize: '20px',
                fontWeight: '700',
                background: selectedOption ? '#3498db' : '#bdc3c7',
                color: 'white',
                border: 'none',
                cursor: selectedOption ? 'pointer' : 'not-allowed',
                borderRadius: '16px',
                marginTop: '25px',
                boxShadow: selectedOption ? '0 8px 20px rgba(52, 152, 219, 0.3)' : 'none',
              }}
            >
              ✓ Submit Answer
            </button>
          </div>
        ) : showResults ? (
          <div>
            <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>
              📊 Live Results {hasVoted && <span style={{ color: '#27ae60' }}>- Your vote recorded!</span>}
            </h3>
            {results.map((opt, idx) => (
              <div key={opt.id} style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: '500', fontSize: '16px' }}>
                    {String.fromCharCode(65 + idx)}. {opt.option_text}
                  </span>
                  <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#3498db' }}>
                    {opt.percentage}% ({opt.votes})
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '30px',
                    backgroundColor: '#ecf0f1',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${opt.percentage}%`,
                      height: '100%',
                      backgroundColor: selectedOption === opt.id ? '#27ae60' : '#3498db',
                      transition: 'width 0.5s ease',
                      borderRadius: '15px',
                    }}
                  ></div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: '25px',
              padding: '15px',
              backgroundColor: '#e8f8f5',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, color: '#16a085', fontWeight: '500' }}>
                🔄 Results update in real-time as others vote!
              </p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '18px', color: '#27ae60' }}>✓ Vote submitted! Waiting for results...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserPanel;
