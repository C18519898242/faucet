# Faucet Internal Tool Redesign Design

## Design Read

This is an internal test-token faucet for developers and QA users. The page should feel like a clear devtool console: trustworthy, compact, and easy to scan during repeated use.

Design dials: `VARIANCE 4`, `MOTION 2`, `DENSITY 6`.

## Scope

- Preserve the existing claim flow, route, payload shape, supported networks, supported tokens, and third-party faucet links.
- Fix the visible Chinese copy so the page is readable.
- Recompose the page into a working console layout with a concise context rail and a focused claim form.
- Keep the implementation in `src/app/page.tsx`, `src/app/globals.css`, and the page tests.
- Do not add new runtime dependencies.

## Visual Direction

Use a restrained light theme with a cool gray background, white panels, blue as the single accent, and consistent 8px radii. The first viewport should communicate:

- What the tool does.
- Which networks and tokens are supported.
- The daily claim rule.
- The form actions needed to claim.

The right side remains the primary workflow. The left side carries operational context, rules, and external faucet resources.

## Behavior

- Network selection remains `Sepolia` and `TRON Shasta`.
- Sepolia shows `USDT` and `USDC`.
- TRON Shasta shows only `USDT`.
- Switching from `Sepolia + USDC` to TRON resets the token to `USDT`.
- Empty wallet submission shows a local validation error without calling `fetch`.
- Successful claims show the network-specific explorer link.
- Rejected or failed claims show readable Chinese feedback.

## Accessibility And UX

- Use semantic form controls and fieldsets.
- Keep visible focus states for inputs, radio cards, links, and buttons.
- Keep button contrast high and labels on one line.
- Make the layout responsive: two columns on desktop, one column on small screens.
- Avoid decorative-only motion and avoid theme shifts between sections.
