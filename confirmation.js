const params = new URLSearchParams(window.location.search);

const position = params.get('position');
const dateStr = params.get('date');

if (position) {
  document.getElementById('position').textContent = `#${position}`;
}

if (dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  document.getElementById('date').textContent = formatted;
}
