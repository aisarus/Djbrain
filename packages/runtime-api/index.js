export function createRuntimeApi(runtime, options = {}) {
  if (!runtime) throw new TypeError('runtime is required');
  const responseRuntime = options.responseRuntime ?? null;

  return async function handle(request) {
    const method = request.method ?? 'GET';
    const path = request.path ?? '/';
    const body = request.body ?? {};

    try {
      if (method === 'POST' && path === '/v1/turns') {
        return response(200, await runtime.process(body));
      }
      if (method === 'POST' && path === '/v1/respond') {
        if (!responseRuntime) return response(503, { error: 'response_runtime_not_configured' });
        const result = await responseRuntime.respond(body.input ?? body, {
          privacyContext: body.privacyContext,
          maxMemoryItems: body.maxMemoryItems,
          maxContextChars: body.maxContextChars
        });
        return response(result.delivered === false ? 422 : 200, result);
      }
      if (method === 'GET' && path === '/v1/state') {
        return response(200, runtime.getState());
      }
      if (method === 'POST' && path === '/v1/memory/query') {
        return response(200, await runtime.queryMemory(body));
      }
      if (method === 'POST' && path === '/v1/semantic-facts') {
        const result = runtime.addSemanticFact(body.fact, body.policy);
        return response(result.action === 'conflict_pending' ? 409 : 201, result);
      }
      return response(404, { error: 'not_found', method, path });
    } catch (error) {
      return response(500, {
        error: 'runtime_error',
        code: error.code ?? null,
        message: error.message
      });
    }
  };
}

function response(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    },
    body
  };
}
