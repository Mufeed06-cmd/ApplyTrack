const assert = require('assert');
const pool = require('../src/config/db');

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function runTests() {
  console.log('🚀 Starting ApplyTrack API Integration Test Suite...\n');
  const timestamp = Date.now();
  const userA = { username: `user_a_${timestamp}`, password: 'password123' };
  const userB = { username: `user_b_${timestamp}`, password: 'securepass456' };

  let tokenA = null;
  let tokenB = null;
  let appIdA1 = null;
  let appIdA2 = null;

  try {
    // 1. Health check
    console.log('Test 1: Health check endpoint');
    const health = await request('/health');
    assert.strictEqual(health.status, 200, 'Health check should return 200');
    assert.strictEqual(health.body.status, 'ok');
    console.log('  ✔ Passed');

    // 2. Registration validation - short password
    console.log('Test 2: Register validation - password too short');
    const invalidReg = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: userA.username, password: '123' }),
    });
    assert.strictEqual(invalidReg.status, 400);
    assert.ok(invalidReg.body.error);
    console.log('  ✔ Passed');

    // 3. Successful Registration (User A)
    console.log('Test 3: Register User A successfully');
    const regA = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userA),
    });
    assert.strictEqual(regA.status, 201);
    assert.ok(regA.body.token, 'Should return JWT token');
    assert.strictEqual(regA.body.user.username, userA.username);
    assert.strictEqual(regA.body.user.password, undefined, 'Never expose password');
    tokenA = regA.body.token;
    console.log('  ✔ Passed');

    // 4. Duplicate Registration
    console.log('Test 4: Reject duplicate username registration');
    const dupReg = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userA),
    });
    assert.strictEqual(dupReg.status, 409, 'Duplicate username should return 409 Conflict');
    console.log('  ✔ Passed');

    // 5. Login User A
    console.log('Test 5: Login with valid credentials');
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(userA),
    });
    assert.strictEqual(loginA.status, 200);
    assert.ok(loginA.body.token);
    tokenA = loginA.body.token;
    console.log('  ✔ Passed');

    // 6. Login with invalid password
    console.log('Test 6: Reject login with incorrect password');
    const badLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: userA.username, password: 'wrongpassword' }),
    });
    assert.strictEqual(badLogin.status, 401);
    console.log('  ✔ Passed');

    // 7. Register User B
    console.log('Test 7: Register User B');
    const regB = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userB),
    });
    assert.strictEqual(regB.status, 201);
    tokenB = regB.body.token;
    console.log('  ✔ Passed');

    // 8. Auth Profile Check (/api/auth/me)
    console.log('Test 8: Current user profile (/api/auth/me)');
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.username, userA.username);
    console.log('  ✔ Passed');

    // 9. Unauthorized request without token
    console.log('Test 9: Reject unauthenticated request to /api/applications');
    const unauthRes = await request('/applications');
    assert.strictEqual(unauthRes.status, 401);
    console.log('  ✔ Passed');

    // 10. User A creates Application 1
    console.log('Test 10: User A creates Application 1 (Google, Applied)');
    const createRes1 = await request('/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        company: 'Google',
        role: 'Full Stack Engineer',
        link: 'https://careers.google.com/jobs/results/1234',
        status: 'Applied',
        applied_date: '2026-10-25',
        notes: 'Applied through company portal',
      }),
    });
    assert.strictEqual(createRes1.status, 201);
    assert.strictEqual(createRes1.body.application.company, 'Google');
    assert.strictEqual(createRes1.body.application.status, 'Applied');
    appIdA1 = createRes1.body.application.id;
    console.log('  ✔ Passed');

    // 11. User A creates Application 2 (Microsoft, Interview)
    console.log('Test 11: User A creates Application 2 (Microsoft, Interview)');
    const createRes2 = await request('/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        company: 'Microsoft',
        role: 'Azure DevOps Specialist',
        link: 'https://careers.microsoft.com/jobs/5678',
        status: 'Interview',
        applied_date: '2026-10-18',
        interview_date: '2026-10-29',
        notes: 'First round technical scheduled',
      }),
    });
    assert.strictEqual(createRes2.status, 201);
    appIdA2 = createRes2.body.application.id;
    console.log('  ✔ Passed');

    // 12. List applications for User A
    console.log('Test 12: User A lists applications (total = 2)');
    const listA = await request('/applications', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(listA.status, 200);
    assert.strictEqual(listA.body.applications.length, 2);
    console.log('  ✔ Passed');

    // 13. Filter by Status for User A
    console.log('Test 13: Filter User A applications by status=Interview');
    const filterRes = await request('/applications?status=Interview', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(filterRes.status, 200);
    assert.strictEqual(filterRes.body.applications.length, 1);
    assert.strictEqual(filterRes.body.applications[0].company, 'Microsoft');
    console.log('  ✔ Passed');

    // 14. Search applications for User A
    console.log('Test 14: Search User A applications by keyword "Google"');
    const searchRes = await request('/applications?search=Google', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.applications.length, 1);
    assert.strictEqual(searchRes.body.applications[0].company, 'Google');
    console.log('  ✔ Passed');

    // 15. User A retrieves single application by ID
    console.log('Test 15: User A retrieves Application 1 by ID');
    const getSingleRes = await request(`/applications/${appIdA1}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(getSingleRes.status, 200);
    assert.strictEqual(getSingleRes.body.application.id, appIdA1);
    console.log('  ✔ Passed');

    // 16. User A updates Application 1
    console.log('Test 16: User A updates Application 1 status to "Offer"');
    const updateRes = await request(`/applications/${appIdA1}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        status: 'Offer',
        notes: 'Received written offer!',
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.application.status, 'Offer');
    assert.strictEqual(updateRes.body.application.notes, 'Received written offer!');
    console.log('  ✔ Passed');

    // 17. User Isolation: User B list should be empty
    console.log('Test 17: User Isolation - User B list is empty');
    const listB = await request('/applications', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(listB.status, 200);
    assert.strictEqual(listB.body.applications.length, 0);
    console.log('  ✔ Passed');

    // 18. User Isolation: User B cannot GET User A application
    console.log('Test 18: User Isolation - User B cannot GET User A application');
    const crossGet = await request(`/applications/${appIdA1}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(crossGet.status, 404, 'Must return 404 Not Found to prevent data leak');
    console.log('  ✔ Passed');

    // 19. User Isolation: User B cannot UPDATE User A application
    console.log('Test 19: User Isolation - User B cannot UPDATE User A application');
    const crossUpdate = await request(`/applications/${appIdA1}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ company: 'Malicious Overwrite' }),
    });
    assert.strictEqual(crossUpdate.status, 404);
    console.log('  ✔ Passed');

    // 20. User Isolation: User B cannot DELETE User A application
    console.log('Test 20: User Isolation - User B cannot DELETE User A application');
    const crossDelete = await request(`/applications/${appIdA1}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(crossDelete.status, 404);
    console.log('  ✔ Passed');

    // 21. User A deletes Application 2
    console.log('Test 21: User A deletes own Application 2');
    const delRes = await request(`/applications/${appIdA2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.id, appIdA2);
    console.log('  ✔ Passed');

    // 22. Verify Application 2 is gone
    console.log('Test 22: Verify deleted Application 2 returns 404');
    const verifyDel = await request(`/applications/${appIdA2}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(verifyDel.status, 404);
    console.log('  ✔ Passed');

    // 23. Direct Database Persistence Check
    console.log('Test 23: Direct SQL database verification');
    const [dbRows] = await pool.execute('SELECT * FROM applications WHERE id = ?', [appIdA1]);
    assert.strictEqual(dbRows.length, 1);
    assert.strictEqual(dbRows[0].company, 'Google');
    assert.strictEqual(dbRows[0].status, 'Offer');
    console.log('  ✔ Passed');

    console.log('\n🎉 ALL 23 INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
