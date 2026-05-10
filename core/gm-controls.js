let controlsEl = null;

export function mountGMControls(container, controls) {
  if (!game.user.isGM || !controls.length) return;

  controlsEl = document.createElement('div');
  controlsEl.id = 'sceneforge-gm-controls';

  for (const { icon, label, onClick } of controls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = label;
    btn.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
    btn.addEventListener('click', onClick);
    controlsEl.appendChild(btn);
  }

  container.appendChild(controlsEl);
}

export function unmountGMControls() {
  controlsEl?.remove();
  controlsEl = null;
}
