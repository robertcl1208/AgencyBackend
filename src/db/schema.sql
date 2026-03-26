-- ============================================================
-- Agency Chatbot System – Full Database Schema
-- Run this entire script in the Supabase SQL Editor once.
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. PUBLIC USERS TABLE  (mirrors auth.users + stores role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-sync new auth users into public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 3. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. PROFILE PERMISSIONS  (which users can access which profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id)
);

-- ============================================================
-- 5. PROFILE KNOWLEDGE  (admin-added information with embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536),          -- matches Moonshot moonshot-v1-embedding dim
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_knowledge_profile_id
  ON public.profile_knowledge (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_knowledge_embedding
  ON public.profile_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- 6. PROFILE MEMORY  (user-suggested Q&A pairs with embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  embedding    VECTOR(1536),
  suggested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_memory_profile_id
  ON public.profile_memory (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_memory_embedding
  ON public.profile_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- 7. CHAT SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON public.chat_messages (session_id);

-- ============================================================
-- 9. VECTOR SIMILARITY SEARCH FUNCTIONS
-- ============================================================

-- Search knowledge by cosine similarity
CREATE OR REPLACE FUNCTION match_profile_knowledge(
  p_profile_id     UUID,
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT DEFAULT 0.70,
  match_count      INT   DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    pk.id,
    pk.content,
    pk.metadata,
    1 - (pk.embedding <=> query_embedding) AS similarity
  FROM public.profile_knowledge pk
  WHERE pk.profile_id = p_profile_id
    AND pk.embedding IS NOT NULL
    AND 1 - (pk.embedding <=> query_embedding) >= match_threshold
  ORDER BY pk.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Search memory by cosine similarity
CREATE OR REPLACE FUNCTION match_profile_memory(
  p_profile_id     UUID,
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT DEFAULT 0.70,
  match_count      INT   DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  question   TEXT,
  answer     TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    pm.id,
    pm.question,
    pm.answer,
    1 - (pm.embedding <=> query_embedding) AS similarity
  FROM public.profile_memory pm
  WHERE pm.profile_id = p_profile_id
    AND pm.embedding IS NOT NULL
    AND 1 - (pm.embedding <=> query_embedding) >= match_threshold
  ORDER BY pm.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_knowledge  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_memory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by the backend)
-- Users can read their own record
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles: readable if user has permission or is admin
CREATE POLICY "profiles_accessible" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.profile_permissions
      WHERE profile_id = profiles.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "profiles_admin_write" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Profile permissions: admin manages; user reads own
CREATE POLICY "permissions_read_own" ON public.profile_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "permissions_admin_all" ON public.profile_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Profile knowledge: admin writes; permitted users read
CREATE POLICY "knowledge_admin_write" ON public.profile_knowledge
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "knowledge_user_read" ON public.profile_knowledge
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profile_permissions
      WHERE profile_id = profile_knowledge.profile_id AND user_id = auth.uid()
    )
  );

-- Profile memory: authenticated users can insert; permitted users can read
CREATE POLICY "memory_user_insert" ON public.profile_memory
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "memory_user_read" ON public.profile_memory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.profile_permissions
      WHERE profile_id = profile_memory.profile_id AND user_id = auth.uid()
    )
  );

-- Chat sessions: users see own; admin sees all
CREATE POLICY "sessions_own" ON public.chat_sessions
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Chat messages: via session ownership
CREATE POLICY "messages_own" ON public.chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      WHERE cs.id = chat_messages.session_id
        AND (
          cs.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );
