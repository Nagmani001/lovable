# `lovable` — Interview Prep & Improvement Plan

> Target role: **Atlan Software Engineering Internship (B.Tech 2027)**
> This is your **primary project**. Lead the technical interview with it.

---

## Why this project fits Atlan

Atlan's job description names four work areas. `lovable` hits three of them directly:

| Atlan focus area                                                                        | What `lovable` already has                                                                                                 |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **The context layer** — how meaning is modelled and exposed to AI agents                | `context-manager.ts` selectively injects files into the prompt; `intent-classifier.ts` routes user intent before retrieval |
| **Reliability & evaluation for AI agents** where a wrong answer is worse than no answer | Self-healing fixup loop runs `tsc --noEmit` and `vite build`, filters errors to modified files, re-prompts the agent       |
| **Developer tooling & internal platforms**                                              | The whole project _is_ a developer tool — sandboxed AI orchestration, custom tool protocol (`lov-*`), streaming SSE        |

The fourth (integrations with messy enterprise data platforms) is not directly covered, and that's fine — they're not expecting it from an intern.

**How to frame this to the interviewer:** "I built a sandboxed AI coding agent. The interesting problems were the ones Atlan also has — managing context for the model, tool design, and reliability when the agent gets it wrong."

---

## What's strong about it (own these in the interview)

1. **Real agent loop with bounded iteration.** `MAX_BUILD_ITERATIONS=25` and `MAX_FIXUP_ITERATIONS=3` show you thought about termination, not just "let it run."
2. **Self-correcting build loop.** This is the single most interesting thing in the repo. The agent writes code → typecheck → if errors, filter to _only files the agent touched_ → re-prompt with the error context → repeat. That's exactly the kind of reliability work Atlan calls out.
3. **Sandboxed execution via E2B.** Shows you care about isolation, which matters in enterprise contexts.
4. **Custom tool protocol** (`lov-write`, `lov-line-replace`, `lov-search-files`, etc.). Designing the right tool surface for an agent is non-trivial — own that decision.
5. **Streaming SSE all the way through** — chat router → orchestrator → tool executor → client. Real user experience, not a curl-only prototype.
6. **Clean monorepo discipline.** Turborepo, shared types in `@repo/common`, Prisma migrations, integration test app. This signals you can ship in a team.

---

## Critical fixes before the interview

### 1. Rewrite the README (highest priority)

The current README says _"Template Monorepo — Turborepo monorepo with a Next.js frontend, Express backend, PostgreSQL database, and email support."_

That description fits any boilerplate. It actively hides the interesting work. An interviewer skimming the repo for 30 seconds before the call will think this is a class assignment.

**Replace it with:**

- One-paragraph "what this is" — open-source Lovable/Bolt.new alternative, AI agent that builds web apps in a sandbox from natural language.
- A **diagram** of the request lifecycle (mermaid works on GitHub). Show: user prompt → chat router → orchestrator → agent loop ↔ tool executor ↔ E2B sandbox → fixup loop → live preview URL.
- A **demo GIF or Loom link** (90 seconds, screen recording is enough). Without this, the interviewer cannot tell what the project does without reading source.
- A bulleted "interesting technical decisions" section:
  - Why E2B (vs Docker / WebContainers)
  - Why the typecheck + build fixup loop
  - Why a rule-based intent classifier (vs another LLM call)
  - How context is selectively built for each turn
- Bullet list of stack with one-line _why_ per item, not just _what_.

### 2. Add `ARCHITECTURE.md`

The current README references `ARCHITECTURE_GUIDE.md` but the file doesn't exist (404). Create it. Don't make it long — one page covering:

- Request lifecycle (the diagram above, in more detail)
- Where state lives (Postgres for conversation history, S3 for project files, in-memory `Map` for active sandboxes)
- Sandbox lifecycle: create → hydrate from S3 → run agent → persist back → idle shutdown
- The fixup loop: why it exists, what it filters, what it skips
- Known failure modes (be honest — see eval harness below)

This document will _frame the interview walkthrough_. They'll open it during the call.

### 3. Build a minimal evaluation harness (this is the differentiator)

Atlan's JD: _"Reliability & evaluation for AI agents operating on enterprise data, where a wrong answer is worse than no answer."_

You don't have this yet. Adding even a basic version before the interview is the single highest-leverage thing you can do.

**Minimum viable eval:**

- 15–20 prompts across categories that match your intent classifier (UI styling, new feature, bug fix, refactor, etc.)
- Run each prompt 3 times (LLMs are stochastic)
- For each run, record:
  - Did it terminate in `< MAX_BUILD_ITERATIONS`?
  - Did the final `vite build` succeed?
  - Did the preview actually render without runtime errors?
  - Subjective: did the output match the intent? (you grade by hand)
- Write up the numbers in `EVAL.md` — even "success rate 11/20 first-pass, 16/20 after fixup, most common failure: agent edits a file it didn't read first" is a _very_ strong answer.

When asked "how do you know it works?" — most interns say "I tested it manually." You can say "I ran 60 trajectories, here's the breakdown, here's the most common failure mode, here's what I'd try next." That's the difference between intern-tier and "we should hire this person."

### 4. Code cleanup

Remove before the interview — these will get flagged:

- `loop.ts`: commented-out `fs.writeFileSync` debug code (lines ~70-73). Either delete or guard behind a debug flag.
- `console.log` statements with raw output like `console.log("typescript check output result : ", result)` — replace with a proper logger or remove the noisy ones.
- Stale comment / commented baseURL in `loop.ts` (`// baseURL: "https://openrouter.ai/api/v1"`) — pick one or make it env-configurable.

### 5. Add tests for the orchestrator package

You have `packages/tool-tests/` which is good — make sure it actually runs and is mentioned in the README. If the tool executor has zero tests, write 3-5 for the most complex tools (`lov-line-replace`, `lov-search-files`). Even basic ones signal "I think about correctness."

---

## Questions the interviewer will ask (prep answers)

These are predictable. Have a confident, specific answer for each.

**On architecture:**

- _"Walk me through what happens when a user types a prompt."_ — Have this memorized end-to-end. Frontend → SSE POST → chat router persists message → orchestrator → load history → spin up or reuse sandbox → agent loop → tool calls modify sandbox files → stream chunks back → fixup loop → done event. 90 seconds.
- _"Why E2B and not Docker / Firecracker / WebContainers?"_ — Have a real reason. Cold start, security boundary, dev ergonomics, cost. If you picked it because it was easiest, say so — but say _what you'd evaluate if you were building this for production_.
- _"Why a monorepo? What's in `@repo/common`?"_ — Shared Zod schemas, types like `StreamChunk`, anything used by both frontend and backend. Avoid duplicating contracts between client and server.

**On the agent loop:**

- _"Why 25 iterations?"_ — What did you observe? Did anything ever need more? What happens past 25? (You return a "max reached" message — explain why that's better than infinite retry.)
- _"How does the fixup loop decide which errors to fix?"_ — You filter `tsc` errors by files the agent modified (`filterErrorsByFiles`). Explain why: pre-existing errors aren't your agent's problem and chasing them wastes iterations.
- _"Why separate typecheck loop and build loop?"_ — tsc is fast and catches type errors cheaply; `vite build` is slower and catches a different class (imports, bundler issues). Run cheap first.
- _"What's the biggest failure mode you've seen?"_ — Be honest. "The agent sometimes writes a file it never read, so its edits are based on assumptions." Or "long prompts get truncated context and it forgets the design system." Atlan's culture round literally tests for honesty about what doesn't work.

**On the intent classifier:**

- _"Why rule-based and not another LLM call?"_ — Latency, cost, determinism. An LLM intent call would add 500ms+ to every turn for something a regex can do in 1ms. Tradeoff: brittle to phrasing, but you control it fully.
- _"How accurate is it?"_ — If you don't know, say so, and say _how you'd measure_. Confusion matrix on a labelled set of past prompts.

**On tools:**

- _"Why this specific set of tools? Why `lov-line-replace` and not just `lov-write`?"_ — Token cost. Rewriting an 800-line file when you're changing 3 lines burns budget and increases hallucination risk on the unchanged parts. Surgical edits scale better.
- _"How do you prevent the agent from doing destructive things?"_ — Sandbox isolation, no shell tool that runs arbitrary commands, file ops scoped to project base path via `resolvePath`. (Worth pointing out: there's no current rate limit per project — if asked, that's an honest gap.)

**On context management:**

- _"How do you decide what to include in the prompt?"_ — Baseline always-included files (the template defaults) + recent writes (last 5) + intent-driven file selection. Explain the tradeoff: more context = better quality but more tokens and more chance of distraction.
- _"What would you change in your context strategy?"_ — Have at least one answer. (E.g., "I'd add a retrieval step over the repo using embeddings instead of just recent-writes — the current heuristic misses files the user worked on yesterday.")

**On AI-native development (Atlan asks this explicitly):**

The JD says: _"You have rewired how you read, write, debug, and ship with AI tools — and you can describe what you do differently today versus a year ago."_

Have a specific answer ready. Generic "I use ChatGPT to debug" will lose you the point. Specific examples that would land:

- "I built `lovable` partly to understand how Cursor/Claude Code work under the hood. The agent loop in my project is a stripped-down version of what they do."
- "I write prompts as specs — for both the AI tools I use and the agent I built. Treating prompts like API contracts changed how I structure problems."
- "I started instrumenting AI calls — when I work with Claude/Cursor I now check token usage and look at how context selection affects output quality. That habit came from building the context manager in this project."

---

## In-interview script (have this ready)

When they say "walk me through a project" — start with this. Adjust to 60-90 seconds.

> "I built an open-source alternative to Lovable and Bolt.new — an AI agent that builds React apps in a sandbox from natural language prompts. The most interesting parts are the orchestration and the reliability work.
>
> Each user message goes through an agent loop running against an OpenAI-compatible API with 13 custom tools — file ops, search, dependency install, console log reads. The agent runs against a sandboxed E2B environment, so user code runs isolated.
>
> The part I'm most proud of is the self-healing build loop. After the agent thinks it's done, I run `tsc --noEmit` and `vite build`, parse the errors, filter them to only files the agent modified — so pre-existing errors don't pollute the signal — and re-prompt the agent with the structured error context. Up to 3 fixup passes for type errors, then one for build errors.
>
> I evaluated it on 20 prompts — current success rate is [X]%, most common failure mode is [Y]. The obvious next step is [Z]."

Then **stop talking** and let them drive. Don't monologue. They'll dig where they want.

---

## What NOT to do

- Don't oversell. The JD explicitly values _"honesty about what you don't know yet."_ If they ask something you didn't think about, say so.
- Don't compare yourself to Lovable/Bolt — you're not at parity, and they'll know. You're learning by building.
- Don't get defensive if they question a choice. "I picked it because it was easiest at the time and I haven't stress-tested alternatives" is a totally fine answer.

---

## Checklist (do these before the interview)

- [ ] Replace README with project-specific content + diagram + demo link
- [ ] Create `ARCHITECTURE.md` (1 page)
- [ ] Run a 15–20 prompt eval, write up `EVAL.md`
- [ ] Remove dead/commented-out code and `console.log` noise
- [ ] Add 3–5 tests in `packages/tool-tests/`
- [ ] Record a 60–90 second demo GIF or Loom
- [ ] Practice the in-interview script out loud
- [ ] Pre-write answers to the predictable questions above
- [ ] Have the repo open, demo working, and READMEs polished _before_ the call starts
