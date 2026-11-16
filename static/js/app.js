/* =========================================================
   یادداشت‌ها — App logic
   Vanilla JS · fetch API · no dependencies
   ========================================================= */
(() => {
    'use strict';

    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

    /* ---------- Config & URLs ---------- */
    const appRoot = $('#appRoot');
    const URLS = {
        create: appRoot.dataset.createUrl,
        update: appRoot.dataset.updateUrl, // /notes/0/update/
        delete: appRoot.dataset.deleteUrl, // /notes/0/delete/
    };
    const updateUrl = id => URLS.update.replace('/0/', `/${id}/`);
    const deleteUrl = id => URLS.delete.replace('/0/', `/${id}/`);

    /* ---------- CSRF ---------- */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    async function postForm(url, form) {
        // `form` may be a <form> element or an already-built FormData instance.
        const body = form instanceof FormData ? form : new FormData(form);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body,
        });

        let data = {};
        try { data = await response.json(); } catch (err) { /* non-JSON response */ }

        if (!response.ok) {
            const error = new Error('Request failed');
            error.data = data;
            throw error;
        }
        return data;
    }

    /* ---------- Persian helpers ---------- */
    const faNum = value => Number(value).toLocaleString('fa-IR');

    function normalize(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[يى]/g, 'ی')
            .replace(/ك/g, 'ک')
            .replace(/[\u064B-\u0652\u0670]/g, '') // Arabic harakat
            .replace(/\s+/g, ' ')
            .trim();
    }

    function relativeTime(iso) {
        const then = new Date(iso).getTime();
        if (Number.isNaN(then)) return '';

        const seconds = Math.round((then - Date.now()) / 1000);
        const absolute = Math.abs(seconds);
        const formatter = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });
        const units = [
            ['year', 31536000],
            ['month', 2592000],
            ['week', 604800],
            ['day', 86400],
            ['hour', 3600],
            ['minute', 60],
        ];

        for (const [unit, unitSeconds] of units) {
            if (absolute >= unitSeconds) {
                return formatter.format(Math.round(seconds / unitSeconds), unit);
            }
        }
        return 'همین حالا';
    }

    function renderTimes() {
        $$('time[data-datetime]').forEach(el => {
            el.textContent = relativeTime(el.dataset.datetime);
        });
    }

    /* ---------- Theme ---------- */
    const themeToggle = $('#themeToggle');

    function setTheme(theme) {
        const html = document.documentElement;
        html.classList.add('theme-anim');
        html.dataset.theme = theme;
        try { localStorage.setItem('theme', theme); } catch (err) { /* private mode */ }
        setTimeout(() => html.classList.remove('theme-anim'), 400);
    }

    themeToggle.addEventListener('click', () => {
        setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    /* ---------- Elements ---------- */
    const grid = $('#notesGrid');
    const searchInput = $('#searchInput');
    const sortSelect = $('#sortSelect');
    const countEl = $('#notesCount');
    const emptyState = $('#emptyState');
    const noResults = $('#noResults');

    const noteModal = $('#noteModal');
    const noteForm = $('#noteForm');
    const noteFormId = $('#noteFormId');
    const noteModalTitle = $('#noteModalTitle');
    const titleInput = $('#noteTitle');
    const titleCount = $('#titleCount');
    const contentInput = $('#noteContent');
    const pinnedInput = $('#notePinned');
    const saveBtn = $('#saveNoteBtn');

    const deleteModal = $('#deleteModal');
    const deleteNoteTitle = $('#deleteNoteTitle');
    const confirmDeleteBtn = $('#confirmDeleteBtn');
    let pendingDeleteId = null;

    const toastContainer = $('#toastContainer');
    let currentSort = 'newest';

    /* ---------- Toasts ---------- */
    const TOAST_ICONS = {
        success: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
        error: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>',
    };

    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `${TOAST_ICONS[type] || TOAST_ICONS.success}<span></span>`;
        el.querySelector('span').textContent = message;
        toastContainer.appendChild(el);

        requestAnimationFrame(() => el.classList.add('is-visible'));
        setTimeout(() => {
            el.classList.remove('is-visible');
            setTimeout(() => el.remove(), 320);
        }, 3200);
    }

    /* ---------- Modal manager ---------- */
    const openModals = new Set();

    function openModal(modal) {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        openModals.add(modal);
        document.body.classList.add('no-scroll');
    }

    function closeModal(modal) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        openModals.delete(modal);
        if (openModals.size === 0) document.body.classList.remove('no-scroll');
    }

    document.addEventListener('click', e => {
        const closer = e.target.closest('[data-close-modal]');
        if (!closer) return;
        const modal = closer.closest('.modal');
        if (modal) closeModal(modal);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && openModals.size > 0) {
            closeModal(Array.from(openModals).pop());
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && openModals.has(noteModal)) {
            e.preventDefault();
            noteForm.requestSubmit();
        }
    });

    /* ---------- Grid helpers ---------- */
    const cards = () => $$('.note-card', grid);

    function cardFromHtml(html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        return wrapper.firstElementChild;
    }

    function updateEmptyStates() {
        const all = cards();
        const visible = all.filter(card => !card.hidden);
        emptyState.hidden = all.length > 0;
        noResults.hidden = !(all.length > 0 && visible.length === 0);
        countEl.textContent = `${faNum(all.length)} یادداشت`;
    }

    function applySearch() {
        const query = normalize(searchInput.value);
        cards().forEach(card => {
            const haystack = normalize(`${card.dataset.title} ${card.dataset.content}`);
            card.hidden = query !== '' && !haystack.includes(query);
        });
        updateEmptyStates();
    }

    function sortCards() {
        const all = cards();
        all.sort((a, b) => {
            const pinDiff = Number(b.dataset.pinned) - Number(a.dataset.pinned);
            if (pinDiff !== 0) return pinDiff;

            if (currentSort === 'oldest') {
                return new Date(a.dataset.created) - new Date(b.dataset.created);
            }
            if (currentSort === 'title') {
                return a.dataset.title.localeCompare(b.dataset.title, 'fa');
            }
            return new Date(b.dataset.updated) - new Date(a.dataset.updated);
        });

        all.forEach((card, index) => {
            card.style.setProperty('--i', index);
            grid.appendChild(card);
        });
    }

    function addCard(html) {
        // Creating a note clears the filter, so previously hidden cards must
        // become visible again — applySearch() resets every card's hidden state.
        searchInput.value = '';
        const card = cardFromHtml(html);
        card.classList.add('is-new');
        grid.prepend(card);
        sortCards();
        applySearch();
        renderTimes();
    }

    function replaceCard(html) {
        const card = cardFromHtml(html);
        const old = grid.querySelector(`.note-card[data-id="${card.dataset.id}"]`);
        if (old) old.replaceWith(card);
        sortCards();
        applySearch();
        renderTimes();
    }

    function removeCard(id) {
        const card = grid.querySelector(`.note-card[data-id="${id}"]`);
        if (!card) return;
        card.classList.add('is-removing');
        setTimeout(() => {
            card.remove();
            updateEmptyStates();
        }, 220);
    }

    /* ---------- Note form ---------- */
    function updateTitleCount() {
        titleCount.textContent = faNum(titleInput.value.length);
    }

    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    function clearErrors() {
        $$('.field', noteForm).forEach(field => field.classList.remove('field--invalid'));
        $$('[data-error]', noteForm).forEach(el => { el.textContent = ''; });
    }

    function showErrors(errors = {}) {
        Object.entries(errors).forEach(([field, messages]) => {
            const wrap = noteForm.querySelector(`[data-field="${field}"]`);
            if (!wrap) return;
            wrap.classList.add('field--invalid');
            const errorEl = wrap.querySelector(`[data-error="${field}"]`);
            if (errorEl) {
                errorEl.textContent = Array.isArray(messages) ? messages.join(' ') : String(messages);
            }
        });
    }

    function setLoading(button, loading) {
        button.classList.toggle('is-loading', loading);
        button.disabled = loading;
    }

    function openCreateModal() {
        noteForm.reset();
        noteFormId.value = '';
        noteModalTitle.textContent = 'یادداشت جدید';
        clearErrors();
        updateTitleCount();
        autoResize(contentInput);
        openModal(noteModal);
        setTimeout(() => titleInput.focus(), 90);
    }

    function openEditModal(card) {
        noteForm.reset();
        noteFormId.value = card.dataset.id;
        noteModalTitle.textContent = 'ویرایش یادداشت';
        titleInput.value = card.dataset.title;
        contentInput.value = card.dataset.content;
        pinnedInput.checked = card.dataset.pinned === '1';

        const color = card.dataset.color || 'default';
        const radio = noteForm.querySelector(`input[name="color"][value="${color}"]`);
        if (radio) radio.checked = true;

        clearErrors();
        updateTitleCount();
        autoResize(contentInput);
        openModal(noteModal);
        setTimeout(() => titleInput.focus(), 90);
    }

    titleInput.addEventListener('input', updateTitleCount);
    contentInput.addEventListener('input', () => autoResize(contentInput));

    noteForm.addEventListener('submit', async e => {
        e.preventDefault();
        clearErrors();

        const id = noteFormId.value;
        const url = id ? updateUrl(Number(id)) : URLS.create;

        setLoading(saveBtn, true);
        try {
            const data = await postForm(url, noteForm);
            if (id) {
                replaceCard(data.html);
                toast('یادداشت به‌روزرسانی شد');
            } else {
                addCard(data.html);
                toast('یادداشت جدید ساخته شد');
            }
            closeModal(noteModal);
        } catch (err) {
            showErrors(err.data && err.data.errors);
            toast('لطفاً خطاهای فرم را بررسی کنید', 'error');
        } finally {
            setLoading(saveBtn, false);
        }
    });

    /* ---------- Delete ---------- */
    function openDeleteModal(card) {
        pendingDeleteId = card.dataset.id;
        deleteNoteTitle.textContent = card.dataset.title;
        openModal(deleteModal);
    }

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!pendingDeleteId) return;

        setLoading(confirmDeleteBtn, true);
        try {
            await postForm(deleteUrl(Number(pendingDeleteId)), new FormData());
            removeCard(pendingDeleteId);
            closeModal(deleteModal);
            toast('یادداشت حذف شد');
        } catch (err) {
            toast('حذف یادداشت با خطا مواجه شد', 'error');
        } finally {
            setLoading(confirmDeleteBtn, false);
            pendingDeleteId = null;
        }
    });

    /* ---------- Pin (quick action) ---------- */
    async function togglePin(card) {
        const pinned = card.dataset.pinned !== '1';
        const form = new FormData();
        form.append('title', card.dataset.title);
        form.append('content', card.dataset.content);
        form.append('color', card.dataset.color);
        form.append('is_pinned', pinned ? 'on' : '');

        const button = card.querySelector('[data-action="pin"]');
        if (button) button.disabled = true;

        try {
            const data = await postForm(updateUrl(Number(card.dataset.id)), form);
            replaceCard(data.html);
            toast(pinned ? 'یادداشت سنجاق شد' : 'سنجاق یادداشت برداشته شد');
        } catch (err) {
            toast('به‌روزرسانی سنجاق با خطا مواجه شد', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    /* ---------- Grid interactions ---------- */
    grid.addEventListener('click', e => {
        const button = e.target.closest('[data-action]');
        const card = e.target.closest('.note-card');
        if (!card) return;

        if (!button) {
            openEditModal(card); // clicking a card opens it for editing
            return;
        }

        const action = button.dataset.action;
        if (action === 'edit') openEditModal(card);
        else if (action === 'delete') openDeleteModal(card);
        else if (action === 'pin') togglePin(card);
    });

    /* ---------- Toolbar ---------- */
    let searchTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applySearch, 120);
    });

    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        sortCards();
    });

    $('#newNoteBtn').addEventListener('click', openCreateModal);
    $('#emptyNewNoteBtn').addEventListener('click', openCreateModal);

    /* ---------- Init ---------- */
    renderTimes();
    setInterval(renderTimes, 60000);
    updateEmptyStates();

    // Stop the entrance animation after it has played so re-sorting stays calm.
    setTimeout(() => grid.classList.remove('notes-grid--initial'), 1400);
})();
