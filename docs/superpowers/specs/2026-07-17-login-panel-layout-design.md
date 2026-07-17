# Login Panel Layout Design

## Goal

Match the approved second visual option on the live login page without changing authentication behavior.

## Scope

Only the login-page presentation is changed. The Supabase authentication flow, form fields, validation, labels, button actions, and mode switching remain unchanged.

## Layout

- Keep the existing throne-room background and ornate login-panel frame assets.
- Place the login panel lower in the viewport so substantially more of the throne and upper hall remain visible above it.
- Keep the panel horizontally centered.
- Preserve a bottom safety margin so the frame is not clipped on normal desktop and mobile viewports.
- Make the panel interior slightly taller and vertically balanced.
- Ensure the heading, both labels, both inputs, primary button, status message when present, and both secondary actions remain inside the decorative frame.
- Inputs and primary button must be narrower than the panel's safe inner content area and must not overlap the decorative borders.

## Responsive Behaviour

- Desktop uses the approved lower placement and spacious inner layout.
- Mobile keeps all controls inside the frame with reduced padding and control heights where required.
- Short-height desktop screens use a compact variant while retaining visible throne space and an unclipped panel.
- The page must not introduce horizontal scrolling.

## Implementation Approach

Modify the existing CSS in `src/live-login.css`; do not change `AuthRoot.tsx` unless a test proves a semantic hook is required. Prefer explicit layout values and responsive overrides over restructuring the component.

## Testing

Add or update a regression test that verifies the login stylesheet contains the required safe inner sizing and lower viewport placement rules. Run the focused test first, then the complete Vitest suite, TypeScript typecheck, and production build.

## Non-goals

- No new artwork.
- No authentication or gameplay changes.
- No unrelated CSS refactor.
- No large component rewrite.
