# Embedding in Squarespace 7.1

Instructions for embedding the manuscript viewers as full-page experiences in a Squarespace 7.1 site.

## How it works

The goal is: Squarespace site header visible at top, entire remaining viewport filled by the embedded experience — no Squarespace sections, padding, or footer visible.

This is achieved by injecting a script that:
1. Detects whether it's running on the live page (vs. inside the Squarespace editor, which wraps the page in an iframe)
2. Measures the actual rendered height of the Squarespace header at runtime
3. Creates an iframe and appends it directly to `<body>`, bypassing Squarespace's section/block layout system entirely
4. Positions the iframe with `position: fixed` so it covers exactly the viewport below the header, regardless of any Squarespace layout constraints

The iframe is appended to `<body>` rather than placed inside the Code Block because Squarespace sections can have CSS `transform` properties applied (for scroll animations etc.) which break `position: fixed` — a fixed element inside a transformed parent is positioned relative to that parent, not the viewport.

The z-index is set to `9` — just below the Squarespace header's z-index of `10` — so the header and its mobile hamburger navigation overlay always appear above the iframe.

---

## Setup for a new page

### Step 1 — Create a blank page

Create a new page in Squarespace. Remove any default sections except one. Add a single **Code Block** to that section. The position and padding of the Code Block don't matter — the script ignores the block layout entirely.

### Step 2 — Add the Code Block script

Paste the following into the Code Block (HTML mode):

```html
<script>
  window.addEventListener('load', function() {
    // Skip when running inside the Squarespace editor (which wraps the page in an iframe)
    if (window.self !== window.top) return;

    var header = document.querySelector('header');
    var headerHeight = header ? header.offsetHeight : 0;

    var iframe = document.createElement('iframe');
    iframe.src = 'https://davidgedye.github.io/hoyte/1956expedition/';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    Object.assign(iframe.style, {
      position: 'fixed',
      top: headerHeight + 'px',
      left: '0',
      width: '100%',
      height: 'calc(100vh - ' + headerHeight + 'px)',
      border: 'none',
      zIndex: '9'
    });

    document.body.appendChild(iframe);

    // Recompute on resize (e.g. mobile browser chrome appearing/disappearing)
    window.addEventListener('resize', function() {
      var h = header ? header.offsetHeight : 0;
      iframe.style.top = h + 'px';
      iframe.style.height = 'calc(100vh - ' + h + 'px)';
    });
  });
</script>
```

Replace the `iframe.src` value with the URL of the experience you want to embed.

### Step 3 — Add Page Header Code Injection

Go to **Page Settings → Advanced → Page Header Code Injection** and paste:

```html
<style>
  footer.Footer { display: none !important; }
</style>
```

This hides the Squarespace footer on this page (optional but recommended for a clean full-page feel).

---

## Experiences

### 1956 Expedition

**URL:** `https://davidgedye.github.io/hoyte/1956expedition/`

Use the script above with this URL as `iframe.src`.

---

## Notes

- **Editor access:** The `window.self !== window.top` check means the iframe does not appear in the Squarespace editor, so you can edit the Code Block normally. It only activates on the live published page.
- **Header height:** The script uses `window.addEventListener('load', ...)` (not `DOMContentLoaded`) so that fonts and logo images in the header are fully rendered before its height is measured.
- **Mobile nav:** The hamburger menu and its navigation overlay appear above the iframe because their z-index exceeds the header's z-index of `10`. The iframe's z-index of `9` ensures it never covers them.
- **Resize handling:** The resize listener keeps the iframe correctly sized if the header height changes (e.g. when the mobile browser address bar appears or disappears).
