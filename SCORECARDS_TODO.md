# HANDOFF: Wire in the course scorecards (Year VII golf trip, Jul 31 2026)

Drew is uploading photos/text of the course scorecards. Your job: load them into
`GOLF_COURSES` in **golf.html** so par data lights up the golf UX.

## Where

`golf.html`, in the main `<script>` block — search for `const GOLF_COURSES`.
It ships EMPTY with a format comment:

```js
const GOLF_COURSES = {
    // exampleKey: { name: 'Example Muni (Front 9)', pars: [4,3,5,4,4,3,4,5,4] },
};
```

## Rules

- `pars` is front-to-back, **9 or 18 entries — the hole count of a session
  follows the array length**. If they play 18-hole rounds, enter all 18.
  If the scorecard is 18 holes but they play it as two 9s, you can add both:
  one 18-hole entry AND/OR `(Front 9)` / `(Back 9)` variants — ask Drew which
  they'll use per session if unclear.
- Key = short camelCase slug; `name` = human name shown in the Course dropdown
  (dropdown auto-appends total par + hole count).
- Sessions SNAPSHOT pars at creation — editing a course later never rewrites
  existing sessions.
- Par-3 holes automatically get the 📍 Closest-to-Pin (individual) contest;
  par shows in scorecard headers and to-par totals appear everywhere.
- If the scorecard photo has yardages/handicap, only `pars` matters — ignore
  the rest (or stash it in a comment).

## After editing

1. Bump `CACHE_NAME` in **sw.js** (currently `v21-drawing-of-lots`) — required
   on every asset change or installed PWAs serve stale.
2. Commit + push to `main` — GitHub Pages serves main directly, **push = live**.

## Landmines (serious)

- **Local preview (launch.json "piggypiggy", port 8123) connects to PRODUCTION
  Firebase** (mbepiggy RTDB, world-writable). If you drive the UI in a browser,
  stub writes first (`window.firebaseSet/firebaseUpdate = no-op`) — a test
  session/save WILL hit the live database the whole friend group is using.
- `players/{name}` in Firebase is NESTED `{points, powerUps}` — never write
  flat numbers.
- Verify by injecting a fake session locally and calling `openScoreModal`
  with writes stubbed (see git log a8f5570 / 9543831 for prior art).

Context lives in Claude memory: `piggypiggy-site` and
`piggypiggy-prod-firebase-landmine`.
