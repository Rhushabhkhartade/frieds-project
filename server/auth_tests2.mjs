const BASE = 'http://localhost:5000/api/v1';
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  return r.json();
}
async function get(path, token) {
  const h = {'Content-Type':'application/json'};
  if(token) h['Authorization']=`Bearer ${token}`;
  return (await fetch(`${BASE}${path}`,{headers:h})).json();
}
async function run() {
  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 2000));
  console.log('=== REMAINING TESTS ===');

  console.log('\n10. LOGIN newly registered user (Test Admin)...');
  const r10 = await post('/auth/login', { email:'testadmin@bloodai.local', password:'Test@1234' });
  console.log('    Success:', r10.success, '| Role:', r10.data?.user?.role, '| Token:', !!r10.data?.token);
  const newToken = r10.data?.token;

  console.log('\n11. Verify /health is intact...');
  const h = await fetch('http://localhost:5000/health').then(r=>r.json());
  console.log('    Status:', h.status);

  console.log('\n12. GET /api/v1/system/status...');
  const s = await get('/system/status', null);
  console.log('    Success:', s.success, '| Storage Ready:', s.data?.storageReady);

  console.log('\n13. Check passwordHash NOT in users.json response...');
  const me = await get('/auth/me', newToken);
  console.log('    Has passwordHash:', 'passwordHash' in (me.data||{}));
  console.log('    Email:', me.data?.email, '| Role:', me.data?.role);

  console.log('\n14. Verify admin@bloodai.local login (seed admin)...');
  const admin = await post('/auth/login', { email:'admin@bloodai.local', password:'Admin@1234' });
  console.log('    Success:', admin.success, '| Role:', admin.data?.user?.role);

  console.log('\n15. Verify staff@bloodai.local login (seed staff)...');
  const staff = await post('/auth/login', { email:'staff@bloodai.local', password:'Staff@1234' });
  console.log('    Success:', staff.success, '| Role:', staff.data?.user?.role);

  console.log('\n=== ALL REMAINING TESTS DONE ===');
}
run().catch(console.error);
