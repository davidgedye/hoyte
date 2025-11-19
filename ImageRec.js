import { whenFullyLoaded } from './util.js';

// Configuration for animation
const delayPerImage = 25; // milliseconds
const randomness = 30; // bigger is more random

export default class ImageRec {
  constructor(tileSource, startX, startY, degrees) {
    this.tiledImage = null;
    this.tileSource = tileSource;
    this.startX = startX;
    this.startY = startY;
    this.degrees = degrees;
  }

  // ----------
  startAnimation(index, onStarted) {
    const { startX: x, startY: y, tiledImage } = this;
    const delay = delayPerImage * (index + Math.random() * randomness);

    setTimeout(() => {
      whenFullyLoaded(tiledImage, () => {
        tiledImage.setOpacity(1);
        tiledImage.setPosition(new OpenSeadragon.Point(x, y));
        onStarted();
      });
    }, delay);
  }

  // ----------
  isHit(viewportPos) {
    const { tiledImage } = this;
    if (tiledImage) {
      const imageBounds = tiledImage.getBounds();
      return imageBounds.containsPoint(viewportPos);
    }

    return false;
  }

  // ----------
  zoomToFeature(viewer) {
    const { tiledImage } = this;
    if (!tiledImage) {
      return;
    }

    const imageBounds = tiledImage.getBounds();
    const buffer = 0.02;
    imageBounds.x -= buffer;
    imageBounds.y -= buffer;
    imageBounds.width += buffer * 2;
    imageBounds.height += buffer * 2;
    viewer.viewport.fitBounds(imageBounds);
  }

  // ----------
  getVisibleFraction(viewportBounds) {
    const { tiledImage } = this;
    if (!tiledImage) {
      return false;
    }

    const imageBounds = tiledImage.getBounds();
    const intersection = viewportBounds.intersection(imageBounds);
    if (intersection) {
      const imageArea = imageBounds.width * imageBounds.height;
      const intersectionArea = intersection.width * intersection.height;
      const visibleFraction = intersectionArea / imageArea;
      return visibleFraction;
    }

    return 0;
  }

  // ----------
  isFeatured(viewportBounds) {
    const { tiledImage } = this;
    if (!tiledImage) {
      return false;
    }

    const imageBounds = tiledImage.getBounds();
    if (
      this.getVisibleFraction(viewportBounds) > 0.9 &&
      (imageBounds.width / viewportBounds.width > 0.8 ||
        imageBounds.height / viewportBounds.height > 0.8)
    ) {
      return true;
    }

    return false;
  }
}
