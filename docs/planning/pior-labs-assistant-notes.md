# Pior Labs assistant — planning index

Updated: October 8, 2026

This file is the entry point for the assistant plan. On October 8, Piotr approved using the Pior Labs webapp template and splitting the working notes when useful. The previous single document has been reorganized by topic. This repository's versioned planning documents are the source of truth going forward.

## Documents

| Document | Owns |
| --- | --- |
| [Product decisions](pior-labs-assistant-product.md) | Feature direction, five core workflows, model/modes, memory permissions, confirmations, chat continuation and calendar scope. |
| [Architecture and integrations](pior-labs-assistant-architecture.md) | Accepted template starting point, inspected source baseline, platform ownership, proposed app modules, messaging and background behavior. |
| [Development workflow](pior-labs-assistant-development-workflow.md) | Local Codex CLI, independent review, automatic fixing, human escalation and human-only merge approval. |
| [Required verification](pior-labs-assistant-verification.md) | Test/build/browser/provider/review gates, deterministic invariants, live eval cases and initial thresholds, evidence requirements. |

## Repository

Application repository: [pior-labs/app-chatbot-assistant](https://github.com/pior-labs/app-chatbot-assistant), created from the Pior Labs webapp template. The repository name is settled; the application slug, OAuth client ID, cookie prefix and canonical hostname still require explicit selection during SSO setup.

## Accepted decisions at a glance

- One household assistant product, with web chat first and messaging access to revisit.
- Start from `pior-labs/template-webapp` and reuse platform auth, design and deployment conventions.
- GPT-6 Luna with Everyday/low and Thinking/high; same tools and permissions in both modes.
- Personal and household memory, with permission before assistant saves; personal memory is private and either member can manage household memory.
- Confirmation before connected-app changes; more automatic household actions may be considered later.
- Reopen saved threads and recall past chats on request; personal chats remain private.
- One shared household calendar initially; individual calendars deferred. Google hosting is recommended but has not been separately finalized.
- Codex CLI on Piotr's device; clear in-scope fixes proceed automatically. Disputes, scope changes and significant architectural decisions go to Piotr; final merge approval always belongs to him.
- Required verification policy accepted, including repeated live evals in both modes and initial gates. These are plans; the repository currently contains the template scaffold. Assistant features and the described verification tooling are not yet implemented.

## Accepted development stages

On October 8, 2026, Piotr chose this high-level order:

| Stage | Objective | Detail owner |
| --- | --- | --- |
| 1. Working SSO | Start from the template and make application login/session handling work with existing service-auth. Shared-template changes are optional, not a prerequisite. | [Architecture](pior-labs-assistant-architecture.md) |
| 2. UI design | Establish the chat interface, layout and main interactions through a reviewable UI/prototype before implementing the assistant capabilities. | [Product](pior-labs-assistant-product.md) |
| 3. Incremental capabilities | Implement the agreed chat, history, attachments, MCP actions, memory, recall and other features in manageable steps. | [Product](pior-labs-assistant-product.md) |

The agreed tests, review workflow and reproducible environment begin alongside stage one and grow with each stage; verification is not deferred until feature development is complete. Detailed feature order, release scope and messaging/background timing remain open.

## Outstanding decisions

1. Assistant architecture details: model/tool orchestration, streaming, attachment storage, memory/recall retrieval and action execution records.
2. Smallest useful release and detailed feature milestones within the accepted SSO → UI → implementation order; feature direction is broader than a committed first-release scope.
3. Application display name/slug, OAuth client ID, cookie prefix and canonical hostname; the repository is `pior-labs/app-chatbot-assistant`.
4. Calendar provider and conflict behavior; shared-only scope is settled.
5. Reasoning-mode switching behavior and remaining memory consent/provenance/UI details.
6. Codex orchestration mechanism, coder/reviewer model choices, resource budgets and no-progress detection.
7. Household model usage budget, latency expectations, retention and operational visibility.
8. Messaging channel availability/identity/access and proactive/background jobs.

## How to maintain the plan

Each topic document owns its detailed requirements. Keep this index concise and link to the owning document. Mark new ideas as proposals until accepted; record changed decisions explicitly. Check the current repository state before turning assumptions into implementation plans.
