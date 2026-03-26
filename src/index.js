require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'MOONSHOT_API_KEY',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn('[CONFIG] Missing env vars (API calls will fail until fixed):', missing.join(', '));
  console.warn('[CONFIG] Env keys present:', Object.keys(process.env).join(', '));
} else {
  console.log('[CONFIG] All required env vars present.');
}

const authRoutes = require('./routes/auth');
const adminUserRoutes = require('./routes/admin/users');
const adminProfileRoutes = require('./routes/admin/profiles');
const userProfileRoutes = require('./routes/user/profiles');
const userChatRoutes = require('./routes/user/chat');

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
