// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Since frontend + backend are hosted TOGETHER on the same server (single deployment),
// we use a relative path here. No need to change this when you deploy.
const BACKEND_URL = '/api/book-appointment';

const form = document.getElementById('bookingForm');
const statusBox = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');

// Prevent booking a date in the past
const dateInput = document.getElementById('visitDate');
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const paymentConfirmed = document.getElementById('paymentConfirm').checked;
  if (!paymentConfirmed) {
    statusBox.className = 'form-status error';
    statusBox.textContent = 'Please confirm you have paid the ₹199 fee before submitting.';
    return;
  }

  const payload = {
    patientName: document.getElementById('patientName').value.trim(),
    patientAge: document.getElementById('patientAge').value.trim(),
    patientPhone: document.getElementById('patientPhone').value.trim(),
    patientEmail: document.getElementById('patientEmail').value.trim(),
    visitDate: document.getElementById('visitDate').value,
    visitTime: document.getElementById('visitTime').value,
    reason: document.getElementById('reason').value.trim(),
    paymentConfirmed: true,
    consultationFee: 199,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  statusBox.className = 'form-status';
  statusBox.textContent = '';

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      statusBox.classList.add('success');
      statusBox.textContent = 'Appointment request sent! The clinic will confirm your slot by phone shortly.';
      form.reset();
    } else {
      throw new Error(data.message || 'Something went wrong. Please try again.');
    }
  } catch (err) {
    statusBox.classList.add('error');
    statusBox.textContent = 'Could not send your request. Please call +91 98970 10355 directly, or try again.';
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm Appointment Request';
  }
});
