import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeApi } from '../packages/runtime-api/index.js';

test('returns 503 when response runtime is not configured', async () => {
  const runtime = { process: async () => ({}), getState: () => ({}), queryMemory: async () => ([]), addSemanticFact: () => ({ action: 'created' }) };
  const api = createRuntimeApi(runtime);
  const result = await api({ method: 'POST', path: '/v1/respond', body: { input: 'hello' } });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'response_runtime_not_configured');
});

test('returns full response runtime result', async () => {
  const runtime = { process: async () => ({}), getState: () => ({}), queryMemory: async () => ([]), addSemanticFact: () => ({ action: 'created' }) };
  const responseRuntime = {
    async respond(input, options) {
      return {
        delivered: true,
        response: `processed:${input}`,
        options,
        critic: { status: 'approved' }
      };
    }
  };
  const api = createRuntimeApi(runtime, { responseRuntime });
  const result = await api({
    method: 'POST',
    path: '/v1/respond',
    body: {
      input: 'build brain',
      privacyContext: { allowedSensitivity: 'private' },
      maxMemoryItems: 4
    }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.response, 'processed:build brain');
  assert.equal(result.body.options.maxMemoryItems, 4);
  assert.equal(result.headers['cache-control'], 'no-store');
});

test('maps rejected response to 422 and runtime exception to 500', async () => {
  const runtime = { process: async () => ({}), getState: () => ({}), queryMemory: async () => ([]), addSemanticFact: () => ({ action: 'created' }) };
  let responseRuntime = { async respond() { return { delivered: false, critic: { status: 'rejected' } }; } };
  let api = createRuntimeApi(runtime, { responseRuntime });
  assert.equal((await api({ method: 'POST', path: '/v1/respond', body: {} })).status, 422);

  responseRuntime = { async respond() { throw new Error('provider_failed'); } };
  api = createRuntimeApi(runtime, { responseRuntime });
  const failed = await api({ method: 'POST', path: '/v1/respond', body: {} });
  assert.equal(failed.status, 500);
  assert.equal(failed.body.message, 'provider_failed');
});
