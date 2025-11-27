import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ProjectSelector from './ProjectSelector';
import { API_BASE as API_URL } from '../config';

function CreateQuestion() {
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [questionType, setQuestionType] = useState('simple');
  const [options, setOptions] = useState(['', '', '', '']);
  const [subQuestions, setSubQuestions] = useState([
    { text: '', options: ['', '', '', ''] }
  ]);
  const [projectId, setProjectId] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectId) {
      setToast({ message: 'Please select or create a project first!', type: 'warning' });
      return;
    }

    if (questionType === 'simple') {
      const validOptions = options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        setToast({ message: 'Please add at least 2 options!', type: 'warning' });
        return;
      }

      const token = localStorage.getItem('adminToken');
      await fetch(`${API_URL}/admin/questions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ heading, description, options: validOptions, projectId }),
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
      await fetch(`${API_URL}/admin/questions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          heading, 
          description, 
          projectId,
          options: validMainOptions.length > 0 ? validMainOptions : undefined,
          subQuestions: validSubQuestions.length > 0 ? validSubQuestions : undefined
        }),
      });
    }

    setToast({ message: 'Question created successfully!', type: 'success' });
    setTimeout(() => navigate('/admin/dashboard'), 1500);
  };

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
          ➕ Create New Question
        </h1>

        <form onSubmit={handleSubmit}>
          <ProjectSelector 
            onProjectSelect={setProjectId}
            selectedProjectId={projectId}
          />
          
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

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: '#2c3e50', fontSize: '16px' }}>
              Question Type *
            </label>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <label style={{
                padding: '16px',
                border: questionType === 'simple' ? '3px solid #3498db' : '2px solid #e0e0e0',
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: questionType === 'simple' ? '#ebf5fb' : 'white',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="radio"
                    name="questionType"
                    value="simple"
                    checked={questionType === 'simple'}
                    onChange={(e) => setQuestionType(e.target.value)}
                    style={{ width: '18px', height: '18px', accentColor: '#3498db' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '15px' }}>📝 Simple Question</span>
                </div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', paddingLeft: '28px' }}>
                  One question with multiple choice options
                </div>
              </label>

              <label style={{
                padding: '16px',
                border: questionType === 'multi' ? '3px solid #9b59b6' : '2px solid #e0e0e0',
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: questionType === 'multi' ? '#f4ecf7' : 'white',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="radio"
                    name="questionType"
                    value="multi"
                    checked={questionType === 'multi'}
                    onChange={(e) => setQuestionType(e.target.value)}
                    style={{ width: '18px', height: '18px', accentColor: '#9b59b6' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '15px' }}>📋 Multi-Part Question</span>
                </div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', paddingLeft: '28px' }}>
                  Main question with multiple sub-questions
                </div>
              </label>
            </div>
          </div>

          {questionType === 'simple' && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50', fontSize: '18px' }}>
                Answer Options
              </label>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '30px', fontSize: '16px' }}>{String.fromCharCode(65 + idx)}.</span>
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
                        padding: '10px 14px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: '600',
                        minWidth: '40px',
                        transition: 'all 0.3s'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setOptions([...options, ''])}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.3s'
                  }}
                >
                  + Add Option
                </button>
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.slice(0, -1))}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.3s'
                    }}
                  >
                    − Remove Last
                  </button>
                )}
              </div>
            </div>
          )}

          {questionType === 'multi' && (
            <>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Main Question Options (Optional)
                </label>
                <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '15px' }}>
                  Add options for the main question if needed, or leave empty to only use sub-questions.
                </p>
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
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setOptions([...options, ''])}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.3s'
                    }}
                  >
                    + Add Option
                  </button>
                  {options.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.slice(0, -1))}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.3s'
                      }}
                    >
                      − Remove Last
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50', fontSize: '18px' }}>
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
                  <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Sub-Question {sqIdx + 1}</h3>
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
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...subQuestions];
                        updated[sqIdx].options.push('');
                        setSubQuestions(updated);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      + Add Option
                    </button>
                    {sq.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...subQuestions];
                          updated[sqIdx].options = updated[sqIdx].options.slice(0, -1);
                          setSubQuestions(updated);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        − Remove Last
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
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
                {subQuestions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSubQuestions(subQuestions.slice(0, -1))}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    − Remove Last Sub-Question
                  </button>
                )}
              </div>
            </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '25px' }}>
            <button
              type="submit"
              style={{
                padding: '14px 20px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'all 0.3s',
                boxShadow: '0 2px 8px rgba(39, 174, 96, 0.3)'
              }}
            >
              ✓ Create Question
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              style={{
                padding: '14px 20px',
                backgroundColor: '#7f8c8d',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'all 0.3s'
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

export default CreateQuestion;
