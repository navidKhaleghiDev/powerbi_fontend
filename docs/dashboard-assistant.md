# Dashboard assistant

The client-only assistant appears only in the dashboard's existing collapsible AI chat pane. The application reads `VITE_OPENROUTER_API_KEY` from its ignored `.env` file. Users do not enter keys. Choose the free router or GPT-5.2 in the composer. Clear removes conversation history; logout, a new login, or a cross-tab refresh-token change clears conversation state and aborts pending requests.

The browser sends requests directly to the fixed official OpenRouter endpoint. No backend or proxy was added. `.env.example` contains an empty placeholder only. The configured key is embedded in the public browser bundle: an ignored `.env` prevents a Git commit, but does not make Vite values secret. Restrict its spending limit and rotate exposed keys. A confidential shared key requires a trusted server/proxy.

## Context

Only the dashboard registers context. Each request snapshots the locale, pathname, capture time, active sheet ID/name, selected widget ID, applied date/grain/income/payment filters, and up to 15 widget definitions (ID, title, visual, measures and dimensions). The selected widget, or first widget when none is selected, contributes up to eight rows already loaded by its existing TanStack Query. Only known demo measure/dimension fields are selected. Fetch time, availability, fetching status and truncation are explicit. No extra data request is made by the assistant. The conversation omits repeated context labels. A compact information control in the composer explains external processing.

Synthetic financial examples are explicitly identified as synthetic, in IRR excluding tax. Application instructions describe supported modules and explain that the model cannot inspect other records or perform writes. Database connection credentials, connector configuration, unsaved forms, auth tokens, query-cache dumps and browser storage are excluded. There are no model tools.

## Request behavior

Questions are limited to 4,000 characters; current context/question to 16,000; retained request content to 32,000. Complete historical question/answer pairs retain their original contexts. At most 12 turns remain in memory. Answer generation is capped at 1,500 tokens and displayed answers at 24,000 characters. Requests have a 60-second timeout and a minimum 1.5-second interval. Retry reuses the original question and context without adding a duplicate turn. Stop and Clear invalidate pending responses.

English/Persian labels and automatic text direction are supported. User bubbles stay physically right and assistant bubbles stay left. The composer keeps a stable send-button position in either locale; Enter submits and Shift+Enter inserts a newline, with IME composition protected. Responses render as escaped text with inert LTR fenced code blocks; HTML and scripts cannot execute. The interface distinguishes authentication, balance, throttling, model, network, timeout and malformed-response failures without echoing provider error bodies.

## Verification

Run `npm run test:assistant`, `npm run check-types`, and `npm run build`. The dependency-free test runner transpiles the TypeScript test modules with the installed compiler, runs Node tests with mocked provider responses, and removes its own temporary directory. Tests cover request assembly, paired history trimming, input limits, transport headers and endpoint, classified provider failures, malformed responses and cancellation.

A live authenticated provider/browser CORS test has not been performed. Model availability, provider charges and actual answer quality require a personal key and a browser smoke test. The application-configured key remains accessible in browser assets and requests. Set a provider spending cap. Client limits are bypassable, and cancellation does not guarantee zero charges. A secret company-funded shared key requires a trusted server/proxy outside this frontend-only implementation.

## Implementation files

- `src/lib/assistant/core.ts`: versioned product instructions, typed context, history budget, fixed transport.
- `src/lib/assistant/context.ts`: shared state contract and page-registration hook.
- `src/components/AssistantProvider.tsx`: memory state, request lifecycle and session cleanup.
- `src/components/workspace/DashboardChat.tsx`: context preview, model selection and chat controls.
- `src/components/workspace/DashboardPage.tsx`: explicit loaded-dashboard selectors.
- `src/components/WorkspaceProviders.tsx`: one shared assistant provider.
- `src/lib/api.ts`: login/logout session-change notification.
- `src/lib/env.ts`, `.env.example`: application-managed OpenRouter-key configuration with a blank tracked template.
- `public/locales/en.json`, `public/locales/fa.json`: matching assistant translations.
- `src/styles/dashboard.css`: bounded context/code display.
- `src/lib/assistant/core.test.ts`, `assistant-tests.config.mjs`, `package.json`: focused mocked tests and runner.
