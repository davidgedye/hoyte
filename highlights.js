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
  }
];

const playButton = document.querySelector('.play-button');
let isPlaying = false;
let nextHighlights = [];
let currentHighlight = null;

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

    setTimeout(() => {
      startNextAnimation();
    }, betweenDuration);
  });
}

// ----------
export function stopAnimation() {
  isPlaying = false;
  playButton.classList.remove('pause');
  TWEEN.removeAll();
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
  const viewBounds = viewer.viewport.getBounds(true);
  const startZoom = viewer.viewport.getZoom(true);
  const imageWidthZoom = 1 / viewRect.width;
  const imageHeightZoom = 1 / viewBounds.getAspectRatio() / viewRect.height;
  const endZoom = Math.min(imageWidthZoom, imageHeightZoom);
  const midZoom = Math.max(startZoom, endZoom) / 5;

  let zoomTween;
  if (startZoom < midZoom * 2) {
    zoomTween = new TWEEN.Tween({ logZoom: Math.log(startZoom) })
      .to({ logZoom: Math.log(endZoom) }, animationDuration)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((data) => {
        viewer.viewport.zoomTo(Math.exp(data.logZoom), null, true);
      });
  } else {
    zoomTween = new TWEEN.Tween({ logZoom: Math.log(startZoom) })
      .to({ logZoom: Math.log(midZoom) }, animationDuration / 2)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((data) => {
        viewer.viewport.zoomTo(Math.exp(data.logZoom), null, true);
      });

    const zoomTweenB = new TWEEN.Tween({ logZoom: Math.log(midZoom) })
      .to({ logZoom: Math.log(endZoom) }, animationDuration / 2)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((data) => {
        viewer.viewport.zoomTo(Math.exp(data.logZoom), null, true);
      });

    zoomTween.chain(zoomTweenB);
  }

  const panTween = new TWEEN.Tween(viewBounds.getCenter())
    .to(viewRect.getCenter(), animationDuration)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate((point) => {
      viewer.viewport.panTo(point, true);
    })
    .onComplete(() => {
      onComplete();
    });

  zoomTween.start();
  panTween.start();
}
