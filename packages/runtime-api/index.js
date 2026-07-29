export function createRuntimeApi(runtime) {
  if (!runtime) throw new TypeError('runtime is required');

  return async function handle(request) {
    const method = request.method ?? 'GET';
    const path = request.path ?? '/';
    const body = request.body ?? {};

    if (method === 'POST' && path === '/v1/turns') {
      return response(200, await runtime.process(body));
    }
    if (method === 'GET' && path === '/v1/state') {
      return response(200, runtime.getState());
    }
    if (method === 'POST' && path === '/v1/memory/query') {
      return response(200, runtime.queryMemory(body));
    }
    if (method === 'POST' && path === '/v1/semantic-facts') {
      const result = runtime.addSemanticFact(body.fact, body.policy);
      return response(result.action === 'conflict_pending' ? 409 : 201, result);
    }
    return response(404, { error: 'not_found', method, path });
  };
}

function response(status, body) {
  return { status, headers: { 'content-type': 'application/json' }, body };
}
