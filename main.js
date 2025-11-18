import { dzis } from './data.js';

// Configuration for arranging images
const rowStarts = [0, 3, 6, 8, 16, 19, 29, 41, 55];
const rotatedIndexes = [18, 24];
const xStride = 1.1;
const yStride = 1.6;

// Code for arranging images
let x = 0;
let y = 0;

const imageSpecs = dzis.map((dzi, index) => {
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

  const imageSpec = {
    tileSource: dzi,
    x,
    y,
    degrees
  };

  x += xStride + xExtra;
  return imageSpec;
});

// Create the viewer
const options = {
  id: 'osd-container',
  prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/2.4.2/images/',
  tileSources: imageSpecs
};

const viewer = OpenSeadragon(options);
