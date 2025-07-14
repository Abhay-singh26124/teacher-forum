const express = require('express');
const app = express();
const bodyparser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const classroomRoutes=require('./routes/classroomRoutes')
dotenv.config();
const port = process.env.PORT || 5000; // Default port if not specified
require('./db');

// Configure allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000', 
  'http://10.35.142.38:3000'
].filter(Boolean); // Remove any undefined values

// Enhanced CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check if the origin includes any of our domains (for subdomains)
      const domainMatch = allowedOrigins.some(allowedOrigin => {
        return origin.includes(new URL(allowedOrigin).hostname);
      });
      
      if (domainMatch) {
        return callback(null, true);
      }
      
      console.warn(`Blocked by CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Handle preflight requests
app.options('*', cors());

// Middleware
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

// Cookie parser with secure defaults
app.use(cookieParser(process.env.COOKIE_SECRET, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  signed: true
}));

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);
app.use('/class',classroomRoutes)
// Test endpoints
app.get('/', (req, res) => {
  res.send('Hello world');
});

app.get('/getuserdata', (req, res) => {
  res.send('Abhay singh,22,Male');
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy blocked this request'
    });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});