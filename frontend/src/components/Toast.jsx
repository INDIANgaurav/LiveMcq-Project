import { useEffect } from 'react';

function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: { bg: '#27ae60', icon: '✅' },
    error: { bg: '#e74c3c', icon: '❌' },
    info: { bg: '#3498db', icon: 'ℹ️' },
    warning: { bg: '#f39c12', icon: '⚠️' }
  };

  const style = colors[type] || colors.info;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: style.bg,
      color: 'white',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: '300px',
      maxWidth: '500px',
      animation: 'slideIn 0.3s ease-out',
      fontSize: '15px',
      fontWeight: '500'
    }}>
      <span style={{ fontSize: '24px' }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default Toast;
