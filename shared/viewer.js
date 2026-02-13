import ImageRec from './ImageRec.js';
import { prepareIntro } from './intro.js';
import { isTouchDevice, hasMouse } from './util.js';
import { shuffleArrangement } from './arrangements.js';

// Module-level state (set by initViewer)
export let imageRecs = [];
export let viewer = null;

// Configuration defaults
const xStride = 1.1;
const yStride = 1.6;

// URL hash utilities
function getPageFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/^#page=(\d+)$/);
  if (match) {
    const pageNum = parseInt(match[1], 10);
    return pageNum - 1; // Convert 1-indexed URL to 0-indexed array
  }
  return null;
}

function setPageHash(pageIndex) {
  const pageNum = pageIndex + 1; // Convert 0-indexed to 1-indexed
  const newHash = `#page=${pageNum}`;
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

function clearPageHash() {
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// Find the page to show in URL hash, or null if in grid view
// Returns a page index when zoomed into a page, null when viewing the grid
function findCurrentPage(imageRecs, viewportBounds) {
  // First, check if any page is "featured" (fills most of viewport)
  let bestFraction = 0;
  let featuredIndex = null;

  for (let i = 0; i < imageRecs.length; i++) {
    const imageRec = imageRecs[i];
    if (imageRec.isFeatured(viewportBounds)) {
      const fraction = imageRec.getVisibleFraction(viewportBounds);
      if (fraction > bestFraction) {
        bestFraction = fraction;
        featuredIndex = i;
      }
    }
  }

  if (featuredIndex !== null) {
    return featuredIndex;
  }

  // If no page is featured, check if we're zoomed into part of a page
  // (viewport center is over a page AND viewport is smaller than ~1.5 pages wide)
  if (viewportBounds.width < xStride * 1.5) {
    const centerX = viewportBounds.x + viewportBounds.width / 2;
    const centerY = viewportBounds.y + viewportBounds.height / 2;
    const centerPoint = new OpenSeadragon.Point(centerX, centerY);

    for (let i = 0; i < imageRecs.length; i++) {
      if (imageRecs[i].isHit(centerPoint)) {
        return i;
      }
    }
  }

  return null;
}

// Debounce utility
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Find optimal row breaks using DP (Knuth-Plass style line-breaking).
// Each image has an effective width; the DP minimizes squared deviation
// from an ideal row width L = totalWidth / R, trying several candidate
// row counts around the aspect-ratio-optimal estimate.
function calculateOptimalBreaks(imageWidths, canvasAspect) {
  const N = imageWidths.length;
  if (N === 0) return [0];

  // Prefix sums for O(1) range width queries
  const prefix = [0];
  for (let i = 0; i < N; i++) prefix.push(prefix[i] + imageWidths[i]);
  const totalW = prefix[N];
  const rowW = (i, j) => prefix[j] - prefix[i];

  // Ideal row count: gridAspect = L / (R * yStride) = canvasAspect
  // with totalW ≈ R * L  =>  R ≈ sqrt(totalW / (yStride * canvasAspect))
  const idealR = Math.sqrt(totalW / (yStride * canvasAspect));
  const lo = Math.max(1, Math.floor(idealR) - 2);
  const hi = Math.min(N, Math.ceil(idealR) + 2);

  let bestCost = Infinity;
  let bestStarts = [0];

  for (let R = lo; R <= hi; R++) {
    const L = totalW / R;

    // dp[j] = min cost to lay out images 0..j-1
    const dp = new Array(N + 1).fill(Infinity);
    const from = new Array(N + 1).fill(0);
    dp[0] = 0;

    for (let j = 1; j <= N; j++) {
      for (let i = j - 1; i >= 0; i--) {
        const rw = rowW(i, j);
        if (rw > L * 2 && i < j - 1) break; // prune; keep at least 1 per row
        const slack = (rw - L) / L;
        const c = dp[i] + slack * slack;
        if (c < dp[j]) {
          dp[j] = c;
          from[j] = i;
        }
      }
    }

    // Reconstruct row starts
    const starts = [];
    let p = N;
    while (p > 0) { starts.push(from[p]); p = from[p]; }
    starts.reverse();

    // Score: mean squared slack + aspect mismatch
    const actualR = starts.length;
    const widest = Math.max(...starts.map((s, idx) =>
      rowW(s, idx < starts.length - 1 ? starts[idx + 1] : N)
    ));
    const gridAspect = widest / (actualR * yStride);
    const aspectDiff = (gridAspect - canvasAspect) / canvasAspect;
    const cost = dp[N] / actualR + aspectDiff * aspectDiff;

    if (cost < bestCost) {
      bestCost = cost;
      bestStarts = starts;
    }
  }

  return bestStarts;
}

// Calculate positions for responsive grid layout
function calculateResponsiveLayout(dzis, rotatedIndexes) {
  const container = document.getElementById('osd-container');
  const canvasAspect = container.clientWidth / container.clientHeight;
  const N = dzis.length;

  // Calculate normalized heights and extra width for rotated images
  const imageMetrics = dzis.map((dzi, i) => {
    const img = dzi.Image;
    const w = parseInt(img.Size.Width);
    const h = parseInt(img.Size.Height);
    const isRotated = rotatedIndexes.includes(i);

    if (isRotated) {
      const visualWidth = h / w;
      const extraWidth = (visualWidth - 1) / 2;
      return { height: 1, extraWidth };
    }
    return { height: h / w, extraWidth: 0 };
  });

  // Effective width of each image slot in the grid
  const imageWidths = imageMetrics.map(m => xStride + m.extraWidth * 2);

  // Find optimal row breaks via DP
  const breaks = calculateOptimalBreaks(imageWidths, canvasAspect);

  // Find median height for vertical centering of shorter images
  const portraitHeights = imageMetrics
    .filter((m, i) => !rotatedIndexes.includes(i) && m.height > 1)
    .map(m => m.height);
  portraitHeights.sort((a, b) => a - b);
  const typicalHeight = portraitHeights.length > 0
    ? portraitHeights[Math.floor(portraitHeights.length / 2)]
    : imageMetrics[0].height;

  // Place images according to row breaks
  const positions = [];
  let maxX = 0;
  let maxY = 0;

  for (let rowIdx = 0; rowIdx < breaks.length; rowIdx++) {
    const start = breaks[rowIdx];
    const end = rowIdx < breaks.length - 1 ? breaks[rowIdx + 1] : N;
    let x = xStride - 1; // left margin = inter-item gap
    const y = rowIdx * yStride;

    for (let i = start; i < end; i++) {
      const isRotated = rotatedIndexes.includes(i);
      const degrees = isRotated ? 90 : 0;
      const { height: imgHeight, extraWidth } = imageMetrics[i];

      x += extraWidth;

      const yOffset = (!isRotated && imgHeight < typicalHeight) ? (typicalHeight - imgHeight) / 2 : 0;

      positions.push({ x, y: y + yOffset, degrees });

      maxX = Math.max(maxX, x + extraWidth);
      maxY = Math.max(maxY, y);

      x += xStride + extraWidth;
    }
  }

  return { positions, maxX, maxY };
}

// Calculate positions for rowStarts layout
function calculateRowStartsLayout(dzis, rowStarts, rotatedIndexes) {
  const positions = [];
  let x = xStride - 1; // left margin = inter-item gap
  let y = 0;
  let maxX = 0;
  let maxY = 0;

  const rotatedExtraWidth = (yStride - xStride) / 2;

  for (let index = 0; index < dzis.length; index++) {
    if (rowStarts.includes(index)) {
      x = xStride - 1; // left margin = inter-item gap
      y += yStride;
    }

    const isRotated = rotatedIndexes.includes(index);
    const degrees = isRotated ? 90 : 0;
    let xExtra = 0;

    if (isRotated) {
      xExtra = rotatedExtraWidth;
      x += xExtra;
    }

    positions.push({ x, y, degrees });

    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    x += xStride + xExtra;
  }

  return { positions, maxX, maxY };
}

// Main initialization function
export function initViewer(dzis, config = {}) {
  const {
    rowStarts = [],
    rotatedIndexes = [],
    defaultLayout = 'responsive',
    animationOrigin = 'spray'
  } = config;

  let currentLayoutMode = defaultLayout;

  // Calculate initial layout
  const calculateCurrentLayout = () => {
    if (currentLayoutMode === 'responsive') {
      return calculateResponsiveLayout(dzis, rotatedIndexes);
    } else {
      return calculateRowStartsLayout(dzis, rowStarts, rotatedIndexes);
    }
  };

  const initialLayout = calculateCurrentLayout();
  let { maxX, maxY } = initialLayout;

  // Create ImageRec objects
  imageRecs = dzis.map((dzi, index) => {
    const pos = initialLayout.positions[index];
    return new ImageRec(dzi, pos.x, pos.y, pos.degrees);
  });

  // Detect if embedded in an iframe
  const isEmbedded = window.self !== window.top;

  // Check for initial page from URL hash
  const initialPageIndex = getPageFromHash();
  const hasInitialPage = initialPageIndex !== null && initialPageIndex >= 0 && initialPageIndex < dzis.length;

  // Track animation completion for initial page zoom
  let animationsStarted = 0;

  // Calculate animation origin in viewport coords
  const container = document.getElementById('osd-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const gridWidth = maxX + xStride;
  const gridHeight = maxY + yStride;
  const containerAspect = W / H;
  const gridAspect = gridWidth / gridHeight;
  let pixelsPerUnit, padX, padY;
  if (containerAspect > gridAspect) {
    pixelsPerUnit = H / gridHeight;
    padX = (W - gridWidth * pixelsPerUnit) / 2;
    padY = 0;
  } else {
    pixelsPerUnit = W / gridWidth;
    padX = 0;
    padY = (H - gridHeight * pixelsPerUnit) / 2;
  }

  let originX, originY;
  const sprayImg = document.querySelector('.spray-image');

  if (animationOrigin === 'topRight') {
    originX = (W - padX) / pixelsPerUnit;
    originY = -padY / pixelsPerUnit;
    if (sprayImg) sprayImg.remove();
  } else {
    // Derive origin from the .spray-image element's top-left corner
    const pngH = H * 0.1; // CSS: height: 10%
    const pngW = pngH * (sprayImg.naturalWidth / sprayImg.naturalHeight);
    originX = (W - 20 - pngW - padX) / pixelsPerUnit;
    originY = (H - 20 - pngH - padY) / pixelsPerUnit;
  }

  // Remove spray image with fade
  const removeSprayImage = () => {
    if (!sprayImg || sprayImg.dataset.removing) return;
    sprayImg.dataset.removing = 'true';
    sprayImg.style.transition = 'opacity 1s';
    sprayImg.style.opacity = '0';
    setTimeout(() => sprayImg.remove(), 1000);
  };

  // Create image specifications with animation
  const imageSpecs = imageRecs.map((imageRec, index) => {
    const { tileSource, degrees } = imageRec;

    return {
      tileSource,
      x: originX,
      y: originY,
      width: 0.1,
      degrees,
      opacity: 0,
      preload: true,
      success: function (event) {
        const tiledImage = event.item;
        imageRec.tiledImage = tiledImage;

        imageRec.startAnimation(index, () => {
          animationsStarted++;
          // After last animation starts, either zoom to initial page or show intro
          if (animationsStarted === dzis.length) {
            if (hasInitialPage) {
              removeSprayImage();
              // Small delay then zoom to the requested page
              setTimeout(() => {
                imageRecs[initialPageIndex].zoomToFeature(viewer);
              }, 800);
            } else {
              prepareIntro(viewer);
            }
          }
        });
      }
    };
  });

  // Create the viewer
  viewer = OpenSeadragon({
    id: 'osd-container',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/',
    drawer: 'canvas',
    showFullPageControl: !isEmbedded && (!isTouchDevice || hasMouse),
    animationTime: 3.5,
    gestureSettingsMouse: { clickToZoom: false },
    gestureSettingsPen: { clickToZoom: false },
    tileSources: imageSpecs
  });

  // Apply layout function
  const applyLayout = (layout, animate = true) => {
    const { positions, maxX: newMaxX, maxY: newMaxY } = layout;

    for (let i = 0; i < imageRecs.length; i++) {
      const imageRec = imageRecs[i];
      const pos = positions[i];

      imageRec.startX = pos.x;
      imageRec.startY = pos.y;
      imageRec.degrees = pos.degrees;

      if (imageRec.tiledImage) {
        imageRec.tiledImage.setPosition(new OpenSeadragon.Point(pos.x, pos.y));
        imageRec.tiledImage.setRotation(pos.degrees);
      }
    }

    const rect = new OpenSeadragon.Rect(0, 0, newMaxX + xStride, newMaxY + yStride);
    if (animate) {
      viewer.viewport.fitBounds(rect);
    } else {
      viewer.viewport.fitBounds(rect, true);
    }
  };

  // Toggle layout function
  const toggleLayout = () => {
    if (rowStarts.length === 0) return; // No alternate layout available

    if (currentLayoutMode === 'responsive') {
      currentLayoutMode = 'rowStarts';
      applyLayout(calculateRowStartsLayout(dzis, rowStarts, rotatedIndexes));
    } else {
      currentLayoutMode = 'responsive';
      applyLayout(calculateResponsiveLayout(dzis, rotatedIndexes));
    }
  };

  // Viewer open handler
  viewer.addHandler('open', () => {
    viewer.viewport.fitBounds(
      new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride),
      true
    );

  });

  // Remove spray image on any user interaction
  viewer.addHandler('canvas-click', removeSprayImage);
  viewer.addHandler('canvas-drag', removeSprayImage);
  viewer.addHandler('canvas-scroll', removeSprayImage);
  viewer.addHandler('canvas-pinch', removeSprayImage);

  // Click handler
  viewer.addHandler('canvas-click', (event) => {
    if (!event.quick) return;

    const viewportPos = viewer.viewport.pointFromPixel(event.position);
    const viewportBounds = viewer.viewport.getBounds();

    for (let i = 0; i < imageRecs.length; i++) {
      const imageRec = imageRecs[i];
      if (imageRec.isHit(viewportPos)) {
        if (imageRec.isFeatured(viewportBounds)) {
          const imageBounds = imageRec.tiledImage.getBounds();
          const xFactor = (viewportPos.x - imageBounds.x) / imageBounds.width;
          if (xFactor < 0.333) {
            const prev = imageRecs[i - 1];
            if (prev) prev.zoomToFeature(viewer);
          } else if (xFactor > 0.666) {
            const next = imageRecs[i + 1];
            if (next) next.zoomToFeature(viewer);
          } else {
            imageRec.zoomToFeature(viewer);
          }
        } else {
          imageRec.zoomToFeature(viewer);
        }
        break;
      }
    }
  });

  // Disable default keyboard panning
  viewer.addHandler('canvas-key', (event) => {
    event.preventHorizontalPan = true;
    event.preventVerticalPan = true;
  });

  // Keyboard navigation
  window.addEventListener('keydown', (event) => {
    // Space triggers the shuffle experiment
    if (event.code === 'Space') {
      event.preventDefault();
      shuffleArrangement();
      return;
    }

    // "L" key toggles between responsive and rowStarts layouts
    if (event.code === 'KeyL') {
      event.preventDefault();
      toggleLayout();
      return;
    }

    if (!['ArrowLeft', 'ArrowRight'].includes(event.code)) return;

    let bestFraction = 0;
    let bestIndex = -1;
    const viewportBounds = viewer.viewport.getBounds();

    for (let i = 0; i < imageRecs.length; i++) {
      const imageRec = imageRecs[i];
      if (imageRec.isFeatured(viewportBounds)) {
        const fraction = imageRec.getVisibleFraction(viewportBounds);
        if (fraction > bestFraction) {
          bestFraction = fraction;
          bestIndex = i;
        }
      }
    }

    if (bestIndex !== -1) {
      const direction = event.code === 'ArrowLeft' ? -1 : 1;
      const newIndex = bestIndex + direction;
      if (newIndex >= 0 && newIndex < imageRecs.length) {
        imageRecs[newIndex].zoomToFeature(viewer);
      }
    }
  });

  // URL hash updates (only when not embedded)
  if (!isEmbedded) {
    let hashUpdatePaused = false;

    const updateUrlHash = debounce(() => {
      if (hashUpdatePaused) return;

      const viewportBounds = viewer.viewport.getBounds();
      const pageIndex = findCurrentPage(imageRecs, viewportBounds);

      if (pageIndex !== null) {
        setPageHash(pageIndex);
      } else {
        clearPageHash();
      }
    }, 1500);

    viewer.addHandler('animation-finish', updateUrlHash);

    // Listen for manual hash changes (user editing URL)
    window.addEventListener('hashchange', () => {
      const newPageIndex = getPageFromHash();
      if (newPageIndex !== null && newPageIndex >= 0 && newPageIndex < imageRecs.length) {
        // Pause hash updates briefly to avoid fighting with the zoom animation
        hashUpdatePaused = true;
        imageRecs[newPageIndex].zoomToFeature(viewer);
        setTimeout(() => { hashUpdatePaused = false; }, 2000);
      }
    });
  }

  return { imageRecs, viewer };
}
