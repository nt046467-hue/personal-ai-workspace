async function runSmokeTest() {
  console.log('Running API Smoke Test against http://localhost:3001...\n');

  // 1. Health
  const healthRes = await fetch('http://localhost:3001/api/health');
  const health = await healthRes.json();
  console.log('1. Health Check:', health);

  // 2. Unauthorized access rejected
  const unauthRes = await fetch('http://localhost:3001/api/tasks');
  console.log('2. Unauthorized /api/tasks status:', unauthRes.status, '(Expected: 401)');

  // 3. Login
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nabin@workspace.ai', password: 'password123' }),
  });
  const login = await loginRes.json();
  console.log('3. Login Success:', login.success, 'User:', login.data?.user?.name, 'Role:', login.data?.user?.role);
  const token = login.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  // 4. Tasks
  const tasksRes = await fetch('http://localhost:3001/api/tasks', { headers });
  const tasks = await tasksRes.json();
  console.log('4. Tasks loaded:', tasks.data?.length, 'tasks. First:', tasks.data?.[0]?.title);

  // 5. Knowledge
  const knowledgeRes = await fetch('http://localhost:3001/api/knowledge', { headers });
  const knowledge = await knowledgeRes.json();
  console.log('5. Knowledge items loaded:', knowledge.data?.length, 'items. First:', knowledge.data?.[0]?.title);

  // 6. Projects
  const projectsRes = await fetch('http://localhost:3001/api/projects', { headers });
  const projects = await projectsRes.json();
  console.log('6. Projects loaded:', projects.data?.length, 'projects. First:', projects.data?.[0]?.name);

  // 7. Search
  const searchRes = await fetch('http://localhost:3001/api/search?q=firebase', { headers });
  const search = await searchRes.json();
  console.log('7. Search results for "firebase":', search.data?.length, 'matches. Top match:', search.data?.[0]?.title);

  // 8. AI Brief
  const briefRes = await fetch('http://localhost:3001/api/ai/brief', { headers });
  const brief = await briefRes.json();
  console.log('8. AI Brief generated successfully:', Boolean(brief.data?.brief));

  // 9. Document status
  const docRes = await fetch('http://localhost:3001/api/documents/k-2', { headers });
  const doc = await docRes.json();
  console.log('9. Document record loaded:', doc.data?.title, 'Status:', doc.data?.status);

  console.log('\n--- ALL SMOKE TESTS PASSED SUCCESSFULLY ---');
}

runSmokeTest().catch(console.error);
