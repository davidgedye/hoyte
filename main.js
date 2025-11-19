import { dzis } from './data.js';
import ImageRec from './ImageRec.js';

// Configuration for arranging images
const rowStarts = [0, 3, 6, 8, 16, 19, 29, 41, 55];
const rotatedIndexes = [18, 24];
const xStride = 1.1;
const yStride = 1.6;

// Figure out the layouts
let x = 0;
let y = 0;
let maxX = 0;
let maxY = 0;

const imageRecs = dzis.map((dzi, index) => {
  if (rowStarts.includes(index)) {
    x = 0;
    y += yStride;
  }

  let degrees = 0;
  let xExtra = 0;

  if (rotatedIndexes.includes(index)) {
    degrees = 90;
    xExtra = (yStride - xStride) / 2;
    x += xExtra;
  }

  const imageRec = new ImageRec(dzi, x, y, degrees);

  maxX = Math.max(maxX, x);
  maxY = Math.max(maxY, y);

  x += xStride + xExtra;
  return imageRec;
});

// Create image specifications with animation
let introTimeout;

function prepareIntro() {
  clearTimeout(introTimeout);
  introTimeout = setTimeout(() => {
    const intro = document.querySelector('.intro');
    if (intro) {
      intro.style.display = 'block';

      intro.addEventListener('click', () => {
        intro.style.display = 'none';
      });
    }
  }, 1000);
}

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
      imageRec.startAnimation(index, prepareIntro);
    }
  };

  return imageSpec;
});

// Create the viewer
const options = {
  id: 'osd-container',
  prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/',
  drawer: 'canvas',
  gestureSettingsMouse: {
    clickToZoom: false
  },
  gestureSettingsPen: {
    clickToZoom: false
  },
  tileSources: imageSpecs
};

const viewer = OpenSeadragon(options);

viewer.addHandler('open', () => {
  // Move the viewport to where the images will end up after the animation
  viewer.viewport.fitBounds(new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride), true);
});

viewer.addHandler('canvas-click', (event) => {
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
