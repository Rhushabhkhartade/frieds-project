const BASE = 'http://localhost:5000/api/v1';

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}
async function get(path, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { headers });
  return r.json();
}

async function run() {
  console.log('\n======== AUTH TEST SUITE ========\n');

  // 1. Register new user
  console.log('1. REGISTER new user...');
  const reg = await post('/auth/register', {
    fullName: 'Test Admin',
    email: 'testadmin@bloodai.local',
    password: 'Test@1234',
    confirmPassword: 'Test@1234',
    role: 'ADMIN'
  });
  console.log('   Result:', JSON.stringify(reg));

  // 2. Duplicate email
  console.log('\n2. REGISTER duplicate email (should fail)...');
  const dup = await post('/auth/register', {
    fullName: 'Dup User',
    email: 'testadmin@bloodai.local',
    password: 'Test@1234',
    confirmPassword: 'Test@1234',
    role: 'STAFF'
  });
  console.log('   Result:', JSON.stringify(dup));

  // 3. Invalid registration — missing fields
  console.log('\n3. REGISTER with bad data (weak password, should fail)...');
  const bad = await post('/auth/register', {
    fullName: 'X',
    email: 'bad-email',
    password: '123',
    confirmPassword: '456',
    role: 'HACKER'
  });
  console.log('   Result:', JSON.stringify(bad));

  // 4. Login with wrong password
  console.log('\n4. LOGIN wrong password (should fail)...');
  const wrongPw = await post('/auth/login', {
    email: 'admin@bloodai.local',
    password: 'wrongpassword'
  });
  console.log('   Result:', JSON.stringify(wrongPw));

  // 5. Login correct credentials (seed admin)
  console.log('\n5. LOGIN correct seed admin...');
  const login = await post('/auth/login', {
    email: 'admin@bloodai.local',
    password: 'Admin@1234'
  });
  console.log('   Success:', login.success);
  console.log('   Token present:', !!login.data?.token);
  console.log('   User role:', login.data?.user?.role);
  console.log('   passwordHash in response:', 'passwordHash' in (login.data?.user || {}));
  const token = login.data?.token;

  // 6. GET /auth/me with valid token
  console.log('\n6. GET /auth/me with valid token...');
  const me = await get('/auth/me', token);
  console.log('   Success:', me.success);
  console.log('   User:', me.data?.email, '/', me.data?.role);
  console.log('   passwordHash in response:', 'passwordHash' in (me.data || {}));

  // 7. GET /auth/me without token
  console.log('\n7. GET /auth/me WITHOUT token (should fail 401)...');
  const noToken = await get('/auth/me', null);
  console.log('   Result:', JSON.stringify(noToken));

  // 8. GET /auth/me with invalid token
  console.log('\n8. GET /auth/me with INVALID token (should fail 401)...');
  const badToken = await get('/auth/me', 'eyJhbGciOiJIUzI1NiJ9.fake.fake');
  console.log('   Result:', JSON.stringify(badToken));

  // 9. Logout
  console.log('\n9. POST /auth/logout...');
  const logout = await post('/auth/logout', {});
  console.log('   Result:', JSON.stringify(logout));

  // 10. Login as newly registered user
  console.log('\n10. LOGIN newly registered user...');
  const regLogin = await post('/auth/login', {
    email: 'testadmin@bloodai.local',
    password: 'Test@1234'
  });
  console.log('   Success:', regLogin.success);
  console.log('   Role:', regLogin.data?.user?.role);
  console.log('   Token present:', !!regLogin.data?.token);

  // 11. Verify /health still works
  console.log('\n11. GET /health (must not be broken)...');
  const health = await fetch('http://localhost:5000/health').then(r => r.json());
  console.log('   Status:', health.status);

  console.log('\n======== TEST SUITE COMPLETE ========\n');
}

run().catch(console.error);
