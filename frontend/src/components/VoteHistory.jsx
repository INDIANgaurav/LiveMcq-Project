import { useState, useEffect } from 'react';
import { API_BASE as API_URL } from '../config';

function VoteHistory({ questionId }) {
  const [history, setHistory] = useState({ mainVotes: [], subVotes: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'

  useEffect(() => {
    fetchHistory();
    
    // Poll every 5 seconds for real-time updates (reduced load)
    const interval = setInterval(() => {
      fetchHistory();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [questionId]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/questions/${questionId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading history...</div>;
  }

  const totalVotes = history.mainVotes.length + history.subVotes.length;

  // Calculate option-wise summary for main question
  const mainSummary = history.mainVotes.reduce((acc, vote) => {
    if (!acc[vote.option_text]) {
      acc[vote.option_text] = { count: 0, voters: [] };
    }
    acc[vote.option_text].count++;
    acc[vote.option_text].voters.push(vote.user_ip);
    return acc;
  }, {});

  // Calculate sub-question summaries
  const subSummary = history.subVotes.reduce((acc, vote) => {
    const key = vote.sub_question_text;
    if (!acc[key]) {
      acc[key] = {};
    }
    if (!acc[key][vote.option_text]) {
      acc[key][vote.option_text] = { count: 0, voters: [] };
    }
    acc[key][vote.option_text].count++;
    acc[key][vote.option_text].voters.push(vote.user_ip);
    return acc;
  }, {});

  return (
    <div style={{
      marginTop: 'clamp(15px, 3vw, 20px)',
      padding: 'clamp(15px, 3vw, 25px)',
      backgroundColor: '#f8f9fa',
      borderRadius: '12px',
      border: '2px solid #e0e0e0'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '15px',
        marginBottom: 'clamp(15px, 3vw, 20px)'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#2c3e50', 
          fontSize: 'clamp(16px, 3.5vw, 20px)',
          wordBreak: 'break-word'
        }}>
          📊 Vote History ({totalVotes} total votes)
        </h3>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '10px'
        }}>
          <button
            onClick={() => setViewMode('summary')}
            style={{
              padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
              backgroundColor: viewMode === 'summary' ? '#3498db' : '#ecf0f1',
              color: viewMode === 'summary' ? 'white' : '#7f8c8d',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(13px, 2.5vw, 14px)',
              fontWeight: '600',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>📊</span>
            <span>Summary</span>
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            style={{
              padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
              backgroundColor: viewMode === 'detailed' ? '#3498db' : '#ecf0f1',
              color: viewMode === 'detailed' ? 'white' : '#7f8c8d',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(13px, 2.5vw, 14px)',
              fontWeight: '600',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>📋</span>
            <span>Detailed</span>
          </button>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <>
          {/* Summary View */}
          {history.mainVotes.length > 0 && (
            <div style={{ marginBottom: 'clamp(20px, 4vw, 25px)' }}>
              <h4 style={{ 
                color: '#3498db', 
                marginBottom: 'clamp(12px, 3vw, 15px)', 
                fontSize: 'clamp(14px, 3vw, 16px)',
                wordBreak: 'break-word'
              }}>
                Main Question - Option Breakdown ({history.mainVotes.length} votes)
              </h4>
              {Object.entries(mainSummary).map(([option, data], idx) => (
                <div key={idx} style={{
                  marginBottom: 'clamp(12px, 3vw, 15px)',
                  padding: 'clamp(12px, 3vw, 15px)',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '10px' 
                  }}>
                    <span style={{ 
                      fontWeight: '700', 
                      fontSize: 'clamp(13px, 2.8vw, 15px)', 
                      color: '#2c3e50',
                      wordBreak: 'break-word'
                    }}>
                      {option}
                    </span>
                    <span style={{ 
                      fontWeight: '700', 
                      fontSize: 'clamp(14px, 3vw, 16px)', 
                      color: '#3498db' 
                    }}>
                      {data.count} votes ({((data.count / history.mainVotes.length) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#ecf0f1',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '10px'
                  }}>
                    <div style={{
                      width: `${(data.count / history.mainVotes.length) * 100}%`,
                      height: '100%',
                      backgroundColor: '#3498db',
                      transition: 'width 0.3s'
                    }}></div>
                  </div>
                  <details style={{ 
                    fontSize: 'clamp(12px, 2.5vw, 13px)', 
                    color: '#7f8c8d', 
                    cursor: 'pointer' 
                  }}>
                    <summary style={{ 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      padding: '8px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px'
                    }}>
                      View {data.count} student{data.count > 1 ? 's' : ''}
                    </summary>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: 'clamp(6px, 1.5vw, 8px)',
                      marginTop: '10px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      padding: 'clamp(8px, 2vw, 10px)',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px'
                    }}>
                      {data.voters.map((voter, vIdx) => (
                        <span key={vIdx} style={{
                          padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 10px)',
                          backgroundColor: '#e8f4f8',
                          borderRadius: '12px',
                          fontSize: 'clamp(11px, 2vw, 12px)',
                          color: '#2c3e50',
                          wordBreak: 'break-all'
                        }}>
                          {voter.substring(0, 10)}...
                        </span>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {history.subVotes.length > 0 && (
            <div>
              <h4 style={{ 
                color: '#9b59b6', 
                marginBottom: 'clamp(12px, 3vw, 15px)', 
                fontSize: 'clamp(14px, 3vw, 16px)',
                wordBreak: 'break-word'
              }}>
                Sub-Questions Breakdown ({history.subVotes.length} votes)
              </h4>
              {Object.entries(subSummary).map(([subQ, options], sqIdx) => (
                <div key={sqIdx} style={{
                  marginBottom: 'clamp(15px, 3vw, 20px)',
                  padding: 'clamp(12px, 3vw, 15px)',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #9b59b6'
                }}>
                  <h5 style={{ 
                    margin: '0 0 clamp(12px, 3vw, 15px) 0', 
                    color: '#2c3e50', 
                    fontSize: 'clamp(13px, 2.8vw, 14px)',
                    wordBreak: 'break-word'
                  }}>
                    {subQ}
                  </h5>
                  {Object.entries(options).map(([option, data], optIdx) => {
                    const totalSubVotes = Object.values(options).reduce((sum, opt) => sum + opt.count, 0);
                    return (
                      <div key={optIdx} style={{ marginBottom: 'clamp(10px, 2vw, 12px)' }}>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '6px',
                          marginBottom: '6px' 
                        }}>
                          <span style={{ 
                            fontSize: 'clamp(12px, 2.5vw, 14px)', 
                            fontWeight: '600',
                            wordBreak: 'break-word'
                          }}>
                            {option}
                          </span>
                          <span style={{ 
                            fontSize: 'clamp(13px, 2.8vw, 14px)', 
                            color: '#9b59b6', 
                            fontWeight: '700' 
                          }}>
                            {data.count} ({((data.count / totalSubVotes) * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: 'clamp(5px, 1.5vw, 6px)',
                          backgroundColor: '#ecf0f1',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(data.count / totalSubVotes) * 100}%`,
                            height: '100%',
                            backgroundColor: '#9b59b6',
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Detailed View */}
          {history.mainVotes.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#3498db', marginBottom: '15px', fontSize: '16px' }}>
                Main Question Votes ({history.mainVotes.length})
              </h4>
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                overflowX: 'auto',
                backgroundColor: 'white', 
                borderRadius: '8px' 
              }}>
                <table style={{ 
                  width: '100%', 
                  minWidth: '500px',
                  borderCollapse: 'collapse' 
                }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ecf0f1', zIndex: 1 }}>
                    <tr>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Student ID
                      </th>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Selected Option
                      </th>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.mainVotes.map((vote, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #ecf0f1' }}>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(12px, 2.5vw, 14px)' 
                        }}>
                          {vote.user_ip.substring(0, 12)}...
                        </td>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(12px, 2.5vw, 14px)', 
                          fontWeight: '600', 
                          color: '#2c3e50' 
                        }}>
                          {vote.option_text}
                        </td>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(11px, 2vw, 13px)', 
                          color: '#7f8c8d',
                          whiteSpace: 'nowrap'
                        }}>
                          {new Date(vote.voted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {history.subVotes.length > 0 && (
            <div>
              <h4 style={{ color: '#9b59b6', marginBottom: '15px', fontSize: '16px' }}>
                Sub-Question Votes ({history.subVotes.length})
              </h4>
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                overflowX: 'auto', 
                backgroundColor: 'white', 
                borderRadius: '8px' 
              }}>
                <table style={{ 
                  width: '100%',
                  minWidth: '600px', 
                  borderCollapse: 'collapse' 
                }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ecf0f1', zIndex: 1 }}>
                    <tr>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Student ID
                      </th>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Sub-Question
                      </th>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Selected Option
                      </th>
                      <th style={{ 
                        padding: 'clamp(8px, 2vw, 12px)', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #bdc3c7',
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        whiteSpace: 'nowrap'
                      }}>
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.subVotes.map((vote, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #ecf0f1' }}>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(12px, 2.5vw, 14px)' 
                        }}>
                          {vote.user_ip.substring(0, 12)}...
                        </td>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(11px, 2vw, 13px)', 
                          color: '#7f8c8d' 
                        }}>
                          {vote.sub_question_text.substring(0, 30)}...
                        </td>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(12px, 2.5vw, 14px)', 
                          fontWeight: '600', 
                          color: '#2c3e50' 
                        }}>
                          {vote.option_text}
                        </td>
                        <td style={{ 
                          padding: 'clamp(8px, 2vw, 10px)', 
                          fontSize: 'clamp(11px, 2vw, 13px)', 
                          color: '#7f8c8d',
                          whiteSpace: 'nowrap'
                        }}>
                          {new Date(vote.voted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {totalVotes === 0 && (
        <p style={{ textAlign: 'center', color: '#95a5a6', padding: '20px' }}>
          No votes yet for this question.
        </p>
      )}
    </div>
  );
}

export default VoteHistory;
