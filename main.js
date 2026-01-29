import { dzis } from './data.js';
import ImageRec from './ImageRec.js';
import { prepareIntro } from './intro.js';
import { showHighlights, highlights, getHighlightBounds, stopAnimation } from './highlights.js';
import { shuffleArrangement } from './arrangements.js';
import { isTouchDevice, hasMouse } from './util.js';

// Configuration for arranging images
const rowStarts = [0, 3, 6, 8, 16, 19, 29, 41, 55, 61, 68];
const rotatedIndexes = [18, 24];
const xStride = 1.1;
const yStride = 1.6;

// Track current layout mode: 'responsive' or 'rowStarts'
let currentLayoutMode = 'responsive';

// Calculate optimal number of columns for responsive grid
function calculateOptimalColumns(numImages, canvasAspect, imageAspect) {
  // For C columns and N images, we have R = ceil(N/C) rows
  // Grid aspect ratio = (C * imageWidth) / (R * imageHeight) = (C / R) * imageAspect
  // We want to find C that minimizes |gridAspect - canvasAspect|

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
function calculateResponsiveLayout(dzis) {
  const container = document.getElementById('osd-container');
  const canvasWidth = container.clientWidth;
  const canvasHeight = container.clientHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  // Calculate average image aspect ratio (width/height) from the DZI data
  // All images are portrait, so we use the first one as representative
  const firstImage = dzis[0].Image;
  const imageAspect = parseInt(firstImage.Size.Width) / parseInt(firstImage.Size.Height);

  const numColumns = calculateOptimalColumns(dzis.length, canvasAspect, imageAspect);
  const positions = [];

  // Extra width needed for rotated images (they become landscape)
  const rotatedExtraWidth = (yStride - xStride) / 2;

  // Maximum x position for a row (the right edge of the last column)
  const maxRowWidth = (numColumns - 1) * xStride + xStride;

  let maxX = 0;
  let maxY = 0;

  // Track position manually to handle row breaks
  let x = 0;
  let y = 0;

  for (let i = 0; i < dzis.length; i++) {
    const isRotated = rotatedIndexes.includes(i);
    const degrees = isRotated ? 90 : 0;

    // Calculate how much width this image needs
    const imageWidth = isRotated ? xStride + rotatedExtraWidth * 2 : xStride;

    // Check if this image would exceed the row boundary
    if (x > 0 && x + imageWidth > maxRowWidth) {
      // Wrap to next row
      x = 0;
      y += yStride;
    }

    // Add extra offset before rotated image to center it
    if (isRotated) {
      x += rotatedExtraWidth;
    }

    positions.push({ x, y, degrees });

    maxX = Math.max(maxX, x + (isRotated ? rotatedExtraWidth : 0));
    maxY = Math.max(maxY, y);

    // Advance x for next image
    x += xStride;
    if (isRotated) {
      x += rotatedExtraWidth;
    }
  }

  return { positions, maxX, maxY };
}

// Calculate positions for rowStarts layout
function calculateRowStartsLayout(dzis) {
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

// Apply a layout to the imageRecs (with animation)
function applyLayout(layout, animate = true) {
  const { positions, maxX, maxY } = layout;

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

  // Fit viewport to new bounds
  if (animate) {
    viewer.viewport.fitBounds(new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride));
  } else {
    viewer.viewport.fitBounds(new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride), true);
  }
}

// Toggle between layout modes
function toggleLayout() {
  if (currentLayoutMode === 'responsive') {
    currentLayoutMode = 'rowStarts';
    applyLayout(calculateRowStartsLayout(dzis));
  } else {
    currentLayoutMode = 'responsive';
    applyLayout(calculateResponsiveLayout(dzis));
  }
}

// Initial layout calculation (responsive by default)
const initialLayout = calculateResponsiveLayout(dzis);
let { maxX, maxY } = initialLayout;

// Create ImageRec objects with initial positions
export const imageRecs = dzis.map((dzi, index) => {
  const pos = initialLayout.positions[index];
  return new ImageRec(dzi, pos.x, pos.y, pos.degrees);
});

// Create image specifications with animation
const imageSpecs = imageRecs.map((imageRec, index) => {
  const { tileSource, degrees } = imageRec;

  const imageSpec = {
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

  return imageSpec;
});

// Create the viewer
const options = {
  id: 'osd-container',
  prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/',
  drawer: 'canvas',
  showFullPageControl: !isTouchDevice || hasMouse,
  gestureSettingsMouse: {
    clickToZoom: false
  },
  gestureSettingsPen: {
    clickToZoom: false
  },
  tileSources: imageSpecs
};

export const viewer = OpenSeadragon(options);

viewer.addHandler('open', () => {
  // Move the viewport to where the images will end up after the animation
  viewer.viewport.fitBounds(new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride), true);

  if (showHighlights) {
    // Add highlight overlays
    for (const highlight of highlights) {
      const highlightRect = getHighlightBounds(highlight);
      if (highlightRect) {
        const overlayElement = document.createElement('div');
        overlayElement.classList.add('highlight-overlay');
        viewer.addOverlay({
          element: overlayElement,
          location: highlightRect
        });
      }
    }
  }
});

// Handle clicks to zoom to images
viewer.addHandler('canvas-click', (event) => {
  stopAnimation();

  if (!event.quick) {
    return;
  }

  const viewportPos = viewer.viewport.pointFromPixel(event.position);
  const viewportBounds = viewer.viewport.getBounds();
  for (let i = 0; i < imageRecs.length; i++) {
    const imageRec = imageRecs[i];
    if (imageRec.isHit(viewportPos)) {
      if (imageRec.isFeatured(viewportBounds)) {
        const imageBounds = imageRec.tiledImage.getBounds();
        const xFactor = (viewportPos.x - imageBounds.x) / imageBounds.width;
        if (xFactor < 0.333) {
          const imageRec2 = imageRecs[i - 1];
          if (imageRec2) {
            imageRec2.zoomToFeature(viewer);
          }
        } else if (xFactor > 0.666) {
          const imageRec2 = imageRecs[i + 1];
          if (imageRec2) {
            imageRec2.zoomToFeature(viewer);
          }
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

// We need to disable the default keyboard panning
viewer.addHandler('canvas-key', (event) => {
  event.preventHorizontalPan = true;
  event.preventVerticalPan = true;
});

// Add our own key handling for left/right to move between images
window.addEventListener('keydown', (event) => {
  // Space triggers the shuffle experiment; Arrow keys move between images
  if (event.code === 'Space') {
    event.preventDefault();
    console.log('Space key detected');
    // Run the shuffle experiment (non-blocking)
    try {
      console.log('Starting shuffleArrangement');
      shuffleArrangement();
    } catch (e) {
      console.error('shuffleArrangement failed:', e);
    }
    return;
  }

  // "L" key toggles between responsive and rowStarts layouts
  if (event.code === 'KeyL') {
    event.preventDefault();
    toggleLayout();
    return;
  }

  if (!['ArrowLeft', 'ArrowRight'].includes(event.code)) {
    return;
  }

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
      const newImageRec = imageRecs[newIndex];
      newImageRec.zoomToFeature(viewer);
    }
  }
});
