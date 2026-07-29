# Codex Mission — Speech Twin v1 Migration

## Read this first

Work in repository `aisarus/Djbrain`.

The project scope has changed. Djbrain is **not primarily a task agent**. The primary product is a system that simulates the speech behavior of a specific person.

The target behavior is:

> Given a conversational situation, relationship context, current personal state and relevant memory, generate what this person would most likely choose to say and how this person would most likely say it.

Read `docs/ROADMAP.md` before changing code. Treat it as the authoritative product specification.

## Execution mode

Do not stop after creating interfaces, empty packages, TODO files or one test per module.

Continue through the entire mission until one of these conditions is true:

1. all required deliverables are implemented and tests pass;
2. a concrete external blocker prevents progress;
3. a product decision cannot be inferred from this document or the roadmap.

A large amount of small committed scaffolding is not completion.

Prefer one coherent branch and a pull request over dozens of unrelated direct commits.

Recommended branch:

```text
codex/speech-twin-v1
```

## Current repository state

Useful existing infrastructure includes:

- `packages/perception/`
- `packages/working-memory/`
- `packages/episodic-memory/`
- `packages/semantic-memory/`
- `packages/temporal-state/`
- `packages/relationship-model/`
- `packages/identity-core/`
- `packages/procedural-memory/`
- `packages/hybrid-retrieval/`
- `packages/privacy/`
- `packages/context-assembler/`
- `packages/language-provider/`
- `packages/provider-adapters/`
- `packages/critic/`
- `packages/observability/`
- `packages/ingestion/`
- `packages/benchmark-harness/`
- `packages/memory-runtime/`
- `packages/response-runtime/`
- `packages/cognitive-system/`
- `packages/runtime-api/`

Do not delete useful persistence, privacy, temporal, provenance or retrieval behavior merely because the upper architecture changes.

## Main architectural correction

The current response path is too task-oriented:

```text
request
→ choose action
→ perform action
→ report
```

Replace the central path with:

```text
message
→ situation interpretation
→ relationship resolution
→ internal-state hypothesis
→ memory and identity activation
→ communicative-intent selection
→ content planning
→ speech planning
→ person-specific realization
→ speech-behavior critic
→ utterance
```

Action execution may remain as a secondary behavior, but it must not define the central abstraction.

## Mission scope

Implement the complete deterministic Speech Twin v1 vertical slice and preserve the reusable memory foundation.

This mission is not full corpus ingestion and not fine-tuning.

## Required deliverable 1 — Versioned speech behavior contracts

Create versioned contracts under `packages/contracts/` or a new clearly named contract package.

Required objects:

### `ConversationSituation`

Required fields:

- `schemaVersion`
- `id`
- `timestamp`
- `participantIds`
- `relationshipMode`
- `channel`
- `topic`
- `explicitRequest`
- `impliedRequest`
- `socialStakes`
- `conflictLevel`
- `ambiguity`
- `audience`
- `historyRefs`
- `confidence`
- `evidenceRefs`

### `InternalStateHypothesis`

Required fields:

- `schemaVersion`
- `situationId`
- `valence`
- `arousal`
- `irritation`
- `interest`
- `trust`
- `vulnerability`
- `certainty`
- `playfulness`
- `defensiveness`
- `cognitiveMode`
- `alternativeHypotheses`
- `confidence`
- `supportingEvidenceRefs`
- `counterEvidenceRefs`

Internal state values are hypotheses. Never encode them as certain facts.

### `CommunicativeIntent`

Required fields:

- `schemaVersion`
- `situationId`
- `primaryIntent`
- `secondaryIntents`
- `targetEffect`
- `stance`
- `disclosureLevel`
- `continuationPreference`
- `confidence`
- `evidenceRefs`

Supported initial intents must include at least:

- `answer_directly`
- `think_aloud`
- `challenge`
- `correct`
- `provoke`
- `reassure`
- `seek_validation`
- `create_closeness`
- `distance`
- `entertain`
- `express_irritation`
- `show_uncertainty`
- `test_interlocutor`
- `end_topic`
- `continue_interaction`
- `refuse`
- `avoid_answering`

### `ContentPlan`

Required fields:

- `schemaVersion`
- `situationId`
- `claims`
- `memoryRefs`
- `stance`
- `omissions`
- `uncertaintyLevel`
- `emotionalPayload`
- `expectedEffect`

### `SpeechPlan`

Required fields:

- `schemaVersion`
- `situationId`
- `language`
- `targetLength`
- `sentenceShape`
- `rhythm`
- `directness`
- `profanityLevel`
- `profanityFunction`
- `humorMode`
- `hedging`
- `repetition`
- `selfCorrection`
- `punctuationMode`
- `codeSwitching`
- `openingMode`
- `closingMode`

### `UtteranceFeatures`

Required fields:

- `schemaVersion`
- `utteranceId`
- `characterCount`
- `tokenCount`
- `sentenceCount`
- `averageClauseLength`
- `punctuationCounts`
- `profanityDensity`
- `questionCount`
- `imperativeCount`
- `parentheticalCount`
- `repetitionScore`
- `codeSwitching`
- `discourseMarkers`

Every contract must have:

- a constructor or normalizer;
- validation;
- tests for valid and invalid objects;
- no dependency on paid APIs.

## Required deliverable 2 — New speech simulation modules

Create these packages or equivalent clearly named modules:

```text
packages/situation-interpreter/
packages/internal-state-model/
packages/communicative-intent/
packages/content-planner/
packages/speech-planner/
packages/voice-realizer/
packages/speech-behavior-critic/
packages/speech-simulation-runtime/
```

### Situation Interpreter

Input:

- cognitive event;
- recent working memory;
- optional relationship scope;
- recent conversation window.

Output:

- `ConversationSituation`.

It must distinguish at least:

- question;
- correction;
- praise;
- disagreement;
- pressure;
- playful provocation;
- emotional disclosure;
- ordinary small talk;
- request for factual information;
- request for validation;
- topic ending;
- topic continuation.

### Internal State Model

Produce a ranked or probabilistic hypothesis, not a single unquestionable label.

It must increase uncertainty for:

- possible irony;
- quotations;
- mixed signals;
- insufficient relationship context;
- short ambiguous utterances.

### Communicative Intent Selector

Choose what the person is trying to accomplish socially and conversationally.

Do not map every request to `perform_action`.

Examples:

- irritation may produce `correct` plus `express_irritation`;
- praise may produce `create_closeness`, `entertain` or `distance` depending on context;
- a factual question may still produce `think_aloud` if that is the person's likely behavior;
- an unknown answer may produce `show_uncertainty`, not fabricated certainty.

### Content Planner

Select:

- what to say;
- what not to say;
- what memories may influence the response;
- which memories may be explicitly mentioned;
- stance and uncertainty.

Memory influence and memory disclosure must be separate decisions.

### Speech Planner

Translate behavioral patterns into an explicit plan for wording.

Do not hardcode profanity or slang as universal personality markers.

Profanity must have a contextual function such as:

- emphasis;
- irritation;
- intimacy;
- humor;
- disbelief;
- rhythm.

### Voice Realizer

Implement a deterministic test realizer first.

It should produce visibly different realizations for different speech plans without becoming a caricature.

Keep a provider-neutral path for a strong model.

### Speech Behavior Critic

Check at least:

- communicative-intent alignment;
- contradiction with the content plan;
- unsupported autobiographical references;
- relationship-scope violations;
- excessive profanity relative to plan;
- excessive repetition;
- answer too polished or generic for the selected plan;
- task-agent leakage such as unsolicited project reporting;
- false certainty;
- caricature markers;
- privacy leakage.

Return repair instructions when possible.

## Required deliverable 3 — `SpeechSimulationRuntime`

Create a complete runtime that orchestrates:

```text
perception
→ working memory
→ situation interpreter
→ relationship context
→ internal state
→ memory and identity activation
→ communicative intent
→ content plan
→ speech plan
→ voice realization or provider generation
→ speech critic
→ optional repair
→ trace persistence
```

Requirements:

- deterministic mode for tests;
- provider-neutral generation mode;
- inspectable structured trace;
- no private chain-of-thought exposure;
- duplicate event handling;
- memory retrieval only when relevant;
- explicit relationship scope;
- bounded context;
- privacy filtering before generation;
- output includes final utterance plus diagnostic structured objects.

Do not remove the old response runtime until migration tests prove that reusable behavior is preserved. Mark the old runtime as legacy or secondary if necessary.

## Required deliverable 4 — Cognitive system integration

Update `packages/cognitive-system/` so it can construct:

- in-memory Speech Twin system;
- local persistent Speech Twin system;
- deterministic provider configuration;
- external provider configuration;
- identity, relationship and procedure seeds;
- trace storage;
- semantic and temporal persistence.

Expose a clear primary constructor such as:

```js
createInMemorySpeechTwinSystem()
createLocalSpeechTwinSystem()
```

Compatibility wrappers may remain, but documentation should identify the Speech Twin constructor as primary.

## Required deliverable 5 — API

Add an end-to-end route:

```text
POST /v1/speech/simulate
```

Input should support:

- message text or cognitive event;
- participant IDs;
- relationship mode;
- channel;
- optional conversation window;
- privacy context;
- context and memory budgets;
- deterministic or provider mode.

Output should include:

- final utterance;
- situation;
- internal-state hypothesis;
- activated memory references;
- communicative intent;
- content plan;
- speech plan;
- critic report;
- trace ID;
- delivery status.

Do not expose raw private memory or private reasoning traces by default.

## Required deliverable 6 — Frozen benchmark migration

The existing benchmark is too oriented toward task execution.

Create a new fixture, preferably:

```text
tests/fixtures/arseniy-speech-benchmark-v1.js
```

Minimum 60 frozen scenarios.

Required categories:

- small talk;
- factual questions;
- absurd prompts;
- humor;
- irritation;
- disagreement;
- correction;
- praise;
- emotional support;
- advice;
- urgency;
- relationship-sensitive speech;
- public versus private tone;
- autobiographical continuity;
- current versus outdated truth;
- unknown information;
- memory-not-needed;
- irrelevant memory temptation;
- misunderstanding repair;
- repeated question;
- topic switching;
- vulnerable disclosure;
- refusal;
- boundary setting;
- mixed language;
- held-out continuation placeholders;
- novel situations.

Each case should assert structured behavior, not exact final wording only.

Possible assertions:

- primary communicative intent;
- internal-state range;
- relationship scope;
- whether memory is required;
- prohibited memory IDs;
- target length range;
- profanity range;
- directness range;
- uncertainty requirement;
- critic status;
- prohibited task-agent phrases.

Add category-level metrics and a regression gate.

## Required deliverable 7 — Migration and regression tests

Add tests proving:

- existing semantic persistence still restores after restart;
- temporal supersession still works;
- relationship memory never activates without explicit person scope;
- irrelevant high-confidence memories do not surface;
- privacy filtering remains enforced;
- task-oriented prompts can still produce task-like speech when context supports it;
- ordinary conversation does not produce project-management language;
- different relationship modes produce different speech plans;
- internal-state uncertainty rises on ambiguous inputs;
- a single observation cannot rewrite verified Identity Core;
- speech plans change output features deterministically;
- the critic catches caricature and unsupported autobiographical claims.

## Required deliverable 8 — Documentation

Update:

- `README.md` product description;
- architecture documentation;
- module registry if it still reflects task-agent centrality;
- API documentation;
- benchmark documentation.

Clearly label:

- reusable memory infrastructure;
- new primary Speech Twin runtime;
- legacy action-oriented runtime;
- privacy restrictions;
- limitations of inferred internal state.

## Engineering rules

- JavaScript ESM, consistent with the current repository;
- Node built-in test runner unless the repository already standardizes another framework;
- no new large dependencies without necessity;
- no network requirement for deterministic tests;
- no raw private corpus in Git;
- no API keys in Git;
- no paid API calls in tests;
- no silent external upload;
- every durable mutation keeps provenance;
- every inferred state keeps confidence;
- every relationship lookup requires explicit scope;
- use stable IDs and versioned schemas;
- preserve restart recovery;
- prefer explicit deterministic behavior over fake intelligent prose in tests.

## Definition of done

This mission is complete only when:

1. all new contracts exist and validate;
2. `SpeechSimulationRuntime` performs the full vertical slice;
3. the primary cognitive-system constructor builds it;
4. `/v1/speech/simulate` works in deterministic tests;
5. the benchmark contains at least 60 scenarios;
6. category metrics are produced;
7. migration and privacy regressions pass;
8. ordinary dialogue does not default to task-agent behavior;
9. documentation reflects the new product goal;
10. `npm test` and `npm run build` pass;
11. a final concise implementation report lists changed files, test results, remaining risks and exact blockers.

## Explicitly out of scope for this mission

- processing the full private archive;
- uploading private data;
- production embeddings over the full corpus;
- fine-tuning;
- claiming perfect psychological inference;
- building the final visual interface;
- autonomous external task execution;
- inventing verified personality traits from synthetic fixtures.

## Final instruction

Do not optimize for the number of modules or commits. Optimize for one complete, testable speech-simulation path that behaves differently from a generic task agent.
