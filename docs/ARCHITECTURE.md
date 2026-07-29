# Speech Twin architecture v1

The primary path is `message → situation → relationship → uncertain internal state → privacy-filtered memory activation → intent → content plan → speech plan → realization → critic → utterance`.

`SpeechSimulationRuntime` is the primary orchestration entry point. `createInMemorySpeechTwinSystem` and `createLocalSpeechTwinSystem` preserve the existing working, episodic, semantic and temporal memory stores, provenance-bearing trace store, identity core, relationship registry and privacy filter. Memory activation is deliberately separate from explicit disclosure; traces contain opaque IDs and decisions, never raw private evidence or private chain-of-thought.

`ResponseRuntime` remains a legacy compatibility interface for prior action-oriented experiments. It is not used by `/v1/speech/simulate`.

The deterministic realizer is a test baseline, not a claim of psychological fidelity. Internal-state values are probabilistic hypotheses and raise uncertainty for ambiguous context. External providers are optional and are never called by deterministic tests.
