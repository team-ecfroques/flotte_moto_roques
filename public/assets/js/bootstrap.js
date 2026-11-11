// Le bouton reste utilisable même si un module ne peut pas être téléchargé.
const reload = document.querySelector('#reload');
reload.addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('reload', Date.now());
  window.location.replace(url.href);
});

import('./app.js').catch(() => {
  document.querySelector('.connection').hidden = false;
  document.querySelector('#connection').textContent = 'Chargement interrompu';
  const notice = document.querySelector('#notice');
  notice.textContent = 'Certains fichiers du site n’ont pas pu être chargés. Actualisez pour récupérer la dernière version.';
  notice.classList.add('error');
  reload.hidden = false;
});
