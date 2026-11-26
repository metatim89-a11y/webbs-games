/**
 * WebbsChat: the small pieces every chat box on the site shares.
 *   - Family Chat on the main menu (shared board, or this-phone-only board)
 *   - Table chat inside each online game (network.js)
 *   - Time labels in private messages (family.js)
 * One place for these means every chat looks and behaves the same:
 * same message line, same time label, same 300-letter limit, same Enter-to-send,
 * and the same "greyed out with a reason" look when sending isn't possible yet.
 */
const WebbsChat = {
    MAX: 300, // longest message, same limit the family database keeps

    // "7:42 PM" today, "Nov 26 7:42 PM" on other days
    timeLabel(ts) {
        if (!ts) return '';
        const d = new Date(ts), today = new Date();
        const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (d.toDateString() === today.toDateString()) return t;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + t;
    },

    // One message line. Text is always set as text, never as HTML.
    // when: a timestamp (number) or a ready-made label (string, from older saved messages)
    line({ name, text, when, mine }) {
        const row = document.createElement('div');
        row.className = 'chat-line' + (mine ? ' mine' : '');
        const who = document.createElement('strong');
        who.className = 'chat-who';
        who.textContent = (mine ? 'You' : String(name || 'Guest').slice(0, 30)) + ': ';
        row.appendChild(who);
        row.appendChild(document.createTextNode(String(text || '').slice(0, this.MAX)));
        const label = typeof when === 'number' ? this.timeLabel(when) : (typeof when === 'string' ? when : '');
        if (label) {
            const time = document.createElement('span');
            time.className = 'chat-time';
            time.textContent = ' ' + label;
            row.appendChild(time);
        }
        return row;
    },

    // Shown in an empty chat box so it never looks broken
    empty(text) {
        const e = document.createElement('div');
        e.className = 'chat-empty';
        e.textContent = text;
        return e;
    },

    // Wire a text box and its Send button. onSend(text) returns false if it couldn't send,
    // and then the words stay in the box so nothing typed is lost.
    bindInput(input, button, onSend) {
        input.maxLength = this.MAX;
        input.setAttribute('enterkeyhint', 'send');
        const send = () => {
            const text = input.value.trim();
            if (!text || input.disabled) return;
            if (onSend(text) === false) return;
            input.value = '';
        };
        if (button) button.addEventListener('click', send);
        input.addEventListener('keydown', e => {
            // isComposing: don't send halfway through typing with an emoji or language keyboard
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); }
        });
    },

    // Grey the box out and say why, instead of letting a message vanish
    setEnabled(input, button, enabled, reason, placeholder) {
        input.disabled = !enabled;
        input.placeholder = enabled ? placeholder : reason;
        if (button) {
            button.disabled = !enabled;
            button.title = enabled ? '' : reason;
        }
    }
};
