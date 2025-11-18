export function whenFullyLoaded(tiledImage, callback) {
  if (tiledImage.getFullyLoaded()) {
    setTimeout(callback, 1); // Asynchronous execution
  } else {
    tiledImage.addOnceHandler('fully-loaded-change', function () {
      callback(); // Maintain context
    });
  }
}
