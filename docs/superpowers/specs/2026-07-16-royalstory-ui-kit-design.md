# RoyalStory UI Kit v1 Design Specification

## Goal

Create a reusable visual system for RoyalStory that gives the login screen, menus, inventory, equipment, shop, battle UI, settings, and loading screens one consistent stylized mobile-MMORPG identity.

The system must feel royal, warm, readable, and game-like rather than resembling a generic web application.

## Approved Art Direction

RoyalStory uses a **stylized mobile MMORPG** direction.

The style should have:

- soft, readable shapes;
- strong silhouettes and clear borders;
- rich but controlled color;
- decorative royal details without reducing usability;
- large touch targets and clear information hierarchy;
- original RoyalStory identity rather than imitation of another game.

## Core Visual Identity

### Brand symbol

The primary symbol is a royal crown with one central purple gemstone.

The crown and gemstone may appear in:

- the RoyalStory logo;
- loading indicators;
- app and favicon artwork;
- banners and seals;
- modal headers;
- premium or important actions;
- decorative dividers.

The crown must remain recognizable at small sizes and must not depend on fine detail alone.

### Color palette

Use the following canonical design tokens:

| Token | Hex | Purpose |
|---|---:|---|
| Royal Purple 900 | `#24122F` | Deep backgrounds and strong contrast |
| Royal Purple 700 | `#4B245F` | Primary purple surfaces |
| Royal Purple 500 | `#75408A` | Active accents and selected states |
| Royal Gold 700 | `#A97825` | Dark metallic borders and shadows |
| Royal Gold 500 | `#D6A943` | Primary gold accents |
| Royal Gold 300 | `#F1D477` | Highlights and illuminated edges |
| Ivory Stone 100 | `#FFF9E9` | Bright panel interiors |
| Ivory Stone 300 | `#EADDBF` | Main panel surfaces |
| Ivory Stone 500 | `#C9B78F` | Stone borders and disabled surfaces |
| Crimson Velvet 700 | `#6F203A` | Deep banners and warning accents |
| Crimson Velvet 500 | `#A83B55` | Fabric highlights and destructive emphasis |
| Moonlight Blue 500 | `#7C9FD1` | Cool environmental light |
| Fire Amber 500 | `#F29A32` | Fire, glow, and warm highlights |
| Fire Amber 300 | `#FFD36B` | Flame cores and luminous focus |
| Ink 900 | `#211728` | Primary text on light surfaces |
| Ink 100 | `#FFF8EA` | Primary text on dark surfaces |

Color should communicate hierarchy. Gold is reserved for primary actions, selected states, premium emphasis, and important framing. It must not cover every element.

### Materials

The design language is built from four recurring materials:

1. **Ivory stone** — main readable panels and architectural surfaces.
2. **Antique gold** — borders, crowns, ornaments, and premium interaction states.
3. **Royal velvet** — banners, tabs, ribbons, and deep colored surfaces.
4. **Purple crystal** — gems, magical indicators, selected states, and special rarity emphasis.

Materials should use simplified painted shading rather than photorealistic textures.

## Typography

### Display typography

Use an elegant fantasy serif for logos, major screen titles, chapter titles, and modal headings. Until a dedicated licensed font is selected, use this fallback stack:

```css
font-family: Georgia, "Times New Roman", serif;
```

Display text should use moderate contrast, broad letterforms, and controlled gold highlights. Avoid highly ornamental fonts for body copy.

### Interface typography

Use the existing system sans-serif stack for labels, values, descriptions, buttons, and form controls.

Text must remain readable at mobile sizes. Do not place important information only in embossed or low-contrast gold text.

## Shape Language

- Main panels use rounded rectangular silhouettes with decorative corners.
- Corners should feel carved or forged, not modern glassmorphism.
- Primary panels use medium radius values between 16 and 24 pixels.
- Small controls use 8 to 12 pixel radii.
- Borders use layered treatment: dark outer edge, gold midline, light inner bevel.
- Touch controls must be at least 44 pixels high.

## Component System

### Royal panel

The standard panel contains:

- an ivory-stone interior;
- an antique-gold outer frame;
- a subtle inner bevel;
- decorative corner ornaments;
- a soft drop shadow;
- optional velvet title ribbon.

Variants:

- `default` — general content;
- `dark` — combat or dramatic content;
- `modal` — focused dialogs;
- `compact` — tooltips and small summaries;
- `legendary` — premium or major rewards.

### Buttons

#### Primary

- gold gradient surface;
- dark purple or ink text;
- bright top edge and darker bottom edge;
- subtle glow on hover/focus;
- one-pixel downward press movement;
- disabled state reduces saturation and contrast without hiding the label.

#### Secondary

- ivory or purple surface;
- gold border;
- no strong glow;
- used for navigation and alternate actions.

#### Destructive

- crimson surface;
- pale border;
- reserved for reset, delete, or irreversible actions.

#### Text action

- purple or gold text;
- underline or decorative divider on hover/focus;
- never used for the primary action.

### Inputs

- ivory field surface;
- dark readable text;
- antique-gold default border;
- purple focus border and visible external focus ring;
- explicit labels above fields;
- error messages shown below the relevant control when possible.

### Tabs

Tabs resemble small velvet banners or framed plaques. Selected tabs receive a gold edge and purple gemstone marker. Tabs must not rely on color alone; selected state also changes shape, border, or icon treatment.

### Item and equipment frames

Item slots share one base frame and use rarity accents only on the inner glow, gemstone, and trim.

The five approved equipment qualities remain:

- Normal;
- Rare;
- Epic;
- Unique;
- Legendary.

Rarity styling must not compromise text or icon readability.

### Tooltips

Tooltips use a dark purple surface, gold outer border, ivory text, clear stat grouping, and sufficient padding. Comparison increases and decreases require both color and symbols.

### Dialogs

Dialogs appear as royal panels over a darkened backdrop. The title has a crown or ornament only for important dialogs. Confirmation actions remain clearly separated from cancellation.

## Iconography and Ornament

Icons should use:

- thick readable silhouettes;
- simplified painted highlights;
- limited internal detail;
- consistent perspective;
- gold, ivory, purple, crimson, and blue as controlled material colors.

Ornaments should be based on:

- crowns;
- fleur-de-lis-inspired forms;
- royal seals;
- symmetrical scrollwork;
- gemstone mounts;
- banner points.

Avoid excessive filigree around dense gameplay information.

## Logo System

The RoyalStory logo consists of:

- the wordmark `RoyalStory`;
- a crown positioned above or integrated into the capital letters;
- one central purple gemstone;
- gold lettering with dark depth and bright edge highlights;
- optional symmetrical ornaments beneath the wordmark.

Required variants:

- full horizontal logo;
- compact stacked logo;
- crown-only mark;
- one-color silhouette for small icons and masks.

The logo must work against dark purple, illustrated backgrounds, and ivory surfaces.

## Environmental Art Direction

RoyalStory environments should combine:

- white or pale stone architecture;
- antique gold construction details;
- purple and crimson fabric;
- warm firelight;
- cool moonlight in background depth;
- softened stylized painting rather than realism.

The login throne room should use an illustrated background as the primary environment. Interactive UI, animated fire, glow, particles, mist, logo, and form remain separate layers.

## Animation Language

Animation should support clarity and atmosphere.

### Standard timings

- control hover: 120–180 ms;
- button press: 80–120 ms;
- panel entrance: 250–450 ms;
- major screen entrance: 700–2,000 ms;
- ambient loops: 2–12 seconds.

### Approved effects

- gold shimmer used sparingly;
- soft gemstone pulse;
- slow firelight variation;
- upward embers;
- subtle mist drift;
- short panel rise and fade;
- tiny button compression;
- gentle selected-tab glow.

### Restrictions

- do not shake full screens for standard interactions;
- do not animate large background areas rapidly;
- do not block interaction during decorative intros;
- do not use autoplay video for standard UI scenes;
- respect `prefers-reduced-motion` with static equivalents.

## Responsive Rules

Desktop may show full ornaments, environmental depth, side decorations, and ambient layers.

Mobile must:

- preserve the main logo, primary panel, and essential controls;
- simplify side ornaments and environmental layers;
- keep all primary controls visible without horizontal scrolling;
- maintain at least 44-pixel touch targets;
- reduce particles, mist, and decorative movement;
- prioritize readable values and actions over scenery.

## Accessibility

- Maintain WCAG-readable contrast for all functional text.
- Every control must have a visible keyboard focus state.
- Decorative artwork must be excluded from the accessibility tree.
- Information must not rely on color alone.
- Motion must have a reduced-motion alternative.
- Form errors and status changes must use appropriate live regions.
- Text embedded in illustration assets must not be the only accessible version of that text.

## Asset Strategy

### Reusable art pack

The first art pack should contain:

- RoyalStory logo variants;
- crown symbol variants;
- royal panel frame and corner ornaments;
- primary, secondary, and destructive button surfaces;
- banner and ribbon elements;
- gemstone markers;
- item-slot base frame;
- tooltip frame;
- divider ornaments;
- login throne-room background;
- brazier and fire layers;
- ember and mist overlays.

### File formats

- SVG for logos, ornaments, frames, and simple scalable shapes.
- WebP or PNG for painted environmental backgrounds and textured surfaces.
- CSS animation or sprite sheets for small repeated effects.
- Avoid oversized transparent raster assets when an SVG or CSS layer is sufficient.

## Technical Token Layer

The implementation must expose the approved colors, spacing, radii, shadows, and animation timing as shared CSS custom properties. New components should consume tokens instead of copying raw values.

Recommended initial file boundaries:

- `src/ui/tokens/royal-tokens.css`
- `src/ui/RoyalPanel.tsx`
- `src/ui/RoyalButton.tsx`
- `src/ui/RoyalInput.tsx`
- `src/ui/RoyalTabs.tsx`
- `src/ui/RoyalItemFrame.tsx`
- `src/ui/RoyalTooltip.tsx`
- `src/ui/royal-components.css`
- `public/art/royalstory/`

## Initial Scope

UI Kit v1 includes tokens and the reusable foundations needed by the login screen:

- logo variants;
- panel;
- buttons;
- inputs;
- dividers and corner ornaments;
- login environment assets;
- animation tokens;
- responsive and reduced-motion rules.

Inventory, equipment, shop, and combat-specific components will reuse the v1 foundation but receive separate feature specifications later.

## Completion Criteria

The UI Kit v1 design is complete when:

- every approved color and material has a defined purpose;
- logo variants and symbol usage are specified;
- panel, button, input, tab, item-frame, tooltip, and dialog behavior are defined;
- responsive and accessibility rules are explicit;
- the asset strategy separates illustrated backgrounds from interactive layers;
- implementation can proceed without inventing a competing visual language;
- no placeholder decisions remain in the v1 scope.
