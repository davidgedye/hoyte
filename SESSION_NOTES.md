# Hoyte Project Session Notes

**Last Updated:** 2026-02-03

## Project Overview

A static website for viewing John Hoyte's historical manuscripts using OpenSeadragon deep zoom technology. Hosted on GitHub Pages at `davidgedye.github.io/hoyte/`.

**Repository:** https://github.com/davidgedye/hoyte

## Available Manuscripts

1. **1956 Cambridge Hannibal Expedition** (`/1956expedition/`)
   - 81 pages documenting the first trip of the "Cambridge Hannibalians"
   - Has PDF version available
   - Config: `rotatedIndexes: [18, 24]`, `rowStarts` defined for legacy layout

2. **Cambridge Undergraduate Scrapbook** (`/cambridge/`)
   - 65 pages (original page 36 was duplicate of 34, removed)
   - Config: `rotatedIndexes: [6, 36]` (pages 7 and 37)
   - Pages 13-15 are landscape (shorter) and vertically centered

## Project Structure

```
hoyte/
├── shared/                  # Shared viewer code
│   ├── viewer.js            # Main OpenSeadragon viewer logic
│   ├── ImageRec.js          # Image record class
│   ├── main.css             # Shared styles
│   ├── arrangements.js      # Layout arrangements
│   ├── highlights.js        # Highlight overlay support
│   ├── intro.js             # Introduction message handling
│   └── util.js              # Utility functions
├── 1956expedition/          # First manuscript
│   ├── index.html, config.js, data.js
│   └── jpgs/                # DZI tiles
├── cambridge/               # Second manuscript
│   ├── index.html, config.js, data.js
│   └── jpgs/                # DZI tiles and source images
├── util/                    # Processing utilities
│   ├── crop_margins.py      # Crop white margins from scans
│   ├── color_correct.py     # LAB color space yellow cast correction
│   ├── requirements.txt     # Python dependencies
│   ├── collect.js           # DZI metadata collector
│   └── dzi.js               # DZI file list for 1956expedition
├── README.md                # Project documentation
├── EMBEDDING.md             # iframe embedding instructions
└── SESSION_NOTES.md         # This file
```

## Key Features Implemented

### Responsive Grid Layout
- Calculates optimal columns based on canvas aspect ratio
- Vertically centers shorter images (landscape pages)
- Handles rotated images (90°) with proper spacing calculated from actual aspect ratios
- Toggle between responsive and legacy rowStarts layouts with 'L' key

### Shareable URLs (Issue #37 - Closed)
- URL hash updates to `#page=N` (1-indexed) when zoomed in on a page
- Hash persists when zoomed into page detail (not just when page fills viewport)
- Hash clears when zoomed out to grid view
- Opening URL with hash plays full intro animation, then zooms to requested page
- Manual URL hash edits trigger smooth navigation to new page
- Updates debounced (1.5s) and disabled when embedded in iframe

### Embedding Support
- Detects iframe embedding via `window.self !== window.top`
- Hides fullscreen button when embedded
- Centers intro message
- URL hash updates disabled when embedded

### Image Processing Pipeline
1. Crop white scanner margins: `python3 crop_margins.py input/ output/`
2. Color correct (optional): `python3 color_correct.py input/ output/ -s 10`
   - Uses LAB color space B-channel shift to reduce yellow cast
   - Strength 10 is typical; higher values = more blue shift
3. Generate DZI tiles: `vips dzsave input.jpg output --suffix .jpg --tile-size 510`
4. Generate data.js from DZI XML files

## Configuration Options (config.js)

```javascript
export default {
  title: 'Manuscript Title',
  rowStarts: [],           // Array of indices where rows start (legacy layout)
  rotatedIndexes: [],      // Indices of 90° rotated images (0-indexed)
  defaultLayout: 'responsive',  // or 'rowStarts'
  showHighlights: false,
  highlights: []           // Highlight overlay definitions
};
```

## Keyboard Shortcuts

- **Arrow keys**: Navigate between pages when zoomed in
- **L**: Toggle between responsive and rowStarts layouts
- **Space**: Shuffle arrangement (experimental)
- **Click**: Zoom to clicked page

## Key Technical Details

### viewer.js Layout Logic
- `xStride = 1.1` - horizontal spacing between images
- `yStride = 1.6` - vertical spacing between rows
- Rotated images: extra width = `(visualWidth - 1) / 2` on each side
- Shorter images: y-offset = `(typicalHeight - imgHeight) / 2`

### URL Hash Format
- `#page=N` where N is 1-indexed page number
- Internally converted to 0-indexed array index
- Uses `history.replaceState()` to avoid cluttering browser history

### isFeatured() Criteria (ImageRec.js)
- More than 90% of image visible
- Image takes up more than 80% of viewport width OR height

### findCurrentPage() Logic (viewer.js)
- First checks if any page is "featured" (fills viewport)
- If not, checks if zoomed in (viewport < 1.5 pages wide) AND center is over a page
- Returns null in grid view (clears hash)

### Play Animation (highlights.js)
- Single unified TWEEN for smooth parabolic transitions
- Parabolic zoom formula: `logZoom = lerp(start, end, t) - zoomDip * 4t(1-t)`
- `zoomDip` scales with distance and zoom level (deeper dip when more zoomed in)
- No zoom-out when starting from grid view (target already visible)
- Two modes: highlights mode (specific regions) or all-pages mode (empty highlights array)
- Visits all items in random order, reshuffles after complete cycle

## Recent Changes (2026-02-03)

1. Color corrected all 65 Cambridge manuscript images:
   - Removed yellow cast using LAB color space B-channel shift (strength=10)
   - Cropped white margins from pages 1-38 (previously uncropped)
   - Regenerated all DZI tiles
2. Added color_correct.py utility for LAB color space correction
3. Note: When regenerating data.js, xmlns must be hardcoded (not extracted from XML)
   - Python's ElementTree treats xmlns as namespace declaration, not attribute
   - `root.get('xmlns')` returns None; use known value instead

## Previous Changes (2026-02-01)

1. Rewrote play animation in highlights.js:
   - Single unified tween instead of chained tweens (smoother, no discontinuities)
   - Parabolic zoom with distance-based and zoom-level-based dip calculation
   - Works correctly from grid view (no unnecessary zoom-out)
   - Supports both highlights mode and all-pages mode
2. Cambridge manuscript expanded to 65 pages (added 24 more scans)
3. Simplified crop_margins.py (removed unused straightening code)

## Previous Changes (2026-01-31)

1. Added Cambridge manuscript (original 41 pages, duplicate page 36 removed)
2. Created crop_margins.py utility
3. Improved layout for varied image sizes (vertical centering, rotated image spacing)
4. Added shareable URL support with page hash
5. Updated README with comprehensive documentation
6. Moved 1956expedition PDF to its manuscript folder
7. Enhanced URL hash behavior:
   - Hash persists when zoomed into page detail
   - Full animation plays before zooming to initial page
   - Hashchange listener responds to manual URL edits

## Pending/Future Work

- Embedding deep links (currently unsolved - would require parent page cooperation)
- Additional manuscripts can be added following the same pattern

## Git Workflow

- Development on `David` branch
- Merge to `main` for deployment
- GitHub Pages auto-deploys from `main`

## Dependencies

- OpenSeadragon 5.0.1 (CDN)
- Tween.js 20.0.3 (CDN)
- libvips (for DZI generation)
- OpenCV Python (for crop_margins.py utility)
