// ═══════════════════════════════════════════════════════════════
// GALLERY.JS — Emeakaroha Foundation School  |  ES6+ only
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Theme button sync ────────────────────────────────────────
  const syncThemeBtns = () => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === saved);
    });
  };
  syncThemeBtns();

  // ── Settings modal ───────────────────────────────────────────
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('open-settings-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    settingsModal.style.display = 'flex';
    const check = document.getElementById('check');
    if (check) check.checked = false;
  });
  document.querySelector('.close-modal')?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  // ── ChatAI sub-dropdown ──────────────────────────────────────
  const navSub   = document.querySelector('.nav-has-sub');
  const subLabel = navSub?.querySelector('.nav-sub-label');
  subLabel?.addEventListener('click', (e) => { e.stopPropagation(); navSub.classList.toggle('open'); });
  document.addEventListener('click', () => navSub?.classList.remove('open'));
  navSub?.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('resize', () => navSub?.classList.remove('open'));

  // ══════════════════════════════════════════════════════════════
  // MODE TABS
  // ══════════════════════════════════════════════════════════════
  const modeTabs      = document.querySelectorAll('.g-mode-tab');
  const photosSection = document.getElementById('photos-section');
  const videosSection = document.getElementById('videos-section');

  const switchMode = (mode) => {
    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    photosSection.classList.toggle('hidden', mode !== 'photos');
    videosSection.classList.toggle('hidden', mode !== 'videos');
  };

  modeTabs.forEach(tab => tab.addEventListener('click', () => switchMode(tab.dataset.mode)));

  // ══════════════════════════════════════════════════════════════
  // PHOTO FILTERING
  // ══════════════════════════════════════════════════════════════
  const filterBtns = document.querySelectorAll('.g-filter');
  const photoItems = [...document.querySelectorAll('#g-photo-grid .g-item')];
  const photoCount = document.getElementById('g-photo-count');
  const photoEmpty = document.getElementById('g-photo-empty');

  const visiblePhotos = () => photoItems.filter(el => !el.classList.contains('hidden'));

  const applyFilter = (filter) => {
    let shown = 0;
    photoItems.forEach((item, i) => {
      const match = filter === 'all' || item.dataset.category === filter;
      if (match) {
        item.classList.remove('hidden', 'appear');
        setTimeout(() => item.classList.add('appear'), i * 45);
        shown++;
      } else {
        item.classList.add('hidden');
        item.classList.remove('appear');
      }
    });
    photoEmpty?.classList.toggle('hidden', shown > 0);
    if (photoCount) photoCount.textContent = `${shown} photo${shown !== 1 ? 's' : ''}`;
  };

  applyFilter('all');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // IMAGE LIGHTBOX
  // ══════════════════════════════════════════════════════════════
  const lb        = document.getElementById('g-lb');
  const lbImg     = document.getElementById('g-lb-img');
  const lbCaption = document.getElementById('g-lb-caption');
  const lbCounter = document.getElementById('g-lb-counter');
  const lbSpinner = document.getElementById('g-lb-spinner');
  const lbClose   = document.getElementById('g-lb-close');
  const lbPrev    = document.getElementById('g-lb-prev');
  const lbNext    = document.getElementById('g-lb-next');

  let currentPhotoIdx = 0;

  const showPhoto = (items, idx) => {
    const item    = items[idx];
    const src     = item.dataset.src || '';
    const caption = item.dataset.caption || item.querySelector('.g-title')?.textContent || '';

    lbImg.classList.remove('loaded');
    lbImg.src = '';
    lbSpinner?.classList.remove('hidden');

    lbImg.onload  = () => { lbSpinner?.classList.add('hidden'); lbImg.classList.add('loaded'); };
    lbImg.onerror = () => { lbSpinner?.classList.add('hidden'); lbImg.classList.add('loaded'); };
    lbImg.alt = caption;
    lbImg.src = src;

    if (lbCaption) lbCaption.textContent = caption;
    if (lbCounter) lbCounter.textContent = `${idx + 1} / ${items.length}`;
  };

  const openLb = (idx) => {
    const items = visiblePhotos();
    if (!items.length) return;
    currentPhotoIdx = idx;
    showPhoto(items, currentPhotoIdx);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeLb = () => {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
    // Reset zoom state
    isZoomed = false;
    lbImg.style.transform = 'scale(1)';
  };

  const navigatePhoto = (dir) => {
    const items = visiblePhotos();
    currentPhotoIdx = (currentPhotoIdx + dir + items.length) % items.length;
    showPhoto(items, currentPhotoIdx);
  };

  photoItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('hidden')) return;
      const items = visiblePhotos();
      const idx   = items.indexOf(item);
      if (idx !== -1) openLb(idx);
    });
  });

  lbClose?.addEventListener('click', closeLb);
  lbPrev?.addEventListener('click',  (e) => { e.stopPropagation(); navigatePhoto(-1); });
  lbNext?.addEventListener('click',  (e) => { e.stopPropagation(); navigatePhoto(1);  });
  lb?.addEventListener('click',      (e) => { if (e.target === lb) closeLb(); });

  // Swipe left/right to navigate + double-tap to zoom
  let swipeX       = 0;
  let swipeY       = 0;
  let lastTap      = 0;
  let isZoomed     = false;

  lb?.addEventListener('touchstart', (e) => {
    swipeX = e.changedTouches[0].clientX;
    swipeY = e.changedTouches[0].clientY;

    // Double-tap to zoom toggle
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        const img = document.getElementById('g-lb-img');
        if (img) {
          isZoomed = !isZoomed;
          img.style.transform     = isZoomed ? 'scale(2)' : 'scale(1)';
          img.style.transformOrigin = 'center center';
          img.style.transition    = 'transform 0.25s ease';
        }
        e.preventDefault();
      }
      lastTap = now;
    }
  }, { passive: false });

  lb?.addEventListener('touchend', (e) => {
    if (isZoomed) return;   // don't navigate while zoomed in
    const diff  = swipeX - e.changedTouches[0].clientX;
    const diffY = swipeY - e.changedTouches[0].clientY;
    // Only treat as horizontal swipe if mostly horizontal
    if (Math.abs(diff) > 48 && Math.abs(diff) > Math.abs(diffY)) {
      navigatePhoto(diff > 0 ? 1 : -1);
      isZoomed = false;
      const img = document.getElementById('g-lb-img');
      if (img) { img.style.transform = 'scale(1)'; }
    }
  }, { passive: true });

  // Reset zoom when lightbox closes or navigates
  const resetZoom = () => {
    isZoomed = false;
    const img = document.getElementById('g-lb-img');
    if (img) { img.style.transform = 'scale(1)'; }
  };

  // ══════════════════════════════════════════════════════════════
  // VIDEO LIGHTBOX
  // ══════════════════════════════════════════════════════════════
  const vlb        = document.getElementById('g-vlb');
  const vlbFrame   = document.getElementById('g-vlb-frame');
  const vlbCaption = document.getElementById('g-vlb-caption');
  const vlbClose   = document.getElementById('g-vlb-close');

  const openVlb = (src, caption) => {
    // youtube-nocookie reduces tracking and removes some branding
    vlbFrame.src = `https://www.youtube-nocookie.com/embed/${src}?autoplay=1&rel=0&modestbranding=1&playsinline=0`;
    if (vlbCaption) vlbCaption.textContent = caption;
    vlb.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeVlb = () => {
    vlb.classList.remove('open');
    document.body.style.overflow = '';
    vlbFrame.src = '';
  };

  vlbClose?.addEventListener('click', closeVlb);
  vlb?.addEventListener('click', (e) => { if (e.target === vlb) closeVlb(); });

  document.querySelectorAll('.g-vcard').forEach(card => {
    card.addEventListener('click', () => {
      const { type, src, caption } = card.dataset;
      if (type === 'youtube') {
        openVlb(src, caption || '');
      } else if (type === 'gphoto') {
        window.open(src, '_blank', 'noopener,noreferrer');
      }
    });
  });

  // Keyboard for both lightboxes
  document.addEventListener('keydown', (e) => {
    if (lb?.classList.contains('open')) {
      const map = { Escape: closeLb, ArrowLeft: () => navigatePhoto(-1), ArrowRight: () => navigatePhoto(1) };
      map[e.key]?.();
    }
    if (vlb?.classList.contains('open') && e.key === 'Escape') closeVlb();
  });

}); // end DOMContentLoaded
