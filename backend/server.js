import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from './db.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://live-mcq-tool.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
  },
});

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://live-mcq-tool.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

// Rate limiting for bulk uploads - allows 200 requests per minute per IP
const questionUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute (enough for bulk uploads)
  message: { error: 'Too many requests, please slow down. Max 200 questions per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Live MCQ System API is running!',
    endpoints: {
      admin: '/api/admin/*',
      session: '/api/session/*',
      questions: '/api/questions/*'
    }
  });
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = verified;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// WebSocket connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Admin Signup
app.post('/api/admin/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingAdmin = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO admins (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, email: result.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate unique session code
function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create new session (protected route)
app.post('/api/admin/session/create', authenticateToken, async (req, res) => {
  try {
    const admin = await pool.query('SELECT name FROM admins WHERE id = $1', [req.admin.id]);
    
    // Check if admin has ANY session in last 24 hours (ignore is_active status)
    const existingSession = await pool.query(
      `SELECT * FROM sessions 
       WHERE admin_id = $1 
       AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [req.admin.id]
    );
    
    // If session exists within 24 hours, reactivate and return it
    if (existingSession.rows.length > 0) {
      const session = existingSession.rows[0];
      
      // Make sure it's active (in case it was deactivated)
      await pool.query(
        'UPDATE sessions SET is_active = true WHERE id = $1',
        [session.id]
      );
      
      return res.json({ sessionCode: session.session_code });
    }
    
    // Create new session only if no session exists in last 24 hours
    const sessionCode = generateSessionCode();
    const result = await pool.query(
      'INSERT INTO sessions (session_code, admin_id, admin_name) VALUES ($1, $2, $3) RETURNING *',
      [sessionCode, req.admin.id, admin.rows[0].name]
    );
    res.json({ sessionCode: result.rows[0].session_code });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete admin session on logout (protected route)
app.delete('/api/admin/session/delete', authenticateToken, async (req, res) => {
  try {
    // Don't deactivate session on logout - let it expire naturally after 24 hours
    // Session will remain active for students even if admin logs out
    res.json({ message: 'Logged out successfully. Session remains active for students.' });
  } catch (error) {
    console.error('Session deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create question with options and sub-questions (protected)
app.post('/api/admin/questions', authenticateToken, questionUploadLimiter, async (req, res) => {
  const { heading, description, options, subQuestions, projectId } = req.body;
  
  // Input validation
  if (!heading || !projectId) {
    return res.status(400).json({ 
      error: 'Missing required fields: heading and projectId are required',
      success: false 
    });
  }

  const client = await pool.connect();
  try {
    // Start transaction for data consistency
    await client.query('BEGIN');

    // Get next question number for this project
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM questions WHERE project_id = $1',
      [projectId]
    );
    const questionNumber = parseInt(countResult.rows[0].count) + 1;
    
    const result = await client.query(
      'INSERT INTO questions (admin_id, project_id, heading, description, question_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.admin.id, projectId, heading, description || '', questionNumber]
    );
    const questionId = result.rows[0].id;

    // Insert main options if provided
    if (options && options.length > 0) {
      for (const opt of options) {
        await client.query(
          'INSERT INTO options (question_id, option_text) VALUES ($1, $2)',
          [questionId, opt]
        );
      }
    }

    // Insert sub-questions if provided
    if (subQuestions && subQuestions.length > 0) {
      for (let i = 0; i < subQuestions.length; i++) {
        const subQ = subQuestions[i];
        const subQResult = await client.query(
          'INSERT INTO sub_questions (question_id, sub_question_text, order_index) VALUES ($1, $2, $3) RETURNING *',
          [questionId, subQ.text, i]
        );
        const subQuestionId = subQResult.rows[0].id;

        // Insert options for this sub-question
        if (subQ.options && subQ.options.length > 0) {
          for (const opt of subQ.options) {
            await client.query(
              'INSERT INTO sub_options (sub_question_id, option_text) VALUES ($1, $2)',
              [subQuestionId, opt]
            );
          }
        }
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    res.json({ success: true, question: result.rows[0] });
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Question creation error:', error);
    res.status(500).json({ 
      error: error.message,
      success: false,
      details: 'Failed to create question. Transaction rolled back.'
    });
  } finally {
    client.release();
  }
});

// Admin: Get all questions (only for logged-in admin)
app.get('/api/admin/questions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, p.title as project_title, p.date as project_date, p.description as project_description 
       FROM questions q 
       LEFT JOIN projects p ON q.project_id = p.id 
       WHERE q.admin_id = $1 
       ORDER BY p.date DESC, q.question_number ASC, q.created_at DESC`,
      [req.admin.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Activate/Deactivate main question (protected)
app.patch('/api/admin/questions/:id/toggle', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Deactivate all questions for this admin
    await pool.query('UPDATE questions SET is_active = false WHERE admin_id = $1 AND id != $2', [req.admin.id, id]);
    await pool.query('UPDATE sub_questions SET is_active = false');
    
    const result = await pool.query(
      'UPDATE questions SET is_active = NOT is_active, activated_at = CASE WHEN NOT is_active THEN NOW() ELSE NULL END WHERE id = $1 AND admin_id = $2 RETURNING *',
      [id, req.admin.id]
    );
    
    // Broadcast to all users
    if (result.rows[0].is_active) {
      const options = await pool.query('SELECT * FROM options WHERE question_id = $1', [id]);
      io.emit('newQuestion', { ...result.rows[0], options: options.rows, type: 'main' });
    } else {
      io.emit('questionClosed');
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Activate/Deactivate sub-question
app.patch('/api/admin/sub-questions/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    // First, clear activated_at for all other sub-questions
    await pool.query('UPDATE sub_questions SET is_active = false, activated_at = NULL WHERE id != $1', [id]);
    
    // Check current state
    const current = await pool.query('SELECT is_active FROM sub_questions WHERE id = $1', [id]);
    const willBeActive = !current.rows[0].is_active;
    
    // Toggle and set activated_at if activating
    const result = await pool.query(
      'UPDATE sub_questions SET is_active = NOT is_active, activated_at = $2 WHERE id = $1 RETURNING *',
      [id, willBeActive ? new Date() : null]
    );
    
    // Broadcast to all users
    if (result.rows[0].is_active) {
      const options = await pool.query('SELECT * FROM sub_options WHERE sub_question_id = $1', [id]);
      const question = await pool.query('SELECT * FROM questions WHERE id = $1', [result.rows[0].question_id]);
      io.emit('newSubQuestion', { 
        ...result.rows[0], 
        options: options.rows,
        mainHeading: question.rows[0].heading,
        type: 'sub'
      });
    } else {
      io.emit('questionClosed');
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sub-questions for a question (protected)
app.get('/api/admin/questions/:id/sub-questions', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const subQuestions = await pool.query(
      'SELECT * FROM sub_questions WHERE question_id = $1 ORDER BY order_index',
      [id]
    );
    res.json(subQuestions.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear question vote history (protected)
app.delete('/api/admin/questions/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    console.log('Clearing history for question:', id, 'Admin:', req.admin.id);
    
    // Verify question belongs to admin
    const question = await pool.query('SELECT * FROM questions WHERE id = $1 AND admin_id = $2', [id, req.admin.id]);
    if (question.rows.length === 0) {
      console.log('Question not found or unauthorized');
      return res.status(404).json({ error: 'Question not found' });
    }

    // Delete all main question votes
    const result = await pool.query('DELETE FROM votes WHERE question_id = $1', [id]);
    console.log('Deleted main votes:', result.rowCount);
    
    // Delete all sub-question votes for this question
    const subQuestions = await pool.query('SELECT id FROM sub_questions WHERE question_id = $1', [id]);
    let subVotesDeleted = 0;
    for (const subQ of subQuestions.rows) {
      const subResult = await pool.query('DELETE FROM sub_votes WHERE sub_question_id = $1', [subQ.id]);
      subVotesDeleted += subResult.rowCount;
    }
    console.log('Deleted sub-votes:', subVotesDeleted);
    
    res.json({ 
      success: true, 
      message: 'Vote history cleared', 
      deletedCount: result.rowCount,
      subVotesDeleted 
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all projects for admin (protected)
app.get('/api/admin/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE admin_id = $1 ORDER BY date DESC, created_at DESC',
      [req.admin.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new project (protected)
app.post('/api/admin/projects', authenticateToken, async (req, res) => {
  const { title, description, date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO projects (admin_id, title, description, date) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.admin.id, title, description || '', date || new Date()]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project (protected)
app.put('/api/admin/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, date } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET title = $1, description = $2, date = $3 WHERE id = $4 AND admin_id = $5 RETURNING *',
      [title, description || '', date, id, req.admin.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project (protected) - CASCADE will delete all questions
app.delete('/api/admin/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 AND admin_id = $2', [id, req.admin.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, message: 'Project and all questions deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete question (protected)
app.delete('/api/admin/questions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM questions WHERE id = $1 AND admin_id = $2', [id, req.admin.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get question details for editing (protected)
app.get('/api/admin/questions/:id/details', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const question = await pool.query('SELECT * FROM questions WHERE id = $1 AND admin_id = $2', [id, req.admin.id]);
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const options = await pool.query('SELECT * FROM options WHERE question_id = $1', [id]);
    const subQuestions = await pool.query(
      'SELECT * FROM sub_questions WHERE question_id = $1 ORDER BY order_index',
      [id]
    );

    const subQuestionsWithOptions = await Promise.all(
      subQuestions.rows.map(async (subQ) => {
        const subOptions = await pool.query(
          'SELECT * FROM sub_options WHERE sub_question_id = $1',
          [subQ.id]
        );
        return { ...subQ, options: subOptions.rows };
      })
    );

    res.json({
      ...question.rows[0],
      options: options.rows,
      subQuestions: subQuestionsWithOptions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update question (protected)
app.put('/api/admin/questions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { heading, description, options, subQuestions } = req.body;
  try {
    // Update main question
    await pool.query(
      'UPDATE questions SET heading = $1, description = $2 WHERE id = $3 AND admin_id = $4',
      [heading, description, id, req.admin.id]
    );

    // Delete old options and sub-questions
    await pool.query('DELETE FROM options WHERE question_id = $1', [id]);
    await pool.query('DELETE FROM sub_questions WHERE question_id = $1', [id]);

    // Insert new options if provided
    if (options && options.length > 0) {
      for (const opt of options) {
        await pool.query(
          'INSERT INTO options (question_id, option_text) VALUES ($1, $2)',
          [id, opt.option_text || opt]
        );
      }
    }

    // Insert new sub-questions if provided
    if (subQuestions && subQuestions.length > 0) {
      for (let i = 0; i < subQuestions.length; i++) {
        const subQ = subQuestions[i];
        const subQResult = await pool.query(
          'INSERT INTO sub_questions (question_id, sub_question_text, order_index) VALUES ($1, $2, $3) RETURNING *',
          [id, subQ.text || subQ.sub_question_text, i]
        );
        const subQuestionId = subQResult.rows[0].id;

        // Insert options for this sub-question
        const subOpts = subQ.options || [];
        for (const opt of subOpts) {
          await pool.query(
            'INSERT INTO sub_options (sub_question_id, option_text) VALUES ($1, $2)',
            [subQuestionId, opt.option_text || opt]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User: Get active question (main or sub)
app.get('/api/questions/active', async (req, res) => {
  try {
    // Check for active main question
    const question = await pool.query('SELECT * FROM questions WHERE is_active = true LIMIT 1');
    if (question.rows.length > 0) {
      const options = await pool.query('SELECT * FROM options WHERE question_id = $1', [question.rows[0].id]);
      return res.json({ 
        ...question.rows[0], 
        options: options.rows,
        type: 'main'
      });
    }

    // Check for active sub-question
    const subQuestion = await pool.query('SELECT * FROM sub_questions WHERE is_active = true LIMIT 1');
    if (subQuestion.rows.length > 0) {
      const options = await pool.query('SELECT * FROM sub_options WHERE sub_question_id = $1', [subQuestion.rows[0].id]);
      const mainQuestion = await pool.query('SELECT * FROM questions WHERE id = $1', [subQuestion.rows[0].question_id]);
      return res.json({
        id: subQuestion.rows[0].id,
        heading: subQuestion.rows[0].sub_question_text,
        mainHeading: mainQuestion.rows[0].heading,
        options: options.rows,
        type: 'sub',
        question_id: subQuestion.rows[0].question_id
      });
    }

    res.json(null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User: Submit vote (main question)
app.post('/api/votes', async (req, res) => {
  const { questionId, optionId, userIp, type } = req.body;
  try {
    if (type === 'sub') {
      // Vote for sub-question
      await pool.query(
        'INSERT INTO sub_votes (sub_question_id, sub_option_id, user_ip) VALUES ($1, $2, $3)',
        [questionId, optionId, userIp]
      );

      const subOptions = await pool.query('SELECT * FROM sub_options WHERE sub_question_id = $1', [questionId]);
      const subVotes = await pool.query(
        'SELECT sub_option_id, COUNT(*) as count FROM sub_votes WHERE sub_question_id = $1 GROUP BY sub_option_id',
        [questionId]
      );

      const totalVotes = subVotes.rows.reduce((sum, v) => sum + parseInt(v.count), 0);
      const results = subOptions.rows.map((opt) => {
        const voteCount = subVotes.rows.find((v) => v.sub_option_id === opt.id)?.count || 0;
        return {
          ...opt,
          votes: parseInt(voteCount),
          percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0,
        };
      });

      io.emit('voteUpdate', { questionId, results, type: 'sub' });
    } else {
      // Vote for main question
      await pool.query(
        'INSERT INTO votes (question_id, option_id, user_ip) VALUES ($1, $2, $3)',
        [questionId, optionId, userIp]
      );

      const options = await pool.query('SELECT * FROM options WHERE question_id = $1', [questionId]);
      const votes = await pool.query(
        'SELECT option_id, COUNT(*) as count FROM votes WHERE question_id = $1 GROUP BY option_id',
        [questionId]
      );

      const totalVotes = votes.rows.reduce((sum, v) => sum + parseInt(v.count), 0);
      const results = options.rows.map((opt) => {
        const voteCount = votes.rows.find((v) => v.option_id === opt.id)?.count || 0;
        return {
          ...opt,
          votes: parseInt(voteCount),
          percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0,
        };
      });

      io.emit('voteUpdate', { questionId, results, type: 'main' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit sub-question vote
app.post('/api/sub-votes', async (req, res) => {
  const { subQuestionId, subOptionId, userIp } = req.body;
  try {
    await pool.query(
      'INSERT INTO sub_votes (sub_question_id, sub_option_id, user_ip) VALUES ($1, $2, $3)',
      [subQuestionId, subOptionId, userIp]
    );

    // Get updated results for this sub-question
    const subOptions = await pool.query('SELECT * FROM sub_options WHERE sub_question_id = $1', [subQuestionId]);
    const subVotes = await pool.query(
      'SELECT sub_option_id, COUNT(*) as count FROM sub_votes WHERE sub_question_id = $1 GROUP BY sub_option_id',
      [subQuestionId]
    );

    const totalVotes = subVotes.rows.reduce((sum, v) => sum + parseInt(v.count), 0);
    const results = subOptions.rows.map((opt) => {
      const voteCount = subVotes.rows.find((v) => v.sub_option_id === opt.id)?.count || 0;
      return {
        ...opt,
        votes: parseInt(voteCount),
        percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0,
      };
    });

    // This endpoint is deprecated - use /api/votes with type='sub' instead
    io.emit('voteUpdate', { questionId: subQuestionId, results, type: 'sub' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results with sub-questions
app.get('/api/questions/:id/results', async (req, res) => {
  const { id } = req.params;
  try {
    const options = await pool.query('SELECT * FROM options WHERE question_id = $1', [id]);
    const votes = await pool.query('SELECT option_id, COUNT(*) as count FROM votes WHERE question_id = $1 GROUP BY option_id', [id]);
    
    const totalVotes = votes.rows.reduce((sum, v) => sum + parseInt(v.count), 0);
    
    const results = options.rows.map(opt => {
      const voteCount = votes.rows.find(v => v.option_id === opt.id)?.count || 0;
      return {
        ...opt,
        votes: parseInt(voteCount),
        percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0
      };
    });

    // Get sub-questions results
    const subQuestions = await pool.query(
      'SELECT * FROM sub_questions WHERE question_id = $1 ORDER BY order_index',
      [id]
    );

    const subResults = await Promise.all(
      subQuestions.rows.map(async (subQ) => {
        const subOptions = await pool.query('SELECT * FROM sub_options WHERE sub_question_id = $1', [subQ.id]);
        const subVotes = await pool.query(
          'SELECT sub_option_id, COUNT(*) as count FROM sub_votes WHERE sub_question_id = $1 GROUP BY sub_option_id',
          [subQ.id]
        );

        const subTotalVotes = subVotes.rows.reduce((sum, v) => sum + parseInt(v.count), 0);
        const subOptionsResults = subOptions.rows.map((opt) => {
          const voteCount = subVotes.rows.find((v) => v.sub_option_id === opt.id)?.count || 0;
          return {
            ...opt,
            votes: parseInt(voteCount),
            percentage: subTotalVotes > 0 ? ((voteCount / subTotalVotes) * 100).toFixed(1) : 0,
          };
        });

        return {
          ...subQ,
          results: subOptionsResults,
        };
      })
    );

    res.json({ mainResults: results, subResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vote history for a question (protected)
app.get('/api/admin/questions/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Get main question votes with option details
    const mainVotes = await pool.query(`
      SELECT v.user_ip, v.voted_at, o.option_text, o.id as option_id
      FROM votes v
      JOIN options o ON v.option_id = o.id
      WHERE v.question_id = $1
      ORDER BY v.voted_at DESC
    `, [id]);

    // Get sub-question votes
    const subVotes = await pool.query(`
      SELECT sv.user_ip, sv.voted_at, so.option_text, sq.sub_question_text, sq.id as sub_question_id
      FROM sub_votes sv
      JOIN sub_options so ON sv.sub_option_id = so.id
      JOIN sub_questions sq ON sv.sub_question_id = sq.id
      WHERE sq.question_id = $1
      ORDER BY sv.voted_at DESC
    `, [id]);

    res.json({
      mainVotes: mainVotes.rows,
      subVotes: subVotes.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify session
app.get('/api/session/verify/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE session_code = $1 AND is_active = true',
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired session' });
    }

    // Check if session is older than 24 hours
    const session = result.rows[0];
    const createdAt = new Date(session.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60); // Convert milliseconds to hours

    if (hoursDiff > 24) {
      // Automatically deactivate expired session
      await pool.query(
        'UPDATE sessions SET is_active = false WHERE session_code = $1',
        [code]
      );
      return res.status(404).json({ 
        valid: false, 
        message: 'Session expired. This link was valid for 24 hours only.' 
      });
    }

    res.json({ valid: true, session: session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End session
app.post('/api/admin/session/end/:code', authenticateToken, async (req, res) => {
  const { code } = req.params;
  try {
    await pool.query(
      'UPDATE sessions SET is_active = false WHERE session_code = $1 AND admin_id = $2',
      [code, req.admin.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
