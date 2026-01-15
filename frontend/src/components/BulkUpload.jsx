import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ProjectSelector from './ProjectSelector';
import { API_BASE as API_URL } from '../config';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

function BulkUpload() {
  const [projectId, setProjectId] = useState('');
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();

  // Configure PDF.js worker - use unpkg for better reliability
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const questions = [];
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Question line starts with "Q:"
      if (line.startsWith('Q:')) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          heading: line.substring(2).trim(),
          description: '',
          options: [],
          subQuestions: []
        };
      }
      // Description line starts with "D:"
      else if (line.startsWith('D:') && currentQuestion) {
        currentQuestion.description = line.substring(2).trim();
      }
      // Option line starts with "O:"
      else if (line.startsWith('O:') && currentQuestion) {
        currentQuestion.options.push(line.substring(2).trim());
      }
      // Sub-question line starts with "SQ:"
      else if (line.startsWith('SQ:') && currentQuestion) {
        currentQuestion.subQuestions.push({
          text: line.substring(3).trim(),
          options: []
        });
      }
      // Sub-question option starts with "SO:"
      else if (line.startsWith('SO:') && currentQuestion && currentQuestion.subQuestions.length > 0) {
        const lastSubQ = currentQuestion.subQuestions[currentQuestion.subQuestions.length - 1];
        lastSubQ.options.push(line.substring(3).trim());
      }
    }

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return questions;
  };

  const parseJSON = (text) => {
    try {
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  };

  const parseExcel = (arrayBuffer) => {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      const questions = [];
      let currentQuestion = null;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const firstCell = String(row[0] || '').trim();
        
        if (firstCell.startsWith('Q:')) {
          if (currentQuestion) questions.push(currentQuestion);
          currentQuestion = {
            heading: firstCell.substring(2).trim(),
            description: '',
            options: [],
            subQuestions: []
          };
        } else if (firstCell.startsWith('D:') && currentQuestion) {
          currentQuestion.description = firstCell.substring(2).trim();
        } else if (firstCell.startsWith('O:') && currentQuestion) {
          currentQuestion.options.push(firstCell.substring(2).trim());
        } else if (firstCell.startsWith('SQ:') && currentQuestion) {
          currentQuestion.subQuestions.push({
            text: firstCell.substring(3).trim(),
            options: []
          });
        } else if (firstCell.startsWith('SO:') && currentQuestion && currentQuestion.subQuestions.length > 0) {
          const lastSubQ = currentQuestion.subQuestions[currentQuestion.subQuestions.length - 1];
          lastSubQ.options.push(firstCell.substring(3).trim());
        }
      }

      if (currentQuestion) questions.push(currentQuestion);
      return questions;
    } catch (error) {
      throw new Error('Invalid Excel format: ' + error.message);
    }
  };

  const parseWord = async (arrayBuffer) => {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      return parseCSV(text);
    } catch (error) {
      throw new Error('Invalid Word format: ' + error.message);
    }
  };

  const parsePDF = async (arrayBuffer) => {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      return parseCSV(fullText);
    } catch (error) {
      throw new Error('Invalid PDF format: ' + error.message);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setToast({ message: 'Processing file...', type: 'info' });

    try {
      let questions;

      if (file.name.endsWith('.json')) {
        const text = await file.text();
        questions = parseJSON(text);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        questions = parseCSV(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        questions = parseExcel(arrayBuffer);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        questions = await parseWord(arrayBuffer);
      } else if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        questions = await parsePDF(arrayBuffer);
      } else {
        setToast({ message: 'Please upload a supported file format', type: 'error' });
        return;
      }

      setPreview(questions);
      setToast({ message: `${questions.length} questions loaded! Review and upload.`, type: 'success' });
    } catch (error) {
      setToast({ message: 'Error parsing file: ' + error.message, type: 'error' });
    }
  };

  const handleUpload = async () => {
    if (!projectId) {
      setToast({ message: 'Please select a project first!', type: 'warning' });
      return;
    }

    if (!preview || preview.length === 0) {
      setToast({ message: 'No questions to upload!', type: 'warning' });
      return;
    }

    setUploading(true);
    const token = localStorage.getItem('adminToken');
    let successCount = 0;
    let failCount = 0;

    for (const question of preview) {
      try {
        const payload = {
          heading: question.heading,
          description: question.description || '',
          projectId: projectId
        };

        // Determine question type
        if (question.subQuestions && question.subQuestions.length > 0) {
          // Multi-part question
          const validSubQuestions = question.subQuestions
            .filter(sq => sq.text && sq.text.trim())
            .map(sq => ({
              text: sq.text,
              options: sq.options.filter(opt => opt && opt.trim())
            }))
            .filter(sq => sq.options.length >= 2);

          if (validSubQuestions.length > 0) {
            payload.subQuestions = validSubQuestions;
          }
          
          if (question.options && question.options.length > 0) {
            const validOptions = question.options.filter(opt => opt && opt.trim());
            if (validOptions.length >= 2) {
              payload.options = validOptions;
            }
          }
        } else {
          // Simple question
          const validOptions = question.options.filter(opt => opt && opt.trim());
          if (validOptions.length < 2) {
            failCount++;
            continue;
          }
          payload.options = validOptions;
        }

        const res = await fetch(`${API_URL}/admin/questions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    setUploading(false);
    setToast({
      message: `Upload complete! ✅ ${successCount} success, ❌ ${failCount} failed`,
      type: successCount > 0 ? 'success' : 'error'
    });

    if (successCount > 0) {
      setTimeout(() => navigate('/admin/dashboard'), 2000);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ marginTop: 0, color: '#2c3e50', marginBottom: '10px' }}>
          📤 Bulk Upload Questions
        </h1>
        <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
          Upload multiple questions at once using CSV, TXT, or JSON format
        </p>

        <ProjectSelector 
          onProjectSelect={setProjectId}
          selectedProjectId={projectId}
        />

        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            padding: '40px',
            border: '3px dashed #3498db',
            borderRadius: '12px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#f8f9fa',
            transition: 'all 0.3s'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = '#e3f2fd';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            const file = e.dataTransfer.files[0];
            if (file) {
              const input = document.getElementById('fileInput');
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              input.files = dataTransfer.files;
              handleFileSelect({ target: input });
            }
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📁</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '10px' }}>
              Click to select file or drag & drop
            </div>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
              Supports: CSV, TXT, JSON, Excel, Word, PDF
            </div>
            <input
              id="fileInput"
              type="file"
              accept=".csv,.txt,.json,.xlsx,.xls,.docx,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Format Guide */}
        <details style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#2c3e50', fontSize: '16px' }}>
            📖 File Format Guide
          </summary>
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>CSV/TXT Format:</h4>
            <pre style={{
              backgroundColor: '#2c3e50',
              color: '#ecf0f1',
              padding: '15px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '13px'
            }}>
{`Q: What is React?
D: A JavaScript library for building UIs
O: A framework
O: A library
O: A database
O: An IDE

Q: Multi-part question example
D: This has sub-questions
O: Main option 1
O: Main option 2
SQ: First sub-question?
SO: Sub option A
SO: Sub option B
SQ: Second sub-question?
SO: Sub option X
SO: Sub option Y`}
            </pre>

            <h4 style={{ color: '#2c3e50', marginTop: '20px', marginBottom: '10px' }}>Excel (.xlsx) Format:</h4>
            <div style={{ 
              backgroundColor: '#e8f5e9', 
              padding: '15px', 
              borderRadius: '8px',
              fontSize: '14px',
              color: '#2c3e50'
            }}>
              <p style={{ margin: '0 0 10px 0' }}>
                📊 Use the same format as TXT in Excel:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Put all data in Column A</li>
                <li>Use Q:, D:, O:, SQ:, SO: prefixes</li>
                <li>Each line in one row</li>
              </ul>
            </div>

            <h4 style={{ color: '#2c3e50', marginTop: '20px', marginBottom: '10px' }}>Word (.docx) & PDF Format:</h4>
            <div style={{ 
              backgroundColor: '#fff3e0', 
              padding: '15px', 
              borderRadius: '8px',
              fontSize: '14px',
              color: '#2c3e50'
            }}>
              <p style={{ margin: '0 0 10px 0' }}>
                📄 Use the same TXT format in Word and PDF:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Write in plain text format</li>
                <li>Use Q:, D:, O: prefixes</li>
                <li>Formatting will be ignored, only text will be extracted</li>
              </ul>
            </div>
          </div>
        </details>

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>
              Preview ({preview.length} questions)
            </h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {preview.map((q, idx) => (
                <div key={idx} style={{
                  padding: '15px',
                  marginBottom: '10px',
                  border: '2px solid #ecf0f1',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '5px' }}>
                    {idx + 1}. {q.heading}
                  </div>
                  {q.description && (
                    <div style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '10px' }}>
                      {q.description}
                    </div>
                  )}
                  {q.options && q.options.length > 0 && (
                    <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                      Options: {q.options.length}
                    </div>
                  )}
                  {q.subQuestions && q.subQuestions.length > 0 && (
                    <div style={{ fontSize: '14px', color: '#9b59b6' }}>
                      Sub-questions: {q.subQuestions.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={handleUpload}
            disabled={!preview || uploading}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '15px 30px',
              backgroundColor: preview && !uploading ? '#27ae60' : '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: preview && !uploading ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            {uploading ? '⏳ Uploading...' : '✓ Upload All'}
          </button>
          <button
            onClick={() => navigate('/admin/dashboard')}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '15px 30px',
              backgroundColor: '#7f8c8d',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkUpload;
