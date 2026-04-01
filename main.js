document.addEventListener('DOMContentLoaded', () => {
  const speed = 50; // ms per character (slower, more deliberate)

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const block = entry.target;
      if (block.dataset.started) return;
      block.dataset.started = 'true';
      observer.unobserve(block);

      const el = block.querySelector('.typewriter');
      if (el) typeText(el);
    });
  }, { threshold: 0.3 });

  // Observe the funnel-block parent, not the typewriter itself
  document.querySelectorAll('.funnel-block').forEach((block) => {
    observer.observe(block);
  });

  function typeText(el) {
    const text = el.dataset.text;
    let i = 0;

    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);

    function tick() {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        setTimeout(tick, speed);
      } else {
        setTimeout(() => cursor.remove(), 1500);
      }
    }
    tick();
  }
});
