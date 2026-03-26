// Local dev: load .env. Railway/Docker uses npm ci --omit=dev; skip dotenv when RAILWAY_* is set.
const loadDotenv =
  process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT;
if (loadDotenv) {
  require('dotenv').config();
}

// Validate required env vars on startup so missing vars fail fast with a clear message
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'MOONSHOT_API_KEY',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('[STARTUP] Railway environment:', process.env.RAILWAY_ENVIRONMENT_NAME || '(not set)');
  console.error('[STARTUP] Missing required env vars:', missing.join(', '));
  console.error('[STARTUP] Env keys present:', Object.keys(process.env).join(', '));
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const adminUserRoutes = require('./routes/admin/users');
const adminProfileRoutes = require('./routes/admin/profiles');
const userProfileRoutes = require('./routes/user/profiles');
const userChatRoutes = require('./routes/user/chat');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/profiles', adminProfileRoutes);
app.use('/api/profiles', userProfileRoutes);
app.use('/api/profiles', userChatRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
