# RoyalStory Login Design

## Goal

Replace the existing authentication screen with a distinctive RoyalStory login experience that feels like a premium royal fantasy game while preserving the current Supabase authentication flow.

## Scope

The first version includes:

- Sign in with email and password.
- Create account.
- Forgot password.
- Loading, validation, success, and error states.
- Responsive desktop and mobile layouts.
- Layered visual effects with animated fire.

Guest login, social providers, character selection, account management, and changes to the underlying authentication model are outside this scope.

## Visual Direction

RoyalStory should have its own recognizable visual identity rather than copying another game. The core identity is:

- Deep royal purple backgrounds.
- Warm gold frames and ornamentation.
- Ivory and pale stone surfaces for readable content.
- Crown motifs, banners, columns, and throne-room architecture.
- Warm orange firelight used as an accent rather than the dominant color.

The scene uses a dark palace environment with a lighter login panel to keep the form readable.

## Layered Scene

The screen is composed of independent layers so effects can animate and scale without changing the complete background image.

From back to front:

1. Static throne-room or palace background.
2. Decorative columns, banners, and side ornaments.
3. Left and right braziers.
4. Animated flames.
5. Fire glow and subtle rising particles.
6. Low-opacity floor mist.
7. RoyalStory logo.
8. Authentication panel.

The decorative layers must not intercept pointer input.

## Intro Sequence

On the first render of the login screen:

1. The screen fades in from black.
2. The left and right flames appear in a short staggered sequence.
3. The RoyalStory logo moves gently into place and fades in.
4. A brief gold shimmer passes across the logo.
5. The authentication panel fades and rises into place.

The complete sequence should take approximately two seconds. Users must be able to interact as soon as the form is visible. The sequence must not replay when switching between sign-in, registration, and password-reset modes.

When `prefers-reduced-motion: reduce` is enabled, all essential content appears immediately and nonessential movement, shimmer, particles, mist, and pulsing glow are disabled or reduced to a static state.

## Authentication Panel

The centered panel uses an ivory or pale stone surface with a gold ornamental frame, restrained corner decoration, and strong contrast.

### Sign-in mode

- Email field.
- Password field.
- Primary `Logga in` button.
- Secondary `Skapa konto` action.
- Tertiary `Glömt lösenord?` action.

### Registration mode

- Email field.
- Password field.
- Password confirmation if required by the current application flow.
- Primary `Skapa konto` button.
- Secondary action returning to sign in.

### Password-reset mode

- Email field.
- Primary action to send the reset link.
- Secondary action returning to sign in.

Existing Supabase methods, session behavior, redirects, and auth-state handling remain the source of truth. The redesign changes presentation and interaction states, not account semantics.

## Interaction States

- Buttons use a gold treatment with clear hover, focus, pressed, disabled, and loading states.
- Pressed buttons move only slightly to avoid a toy-like effect.
- Inputs use visible labels rather than placeholder-only labels.
- Validation and Supabase errors appear inside the panel near the relevant controls or in a dedicated status area.
- Error messages remain readable by assistive technology and do not rely on color alone.
- Successful password-reset submission displays a clear confirmation.
- Submitting disables duplicate submissions until the request completes.

## Animation Strategy

Animated fire should be implemented as a lightweight independent effect. Preferred implementation order:

1. CSS or SVG flame layers when they achieve acceptable quality.
2. A compact transparent sprite sheet when a more illustrated effect is required.
3. Canvas or WebGL only if the existing implementation already justifies that complexity.

No autoplaying video is required for the first version.

Fire glow should be a separate blurred layer with subtle scale and opacity variation. Particles should be sparse and limited. The logo shimmer should run once during the intro rather than loop continuously.

## Responsive Behavior

### Desktop and large tablet

- Full palace composition is visible.
- Both braziers and major banners remain present.
- The login panel is centered with generous surrounding space.
- Decorative elements frame the panel without overlapping it.

### Mobile

- The panel becomes the primary visual element and fits within the viewport with safe padding.
- Background composition is cropped deliberately around its central focal point.
- Secondary columns, particles, mist, and other expensive decorations may be reduced or hidden.
- Flames may be smaller and positioned near the lower corners, provided they do not reduce form readability.
- The layout supports narrow screens without horizontal scrolling.
- The on-screen keyboard must not hide the active field or primary action.

## Asset Rules

- All visual assets must be original to RoyalStory or generated specifically for this project.
- Do not use MapleStory logos, characters, maps, or extracted game assets.
- Large raster assets should use modern compressed formats where supported.
- Every decorative asset must have a graceful fallback so authentication remains usable if an asset fails to load.

## Accessibility

- Use semantic form controls and buttons.
- Every field has a programmatically associated label.
- Keyboard navigation follows a logical order.
- Focus indicators are clearly visible against purple, gold, and ivory surfaces.
- Text and controls meet practical contrast requirements.
- Decorative imagery is hidden from screen readers.
- Status and error messages use appropriate live-region behavior.
- Reduced-motion preferences are respected.

## Architecture

The feature should be split into focused units that follow the existing React structure:

- An authentication container that owns mode, submission state, and existing Supabase calls.
- A presentation-focused auth panel for fields, actions, and messages.
- A scene component for background and decorative layers.
- Small isolated visual components for flames, glow, particles, mist, and logo treatment where useful.
- Dedicated styles or style modules for scene layering, responsive behavior, and motion preferences.

Authentication logic must not be duplicated inside visual-effect components.

## Error Handling and Fallbacks

- Supabase errors are translated into concise user-facing Swedish messages where the application already supports that behavior.
- Unknown errors receive a generic retry message without exposing sensitive details.
- Missing or failed decorative assets do not block the form.
- Unsupported animation features fall back to static visual layers.
- The form remains functional when animations are disabled.

## Testing

The implementation must cover:

- Rendering sign-in mode.
- Switching between sign-in, registration, and password-reset modes.
- Successful and failed submissions through mocked authentication boundaries.
- Disabled/loading behavior during submission.
- Accessible labels, status messages, and keyboard operation.
- Responsive layout checks for representative desktop and mobile viewport sizes.
- Reduced-motion behavior.
- Existing project verification commands: `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## Success Criteria

The work is complete when:

- The login screen is immediately recognizable as RoyalStory through its purple, gold, ivory, crown, and palace visual language.
- Desktop presents the complete layered throne-room scene.
- Mobile presents a simplified but coherent version without horizontal overflow.
- Fire and supporting atmosphere animate smoothly without preventing interaction.
- Reduced-motion users receive an immediate, stable interface.
- Sign in, account creation, and password reset continue to use the existing Supabase authentication behavior.
- Loading, error, and confirmation states are clear and accessible.
- Tests, type checking, and production build pass.
