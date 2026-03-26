/**
 * Seed script: creates the admin user in Supabase Auth and public.users.
 * Run once: npm run seed
 *
 * Prerequisites:
 *  - SUPABASE_SERVICE_ROLE_KEY must be set in .env
 */
require('dotenv').config();
const supabase = require('./config/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'robertcl1208@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '00000000';

async function seed() {
  console.log(`Seeding admin user: ${ADMIN_EMAIL}`);

  // Check if user already exists in auth
  const { data: { users: existing } } = await supabase.auth.admin.listUsers();
  const alreadyExists = existing.find((u) => u.email === ADMIN_EMAIL);

  let authUserId;

  if (alreadyExists) {
    console.log('Auth user already exists, reusing id:', alreadyExists.id);
    authUserId = alreadyExists.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error('Failed to create auth user:', error.message);
      process.exit(1);
    }
    authUserId = data.user.id;
    console.log('Auth user created:', authUserId);
  }

  // Upsert into public.users with role = admin
  const { error: upsertErr } = await supabase
    .from('users')
    .upsert({
      id: authUserId,
      email: ADMIN_EMAIL,
      role: 'admin',
    });

  if (upsertErr) {
    console.error('Failed to upsert public user:', upsertErr.message);
    process.exit(1);
  }

  console.log('Admin user seeded successfully.');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Role:     admin`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
