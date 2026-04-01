const form = document.getElementById('applicationForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');

function validate() {
  let valid = true;
  const fields = form.querySelectorAll('[required]');

  fields.forEach(field => {
    const group = field.closest('.form-group');
    let fieldValid = true;

    if (field.type === 'email') {
      fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value);
    } else if (field.name === 'instagram') {
      fieldValid = field.value.includes('instagram.com/');
    } else if (field.tagName === 'SELECT') {
      fieldValid = field.value !== '';
    } else {
      fieldValid = field.value.trim() !== '';
    }

    group.classList.toggle('invalid', !fieldValid);
    if (!fieldValid) valid = false;
  });

  return valid;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';

  if (!validate()) return;

  // Honeypot check
  if (form.querySelector('[name="website"]').value) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Envoi en cours…';

  const data = {
    prenom: form.prenom.value.trim(),
    nom: form.nom.value.trim(),
    instagram: form.instagram.value.trim(),
    whatsapp: form.whatsapp.value.trim(),
    email: form.email.value.trim(),
    budget: form.budget.value,
    objectif: form.objectif.value.trim(),
    activite: form.activite.value.trim(),
  };

  try {
    const res = await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Une erreur est survenue.');
    }

    const result = await res.json();
    const params = new URLSearchParams({
      position: result.position,
      date: result.estimatedDate,
    });
    window.location.href = `confirmation.html?${params}`;
  } catch (err) {
    formError.textContent = err.message;
    formError.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer ma candidature';
  }
});
