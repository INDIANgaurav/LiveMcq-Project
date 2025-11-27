# 🎯 Live MCQ System

A real-time Multiple Choice Question (MCQ) polling system built with React, Node.js, Express, PostgreSQL, and Socket.IO.

## ✨ Features

- **Real-time Polling**: Live voting with instant results using WebSocket
- **Admin Dashboard**: Create, edit, and manage questions
- **Multi-part Questions**: Support for main questions with sub-questions
- **Session Management**: Secure session codes for student access
- **Auto-timer**: Questions automatically stop after 60 seconds
- **Vote History**: Track and view voting history with detailed analytics
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Authentication**: JWT-based admin authentication
- **Glass Morphism UI**: Modern, beautiful interface

## 🚀 Tech Stack

### Frontend
- React 18
- React Router
- Socket.IO Client
- Vite

### Backend
- Node.js
- Express
- PostgreSQL
- Socket.IO
- JWT Authentication
- bcrypt

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd LiveMcq-Project
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/polling_db
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
```

Run database migration:
```bash
node migrate.js
```

Start the backend server:
```bash
npm start
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Start the frontend development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## 📖 Usage

### For Admins

1. **Sign Up/Login**: Navigate to `/admin/login` and create an account
2. **Create Questions**: Click "Create" to add new questions with options
3. **Activate Questions**: Toggle questions to make them live
4. **Share Session Code**: Share the 6-digit code with students
5. **View Results**: See real-time voting results and history

### For Students

1. **Join Session**: Navigate to `/join` and enter the session code
2. **Vote**: Select your answer and submit
3. **View Results**: See results after voting

## 🎨 Features in Detail

### Admin Features
- ✅ Create/Edit/Delete questions
- ✅ Multi-part questions with sub-questions
- ✅ Activate/Deactivate questions
- ✅ 60-second auto-timer
- ✅ Real-time vote tracking
- ✅ Vote history with analytics
- ✅ Session management

### Student Features
- ✅ Join with session code
- ✅ Real-time question updates
- ✅ Vote on main and sub-questions
- ✅ View live results
- ✅ Session validation

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Session expiry on admin logout
- Protected API routes
- Admin-specific data isolation

## 📱 Responsive Design

- Mobile-first approach
- Hamburger menu for mobile
- Touch-friendly interface
- Adaptive layouts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🚀 Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `frontend`
4. Add environment variable: 
   - `VITE_API_URL=https://livemcq-project.onrender.com`
5. Deploy

### Backend (Render)
1. Create new Web Service
2. Connect GitHub repository
3. Set root directory to `backend`
4. Add environment variables:
   - `DATABASE_URL=<your-postgres-url>`
   - `JWT_SECRET=<your-secret-key>`
   - `FRONTEND_URL=https://live-mcq-tool.vercel.app`
   - `PORT=5000`
5. Deploy

## 🌐 Live Demo

**Frontend**: [https://live-mcq-tool.vercel.app](https://live-mcq-tool.vercel.app)  
**Backend API**: [https://livemcq-project.onrender.com](https://livemcq-project.onrender.com)

## 👨‍💻 Author

Powered by FINSENSOR

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by interactive learning platforms
- Special thanks to all contributors

---

Made with ❤️ for interactive learning
