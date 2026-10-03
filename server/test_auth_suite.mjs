import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const BASE_URL = 'http://localhost:5000/api/v1';

const results = [];

function assert(condition, name, details = '') {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✓ PASS: ${name}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`  ✗ FAIL: ${name} — ${details}`);
  }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
}

async function post(endpoint, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchWithRetry(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function get(endpoint, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchWithRetry(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers
  });
}

async function put(endpoint, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchWithRetry(`${BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });
}

async function runTestSuite() {
  const testEmail = `emily.stone_${Date.now()}@hospital.org`;

  console.log('\n========================================');
  console.log('   BLOOD AI AUTHENTICATION TEST SUITE   ');
  console.log('========================================\n');

  // Test 1: Health check
  console.log('[1/16] Checking API Health...');
  const healthRes = await fetch('http://localhost:5000/health');
  const health = await healthRes.json();
  assert(healthRes.status === 200 && health.status === 'healthy', 'Root /health endpoint returns 200 healthy');

  // Test 2: Register a new STAFF user
  console.log(`\n[2/16] Registering new STAFF user (${testEmail})...`);
  const staffReg = await post('/auth/register', {
    fullName: 'Dr. Emily Stone',
    email: testEmail,
    facility: 'St. Jude Transfusion Lab',
    role: 'STAFF',
    password: 'SecurePassword1',
    confirmPassword: 'SecurePassword1'
  });
  assert(staffReg.status === 201, 'POST /auth/register returns HTTP 201 Created', `Status: ${staffReg.status}`);
  assert(staffReg.data?.success === true, 'Response contains success: true');
  assert(staffReg.data?.data?.email === testEmail, 'Response returns correct user email');
  assert(staffReg.data?.data?.role === 'STAFF', 'Response returns correct user role');
  assert(!('passwordHash' in (staffReg.data?.data || {})), 'Response does NOT leak passwordHash');
  assert(!('password' in (staffReg.data?.data || {})), 'Response does NOT leak plaintext password');

  // Test 3: Register duplicate email -> Must fail with 409 EMAIL_ALREADY_EXISTS
  console.log('\n[3/16] Testing Duplicate Email Registration...');
  const dupReg = await post('/auth/register', {
    fullName: 'Duplicate Emily',
    email: testEmail,
    role: 'STAFF',
    password: 'SecurePassword1',
    confirmPassword: 'SecurePassword1'
  });
  assert(dupReg.status === 409, 'POST /auth/register with duplicate email returns HTTP 409', `Status: ${dupReg.status}`);
  assert(dupReg.data?.success === false, 'Duplicate error has success: false');
  assert(dupReg.data?.error?.code === 'EMAIL_ALREADY_EXISTS', 'Error code is EMAIL_ALREADY_EXISTS');

  // Test 4: Invalid registration data -> Must fail with 400 VALIDATION_ERROR
  console.log('\n[4/16] Testing Invalid Registration Payloads...');
  const badReg1 = await post('/auth/register', {
    fullName: 'A', // too short
    email: 'not-an-email',
    role: 'SUPERADMIN', // invalid role
    password: 'weak', // no uppercase, no number, < 8 chars
    confirmPassword: 'mismatch'
  });
  assert(badReg1.status === 400, 'Invalid registration payload returns HTTP 400', `Status: ${badReg1.status}`);
  assert(badReg1.data?.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

  // Test 5: Login with wrong password -> Generic INVALID_CREDENTIALS
  console.log('\n[5/16] Testing Login with Wrong Password...');
  const wrongPw = await post('/auth/login', {
    email: 'admin@bloodai.local',
    password: 'WrongPassword999'
  });
  assert(wrongPw.status === 400, 'Login with wrong password returns HTTP 400', `Status: ${wrongPw.status}`);
  assert(wrongPw.data?.error?.code === 'INVALID_CREDENTIALS', 'Error code is generic INVALID_CREDENTIALS');

  // Test 6: Login with non-existent email -> Same generic INVALID_CREDENTIALS (no email leakage)
  console.log('\n[6/16] Testing Login with Non-Existent Email...');
  const nonExistent = await post('/auth/login', {
    email: 'nobody_exists@hospital.org',
    password: 'SomePassword123'
  });
  assert(nonExistent.status === 400, 'Login with non-existent email returns HTTP 400', `Status: ${nonExistent.status}`);
  assert(nonExistent.data?.error?.code === 'INVALID_CREDENTIALS', 'Error code is generic INVALID_CREDENTIALS');
  assert(nonExistent.data?.error?.message === wrongPw.data?.error?.message, 'Error message is identical to avoid email enumeration');

  // Test 7: Login as seed ADMIN
  console.log('\n[7/16] Testing Login with Seed ADMIN Credentials...');
  const adminLogin = await post('/auth/login', {
    email: 'admin@bloodai.local',
    password: 'Admin@1234'
  });
  assert(adminLogin.status === 200, 'Admin login returns HTTP 200 OK', `Status: ${adminLogin.status}`);
  assert(adminLogin.data?.success === true, 'Admin login returns success: true');
  assert(typeof adminLogin.data?.data?.token === 'string' && adminLogin.data.data.token.length > 20, 'Admin login returns valid JWT token string');
  assert(adminLogin.data?.data?.user?.role === 'ADMIN', 'Admin user object has role ADMIN');
  assert(!('passwordHash' in (adminLogin.data?.data?.user || {})), 'Admin login does NOT return passwordHash');
  const adminToken = adminLogin.data?.data?.token;

  // Test 8: Login as newly registered STAFF user
  console.log('\n[8/16] Testing Login with Newly Registered User...');
  const staffLogin = await post('/auth/login', {
    email: testEmail,
    password: 'SecurePassword1'
  });
  assert(staffLogin.status === 200, 'Registered staff login returns HTTP 200 OK', `Status: ${staffLogin.status}`);
  assert(staffLogin.data?.data?.user?.role === 'STAFF', 'Staff user object has role STAFF');
  assert(staffLogin.data?.data?.user?.fullName === 'Dr. Emily Stone', 'Staff user object has correct fullName');
  const staffToken = staffLogin.data?.data?.token;

  // Test 9: GET /auth/me with valid ADMIN token
  console.log('\n[9/16] Testing GET /auth/me with Valid ADMIN Token...');
  const meAdmin = await get('/auth/me', adminToken);
  assert(meAdmin.status === 200, 'GET /auth/me with admin token returns HTTP 200 OK');
  assert(meAdmin.data?.data?.email === 'admin@bloodai.local', 'GET /auth/me returns admin email');
  assert(meAdmin.data?.data?.role === 'ADMIN', 'GET /auth/me returns admin role');
  assert(!('passwordHash' in (meAdmin.data?.data || {})), 'GET /auth/me does NOT return passwordHash');

  // Test 10: GET /auth/me with valid STAFF token
  console.log('\n[10/16] Testing GET /auth/me with Valid STAFF Token...');
  const meStaff = await get('/auth/me', staffToken);
  assert(meStaff.status === 200, 'GET /auth/me with staff token returns HTTP 200 OK');
  assert(meStaff.data?.data?.email === testEmail, 'GET /auth/me returns staff email');
  assert(meStaff.data?.data?.role === 'STAFF', 'GET /auth/me returns staff role');

  // Test 11: GET /auth/me WITHOUT token -> 401 AUTH_REQUIRED
  console.log('\n[11/16] Testing GET /auth/me Without Token...');
  const noToken = await get('/auth/me', null);
  assert(noToken.status === 401, 'GET /auth/me without token returns HTTP 401 Unauthorized', `Status: ${noToken.status}`);
  assert(noToken.data?.error?.code === 'AUTH_REQUIRED', 'Error code is AUTH_REQUIRED');

  // Test 12: GET /auth/me with INVALID token -> 401 INVALID_TOKEN
  console.log('\n[12/16] Testing GET /auth/me with Invalid Token...');
  const badToken = await get('/auth/me', 'invalid.jwt.token.string');
  assert(badToken.status === 401, 'GET /auth/me with invalid token returns HTTP 401 Unauthorized', `Status: ${badToken.status}`);
  assert(badToken.data?.error?.code === 'INVALID_TOKEN', 'Error code is INVALID_TOKEN');

  // Test 13: GET /users/me endpoint
  console.log('\n[13/16] Testing GET /users/me Endpoint...');
  const usersMe = await get('/users/me', adminToken);
  assert(usersMe.status === 200, 'GET /users/me with admin token returns HTTP 200 OK');
  assert(usersMe.data?.data?.id === 'usr_admin_01', 'GET /users/me returns correct user ID');

  // Test 14: Role-based Authorization on PUT /api/v1/settings
  console.log('\n[14/16] Testing Role-based Authorization (ADMIN vs STAFF)...');
  // As STAFF -> Must be rejected with 403 FORBIDDEN
  const staffSettingsUpdate = await put('/settings', {
    facilityName: 'Unauthorized Update',
    alertEmailRecipients: ['test@test.com']
  }, staffToken);
  assert(staffSettingsUpdate.status === 403, 'PUT /settings by STAFF returns HTTP 403 Forbidden', `Status: ${staffSettingsUpdate.status}`);
  assert(staffSettingsUpdate.data?.error?.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

  // As ADMIN -> Allowed
  const adminSettingsUpdate = await put('/settings', {
    facilityName: 'Central Transfusion Hub',
    alertEmailRecipients: ['alerts@bloodai.local']
  }, adminToken);
  assert(adminSettingsUpdate.status === 200, 'PUT /settings by ADMIN returns HTTP 200 OK', `Status: ${adminSettingsUpdate.status}`);

  // Test 15: Verify users.json on disk stores ONLY bcrypt hashes
  console.log('\n[15/16] Verifying users.json Storage Integrity...');
  const usersJsonPath = path.resolve('data/users.json');
  const usersRaw = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
  const registeredUserInFile = usersRaw.find(u => u.email === testEmail);
  assert(!!registeredUserInFile, 'New user is persisted in users.json');
  assert(registeredUserInFile.passwordHash.startsWith('$2b$10$'), 'Password in users.json is a valid bcrypt hash');
  assert(!('password' in registeredUserInFile), 'Plaintext password is NEVER saved in users.json');
  const bcryptVerified = await bcrypt.compare('SecurePassword1', registeredUserInFile.passwordHash);
  assert(bcryptVerified === true, 'Stored bcrypt hash accurately verifies against the original password');

  // Test 16: POST /auth/logout flow
  console.log('\n[16/16] Testing POST /auth/logout Flow...');
  const logoutRes = await post('/auth/logout', {}, staffToken);
  assert(logoutRes.status === 200, 'POST /auth/logout returns HTTP 200 OK');
  assert(logoutRes.data?.success === true, 'Logout returns success: true');

  // Print Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('\n========================================');
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log('========================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
