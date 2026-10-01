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
  const t = (k) => (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.es[k] || k;

  // Nubia's own text is stored as { es, en }. English is optional and falls back to Spanish.
  // (A plain string from an older data.json is treated as Spanish.)
  const bi = (v) => (v && typeof v === 'object' ? v : { es: v || '', en: '' });
  const tx = (v) => { const b = bi(v); return (lang === 'en' && b.en.trim()) ? b.en : (b.es || b.en || ''); };

  function applyLang() {
    document.documentElement.lang = lang;
    $('lang').dataset.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
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
    const b = bi(name);
    const n = `${b.es} ${b.en}`.toLowerCase();
    for (const [re, c] of FLAVOR_COLORS) if (re.test(n)) return c;
    let h = 0;
    for (const ch of b.es.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PASTELS[h % PASTELS.length];
  }

  const money = (p) => {
    const s = String(p || '').trim();
    if (!s) return '';
    const num = s.replace(',', '.');
    return /^\d+(\.\d+)?$/.test(num) ? `${(data && data.currency) || '$'}${Number(num).toFixed(2)}` : s;
  };

  // Colors Nubia can pick for a flavor's scoop (or "Auto" = guessed from the name).
  const PALETTE = ['#f7ecc8', '#6b4226', '#f4a3b5', '#a8e6cf', '#a47551', '#d9a066', '#f7b267',
    '#f5e663', '#7b5ea7', '#b5d99c', '#8ecae6', '#c9405b', '#f4f1ea', '#b9b4ab'];
  const colorOf = (f) => f.color || scoopColor(f.name);

  // ---------- photos ----------
  // Saved photos live in photos/ in the repo. GitHub Pages can take a minute to publish a
  // new one, so if it isn't there yet we load it straight from the repo instead.
  const rawUrl = (p) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
  const isNewPhoto = (p) => typeof p === 'string' && p.startsWith('data:');
  function photoImg(p, cls) {
    const img = el('img', cls);
    img.alt = '';
    img.src = p;
    if (hasRepo && !isNewPhoto(p)) img.addEventListener('error', () => { img.src = rawUrl(p); }, { once: true });
    return img;
  }

  // Opens the phone's camera / gallery picker and shrinks the photo so it loads fast.
  function pickPhoto(maxSide) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        try {
          const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
          const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
          const c = document.createElement('canvas');
          c.width = Math.round(bmp.width * scale);
          c.height = Math.round(bmp.height * scale);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        } catch (e) {
          console.error(e);
          alert(t('photoFail'));
          resolve(null);
        }
      });
      input.click();
    });
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

  // Flavors and toppings share one look: color dot (or photo), name, sold-out tag.
  function renderScoops(ul, items, emptyText) {
    ul.replaceChildren();
    const list = (items || []).filter((f) => tx(f.name).trim());
    if (!list.length && emptyText) ul.append(el('li', 'empty', emptyText));
    for (const f of list) {
      const li = el('li', f.soldOut ? 'sold' : '');
      if (f.photo) {
        const img = photoImg(f.photo, 'thumb');
        img.style.borderColor = colorOf(f);
        img.addEventListener('click', () => openViewer(img.src));
        li.append(img);
      } else {
        const dot = el('span', 'scoop');
        dot.style.background = colorOf(f);
        li.append(dot);
      }
      li.append(el('span', 'name', tx(f.name)));
      if (f.soldOut) li.append(el('span', 'pill', t('soldOut')));
      if (f.price) li.append(el('span', 'amt', money(f.price)));
      ul.append(li);
    }
  }

  // "hoy, 4:47 p. m." / "ayer, ..." / "lun., ..." / "12 sept., ..."
  function whenText(when) {
    const loc = lang === 'es' ? 'es-EC' : 'en-US';
    const time = when.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
    const day = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const daysAgo = Math.round((day(new Date()) - day(when)) / 86400000);
    let label;
    if (daysAgo === 0) label = t('today');
    else if (daysAgo === 1) label = t('yesterday');
    else if (daysAgo > 1 && daysAgo < 7) label = when.toLocaleDateString(loc, { weekday: 'long' });
    else label = when.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
    return `${label}, ${time}`;
  }

  function renderPublic() {
    const d = draft || data;
    $('shop-name').textContent = tx(d.shop);
    document.title = tx(d.shop) || document.title;

    const banner = $('banner');
    banner.classList.toggle('hidden', !d.banner);
    if (d.banner && banner.dataset.src !== d.banner) {
      banner.dataset.src = d.banner;
      const img = photoImg(d.banner, 'banner-img');
      img.addEventListener('click', () => openViewer(img.src));
      banner.replaceChildren(img);
    }

    $('status').className = 'status ' + (d.open ? 'open' : 'closed');
    $('status-text').textContent = d.open ? t('open') : t('closed');
    $('status-note').textContent = tx(d.note);

    renderScoops($('flavors'), d.flavors, t('noFlavors'));
    const tops = (d.toppings || []).filter((f) => tx(f.name).trim());
    $('toppings-wrap').classList.toggle('hidden', !tops.length);
    renderScoops($('toppings'), tops, '');
    const crepes = (d.crepes || []).filter((f) => tx(f.name).trim());
    $('crepes-wrap').classList.toggle('hidden', !crepes.length);
    renderScoops($('crepes'), crepes, '');

    const prices = (d.prices || []).filter((p) => tx(p.name).trim());
    $('prices-wrap').classList.toggle('hidden', !prices.length);
    const pl = $('prices');
    pl.replaceChildren();
    for (const p of prices) {
      const li = el('li');
      li.append(el('span', 'name', tx(p.name)), el('span', 'leader'), el('span', 'amt', money(p.price)));
      pl.append(li);
    }

    $('hours').textContent = tx(d.hours);
    $('updated').textContent = d.updated ? `${t('updated')} ${whenText(new Date(d.updated))}` : '';
  }

  // ---------- editor ----------
  function setDirty(on) {
    const m = $('save-msg');
    m.className = 'save-msg';
    m.textContent = on ? t('unsaved') : '';
  }

  // An input with a little tag in front of it ("ES", "EN", "$").
  function tagged(tag, value, ph, onInput, attrs) {
    const { className, ...inputAttrs } = attrs || {};
    const wrap = el('div', 'tagged' + (className ? ' ' + className : ''));
    const input = el('input');
    input.value = value || '';
    input.placeholder = ph || '';
    input.maxLength = 60;
    Object.assign(input, inputAttrs);
    input.addEventListener('input', () => { onInput(input.value); renderPublic(); setDirty(true); });
    wrap.append(el('span', 'tag', tag), input);
    return wrap;
  }

  // Two inputs (Spanish + English) for one piece of Nubia's text.
  function biField(container, key, phEs, phEn) {
    draft[key] = bi(draft[key]);
    const obj = draft[key];
    container.replaceChildren(
      tagged('ES', obj.es, phEs, (v) => { obj.es = v; }, { maxLength: 120 }),
      tagged('EN', obj.en, phEn, (v) => { obj.en = v; }, { maxLength: 120 }),
    );
  }

  function smallBtn(cls, text, label, fn, disabled) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (label) { b.title = label; b.setAttribute('aria-label', label); }
    b.disabled = !!disabled;
    b.addEventListener('click', fn);
    return b;
  }

  function move(list, i, dir) {
    const j = i + dir;
    [list[i], list[j]] = [list[j], list[i]];
    structural();
  }

  function moveBtns(list, i) {
    return [
      smallBtn('icon', '↑', t('up'), () => move(list, i, -1), i === 0),
      smallBtn('icon', '↓', t('down'), () => move(list, i, 1), i === list.length - 1),
      smallBtn('icon del', '✕', t('remove'), () => { list.splice(i, 1); structural(); }),
    ];
  }

  // Editor rows for flavors, toppings and crepes: color dot, ES/EN names, sold out, photo, reorder
  // (+ a price box for crepes).
  function renderScoopEditor(ul, list, phEs, phEn, withPrice) {
    ul.replaceChildren();
    list.forEach((f, i) => {
      f.name = bi(f.name);
      const li = el('li', 'item flavor' + (f.soldOut ? ' sold' : ''));
      const dot = smallBtn('scoop pick', '', t('pickColor'), () => { openSwatch = openSwatch === f ? null : f; renderEditor(); });
      dot.style.background = colorOf(f);
      const recolor = () => { dot.style.background = colorOf(f); };
      const actions = el('div', 'actions');
      actions.append(
        smallBtn('soldbtn' + (f.soldOut ? ' on' : ''), t('soldOut'), null, () => { f.soldOut = !f.soldOut; structural(); }),
        f.photo ? '' : smallBtn('photobtn', t('photo'), null, () => choosePhoto(f, 'photo', 900)),
        el('span', 'grow'),
        ...moveBtns(list, i),
      );
      li.append(
        dot,
        tagged('ES', f.name.es, t(phEs), (v) => { f.name.es = v; recolor(); }),
        tagged('EN', f.name.en, t(phEn), (v) => { f.name.en = v; recolor(); }),
        withPrice ? tagged(draft.currency || '$', f.price, t('pricePh'), (v) => { f.price = v.trim(); }, { inputMode: 'decimal', maxLength: 10, className: 'money' }) : '',
        actions,
      );
      if (openSwatch === f) li.append(swatches(f));
      if (f.photo) li.append(photoRow(f, 'photo', 900));
      ul.append(li);
    });
  }

  function renderEditor() {
    $('edit-open').setAttribute('aria-checked', String(draft.open));
    const lbl = $('edit-open-label');
    lbl.textContent = draft.open ? t('open') : t('closed');
    lbl.className = 'big ' + (draft.open ? 'open' : 'closed');

    biField($('edit-note'), 'note', STRINGS.es.messagePh, STRINGS.en.messagePh);
    biField($('edit-shop'), 'shop', 'Manitas Vincentine', 'Manitas Vincentine');
    biField($('edit-hours'), 'hours', STRINGS.es.hoursPh, STRINGS.en.hoursPh);
    $('edit-banner').replaceChildren(draft.banner
      ? photoRow(draft, 'banner', 1600, 'wide')
      : smallBtn('addbtn', t('addBanner'), null, () => choosePhoto(draft, 'banner', 1600)));

    renderScoopEditor($('edit-flavors'), draft.flavors, 'flavorEs', 'flavorEn');
    renderScoopEditor($('edit-toppings'), draft.toppings, 'toppingEs', 'toppingEn');
    renderScoopEditor($('edit-crepes'), draft.crepes, 'crepeEs', 'crepeEn', true);

    // prices
    const pl = $('edit-prices');
    pl.replaceChildren();
    draft.prices.forEach((p, i) => {
      p.name = bi(p.name);
      const li = el('li', 'item price');
      const actions = el('div', 'actions');
      actions.append(...moveBtns(draft.prices, i));
      li.append(
        tagged('ES', p.name.es, t('itemEs'), (v) => { p.name.es = v; }),
        tagged(draft.currency || '$', p.price, t('pricePh'), (v) => { p.price = v.trim(); }, { inputMode: 'decimal', maxLength: 10 }),
        tagged('EN', p.name.en, t('itemEn'), (v) => { p.name.en = v; }),
        actions,
      );
      pl.append(li);
    });
  }

  let openSwatch = null;  // which flavor/topping/crepe has its color palette open

  function swatches(f) {
    const box = el('div', 'swatches');
    const pick = (c) => { f.color = c; structural(); };
    for (const c of PALETTE) {
      const b = smallBtn('sw' + (f.color === c ? ' on' : ''), '', c, () => pick(c));
      b.style.background = c;
      box.append(b);
    }
    const custom = el('label', 'sw custom' + (f.color && !PALETTE.includes(f.color) ? ' on' : ''));
    custom.title = t('customColor');
    const input = el('input');
    input.type = 'color';
    input.value = f.color || '#f4a3b5';
    input.addEventListener('change', () => pick(input.value));
    custom.append(input);
    box.append(custom, smallBtn('auto' + (f.color ? '' : ' on'), t('autoColor'), null, () => pick('')));
    return box;
  }

  async function choosePhoto(obj, key, maxSide) {
    const url = await pickPhoto(maxSide);
    if (!url) return;
    obj[key] = url;
    structural();
  }

  function photoRow(obj, key, maxSide, cls) {
    const row = el('div', 'photo-row' + (cls ? ' ' + cls : ''));
    row.append(
      photoImg(obj[key], ''),
      smallBtn('', t('changePhoto'), null, () => choosePhoto(obj, key, maxSide)),
      smallBtn('del', t('removePhoto'), null, () => { obj[key] = ''; structural(); }),
    );
    return row;
  }

  function structural() {
    renderEditor();
    renderPublic();
    setDirty(true);
  }

  $('edit-open').addEventListener('click', () => { draft.open = !draft.open; structural(); });
  function addAndFocus(list, item, listId) {
    list.push(item);
    structural();
    const first = $(listId).lastElementChild.querySelector('input');
    if (first) first.focus();
  }
  $('add-flavor').addEventListener('click', () => addAndFocus(draft.flavors, { name: { es: '', en: '' }, soldOut: false }, 'edit-flavors'));
  $('add-topping').addEventListener('click', () => addAndFocus(draft.toppings, { name: { es: '', en: '' }, soldOut: false }, 'edit-toppings'));
  $('add-crepe').addEventListener('click', () => addAndFocus(draft.crepes, { name: { es: '', en: '' }, soldOut: false, price: '' }, 'edit-crepes'));
  $('add-price').addEventListener('click', () => addAndFocus(draft.prices, { name: { es: '', en: '' }, price: '' }, 'edit-prices'));

  function startEditing() {
    draft = JSON.parse(JSON.stringify(data));
    draft.flavors = draft.flavors || [];
    draft.toppings = draft.toppings || [];
    draft.crepes = draft.crepes || [];
    draft.prices = draft.prices || [];
    draft.currency = draft.currency || '$';
    $('view-public').classList.add('hidden');
    $('view-edit').classList.remove('hidden');
    renderEditor();
    setDirty(false);
    scrollTo(0, 0);
  }

  function stopEditing() {
    draft = null; token = null; demo = false;
    $('view-edit').classList.add('hidden');
    $('view-public').classList.remove('hidden');
    renderPublic();
    scrollTo(0, 0);
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

  async function uploadPhoto(dataUrl) {
    const path = `photos/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const r = await fetch(api(path), {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'Add photo', content: dataUrl.split(',')[1], branch }),
    });
    if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
    return path;
  }

  // New photos are kept in the page until Save; then each one becomes a file in photos/.
  async function uploadPending(body) {
    if (isNewPhoto(body.banner)) body.banner = await uploadPhoto(body.banner);
    for (const f of [...body.flavors, ...body.toppings, ...body.crepes]) if (isNewPhoto(f.photo)) f.photo = await uploadPhoto(f.photo);
  }

  // Trim text and drop rows she left blank.
  function cleaned(d) {
    const out = JSON.parse(JSON.stringify(d));
    const trimBi = (v) => { const b = bi(v); return { es: b.es.trim(), en: b.en.trim() }; };
    for (const k of ['shop', 'note', 'hours']) out[k] = trimBi(out[k]);
    const named = (list) => list.map((f) => ({ ...f, name: trimBi(f.name) })).filter((f) => f.name.es || f.name.en);
    out.flavors = named(out.flavors);
    out.toppings = named(out.toppings || []);
    out.crepes = named(out.crepes || []).map((f) => ({ ...f, price: String(f.price || '').trim() }));
    out.prices = out.prices.map((p) => ({ ...p, name: trimBi(p.name), price: String(p.price || '').trim() })).filter((p) => p.name.es || p.name.en);
    out.updated = new Date().toISOString();
    return out;
  }

  $('btn-save').addEventListener('click', async () => {
    const m = $('save-msg');
    const btn = $('btn-save');
    const body = cleaned(draft);
    btn.disabled = true;
    m.className = 'save-msg';
    m.textContent = t('saving');
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        if (isNewPhoto(body.banner) || [...body.flavors, ...body.toppings, ...body.crepes].some((f) => isNewPhoto(f.photo))) m.textContent = t('uploading');
        await uploadPending(body);
        m.textContent = t('saving');
        try {
          await putData(body);
        } catch (e) {
          // someone else saved in between (another phone?) - grab the new version number and retry once
          if (e.status !== 409 && e.status !== 422) throw e;
          sha = (await ghGet('data.json')).sha;
          await putData(body);
        }
      }
      data = body;
      draft = JSON.parse(JSON.stringify(body));
      renderEditor();
      renderPublic();
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

  // ---------- photo viewer ----------
  function openViewer(src) {
    $('viewer-img').src = src;
    $('viewer').classList.remove('hidden');
  }
  $('viewer').addEventListener('click', () => $('viewer').classList.add('hidden'));

  // ---------- "Soy Nubia" login ----------
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
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.classList.contains('hidden')) closeLogin();
    $('viewer').classList.add('hidden');
  });

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
