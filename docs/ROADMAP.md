# Djbrain / Speech Twin Roadmap

## Mission

Djbrain is an experimental architecture for reconstructing the **generative speech behavior of a specific person**.

The first experimental subject is Arseniy Perel.

The system is not primarily a productivity agent, autonomous worker, generic assistant, quote search engine, or style-transfer prompt. Its central task is:

> Given a conversational situation, relationship context, current personal state and relevant autobiographical memory, generate the response that this person would most likely choose to say, in the way this person would most likely say it.

The target is not only surface style. The system must reproduce the chain that produces speech:

```text
incoming message
→ perceived situation
→ relationship interpretation
→ internal reaction hypothesis
→ activated memory and identity patterns
→ communicative intention
→ content selection
→ speech plan
→ individual wording and rhythm
→ speech-behavior critic
→ utterance
```

A useful answer that the person would never say is a failure. A stylistically similar answer with the wrong reaction, content or social stance is also a failure.

## Non-goals

Djbrain is not optimized for:

- maximizing task completion;
- automatically taking actions in external systems;
- producing the objectively best advice;
- always being polite, balanced or helpful;
- imitating only profanity, punctuation or catchphrases;
- retrieving and remixing old quotations;
- claiming biological or conscious equivalence to the original person.

Task execution may exist as a secondary capability only when task-oriented behavior is itself part of the person's speech pattern in the current situation.

## Product principle

The language model is a replaceable language and reasoning engine inside a persistent, inspectable model of a person.

The system should answer six questions before generation:

1. What did this person notice in the message?
2. How would this person interpret the social situation?
3. What internal reaction would probably become active?
4. What memories, beliefs, values and relationship patterns would influence the reply?
5. What would this person try to accomplish communicatively?
6. How would this person realize that intention in language?

## Existing foundation to preserve

The repository already contains useful lower-level infrastructure:

- working memory;
- episodic memory;
- semantic memory;
- temporal state;
- relationship memory;
- Identity Core claims;
- procedural memory;
- hybrid retrieval;
- privacy filtering;
- persistent event logs;
- mutation replay;
- provider-neutral generation interfaces;
- observability traces;
- benchmark harness;
- ingestion and quarantine.

These components should be retained where their contracts remain useful. They must be reoriented toward speech simulation rather than task execution.

## Architecture v2

```text
Conversation input
→ Situation Interpreter
→ Relationship Context Resolver
→ Internal State Model
→ Memory and Identity Activation
→ Communicative Intent Selector
→ Content Planner
→ Speech Planner
→ Voice Realizer
→ Speech Behavior Critic
→ Final utterance
→ Feedback and correction
→ Reversible plasticity
→ Consolidation
```

### Core distinction

The old task-agent question was:

> What action should the system perform?

The new central question is:

> What would this person most likely think worth saying here, and how would they say it?

## Phase 0 — Scope migration

Status: immediate priority.

Deliverables:

- replace task-agent language in architecture and documentation;
- mark action-oriented strategy code as legacy or secondary;
- define the new end-to-end speech simulation route;
- map reusable packages to the new architecture;
- create migration tests proving that existing memory and privacy behavior is preserved;
- prevent the UI and documentation from describing the system as an autonomous worker.

Exit criterion: all central project documents and runtime entry points describe speech-behavior simulation as the primary product.

## Phase 1 — Speech behavior schemas

Create versioned contracts for the objects that explain why a person says something.

Required contracts:

### ConversationSituation

- participants;
- relationship mode;
- topic;
- conversational history;
- social stakes;
- explicit request;
- implied request;
- conflict level;
- ambiguity;
- audience;
- channel;
- time context.

### InternalStateHypothesis

- affective valence;
- arousal;
- irritation;
- interest;
- trust;
- vulnerability;
- certainty;
- playfulness;
- defensiveness;
- cognitive mode;
- confidence in the hypothesis;
- supporting and counter-evidence.

This object is a probabilistic model, not a medical diagnosis or claim of hidden access to the person's mind.

### CommunicativeIntent

Possible intentions include:

- answer directly;
- think aloud;
- challenge;
- correct;
- provoke;
- reassure;
- seek validation;
- create closeness;
- distance;
- entertain;
- express irritation;
- show uncertainty;
- test the other person;
- end the topic;
- continue the interaction;
- refuse;
- avoid answering.

### ContentPlan

- claims to express;
- memories to reference;
- stance;
- omissions;
- uncertainty level;
- emotional payload;
- expected effect on the interlocutor.

### SpeechPlan

- language;
- expected length;
- sentence structure;
- rhythm;
- directness;
- profanity level and function;
- humor type;
- hedging;
- repetition;
- self-correction;
- punctuation habits;
- code-switching;
- opening and closing behavior.

### UtteranceFeatures

Measurable features extracted from real and generated speech:

- token and character length;
- sentence count;
- average clause length;
- punctuation distribution;
- profanity density;
- discourse markers;
- parenthetical usage;
- repetition;
- questions;
- imperatives;
- code-switching;
- slang;
- emotional intensity;
- lexical novelty;
- response latency when available.

### SpeechEvaluationCase

- frozen conversational context;
- hidden real continuation when available;
- accepted alternative responses;
- relationship context;
- relevant and irrelevant memory candidates;
- target internal-state range;
- target communicative-intent range;
- prohibited caricature markers;
- evaluator notes.

Exit criterion: the entire path from situation to utterance can be represented with explicit versioned objects and validated without hidden task-agent assumptions.

## Phase 2 — Corpus reconstruction for speech

The archive must be reconstructed as conversations, not as isolated messages.

Pipeline:

1. parse and normalize exports;
2. restore speakers, threads and reply links;
3. rebuild conversational windows;
4. separate authored speech from quotations and forwarded content;
5. identify channel and relationship context;
6. deduplicate repeated exports;
7. split long conversations into coherent interaction episodes;
8. preserve pauses and timing where available;
9. identify corrections, misunderstandings and repairs;
10. quarantine messages without enough context;
11. flag third-party privacy risks;
12. retain raw evidence in a private cold archive.

Do not create one memory per message. The useful unit is a conversational situation with antecedents, reaction and consequence.

Exit criterion: a reviewer can inspect a reconstructed conversational episode and understand what prompted each response.

## Phase 3 — Behavioral speech map v1

Build a reviewable model of recurring speech behavior.

Required dimensions:

- directness;
- preferred response length;
- expansion versus compression;
- humor and irony;
- profanity and its communicative function;
- disagreement;
- irritation;
- uncertainty;
- emotional support;
- persuasion;
- self-disclosure;
- meta-commentary;
- topic switching;
- response to misunderstanding;
- response to praise;
- response to pressure;
- relationship-specific tone;
- language switching;
- recurring openings, transitions and endings;
- contexts in which each pattern does not apply.

Each pattern must contain:

- stable ID;
- description;
- applicable contexts;
- exceptions;
- supporting episode IDs;
- counterexample IDs;
- confidence;
- stability;
- review status;
- sensitivity;
- provenance.

A single vivid message must never become a stable personality rule.

Exit criterion: 50–100 reviewed patterns cover the major modes of the person's speech without reducing them to a caricature.

## Phase 4 — Situation and internal reaction model

Implement a probabilistic interpreter that predicts a range of plausible reactions rather than one hard label.

The model must distinguish, where evidence supports it:

- literal request versus social pressure;
- sincere praise versus irony;
- curiosity versus challenge;
- irritation versus playfulness;
- desire for information versus desire for validation;
- close-relationship banter versus public communication;
- analytical mode versus emotional mode;
- genuine uncertainty versus rhetorical uncertainty.

Output must include confidence and alternative hypotheses.

Exit criterion: on a frozen labeled set, the correct situation and internal-state range is normally among the top hypotheses, and uncertainty rises on ambiguous inputs.

## Phase 5 — Person-specific memory activation

Adapt the existing memory substrate to answer:

> What would this person naturally remember or treat as relevant in this situation?

Retrieval must consider:

- topic relevance;
- relationship relevance;
- emotional similarity;
- conversational function;
- current versus historical truth;
- identity relevance;
- salience;
- recency;
- repetition and retrieval fatigue;
- privacy scope;
- whether the person would realistically mention the memory aloud.

Memory activation and memory disclosure are separate decisions. A memory may influence a response without being explicitly mentioned.

Exit criterion: relevant memories improve continuation quality while irrelevant autobiographical facts and private third-party material remain absent.

## Phase 6 — Speech Simulation Runtime v1

Implement the smallest complete runtime focused on generated speech.

Logical roles:

1. Situation Interpreter
2. Relationship Context Resolver
3. Internal State Model
4. Memory and Identity Controller
5. Communicative Intent Selector
6. Content Planner
7. Speech Planner
8. Voice Realizer
9. Speech Behavior Critic

These may initially be structured calls to one strong frozen model. Multi-agent deployment is not required.

The runtime should produce both:

- the final utterance;
- an inspectable trace of the inferred situation, activated memories, internal-state hypothesis, communicative intention and speech plan.

The trace is diagnostic. It is not necessarily shown to the end user.

Exit criterion: the runtime generates contextually plausible person-specific speech and can explain its own selected evidence without exposing private chain-of-thought.

## Phase 7 — Arseniy Speech Benchmark v1

Create a frozen benchmark with at least 60 manually reviewed scenarios.

Required scenario groups:

- ordinary small talk;
- direct factual questions;
- absurd or playful prompts;
- irritation;
- disagreement;
- correction;
- praise;
- emotional support;
- requests for advice;
- pressure and urgency;
- relationship-sensitive communication;
- public versus private tone;
- autobiographical continuity;
- current versus outdated facts;
- unknown information;
- memory-not-needed cases;
- tempting but irrelevant memories;
- recovery after misunderstanding;
- repeated questions;
- topic switching;
- vulnerable disclosure;
- refusal and boundary setting;
- code-switching;
- held-out real dialogue continuation;
- novel situations with no direct archive analogue.

Evaluation dimensions:

- content similarity;
- communicative-intent similarity;
- relationship appropriateness;
- emotional-state plausibility;
- stylistic recognizability;
- factual support;
- temporal correctness;
- coherence;
- natural variation;
- over-personalization;
- caricature score;
- unnecessary memory use;
- privacy leakage;
- uncertainty calibration;
- human blind recognizability.

Required comparisons:

- strong model only;
- strong model plus style prompt;
- strong model plus behavioral speech map;
- behavioral map plus memory;
- complete Speech Simulation Runtime.

Exit criterion: evaluators identify the person-specific system above chance and prefer it to style-prompt and memory-only baselines without increased privacy leakage.

## Phase 8 — Plasticity from correction

After each evaluated interaction, preserve:

- conversational situation;
- inferred internal state;
- selected memory;
- selected communicative intention;
- content plan;
- speech plan;
- generated utterance;
- critic report;
- user rating;
- corrected or preferred response;
- proposed reason for mismatch.

The plasticity controller may:

- change activation priority;
- add a context exception;
- weaken a speech pattern;
- propose a new pattern;
- update a temporal fact;
- update relationship-specific behavior;
- adjust intent selection;
- create a pending consolidation proposal.

It may not silently rewrite verified Identity Core or verified speech patterns.

Exit criterion: after 20–30 corrections, performance improves on unseen related situations without base-model weight changes.

## Phase 9 — Consolidation and forgetting

Scheduled consolidation should:

- group related interaction episodes;
- find repeated situation-to-response mappings;
- search for counterexamples;
- distinguish stable speech patterns from temporary state;
- resolve temporal changes;
- propose relationship-specific patterns;
- decay unsupported hypotheses;
- detect overused memories and catchphrases;
- detect caricature drift;
- preserve provenance and reviewability.

Exit criterion: the system becomes more selective and accurate over time instead of merely accumulating rules.

## Phase 10 — Full corpus reconstruction

Only after the small runtime demonstrates measurable value should the full archive be processed.

Operational memory must remain compact and inspectable. Raw messages remain private evidence, not the runtime personality itself.

Exit criterion: the complete archive can support reconstruction without forcing the model to load or embed everything for every response.

## Phase 11 — Optional fine-tuning

Fine-tuning is optional and comes only after the architecture works with a strong frozen model.

Training examples should include:

- conversational situation;
- relationship context;
- internal-state hypothesis;
- selected memory;
- communicative intention;
- content plan;
- speech plan;
- accepted utterance;
- rejected utterance;
- reason for rejection.

Training should optimize situation-to-speech behavior, not memorize the raw archive.

## Immediate implementation order

### Sprint A — Architecture migration

- [ ] replace task-agent framing in runtime contracts;
- [ ] introduce `SituationFrame`, `InternalStateHypothesis`, `CommunicativeIntent`, `ContentPlan`, `SpeechPlan` and `UtteranceFeatures`;
- [ ] add a new `SpeechSimulationRuntime` entry point;
- [ ] keep the old action-oriented runtime behind a clearly named legacy or secondary interface;
- [ ] update diagrams and module registry;
- [ ] preserve memory, privacy and persistence tests.

### Sprint B — Deterministic vertical slice

- [ ] implement deterministic situation interpretation;
- [ ] implement internal-state hypothesis generation;
- [ ] implement communicative-intent selection;
- [ ] implement content and speech planning;
- [ ] implement deterministic voice realization;
- [ ] implement a speech-behavior critic;
- [ ] expose one end-to-end API route;
- [ ] persist traces.

### Sprint C — Speech benchmark

- [ ] migrate the existing frozen scenarios away from task-agent assertions;
- [ ] create at least 60 speech-behavior cases;
- [ ] add category metrics;
- [ ] add held-out continuation fixtures;
- [ ] add caricature and unnecessary-memory checks;
- [ ] establish baseline results.

### Sprint D — Reviewed seed

- [ ] create 100–300 manually reviewable records;
- [ ] include situations, episodes, temporal facts, relationships and speech patterns;
- [ ] include counterexamples and non-applicability contexts;
- [ ] load through the ingestion gate;
- [ ] keep raw private content outside Git.

### Sprint E — Strong-model runtime proof

- [ ] connect a strong provider through the provider-neutral adapter;
- [ ] compare baseline, style prompt, behavioral map, memory and complete runtime;
- [ ] run blind human evaluation;
- [ ] publish reproducible benchmark summaries without private raw data.

## Definition of v1 success

Speech Twin v1 is successful only if all of the following are true:

- it produces person-specific reactions, not merely person-like wording;
- content and stance are recognizable in blind comparison;
- relationship context changes the response appropriately;
- current and historical facts are not confused;
- irrelevant personal memories are usually absent;
- private third-party information does not leak;
- the person is not reduced to profanity, irony or a few catchphrases;
- corrections produce measurable improvement;
- the system remains inspectable and reversible;
- results are reproducible on a frozen benchmark.

## Non-negotiable constraints

- no raw private archive in Git;
- no silent external upload;
- no paid full-corpus operation without explicit approval;
- no fine-tuning before runtime proof;
- no claim of consciousness or biological equivalence;
- inferred internal states remain hypotheses with confidence, not facts;
- inferred identity and speech claims remain distinguishable from verified claims;
- every important memory mutation keeps provenance;
- relationship memory requires explicit scope;
- the system must not expose private diagnostic traces as chain-of-thought;
- the visual interface must not present mock activity as real cognition;
- task efficiency must never silently replace speech-behavior fidelity as the main optimization target.
