import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeApi } from '../packages/runtime-api/index.js';

function fakeRuntime() {
  return {
    async process(body) { return { event: { id: body.id ?? 'evt' } }; },
    getState() { return { eventCount: 1 }; },
    queryMemory() { return { episodes: [], facts: [] }; },
    addSemanticFact(fact) {
      return fact.value === 'conflict'
        ? { action: 'conflict_pending', fact }
        : { action: 'inserted', fact };
    }
  };
}

test('runtime API processes turns and exposes state', async () => {
  const api = createRuntimeApi(fakeRuntime());
  assert.equal((await api({ method: 'POST', path: '/v1/turns', body: { id: 'e1', text: 'hello' } })).status, 200);
  assert.equal((await api({ method: 'GET', path: '/v1/state' })).body.eventCount, 1);
});

test('runtime API exposes memory query and semantic conflict status', async () => {
  const api = createRuntimeApi(fakeRuntime());
  assert.equal((await api({ method: 'POST', path: '/v1/memory/query', body: {} })).status, 200);
  assert.equal((await api({ method: 'POST', path: '/v1/semantic-facts', body: { fact: { value: 'conflict' } } })).status, 409);
});

test('runtime API returns 404 for unknown route', async () => {
  const api = createRuntimeApi(fakeRuntime());
  assert.equal((await api({ method: 'GET', path: '/unknown' })).status, 404);
});
