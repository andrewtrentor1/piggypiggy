// MBE YEAR VII SAFETY LEDGER
// Mirrors every successful Firebase set/update into an append-only audit path.
// Normal score resets and season cleanup never touch year7Safety, so the live
// ledger can be reconstructed from the launch baseline plus these events.
(function installMbeSafetyLedger() {
    'use strict';

    const SAFETY_ROOT = 'year7Safety';
    const VERSION = 1;
    const MAX_INSTALL_ATTEMPTS = 400;
    let installAttempts = 0;

    function eventId() {
        const random = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
            ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            : Math.random().toString(36).slice(2, 14);
        return `${Date.now()}_${random}`;
    }

    function targetPath(targetRef) {
        try {
            const url = new URL(targetRef.toString());
            return decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''));
        } catch (_) {
            return 'unknown';
        }
    }

    function currentActor() {
        try {
            return window.localStorage.getItem('hamHandlerCurrentPlayer')
                || window.localStorage.getItem('firebaseAuthLoggedIn')
                || window.localStorage.getItem('bypassLoginInProgress')
                || 'unidentified-pig';
        } catch (_) {
            return 'unidentified-pig';
        }
    }

    function payloadJson(value) {
        const json = JSON.stringify(value);
        return typeof json === 'string' ? json : 'null';
    }

    async function install() {
        installAttempts += 1;
        const ready = window.firebaseDB
            && window.firebaseRef
            && window.firebaseSet;

        if (!ready) {
            if (installAttempts < MAX_INSTALL_ATTEMPTS) {
                setTimeout(install, 25);
            } else {
                console.warn('🐷 Safety ledger could not find Firebase.');
            }
            return;
        }

        if (window.firebaseSet.__mbeSafetyWrapped) return;

        const originalSet = window.firebaseSet;
        const originalUpdate = window.firebaseUpdate || null;
        const ref = window.firebaseRef;
        const db = window.firebaseDB;

        async function record(op, targetRef, value) {
            const path = targetPath(targetRef);
            if (path === SAFETY_ROOT || path.startsWith(`${SAFETY_ROOT}/`)) return;

            const serialized = payloadJson(value);
            const id = eventId();
            const event = {
                id,
                version: VERSION,
                op,
                path,
                actor: currentActor(),
                page: (window.location && window.location.pathname) || '/',
                timestamp: new Date().toISOString(),
                payloadBytes: serialized.length,
                payloadJson: serialized
            };

            try {
                await originalSet(ref(db, `${SAFETY_ROOT}/events/${id}`), event);
            } catch (error) {
                // Never turn a successful golf/game write into a user-facing
                // failure just because the redundant safety copy had trouble.
                console.error('🐷 Safety ledger copy failed:', error);
            }
        }

        async function auditedSet(targetRef, value) {
            const result = await originalSet(targetRef, value);
            await record('set', targetRef, value);
            return result;
        }

        auditedSet.__mbeSafetyWrapped = true;
        auditedSet.__mbeOriginal = originalSet;
        window.firebaseSet = auditedSet;

        if (originalUpdate) {
            async function auditedUpdate(targetRef, value) {
                const result = await originalUpdate(targetRef, value);
                await record('update', targetRef, value);
                return result;
            }
            auditedUpdate.__mbeSafetyWrapped = true;
            auditedUpdate.__mbeOriginal = originalUpdate;
            window.firebaseUpdate = auditedUpdate;
        }
        window.mbeSafetyLedgerReady = true;

        window.downloadYear7SafetyLedger = async function downloadYear7SafetyLedger() {
            try {
                if (!window.firebaseGet) {
                    throw new Error('Firebase export reader unavailable on this page');
                }
                const rootSnapshot = await window.firebaseGet(ref(db));
                const root = rootSnapshot.val() || {};
                const safety = root[SAFETY_ROOT] || {};
                delete root[SAFETY_ROOT];

                const exportData = {
                    exportedAt: new Date().toISOString(),
                    season: 'Year VII — 2026',
                    liveSnapshot: root,
                    safetyLedger: safety
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `piggypiggy-year7-safety-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                alert('💾 YEAR VII SAFETY VAULT DOWNLOADED.\n\nHide it somewhere the pigs cannot reach.');
            } catch (error) {
                console.error('Safety vault export failed:', error);
                alert('❌ The safety vault export failed. Try again with a better signal.');
            }
        };

        console.log('💾 Year VII safety ledger armed.');
    }

    window.downloadYear7SafetyLedger = function safetyLedgerWarmingUp() {
        alert('🐷 The safety vault is still warming up. Try again in a moment.');
    };
    install();
})();
