/**
 * ProductLightbox.js
 * ==================
 * Full-featured image lightbox for BNB Enterprises product pages.
 *
 * Features
 * --------
 *  • Open / close with animation
 *  • Prev / Next navigation + thumbnail strip
 *  • Keyboard: Escape, ArrowLeft, ArrowRight
 *  • Pinch-to-zoom (1× – 4×)
 *  • Double-tap to toggle zoom 1× ↔ 2×
 *  • Drag / pan when zoomed
 *  • Swipe left/right (>50 px) to navigate when at 1×
 *  • Zoom-level badge & hint auto-hide
 *  • Blocks body scroll while open
 *
 * Usage
 * -----
 *  ProductLightbox.init(imagesArray);   // call once in initializePageFunctions()
 *  ProductLightbox.open(index);         // open at image index (0-based)
 */

window.ProductLightbox = (function () {

    /* ---- state ---- */
    let images         = [];
    let currentIndex   = 0;
    let isOpen         = false;

    /* zoom / pan */
    let currentScale   = 1;
    let currentX       = 0;
    let currentY       = 0;

    /* touch helpers */
    let touchStartX    = 0;
    let touchStartY    = 0;
    let lastTouchX     = 0;
    let lastTouchY     = 0;
    let isDragging     = false;
    let isPinching     = false;
    let pinchStartDist = 0;
    let pinchStartScale= 1;

    /* double-tap */
    let lastTapTime    = 0;
    const DBL_TAP_MS   = 280;
    const SWIPE_PX     = 50;
    const MIN_SCALE    = 1;
    const MAX_SCALE    = 4;

    /* ---- DOM refs (set in init) ---- */
    let overlay, wrapper, img, btnClose, btnPrev, btnNext,
        counter, hint, badge, thumbStrip;

    let hintTimer  = null;
    let badgeTimer = null;

    /* =========================================================
       PUBLIC API
       ========================================================= */

    function init(imagesArray) {
        images = imagesArray || [];

        overlay   = document.getElementById('lightboxOverlay');
        wrapper   = document.getElementById('lightboxImageWrapper');
        img       = document.getElementById('lightboxImage');
        btnClose  = document.getElementById('lightboxClose');
        btnPrev   = document.getElementById('lightboxPrev');
        btnNext   = document.getElementById('lightboxNext');
        counter   = document.getElementById('lightboxCounter');
        hint      = document.getElementById('lightboxZoomHint');
        badge     = document.getElementById('lightboxZoomBadge');
        thumbStrip= document.getElementById('lightboxThumbnails');

        if (!overlay) return; // lightbox HTML not present

        /* image count attr — CSS hides nav if 1 image */
        overlay.setAttribute('data-count', images.length);

        _buildThumbnails();
        _bindEvents();
    }

    function open(index) {
        currentIndex = Math.max(0, Math.min(index, images.length - 1));
        _resetTransform();
        _loadImage(currentIndex);
        overlay.classList.add('active');
        document.body.classList.add('lightbox-open');
        isOpen = true;
        _showHint();
    }

    function close() {
        overlay.classList.remove('active');
        document.body.classList.remove('lightbox-open');
        isOpen = false;
        _resetTransform();
        clearTimeout(hintTimer);
        clearTimeout(badgeTimer);
    }

    /* =========================================================
       PRIVATE HELPERS
       ========================================================= */

    function _buildThumbnails() {
        if (!thumbStrip) return;
        thumbStrip.innerHTML = '';
        images.forEach(function (src, i) {
            var t = document.createElement('img');
            t.src = src;
            t.className = 'lightbox-thumb' + (i === 0 ? ' active' : '');
            t.alt = 'View ' + (i + 1);
            t.addEventListener('click', function (e) {
                e.stopPropagation();
                _navigate(i);
            });
            thumbStrip.appendChild(t);
        });
    }

    function _updateThumbs() {
        if (!thumbStrip) return;
        var thumbs = thumbStrip.querySelectorAll('.lightbox-thumb');
        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === currentIndex);
        });
    }

    function _loadImage(index) {
        img.classList.add('no-transition');
        img.src = images[index];
        img.alt = 'Product image ' + (index + 1);
        _updateCounter();
        _updateThumbs();
        /* tiny delay so browser renders before removing no-transition */
        setTimeout(function () { img.classList.remove('no-transition'); }, 20);
    }

    function _navigate(index) {
        currentIndex = ((index % images.length) + images.length) % images.length;
        _resetTransform();
        _loadImage(currentIndex);
    }

    function _prev() { _navigate(currentIndex - 1); }
    function _next() { _navigate(currentIndex + 1); }

    function _updateCounter() {
        if (counter) counter.textContent = (currentIndex + 1) + ' / ' + images.length;
    }

    function _resetTransform() {
        currentScale = 1;
        currentX = 0;
        currentY = 0;
        _applyTransform(false);
        _updateBadge();
    }

    function _applyTransform(animate) {
        if (animate === false) img.classList.add('no-transition');
        img.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px) scale(' + currentScale + ')';
        if (animate === false) {
            /* force reflow then remove */
            img.getBoundingClientRect();
            img.classList.remove('no-transition');
        }
    }

    function _clampPosition() {
        /* Prevent panning beyond image edges when zoomed */
        var rect     = img.getBoundingClientRect();
        var wRect    = wrapper.getBoundingClientRect();
        var maxX     = Math.max(0, (rect.width  - wRect.width)  / 2);
        var maxY     = Math.max(0, (rect.height - wRect.height) / 2);
        currentX = Math.max(-maxX, Math.min(maxX, currentX));
        currentY = Math.max(-maxY, Math.min(maxY, currentY));
    }

    function _updateBadge() {
        if (!badge) return;
        if (currentScale > 1.01) {
            badge.textContent = Math.round(currentScale * 10) / 10 + '×';
            badge.classList.add('visible');
            clearTimeout(badgeTimer);
            badgeTimer = setTimeout(function () {
                badge.classList.remove('visible');
            }, 1800);
        } else {
            badge.classList.remove('visible');
        }
    }

    function _showHint() {
        if (!hint) return;
        hint.classList.remove('hide');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () {
            hint.classList.add('hide');
        }, 2800);
    }

    /* ---- distance between two touch points ---- */
    function _getDistance(t1, t2) {
        var dx = t2.clientX - t1.clientX;
        var dy = t2.clientY - t1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /* =========================================================
       EVENT BINDING
       ========================================================= */

    function _bindEvents() {
        /* Buttons */
        btnClose.addEventListener('click', close);
        btnPrev.addEventListener('click',  function (e) { e.stopPropagation(); _prev(); });
        btnNext.addEventListener('click',  function (e) { e.stopPropagation(); _next(); });

        /* Click on overlay bg → close */
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        /* Keyboard */
        document.addEventListener('keydown', function (e) {
            if (!isOpen) return;
            if (e.key === 'Escape')      close();
            if (e.key === 'ArrowLeft')   _prev();
            if (e.key === 'ArrowRight')  _next();
        });

        /* ---- Touch events ---- */
        wrapper.addEventListener('touchstart',  _onTouchStart,  { passive: false });
        wrapper.addEventListener('touchmove',   _onTouchMove,   { passive: false });
        wrapper.addEventListener('touchend',    _onTouchEnd,    { passive: true  });
        wrapper.addEventListener('touchcancel', _onTouchCancel, { passive: true  });
    }

    /* ---- Touch: start ---- */
    function _onTouchStart(e) {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastTouchX  = touchStartX;
            lastTouchY  = touchStartY;
            isDragging  = false;
            isPinching  = false;

            /* double-tap detection */
            var now = Date.now();
            if (now - lastTapTime < DBL_TAP_MS) {
                e.preventDefault();
                /* toggle zoom 1× ↔ 2× */
                if (currentScale > 1.1) {
                    _resetTransform();
                } else {
                    currentScale = 2;
                    currentX = 0;
                    currentY = 0;
                    _applyTransform();
                    _updateBadge();
                }
                lastTapTime = 0;
                return;
            }
            lastTapTime = now;

        } else if (e.touches.length === 2) {
            e.preventDefault();
            isPinching      = true;
            isDragging      = false;
            pinchStartDist  = _getDistance(e.touches[0], e.touches[1]);
            pinchStartScale = currentScale;
        }
    }

    /* ---- Touch: move ---- */
    function _onTouchMove(e) {
        if (e.touches.length === 2 && isPinching) {
            e.preventDefault();
            var dist  = _getDistance(e.touches[0], e.touches[1]);
            var ratio = dist / pinchStartDist;
            currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * ratio));
            _clampPosition();
            _applyTransform(false);
            _updateBadge();
            return;
        }

        if (e.touches.length === 1 && !isPinching) {
            var dx = e.touches[0].clientX - lastTouchX;
            var dy = e.touches[0].clientY - lastTouchY;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;

            if (currentScale > 1.01) {
                /* pan */
                e.preventDefault();
                isDragging = true;
                currentX += dx;
                currentY += dy;
                _clampPosition();
                _applyTransform(false);
            }
        }
    }

    /* ---- Touch: end ---- */
    function _onTouchEnd(e) {
        if (isPinching) {
            isPinching = false;
            if (currentScale < 1.05) _resetTransform();
            return;
        }

        if (!isDragging && e.changedTouches.length === 1) {
            var swipeDx = e.changedTouches[0].clientX - touchStartX;
            var swipeDy = e.changedTouches[0].clientY - touchStartY;

            if (Math.abs(swipeDx) > SWIPE_PX && Math.abs(swipeDx) > Math.abs(swipeDy)) {
                /* horizontal swipe → navigate */
                if (swipeDx < 0) _next();
                else             _prev();
            }
        }

        isDragging = false;
        wrapper.classList.remove('dragging');
    }

    function _onTouchCancel() {
        isPinching = false;
        isDragging = false;
    }

    /* =========================================================
       EXPOSE
       ========================================================= */
    return { init: init, open: open, close: close };

}());