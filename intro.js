let introTimeout;

const isTouchDevice = navigator.maxTouchPoints > 0;
const introDesktop = document.querySelector('.intro-desktop');
const introMobile = document.querySelector('.intro-mobile');
const intro = isTouchDevice ? introMobile : introDesktop;

export function prepareIntro(viewer) {
  clearTimeout(introTimeout);
  introTimeout = setTimeout(() => {
    if (intro) {
      intro.style.display = 'block';

      intro.addEventListener('click', closeIntro);

      viewer.addOnceHandler('zoom', () => {
        closeIntro();
      });
    }
  }, 1000);
}

export function closeIntro() {
  intro.style.display = 'none';
}
