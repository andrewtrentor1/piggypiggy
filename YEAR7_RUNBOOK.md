# 🐷 YEAR VII RUNBOOK — read this on Friday, July 31

The site is currently in **Year VI freeze**: everyone can view, nobody can write
(that's the Firebase rules you published — good). Here's the exact order of
operations to open Year VII. Total time: ~2 minutes.

## Step 1 — Unlock the database (just before noon)

Go to: https://console.firebase.google.com/project/mbepiggy/database/mbepiggy-default-rtdb/rules

Replace everything with the **WEEKEND RULES** and hit Publish:

```json
{
  "rules": {
    ".read": true,
    "players": { ".write": true },
    "activities": { ".write": true },
    "golfSessions": { ".write": true },
    "tribunal": { ".write": true },
    "oracle": { ".write": true },
    "secretSwine": { ".write": true },
    "drinkAssignments": { ".write": true },
    "drinkAcknowledgments": { ".write": true },
    "drinkProofs": { ".write": true },
    "hogwashCooldowns": { ".write": true },
    "dangerZone": { ".write": true },
    "dangerZoneSchedule": { ".write": true },
    "settings": { ".write": true },
    "season": { ".write": true },
    "moments": { ".write": true },
    "notifications": { ".write": true },
    "teams": { ".write": true },
    "alexDangerZoneSystem": { ".write": true },
    "alexDrinkSystem": { ".write": true },
    "connectionTest": { ".write": true },
    "test": { ".write": true },
    "archive": { "$year": { ".write": "!data.exists()" } }
  }
}
```

Why this instead of wide open: the `archive` rule means each year's vault can be
**written exactly once and then becomes permanently read-only**. Year VI gets
sealed by the ceremony and after that *nobody* — not even a rogue Brian with
the console open — can edit history. Everything else is open for the weekend.

## Step 2 — The Ceremony

1. Open piggypiggy.pro on your phone
2. Log in as Ham Handler
3. In HAM HANDLER CONTROLS → SEASON CEREMONY → tap **🎊 COMMENCE YEAR VII 🎊**
4. Read the warning, confirm, and swear the oath (type `OINK`)

The ceremony automatically:
- Archives ALL Year VI data (final standings, points, golf rounds, the entire
  activity feed) to `archive/year6` — and verifies the archive landed before
  touching anything
- Resets every member to **30 points** (per the Rulebook) and GOD to 0
- Clears the golf ledger and activity feed for the new year
- Forgives all Year VI drink debts by decree
- Flips every page's banner to "YEAR VII · LIVE LEDGER"

If anything fails mid-ceremony, it aborts BEFORE the reset — Year VI cannot be
lost.

## Step 3 — Arm the toys (optional but correct)

In THE PARLOUR → RULEBOOK ENGINE (Ham Handler only, bottom):
- **💀 Random Danger Zone** — tap to ARM. One random strike per day, 10am–10pm,
  all phones at once. Test Strike button fires one immediately.

## After the weekend (optional)

To freeze the books again, re-publish the view-only rules:

```json
{
  "rules": { ".read": true, ".write": false }
}
```

## Notes

- **Nothing was tested against live writes** (the freeze blocks them — by
  design). The first Tribunal case / Oracle market after unlock is the shakedown
  cruise. Every feature reads fine against live data already (the Drink Ledger
  and Superlatives are computing real Year VI numbers as we speak).
- A full database backup from 2026-07-17 exists locally in case of any disaster.
- If a phone shows the OLD pink site after the update: close the PWA fully and
  reopen (the new service worker takes over on second launch), or
  Settings → Safari → clear website data for piggypiggy.pro.
