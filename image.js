document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector("#school-carousel");
  const track = container.querySelector(".carousel-track");
  const slidesOriginal = Array.from(track.children);
  const nextBtn = container.querySelector(".next");
  const prevBtn = container.querySelector(".prev");
  const dotsContainer = container.querySelector(".dots");

  // 1. CLONE SLIDES for Infinite Loop
  // Clone first and last slide
  const firstClone = slidesOriginal[0].cloneNode(true);
  const lastClone = slidesOriginal[slidesOriginal.length - 1].cloneNode(true);

  // Add clones to DOM
  track.appendChild(firstClone);
  track.insertBefore(lastClone, slidesOriginal[0]);

  // Now we have [LastClone, Img1, Img2, Img3, FirstClone]
  const slides = Array.from(track.children);
  
  // 2. STATE
  let index = 1; // Start at 1 because 0 is the clone
  let isTransitioning = false;
  let interval;
  const slideDuration = 500; // ms

  // 3. CREATE DOTS (Only for original slides)
  slidesOriginal.forEach((_, i) => {
    const dot = document.createElement("button");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => {
      if (isTransitioning) return;
      index = i + 1; // Adjust for clone offset
      updateSlide();
      restartTimer();
    });
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.children);

  // 4. MAIN SLIDE FUNCTION
  function updateSlide(transition = true) {
    const width = slides[0].clientWidth;
    
    if (transition) {
        track.style.transition = `transform ${slideDuration}ms ease-in-out`;
        isTransitioning = true;
    } else {
        track.style.transition = "none";
    }
    
    track.style.transform = `translateX(-${index * width}px)`;
    
    // Update dots (Use modulo to map clones to real dots)
    // Real index is index-1. 
    // If index is 0 (lastClone), real is last. If index is len-1 (firstClone), real is 0.
    let activeDotIndex = 0;
    if (index === 0) activeDotIndex = dots.length - 1;
    else if (index === slides.length - 1) activeDotIndex = 0;
    else activeDotIndex = index - 1;

    dots.forEach(d => d.classList.remove("active"));
    if (dots[activeDotIndex]) dots[activeDotIndex].classList.add("active");
  }

  // Initial Position (offset by one clone)
  updateSlide(false);

  // 5. HANDLE END OF TRANSITION (The Infinite Loop Magic)
  track.addEventListener("transitionend", () => {
    isTransitioning = false;
    
    // If we are at the cloned last slide (visual end), snap to real first slide
    if (index === slides.length - 1) {
      index = 1;
      updateSlide(false); // No transition = invisible snap
    }
    
    // If we are at the cloned first slide (visual start), snap to real last slide
    if (index === 0) {
      index = slides.length - 2;
      updateSlide(false);
    }
  });

  // 6. NAVIGATION
  function nextSlide() {
    if (isTransitioning) return;
    index++;
    updateSlide();
  }

  function prevSlide() {
    if (isTransitioning) return;
    index--;
    updateSlide();
  }

  // 7. SWIPE SUPPORT (Mobile)
  let touchStartX = 0;
  let touchEndX = 0;

  container.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
    stopTimer();
  });

  container.addEventListener("touchend", e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
    startTimer();
  });

  function handleSwipe() {
    const threshold = 50; // Min distance to trigger swipe
    if (touchEndX < touchStartX - threshold) nextSlide();
    if (touchEndX > touchStartX + threshold) prevSlide();
  }

  // 8. AUTOPLAY CONTROLS
  function startTimer() {
    interval = setInterval(nextSlide, 4000);
  }

  function stopTimer() {
    clearInterval(interval);
  }

  function restartTimer() {
    stopTimer();
    startTimer();
  }

  // Event Listeners
  nextBtn.addEventListener("click", () => {
    nextSlide();
    restartTimer();
  });

  prevBtn.addEventListener("click", () => {
    prevSlide();
    restartTimer();
  });

  container.addEventListener("mouseenter", stopTimer);
  container.addEventListener("mouseleave", startTimer);

  // Handle Window Resize (Recalculate width)
  window.addEventListener('resize', () => {
      updateSlide(false);
  });

  // Start
  startTimer();
});