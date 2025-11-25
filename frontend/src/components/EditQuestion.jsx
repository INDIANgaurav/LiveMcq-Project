import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Toast from './Toast';

const API_URL = 'http://localhost:5000/api';

function EditQuestion() {
  const { id } = useParams();
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [questionType, setQuestionType] = useState('simple');
  const [options, setOptions] = useState(['', '', '', '']);
  const [subQuestions, setSubQuestions] = useState([
    { text: '', options: ['', '', '', ''] }
  ]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuestion();
  }, [id]);

  const fetchQuestion = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/questions/${id}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      setHeading(data.heading);
      setDescription(data.description || '');
      
      // Set main options if they exist
      if (data.options && data.options.length > 0) {
        setOptions(data.options.map(opt => opt.option_text));
      }
      
      // Set sub-questions if they exist
      if (data.subQuestions && data.subQuestions.length > 0) {
        setQuestionType('multi');
        setSubQuestions(data.subQuestions.map(sq => ({
          text: sq.sub_question_text,
          options: sq.options.map(opt => opt.option_text)
        })));
      } else {
        setQuestionType('simple');
      }
      
      setLoading(false);
    } catch (error) {
      setToast({ message: 'Error loading question', type: 'error' });
      setTimeout(() => navigate('/admin/dashboard'), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (questionType === 'simple') {
      const validOptions = options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        setToast({ message: 'Please add at least 2 options!', type: 'warning' });
        return;
      }

      const token = localStorage.getItem('adminToken');
      await fetch(`${API_URL}/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ heading, description, options: validOptions }),
      });
    } else {
      const validMainOptions = options.filter((opt) => opt.trim());
      const validSubQuestions = subQuestions
        .filter((sq) => sq.text.trim())
        .map((sq) => ({
          text: sq.text,
          options: sq.options.filter((opt) => opt.trim()),
        }))
        .filter((sq) => sq.options.length >= 2);

      if (validMainOptions.length === 0 && validSubQuestions.length === 0) {
        setToast({ message: 'Please add either main options or sub-questions!', type: 'warning' });
        return;
      }

      const token = localStorage.getItem('adminToken');
      await fetch(`${API_URL}/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          heading, 
          description, 
          options: validMainOptions.length > 0 ? validMainOptions : undefined,
          subQuestions: validSubQuestions.length > 0 ? validSubQuestions : undefined
        }),
      });
    }

    setToast({ message: 'Question updated successfully!', type: 'success' });
    setTimeout(() => navigate('/admin/dashboard'), 1500);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '15px', width: '100%' }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ marginTop: 0, color: '#2c3e50', marginBottom: '20px', fontSize: '22px' }}>
          ✏️ Edit Question
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Question Heading *
            </label>
            <input
              type="text"
              placeholder="Enter your question here..."
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                border: '2px solid #ecf0f1',
                borderRadius: '8px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Description (Optional)
            </label>
            <textarea
              placeholder="Add additional context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                minHeight: '80px',
                border: '2px solid #ecf0f1',
                borderRadius: '8px',
                boxSizing: 'border-box',
                fontFamily: 'Arial, sans-serif',
              }}
            />
          </div>

          {questionType === 'simple' && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50' }}>
                Answer Options
              </label>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '30px' }}>{String.fromCharCode(65 + idx)}.</span>
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
                      borderRadius: '8px',
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                + Add Option
              </button>
            </div>
          )}

          {questionType === 'multi' && (
            <>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Main Question Options (Optional)
                </label>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '30px' }}>{String.fromCharCode(65 + idx)}.</span>
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
                        borderRadius: '8px',
                      }}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        style={{
                          padding: '10px 15px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions([...options, ''])}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  + Add Option
                </button>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Sub-Questions
                </label>
              {subQuestions.map((sq, sqIdx) => (
                <div key={sqIdx} style={{
                  padding: '20px',
                  marginBottom: '20px',
                  border: '2px solid #ecf0f1',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>Sub-Question {sqIdx + 1}</h3>
                    {subQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSubQuestions(subQuestions.filter((_, i) => i !== sqIdx))}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Enter sub-question text..."
                    value={sq.text}
                    onChange={(e) => {
                      const updated = [...subQuestions];
                      updated[sqIdx].text = e.target.value;
                      setSubQuestions(updated);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '6px',
                      marginBottom: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {sq.options.map((opt, optIdx) => (
                    <div key={optIdx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 'bold', minWidth: '25px' }}>{String.fromCharCode(65 + optIdx)}.</span>
                      <input
                        type="text"
                        placeholder={`Option ${optIdx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...subQuestions];
                          updated[sqIdx].options[optIdx] = e.target.value;
                          setSubQuestions(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          fontSize: '15px',
                          border: '2px solid #ecf0f1',
                          borderRadius: '6px',
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...subQuestions];
                      updated[sqIdx].options.push('');
                      setSubQuestions(updated);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    + Add Option
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSubQuestions([...subQuestions, { text: '', options: ['', '', '', ''] }])}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#9b59b6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                + Add Sub-Question
              </button>
            </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#f39c12',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold',
              }}
            >
              ✓ Update Question
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              style={{
                padding: '16px 30px',
                backgroundColor: '#7f8c8d',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditQuestion;
