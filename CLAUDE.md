# Zeif

Real-time proactive security system. Camera frames flow through a classification pipeline to detect robberies, fire triggers, and preserve evidence.

## Tech Stack

- **Framework**: Next.js + TypeScript (strict mode)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Styling**: TBD (must be consistent once chosen)

## Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint check |
| `pnpm type-check` | TypeScript strict check |
| `pnpm format` | Format with Prettier |
| `pnpm format:check` | Check formatting |

## Architecture

```
zeif/
  .specify/          # Speckit config, templates, scripts
  .claude/commands/  # Speckit slash commands
  specs/             # Feature specs, plans, tasks (per-feature dirs)
  src/               # Application code (TBD)
```

## Feature Development Workflow

Every feature follows this exact sequence — no exceptions:

1. **Specify** — `/speckit.specify <feature description>`
   Creates a numbered feature branch (e.g., `001-user-auth`), scaffolds `specs/<branch>/spec.md`, and writes the specification. Includes quality validation checklist. Handles clarifications inline (max 3).
2. **Clarify** (optional) — `/speckit.clarify`
   De-risk ambiguous areas with structured questions. Run before planning if the spec has open questions.
3. **Plan** — `/speckit.plan`
   Creates the technical implementation plan. Must pass the Constitution Check gates.
4. **Checklist** (optional) — `/speckit.checklist`
   Generate quality checklists to validate requirements completeness.
5. **Tasks** — `/speckit.tasks`
   Breaks the plan into dependency-ordered, actionable tasks in `tasks.md`.
6. **Analyze** (optional) — `/speckit.analyze`
   Cross-artifact consistency and alignment report. Run after tasks, before implement.
7. **Implement** — `/speckit.implement`
   Executes all tasks from `tasks.md` in dependency order.
8. **PR** — Reference which constitution principles the change touches
9. **Cleanup** — Merge and remove the feature branch

**No implementation without a completed spec and plan. No "quick fixes" that skip the workflow.**
**Note:** `/speckit.specify` automatically creates the feature branch — no manual branch creation needed.

## Git Worktrees

- Every feature gets its own branch — `/speckit.specify` creates it automatically
- Never work directly on main
- For parallel feature development, use git worktrees (`/using-git-worktrees` skill) to work on multiple features simultaneously
- Clean up branches after merge

## Skills Usage

Use skills when applicable. Key skills for this project:

### Process Skills

| Skill | When to Use |
|-------|------------|
| `/brainstorming` | Before any creative work — features, components, behaviors |
| `/systematic-debugging` | Before proposing fixes for any bug |
| `/writing-plans` | When you have a spec and need an implementation plan |
| `/executing-plans` | When executing a written plan |
| `/verification-before-completion` | Before claiming work is done |
| `/requesting-code-review` | Before merging |
| `/using-git-worktrees` | When working on multiple features in parallel |

### Best Practices Skills (MUST use when touching relevant code)

| Skill | When to Use |
|-------|------------|
| `/vercel-react-best-practices` | Writing/reviewing React code — RSC boundaries, data fetching, memoization, re-render prevention, bundle optimization |
| `/vercel-composition-patterns` | Designing component APIs — compound components, render props, context providers, no boolean prop proliferation |
| `/next-best-practices` | Next.js file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization |
| `/supabase-postgres-best-practices` | Writing queries, designing schemas, configuring Supabase — indexing, RLS, connection pooling, N+1 prevention |

### Design & Frontend Skills

| Skill | When to Use |
|-------|------------|
| `/frontend-design` | Any frontend/UI work — landing pages, dashboards, components |
| `/web-design-guidelines` | Reviewing UI for accessibility and design best practices |

## Core Principles (from Constitution v1.2.0)

1. **Proactive Detection Pipeline** — Every frame -> classify -> trigger or dismiss. No storage unless positive detection.
2. **Hardware-Agnostic** — Camera adapters implement `IZeifFrameProvider` -> normalize to `ZeifFrame`. No vendor types leak past adapter layer.
3. **Trigger-Driven Response** — Triggers are independent, testable, composable. Failed triggers log + retry. Never block other triggers.
4. **Frame Evidence Preservation** — Positive detections persist frame + metadata. Negative frames are never stored.
5. **Low-Latency** — Frame -> classification <= 200ms. Queue depth > 10 -> skip frames with logging. Never stall silently.
6. **DRY Code** — No duplication. Check existing utils before writing new code.
7. **Speckit-Driven** — spec -> plan -> tasks -> implement. Always.
8. **Worktree Isolation** — One feature per worktree. Never commit directly to main.
9. **Vercel Composition Patterns** — Compound components over boolean props. Composable APIs over rigid configs. Use `/vercel-composition-patterns` skill.
10. **React Best Practices** — RSC-first. Proper client/server boundaries. No unnecessary re-renders. Use `/vercel-react-best-practices` skill.
11. **Fail-Safe by Default** — Silence != "all clear." Critical failure -> alert all channels. Fail-silent is forbidden.

## Anti-Patterns (Forbidden)

- `useEffect` to sync derived state — derive inline or use `useMemo`
- Supabase calls inside frame-processing loops — batch/queue instead
- Skipping speckit workflow for any change
- Raw vendor camera objects beyond adapter layer
- Silent catch blocks — always log + surface
- Boolean prop proliferation — use compound component patterns
- Client-side fetching when Server Components work
- Inline component definitions inside render — hoist them
- Barrel file re-exports that bloat bundles — use direct imports

## Definition of Done

- [ ] Zero TypeScript errors (`strict: true`)
- [ ] ESLint passes (zero warnings, zero errors)
- [ ] Supabase tables have RLS policies enabled + tested
- [ ] Triggers have 100% test coverage (success, failure, retry)
- [ ] React components follow composition patterns (Principle IX)
- [ ] React code follows performance best practices (Principle X)
- [ ] Speckit workflow followed end-to-end
- [ ] Developed in isolated worktree
- [ ] No code duplication introduced
- [ ] PR description identifies constitution principles touched

## Gotchas

- Frame classification budget is 200ms total — any DB write in that path breaks it
- Every subsystem must define its failure mode explicitly (fail-open with alert is default)
- All Supabase tables need RLS — no exceptions
- Constitution supersedes all other dev practices — conflicts resolve in its favor
