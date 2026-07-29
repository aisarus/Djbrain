# Djbrain Roadmap

Djbrain is an experimental digital cognitive architecture. The project does not attempt to reproduce biological tissue neuron by neuron. It aims to reproduce selected functional mechanisms of human cognition: memory, identity, temporal continuity, situation interpretation, strategy selection, feedback learning, consolidation, forgetting and privacy-aware recall.

The first experimental subject is Arseniy Perel.

## Product principle

The language model is not the whole mind. It is a replaceable language and reasoning runtime inside a larger, persistent, inspectable and plastic system.

```text
input
→ perception
→ working state
→ social context
→ memory routing
→ privacy filtering
→ selected memory
→ response strategy
→ language runtime
→ critic
→ output
→ feedback
→ plasticity
→ consolidation
```

## Phase 0 — Container

Status: in progress.

Current implementation:

- responsive Vite application;
- procedural interactive 3D brain;
- touch and pointer rotation;
- zoom controls;
- clickable visual regions;
- animated electrical impulses;
- Vercel deployment.

Next container work:

- separate `anatomy` and `architecture` views;
- bind visual regions to machine-readable cognitive modules;
- module activity and health indicators;
- visible runtime route between modules;
- timeline, memory and identity views;
- replace the procedural brain with a high-quality segmented GLB model when licensing and asset quality are resolved.

Exit criterion: every visible region represents an actual module contract or is explicitly labelled as anatomical decoration.

## Phase 1 — Cognitive schema

Status: started.

Deliverables:

- versioned module definitions;
- typed inputs and outputs;
- runtime and learning routes;
- memory access policy per module;
- update speed for every module;
- architecture validation tests;
- mapping between anatomical anchors and digital functions.

The initial contract lives in `src/data/cognitive-modules.js`.

Exit criterion: the full path from input to response and from feedback to learning can be represented without hidden steps.

## Phase 2 — Memory substrate v1

Create a small, typed and inspectable memory system before processing the full archive.

Required memory classes:

- working memory;
- interaction memory;
- episodic memory;
- semantic self-memory;
- temporal state;
- relationship memory;
- procedural and behavioral rules;
- Identity Core;
- cold archive evidence.

Every durable record must support:

- stable ID;
- provenance;
- confidence;
- sensitivity;
- observed time;
- validity interval;
- status: pending, inferred or verified;
- support and counter-evidence;
- `supersedes`, `contradicts`, `supports` and `derived_from` links.

Start with 100–300 manually reviewable records. Do not import the full corpus yet.

Exit criterion: the system can answer temporal fact questions without confusing historical and current truth.

## Phase 3 — Identity Core v1

Build 50–100 verified behavioral patterns covering:

- directness;
- humor;
- disagreement;
- irritation;
- uncertainty;
- emotional support;
- relationship-specific tone;
- preferred response length;
- recurring values;
- known anti-patterns;
- contexts in which a pattern does not apply.

Each claim must contain evidence and counterexamples. A single observation must not become a stable trait.

Exit criterion: a strong model with Identity Core wins a blind recognizability comparison against the same model without personalization.

## Phase 4 — Runtime proof

Implement the smallest complete cognitive loop.

Initial logical roles:

1. Situation Interpreter
2. Memory Controller
3. Strategy Selector
4. Critic

These roles may initially be separate structured calls to one strong model. A multi-agent deployment is not required.

Compare:

- strong model only;
- strong model plus Identity Core;
- strong model plus Identity Core and structured memory;
- complete runtime with strategy and critic.

Exit criterion: the complete runtime improves recognizability or factual continuity without reducing conversational relevance or privacy.

## Phase 5 — Arseniy Benchmark v1

Create 50 frozen, manually reviewed scenarios across:

- small talk;
- direct questions;
- humor;
- irritation;
- disagreement;
- correction;
- topic switching;
- autobiographical facts;
- current versus outdated facts;
- relationship-sensitive tone;
- unknown information;
- memory-not-needed cases;
- tempting but irrelevant memories;
- recovery after misunderstanding;
- repeated-question robustness;
- project continuity.

Metrics:

- conversational relevance;
- recognizability;
- factual support;
- temporal correctness;
- coherence;
- repetition;
- over-personalization;
- unnecessary memory use;
- privacy leakage;
- uncertainty calibration.

Exit criterion: results can be reproduced from a frozen benchmark and compared blindly.

## Phase 6 — Plasticity v1

After each evaluated interaction, preserve:

- interpreted situation;
- selected memories;
- chosen strategy;
- generated response;
- critic report;
- user rating;
- corrected ideal response;
- proposed reason for failure.

The plasticity controller may:

- change retrieval priority;
- add an exception;
- weaken a behavioral rule;
- propose a new pattern;
- update a temporal fact;
- create a pending consolidation proposal.

It may not silently rewrite verified Identity Core.

Exit criterion: after 20–30 corrections, the system performs better on unseen related scenarios without changing the base model weights.

## Phase 7 — Consolidation and sleep

Create scheduled consolidation that:

- groups related episodes;
- searches for repeated patterns;
- searches for counterexamples;
- resolves temporal changes;
- proposes semantic facts;
- proposes Identity Core updates;
- decays unsupported hypotheses;
- detects dominant memories that are retrieved too often.

All important changes retain provenance and remain reviewable.

Exit criterion: memory quality improves over time instead of only increasing in volume.

## Phase 8 — Corpus reconstruction

Only after the small architecture demonstrates value, process the full archive.

Pipeline:

1. parse and normalize;
2. restore dialogue and episode boundaries;
3. deduplicate;
4. quarantine malformed and low-context content;
5. identify third-party privacy risks;
6. extract candidate events and facts;
7. identify temporal updates and contradictions;
8. identify behavioral candidates;
9. review high-value objects;
10. retain raw evidence in cold archive.

The goal is not one memory per message. The goal is a smaller, structured life model backed by evidence.

Exit criterion: operational memory remains compact enough to inspect and evaluate while the complete archive remains available for provenance.

## Phase 9 — Fine-tuning

Fine-tuning is optional and comes only after the architecture works with a strong frozen model.

Future examples should include:

- complete conversational situation;
- relationship mode;
- temporal state;
- selected relevant memory;
- conversational strategy;
- accepted response;
- rejected response;
- reason for rejection.

Training should optimize memory use and conversational behavior, not memorize the raw archive.

## Immediate implementation order

### Sprint 1 — Brain Map

- [x] define initial cognitive modules;
- [x] define runtime and learning routes;
- [ ] render architecture modules in the live interface;
- [ ] show module status, inputs, outputs and memory access;
- [ ] animate a deterministic runtime route;
- [ ] add architecture/anatomy view switch;
- [ ] add basic schema validation.

### Sprint 2 — Memory Seed

- [ ] define schemas for episodes, facts, states and behavioral patterns;
- [ ] implement local fixture storage;
- [ ] create 100 synthetic or manually verified seed records;
- [ ] display records through the 3D interface;
- [ ] add temporal and contradiction resolution tests.

### Sprint 3 — Runtime Proof

- [ ] add provider-neutral model interface;
- [ ] implement interpreter contract;
- [ ] implement memory router contract;
- [ ] implement strategy contract;
- [ ] implement critic contract;
- [ ] create 30–50 frozen scenarios;
- [ ] run blind baseline comparison.

## Non-negotiable constraints

- no raw private archive in Git;
- no silent external upload;
- no paid full-corpus operation without explicit approval;
- no new fine-tuning before runtime proof;
- all inferred identity claims remain distinguishable from verified claims;
- every important memory mutation keeps provenance;
- the visual interface must not pretend mock activity is real runtime activity.
