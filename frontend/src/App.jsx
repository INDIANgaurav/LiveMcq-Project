import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import CreateQuestion from './components/CreateQuestion';
import EditQuestion from './components/EditQuestion';
import BulkUpload from './components/BulkUpload';
import UserPanel from './components/UserPanel';
import JoinSession from './components/JoinSession';
import HomePage from './components/HomePage';
import AdminLogin from './components/AdminLogin';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/join" element={<JoinSession />} />
          <Route path="/session/:code" element={<UserPanel />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/create" element={<CreateQuestion />} />
          <Route path="/admin/bulk-upload" element={<BulkUpload />} />
          <Route path="/admin/edit/:id" element={<EditQuestion />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
