# Claude Code Session - January 29-30, 2026

## Summary of Work Done

### 1. Codebase Review
- Reviewed entire codebase structure for the Cambridge 1956 Hannibal Expedition OpenSeadragon viewer
- Read OpenSeadragon documentation (Viewer, Viewport, TiledImage classes)

### 2. Responsive Grid Layout Feature (PR #29 - Merged)
**Goal:** Replace fixed `rowStarts` layout with a responsive grid that adapts to viewport aspect ratio.

**Implementation in `main.js`:**
- Added `calculateOptimalColumns(numImages, canvasAspect, imageAspect)` - finds optimal column count to match canvas aspect ratio
- Added `calculateResponsiveLayout(dzis)` - positions images in responsive grid with automatic row-wrap for rotated images
- Added `calculateRowStartsLayout(dzis)` - preserves original manual row-based layout
- Added `applyLayout(layout, animate)` - applies a layout with animation support
- Added `toggleLayout()` - switches between responsive and rowStarts modes
- Added "L" key handler to toggle between layouts (easter egg)

**Behavior:**
- Wide viewport → more columns (landscape-shaped grid)
- Narrow viewport → fewer columns (portrait-shaped grid)
- Rotated images (indices 18, 24) handled with automatic row-wrap to maintain rectangular grid boundaries
- Layout computed once on page load (no resize handling)

**Algorithm:**
```javascript
// For C columns and N images, R = ceil(N/C) rows
// Grid aspect ratio = (C / R) * imageAspect
// Find C that minimizes |gridAspect - canvasAspect|
```

### 3. Line Ending Normalization (PR #30 - Merged)
- Added `.gitattributes` to enforce LF line endings across all platforms
- Normalized existing files from CRLF to LF
- Prevents spurious diffs when working across Windows/Linux/WSL environments

### 4. Squarespace Embedding (PR #32 - Merged)
**Goal:** Embed the viewer in a Squarespace site.

**Approach:** iframe embedding (simplest option)
- Tiles remain hosted on GitHub Pages
- iframe embedded in Squarespace Code Block

**Code changes for better embed experience:**
- Centered instruction message vertically (`main.css`: `top: 50%` + `transform: translateY(-50%)`)
- Hide full-screen button when embedded in iframe (`viewer.js`: detect `window.self !== window.top`)

**Known limitations of iframe approach:**
- Full-screen button doesn't work (browser security restriction) - now hidden when embedded
- No deep linking to specific page/zoom state
- Potential touch gesture conflicts (tested OK on desktop and mobile)

### 5. Repo Restructuring for Multiple Manuscripts (PR #35 - Merged, closes #34)
**Goal:** Generalize code to support multiple manuscripts with shared viewer code.

**New Structure:**
```
hoyte/
├── shared/                 # Shared viewer code
│   ├── viewer.js           # Parameterized initViewer(dzis, config)
│   ├── main.css
│   ├── ImageRec.js
│   ├── util.js
│   ├── intro.js
│   ├── highlights.js
│   ├── arrangements.js
│   └── img/
├── util/                   # Build tools
│   └── collect.js
├── 1956expedition/         # First manuscript
│   ├── index.html          # Entry point
│   ├── data.js             # DZI metadata
│   ├── config.js           # Manuscript-specific config
│   └── jpgs/               # Tile images
├── EMBEDDING.md            # Squarespace embed instructions
└── (future: cambridge/, etc.)
```

**Key Changes:**
- `shared/viewer.js` exports `initViewer(dzis, config)` function
- Each manuscript has minimal `index.html` that imports shared code and passes its config
- `config.js` contains manuscript-specific settings (rowStarts, rotatedIndexes, etc.)
- URL changed from `.../hoyte/` to `.../hoyte/1956expedition/`

## Files Modified
- `shared/viewer.js` - Main viewer logic (parameterized)
- `shared/main.css` - Centered intro message
- `shared/*.js` - Updated import paths
- `1956expedition/index.html` - Minimal entry point
- `1956expedition/config.js` - Manuscript configuration
- `EMBEDDING.md` - Squarespace embed documentation
- `.gitattributes` - Line ending enforcement

## Git History
```
a2536ec Add embedding documentation for Squarespace
3ac0a81 Restructure repo for multiple manuscripts
1abf76b Improve embedded iframe experience
b40288c Normalize line endings to LF
6ccfcd6 Add responsive grid layout that adapts to viewport aspect ratio
```

## Configuration Reference

### Manuscript Config (1956expedition/config.js)
```javascript
export default {
  title: 'Cambridge 1956 Hannibal Expedition',
  rowStarts: [0, 3, 6, 8, 16, 19, 29, 41, 55, 61, 68],
  rotatedIndexes: [18, 24],
  defaultLayout: 'responsive',
  showHighlights: false,
  highlights: []
};
```

### Keyboard Shortcuts
- **L** - Toggle between responsive and rowStarts layouts
- **Space** - Shuffle arrangement (experimental)
- **Arrow Left/Right** - Navigate between images

## Squarespace Embedding

See `EMBEDDING.md` for full details.

```html
<iframe
  src="https://davidgedye.github.io/hoyte/1956expedition/"
  style="width:100vw; height:80vh; border:none; margin-left:calc(-50vw + 50%); display:block;">
</iframe>
```

## Testing Notes
- Local dev server: `python3 -m http.server 8000` → http://localhost:8000/1956expedition/
- Test responsive layout by opening at different window sizes and refreshing
- Press "L" to compare with legacy rowStarts layout
- Rotated images should have space above/below and not extend beyond grid boundary

## URLs
- Local dev: http://localhost:8000/1956expedition/
- Production: https://davidgedye.github.io/hoyte/1956expedition/
- Repository: https://github.com/davidgedye/hoyte

## Next Steps
- Scan and add second manuscript (cambridge)
- Create `cambridge/` folder with its own data.js, config.js, and jpgs/
