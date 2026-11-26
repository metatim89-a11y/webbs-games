/**
 * FamilyUI: the main-menu side of WebbsCloud.
 *   - Messages: private 1-to-1 chats with unread badges
 *   - Invites: "Tim invited you to Sorry" cards with a Join button
 *   - Open tables: games family members are hosting right now
 *   - Family chat: the shared message board, now the same on every phone
 * Everything here needs an approved family account; guests and offline phones simply don't see it.
 */
const FamilyUI = (() => {
    let offs = [];             // unsubscribe functions for live listeners
    let family = [];           // approved players other than me
    let inbox = {};            // otherId -> { last, unread }
    let openThreadWith = null; // otherId while a conversation is open
    let threadOff = null;

    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const nameOf = id => (family.find(p => p.id === id) || {}).name || (typeof ProfileManager !== 'undefined' ? ProfileManager.resolveName(id) : id);

    const timeLabel = ts => WebbsChat.timeLabel(ts); // shared with the game chats (chat.js)

    function stopAll() {
        offs.forEach(f => { try { f(); } catch (e) {} });
        offs = [];
        if (threadOff) { threadOff(); threadOff = null; }
        family = []; inbox = {};
    }

    // Called when the main menu shows and whenever the signed-in account changes
    function refresh() {
        stopAll();
        const me = window.WebbsCloud && WebbsCloud.me;
        const signedInHere = me && me.id === (typeof activePlayer !== 'undefined' ? activePlayer : null);
        $('family-features').style.display = signedInHere ? 'block' : 'none';
        $('pending-note').style.display = signedInHere && !me.approved && !me.admin ? 'block' : 'none';
        $('messages-btn').style.display = signedInHere && me.approved ? 'inline-block' : 'none';
        document.body.classList.toggle('cloud-chat', !!(signedInHere && me.approved));
        if (typeof renderMessages === 'function') renderMessages(); // Family Chat note: shared, or this phone only
        if (signedInHere && $('active-player-name')) $('active-player-name').innerText = `Welcome, ${me.name.toUpperCase()}!`;
        if (!signedInHere || !me.approved) {
            renderInvites([]);
            $('open-tables').style.display = 'none';
            $('admin-approvals').style.display = 'none';
            return;
        }

        offs.push(WebbsCloud.watchPlayers(players => {
            if (me.admin) renderApprovals(players.filter(p => !p.approved));
            const others = players.filter(p => p.approved && p.id !== me.id);
            const changed = others.map(p => p.id).join() !== family.map(p => p.id).join();
            family = others;
            if (changed) {
                if (offs.inboxOff) offs.inboxOff();
                const off = WebbsCloud.watchInbox(family.map(p => p.id), state => { inbox = state; renderInbox(); });
                offs.inboxOff = off; offs.push(off);
            }
            renderInbox();
            if (typeof renderPlayerSelect === 'function') renderPlayerSelect();
        }));
        offs.push(WebbsCloud.watchInvites(renderInvites));
        offs.push(WebbsCloud.watchTables(renderTables));
        offs.push(WebbsCloud.watchBoard(renderBoard));
    }

    // ---------- Invites + open tables ----------

    function joinPin(pin) {
        if (typeof joinTablePrompt !== 'function') return;
        joinTablePrompt();
        $('join-table-pin').value = pin;
        performAutoJoin();
    }

    function renderInvites(list) {
        const box = $('invite-inbox');
        box.innerHTML = '';
        list.forEach(inv => {
            const card = el('div', 'invite-card');
            card.appendChild(el('div', 'invite-text', `🎲 ${nameOf(inv.from)} invited you to ${inv.game}!`));
            const row = el('div', 'invite-actions');
            const join = el('button', 'modal-btn invite-join', 'Join');
            join.onclick = () => { WebbsCloud.dismissInvite(inv.key); joinPin(inv.pin); };
            const no = el('button', 'modal-btn invite-dismiss', 'Not now');
            no.onclick = () => WebbsCloud.dismissInvite(inv.key);
            row.append(join, no);
            card.appendChild(row);
            box.appendChild(card);
        });
    }

    function renderTables(list) {
        const box = $('open-tables');
        if (!box) return;
        box.innerHTML = '';
        box.style.display = 'block';
        box.appendChild(el('h3', 'section-title', '🎲 Game Lobby'));
        if (!list.length) {
            box.appendChild(el('p', 'lobby-empty', 'No one is waiting for a game right now. Tap "Host Online Table" and your family will see it here.'));
            return;
        }
        list.forEach(t => {
            const row = el('div', 'table-row');
            const info = el('div', 'table-info');
            info.appendChild(el('span', 'live-dot'));
            info.appendChild(el('span', '', `${nameOf(t.host)} · ${t.game}`));
            const join = el('button', 'modal-btn table-join', 'Join');
            join.onclick = () => joinPin(t.pin);
            row.append(info, join);
            box.appendChild(row);
        });
    }

    // ---------- Tim only: new players waiting for approval, right on the main menu ----------

    function renderApprovals(pending) {
        const box = $('admin-approvals');
        box.innerHTML = '';
        if (!pending.length) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.appendChild(el('h3', 'section-title', `👋 ${pending.length === 1 ? '1 person wants' : pending.length + ' people want'} to join the family`));
        pending.forEach(p => {
            const row = el('div', 'approval-row');
            const info = el('div', 'approval-info');
            info.appendChild(el('strong', '', p.name || p.id));
            const extra = [p.animal && `🐾 ${p.animal}`, p.favGame && `🎲 ${p.favGame}`, p.createdAt && `asked ${timeLabel(p.createdAt)}`].filter(Boolean).join(' · ');
            if (extra) info.appendChild(el('div', 'approval-extra', extra));
            const yes = el('button', 'modal-btn approval-yes', 'Approve');
            yes.onclick = async () => {
                yes.disabled = true; yes.textContent = '...';
                try { await WebbsCloud.adminApprove(p.id, true); }
                catch (e) { yes.disabled = false; yes.textContent = 'Try again'; }
            };
            row.append(info, yes);
            box.appendChild(row);
        });
        box.appendChild(el('div', 'approval-note', 'Approved people can message family, see the lobby and get invites. Deny or pause anyone from the ⚙️ gear.'));
    }

    // ---------- Family chat (shared board) ----------

    function renderBoard(msgs) {
        const box = $('messages');
        if (!box) return;
        box.innerHTML = '';
        const me = WebbsCloud.me;
        msgs.forEach(m => box.appendChild(WebbsChat.line({ name: nameOf(m.from), text: m.text, when: m.ts, mine: !!me && m.from === me.id })));
        if (!msgs.length) box.appendChild(WebbsChat.empty('No messages yet. Say hello to the family! 👋'));
        box.scrollTop = box.scrollHeight;
    }

    async function postBoard(text) { await WebbsCloud.postBoard(text); }

    // ---------- Private messages ----------

    function unreadCount() { return Object.values(inbox).filter(x => x.unread).length; }

    function renderInbox() {
        const n = unreadCount();
        const badge = $('messages-badge');
        badge.textContent = n;
        badge.style.display = n ? 'inline-flex' : 'none';
        if ($('dm-modal') && $('dm-modal').style.display === 'flex' && !openThreadWith) renderContacts();
    }

    function openMessages() {
        ensureModal();
        $('dm-modal').style.display = 'flex';
        showContacts();
    }

    function closeMessages() {
        if (threadOff) { threadOff(); threadOff = null; }
        openThreadWith = null;
        $('dm-modal').style.display = 'none';
    }

    function ensureModal() {
        if ($('dm-modal')) return;
        const modal = el('div', 'game-over-modal dm-modal');
        modal.id = 'dm-modal';
        modal.innerHTML = `
            <div class="modal-content dm-panel">
                <div class="dm-header">
                    <button class="dm-back" id="dm-back" aria-label="Back">←</button>
                    <h2 id="dm-title">Messages</h2>
                    <button class="dm-close" id="dm-close" aria-label="Close">✕</button>
                </div>
                <div id="dm-body" class="dm-body"></div>
                <div id="dm-compose" class="dm-compose">
                    <div class="dm-emoji" id="dm-emoji"></div>
                    <div class="dm-input-row">
                        <input id="dm-input" maxlength="500" placeholder="Write a message..." autocomplete="off">
                        <button id="dm-send" class="dm-send" aria-label="Send">➤</button>
                    </div>
                </div>
                <div class="dm-safety">🔒 Only approved family can message here. Tim and Cassie can see messages to keep everyone safe.</div>
            </div>`;
        document.body.appendChild(modal);
        $('dm-close').onclick = closeMessages;
        $('dm-back').onclick = showContacts;
        modal.addEventListener('click', e => { if (e.target === modal) closeMessages(); });
        ['👍', '😂', '❤️', '🎲', '🏆', '😮', '👋'].forEach(em => {
            const b = el('button', 'dm-emoji-btn', em);
            b.onclick = () => send(em);
            $('dm-emoji').appendChild(b);
        });
        $('dm-send').onclick = () => send($('dm-input').value);
        $('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter') send($('dm-input').value); });
    }

    function showContacts() {
        if (threadOff) { threadOff(); threadOff = null; }
        openThreadWith = null;
        $('dm-title').textContent = 'Messages';
        $('dm-back').style.visibility = 'hidden';
        $('dm-compose').style.display = 'none';
        renderContacts();
    }

    function renderContacts() {
        const body = $('dm-body');
        body.innerHTML = '';
        if (!family.length) {
            body.appendChild(el('p', 'dm-empty', 'No one else is approved yet. Tim or Cassie can approve family.'));
            return;
        }
        const sorted = [...family].sort((a, b) => ((inbox[b.id]?.last?.ts) || 0) - ((inbox[a.id]?.last?.ts) || 0));
        sorted.forEach(p => {
            const info = inbox[p.id] || {};
            const row = el('button', 'dm-contact' + (info.unread ? ' unread' : ''));
            const avatar = el('div', 'dm-avatar', (p.name || '?').charAt(0).toUpperCase());
            const text = el('div', 'dm-contact-text');
            text.appendChild(el('div', 'dm-contact-name', p.name));
            const preview = info.last ? (info.last.from === WebbsCloud.me.id ? 'You: ' : '') + info.last.text : 'Say hi 👋';
            text.appendChild(el('div', 'dm-contact-preview', preview));
            const side = el('div', 'dm-contact-side');
            side.appendChild(el('div', 'dm-contact-time', info.last ? timeLabel(info.last.ts) : ''));
            if (info.unread) side.appendChild(el('div', 'dm-dot'));
            row.append(avatar, text, side);
            row.onclick = () => openThread(p.id);
            body.appendChild(row);
        });
    }

    function openThread(otherId) {
        openThreadWith = otherId;
        $('dm-title').textContent = nameOf(otherId);
        $('dm-back').style.visibility = 'visible';
        $('dm-compose').style.display = 'block';
        const body = $('dm-body');
        body.innerHTML = '';
        body.appendChild(el('p', 'dm-empty', 'Loading...'));
        if (threadOff) threadOff();
        threadOff = WebbsCloud.watchConversation(otherId, msgs => {
            body.innerHTML = '';
            if (!msgs.length) body.appendChild(el('p', 'dm-empty', `This is the start of your chat with ${nameOf(otherId)}.`));
            let lastDay = '';
            msgs.forEach(m => {
                const day = m.ts ? new Date(m.ts).toDateString() : '';
                if (day && day !== lastDay) {
                    lastDay = day;
                    body.appendChild(el('div', 'dm-day', new Date(m.ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })));
                }
                const mine = m.from === WebbsCloud.me.id;
                const bubble = el('div', 'dm-bubble ' + (mine ? 'mine' : 'theirs'));
                if (/^\p{Extended_Pictographic}{1,3}$/u.test(m.text)) bubble.classList.add('big-emoji');
                bubble.appendChild(el('div', 'dm-text', m.text));
                bubble.appendChild(el('div', 'dm-time', timeLabel(m.ts)));
                body.appendChild(bubble);
            });
            body.scrollTop = body.scrollHeight;
            WebbsCloud.markRead(otherId);
        });
        setTimeout(() => $('dm-input').focus(), 50);
    }

    async function send(text) {
        if (!openThreadWith || !String(text).trim()) return;
        const input = $('dm-input');
        input.value = '';
        try { await WebbsCloud.sendMessage(openThreadWith, text); }
        catch (e) { input.value = text; input.placeholder = 'Not sent, check your signal and try again'; }
    }

    if (window.WebbsCloud) WebbsCloud.onChange(() => { if ($('family-features')) refresh(); });

    return { refresh, stopAll, openMessages, closeMessages, postBoard };
})();
window.FamilyUI = FamilyUI;
