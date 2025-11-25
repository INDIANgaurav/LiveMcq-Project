import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      position: 'relative'
    }}>
      

      <div style={{
        backgroundColor: 'white',
        padding: '50px 40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎯</div>
        <h1 style={{ 
          color: '#2c3e50', 
          marginBottom: '10px',
          fontSize: '36px'
        }}>
          Live MCQ System 
        </h1>
        <p style={{ 
          color: '#7f8c8d', 
          marginBottom: '40px',
          fontSize: '16px'
        }}>
          Choose your role to continue
        </p>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '15px' 
        }}>
          <button
            onClick={() => navigate('/admin/login')}
            style={{
              padding: '18px 30px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '24px' }}>👨‍💼</span>
            <span>Join as Admin</span>
          </button>

          <button
            onClick={() => navigate('/join')}
            style={{
              padding: '18px 30px',
              backgroundColor: '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '24px' }}>🎓</span>
            <span>Join as Student</span>
          </button>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          fontSize: '12px',
          color: '#7f8c8d'
        }}>
          <strong>Powered by FINSENSOR</strong>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
