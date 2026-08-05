/**
 * <carousel-3d> — draggable 3D cylinder carousel.
 * Direct children become the faces (put an <image-slot> inside each).
 * Drag horizontally to spin; flick for inertia; click a side face to bring it forward.
 *
 * React-safe by construction: the children stay in the light DOM (React keeps owning
 * them) and are rendered through a <slot>. All positioning/transforms live in a
 * stylesheet inside this element's shadow root, addressed with ::slotted(:nth-child(n)),
 * so a React re-render can never strip them.
 */
(function(){
if (customElements.get('carousel-3d')) return;
class Carousel3D extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    if (!document.getElementById('carousel-3d-css')) {
      const st = document.createElement('style');
      st.id = 'carousel-3d-css';
      st.textContent = 'carousel-3d{display:block;position:relative;overflow:hidden;perspective:1000px;transform-style:preserve-3d;cursor:grab;touch-action:pan-y}carousel-3d:active{cursor:grabbing}';
      document.head.appendChild(st);
    }

    this._rot = 0;
    this._vel = 0;

    const root = this.attachShadow({ mode: 'open' });
    this._sheet = document.createElement('style');
    root.appendChild(this._sheet);
    const slot = document.createElement('slot');
    root.appendChild(slot);
    slot.addEventListener('slotchange', () => this._layout());

    this._layout();
    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(this);

    let dragging = false, lastX = 0, moved = 0;
    this.addEventListener('pointerdown', e => {
      dragging = true; moved = 0; lastX = e.clientX;
      this._vel = 0; cancelAnimationFrame(this._raf);
      this.setPointerCapture(e.pointerId);
    });
    this.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX; moved += Math.abs(dx);
      if (moved > 6) e.preventDefault();
      this._rot += dx * 0.09;
      this._vel = dx * 0.09;
      this._apply();
    });
    this.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      if (moved > 6) this._glide(); else this._faceClick(e);
    });
    this.addEventListener('pointercancel', () => { dragging = false; });
    this.addEventListener('dragstart', e => e.preventDefault());
  }

  get _faces() {
    return Array.from(this.children).filter(c => c.nodeType === 1);
  }

  _layout() {
    const n = this._faces.length;
    if (!n) { if (this._sheet) this._sheet.textContent = ''; return; }
    const W = this.clientWidth || 800;
    // scale the cylinder to the element so faces never spill past the edges
    const cylinderWidth = W * (W <= 640 ? 3.2 : 2.1);
    this._faceWidth = cylinderWidth / n;
    this._radius = cylinderWidth / (2 * Math.PI);
    this._apply();
  }

  _apply() {
    const n = this._faces.length;
    if (!n || !this._sheet) return;
    let css = 'slot{display:block;position:absolute;inset:0;transform-style:preserve-3d}' +
      '::slotted(*){position:absolute;top:0;bottom:0;left:50%;width:' + this._faceWidth + 'px;' +
      'margin-left:' + (-this._faceWidth / 2) + 'px;display:flex;align-items:center;justify-content:center;' +
      'padding:8px;box-sizing:border-box;transform-origin:center;will-change:transform}';
    for (let i = 0; i < n; i++) {
      const deg = i * (360 / n) + this._rot;
      const a = ((deg % 360) + 360) % 360;
      const op = 0.45 + 0.55 * (Math.cos(a * Math.PI / 180) + 1) / 2;
      css += '::slotted(:nth-child(' + (i + 1) + ')){transform:rotateY(' + deg.toFixed(2) + 'deg) translateZ(' +
        this._radius.toFixed(2) + 'px);opacity:' + op.toFixed(3) + '}';
    }
    this._sheet.textContent = css;
  }

  _glide() {
    const step = () => {
      this._vel *= 0.94;
      this._rot += this._vel * 1.6;
      this._apply();
      if (Math.abs(this._vel) > 0.02) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _faceClick(e) {
    const faces = this._faces;
    // `pointerdown` captures the pointer so a drag keeps working past the edge
    // of the element — but while a pointer is captured the browser retargets
    // its events, and the click that follows, to the capturing element. So
    // `e.target` is always this carousel and never a face: matching on it meant
    // tapping a face did nothing at all, and a link inside one never fired.
    // Hit-test the coordinates instead, which is what was meant all along.
    const hit = this.ownerDocument.elementFromPoint(e.clientX, e.clientY);
    const face = hit && faces.find(f => f === hit || f.contains(hit));
    if (!face) return;
    const n = faces.length;
    const current = (((faces.indexOf(face) * (360 / n) + this._rot) % 360) + 360) % 360;
    if (current < 12 || current > 348) {
      // Already front. The retargeted click will not reach a link inside the
      // face on its own, so follow it here.
      const link = face.matches('a') ? face : face.querySelector('a');
      if (link) link.click();
      return;
    }
    e.preventDefault();
    let delta = -current;
    if (delta < -180) delta += 360;
    this._spinTo(this._rot + delta);
  }

  _spinTo(target) {
    cancelAnimationFrame(this._raf);
    const from = this._rot, t0 = performance.now(), dur = 480;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      this._rot = from + (target - from) * (1 - Math.pow(1 - p, 3));
      this._apply();
      if (p < 1) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  disconnectedCallback() { cancelAnimationFrame(this._raf); this._ro && this._ro.disconnect(); }
}
customElements.define('carousel-3d', Carousel3D);
})();
