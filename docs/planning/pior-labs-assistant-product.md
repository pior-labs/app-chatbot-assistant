# Pior Labs assistant — product decisions

Updated: October 8, 2026

[Planning index](pior-labs-assistant-notes.md). Accepted decisions are distinguished from recommendations and open implementation details.

## Product direction

Piotr is planning the next Pior Labs application after largely finishing Cookbook: a ChatGPT-style household assistant connected to calendar, Cookbook, finance, and other important services through MCP.

Treat the web chat and messaging access as one product with a shared assistant backend. The backend owns model calls, conversations, context, identity, permissions, and tool execution. A messaging adapter provides another interface to that same backend.

Host within Pior Labs (szarans.ca), which is separate from the media server homelab. Reuse platform auth, design, and deployment conventions. Remote messaging should work without requiring the phone to join Tailscale; internal services need not all become public.

## Accepted feature direction

On October 8, 2026, Piotr accepted all the proposed chat features below as the desired feature direction. He wants to build these himself. The accepted high-level order is working SSO, then UI design, then incremental feature implementation, as recorded in the planning index. Detailed feature ordering and initial release scope remain open; the earlier feature-priority suggestions are not a committed roadmap.

| Feature                  | Intended behavior                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Chat experience          | Streaming responses, Markdown, code blocks, copy, stop, retry, and mobile layout.                  |
| Past chats               | Persist messages; reopen conversations; generate titles; rename, archive, and delete chats.        |
| Conversation context     | Supply relevant messages and tool results to the model; summarize older content when threads grow. |
| MCP tools                | Connect apps, execute tools, and display progress, results, and failures.                          |
| User accounts            | Pior Labs SSO with separate conversations, memory, and permissions per user.                       |
| Custom instructions      | Persistent preferences for assistant responses and behavior.                                       |
| Long-term memory         | Save useful facts and preferences for future conversations.                                        |
| Chat search              | Find earlier discussions by title or message content.                                              |
| Attachments              | Upload recipe screenshots, images, and documents.                                                  |
| Reasoning mode selection | Choose Everyday or Thinking; both use GPT-6 Luna with different reasoning effort.                  |
| Edit and branch          | Revise prompts or explore alternatives while preserving the original conversation.                 |
| Projects or spaces       | Group conversations with shared instructions, files, and context.                                  |

Supporting capabilities discussed: usage/cost tracking, durable execution records, and avoiding duplicate app mutations when retrying failed responses.

## Memory design considerations

Keep stored chat history, active conversation context, durable memory, recall of previous chats, and live connected-app data distinct. Merely storing transcripts does not automatically give the assistant long-term memory.

Personal and household memory scopes, permission-based saving, and the basic management UI and editing rules are accepted, as recorded below. Source provenance, retrieval details, and detailed UI design remain open. Query changing schedules and meal plans from their source apps rather than relying on old memories.

### Accepted memory scopes

On October 8, 2026, Piotr chose both personal and household memory:

- Personal memory: information about an individual, such as a hobby they like; owned by that user and available to their assistant conversations.
- Household memory: shared household information, such as a pasta dish Piotr made that both he and Natalie liked; available to household members' assistant conversations.

These are illustrative product examples, not newly asserted real-world personal facts.

Proposed implementation rules, still under discussion:

- Retrieve relevant memories from the current user's personal scope and the household scope. Enforce scope access in the backend before supplying information to the model.
- Preserve whose preference is being described, independently of the memory's visibility. A household-scoped memory can describe one member's food preference without implying that every member shares it.
- Do not infer a shared preference from a statement about only one person. Default unclear scope to personal or ask before sharing.
- Sharing a memory extracted from a private conversation does not share the full source conversation. Source links and chat recall must still respect conversation permissions.
- Display Personal or Household when a memory is saved and allow users to inspect and correct its scope, subject to access rules. Either household member may manage household memories, as recorded below.
- Where useful, link shared recipe preferences to a Cookbook recipe rather than storing a duplicate copy of its changing content.

### Accepted memory saving policy

On October 8, 2026, Piotr chose memory suggestions with permission before saving, from the initial version. The assistant may identify useful candidate memories during conversation and ask whether to save them. It must not silently save personal or household memories. This supersedes earlier proposals to start with explicit requests only or to save personal memories automatically.

Recommended interaction, with UI details still open:

1. Propose the exact fact or preference and its Personal or Household scope.
2. Ask permission and offer Save, Edit, or Skip.
3. Save only the approved content and scope after an affirmative response. Silence, rejection, or changing the topic is not approval.
4. Keep unapproved candidates out of durable-memory retrieval. Chat history can retain the original conversation under its own permissions.

Proposed implementation/verification rules: enforce approval in backend code rather than relying only on the model's prompt; bind approval to the displayed content and scope; avoid duplicate writes on retries; propose substantive memory changes or scope changes for approval too. Avoid frequent interruptions by suggesting only durable, useful information and not repeating declined suggestions in the same conversation. Exact suggestion frequency and consent handling for explicit “remember this” requests can be specified later; there is no authorized silent-saving exception.

### Accepted memory management policy

On October 8, 2026, Piotr accepted a simple memory settings page with Personal and Household views:

- Each user can view, edit, and delete their own personal memories.
- Either Piotr or Natalie can view, edit, and delete household memories, regardless of who originally saved them.
- Assistant-proposed changes through chat still require a preview and affirmative confirmation.
- A user's explicit Save or Delete action in settings authorizes that direct change; no second household member's approval is required.

Household memory access does not expose either user's private source conversation. Exact layouts, provenance displays, and retrieval/index update mechanics remain implementation details. Suggested verification should cover personal isolation, editing shared memories created by the other member, and removal or correction of memories in future retrieval.

## Accepted initial action policy

On October 8, 2026, Piotr chose to start with confirmations before assistant actions that change connected apps or durable memories. More automation may be considered later; it is not part of the initial authorization policy.

Reads, searches, and drafting can proceed without an additional action confirmation. Creating, updating, or deleting recipes, calendar events, and personal or household memories requires a preview and affirmative confirmation before execution. Routine conversation persistence follows the chat-history policy.

Proposed implementation: prepare the change, show its concrete content and destination, allow Confirm/Edit/Cancel, execute the approved change, and report the actual result. Bind approval to that specific action and payload in backend code, require renewed approval after material changes, and prevent duplicate mutations on retries. Later automation could be explicitly enabled for selected actions once their behavior is reliable. Calendar conflict handling remains open.

## Accepted conversation continuation policy

On October 8, 2026, Piotr accepted reopening saved threads plus recalling previous conversations on request from a new chat as the initial behavior.

- Reopening a saved thread resumes its existing context, including any relevant older-content summaries.
- A request such as “Let's continue that camping plan” in a new chat may search the current user's previous conversations and retrieve relevant context.
- Ask which conversation the user means if several plausible matches exist; do not silently choose an ambiguous plan.
- Make it clear when an earlier conversation is used. Automatic cross-chat searching without a user request is deferred.
- Each user can recall only their own conversations. Household memories are shared separately and do not grant access to private source chats.

Proposed verification: preserve prior decisions and unresolved items, retrieve the appropriate thread, handle ambiguous and missing matches, enforce user isolation, and recheck changing connected-app information. Search/indexing details and UI presentation remain implementation decisions.

## Calendar provider discussion

On October 8, 2026, Piotr said he and Natalie mainly use Apple Calendar and are open to Google if Apple is harder to integrate. The provider has not been chosen.

Separate the calendar client from the account hosting its events: the Apple Calendar app can display and sync a Google calendar. Using Google for the assistant does not require changing their phone calendar app.

Research checked October 8, 2026: Google documents a REST Calendar API, client libraries, OAuth, and event management. Apple documents authorized third-party access to iCloud Calendar and an app-specific-password fallback; CalDAV is a candidate integration route whose account discovery, shared-calendar behavior, and read/write operations should be proven before committing. Do not assume a custom app can use Apple's newer account authorization without checking its developer availability.

Recommendation under discussion: use one shared Google Household calendar for initial assistant scheduling while retaining Apple Calendar as the phone interface. This is an engineering simplicity judgment, not an accepted provider decision. Existing iCloud events do not automatically migrate or become visible to a Google-only assistant. The accepted initial scope is one shared household calendar, as recorded below. Calendar conflict handling remains open.

### Accepted initial calendar scope

On October 8, 2026, Piotr confirmed that a shared household calendar is sufficient initially. The assistant will read and, after confirmation, write to that shared calendar. Individual calendar access and personal availability checks are deferred. It must not claim that either person is free based solely on the household calendar. Google hosting remains the recommended option; the user's reply confirms the shared scope without separately finalizing the provider.

Sources:

- https://developers.google.com/workspace/calendar/api/guides/overview
- https://support.google.com/calendar/answer/99358?co=GENIE.Platform%3DiOS
- https://support.apple.com/en-us/121539
- https://developer.apple.com/documentation/eventkit/eksourcetype/caldav

## Accepted core workflows

On October 8, 2026, Piotr selected these five core workflows to guide the product and its acceptance criteria/evaluations:

1. Import a recipe from a screenshot.
2. Discuss creating a recipe using household ingredients, refine it through conversation, and then add it to Cookbook.
3. Ask the assistant to block off time in the calendar for an event.
4. Remember a household preference, using “Natalie doesn't like peanuts” as an illustrative example. This is an example for product design, not a confirmed real preference or allergy.
5. Continue an earlier planning conversation.

Proposed behavior and verification points, not yet finalized requirements:

| Workflow          | Proposed behavior                                                                                                                                                                                                       | Verification focus                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screenshot import | Extract a recipe draft, make uncertainty visible, preview it, and save through Cookbook after confirmation.                                                                                                             | Faithful ingredient quantities and units; do not silently invent unreadable content; no duplicate saves on retries.                                                                   |
| Recipe creation   | Use ingredients supplied by the user, relevant household preferences, and conversational revisions; preview and confirm the selected final recipe before saving. Pantry inventory integration is not assumed.           | Respect constraints and latest edits; distinguish proposed ingredients from ingredients the user actually has; save the final agreed version.                                         |
| Calendar event    | Resolve title, calendar, date, start/end or duration, and timezone; ask for missing material details; preview and confirm before creation; report the actual creation result. Conflict behavior still needs a decision. | Correct time/calendar, appropriate clarification, no duplicate events, and no false success report.                                                                                   |
| Household memory  | Propose a preference and household scope, ask permission, save only after approval, and retrieve it for relevant future tasks. Support inspection, editing, and deletion.                                               | No save without permission; preserve who the preference concerns; do not turn a dislike into an allergy; apply it across relevant chats and respect updates/removal and access rules. |
| Continue planning | Reopen and resume a saved thread, or retrieve relevant prior conversations from a new thread when the user asks. Clarify ambiguous matches and respect user access boundaries.                                          | Preserve prior decisions and unresolved items; handle ambiguous references; recheck live app facts that may have changed.                                                             |

These workflows do not finalize feature ordering within the accepted SSO → UI → implementation stages. Finance remains in the intended integration scope even though it is not one of these five initial core scenarios.

## Accepted model and mode decision

On October 8, 2026, Piotr chose GPT-6 Luna (`gpt-6-luna`) for both modes. The two modes differ only in reasoning effort:

| Mode               | Model      | Reasoning effort |
| ------------------ | ---------- | ---------------- |
| Everyday (default) | GPT-6 Luna | Low (`low`)      |
| Thinking           | GPT-6 Luna | High (`high`)    |

Sol was considered too expensive for the Thinking tier. There is no separate higher-cost model tier in the initial design. This supersedes the earlier general model-switching feature: initially provide a reasoning-mode selector using one model. Multiple models could be considered later if evaluations demonstrate a need.

Both modes have the same access to history, memory, attachments, permissions, and MCP tools. Higher reasoning can use more tokens and time even though the model's token rates stay the same.

Proposed switching behavior, not yet separately finalized: apply a mode change to the next request, retain it for subsequent messages in the conversation, and record the model and reasoning effort with each response. Preserve ongoing tool execution and prior action results so switching never replays completed actions. Compare both modes using household eval scenarios.

## Related plans

Technical baseline and integration implementation belong in [architecture](pior-labs-assistant-architecture.md); developer automation belongs in [development workflow](pior-labs-assistant-development-workflow.md); check/eval gates belong in [verification](pior-labs-assistant-verification.md). High-level stages are accepted in the planning index; detailed feature ordering and release scope are not finalized.
