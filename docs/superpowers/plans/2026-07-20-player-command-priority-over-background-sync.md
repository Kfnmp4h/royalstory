# Player Command Priority Over Background Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure background sync never delays Dismantle, Equip, or other player-triggered commands.

**Architecture:** Add abort-signal support to `playerApi.command`, separate foreground command state from background sync state in `App.tsx`, and ignore aborted or superseded sync responses. Foreground commands retain the existing duplicate-click lock and `serverBusy` UI, while background sync remains invisible and yields immediately to player actions.

**Tech Stack:** React 19, TypeScript, Fetch API, AbortController, Vitest, Vite.

## Global Constraints

- Background sync must never set `serverBusy` or disable player controls.
- A foreground player command aborts any active background sync before sending.
- Aborted or superseded sync responses must not call `onRecordChange` or set errors/notices.
- Only one background sync may be active at a time.
- Existing foreground duplicate-click protection remains unchanged.
- Phaser must remain mounted and continue receiving server state through `replaceState`.

---

### Task 1: Add AbortSignal Support to Player API

**Files:**
- Modify: `src/game/api/playerApi.ts`
- Test: `src/game/api/playerApi.test.ts`

**Interfaces:**
- Produces: `playerApi.command(command: PlayerCommand, signal?: AbortSignal): Promise<PlayerApiResponse>`

- [ ] **Step 1: Write the failing test**

Add a test that calls `playerApi.command(command, controller.signal)` and asserts that the mocked `fetch` receives the same signal in `RequestInit`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/api/playerApi.test.ts`
Expected: FAIL because `command` does not forward an AbortSignal.

- [ ] **Step 3: Write minimal implementation**

Update `command` to accept an optional signal and include it in the request init:

```ts
command: (command: PlayerCommand, signal?: AbortSignal) => request('/api/player/commands', {
  method: 'POST',
  body: JSON.stringify(command),
  signal,
}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/api/playerApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/api/playerApi.ts src/game/api/playerApi.test.ts
git commit -m "test: cover abortable player commands"
```

### Task 2: Separate Foreground Commands from Background Sync

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `playerApi.command(command, signal?)`
- Produces: foreground `issueCommand(command)` and background `issueBackgroundSync(expectedVersion)` flows.

- [ ] **Step 1: Write the failing tests**

Add tests that verify:

```ts
it('does not disable dismantle controls while background sync is pending', async () => {
  // Start a pending sync and assert foreground controls remain enabled.
});

it('aborts background sync before sending a foreground command', async () => {
  // Capture the sync signal, trigger dismantle, and assert signal.aborted === true.
});

it('ignores a late sync response after a foreground command starts', async () => {
  // Resolve the old sync after the foreground response and assert it does not replace the newer record.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL because sync currently uses the foreground lock and `serverBusy`.

- [ ] **Step 3: Implement foreground/background coordination**

Add refs:

```ts
const foregroundCommandInFlightRef = useRef(false);
const backgroundSyncRef = useRef<{ controller: AbortController; requestId: number } | null>(null);
const nextBackgroundSyncIdRef = useRef(1);
```

Foreground flow:

```ts
const issueCommand = useCallback(async (command: PlayerCommand) => {
  if (foregroundCommandInFlightRef.current) return;
  foregroundCommandInFlightRef.current = true;
  backgroundSyncRef.current?.controller.abort();
  backgroundSyncRef.current = null;
  setServerBusy(true);
  try {
    const response = await playerApi.command(command);
    handleCommandResponse(response, command);
  } finally {
    setServerBusy(false);
    foregroundCommandInFlightRef.current = false;
  }
}, [handleCommandResponse]);
```

Background flow:

```ts
const issueBackgroundSync = useCallback(async (expectedVersion: number) => {
  if (foregroundCommandInFlightRef.current || backgroundSyncRef.current) return;
  const controller = new AbortController();
  const requestId = nextBackgroundSyncIdRef.current++;
  backgroundSyncRef.current = { controller, requestId };
  const response = await playerApi.command({ type: 'sync', expectedVersion }, controller.signal);
  if (controller.signal.aborted || backgroundSyncRef.current?.requestId !== requestId) return;
  backgroundSyncRef.current = null;
  handleCommandResponse(response, { type: 'sync', expectedVersion });
}, [handleCommandResponse]);
```

Ensure `AbortError` or the API's unavailable response caused by an aborted fetch is ignored by checking `controller.signal.aborted` before handling.

- [ ] **Step 4: Update the interval**

Replace the interval callback with:

```ts
void issueBackgroundSync(record.saveVersion);
```

The interval must depend on `issueBackgroundSync` and `record.saveVersion`, not the foreground function.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/App.test.tsx src/game/api/playerApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "fix: prioritize player commands over sync"
```

### Task 3: Full Verification

**Files:**
- Verify: `src/App.tsx`
- Verify: `src/game/api/playerApi.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/App.test.tsx src/game/api/playerApi.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: TypeScript and Vite build complete successfully, aside from any documented pre-existing unrelated errors.

- [ ] **Step 4: Verify behavior manually**

Open Equipment, wait near a 15-second sync boundary, and click single or mass Dismantle. The click must respond immediately, the control must not be disabled by background sync, and no stale sync response may restore dismantled items.
