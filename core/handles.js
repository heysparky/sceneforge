let _layoutMode = false;

export function injectHandles(el, scene) {
  const toggle = _createToggle(el);
  const handles = ['top', 'right', 'bottom', 'left'].map(side => _createHandle(el, side, scene));

  _setVisible(handles, false);

  toggle.addEventListener('click', () => {
    _layoutMode = !_layoutMode;
    _setVisible(handles, _layoutMode);
    toggle.classList.toggle('sf-active', _layoutMode);
    toggle.querySelector('i').className = _layoutMode ? 'fas fa-lock-open' : 'fas fa-lock';
  });

  return () => {
    toggle.remove();
    handles.forEach(h => h.remove());
    _layoutMode = false;
  };
}

function _setVisible(handles, visible) {
  handles.forEach(h => (h.style.display = visible ? 'block' : 'none'));
}

function _createToggle(parent) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sf-layout-toggle';
  btn.title = 'Adjust scene bounds';
  btn.innerHTML = '<i class="fas fa-lock"></i>';
  parent.appendChild(btn);
  return btn;
}

function _createHandle(parent, side, scene) {
  const el = document.createElement('div');
  el.className = `sf-handle sf-handle-${side}`;
  parent.appendChild(el);

  el.addEventListener('mousedown', e => {
    if (!_layoutMode) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startVal = _getSideValue(parent.getBoundingClientRect(), side);

    function onMove(e) {
      const delta =
        side === 'left'   ? e.clientX - startX :
        side === 'right'  ? startX - e.clientX :
        side === 'top'    ? e.clientY - startY :
                            startY - e.clientY;
      parent.style[side] = `${Math.max(0, startVal + delta)}px`;
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const r = parent.getBoundingClientRect();
      await scene.setFlag('sceneforge', 'sceneBounds', {
        top:    (r.top                           / window.innerHeight) * 100,
        left:   (r.left                          / window.innerWidth)  * 100,
        right:  ((window.innerWidth  - r.right)  / window.innerWidth)  * 100,
        bottom: ((window.innerHeight - r.bottom) / window.innerHeight) * 100,
      });
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  return el;
}

function _getSideValue(rect, side) {
  if (side === 'left')   return rect.left;
  if (side === 'right')  return window.innerWidth  - rect.right;
  if (side === 'top')    return rect.top;
  return window.innerHeight - rect.bottom;
}
