import { useState, useEffect } from 'react';
import { API_BASE as API_URL } from '../config';
import Toast from './Toast';

function ProjectSelector({ onProjectSelect, selectedProjectId }) {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', date: '' });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // Ensure data is an array
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        setProjects([]);
      }
    } catch (error) {
      setProjects([]);
    }
  };

  const createProject = async () => {
    const token = localStorage.getItem('adminToken');
    const res = await fetch(`${API_URL}/admin/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newProject)
    });
    const createdProject = await res.json();
    
    setShowCreateModal(false);
    setNewProject({ title: '', description: '', date: '' });
    setToast({
      message: 'Project created successfully!',
      type: 'success'
    });
    
    // Auto-select the newly created project
    if (createdProject && createdProject.id) {
      onProjectSelect(createdProject.id);
    }
    
    fetchProjects();
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => onProjectSelect(e.target.value)}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #e0e0e0',
            fontSize: '15px',
            flex: 1,
            minWidth: '200px'
          }}
        >
          <option value="">Select Project/Webinar</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.title} - {new Date(p.date).toLocaleDateString()}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '12px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + New Project
        </button>
      </div>

      {showCreateModal && (
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
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '20px' }}>Create New Project</h2>
            
            <input
              type="text"
              placeholder="Project Title (e.g., React Webinar)"
              value={newProject.title}
              onChange={(e) => setNewProject({...newProject, title: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '15px'
              }}
            />
            
            <textarea
              placeholder="Description (optional)"
              value={newProject.description}
              onChange={(e) => setNewProject({...newProject, description: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '15px',
                minHeight: '80px'
              }}
            />
            
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '14px' }}>
                📅 Project Date
              </label>
              <input
                type="date"
                value={newProject.date}
                onChange={(e) => setNewProject({...newProject, date: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '15px',
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
                onClick={createProject}
                disabled={!newProject.title}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: newProject.title ? '#27ae60' : '#bdc3c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: newProject.title ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
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
    </div>
  );
}

export default ProjectSelector;
