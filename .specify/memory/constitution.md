<!--
  Sync Impact Report
  ==================
  Version change: 1.1.0 → 1.2.0
  Modified principles:
    - Principle II: Hardware-Agnostic Integration (added IZeifFrameProvider
      interface requirement)
    - Principle V: Low-Latency & Reliability (quantified 200ms time budget,
      added frame skip threshold)
  Added sections:
    - Principle XI: Fail-Safe by Default
    - Definition of Done
    - Anti-Patterns
    - Constitution Check Template
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed (generic
      Constitution Check section already exists)
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: None
-->

# Zeif Constitution

## Core Principles

### I. Proactive Detection Pipeline

Zeif operates as a real-time proactive security system. Every camera
frame MUST flow through a classification pipeline that determines
whether a robbery is occurring. Positive detections MUST fire triggers
and persist the frame. Negative detections MUST be dismissed with no
side effects. The system MUST never store or process frames beyond
classification unless a positive detection occurs.

### II. Hardware-Agnostic Integration

Zeif MUST integrate with any hardware camera capable of producing
video frames. No camera-specific logic is allowed in the core
pipeline. Camera adapters MUST implement the `IZeifFrameProvider`
interface and normalize input into a common `ZeifFrame` format
before entering the classification stage. Raw buffers or
vendor-specific types (e.g., Hikvision SDK objects, ONVIF raw
streams) MUST NOT leak beyond the adapter layer. Adding support
for a new camera MUST NOT require changes to the detection or
trigger subsystems.

### III. Trigger-Driven Response

When a positive detection occurs, the system MUST execute one or more
configured triggers (e.g., call 911, sound alarm, send notification).
Triggers MUST be independently defined, testable, and composable.
Each trigger MUST succeed or fail independently without blocking other
triggers. Failed triggers MUST be logged and retried according to a
configurable policy. The trigger subsystem is the current area of
active development.

### IV. Frame Evidence Preservation

On positive detection, the originating frame MUST be persisted as
evidence with metadata (timestamp, camera source, detection
confidence, triggered actions). Frames from negative detections
MUST NOT be stored. Evidence frames MUST be retrievable for review
and audit.

### V. Low-Latency & Reliability

The full pipeline (frame ingestion → classification) MUST NOT exceed
200ms per frame. Any operation that would breach this budget MUST be
delegated to an async worker or discarded with a warning log. If the
system falls behind (queue depth > 10 frames), it MUST skip frames
explicitly with logging rather than stall. The system MUST NOT drop
frames silently under load. False positive rate MUST be tracked and
minimized to avoid unnecessary trigger activations.

### VI. DRY Code

Code MUST NOT be duplicated across the codebase. Shared logic MUST
be extracted into reusable modules. Before writing new code, existing
utilities and components MUST be checked for reuse opportunities.
Violations of DRY MUST be flagged during code review.

### VII. Speckit-Driven Development

Every feature MUST follow the speckit workflow: specification
(`/speckit.specify`) first, then planning (`/speckit.plan`), then
task generation (`/speckit.tasks`), then implementation
(`/speckit.implement`). No feature implementation MUST begin without
a completed spec and plan. Skills MUST be used when applicable to
the task at hand.

### VIII. Git Worktree Isolation

Each feature MUST be developed in its own git worktree. Feature
work MUST NOT happen on the main branch directly. Worktrees MUST
be created before implementation begins and cleaned up after the
feature is merged. This ensures parallel feature development
without cross-contamination.

### IX. Vercel Composition Patterns

All React components MUST follow the Vercel composition patterns
skill guidelines. Components MUST avoid boolean prop proliferation
and instead use compound component patterns, render props, or
context providers as appropriate. Flexible, composable APIs MUST
be preferred over rigid, configuration-heavy interfaces.

### X. React Best Practices

All frontend code MUST follow the Vercel React best practices skill
guidelines for performance optimization. This includes proper use of
React Server Components, correct client/server boundaries, optimized
data fetching patterns, and appropriate use of memoization. Components
MUST avoid unnecessary re-renders and follow RSC-first architecture.

### XI. Fail-Safe by Default

Zeif is a security system — silence MUST never be interpreted as
"all clear." On critical failure of the classification engine, the
system MUST emit a "System Offline" alert to all configured
notification channels. If the trigger subsystem is unreachable, the
system MUST queue pending triggers and alert the operator rather than
discard them. Every subsystem MUST define its failure mode explicitly:
fail-open (alert + degrade) is the default; fail-silent is forbidden.

## Technology Stack

- **Framework**: Next.js with TypeScript
- **Database & Backend**: Supabase (PostgreSQL, Auth, Storage, Edge
  Functions)
- **Styling**: As determined per feature (MUST be consistent across
  the project once chosen)
- All code MUST be written in TypeScript with strict mode enabled.
- Supabase MUST be used for all persistence, authentication, and
  serverless function needs.

## Performance & Reliability Requirements

- Frame classification MUST complete within 200ms (Principle V).
- Trigger execution MUST be asynchronous and non-blocking relative to
  the detection pipeline.
- The system MUST log every detection decision (positive or negative)
  with enough context for post-incident analysis.
- All external integrations (emergency services, alarms, notifications)
  MUST implement timeout and retry logic.

## Definition of Done

A task or feature is considered complete ONLY when ALL of the
following criteria are met:

- [ ] Code compiles with zero TypeScript errors (`strict: true`).
- [ ] ESLint passes with zero warnings and zero errors.
- [ ] Every Supabase table involved has Row Level Security (RLS)
      policies enabled and tested.
- [ ] Trigger implementations have 100% test coverage for success,
      failure, and retry paths (Principle III).
- [ ] New React components pass linter with no warnings and follow
      composition patterns (Principles IX, X).
- [ ] The speckit workflow was followed end-to-end (Principle VII).
- [ ] The feature was developed in an isolated worktree
      (Principle VIII).
- [ ] No code duplication was introduced (Principle VI).
- [ ] The PR description identifies which constitution principles
      the change touches.

## Anti-Patterns

The following patterns are **explicitly forbidden**:

- **NO** `useEffect` to synchronize state that can be derived from
  props or other state (Principle X).
- **NO** Supabase database calls inside frame-processing loops.
  All DB writes MUST be batched or queued asynchronously
  (Principle V).
- **NO** bypassing the speckit workflow for "quick fixes." Every
  change, regardless of size, MUST have at minimum a spec entry
  (Principle VII).
- **NO** passing raw vendor camera objects beyond the adapter layer
  (Principle II).
- **NO** silent failure modes — every catch block MUST log and
  surface the error (Principle XI).
- **NO** boolean prop proliferation in React components — use
  compound patterns instead (Principle IX).
- **NO** client-side data fetching when a Server Component can
  handle it (Principle X).

## Development Workflow

- Features MUST be developed against the constitution principles.
  Every PR MUST identify which principles it touches.
- Features MUST follow the speckit workflow end-to-end (Principle VII).
- Features MUST be developed in isolated git worktrees (Principle VIII).
- Trigger implementations MUST include unit tests that verify
  independent execution and failure isolation.
- Integration tests MUST cover the full pipeline: frame ingestion →
  classification → trigger dispatch → evidence storage.
- Camera adapter contributions MUST prove they do not leak
  camera-specific concerns into the core pipeline.
- React components MUST follow Vercel composition patterns
  (Principle IX) and React best practices (Principle X).

## Constitution Check Template

*Every `/speckit.plan` MUST validate against these gates:*

1. [ ] Does this plan avoid code duplication? (Principle VI)
2. [ ] Was a git worktree created for this feature? (Principle VIII)
3. [ ] Is the latency impact < 50ms additional to the pipeline?
       (Principle V — 200ms total budget)
4. [ ] Are new components composable, not config-heavy?
       (Principle IX)
5. [ ] Are new Supabase tables RLS-enabled? (Definition of Done)
6. [ ] Does the failure mode default to fail-open with alerts?
       (Principle XI)
7. [ ] Does camera integration stay behind the adapter interface?
       (Principle II)
8. [ ] Are triggers independently testable? (Principle III)

## Governance

- This constitution supersedes all other development practices for
  the Zeif project. Conflicts MUST be resolved in favor of the
  constitution.
- Amendments require: (1) a written proposal, (2) review by the
  project lead, and (3) an updated version number following semver.
- Versioning policy: MAJOR for principle removals or redefinitions,
  MINOR for new principles or material expansions, PATCH for
  clarifications and wording fixes.
- Compliance review: every feature spec and implementation plan MUST
  include a Constitution Check section validating alignment with
  these principles.

**Version**: 1.2.0 | **Ratified**: 2026-03-27 | **Last Amended**: 2026-03-27
