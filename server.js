// server.js
// Single server: serves the frontend (public/) AND handles the booking API.
// This means ONE deployment, no CORS setup needed, and one URL for everything.

require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// ----- Serve the frontend files (index.html, style.css, script.js, doctor-photo.jpg) -----
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ----- Basic rate limiting (very simple, in-memory) -----
const requestLog = new Map();
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

// ----- Mail transporter (Gmail + App Password) -----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----- Validation -----
function validateBooking(body) {
  const errors = [];
  const { patientName, patientAge, patientPhone, visitDate, visitTime, reason, paymentConfirmed } = body;

  if (!patientName || patientName.trim().length < 2) errors.push('Name is required.');
  if (!patientAge || isNaN(patientAge) || patientAge < 0 || patientAge > 120) errors.push('Valid age is required.');
  if (!patientPhone || !/^\d{10}$/.test(patientPhone)) errors.push('Valid 10-digit phone number is required.');
  if (!visitDate) errors.push('Preferred date is required.');
  if (!visitTime) errors.push('Preferred time slot is required.');
  if (!reason || reason.trim().length < 3) errors.push('Reason for visit is required.');
  if (paymentConfirmed !== true) errors.push('Payment confirmation is required.');

  return errors;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----- Route: booking submission -----
app.post('/api/book-appointment', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    const errors = validateBooking(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const {
      patientName,
      patientAge,
      patientPhone,
      patientEmail,
      visitDate,
      visitTime,
      reason,
    } = req.body;

    const mailOptions = {
      from: `"Clinic Website" <${process.env.GMAIL_USER}>`,
      to: process.env.DOCTOR_EMAIL || process.env.GMAIL_USER,
      replyTo: patientEmail || undefined,
      subject: `New Appointment Request — ${patientName} (${visitDate})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#1B4B43;">New Appointment Request</h2>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td style="padding:6px 0;"><strong>Name:</strong></td><td>${escapeHtml(patientName)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Age:</strong></td><td>${escapeHtml(String(patientAge))}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Phone:</strong></td><td>${escapeHtml(patientPhone)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Email:</strong></td><td>${escapeHtml(patientEmail || '—')}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Preferred Date:</strong></td><td>${escapeHtml(visitDate)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Preferred Time:</strong></td><td>${escapeHtml(visitTime)}</td></tr>
            <tr><td style="padding:6px 0; vertical-align:top;"><strong>Reason:</strong></td><td>${escapeHtml(reason)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Fee:</strong></td><td>₹199 — patient marked as paid via UPI (self-confirmed, not gateway-verified)</td></tr>
          </table>
          <p style="margin-top:16px; color:#666; font-size:13px;">
            Sent automatically from the clinic website booking form. Please verify payment
            receipt in your UPI app before confirming the appointment.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: 'Appointment request sent successfully.' });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send appointment request.' });
  }
});

// Health check (used by hosting platform to confirm the app is alive)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback: any unmatched route serves index.html (keeps things simple for a single page site)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
