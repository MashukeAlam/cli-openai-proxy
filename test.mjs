/**
 * test.mjs — Integration test for cli-openai-proxy
 * Tests against agy provider and API key authentication
 *
 * Run: node test.mjs
 */

const BASE_URL = 'http://localhost:3000';
const VALID_KEY = 'sk-test-key-1';
const INVALID_KEY = 'sk-invalid-test-key';

const PASS = '✅';
const FAIL = '❌';

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

// ── 1. Health & Public Endpoints ─────────────────────────────
console.log('▶ Health & Public Info');

await test('GET /health returns ok without API key', async () => {
  const { res, body } = await fetchJSON('/health');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body.status === 'ok', `Expected status ok, got ${body.status}`);
});

await test('GET / returns endpoint list without API key', async () => {
  const { res, body } = await fetchJSON('/');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(Array.isArray(body.endpoints), 'Expected endpoints array');
  assert(body.endpoints.length > 0, 'Expected at least one endpoint');
});

// ── 2. Authentication Enforcement ────────────────────────────
console.log('\n▶ API Key Authentication');

await test('GET /v1/models without auth header → 401', async () => {
  const { res, body } = await fetchJSON('/v1/models');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  assert(body.error?.code === 'missing_api_key', `Expected missing_api_key, got ${body.error?.code}`);
});

await test('GET /v1/models with invalid key → 401', async () => {
  const { res, body } = await fetchJSON('/v1/models', {
    headers: { Authorization: `Bearer ${INVALID_KEY}` },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  assert(body.error?.code === 'invalid_api_key', `Expected invalid_api_key, got ${body.error?.code}`);
});

await test('GET /v1/models with valid CSV key (sk-test-key-1) → 200', async () => {
  const { res, body } = await fetchJSON('/v1/models', {
    headers: { Authorization: `Bearer ${VALID_KEY}` },
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body.object === 'list', `Expected object=list, got ${body.object}`);
});

await test('GET /v1/models with secondary CSV key (sk-test-key-2) → 200', async () => {
  const { res, body } = await fetchJSON('/v1/models', {
    headers: { Authorization: `Bearer sk-test-key-2` },
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body.object === 'list', `Expected object=list, got ${body.object}`);
});

// ── 3. Models Endpoint ───────────────────────────────────────
console.log('\n▶ Models Content Verification');

await test('GET /v1/models includes agy model', async () => {
  const { body } = await fetchJSON('/v1/models', {
    headers: { Authorization: `Bearer ${VALID_KEY}` },
  });
  const ids = body.data.map((m) => m.id);
  assert(ids.includes('agy'), `'agy' not in models: ${ids.join(', ')}`);
});

await test('GET /v1/models includes gemini models', async () => {
  const { body } = await fetchJSON('/v1/models', {
    headers: { Authorization: `Bearer ${VALID_KEY}` },
  });
  const ids = body.data.map((m) => m.id);
  const hasGemini = ids.some((id) => id.startsWith('gemini-'));
  assert(hasGemini, `No gemini-* models found: ${ids.join(', ')}`);
});

// ── 4. Request Validation ────────────────────────────────────
console.log('\n▶ Request Validation');

await test('POST /v1/chat/completions without API key → 401', async () => {
  const { res } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'agy', messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('POST /v1/chat/completions with empty messages → 400', async () => {
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_KEY}`,
    },
    body: JSON.stringify({ model: 'agy', messages: [] }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(body.error, 'Expected error object');
});

// ── 5. agy Non-Streaming ─────────────────────────────────────
console.log('\n▶ agy Provider — Non-Streaming with Auth');

await test('POST /v1/chat/completions (model=agy) returns valid response', async () => {
  console.log('      ⏳ Calling agy CLI with valid API key...');
  const { res, body } = await fetchJSON('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_KEY}`,
    },
    body: JSON.stringify({
      model: 'agy',
      messages: [{ role: 'user', content: 'Reply with exactly: HELLO_AUTH' }],
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

// ── 6. agy Streaming ─────────────────────────────────────────
console.log('\n▶ agy Provider — Streaming (SSE) with Auth');

await test('POST /v1/chat/completions stream=true returns SSE chunks', async () => {
  console.log('      ⏳ Streaming from agy CLI with valid API key...');
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_KEY}`,
    },
    body: JSON.stringify({
      model: 'agy',
      stream: true,
      messages: [{ role: 'user', content: 'Say A then B on separate lines.' }],
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
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (value) {
      rawText += decoder.decode(value, { stream: true });
    }
  }

  const lines = rawText.split('\n').filter((l) => l.startsWith('data:'));
  const hasDone = lines.some((l) => l.trim() === 'data: [DONE]');
  const dataLines = lines.filter((l) => l.trim() !== 'data: [DONE]');

  assert(dataLines.length > 0, 'Expected at least one SSE data chunk');
  assert(hasDone, 'Expected [DONE] terminator');

  let collectedContent = '';
  for (const line of dataLines) {
    try {
      const parsed = JSON.parse(line.slice(5));
      collectedContent += parsed.choices?.[0]?.delta?.content ?? '';
    } catch {
      /* skip */
    }
  }

  console.log(`      📡 Received ${dataLines.length} SSE chunks`);
  console.log(`      💬 Collected: "${collectedContent.trim()}"`);
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
