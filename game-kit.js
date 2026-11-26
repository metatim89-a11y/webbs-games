/**
 * GameKit: the small pieces every game page shares, so every game behaves the same way.
 *
 *   GameKit.later(fn, ms)    a timer that a new game can cancel
 *   GameKit.sleep(ms)        the same, for animations written with await
 *   GameKit.cancelAll()      cancel every waiting timer (called by Reset / Play Again),
 *                            so the computer never takes a turn in the next game
 *                            and a half-finished animation never moves pieces on a fresh board
 *   GameKit.shuffle(list)    a fair shuffle (every order equally likely)
 *   GameKit.setControl(btn, enabled, reason)
 *                            grey a button out and put the reason on the button itself,
 *                            instead of hiding it or letting a tap do nothing
 */
const GameKit = (() => {
    const timers = new Set();

    function later(fn, ms) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.add(id);
        return id;
    }

    // A cancelled sleep never wakes up, so the animation that was waiting on it simply stops
    function sleep(ms) {
        return new Promise(resolve => later(resolve, ms));
    }

    function cancelAll() {
        timers.forEach(id => clearTimeout(id));
        timers.clear();
    }

    function setControl(btn, enabled, reason = '') {
        if (!btn) return;
        if (btn.dataset.label === undefined) btn.dataset.label = btn.textContent;
        btn.disabled = !enabled;
        btn.textContent = (enabled || !reason) ? btn.dataset.label : reason;
        btn.title = enabled ? '' : reason;
        btn.classList.toggle('kit-off', !enabled);
    }

    // A fair shuffle (Fisher-Yates): every order is equally likely.
    // list.sort(() => Math.random() - 0.5) is not fair: cards stay near where they started, so they come out in clumps.
    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    return { later, sleep, cancelAll, setControl, shuffle };
})();
