import { shuffle } from './util.js';
import { imageRecs, viewer} from './main.js';

export const showHighlights = false; // Show a bounding box for each highlight
export const overrideHighlights = true; // When True every image is a highlight

const animationDuration = 12000; // milliseconds
const betweenDuration = 5000; // milliseconds

// Generated highlights for all 81 images when overrideHighlights is true
// Hand built highlight rects for specific areas when overrideHighlights is false

export const highlights = overrideHighlights ? Array.from({ length: 81 }, (_, i) => ({
  // This will be wrong for the two rotated images, but it's close enough for demo purposes.
  imageIndex: i,
  x: 0,
  y: 0,
  width: 1,
  height: 1.5
})) : [
  {
    imageIndex: 0,
    x: 0,
    y: 0,
    width: 1,
    height: 1.4
  },
  {
    imageIndex: 2,
    x: 0.15,
    y: 0.4,
    width: 0.6,
    height: 0.4
  },
  {
    imageIndex: 3,
    x: 0,
    y: 0,
    width: 1,
    height: 0.63
  },
  {
    imageIndex: 5,
    x: 0,
    y: 0.4,
    width: 1,
    height: 1.05
  },
  {
    imageIndex: 7,
    x: 0.11,
    y: 0.33,
    width: 0.75,
    height: 0.28 
  },
  {
    imageIndex: 8,
    x: 0,
    y: 0.7,
    width: 1,
    height: 0.74
  },
  {
    imageIndex: 18, // landscape mode
    x: 0,
    y: 0.22,
    width: 0.68,
    height: 0.58
  },
  {
    imageIndex: 20, 
    x: 0.16,
    y: 0,
    width: 0.55,
    height: 0.85
  },
  {
    imageIndex: 62, 
    x: 0,
    y: 0.45,
    width: 1,
    height: 0.6
  },
  {
    imageIndex: 64, 
    x: 0.2,
    y: 0,
    width: 0.8,
    height: 1.5
  },
  {
    imageIndex: 73, 
    x: 0.12,
    y: 0.16,
    width: 0.73,
    height: 0.44
  },
  {
    imageIndex: 79, 
    x: 0,
    y: 0,
    width: 2.1, // two images wide.
    height: 1.5
  }
];

const playButton = document.querySelector('.play-button');
let isPlaying = false;
let nextHighlights = [];
let currentHighlight = null;
let timeout = 0;
const defaultSpringAnimationTime = 1.2; // seconds

// ----------
export function getHighlightBounds(highlight) {
  const imageRec = imageRecs[highlight.imageIndex];
  if (imageRec && imageRec.tiledImage) {
    const imageBounds = imageRec.tiledImage.getBounds();
    const highlightRect = new OpenSeadragon.Rect(
      imageRec.startX + highlight.x * imageBounds.width,
      imageRec.startY + highlight.y * imageBounds.width,
      highlight.width * imageBounds.width,
      highlight.height * imageBounds.width
    );

    return highlightRect;
  }

  return null;
}

// ----------
function animate(time) {
  if (!isPlaying) {
    return;
  }

  requestAnimationFrame(animate);
  TWEEN.update(time);
}

// ----------
function startNextAnimation() {
  if (!isPlaying) {
    return;
  }

  if (nextHighlights.length === 0) {
    nextHighlights = shuffle(highlights).filter((h) => h !== currentHighlight);
  }

  const highlight = nextHighlights.pop();
  const highlightRect = getHighlightBounds(highlight);
  if (!highlightRect) {
    return;
  }

  currentHighlight = highlight;

  animateToRect(highlightRect, () => {
    if (!isPlaying) {
      return;
    }

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      startNextAnimation();
    }, betweenDuration);
  });
}

// ----------
export function stopAnimation() {
  const { viewport } = viewer;
  isPlaying = false;
  playButton.classList.remove('pause');
  TWEEN.removeAll();
  clearTimeout(timeout);

  viewport.centerSpringX.animationTime = defaultSpringAnimationTime;
  viewport.centerSpringY.animationTime = defaultSpringAnimationTime;
  viewport.zoomSpring.animationTime = defaultSpringAnimationTime;

  // Interrupt the spring animation if it's happening
  const viewportBounds = viewport.getBounds(true);
  viewport.fitBounds(viewportBounds, true);
}

// ----------
playButton.addEventListener('click', () => {
  if (isPlaying) {
    stopAnimation();
    return;
  }

  isPlaying = true;
  playButton.classList.add('pause');

  requestAnimationFrame(animate);
  startNextAnimation();
});

// ----------
function animateToRect(viewRect, onComplete) {
  TWEEN.removeAll();

  const { viewport } = viewer;
  const viewBounds = viewport.getBounds(true);
  const startZoom = viewport.getZoom(true);
  const imageWidthZoom = 1 / viewRect.width;
  const imageHeightZoom = 1 / viewBounds.getAspectRatio() / viewRect.height;
  const endZoom = Math.min(imageWidthZoom, imageHeightZoom);
  const midZoom = Math.max(startZoom, endZoom) / 5; //Increase for more zoomout.

  let zoomTween;
  if (startZoom < midZoom * 2) { // Experiment with this number.
    // Linear zoom
    const animationSeconds = animationDuration / 1000;
    viewport.centerSpringX.animationTime = animationSeconds;
    viewport.centerSpringY.animationTime = animationSeconds;
    viewport.zoomSpring.animationTime = animationSeconds;
    viewport.fitBounds(viewRect);

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      onComplete();
    }, animationDuration);
  } else {
    // Zoom out then in
    zoomTween = new TWEEN.Tween({ logZoom: Math.log(startZoom) })
      .to({ logZoom: Math.log(midZoom) }, animationDuration / 2)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((data) => {
        viewport.zoomTo(Math.exp(data.logZoom), null, true);
      });

    const zoomTweenB = new TWEEN.Tween({ logZoom: Math.log(midZoom) })
      .to({ logZoom: Math.log(endZoom) }, animationDuration / 2)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((data) => {
        viewport.zoomTo(Math.exp(data.logZoom), null, true);
      });

    zoomTween.chain(zoomTweenB);

    const panTween = new TWEEN.Tween(viewBounds.getCenter())
      .to(viewRect.getCenter(), animationDuration)
      .easing(TWEEN.Easing.Quintic.InOut) // TWEAK EASING TYPE IF DESIRED
      .onUpdate((point) => {
        viewport.panTo(point, true);
      })
      .onComplete(() => {
        onComplete();
      });

    zoomTween.start();
    panTween.start();
  }
}
