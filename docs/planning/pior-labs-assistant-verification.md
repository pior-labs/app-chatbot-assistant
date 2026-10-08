# Pior Labs assistant — required verification

Updated: October 8, 2026

[Planning index](pior-labs-assistant-notes.md). Accepted decisions are distinguished from recommendations and open implementation details.

## Accepted required verification checks — v1

On October 8, 2026, Piotr accepted the verification policy below: static/build checks, deterministic tests, browser verification, live assistant evals, provider integration checks, and independent review. He also accepted the initial repeated-eval setup and starting thresholds, to be calibrated from the first baseline. This is an agreed development policy, not implemented tooling or a claim that checks have run. Checks apply as capabilities are built; unimplemented features are not represented by empty passing tests. Release scope and framework choices remain open.

### Gates and triggers

| Gate | Required when | Pass condition |
| --- | --- | --- |
| Static checks and production build | Every code, runtime configuration, or dependency change | Formatting validation, lint, type checks, and production build succeed using documented commands. |
| Deterministic unit/integration suite | Every code change before ready-for-review | Existing suite passes; changed material behavior and fixed bugs have appropriate regression coverage. Test real backend/application code and a disposable database; substitute external model/provider calls with scripted fixtures. |
| Browser smoke and affected journeys | Smoke suite for every application code change; expanded affected-flow checks for UI or workflow changes | Observable user journeys succeed, including state after reload. Check mobile layout and keyboard operation when interface changes affect them. Keep isolated users/data and record failure traces. |
| Live assistant evals | Model, reasoning effort, prompts, tool schemas, orchestration, retrieval, summarization, image parsing, or confirmation behavior changes; also before a release of implemented assistant capabilities | Repeated multi-turn runs in both Everyday and Thinking meet the critical-rule and task-success gates below. Relevant eval subset during development; complete implemented suite for release. Pure style changes need no live eval unless they alter behavior. |
| Provider/adapter integration checks | New or changed connected-app adapter, auth integration, SDK/protocol dependency, or tool contract | Fixture/contract checks pass and the adapter is exercised against the actual service in a disposable sandbox when available. Verify creation/readback/update/removal and permission failures for supported operations. If unavailable, label verification blocked; do not claim mocks prove the real connection. |
| Independent agent review | Every meaningful implementation change before ready-for-review | Fresh reviewer examines the final diff, source, requirements, test quality, and evidence; substantive findings are resolved or explicitly escalated to Piotr. A code change after review requires review of the changed portion and rerunning affected checks. |

Documentation-only changes require a content/links review and any relevant documentation checks, rather than the full app test suite. During automatic fixes, use focused checks for feedback; run the complete required deterministic suite on the final revision. Final evidence must identify the verified commit/revision. Local and CI deterministic checks should use the same commands. A green earlier revision is not sufficient.

Proposed command interface: one documented deterministic verification command (for example `pnpm verify` if pnpm is chosen), with separate commands for live evals and sandbox provider checks. These are proposed command names, not existing scripts. Paid/live provider access must not be required by the deterministic command.

### Mandatory deterministic invariants

Exercise backend routes/tool execution directly, not only the UI:
1. No connected-app mutation or assistant-proposed memory save/update/delete without valid affirmative approval. Cancel, silence, and rejected approval perform no mutation. Reads and drafts remain allowed within permissions.
2. Approval belongs to the current user, a specific action, destination, content, and memory scope. It cannot authorize a materially edited payload or another user's action. Direct settings Save/Delete is explicit user authorization; it does not require the other household member's approval.
3. Personal chats, memories, attachments, and recall are isolated per user. Both household members can manage shared memories, including those created by the other member. A shared memory never exposes its private source transcript.
4. Retries, repeated clicks, and resumed requests do not blindly repeat a completed mutation. Simulate timeout after upstream success. If success is uncertain, reconcile provider state where possible or report the uncertainty without automatically repeating the write.
5. Failed or unknown tool outcomes never produce an unqualified success report. Invalid inputs, expired/revoked credentials, and provider errors are handled accurately.
6. Persisted conversations and latest edits survive reload/restart; memory updates/deletions stop stale facts from being retrieved in subsequent chats. Exercise migrations against disposable data when schema changes.
7. Calendar payloads preserve approved dates, duration, calendar, and timezone, including daylight-saving boundaries. Do not claim individual availability from a shared calendar alone. Conflict handling awaits a product decision.
8. Untrusted recipe text, retrieved content, and tool output cannot grant permissions or approve writes. Script malicious model/tool proposals to verify backend enforcement. Include matching instruction-following cases in live evals.

No coverage percentage quota or blanket requirement to test trivial helpers. Tests must assert meaningful outcomes; mocks should replace external boundaries rather than bypass the behavior being verified. For fixed bugs, the regression test should demonstrate the defect on the unfixed code where practical. Never skip assertions, weaken criteria, or delete failing tests merely to obtain a green result; legitimate requirement changes go to Piotr.

### Browser journeys

As the corresponding features are implemented, cover sending/streaming/stopping a message, reopening a persisted chat, attachment upload and recipe preview, confirmation/cancellation and result display, personal/household memory management, and requested past-chat recall. Use seeded identities and isolated storage. Assert UI behavior plus resulting persisted state where appropriate. Keep provider/model responses scripted here so a browser failure identifies an app defect rather than stochastic output.

### Live assistant evaluation dataset and grading

Use the real application prompts, context assembly, permissions, tool loop, memory/recall logic, and actual Luna calls. Replace connected-app destinations with isolated fixtures/test resources, never production household data. Provide real image fixtures for screenshot cases. Script user clarifications, approval, editing, and cancellation in multi-turn conversations.

Start with three meaningful variants for each of the five core workflows: happy path, ambiguous or revised input, and failure/cancellation. That gives 15 base scenarios once all workflows exist. Run each three times in each mode: 90 scenario runs, each potentially containing multiple model calls. Add explicit permission/injection/retry edge cases; do not force scenarios irrelevant to a workflow merely to achieve a count. During development run the affected scenarios in both modes; before release run all implemented scenarios. Version fixtures, expectations, model/mode configuration, prompts, and results.

| Workflow | What success means |
| --- | --- |
| Screenshot recipe import | Preserve readable quantities/units; flag unreadable content rather than inventing it; show the draft; write the approved version only, once. |
| Household-ingredient recipe creation | Respect supplied ingredients, relevant approved preferences, and latest revisions; do not assume a pantry inventory exists; save only the approved final recipe. |
| Shared calendar event | Resolve material missing details, preserve date/time/timezone and shared calendar destination, request confirmation, and report the verified result or uncertainty. |
| Personal/household memory | Propose useful text and appropriate scope, save only after consent, retrieve only permitted approved facts, respect correction/deletion, and distinguish a dislike from an allergy. |
| Continue planning | Resume the selected thread or retrieve the correct past conversation on request; clarify plausible competing matches; preserve decisions and unresolved items; respect private-chat access and query live app facts when needed. |

Grade tool name/arguments, approval order, access scope, and resulting state with code assertions wherever possible. Grade clarification, fidelity to source, and grounded final responses using explicit scenario rubrics; optionally use a separate model judge for qualitative criteria, calibrated against Piotr's judgments. The coder or reviewer saying the output looks good is not the score. Do not require exact answer wording or one rigid valid tool-call sequence.

Accepted initial gates, to be calibrated with the first baseline:
- Zero observed critical violations across all runs: unauthorized writes/access, mutation of the wrong approved payload, duplicate writes, fabricated confirmed success, or leakage of private source chats. These fail the gate regardless of average score; zero observed violations in a small sample is not proof of impossibility.
- At least 90% scenario success separately in each mode; each individual base scenario must also pass at least two of its three runs in each mode. A high overall average must not hide a consistently failing workflow. Failures in already supported core behavior are investigated even if the aggregate meets the threshold.
- Compare against the stored baseline. Critical-rule regressions block; substantive task-success regressions require repair or Piotr's decision. Do not silently lower thresholds or rerun only failed cases until they happen to pass. Provider outages are recorded as blocked/inconclusive, not passing or silently removed from the denominator.

These percentages and repetition counts are accepted initial project settings, not universal benchmarks or established performance. Threshold changes require an explicit product decision by Piotr; the repair loop may not silently relax them. Cost, latency, and number of tool calls are recorded; firm budget/latency thresholds await a budget decision. Expand the suite with genuine bugs, failed scenarios, and use-case gaps. Finlens receives appropriate read-only contract/access tests and evals when integrated; it remains in scope despite not being one of the five initial workflows.

### Evidence and human merge

The final review handoff includes the tested revision, change and acceptance criteria, exact check commands/results, relevant test traces, live eval counts/scores by mode and workflow when required, comparison to baseline, resolved/escalated findings, and any blocked or omitted checks with reasons. All required applicable checks must pass before agents declare ready-for-review. Piotr alone approves final merge; exceptions or unresolved judgments are surfaced explicitly.

Sources informing this design, checked October 8, 2026:
- https://playwright.dev/docs/best-practices — user-visible behavior and isolated tests.
- https://developers.openai.com/api/docs/guides/evaluation-best-practices — task-specific objectives, typical/edge cases, continuous evaluation, and evaluating tool selection/arguments. The project can own its eval runner; this proposal does not select a hosted eval product.

## Related plans

[Product requirements](pior-labs-assistant-product.md), [architecture and baseline gaps](pior-labs-assistant-architecture.md), and [automatic review/repair permissions](pior-labs-assistant-development-workflow.md) define the requirements behind these checks.
