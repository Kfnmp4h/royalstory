# Centered Dismantle Modal Design

**Goal:** Replace the browser-controlled `window.confirm` prompt with a RoyalStory-styled confirmation modal centered in the viewport.

## Scope

- Change only the Equipment tab confirmation experience.
- Keep the existing dismantle reward formula, server command, save behavior, and Armor Stones balance unchanged.
- Keep one-item dismantle behavior unchanged.

## Interaction

- Clicking `Dismantle` opens an application modal instead of calling `window.confirm`.
- The modal is centered with a full-screen fixed overlay and dimmed backdrop.
- The modal displays the selected item name and exact Armor Stones reward.
- Actions are `Cancel` and `Dismantle`.
- `Escape` closes the modal without issuing a command.
- Confirming closes the modal and calls the existing `onDismantle(itemId)` callback exactly once.
- While `serverBusy` is true, the confirm action is disabled.

## Accessibility and Focus

- Use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
- Move focus to the Cancel button when the modal opens.
- Restore focus to the original Dismantle button when the modal closes.
- Clicking the backdrop closes the modal; clicking inside the dialog does not.

## Presentation

- Overlay uses `position: fixed` and `inset: 0` with a z-index above the game UI.
- Dialog width is responsive and constrained on desktop.
- Visual styling follows the existing dark royal panel language.
- The destructive confirm button uses the existing dismantle visual treatment.

## Testing

- Opening the modal renders a centered accessible dialog.
- `window.confirm` is no longer used.
- Cancel and Escape close without dismantling.
- Confirm calls `onDismantle` once with the selected item ID.
- Backdrop click closes; dialog click does not.
- Focus moves into the dialog and returns to the trigger.
