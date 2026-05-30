import * as ff from '@google-cloud/functions-framework';
import { Firestore, FieldValue } from '@google-cloud/firestore';

// Initialize Firestore. It automatically uses GCP project configuration in production.
const db = new Firestore();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitInquiry: ff.HttpFunction = async (req, res) => {
  // CORS Configuration
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
    return;
  }

  try {
    const { name, email, phone, subject, message, honeypot } = req.body || {};

    // Spam honeypot validation: if filled, reject silently or return simulated success
    if (honeypot && honeypot.trim() !== '') {
      console.warn('Honeypot field filled. Potential bot submission blocked.');
      res.status(201).json({
        success: true,
        message: 'Inquiry received successfully',
        id: 'bot-blocked-id',
      });
      return;
    }

    // Input Validation
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Name is required');
    } else if (name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      errors.push('Valid email is required');
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      errors.push('Subject is required');
    } else if (subject.length > 150) {
      errors.push('Subject must be 150 characters or less');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      errors.push('Message is required');
    } else if (message.length > 1000) {
      errors.push('Message must be 1000 characters or less');
    }

    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      errors.push('Phone must be 20 characters or less');
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Generate Firestore Document
    const inquiriesRef = db.collection('contact_inquiries');
    const docRef = inquiriesRef.doc();

    const inquiryData = {
      id: docRef.id,
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : null,
      subject: subject.trim(),
      message: message.trim(),
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(inquiryData);

    res.status(201).json({
      success: true,
      message: 'Inquiry received successfully',
      id: docRef.id,
    });
  } catch (error) {
    console.error('Error processing inquiry submission:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
};
