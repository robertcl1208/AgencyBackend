# Agency Chatbot Backend

Node.js/Express REST API powering the chatbot system with Supabase PostgreSQL (pgvector) and Moonshot AI (Kimi).

## Setup

### 1. Database

Run `src/db/schema.sql` in the **Supabase SQL Editor** (Dashboard → SQL Editor → New Query → paste & run).  
This creates all tables, pgvector indexes, similarity search functions, and RLS policies.

### 2. Environment variables

Copy `.env` and fill in the two missing values:

```
SUPABASE_SERVICE_ROLE_KEY=   # Supabase Dashboard → Project Settings → API → service_role
MOONSHOT_API_KEY=            # https://platform.moonshot.cn → API Keys
```

### 3. Install dependencies

```bash
npm install
```

### 4. Seed the admin user

```bash
npm run seed
```

Creates `robertcl1208@gmail.com` with password `00000000` and role `admin`.

### 5. Start the server

```bash
# development (auto-reload)
npm run dev

# production
npm start
```

Server runs on `http://localhost:4000`.

---

## API Reference

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | `{email, password}` | Returns access_token, refresh_token, user |
| POST | `/api/auth/logout` | — | Invalidates session |
| GET | `/api/auth/me` | — | Returns current user |
| POST | `/api/auth/refresh` | `{refresh_token}` | Returns new tokens |

### Admin – Users (Bearer token, role=admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create user `{email, password, role}` |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/users/:id/permissions` | Get profile permissions |
| PUT | `/api/admin/users/:id/permissions` | Replace permissions `{profile_ids:[]}` |

### Admin – Profiles (Bearer token, role=admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/profiles` | List all profiles |
| POST | `/api/admin/profiles` | Create profile `{name, description?, avatar_url?}` |
| PUT | `/api/admin/profiles/:id` | Update profile |
| DELETE | `/api/admin/profiles/:id` | Delete profile (cascades) |
| GET | `/api/admin/profiles/:id/knowledge` | List knowledge items |
| POST | `/api/admin/profiles/:id/knowledge` | Add knowledge `{content}` – auto-embeds |
| DELETE | `/api/admin/profiles/:id/knowledge/:kid` | Delete knowledge item |
| GET | `/api/admin/profiles/:id/memory` | List memory items |
| DELETE | `/api/admin/profiles/:id/memory/:mid` | Delete memory item |
| GET | `/api/admin/profiles/:id/users` | List users with access |

### User (Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profiles` | List accessible profiles |
| GET | `/api/profiles/:id` | Get single profile |
| POST | `/api/profiles/:id/sessions` | Create chat session |
| GET | `/api/profiles/:id/sessions/:sid/messages` | Load chat history |
| POST | `/api/profiles/:id/chat/message` | Send message `{message, session_id, suggested_answer?}` |
| POST | `/api/profiles/:id/memory` | Save Q&A manually `{question, answer}` |

### Chat message response types
```json
{ "type": "answer",       "content": "…" }
{ "type": "no_info",      "content": "…", "askForSuggestion": true }
{ "type": "not_related",  "content": "…", "askForSuggestion": true }
{ "type": "memory_saved", "content": "…" }
```

---

## Architecture

```
Backend/
├── src/
│   ├── index.js               Express entry point
│   ├── config/supabase.js     Service-role Supabase client
│   ├── middleware/
│   │   ├── auth.js            JWT verification → req.user
│   │   └── adminOnly.js       Role guard
│   ├── routes/
│   │   ├── auth.js
│   │   ├── admin/users.js
│   │   ├── admin/profiles.js
│   │   ├── user/profiles.js
│   │   └── user/chat.js
│   ├── services/
│   │   ├── moonshot.js        Kimi chat + embeddings
│   │   ├── embedding.js       Text chunking + embedding generation
│   │   └── chatbot.js         RAG pipeline
│   ├── db/schema.sql
│   └── seed.js
```
