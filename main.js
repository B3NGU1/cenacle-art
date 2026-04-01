document.addEventListener('DOMContentLoaded', () => {
  const typewriters = document.querySelectorAll('.typewriter');
  const speed = 35; // ms per character

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.started) return;
      el.dataset.started = 'true';
      observer.unobserve(el);
      typeText(el);
    });
  }, { threshold: 0.5 });

  typewriters.forEach((el) => observer.observe(el));

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
        // Remove cursor after a pause
        setTimeout(() => cursor.remove(), 1500);
      }
    }
    tick();
  }
});
