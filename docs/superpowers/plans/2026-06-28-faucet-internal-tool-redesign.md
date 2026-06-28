# Faucet Internal Tool Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement inline with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the faucet page into a readable internal devtool console while preserving claim behavior.

**Architecture:** Keep the page as a single client component. Update tests first to lock visible Chinese copy, request payloads, token filtering, and external links. Then refactor markup and CSS without changing backend behavior.

**Tech Stack:** Next.js 15, React 19, TypeScript, plain CSS, Vitest, Testing Library.

## Global Constraints

- Do not add runtime dependencies.
- Preserve `fetch("./api/claim", ...)`.
- Preserve `network`, `wallet`, `token`, and `amount` payload fields.
- Preserve the third-party faucet link list.
- Use a single light theme, one blue accent, and an 8px radius system.

---

### Task 1: Test Visible UI Contract

**Files:**
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: existing `HomePage`.
- Produces: tests for readable Chinese copy, network/token behavior, result messages, and third-party links.

- [ ] Write tests that expect readable Chinese labels such as `接收钱包地址`, `领取测试币`, `交易已发送`, and `第三方公共 Faucet`.
- [ ] Run `npm test -- src/app/page.test.tsx` and confirm the tests fail against the current mojibake UI.

### Task 2: Redesign Page Markup

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `NETWORKS`, `getSupportedTokens`, `packageJson.version`.
- Produces: a console layout with left context rail, right claim form, readable feedback, and unchanged claim submission behavior.

- [ ] Replace mojibake strings with readable Chinese.
- [ ] Add a context rail for supported networks, daily rules, and external faucets.
- [ ] Keep form semantics with fieldsets, labels, radio inputs, and submit button.
- [ ] Run `npm test -- src/app/page.test.tsx` and confirm tests pass.

### Task 3: Redesign Styling

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: class names from `HomePage`.
- Produces: responsive internal-console styling.

- [ ] Replace the centered card with a responsive two-column workspace.
- [ ] Add polished states for cards, fields, radio options, links, notices, and buttons.
- [ ] Verify mobile layout collapses to one column without clipped text.

### Task 4: Verification

**Files:**
- Verify all changed files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Review the final diff for unrelated changes.
