import { dzis } from './data.js';
import { whenFullyLoaded } from './util.js';

// Configuration for arranging images
const rowStarts = [0, 3, 6, 8, 16, 19, 29, 41, 55];
const rotatedIndexes = [18, 24];
const xStride = 1.1;
const yStride = 1.6;

// Configuration for animation
const delayPerImage = 25; // milliseconds
const randomness = 30; // bigger is more random

// Figure out the layouts
let x = 0;
let y = 0;
let maxX = 0;
let maxY = 0;

const layouts = dzis.map((dzi, index) => {
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

  const layout = {
    tileSource: dzi,
    x,
    y,
    degrees
  };

  maxX = Math.max(maxX, x);
  maxY = Math.max(maxY, y);

  x += xStride + xExtra;
  return layout;
});

// Create image specifications with animation
let introTimeout;

const imageSpecs = layouts.map((layout, index) => {
  const { tileSource, x, y, degrees } = layout;
  const delay = delayPerImage * (index + Math.random() * randomness);

  const imageSpec = {
    tileSource,
    x: maxX,
    y: 0,
    degrees,
    opacity: 0,
    preload: true,
    success: function (event) {
      const tiledImage = event.item;
      setTimeout(() => {
        whenFullyLoaded(tiledImage, () => {
          tiledImage.setOpacity(1);
          tiledImage.setPosition(new OpenSeadragon.Point(x, y));

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
        });
      }, delay);
    }
  };

  return imageSpec;
});

// Create the viewer
const options = {
  id: 'osd-container',
  prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/',
  drawer: 'canvas',
  tileSources: imageSpecs
};

const viewer = OpenSeadragon(options);

viewer.addHandler('open', () => {
  // Move the viewport to where the images will end up after the animation
  viewer.viewport.fitBounds(new OpenSeadragon.Rect(0, 0, maxX + xStride, maxY + yStride), true);
});
