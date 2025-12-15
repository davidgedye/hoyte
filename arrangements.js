import { shuffle } from './util.js';
import { imageRecs, viewer } from './main.js';

// This file is for experimenting with animating the position of OSD images.
// Before I get into more complex positioning I want to test something simple... a shuffle of the images.
// It's not something I want to keep around long term, but it will allow me to mke sure I understand OSD position animation.
// The main function here is shuffleArrangement, which can be called from the console to shuffle the current arrangement of images

function waitForTiles(timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      const ready = imageRecs.length > 0 && imageRecs.every((r) => r.tiledImage);
      if (ready) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for tiled images'));
      setTimeout(check, 100);
    })();
  });
}

export async function shuffleArrangement({ duration = 1500, zoomOutFactor = 1.2 } = {}) {
  await waitForTiles();

  // Sample current positions from tiledImage if possible, otherwise fall back to startX/startY
  const currentPositions = imageRecs.map((r) => {
    const t = r.tiledImage;
    if (t && typeof t.getPosition === 'function') {
      const p = t.getPosition();
      return { x: p.x, y: p.y };
    }
    return { x: r.startX, y: r.startY };
  });

  // Compute bounding box around current positions for the zoom-out
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  currentPositions.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const paddingX = (maxX - minX) * 0.1;
  const paddingY = (maxY - minY) * 0.1;
  const bbox = new OpenSeadragon.Rect(minX - paddingX, minY - paddingY, (maxX - minX) + paddingX * 2, (maxY - minY) + paddingY * 2);

  // Zoom out once to show the area
  const animationSeconds = 1.0;
  viewer.viewport.centerSpringX.animationTime = animationSeconds;
  viewer.viewport.centerSpringY.animationTime = animationSeconds;
  viewer.viewport.zoomSpring.animationTime = animationSeconds;
  viewer.viewport.fitBounds(bbox);
  //await new Promise((res) => setTimeout(res, animationSeconds * 1000 + 50));

  // Create shuffled targets from the current positions
  const shuffled = shuffle(currentPositions.slice());

  const forward = imageRecs.map((r, i) => ({
    tiledImage: r.tiledImage,
    from: { x: currentPositions[i].x, y: currentPositions[i].y },
    to: { x: shuffled[i].x, y: shuffled[i].y }
  }));
  
  // Set target positions on each tiledImage so OpenSeadragon's springs animate them.
  for (const { tiledImage, to } of forward) {
    if (!tiledImage) continue;
    tiledImage.setPosition(new OpenSeadragon.Point(to.x, to.y));
  }

  // after animation, update imageRec.startX/startY so future shuffles use new positions
  imageRecs.forEach((r, i) => {
    r.startX = shuffled[i].x;
    r.startY = shuffled[i].y;
  });
}
