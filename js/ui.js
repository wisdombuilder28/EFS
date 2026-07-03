import {
    postsCollection, onSnapshot, db, deleteDoc, doc,
    updateDoc, increment, arrayUnion
} from "./firebase.js";

import { verifyStaffPassword } from "./auth.js";

// ── Category styles ───────────────────────────────────────────────────────────
const CATEGORY_STYLES = {
    general:  { border: '#6b7280', tagBg: '#f3f4f6', tagColor: '#374151', label: 'GENERAL'  },
    academic: { border: '#2563eb', tagBg: '#eff6ff', tagColor: '#1d4ed8', label: 'ACADEMIC' },
    events:   { border: '#7c3aed', tagBg: '#f5f3ff', tagColor: '#6d28d9', label: 'EVENTS'   },
    sports:   { border: '#16a34a', tagBg: '#f0fdf4', tagColor: '#15803d', label: 'SPORTS'   },
    urgent:   { border: '#dc2626', tagBg: '#fef2f2', tagColor: '#b91c1c', label: 'URGENT'   },
};

// ── SVG icons ─────────────────────────────────────────────────────────────────
const ICON_PIN     = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
const ICON_TRASH   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICON_CLOCK   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const ICON_SHARE   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const ICON_EYE     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_COMMENT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_EXPIRY  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

const REACTIONS = [
    { type: 'like',      emoji: '👍', label: 'Like'      },
    { type: 'heart',     emoji: '❤️', label: 'Heart'     },
    { type: 'wow',       emoji: '😲', label: 'Wow'       },
    { type: 'handshake', emoji: '🤝', label: 'Handshake' },
];

const TRUNCATE_CHARS = 200;
const MAX_COMMENT_NAME   = 40;
const MAX_COMMENT_TEXT   = 300;
const COMMENT_COOLDOWN_MS = 10000; // 10 seconds between comments per post

// ── Module state ──────────────────────────────────────────────────────────────
let cachedDocs    = [];
let currentFilter = 'all';
let searchQuery   = '';

// ── SECURITY: Safe HTML escaping — applied to ALL user-generated content ──────
// This prevents XSS: if someone stores <script>alert(1)</script> in a post,
// it renders as visible text, not as executable code.
const escapeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Search highlight — escapes first, then wraps matched query in <mark>
const highlightText = (text, query) => {
    if (!query) return escapeHTML(text);
    const escaped  = escapeHTML(text);
    const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${escapedQ})`, 'gi'), '<mark>$1</mark>');
};

// Safe DOM text setter — uses textContent, never innerHTML, for plain text nodes
const setTextSafe = (el, text) => {
    if (el) el.textContent = String(text || '');
};

// ═══════════════════════════════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════════════════════════════
const updateDarkModeIcon = (theme) => {
    document.getElementById('icon-moon')?.classList.toggle('hidden', theme === 'dark');
    document.getElementById('icon-sun')?.classList.toggle('hidden',  theme !== 'dark');
};
updateDarkModeIcon(localStorage.getItem('theme') || 'light');

window.toggleDarkMode = () => {
    const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark'
        ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateDarkModeIcon(next);
};

// ═══════════════════════════════════════════════════════════════════
// LIGHTBOX
// FIX: addEventListener moved inside DOMContentLoaded — previously it ran
// at module top-level BEFORE the DOM was ready, which threw a TypeError and
// crashed the entire module (causing "toggleDarkMode is not defined" etc.)
// ═══════════════════════════════════════════════════════════════════
window.openLightbox = (src) => {
    const img = document.getElementById('lightbox-img');
    const lb  = document.getElementById('lightbox');
    if (!img || !lb) return;
    // SECURITY: Only allow data: URLs (our base64 images) or same-origin URLs
    if (!src.startsWith('data:image/') && !src.startsWith(window.location.origin)) {
        console.warn('Lightbox: blocked non-local image src');
        return;
    }
    img.src = src;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeLightbox = () => {
    const lb  = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb)  lb.classList.add('hidden');
    if (img) img.src = '';
    document.body.style.overflow = '';
};

// ═══════════════════════════════════════════════════════════════════
// READ MORE / LESS
// ═══════════════════════════════════════════════════════════════════
window.toggleReadMore = (btn) => {
    const postId = btn.dataset.postId;
    const bodyEl = document.getElementById('body-' + postId);
    if (!bodyEl) return;
    const expanding = bodyEl.classList.contains('truncated');
    bodyEl.classList.toggle('truncated');
    btn.textContent = expanding ? 'Read less' : 'Read more';
};

// ═══════════════════════════════════════════════════════════════════
// SHARE
// ═══════════════════════════════════════════════════════════════════
window.sharePost = async (postId) => {
    const snap = cachedDocs.find(d => d.id === postId);
    if (!snap) return;
    const post = snap.data();
    const text = `${post.title || ''}\n\n${post.body || ''}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: post.title || 'Announcement', text, url: window.location.href });
        } else {
            await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
            alert('Announcement copied to clipboard!');
        }
    } catch (err) {
        if (err.name !== 'AbortError') console.error('Share error:', err);
    }
};

// ═══════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════
window.onSearch = (value) => {
    // SECURITY: trim + lowercase only — no HTML interpretation
    searchQuery = value.trim().toLowerCase();
    document.getElementById('search-clear')?.classList.toggle('hidden', !searchQuery);
    renderFeed();
};

window.clearSearch = () => {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    searchQuery = '';
    document.getElementById('search-clear')?.classList.add('hidden');
    renderFeed();
};

const postMatchesSearch = (post) => {
    if (!searchQuery) return true;
    return [post.title, post.body, post.author, post.category]
        .join(' ').toLowerCase().includes(searchQuery);
};

// ═══════════════════════════════════════════════════════════════════
// NEW POST BADGE
// ═══════════════════════════════════════════════════════════════════
const LAST_SEEN_KEY = 'lastSeenTimestamp';

if (!localStorage.getItem(LAST_SEEN_KEY)) {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
}

const updateNewPostBadge = (docs) => {
    const lastSeen = parseInt(localStorage.getItem(LAST_SEEN_KEY), 10);
    const badge    = document.getElementById('new-post-badge');
    if (!badge) return;
    const count = docs.filter(d => {
        const t = d.data().date ? new Date(d.data().date).getTime() : 0;
        return t > lastSeen;
    }).length;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
};

const markAllSeen = () => {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    document.getElementById('new-post-badge')?.classList.add('hidden');
};

window.addEventListener('scroll', () => {
    if (window.scrollY > 80) markAllSeen();
}, { passive: true });

window.addEventListener('beforeunload', () => {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
});

// ═══════════════════════════════════════════════════════════════════
// VIEW COUNTER
// ═══════════════════════════════════════════════════════════════════
const hasViewed = (id) => localStorage.getItem(`viewed_${id}`) === '1';

const recordView = async (id) => {
    if (hasViewed(id)) return;
    localStorage.setItem(`viewed_${id}`, '1');
    try {
        await updateDoc(doc(db, 'announcements', id), { views: increment(1) });
    } catch (err) {
        console.error('View count error:', err);
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXPIRY
// ═══════════════════════════════════════════════════════════════════
const isExpired = (post) => {
    if (!post.expiresAt) return false;
    return new Date(post.expiresAt) <= new Date();
};

const formatExpiry = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
         + ' at '
         + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════
// COMMENTS
// Stored as an array field in the post doc — no subcollection needed.
// All user input is validated and escaped before use.
// Rate limiting: one comment per post per 10 seconds per browser session.
// ═══════════════════════════════════════════════════════════════════
const openCommentSections = new Set();

// Per-post last-submit timestamps for rate limiting
const lastCommentTime = {};

window.toggleComments = (postId) => {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;

    const isOpen = openCommentSections.has(postId);
    if (isOpen) {
        section.classList.add('hidden');
        openCommentSections.delete(postId);
    } else {
        section.classList.remove('hidden');
        openCommentSections.add(postId);
        // Render fresh from cachedDocs — the list HTML baked at card-build
        // time shows "No comments yet" because the section was collapsed then.
        const snap     = cachedDocs.find(d => d.id === postId);
        const comments = snap ? (snap.data().comments || []) : [];
        renderCommentList(postId, comments);
    }
};

const renderCommentList = (postId, comments) => {
    const listEl = document.getElementById(`comment-list-${postId}`);
    if (!listEl) return;

    if (!comments || comments.length === 0) {
        listEl.innerHTML = `<p class="comments-empty">No comments yet. Be the first!</p>`;
        return;
    }

    const sorted = [...comments].sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
    );

    // SECURITY: Use a DocumentFragment with textContent — no innerHTML for user data
    const frag = document.createDocumentFragment();
    sorted.forEach(c => {
        const item   = document.createElement('div');
        item.className = 'comment-item';

        const header = document.createElement('div');
        header.className = 'comment-header';

        const author = document.createElement('span');
        author.className = 'comment-author';
        author.textContent = c.name || 'Anonymous'; // textContent = auto-escaped

        const dateSpan = document.createElement('span');
        dateSpan.className = 'comment-date';
        if (c.date) {
            const d = new Date(c.date);
            dateSpan.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                 + ' at '
                                 + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        const text = document.createElement('p');
        text.className   = 'comment-text';
        text.textContent = c.text || ''; // textContent = auto-escaped

        header.appendChild(author);
        header.appendChild(dateSpan);
        item.appendChild(header);
        item.appendChild(text);
        frag.appendChild(item);
    });

    listEl.innerHTML = ''; // clear safely
    listEl.appendChild(frag);
};

window.submitComment = async (postId) => {
    const nameInput = document.getElementById(`comment-name-${postId}`);
    const textInput = document.getElementById(`comment-text-${postId}`);
    const submitBtn = document.getElementById(`comment-submit-${postId}`);

    const name = (nameInput?.value || '').trim();
    const text = (textInput?.value || '').trim();

    // Validate
    if (!name) { alert('Please enter your name.'); nameInput?.focus(); return; }
    if (!text) { alert('Please write a comment.'); textInput?.focus(); return; }

    // SECURITY: Enforce length limits — JS-only limits can be bypassed in DevTools
    if (name.length > MAX_COMMENT_NAME) {
        alert(`Name must be ${MAX_COMMENT_NAME} characters or less.`); return;
    }
    if (text.length > MAX_COMMENT_TEXT) {
        alert(`Comment must be ${MAX_COMMENT_TEXT} characters or less.`); return;
    }

    // SECURITY: Rate limiting — prevent comment spam
    const now      = Date.now();
    const lastTime = lastCommentTime[postId] || 0;
    if (now - lastTime < COMMENT_COOLDOWN_MS) {
        const wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - lastTime)) / 1000);
        alert(`Please wait ${wait} more second(s) before posting another comment.`);
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Posting...'; }

    try {
        lastCommentTime[postId] = Date.now();

        await updateDoc(doc(db, 'announcements', postId), {
            comments: arrayUnion({
                name: name.slice(0, MAX_COMMENT_NAME), // enforce server-side too
                text: text.slice(0, MAX_COMMENT_TEXT),
                date: new Date().toISOString(),
                id:   `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            })
        });

        if (nameInput) nameInput.value = '';
        if (textInput) textInput.value = '';

        // onSnapshot will update cachedDocs and re-render the comment list
    } catch (err) {
        console.error('Submit comment error:', err);
        lastCommentTime[postId] = 0; // reset so they can retry on genuine error
        alert('Could not post comment. Check your connection and try again.');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post'; }
    }
};

// ── Reaction helpers ──────────────────────────────────────────────────────────
const hasReacted = (postId, type) =>
    localStorage.getItem(`reacted_${postId}_${type}`) === '1';

const buildReactionsHTML = (id, reacts) =>
    REACTIONS.map(r => {
        const count   = (reacts && reacts[r.type]) || 0;
        const reacted = hasReacted(id, r.type);
        // SECURITY: id comes from Firestore doc IDs (alphanumeric) — safe to use in attributes
        return `<button
            id="react-${r.type}-${id}"
            class="react-btn${reacted ? ' reacted' : ''}"
            onclick="reactToPost('${id}','${r.type}')"
            ${reacted ? 'disabled' : ''}
            title="${escapeHTML(r.label)}">
            ${r.emoji} <span id="count-${r.type}-${id}">${count}</span>
        </button>`;
    }).join('');

// ── Filter tabs ───────────────────────────────────────────────────────────────
window.setActiveFilter = (category) => {
    // SECURITY: whitelist the allowed categories — reject anything unexpected
    const allowed = ['all', 'general', 'academic', 'events', 'sports', 'urgent'];
    if (!allowed.includes(category)) return;

    currentFilter = category;
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    renderFeed();
};

// ── Realtime listener ─────────────────────────────────────────────────────────
export const listenToPostsRealtime = () => {
    const generalFeed = document.getElementById('general-feed');
    if (generalFeed) generalFeed.innerHTML = `<p class="feed-empty-msg">Loading announcements...</p>`;

    onSnapshot(postsCollection,
        (snapshot) => {
            cachedDocs = snapshot.docs.sort((a, b) => {
                const dA = a.data().date ? new Date(a.data().date) : new Date(0);
                const dB = b.data().date ? new Date(b.data().date) : new Date(0);
                return dB - dA;
            });
            updateNewPostBadge(cachedDocs);
            renderFeed();
        },
        (error) => {
            console.error('Firestore error:', error);
            const feed = document.getElementById('general-feed');
            if (feed) feed.innerHTML = `
                <div class="feed-error">
                    <p style="font-size:17px;font-weight:700;margin-bottom:6px;">Could not load announcements.</p>
                    <p style="font-size:14px;">Check your internet connection and refresh the page.</p>
                </div>`;
        }
    );
};

// ── Smart feed renderer ───────────────────────────────────────────────────────
const renderFeed = () => {
    const pinnedFeed  = document.getElementById('pinned-feed');
    const generalFeed = document.getElementById('general-feed');
    if (!pinnedFeed || !generalFeed) return;

    let filtered = currentFilter === 'all'
        ? cachedDocs
        : cachedDocs.filter(d => (d.data().category || 'general') === currentFilter);

    filtered = filtered.filter(d => !isExpired(d.data()));
    filtered = filtered.filter(d => postMatchesSearch(d.data()));

    if (filtered.length === 0) {
        pinnedFeed.innerHTML  = '';
        // SECURITY: currentFilter is whitelisted above, but escape anyway for defence in depth
        const safeFilter = escapeHTML(currentFilter);
        const msg = searchQuery
            ? `No announcements found for "<strong>${escapeHTML(searchQuery)}</strong>".`
            : `No announcements${currentFilter === 'all' ? '' : ` in "${safeFilter}"`} yet.`;
        generalFeed.innerHTML = `<p class="feed-empty-msg">${msg}</p>`;
        return;
    }

    pinnedFeed.querySelectorAll('.feed-empty-msg, .feed-error').forEach(el => el.remove());
    generalFeed.querySelectorAll('.feed-empty-msg, .feed-error').forEach(el => el.remove());

    const visibleIds = new Set(filtered.map(d => d.id));
    document.querySelectorAll('.news-card[data-id]').forEach(el => {
        if (!visibleIds.has(el.dataset.id)) el.remove();
    });

    filtered.forEach((docSnap, index) => {
        const post       = docSnap.data();const id         = docSnap.id;
        const targetFeed = post.pinned ? pinnedFeed : generalFeed;
        const existing   = document.querySelector(`.news-card[data-id="${id}"]`);

        if (existing) {
            // Patch only what changed — do not rebuild the whole card
            const bar = existing.querySelector('.reactions-bar');
            if (bar) bar.innerHTML = buildReactionsHTML(id, post.reacts);

            const viewEl = existing.querySelector('.view-count-num');
            if (viewEl) viewEl.textContent = String(post.views || 0);

            const countEl  = existing.querySelector(`#comment-count-${id}`);
            const comments = post.comments || [];
            if (countEl) countEl.textContent = String(comments.length);

            // Re-render open comment sections with fresh data
            if (openCommentSections.has(id)) renderCommentList(id, comments);

            if (existing.parentElement !== targetFeed) targetFeed.appendChild(existing);
        } else {
            const wrapper     = document.createElement('div');
            wrapper.innerHTML = buildCardHTML(post, id);
            const card        = wrapper.firstElementChild;
            if (!card) return;
            const siblings = Array.from(targetFeed.querySelectorAll('.news-card[data-id]'));
            targetFeed.insertBefore(card, siblings[index] || null);
            recordView(id);
        }
    });
};

// ── Reaction handler ──────────────────────────────────────────────────────────
window.reactToPost = async (postId, type) => {
    // SECURITY: whitelist reaction types
    const validTypes = ['like', 'heart', 'wow', 'handshake'];
    if (!validTypes.includes(type)) return;
    if (hasReacted(postId, type)) return;

    localStorage.setItem(`reacted_${postId}_${type}`, '1');

    const btn     = document.getElementById(`react-${type}-${postId}`);
    const countEl = document.getElementById(`count-${type}-${postId}`);
    if (btn) { btn.disabled = true; btn.classList.add('reacted'); }
    if (countEl) countEl.textContent = String(parseInt(countEl.textContent || '0') + 1);

    try {
        await updateDoc(doc(db, 'announcements', postId), {
            [`reacts.${type}`]: increment(1)
        });
    } catch (err) {
        console.error('React error:', err);
        localStorage.removeItem(`reacted_${postId}_${type}`);
        if (btn) { btn.disabled = false; btn.classList.remove('reacted'); }
        if (countEl) countEl.textContent = String(Math.max(0, parseInt(countEl.textContent || '1') - 1));
        alert('Could not save your reaction. Try again.');
    }
};

// ── Delete handler — uses hashed password verification ────────────────────────
window.deletePost = async (id) => {
    const pass = prompt('Enter Staff Password to delete this announcement:');
    if (pass === null) return;

    const ok = await verifyStaffPassword(pass);
    if (ok) {
        if (confirm('Permanently delete this announcement? This cannot be undone.')) {
            try { await deleteDoc(doc(db, 'announcements', id)); }
            catch (err) { alert('Error deleting: ' + err.message); }
        }
    } else {
        alert('Action Denied: Incorrect password.');
    }
};

// ── Card builder ──────────────────────────────────────────────────────────────
// SECURITY NOTE: All user-generated content (title, body, author, comments)
// goes through escapeHTML() or highlightText() before being placed in innerHTML.
// SVG icons are hardcoded strings — not user data.
// Firestore doc IDs are alphanumeric strings generated by Firebase — safe for attributes.
const buildCardHTML = (post, id) => {
    const catKey = (post.category || 'general').toLowerCase();
    const style  = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.general;

    const safeTitle  = highlightText(post.title  || 'Untitled', searchQuery);
    const safeAuthor = escapeHTML(post.author || 'Admin');
    const rawBody    = post.body || '';

    const dateObj = post.date ? new Date(post.date) : new Date();
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  + ' at '
                  + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const pinnedBadge = post.pinned
        ? `<span class="pinned-badge">${ICON_PIN} PINNED</span>` : '';
    const categoryTag = `<span class="tag" style="background:${style.tagBg};color:${style.tagColor};border:1px solid ${style.border}30;">${style.label}</span>`;
    const authorTag   = `<span class="tag author-tag">${safeAuthor}</span>`;

    // Images: stored as base64 data URIs (our own compressed data), safe to use
    const imageHTML = post.image
        ? `<img src="${escapeHTML(post.image)}" alt="Announcement image" class="card-image" loading="lazy" onclick="openLightbox(this.src)" title="Tap to view full size">` : '';
    const audioHTML = post.audio
        ? `<audio controls src="${escapeHTML(post.audio)}" class="card-audio"></audio>` : '';

    const needsTruncation = !searchQuery && rawBody.length > TRUNCATE_CHARS;
    const bodyClass       = needsTruncation ? 'news-content truncated' : 'news-content';
    const readMoreBtn     = needsTruncation
        ? `<button class="read-more-btn" onclick="toggleReadMore(this)" data-post-id="${id}">Read more</button>` : '';

    const viewCount = post.views || 0;
    const viewHTML  = `<span class="view-count">${ICON_EYE} <span class="view-count-num">${viewCount}</span></span>`;

    const expiryHTML = post.expiresAt
        ? `<div class="expiry-notice">${ICON_EXPIRY} Expires ${escapeHTML(formatExpiry(post.expiresAt))}</div>` : '';

    const comments     = post.comments || [];
    const commentCount = comments.length;

    const commentsHTML = `
        <div class="comments-section">
            <button
                id="comment-toggle-${id}"
                class="comment-toggle-btn"
                onclick="toggleComments('${id}')">
                ${ICON_COMMENT}
                Comments (<span id="comment-count-${id}">${commentCount}</span>)
            </button>
            <div id="comments-${id}" class="comments-body hidden">
                <div id="comment-list-${id}" class="comment-list">
                    <p class="comments-empty">Tap to load comments.</p>
                </div>
                <div class="comment-form">
                    <input
                        id="comment-name-${id}"
                        type="text"
                        class="comment-input"
                        placeholder="Your name..."
                        maxlength="${MAX_COMMENT_NAME}">
                    <textarea
                        id="comment-text-${id}"
                        class="comment-input comment-textarea"
                        placeholder="Write a comment... (max ${MAX_COMMENT_TEXT} characters)"
                        maxlength="${MAX_COMMENT_TEXT}"
                        rows="2"></textarea>
                    <button
                        id="comment-submit-${id}"
                        class="comment-submit-btn"
                        onclick="submitComment('${id}')">
                        Post
                    </button>
                </div>
            </div>
        </div>`;

    return `
    <div class="news-card" data-id="${id}" style="border-left:4px solid ${style.border};">
        ${imageHTML}
        <div class="tag-container">
            <div class="tags-left">
                ${categoryTag}
                ${authorTag}
                ${pinnedBadge}
            </div>
            <button onclick="deletePost('${id}')" class="delete-btn">
                ${ICON_TRASH} Delete
            </button>
        </div>
        <h3 class="card-title">${safeTitle}</h3>
        <p class="${bodyClass}" id="body-${id}">${highlightText(rawBody, searchQuery)}</p>
        ${readMoreBtn}
        ${expiryHTML}
        ${audioHTML}
        <div class="card-footer">
            <div class="reactions-bar">${buildReactionsHTML(id, post.reacts)}</div>
            <div class="card-meta">
                <div style="display:flex;align-items:center;gap:10px;">
                    ${viewHTML}
                    <button class="share-btn" onclick="sharePost('${id}')">
                        ${ICON_SHARE} Share
                    </button>
                </div>
                <div class="card-date">${ICON_CLOCK} ${dateStr}</div>
            </div>
        </div>
        ${commentsHTML}
    </div>`;
};

// ═══════════════════════════════════════════════════════════════════
// DOM READY — wire up event listeners that need DOM elements to exist
// FIX: These were previously at module top-level, which caused a crash
// when the module loaded before DOM was ready, preventing ALL window.*
// functions (toggleDarkMode, setActiveFilter, etc.) from being registered.
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target.id === 'lightbox') window.closeLightbox();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const lb = document.getElementById('lightbox');
            if (lb && !lb.classList.contains('hidden')) window.closeLightbox();
        }
    });
});