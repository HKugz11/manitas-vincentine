# Nubia's Ice Cream

A tiny website for Nubia's ice cream shop: **flavors of the day**, **prices** and an **open / closed** sign,
in Spanish and English (slider at the top). Runs free on GitHub Pages: no server, no database.

Live: https://hkugz11.github.io/nubia-ice-cream/

## How Nubia updates it

1. Open the site, tap **Soy Nubia / I'm Nubia** at the bottom.
2. Type her password.
3. Flip open/closed, mark flavors *Agotado / Sold out*, add, remove or reorder flavors and prices, then **Guardar / Save**.

Every piece of her text has a Spanish box and an English box. English is optional: if it's blank, the Spanish shows on the English side too.

Changes show up for everyone in about a minute.

## How it works

- `data.json` holds everything the page shows: shop name, open, message, hours, flavors, prices. Text is stored as `{ "es": ..., "en": ... }`.
- The public page reads `data.json` straight from the GitHub API (so it's fresh within seconds), falling back to the GitHub Pages copy if that fails.
- Saving = the browser commits a new `data.json` to this repo through the GitHub API.
- To be allowed to commit, the browser needs a GitHub key. That key is stored in `lock.json`,
  **encrypted with Nubia's password** (PBKDF2-SHA256, 600k rounds → AES-256-GCM). Typing the right
  password decrypts it in her browser. The password itself is never stored.

### Security notes

- `lock.json` is public, so someone could try to guess the password offline. Use a long one (a few words).
- The key is a *fine-grained* token that can **only** edit this one repo. Worst case if the password is guessed: someone changes the flavors. Every change is a commit, so it can be undone, and a new password + key can be set with `setup.html`.

## One-time setup (Hyrum)

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Repository access: **Only select repositories** → `nubia-ice-cream`
   - Permissions → Repository → **Contents: Read and write** (nothing else)
2. Open `https://hkugz11.github.io/nubia-ice-cream/setup.html`, paste the key, choose Nubia's password, **Lock & save**.
3. Tell Nubia the password. To change it or replace an expired key, do step 1–2 again.

## Files

| File | What |
|---|---|
| `index.html`, `style.css`, `app.js` | the site |
| `i18n.js` | all text in Spanish + English |
| `crypto.js` | password lock for the GitHub key |
| `setup.html` | one-time setup page |
| `data.json` | today's flavors + open/closed |
| `lock.json` | encrypted GitHub key |
| `icon.svg` / `make_icon.py` | the **Hl** icon and the script that draws it |

## Try it locally

```
python -m http.server 5173
```

Then open http://localhost:5173. Before setup, "Soy Nubia" accepts any password locally (demo mode, nothing is saved).
