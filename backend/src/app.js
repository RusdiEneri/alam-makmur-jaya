require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin tidak diizinkan oleh CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend UD. Alam Makmur Jaya aktif',
    docs: {
      health: '/api/health',
      products: '/api/products',
      login: '/api/auth/login'
    }
  });
});
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
