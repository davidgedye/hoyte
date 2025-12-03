import { shuffle } from './util.js';
import { imageRecs, viewer } from './main.js';

const animationDuration = 15000; // milliseconds
const betweenDuration = 2000; // milliseconds

export const highlights = [
  {
    imageIndex: 0,
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5
  },
  {
    imageIndex: 10,
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5
  },
  // Adding a very zoomed-in highlight to see how its handled.
  {
    imageIndex: 20,
    x: 0.5,
    y: 0.5,
    width: 0.1,
    height: 0.1
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
  const midZoom = Math.max(startZoom, endZoom) / 5;

  let zoomTween;
  if (startZoom < midZoom * 2) {
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
      .easing(TWEEN.Easing.Quadratic.InOut)
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
