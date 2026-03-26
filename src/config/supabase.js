const { createClient } = require('@supabase/supabase-js');

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };

// Lazy singletons — created on first use so a missing env var at module load
// time does not crash the process before Express can bind and pass health checks.
let _supabase = null;
let _supabaseAuth = null;

function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, clientOpts);
  }
  return _supabase;
}

function getSupabaseAuth() {
  if (!_supabaseAuth) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY env vars are required');
    }
    _supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, clientOpts);
  }
  return _supabaseAuth;
}

// Proxy objects: behave exactly like the real clients but are created lazily.
// Existing code that does `supabase.from(...)` or `supabaseAuth.auth.signIn(...)` 
// works without any changes — calls are forwarded to the real client on first use.
const supabase = new Proxy({}, {
  get(_target, prop) {
    return getSupabase()[prop];
  },
});

const supabaseAuth = new Proxy({}, {
  get(_target, prop) {
    return getSupabaseAuth()[prop];
  },
});

module.exports = supabase;
module.exports.supabaseAuth = supabaseAuth;
