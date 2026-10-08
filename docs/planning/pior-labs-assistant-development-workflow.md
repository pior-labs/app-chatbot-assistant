# Pior Labs assistant — development workflow

Updated: October 8, 2026

[Planning index](pior-labs-assistant-notes.md). Accepted decisions are distinguished from recommendations and open implementation details.

## Development priority: agentic success

### Accepted primary development tool

On October 8, 2026, Piotr chose Codex as the primary development tool for this project. This is separate from the household assistant's GPT-6 Luna model decision. Piotr subsequently specified Codex CLI on his device as the development interface. Coding/reviewer model choices and orchestration implementation are not yet selected; repair autonomy is accepted below.

Recommended foundation work, established alongside the accepted SSO-first stage and expanded as later capabilities are built: establish a repository foundation with AGENTS.md instructions, reproducible development and seeded test users, one deterministic verification command, CI checks, separate live-model evals based on the five core workflows, and reviewer instructions requiring inspection of code, test quality, and evidence. Use Codex for implementation and fresh-context review, following the accepted repair autonomy policy below and retaining human merge approval. A custom orchestrator remains optional.

Proposed local workflow, not yet accepted: run the coder and a fresh reviewer against the same isolated development checkout and test environment, sequentially so the reviewer inspects a stable diff. Keep acceptance criteria and concrete review findings available for handoff. Repair autonomy now follows the accepted policy below. Final merge remains a human decision. These are development permissions, separate from the household assistant's confirmation-before-app-writes policy.


Piotr wants this development cycle to deliberately invest in automated tests, evaluations, and agent code review. He has substantial experience with agentic development but wants stronger intentional verification than tests agents happen to generate along the way. He wants more of the coding-agent token budget spent on reviewing and verifying changes than on writing code.

He is considering a coder/reviewer/human feedback loop and asks whether orchestration, tests/evals, or both are appropriate. Repair autonomy is now accepted below; the remaining development workflow and its implementation are not finalized.

Recommended approach under discussion:
- Establish a reproducible local environment, documented acceptance criteria, meaningful tests, and CI before building a custom orchestrator.
- Use a coder plus a reviewer with fresh context. Give the reviewer the specification, actual diff, relevant source, and verification evidence; review test quality as well as implementation.
- Automatically repair clear defects within the agreed scope and recheck the revised code, following the accepted policy below. Involve Piotr for disputed findings, scope changes, significant architecture decisions, and final merge approval. The earlier proposed two-round limit is superseded.
- Distinguish deterministic software tests from live-model evaluations of the household assistant, and from optional later evaluations of the coding workflow itself.
- Start assistant evals with realistic household scenarios and observable expectations for tool calls, resulting state, permissions, memory, and grounded answers. Keep quick mocked checks separate from repeated live-model runs.
- Define readiness through passing required checks, satisfied acceptance criteria, resolved substantive findings, and human approval. A reviewer's opinion alone is insufficient.
- Spend review effort according to risk rather than making token consumption a success metric; favor small changes, evidence-backed findings, regression checks for real bugs, and a final concise review report.


### Accepted review and repair autonomy

On October 8, 2026, Piotr chose automatic fixing of clear, undisputed findings within the agreed task scope, continuing through review and re-verification until the change satisfies its completion criteria. No approval is required for each repair round. This supersedes the proposed fixed limit of two repair/review rounds.

Bring Piotr in for:
- Disputed findings or conflicting recommendations that require judgment.
- Scope changes.
- Significant architectural decisions.
- Final merge approval, which always belongs to Piotr.

The agents' readiness report must include passing required checks, satisfaction of acceptance criteria, and resolution of substantive review findings. Agent review alone does not authorize merging. Tests and acceptance criteria must not be weakened merely to make checks pass.

Proposed operational safeguard, not yet separately accepted: detect repeated failed attempts or lack of progress and surface the blocker rather than repeating the same repair indefinitely. Resource budgets and precise no-progress criteria remain open. The coding orchestration implementation has not been selected or built; this decision defines its desired behavior.

## Related plans

The required checks and eval gates are agreed in [verification](pior-labs-assistant-verification.md). The accepted starting point and inspected template gaps are recorded in [architecture](pior-labs-assistant-architecture.md). Future app-specific AGENTS.md and reviewer instructions should reference these contracts rather than duplicate them.
