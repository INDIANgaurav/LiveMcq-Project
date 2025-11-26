import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE as API_URL, SOCKET_URL } from '../config';

const socket = io(SOCKET_URL);

function AdminPanel() {
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [questions, setQuestions] = useState([]);
  const [liveResults, setLiveResults] = useState({});

  useEffect(() => {
    fetchQuestions();

    // Listen for vote updates
    socket.on('voteUpdate', (data) => {
      setLiveResults((prev) => ({
        ...prev,
        [data.questionId]: data.results,
      }));
    });

    return () => {
      socket.off('voteUpdate');
    };
  }, []);

  const fetchQuestions = async () => {
    const res = await fetch(`${API_URL}/admin/questions`);
    const data = await res.json();
    setQuestions(data);
    
    // Fetch results for active questions
    for (const q of data) {
      if (q.is_active) {
        const resResults = await fetch(`${API_URL}/questions/${q.id}/results`);
        const results = await resResults.json();
        setLiveResults((prev) => ({ ...prev, [q.id]: results }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validOptions = options.filter((opt) => opt.trim());

    if (validOptions.length < 2) {
      alert('Please add at least 2 options!');
      return;
    }

    await fetch(`${API_URL}/admin/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heading, description, options: validOptions }),
    });

    setHeading('');
    setDescription('');
    setOptions(['', '', '', '']);
    fetchQuestions();
  };

  const toggleQuestion = async (id) => {
    await fetch(`${API_URL}/admin/questions/${id}/toggle`, { method: 'PATCH' });
    fetchQuestions();
  };

  const shareLink = () => {
    const link = window.location.origin;
    navigator.clipboard.writeText(link);
    alert('Student link copied to clipboard!\n' + link);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ color: '#2c3e50', margin: 0 }}>Admin Dashboard</h1>
        <button
          onClick={shareLink}
          style={{
            padding: '12px 24px',
            backgroundColor: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          📋 Copy Student Link
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Create New Question</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Question Heading *"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '15px',
              fontSize: '16px',
              border: '2px solid #ecf0f1',
              borderRadius: '8px',
              boxSizing: 'border-box'
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '15px',
              fontSize: '16px',
              minHeight: '80px',
              border: '2px solid #ecf0f1',
              borderRadius: '8px',
              boxSizing: 'border-box',
              fontFamily: 'Arial, sans-serif'
            }}
          />

          <h3 style={{ color: '#2c3e50' }}>Options</h3>
          {options.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <span style={{ 
                padding: '12px', 
                fontWeight: 'bold',
                color: '#7f8c8d',
                minWidth: '30px'
              }}>
                {String.fromCharCode(65 + idx)}.
              </span>
              <input
                type="text"
                placeholder={`Option ${idx + 1}`}
                value={opt}
                onChange={(e) => {
                  const newOpts = [...options];
                  newOpts[idx] = e.target.value;
                  setOptions(newOpts);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #ecf0f1',
                  borderRadius: '8px'
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions([...options, ''])}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              cursor: 'pointer',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            + Add Option
          </button>
          <button
            type="submit"
            style={{
              padding: '12px 30px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Create Question
          </button>
        </form>
      </div>

      <h2 style={{ color: '#2c3e50' }}>All Questions</h2>
      {questions.length === 0 ? (
        <p style={{ color: '#7f8c8d', textAlign: 'center', padding: '20px' }}>
          No questions created yet.
        </p>
      ) : (
        questions.map((q) => (
          <div
            key={q.id}
            style={{
              padding: '25px',
              marginBottom: '20px',
              border: q.is_active ? '3px solid #27ae60' : '2px solid #ecf0f1',
              borderRadius: '10px',
              backgroundColor: 'white',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                  {q.heading}
                  {q.is_active && (
                    <span style={{
                      marginLeft: '10px',
                      padding: '4px 12px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'normal'
                    }}>
                      🔴 LIVE
                    </span>
                  )}
                </h3>
                {q.description && <p style={{ color: '#7f8c8d', margin: '0 0 15px 0' }}>{q.description}</p>}
              </div>
              <button
                onClick={() => toggleQuestion(q.id)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: q.is_active ? '#e74c3c' : '#3498db',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {q.is_active ? '⏸ Deactivate' : '▶ Activate'}
              </button>
            </div>

            {q.is_active && liveResults[q.id] && (
              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📊 Live Results</h4>
                {liveResults[q.id].map((opt, idx) => (
                  <div key={opt.id} style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: '500' }}>
                        {String.fromCharCode(65 + idx)}. {opt.option_text}
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#3498db' }}>
                        {opt.percentage}% ({opt.votes} votes)
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
                        borderRadius: '12px'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default AdminPanel;
