// ============================================================
// THE SUMMONS — push notifications for the Royal Order of the Hog
// Backend: piggy-push Cloudflare Worker (see push-worker/).
// Design: bare pushes wake the service worker, which fetches
// /latest from the worker to learn what to display.
// ============================================================

(function () {
    'use strict';

    const WORKER = 'https://piggy-push.andrew-247.workers.dev';
    const VAPID_PUBLIC = 'BJIk2OjUA3IcPiFB16Q_t_LeKckb6TtpqBAcu3vU2vre9VfJTfkACZVvuLnirHRP3Avl5RYpXWdVB8sg9uejxIs';
    const CLUB_KEY = 'IMAPIGOINK123';

    // ---------- outbound: any page can fire a summons ----------
    // mbeNotify(type, title, body, excludePlayer)
    window.mbeNotify = function (type, title, body, exclude) {
        try {
            fetch(WORKER + '/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: CLUB_KEY, type, title, body, exclude: exclude || null })
            }).catch(() => {});
        } catch (e) { /* notifications are a luxury, never break the app */ }
    };

    // ---------- inbound: subscription management ----------
    function b64ToU8(base64) {
        const pad = '='.repeat((4 - (base64.length % 4)) % 4);
        const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    }

    function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    async function currentState() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            return (isIos() && !isStandalone()) ? 'ios_needs_install' : 'unsupported';
        }
        if (Notification.permission === 'denied') return 'blocked';
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) return 'enabled';
        } catch (e) { /* fall through */ }
        return 'ready';
    }

    window.mbeEnablePush = async function () {
        const state = await currentState();
        if (state === 'ios_needs_install') {
            alert('📲 ONE STEP FIRST\n\nOn iPhone, notifications only work for the installed app:\n\n1. Tap the Share button\n2. "Add to Home Screen"\n3. Open PIGGY PIGGY from the new icon\n4. Tap ENABLE THE SUMMONS again');
            return;
        }
        if (state === 'unsupported') return alert('🚫 This browser cannot receive the Summons.');
        if (state === 'blocked') return alert('🚫 Notifications are blocked for this site in your browser settings. Un-block them, then try again.');
        try {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') return renderCard();
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: b64ToU8(VAPID_PUBLIC)
                });
            }
            const player = (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.displayName) || localStorage.getItem('bypassLoginInProgress') || '?';
            const res = await fetch(WORKER + '/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player, subscription: sub.toJSON() })
            });
            if (!res.ok) throw new Error('subscribe failed: ' + res.status);
            alert('🔔 THE SUMMONS IS ACTIVE\n\nThis device will now be ambushed as the Order requires.');
        } catch (e) {
            console.error('🔔 enable push failed:', e);
            alert('🚫 The Summons failed: ' + e.message);
        }
        renderCard();
    };

    // ---------- top-of-page alarm banner (site-wide nag) ----------
    function removeBanner() {
        const b = document.getElementById('summonsBanner');
        if (b) b.remove();
    }

    function renderBanner(state) {
        if (state === 'enabled' || state === 'unsupported') { removeBanner(); return; }
        if (sessionStorage.getItem('summonsBannerDismissed')) return;
        let banner = document.getElementById('summonsBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'summonsBanner';
            banner.className = 'summons-banner';
            const host = document.querySelector('.container') || document.body;
            host.insertBefore(banner, host.firstChild);
        }
        const msg = state === 'ios_needs_install'
            ? '<strong>📲 THE SUMMONS IS NOT ARMED</strong><span>iPhone: needs Add to Home Screen — tap for instructions</span>'
            : state === 'blocked'
                ? '<strong>🚫 SUMMONS BLOCKED</strong><span>Notifications are blocked in browser settings — tap for help</span>'
                : '<strong>🔕 THE SUMMONS IS NOT ARMED ON THIS DEVICE</strong><span>Danger Zones, jury duty &amp; drink debts will pass you by. TAP TO ARM.</span>';
        banner.innerHTML = msg + '<button class="summons-dismiss" aria-label="dismiss">✕</button>';
        banner.onclick = () => window.mbeEnablePush();
        banner.querySelector('.summons-dismiss').onclick = (e) => {
            e.stopPropagation();
            sessionStorage.setItem('summonsBannerDismissed', '1');
            removeBanner();
        };
    }

    // ---------- UI card (renders wherever #pushSetup exists) ----------
    async function renderCard() {
        const state = await currentState();
        renderBanner(state);
        const el = document.getElementById('pushSetup');
        if (!el) return;
        if (state === 'enabled') {
            el.innerHTML = '<div style="text-align:center; font-size:0.8rem; color:#7fd494; padding:6px 0;">🔔 THE SUMMONS IS ACTIVE on this device</div>';
        } else if (state === 'unsupported') {
            el.innerHTML = '<div style="text-align:center; font-size:0.75rem; color:#9a9077; padding:6px 0;">🔕 This browser cannot receive the Summons</div>';
        } else {
            const hint = state === 'ios_needs_install' ? '<div style="font-size:0.68rem; color:#9a9077; margin-top:4px;">iPhone: requires "Add to Home Screen" first — tap for instructions</div>'
                : state === 'blocked' ? '<div style="font-size:0.68rem; color:#ff8a80; margin-top:4px;">Currently blocked in browser settings</div>' : '';
            el.innerHTML = '<button class="transfer-btn" onclick="mbeEnablePush()" style="width:100%;">🔔 ENABLE THE SUMMONS</button>' +
                '<div style="text-align:center; font-size:0.7rem; color:#9a9077; margin-top:4px;">Danger Zones, jury duty, drink debts — delivered to your pocket.' + hint + '</div>';
        }
    }

    // ---------- registration self-heal ----------
    // If this device is subscribed but the club roster doesn't know WHO it
    // is (e.g. armed before swearing the oath), re-register under the
    // current identity. Runs quietly on every page load.
    async function healRegistration() {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (!sub) return;
            const player = (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.displayName)
                || localStorage.getItem('bypassLoginInProgress') || null;
            if (!player) return;
            fetch(WORKER + '/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player, subscription: sub.toJSON() })
            }).catch(() => {});
            console.log('🔔 Summons registration refreshed for', player);
        } catch (e) { /* healing is best-effort */ }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(renderCard, 1500));
    else setTimeout(renderCard, 1500);
    // give Firebase auth time to restore the session, then heal (twice, for slow phones)
    setTimeout(healRegistration, 4000);
    setTimeout(healRegistration, 12000);
})();
