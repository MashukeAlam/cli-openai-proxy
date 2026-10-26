/**
 * test.mjs — Integration test for cli-openai-proxy
 * Tests against agy provider (must have server running on PORT 3000)
 *
 * Run: node test.mjs
 */

const BASE_URL = 'http://localhost:3000';
const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️ ';

let passed = 0;
let failed = 0;

function log(icon, name, detail = '') {
  console.log(`  ${icon} ${name}${detail ? ': ' + detail : ''}`);
}

async function test(name, fn) {
  try {
    await fn();
    log(PASS, name);
    passed++;
  } catch (err) {
    log(FAIL, name, err.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const body = await res.json();
  return { res, body };
}

// ─────────────────────────────────────────────────────────────
console.log('\n🧪 cli-openai-proxy — Integration Tests');
console.log('━'.repeat(45));
console.log(`   Server: ${BASE_URL}\n`);

// ── 1. Health Check ──────────────────────────────────────────
console.log('▶ Health & Info');

await test('GET /health returns ok', async () => {
  const { res, body } = await fetchJSON('/health');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body.status === 'ok', `Expected status ok, got ${body.status}`);
});

await test('GET / returns endpoint list', async () => {
  const { res, body } = await fetchJSON('/');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(Array.isArray(body.endpoints), 'Expected endpoints array');
  assert(body.endpoints.length > 0, 'Expected at least one endpoint');
});

// ── 2. Models ────────────────────────────────────────────────
console.log('\n▶ Models Endpoint');

await test('GET /v1/models returns list', async () => {
  const { res, body } = await fetchJSON('/v1/models');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body.object === 'list', `Expected object=list, got ${body.object}`);
  assert(Array.isArray(body.data), 'Expected data array');
  assert(body.data.length > 0, 'Expected at least one model');
});

await test('GET /v1/models includes agy model', async () => {
  const { body } = await fetchJSON('/v1/models');
  const ids = body.data.map(m => m.id);
  assert(ids.includes('agy'), `'agy' not in models: ${ids.join(', ')}`);
});

await test('GET /v1/models includes gemini models', async () => {
  const { body } = await fetchJSON('/v1/models');
  const ids = body.data.map(m => m.id);
  const hasGemini = ids.some(id => id.startsWith('gemini-'));
  assert(hasGemini, `No gemini-* models found: ${ids.join(', ')}`);
});

// ── 3. Validation ────────────────────────────────────────────
console.log('\n▶ Request Validation');

await test('POST /v1/chat/completions with no messages → 400', async () => {
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'agy', messages: [] }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(body.error, 'Expected error object');
});

await test('POST /v1/chat/completions with missing messages field → 400', async () => {
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'agy' }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(body.error, 'Expected error object');
});

// ── 4. agy Non-Streaming ─────────────────────────────────────
console.log('\n▶ agy Provider — Non-Streaming');

await test('POST /v1/chat/completions (model=agy) returns valid response', async () => {
  console.log('      ⏳ Calling agy CLI... (may take a few seconds)');
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'agy',
      messages: [{ role: 'user', content: 'Reply with exactly: HELLO_TEST' }],
    }),
  });
  assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(body)}`);
  assert(body.object === 'chat.completion', `Expected object=chat.completion, got ${body.object}`);
  assert(body.id?.startsWith('chatcmpl-'), `Expected id starting with chatcmpl-, got ${body.id}`);
  assert(Array.isArray(body.choices) && body.choices.length > 0, 'Expected choices array');
  const content = body.choices[0]?.message?.content;
  assert(typeof content === 'string' && content.length > 0, 'Expected non-empty content');
  console.log(`      💬 Response: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
});

await test('POST /v1/chat/completions (model=gemini-2.0-flash) routes to agy', async () => {
  console.log('      ⏳ Calling agy CLI via gemini-2.0-flash alias...');
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
    }),
  });
  assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(body)}`);
  assert(body.model === 'gemini-2.0-flash', `Expected model=gemini-2.0-flash, got ${body.model}`);
  const content = body.choices[0]?.message?.content;
  assert(typeof content === 'string' && content.length > 0, 'Expected non-empty content');
  console.log(`      💬 Response: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
});

await test('System + user messages are combined correctly', async () => {
  console.log('      ⏳ Calling agy with system message...');
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'agy',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always be concise.' },
        { role: 'user', content: 'What is 2 + 2?' },
      ],
    }),
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const content = body.choices[0]?.message?.content;
  assert(typeof content === 'string' && content.length > 0, 'Expected non-empty content');
  console.log(`      💬 Response: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
});

// ── 5. agy Streaming ─────────────────────────────────────────
console.log('\n▶ agy Provider — Streaming (SSE)');

await test('POST /v1/chat/completions stream=true returns SSE chunks', async () => {
  console.log('      ⏳ Streaming from agy CLI...');
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'agy',
      stream: true,
      messages: [{ role: 'user', content: 'Count from 1 to 3, one number per line.' }],
    }),
  });

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(
    res.headers.get('content-type')?.includes('text/event-stream'),
    `Expected text/event-stream, got ${res.headers.get('content-type')}`
  );

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let rawText = '';
  let chunks = 0;
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (value) {
      rawText += decoder.decode(value, { stream: true });
    }
  }

  const lines = rawText.split('\n').filter(l => l.startsWith('data:'));
  const hasDone = lines.some(l => l.trim() === 'data: [DONE]');
  const dataLines = lines.filter(l => l.trim() !== 'data: [DONE]');
  chunks = dataLines.length;

  assert(chunks > 0, 'Expected at least one SSE data chunk');
  assert(hasDone, 'Expected [DONE] terminator');

  // Parse first content chunk
  const firstContent = dataLines.find(l => {
    try { return JSON.parse(l.slice(5)).choices[0].delta.content; } catch { return false; }
  });
  assert(firstContent, 'Expected at least one chunk with content delta');

  let collectedContent = '';
  for (const line of dataLines) {
    try {
      const parsed = JSON.parse(line.slice(5));
      collectedContent += parsed.choices?.[0]?.delta?.content ?? '';
    } catch { /* skip role-only chunk */ }
  }

  console.log(`      📡 Received ${chunks} SSE chunks`);
  console.log(`      💬 Collected: "${collectedContent.slice(0, 100)}${collectedContent.length > 100 ? '...' : ''}"`);
});

// ── Summary ──────────────────────────────────────────────────
console.log('\n' + '━'.repeat(45));
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('  🎉 All tests passed!\n');
} else {
  console.log(`  ⚠️  ${failed} test(s) failed — check output above\n`);
  process.exit(1);
}
