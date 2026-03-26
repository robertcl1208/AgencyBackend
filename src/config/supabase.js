const { createClient } = require('@supabase/supabase-js');

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };

// Service role client – bypasses RLS, used for all DB queries.
// Never call signInWithPassword on this client; it would contaminate the auth
// state and make subsequent queries run as the user JWT instead of service role.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientOpts
);

// Anon key client – used exclusively for auth operations (signIn, refresh).
// Keeping auth operations on a separate client ensures the service role client
// never has its internal session overwritten.
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  clientOpts
);

module.exports = supabase;
module.exports.supabaseAuth = supabaseAuth;
