import { isTouchDevice, hasMouse } from './util.js';

let introTimeout;

const introDesktop = document.querySelector('.intro-desktop');
const introMobile = document.querySelector('.intro-mobile');
const introBoth = document.querySelector('.intro-both');
const intro = isTouchDevice ? (hasMouse ? introBoth : introMobile) : introDesktop;

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
