(function () {
  const $ = (id) => document.getElementById(id);
  const cfg = window.SITE_CONFIG || {};

  // ---------- which GitHub repo are we? ----------
  // On owner.github.io/repo/ we can work it out from the URL.
  let owner = cfg.owner, repo = cfg.repo;
  const branch = cfg.branch || 'main';
  if ((!owner || !repo) && location.hostname.endsWith('.github.io')) {
    owner = owner || location.hostname.split('.')[0];
    repo = repo || location.pathname.split('/').filter(Boolean)[0] || location.hostname;
  }
  const hasRepo = !!(owner && repo);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  const api = (path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // ---------- language ----------
  let lang = 'es';
  try {
    const saved = localStorage.getItem('nubia_lang');
    if (saved === 'es' || saved === 'en') lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('en')) lang = 'en';
  } catch { /* storage blocked: keep default */ }
  const t = (k) => (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.en[k] || k;

  function applyLang() {
    document.documentElement.lang = lang;
    $('lang').dataset.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    if (data) renderPublic();
    if (draft) renderEditor();
  }
  $('lang').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    // tapping a side picks it; tapping anywhere else flips it like a slider
    lang = b ? b.dataset.lang : (lang === 'es' ? 'en' : 'es');
    try { localStorage.setItem('nubia_lang', lang); } catch {}
    applyLang();
  });

  // ---------- scoop colors ----------
  const FLAVOR_COLORS = [
    [/choc|cacao|brownie|fudge/, '#6b4226'],
    [/strawberr|fresa|frutilla/, '#f4a3b5'],
    [/mint|menta/, '#a8e6cf'],
    [/vanill|vainilla|cream cheese/, '#f7ecc8'],
    [/cookie|galleta|oreo/, '#b9b4ab'],
    [/coffee|caf[eé]|mocha|moka/, '#a47551'],
    [/caramel|dulce de leche|manjar|toffee/, '#d9a066'],
    [/mango|naranj|orange|maracuy|passion/, '#f7b267'],
    [/lemon|lim[oó]n|lime/, '#f5e663'],
    [/coco/, '#f4f1ea'],
    [/mora|blackberr|blueberr|ar[aá]ndano|uva|grape/, '#7b5ea7'],
    [/pistach/, '#b5d99c'],
    [/chicle|bubble|cotton|algod/, '#8ecae6'],
    [/guan[aá]bana|taxo|banan|pl[aá]tano/, '#efe3b0'],
    [/cherr|cereza|raspberr|frambuesa|ron/, '#c9405b'],
  ];
  const PASTELS = ['#f4a3b5', '#a8e6cf', '#f7ecc8', '#b5c7f2', '#f7b267', '#d7b8f3', '#f5e663', '#9ad1d4'];
  function scoopColor(name) {
    const n = name.toLowerCase();
    for (const [re, c] of FLAVOR_COLORS) if (re.test(n)) return c;
    let h = 0;
    for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PASTELS[h % PASTELS.length];
  }

  // ---------- loading data ----------
  let data = null;      // what the public page shows
  let draft = null;     // Nubia's edits (null when not editing)
  let token = null;     // unlocked GitHub key
  let sha = null;       // GitHub file version of data.json (needed to save)
  let demo = false;

  const utf8FromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  const b64FromUtf8 = (s) => { let bin = ''; new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };

  async function ghGet(path) {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(`${api(path)}?ref=${branch}&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
    const j = await r.json();
    return { json: JSON.parse(utf8FromB64(j.content)), sha: j.sha };
  }

  // Straight from GitHub's API = fresh within seconds. If that fails
  // (e.g. rate limit), fall back to the copy GitHub Pages serves.
  async function fetchFile(path) {
    if (hasRepo) {
      try { return await ghGet(path); } catch (e) { if (token) throw e; }
    }
    const r = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return { json: await r.json(), sha: null };
  }

  async function loadData() {
    try {
      const got = await fetchFile('data.json');
      data = got.json;
      if (got.sha) sha = got.sha;
      renderPublic();
    } catch (e) {
      console.error(e);
      if (!data) {
        $('status').className = 'status';
        $('status-text').textContent = t('loadFail');
      }
    }
  }

  // ---------- public view ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderPublic() {
    const d = draft || data;
    $('shop-name').textContent = d.shop || '';
    document.title = d.shop || document.title;

    $('status').className = 'status ' + (d.open ? 'open' : 'closed');
    $('status-text').textContent = d.open ? t('open') : t('closed');
    $('status-note').textContent = d.note || '';

    const ul = $('flavors');
    ul.replaceChildren();
    const list = d.flavors || [];
    if (!list.length) ul.append(el('li', 'empty', t('noFlavors')));
    for (const f of list) {
      const li = el('li', f.soldOut ? 'sold' : '');
      const dot = el('span', 'scoop');
      dot.style.background = scoopColor(f.name);
      li.append(dot, el('span', 'name', f.name));
      if (f.soldOut) li.append(el('span', 'pill', t('soldOut')));
      ul.append(li);
    }

    $('hours').textContent = d.hours || '';
    if (d.updated) {
      const when = new Date(d.updated);
      const loc = lang === 'es' ? 'es-EC' : 'en-US';
      $('updated').textContent = `${t('updated')} ${when.toLocaleString(loc, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
    }
  }

  // ---------- editor ----------
  function setDirty(on) {
    const m = $('save-msg');
    m.className = 'save-msg';
    m.textContent = on ? t('unsaved') : '';
  }

  function renderEditor() {
    $('edit-open').setAttribute('aria-checked', String(draft.open));
    const lbl = $('edit-open-label');
    lbl.textContent = draft.open ? t('open') : t('closed');
    lbl.className = 'big ' + (draft.open ? 'open' : 'closed');
    if (document.activeElement !== $('edit-note')) $('edit-note').value = draft.note || '';
    if (document.activeElement !== $('edit-shop')) $('edit-shop').value = draft.shop || '';
    if (document.activeElement !== $('edit-hours')) $('edit-hours').value = draft.hours || '';

    const ul = $('edit-flavors');
    ul.replaceChildren();
    draft.flavors.forEach((f, i) => {
      const li = el('li', f.soldOut ? 'sold' : '');
      const dot = el('span', 'scoop');
      dot.style.background = scoopColor(f.name);
      const btn = (cls, text, label, fn, disabled) => {
        const b = el('button', cls, text);
        b.type = 'button';
        if (label) { b.title = label; b.setAttribute('aria-label', label); }
        b.disabled = !!disabled;
        b.addEventListener('click', fn);
        return b;
      };
      li.append(
        dot,
        el('span', 'name', f.name),
        btn('soldbtn' + (f.soldOut ? ' on' : ''), t('soldOut'), null, () => { f.soldOut = !f.soldOut; changed(); }),
        btn('icon', '↑', t('up'), () => { move(i, -1); }, i === 0),
        btn('icon', '↓', t('down'), () => { move(i, 1); }, i === draft.flavors.length - 1),
        btn('icon', '✕', t('remove'), () => { draft.flavors.splice(i, 1); changed(); }),
      );
      ul.append(li);
    });
  }

  function move(i, dir) {
    const j = i + dir;
    [draft.flavors[i], draft.flavors[j]] = [draft.flavors[j], draft.flavors[i]];
    changed();
  }

  function changed() {
    renderEditor();
    renderPublic();
    setDirty(true);
  }

  $('edit-open').addEventListener('click', () => { draft.open = !draft.open; changed(); });
  for (const [id, key] of [['edit-note', 'note'], ['edit-shop', 'shop'], ['edit-hours', 'hours']]) {
    $(id).addEventListener('input', (e) => { draft[key] = e.target.value; renderPublic(); setDirty(true); });
  }
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('add-name').value.trim();
    if (!name) return;
    draft.flavors.push({ name, soldOut: false });
    $('add-name').value = '';
    changed();
  });

  function startEditing() {
    draft = JSON.parse(JSON.stringify(data));
    draft.flavors = draft.flavors || [];
    $('view-public').classList.add('hidden');
    $('btn-nubia').classList.add('hidden');
    $('view-edit').classList.remove('hidden');
    renderEditor();
    setDirty(false);
  }

  function stopEditing() {
    draft = null; token = null; demo = false;
    $('view-edit').classList.add('hidden');
    $('view-public').classList.remove('hidden');
    $('btn-nubia').classList.remove('hidden');
    renderPublic();
  }
  $('btn-logout').addEventListener('click', stopEditing);

  // ---------- save ----------
  async function putData(body) {
    const r = await fetch(api('data.json'), {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: `Update flavors (${body.open ? 'open' : 'closed'})`,
        content: b64FromUtf8(JSON.stringify(body, null, 2) + '\n'),
        sha, branch,
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
    sha = (await r.json()).content.sha;
  }

  $('btn-save').addEventListener('click', async () => {
    const m = $('save-msg');
    const btn = $('btn-save');
    draft.shop = draft.shop.trim();
    draft.updated = new Date().toISOString();
    btn.disabled = true;
    m.className = 'save-msg';
    m.textContent = t('saving');
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        try {
          await putData(draft);
        } catch (e) {
          // someone else saved in between (another phone?) - grab the new version number and retry once
          if (e.status !== 409 && e.status !== 422) throw e;
          sha = (await ghGet('data.json')).sha;
          await putData(draft);
        }
      }
      data = JSON.parse(JSON.stringify(draft));
      m.className = 'save-msg ok';
      m.textContent = demo ? t('demoSaved') : t('saved');
    } catch (e) {
      console.error(e);
      m.className = 'save-msg err';
      m.textContent = `${t('saveFail')} (${e.status || e.message})`;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- "I'm Nubia" login ----------
  const modal = $('login');
  function openLogin() {
    $('login-msg').textContent = '';
    $('login-pw').value = '';
    modal.classList.remove('hidden');
    $('login-pw').focus();
  }
  function closeLogin() { modal.classList.add('hidden'); }
  $('btn-nubia').addEventListener('click', openLogin);
  $('login-cancel').addEventListener('click', closeLogin);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLogin(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeLogin(); });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('login-pw').value;
    const msg = $('login-msg');
    const go = $('login-go');
    if (!pw) return;
    go.disabled = true;
    msg.textContent = t('checking');
    try {
      const lock = (await fetchFile('lock.json')).json;
      if (!lock.setup) {
        // Not set up yet. On your own computer, let any password in so the editor can be tried out.
        if (!isLocal) { msg.textContent = t('notSetup'); return; }
        demo = true;
      } else {
        try { token = await Lock.unlockSecret(lock, pw); } catch { msg.textContent = t('wrongPw'); return; }
        try {
          const got = await ghGet('data.json');
          data = got.json; sha = got.sha;
        } catch (err) {
          token = null;
          msg.textContent = t('keyBad');
          return;
        }
      }
      closeLogin();
      startEditing();
    } catch (err) {
      console.error(err);
      msg.textContent = t('loadFail');
    } finally {
      go.disabled = false;
    }
  });

  // ---------- go ----------
  applyLang();
  loadData();
  // keep the public page fresh (GitHub allows ~60 checks/hour per visitor, so every 3 min is plenty)
  setInterval(() => { if (!draft && !document.hidden) loadData(); }, 180000);
  document.addEventListener('visibilitychange', () => { if (!draft && !document.hidden) loadData(); });
})();
