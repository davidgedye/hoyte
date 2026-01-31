import ImageRec from './ImageRec.js';
import { prepareIntro } from './intro.js';
import { isTouchDevice, hasMouse } from './util.js';
import { stopAnimation } from './highlights.js';
import { shuffleArrangement } from './arrangements.js';

// Module-level state (set by initViewer)
export let imageRecs = [];
export let viewer = null;

// Configuration defaults
const xStride = 1.1;
const yStride = 1.6;

// Calculate optimal number of columns for responsive grid
function calculateOptimalColumns(numImages, canvasAspect, imageAspect) {
  let bestColumns = 1;
  let bestDiff = Infinity;

  for (let c = 1; c <= numImages; c++) {
    const rows = Math.ceil(numImages / c);
    const gridAspect = (c / rows) * imageAspect;
    const diff = Math.abs(gridAspect - canvasAspect);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestColumns = c;
    }
  }

  return bestColumns;
}

// Calculate positions for responsive grid layout
function calculateResponsiveLayout(dzis, rotatedIndexes) {
  const container = document.getElementById('osd-container');
  const canvasWidth = container.clientWidth;
  const canvasHeight = container.clientHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  const firstImage = dzis[0].Image;
  const imageAspect = parseInt(firstImage.Size.Width) / parseInt(firstImage.Size.Height);

  const numColumns = calculateOptimalColumns(dzis.length, canvasAspect, imageAspect);
  const positions = [];

  const rotatedExtraWidth = (yStride - xStride) / 2;
  const maxRowWidth = (numColumns - 1) * xStride + xStride;

  let maxX = 0;
  let maxY = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < dzis.length; i++) {
    const isRotated = rotatedIndexes.includes(i);
    const degrees = isRotated ? 90 : 0;
    const imageWidth = isRotated ? xStride + rotatedExtraWidth * 2 : xStride;

    if (x > 0 && x + imageWidth > maxRowWidth) {
      x = 0;
      y += yStride;
    }

    if (isRotated) {
      x += rotatedExtraWidth;
    }

    positions.push({ x, y, degrees });

    maxX = Math.max(maxX, x + (isRotated ? rotatedExtraWidth : 0));
    maxY = Math.max(maxY, y);

    x += xStride;
    if (isRotated) {
      x += rotatedExtraWidth;
    }
  }

  return { positions, maxX, maxY };
}

// Calculate positions for rowStarts layout
function calculateRowStartsLayout(dzis, rowStarts, rotatedIndexes) {
  const positions = [];
  let x = 0;
  let y = 0;
  let maxX = 0;
  let maxY = 0;

  const rotatedExtraWidth = (yStride - xStride) / 2;

  for (let index = 0; index < dzis.length; index++) {
    if (rowStarts.includes(index)) {
      x = 0;
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
    showHighlights = false,
    highlights = []
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

  // Create image specifications with animation
  const imageSpecs = imageRecs.map((imageRec, index) => {
    const { tileSource, degrees } = imageRec;

    return {
      tileSource,
      x: maxX,
      y: 0,
      degrees,
      opacity: 0,
      preload: true,
      success: function (event) {
        const tiledImage = event.item;
        imageRec.tiledImage = tiledImage;
        imageRec.startAnimation(index, () => {
          prepareIntro(viewer);
        });
      }
    };
  });

  // Detect if embedded in an iframe
  const isEmbedded = window.self !== window.top;

  // Create the viewer
  viewer = OpenSeadragon({
    id: 'osd-container',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/',
    drawer: 'canvas',
    showFullPageControl: !isEmbedded && (!isTouchDevice || hasMouse),
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

    if (showHighlights && highlights.length > 0) {
      for (const highlight of highlights) {
        const imageRec = imageRecs[highlight.imageIndex];
        if (imageRec && imageRec.tiledImage) {
          const bounds = imageRec.tiledImage.getBounds();
          const highlightRect = new OpenSeadragon.Rect(
            bounds.x + highlight.x * bounds.width,
            bounds.y + highlight.y * bounds.height,
            highlight.width * bounds.width,
            highlight.height * bounds.height
          );
          const overlayElement = document.createElement('div');
          overlayElement.classList.add('highlight-overlay');
          viewer.addOverlay({ element: overlayElement, location: highlightRect });
        }
      }
    }
  });

  // Click handler
  viewer.addHandler('canvas-click', (event) => {
    stopAnimation();
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

  return { imageRecs, viewer };
}
