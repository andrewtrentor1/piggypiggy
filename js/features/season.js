// ============================================================
// MBE SEASON ENGINE — Year VI → Year VII transition
// - Season banner + countdown to Year VII (Fri Jul 31 2026, noon Central)
// - START YEAR VII: archives Year VI (players, golf, activities) to
//   archive/year6, resets points to 30 (rulebook), flips season/current
// - Random Daily Danger Zone scheduler (opt-in via settings node)
// Loaded on index.html and golf.html. Plain script; waits for the
// window.firebase* globals set by the module init on each page.
// ============================================================

(function () {
    'use strict';

    const YEAR7_EPOCH = Date.parse('2026-07-31T17:00:00Z'); // noon CDT
    const ROSTER = ['Andrew', 'Evan', 'Ian', 'Zack', 'Brian', 'Alex'];

    let season = null;          // season/current node value (null = Year VI)
    let cdTimer = null;

    // ---------- boot: wait for firebase globals ----------
    let tries = 0;
    const bootPoll = setInterval(() => {
        tries++;
        if (window.firebaseDB && window.firebaseRef && window.firebaseOnValue) {
            clearInterval(bootPoll);
            init();
        } else if (tries > 100) {
            clearInterval(bootPoll);
            console.error('🗓️ Season engine: Firebase never became available');
        }
    }, 300);

    function init() {
        console.log('🗓️ Season engine online');
        const seasonRef = window.firebaseRef(window.firebaseDB, 'season/current');
        window.firebaseOnValue(seasonRef, (snap) => {
            season = snap.val();
            renderBanner();
            renderStartButton();
        }, (err) => console.error('🗓️ season listener error:', err));

        if (!cdTimer) cdTimer = setInterval(renderBanner, 1000);
        initRandomDangerZone();
    }

    // ---------- banner + countdown ----------
    function fmt(n) { return String(n).padStart(2, '0'); }

    function renderBanner() {
        const el = document.getElementById('seasonBanner');
        if (!el) return;

        if (season && season.year >= 7) {
            el.innerHTML = '<div class="season-label live">Year VII &middot; MMXXVI &middot; Live Ledger</div>' +
                '<div class="season-sub">The books are open. The Hog is watching.</div>';
            return;
        }

        const ms = YEAR7_EPOCH - Date.now();
        let inner = '<div class="season-label">Year VI &middot; MMXXV &middot; Final Standings</div>' +
            '<div class="season-sub">The record stands, frozen in lard, until Year VII convenes.</div>';

        if (ms > 0) {
            const d = Math.floor(ms / 86400000);
            const h = Math.floor(ms / 3600000) % 24;
            const m = Math.floor(ms / 60000) % 60;
            const s = Math.floor(ms / 1000) % 60;
            inner += '<div class="season-countdown">' +
                '<div class="cd-title">Year VII convenes in</div>' +
                '<div class="cd-grid">' +
                '<div class="cd-cell"><div class="cd-num">' + d + '</div><div class="cd-unit">days</div></div>' +
                '<div class="cd-cell"><div class="cd-num">' + fmt(h) + '</div><div class="cd-unit">hrs</div></div>' +
                '<div class="cd-cell"><div class="cd-num">' + fmt(m) + '</div><div class="cd-unit">min</div></div>' +
                '<div class="cd-cell"><div class="cd-num">' + fmt(s) + '</div><div class="cd-unit">sec</div></div>' +
                '</div>' +
                '<div class="cd-sub">High Noon Central &middot; Friday, July the 31st &middot; MMXXVI</div>' +
                '</div>';
        } else {
            inner += '<div class="season-armed">⚖️ THE HOUR HAS COME. The Ham Handler must open the books.</div>';
        }
        el.innerHTML = inner;
    }

    function renderStartButton() {
        const btn = document.getElementById('startYear7Btn');
        if (!btn) return;
        if (season && season.year >= 7) {
            btn.textContent = '✅ YEAR VII IS IN SESSION';
            btn.disabled = true;
            btn.style.opacity = '0.55';
            btn.style.cursor = 'default';
        }
    }

    // ---------- START YEAR VII ----------
    async function startYearSeven() {
        if (season && season.year >= 7) {
            alert('Year VII is already in session, calm down.');
            return;
        }

        const early = Date.now() < YEAR7_EPOCH;
        let warn = '🐷 COMMENCE YEAR VII?\n\nThis will, in one ceremony:\n' +
            '• Archive ALL Year VI data (points, golf rounds, the entire activity feed) to the permanent vault\n' +
            '• Reset every member to 30 points (per the Rulebook) and GOD to 0\n' +
            '• Clear the golf ledger and activity feed for a fresh year\n' +
            '• FORGIVE all outstanding Year VI drink debts by decree\n\n' +
            'Nothing is deleted — Year VI lives forever in the vault.';
        if (early) warn += '\n\n⚠️ NOTE: The official hour (noon Central, July 31) has NOT yet arrived. You are starting EARLY.';
        if (!confirm(warn)) return;

        const oath = prompt('To swear the oath and open Year VII, type: OINK');
        if (!oath || oath.trim().toUpperCase() !== 'OINK') {
            alert('The oath was not sworn. Year VI endures.');
            return;
        }

        const db = window.firebaseDB;
        const ref = window.firebaseRef;
        try {
            // 1) read everything we are about to archive
            const [playersSnap, golfSnap, actSnap, cooldownSnap] = await Promise.all([
                window.firebaseGet(ref(db, 'players')),
                window.firebaseGet(ref(db, 'golfSessions')),
                window.firebaseGet(ref(db, 'activities')),
                window.firebaseGet(ref(db, 'hogwashCooldowns'))
            ]);
            const players = playersSnap.val() || {};
            const golf = golfSnap.val() || {};
            const acts = actSnap.val() || {};

            const standings = Object.entries(players)
                .filter(([n]) => n !== 'GOD')
                .map(([n, v]) => ({ name: n, points: (v && v.points) || 0 }))
                .sort((a, b) => b.points - a.points);

            // 2) write the archive
            const archive = {
                label: 'Year VI — Wabasha WI 2025',
                archivedAt: new Date().toISOString(),
                finalStandings: standings,
                mvp: standings.length ? standings[0].name : null,
                pig: standings.length ? standings[standings.length - 1].name : null,
                players: players,
                golfSessions: golf,
                activities: acts,
                hogwashCooldowns: cooldownSnap.val() || null
            };
            await window.firebaseSet(ref(db, 'archive/year6'), archive);

            // 3) verify the archive actually landed before touching anything
            const verify = await window.firebaseGet(ref(db, 'archive/year6/archivedAt'));
            if (!verify.val()) throw new Error('Archive write could not be verified — ABORTING, nothing was reset.');

            // 4) the reset
            const freshPlayers = {};
            ROSTER.forEach((n) => {
                freshPlayers[n] = { points: 30, powerUps: { giveDrinks: 0, mulligans: 0, reverseMulligans: 0 } };
            });
            freshPlayers['GOD'] = { points: 0, powerUps: { giveDrinks: 0, mulligans: 0, reverseMulligans: 0 } };
            await window.firebaseSet(ref(db, 'players'), freshPlayers);
            await window.firebaseSet(ref(db, 'golfSessions'), null);
            await window.firebaseSet(ref(db, 'activities'), null);
            await window.firebaseSet(ref(db, 'hogwashCooldowns'), null);

            // 5) flip the season
            await window.firebaseSet(ref(db, 'season/current'), {
                year: 7,
                label: 'Year VII — 2026',
                startedAt: new Date().toISOString()
            });

            // 6) first entry in the fresh ledger
            const id = Date.now() + '_1';
            await window.firebaseSet(ref(db, 'activities/' + id), {
                id: id,
                type: 'admin',
                emoji: '🎊',
                message: '🎊 YEAR VII HAS OFFICIALLY CONVENED. All members reset to 30 points. Year VI debts forgiven. The Hog hungers anew.',
                timestamp: new Date().toISOString()
            });

            alert('🎊 YEAR VII IS OPEN.\n\nYear VI has been sealed in the vault. Everyone starts at 30 points.\n\nIn Lardo Veritas.');
        } catch (e) {
            console.error('❌ Year VII start failed:', e);
            alert('❌ Year VII start failed: ' + e.message + '\n\nIf the archive step failed, NOTHING was reset.');
        }
    }
    window.startYearSeven = startYearSeven;

    // ---------- Random Daily Danger Zone ----------
    // settings/randomDangerZone: true|false (toggled from The Parlour)
    // dangerZoneSchedule/{YYYY-MM-DD}: { time: epochMs, fired: bool }
    let rdzEnabled = false;

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + fmt(d.getMonth() + 1) + '-' + fmt(d.getDate());
    }

    function initRandomDangerZone() {
        const db = window.firebaseDB;
        const ref = window.firebaseRef;
        window.firebaseOnValue(ref(db, 'settings/randomDangerZone'), (snap) => {
            rdzEnabled = snap.val() === true;
            console.log('💀 Random Danger Zone:', rdzEnabled ? 'ARMED' : 'disarmed');
        }, () => {});

        setInterval(async () => {
            if (!rdzEnabled) return;
            try {
                const db2 = window.firebaseDB;
                const key = 'dangerZoneSchedule/' + todayKey();
                const snap = await window.firebaseGet(window.firebaseRef(db2, key));
                let sched = snap.val();
                if (!sched || !sched.time) {
                    // Draw today's strike time: between 10:00 and 21:59 local
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).getTime();
                    const t = start + Math.floor(Math.random() * 12 * 3600000);
                    sched = { time: t, fired: false };
                    await window.firebaseSet(window.firebaseRef(db2, key), sched);
                    console.log('💀 Danger Zone drawn for today at', new Date(t).toLocaleTimeString());
                    return;
                }
                if (!sched.fired && Date.now() >= sched.time) {
                    await window.firebaseSet(window.firebaseRef(db2, key + '/fired'), true);
                    await window.firebaseSet(window.firebaseRef(db2, 'dangerZone'), {
                        playerName: 'THE HOG ITSELF',
                        timestamp: new Date().toISOString(),
                        eventId: Date.now() + '_rdz'
                    });
                    console.log('💀 THE HOG HAS STRUCK.');
                }
            } catch (e) { /* transient errors are fine; next tick retries */ }
        }, 30000);
    }
})();
