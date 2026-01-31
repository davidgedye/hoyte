export const isTouchDevice = navigator.maxTouchPoints > 0;
export const hasMouse = window.matchMedia('(pointer: fine)').matches;

export function whenFullyLoaded(tiledImage, callback) {
  if (tiledImage.getFullyLoaded()) {
    setTimeout(callback, 1); // Asynchronous execution
  } else {
    tiledImage.addOnceHandler('fully-loaded-change', function () {
      callback(); // Maintain context
    });
  }
}

// ----------
export function shuffle(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
