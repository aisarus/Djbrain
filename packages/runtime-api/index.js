export function createRuntimeApi(runtime, options = {}) {
  if (!runtime) throw new TypeError('runtime is required');
  const responseRuntime = options.responseRuntime ?? null;
  const speechSimulationRuntime = options.speechSimulationRuntime ?? null;
  const traceStore = options.traceStore ?? null;

  return async function handle(request) {
    const method = request.method ?? 'GET';
    const path = request.path ?? '/';
    const body = request.body ?? {};

    try {
      if (method === 'POST' && path === '/v1/speech/simulate') {
        if (!speechSimulationRuntime) return response(503, { error: 'speech_simulation_runtime_not_configured' });
        const result = await speechSimulationRuntime.simulate(body.message ?? body.event ?? body, {
          participantIds: body.participantIds, relationshipMode: body.relationshipMode, channel: body.channel,
          conversationWindow: body.conversationWindow, privacyContext: body.privacyContext,
          memoryBudget: body.memoryBudget, mode: body.mode
        });
        return response(result.deliveryStatus === 'delivered' ? 200 : 422, result);
      }
      if (method === 'POST' && path === '/v1/turns') {
        return response(200, await runtime.process(body));
      }
      if (method === 'POST' && path === '/v1/respond') {
        if (!responseRuntime) return response(503, { error: 'response_runtime_not_configured' });
        const result = await responseRuntime.respond(body.input ?? body, {
          runId: body.runId,
          privacyContext: body.privacyContext,
          personIds: body.personIds,
          contextTags: body.contextTags,
          relationshipMode: body.relationshipMode,
          includeSensitiveRelationships: body.includeSensitiveRelationships,
          allowCandidateIdentity: body.allowCandidateIdentity,
          identityLimit: body.identityLimit,
          relationshipLimit: body.relationshipLimit,
          procedureLimit: body.procedureLimit,
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
        const result = await runtime.addSemanticFact(body.fact, body.policy);
        return response(result.action === 'conflict_pending' ? 409 : 201, result);
      }
      if (method === 'POST' && path === '/v1/temporal-states') {
        const result = await runtime.addTemporalState(body.record ?? body);
        return response(result.conflicts?.length ? 409 : 201, result);
      }
      if (method === 'GET' && path === '/v1/temporal-states/current') {
        const query = request.query ?? {};
        if (!query.subject || !query.stateType) return response(400, { error: 'subject_and_stateType_required' });
        return response(200, {
          record: runtime.resolveTemporalState(query.subject, query.stateType, query.at)
        });
      }
      if (method === 'GET' && path === '/v1/traces') {
        if (!traceStore) return response(503, { error: 'trace_store_not_configured' });
        const { records, errors } = await traceStore.readAll();
        if (errors.length) return response(500, { error: 'trace_store_corrupt', details: errors });
        const limit = Math.max(1, Math.min(100, Number(request.query?.limit ?? 20)));
        return response(200, { traces: records.slice(-limit).reverse(), count: records.length });
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
