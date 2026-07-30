// ============================================================
// MBE YEAR VII LAUNCH GATE
// Public clubhouse unlock: Friday, July 31, 2026 at 2:00 PM Central.
// Before then the entire app is hidden and inert. The only entrance is
// the Ham Handler service door so the weekend can be tested safely.
// ============================================================

(function () {
    'use strict';

    const UNLOCK_AT = Date.parse('2026-07-31T14:00:00-05:00');
    const HANDLER_KEY = 'bookkeeperLoggedIn';
    const GATE_HANDLER_KEY = 'mbeLaunchHandler';
    const GATE_ID = 'mbeLaunchGate';
    const QUIPS = [
        'The points are marinating. Please stop tapping the glass.',
        'The clubhouse is under a federally questionable pork embargo.',
        'Six golfers entered. Zero responsible adults were detected.',
        'Current status: polishing the ceremonial three-putt.',
        'Tampering before tee time will be prosecuted by six biased jurors.',
        'The Pig Gods are reviewing several suspicious practice swings.'
    ];

    // Local preview only: lets the audit verify both sides of the gate without
    // adding a production bypass. These query values do nothing on the live host.
    const localPreview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
        ? new URLSearchParams(location.search).get('gateTest')
        : null;

    function currentTime() {
        if (localPreview === 'before') return UNLOCK_AT - 3600000;
        if (localPreview === 'after') return UNLOCK_AT + 1000;
        return Date.now();
    }

    function handlerIsInside() {
        try {
            const handlerFlag = localStorage.getItem(HANDLER_KEY) === 'true';
            const gatePass = localStorage.getItem(GATE_HANDLER_KEY) === 'true';
            if (gatePass && !handlerFlag) {
                // A normal admin logout is also an exit from the maintenance
                // tunnel. Clear the companion restore flags before another page
                // can silently resurrect the Handler session.
                localStorage.removeItem(GATE_HANDLER_KEY);
                localStorage.removeItem('hamHandlerPlayerLoggedIn');
                localStorage.removeItem('hamHandlerCurrentPlayer');
                return false;
            }
            return handlerFlag && gatePass;
        } catch (_) {
            return false;
        }
    }

    function publicIsOpen() {
        return currentTime() >= UNLOCK_AT;
    }

    function gateRequired() {
        return !publicIsOpen() && !handlerIsInside();
    }

    // This runs while <head> is still being parsed, preventing any leaderboard,
    // scorecard, pairing, feed, or Hall of Fame flash before the gate appears.
    if (gateRequired()) {
        document.documentElement.classList.add('mbe-launch-locked');
    }

    const style = document.createElement('style');
    style.id = 'mbeLaunchGateStyles';
    style.textContent = `
        html.mbe-launch-locked,
        html.mbe-launch-locked body {
            margin: 0 !important;
            min-height: 100% !important;
            overflow: hidden !important;
            background: #061c14 !important;
        }

        html.mbe-launch-locked body > *:not(#${GATE_ID}) {
            display: none !important;
        }

        #${GATE_ID} {
            position: fixed;
            z-index: 2147483647;
            inset: 0;
            width: 100%;
            min-height: 100dvh;
            overflow: auto;
            box-sizing: border-box;
            display: grid;
            place-items: center;
            padding: max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
            color: #f8edcf;
            background:
                radial-gradient(circle at 50% -10%, rgba(212, 175, 55, 0.28), transparent 38%),
                radial-gradient(circle at 12% 82%, rgba(190, 24, 93, 0.18), transparent 28%),
                linear-gradient(145deg, #061c14 0%, #0b2c1e 48%, #081b14 100%);
            font-family: "Outfit", "Trebuchet MS", sans-serif;
            text-align: center;
            isolation: isolate;
        }

        #${GATE_ID}::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: 0.12;
            background-image:
                radial-gradient(circle, #f2d67c 1px, transparent 1px),
                radial-gradient(circle, #f2d67c 1px, transparent 1px);
            background-position: 0 0, 18px 18px;
            background-size: 36px 36px;
        }

        .mbe-gate-card {
            position: relative;
            width: min(620px, 100%);
            box-sizing: border-box;
            padding: clamp(24px, 6vw, 46px) clamp(18px, 6vw, 48px);
            border: 2px solid #d4af37;
            border-radius: 28px;
            background: rgba(7, 31, 22, 0.94);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), inset 0 0 0 5px rgba(212, 175, 55, 0.06);
        }

        .mbe-gate-seal {
            width: 92px;
            height: 92px;
            margin: 0 auto 14px;
            display: grid;
            place-items: center;
            border: 2px solid #d4af37;
            border-radius: 50%;
            color: #0a2118;
            background: radial-gradient(circle, #f7df97, #d4af37 70%);
            box-shadow: 0 0 0 7px rgba(212, 175, 55, 0.09);
            font-size: 50px;
            animation: mbeGateSnuffle 2.8s ease-in-out infinite;
        }

        @keyframes mbeGateSnuffle {
            0%, 100% { transform: rotate(-3deg) scale(1); }
            50% { transform: rotate(3deg) scale(1.045); }
        }

        .mbe-gate-kicker {
            margin: 0 0 7px;
            color: #f2d67c;
            font: 800 0.78rem/1.2 "Outfit", sans-serif;
            letter-spacing: 0.19em;
            text-transform: uppercase;
        }

        .mbe-gate-title {
            margin: 0;
            color: #fff6dc;
            font: 800 clamp(2rem, 9vw, 3.45rem)/0.98 "Fraunces", Georgia, serif;
            text-wrap: balance;
        }

        .mbe-gate-decree {
            max-width: 470px;
            min-height: 2.8em;
            margin: 14px auto 20px;
            color: #d8caa7;
            font: italic 600 clamp(0.93rem, 3.7vw, 1.08rem)/1.45 "Fraunces", Georgia, serif;
        }

        .mbe-gate-countdown {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: clamp(6px, 2vw, 12px);
            margin: 0 auto 16px;
        }

        .mbe-gate-cell {
            min-width: 0;
            padding: clamp(10px, 3vw, 16px) 4px 9px;
            border: 1px solid rgba(242, 214, 124, 0.45);
            border-radius: 15px;
            background: rgba(0, 0, 0, 0.23);
        }

        .mbe-gate-num {
            color: #f2d67c;
            font: 800 clamp(1.55rem, 8vw, 2.65rem)/1 "Outfit", sans-serif;
            font-variant-numeric: tabular-nums;
        }

        .mbe-gate-unit {
            margin-top: 5px;
            color: #a99b78;
            font: 700 clamp(0.58rem, 2.6vw, 0.7rem)/1 "Outfit", sans-serif;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .mbe-gate-date {
            margin: 0;
            color: #fff2cb;
            font: 800 clamp(0.9rem, 3.8vw, 1.05rem)/1.4 "Outfit", sans-serif;
        }

        .mbe-gate-sub {
            margin: 5px 0 22px;
            color: #b8aa89;
            font-size: 0.78rem;
        }

        .mbe-gate-handler {
            padding-top: 18px;
            border-top: 1px solid rgba(212, 175, 55, 0.28);
        }

        #${GATE_ID} button,
        #${GATE_ID} input {
            min-height: 48px;
            box-sizing: border-box;
            font: 700 1rem "Outfit", sans-serif;
        }

        .mbe-gate-door {
            width: 100%;
            border: 1px solid rgba(242, 214, 124, 0.62);
            border-radius: 14px;
            padding: 11px 16px;
            color: #f8edcf;
            background: rgba(212, 175, 55, 0.1);
            cursor: pointer;
        }

        .mbe-gate-door:hover,
        .mbe-gate-door:focus-visible {
            background: rgba(212, 175, 55, 0.2);
            outline: 3px solid rgba(242, 214, 124, 0.25);
            outline-offset: 2px;
        }

        .mbe-gate-form {
            display: none;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
        }

        .mbe-gate-form.is-open {
            display: grid;
        }

        .mbe-gate-form input {
            width: 100%;
            border: 1px solid rgba(242, 214, 124, 0.45);
            border-radius: 12px;
            padding: 10px 12px;
            color: #fff7e2;
            background: #03110c;
        }

        .mbe-gate-form input::placeholder {
            color: #8e846b;
        }

        .mbe-gate-enter {
            grid-column: 1 / -1;
            border: 0;
            border-radius: 12px;
            padding: 11px 16px;
            color: #10261c;
            background: linear-gradient(135deg, #f2d67c, #d4af37);
            cursor: pointer;
        }

        .mbe-gate-error {
            grid-column: 1 / -1;
            min-height: 1.2em;
            margin: 0;
            color: #ff9aab;
            font-size: 0.82rem;
        }

        .mbe-gate-evidence {
            margin: 17px 0 0;
            color: #7f907f;
            font-size: 0.68rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        @media (max-width: 430px) {
            .mbe-gate-card { border-radius: 22px; }
            .mbe-gate-form { grid-template-columns: 1fr; }
            .mbe-gate-enter { grid-column: 1; }
            .mbe-gate-error { grid-column: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
            .mbe-gate-seal { animation: none; }
        }
    `;
    document.head.appendChild(style);

    function countdownParts() {
        const remaining = Math.max(0, UNLOCK_AT - currentTime());
        return {
            days: Math.floor(remaining / 86400000),
            hours: Math.floor(remaining / 3600000) % 24,
            minutes: Math.floor(remaining / 60000) % 60,
            seconds: Math.floor(remaining / 1000) % 60
        };
    }

    function two(n) {
        return String(n).padStart(2, '0');
    }

    function createGate() {
        if (document.getElementById(GATE_ID) || !document.body) return;

        const gate = document.createElement('section');
        gate.id = GATE_ID;
        gate.setAttribute('role', 'dialog');
        gate.setAttribute('aria-modal', 'true');
        gate.setAttribute('aria-labelledby', 'mbeGateTitle');
        gate.innerHTML = `
            <div class="mbe-gate-card">
                <div class="mbe-gate-seal" aria-hidden="true">🐷</div>
                <p class="mbe-gate-kicker">By decree of the Royal Order of the Hog</p>
                <h1 class="mbe-gate-title" id="mbeGateTitle">THE CLUBHOUSE IS SEALED</h1>
                <p class="mbe-gate-decree" id="mbeGateQuip"></p>
                <div class="mbe-gate-countdown" aria-label="Countdown to the Year Seven unlock">
                    <div class="mbe-gate-cell"><div class="mbe-gate-num" data-gate-days>0</div><div class="mbe-gate-unit">days</div></div>
                    <div class="mbe-gate-cell"><div class="mbe-gate-num" data-gate-hours>00</div><div class="mbe-gate-unit">hours</div></div>
                    <div class="mbe-gate-cell"><div class="mbe-gate-num" data-gate-minutes>00</div><div class="mbe-gate-unit">minutes</div></div>
                    <div class="mbe-gate-cell"><div class="mbe-gate-num" data-gate-seconds>00</div><div class="mbe-gate-unit">seconds</div></div>
                </div>
                <p class="mbe-gate-date">Friday, July 31 · 2:00 PM Central</p>
                <p class="mbe-gate-sub">At zero, the books open and the accusations begin.</p>
                <div class="mbe-gate-handler">
                    <button class="mbe-gate-door" type="button" aria-expanded="false">🔧 HAM HANDLER’S SERVICE ENTRANCE</button>
                    <form class="mbe-gate-form" autocomplete="off">
                        <input name="handlerName" aria-label="Ham Handler username" placeholder="Handler name" autocapitalize="characters" required>
                        <input name="handlerPassword" type="password" aria-label="Ham Handler password" placeholder="Sacred password" required>
                        <button class="mbe-gate-enter" type="submit">ENTER THE HANDLER’S PEN</button>
                        <p class="mbe-gate-error" role="alert"></p>
                    </form>
                </div>
                <p class="mbe-gate-evidence">All tapping has been entered into evidence.</p>
            </div>
        `;
        document.body.appendChild(gate);

        const door = gate.querySelector('.mbe-gate-door');
        const form = gate.querySelector('.mbe-gate-form');
        const error = gate.querySelector('.mbe-gate-error');
        const firstInput = form.elements.handlerName;

        door.addEventListener('click', () => {
            const opening = !form.classList.contains('is-open');
            form.classList.toggle('is-open', opening);
            door.setAttribute('aria-expanded', String(opening));
            if (opening) firstInput.focus();
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = String(form.elements.handlerName.value || '').trim();
            const password = String(form.elements.handlerPassword.value || '').trim();
            const validName = username.toUpperCase() === 'PIG' || username.toLowerCase() === 'pigmaster';
            const normalizedPassword = password.toLowerCase();
            const validPassword = normalizedPassword === 'oinkmaster2025'
                || normalizedPassword === 'piggypiggy'
                || password === 'PIG';

            if (!validName || !validPassword) {
                error.textContent = 'ACCESS DENIED. The snout-print does not match.';
                form.elements.handlerPassword.value = '';
                form.elements.handlerPassword.focus();
                return;
            }

            localStorage.setItem(HANDLER_KEY, 'true');
            localStorage.setItem(GATE_HANDLER_KEY, 'true');
            localStorage.setItem('hamHandlerPlayerLoggedIn', 'true');
            localStorage.setItem('hamHandlerCurrentPlayer', 'Evan');
            door.textContent = '✅ SNOUT-PRINT ACCEPTED';
            error.textContent = 'Opening the maintenance tunnel…';
            setTimeout(() => location.reload(), 350);
        });

        updateGate();
    }

    function updateGate() {
        if (!gateRequired()) {
            document.documentElement.classList.remove('mbe-launch-locked');
            const oldGate = document.getElementById(GATE_ID);
            if (oldGate) oldGate.remove();
            return;
        }

        document.documentElement.classList.add('mbe-launch-locked');
        createGate();
        const gate = document.getElementById(GATE_ID);
        if (!gate) return;

        const parts = countdownParts();
        gate.querySelector('[data-gate-days]').textContent = parts.days;
        gate.querySelector('[data-gate-hours]').textContent = two(parts.hours);
        gate.querySelector('[data-gate-minutes]').textContent = two(parts.minutes);
        gate.querySelector('[data-gate-seconds]').textContent = two(parts.seconds);
        gate.querySelector('#mbeGateQuip').textContent = QUIPS[Math.floor(currentTime() / 8000) % QUIPS.length];
    }

    document.addEventListener('DOMContentLoaded', updateGate);
    window.addEventListener('pageshow', updateGate);
    setInterval(updateGate, 250);

    window.MBE_LAUNCH_GATE = Object.freeze({
        unlockAt: new Date(UNLOCK_AT).toISOString(),
        isPublic: publicIsOpen
    });
})();
