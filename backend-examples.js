// Backend API Examples for BarberTime Appointments
// Choose one based on your preferred platform

// ============================================
// OPTION 1: Node.js + Express Backend
// ============================================

/*
npm install express dotenv twilio @sendgrid/mail cors body-parser
*/

// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Twilio & SendGrid
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Store appointments (use database in production)
const appointments = [];

// Appointment Booking Endpoint
app.post('/api/appointments', async (req, res) => {
    try {
        const { name, email, phone, service, smsConsent, emailConsent } = req.body;

        // Validate consent
        if (!smsConsent && !emailConsent) {
            return res.status(400).json({
                error: 'At least one communication method consent required'
            });
        }

        // Create appointment object
        const appointment = {
            id: Date.now(),
            name,
            email,
            phone,
            service,
            smsConsent,
            emailConsent,
            createdAt: new Date().toISOString(),
            status: 'confirmed'
        };

        appointments.push(appointment);

        // Send SMS if consented (TCPA Compliant)
        if (smsConsent) {
            await twilioClient.messages.create({
                body: `Hi ${name}! Your BarberTime appointment for ${service} has been confirmed. We'll send you a reminder soon. Reply STOP to opt out.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phone
            });
        }

        // Send Email if consented (CAN-SPAM Compliant)
        if (emailConsent) {
            await sgMail.send({
                to: email,
                from: 'noreply@barbertime.com',
                subject: 'BarberTime Appointment Confirmed',
                html: `
                    <h2>Your Appointment is Confirmed!</h2>
                    <p>Hi ${name},</p>
                    <p>Service: <strong>${service}</strong></p>
                    <p>We'll send you a reminder 24 hours before your appointment.</p>
                    <p><a href="https://barbertime.com/unsubscribe">Unsubscribe</a></p>
                    <p>BarberTime | 123 Main Street | Your City, State 12345</p>
                `
            });
        }

        res.json({ success: true, appointment });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send Appointment Reminder (Call this 24 hours before appointment)
app.post('/api/send-reminder/:appointmentId', async (req, res) => {
    try {
        const appointment = appointments.find(a => a.id === parseInt(req.params.appointmentId));
        
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // TCPA: Only send if explicitly consented
        if (appointment.smsConsent) {
            await twilioClient.messages.create({
                body: `Reminder: Your BarberTime ${appointment.service} appointment is tomorrow! Reply STOP to opt out.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: appointment.phone
            });
        }

        // CAN-SPAM: Only send if explicitly consented
        if (appointment.emailConsent) {
            await sgMail.send({
                to: appointment.email,
                from: 'noreply@barbertime.com',
                subject: 'Reminder: Your BarberTime Appointment Tomorrow',
                html: `
                    <h2>Appointment Reminder</h2>
                    <p>Hi ${appointment.name},</p>
                    <p>Your ${appointment.service} appointment is tomorrow!</p>
                    <p>See you soon!</p>
                    <p><a href="https://barbertime.com/unsubscribe">Unsubscribe</a></p>
                `
            });
        }

        res.json({ success: true, message: 'Reminder sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Appointments (Admin Only - Add authentication in production)
app.get('/api/appointments', (req, res) => {
    // TODO: Add API key authentication
    res.json(appointments);
});

// Unsubscribe from SMS
app.post('/api/unsubscribe-sms/:phone', (req, res) => {
    const appointment = appointments.find(a => a.phone === req.params.phone);
    if (appointment) {
        appointment.smsConsent = false;
        res.json({ success: true, message: 'Unsubscribed from SMS' });
    } else {
        res.status(404).json({ error: 'Phone number not found' });
    }
});

// Unsubscribe from Email
app.post('/api/unsubscribe-email/:email', (req, res) => {
    const appointment = appointments.find(a => a.email === req.params.email);
    if (appointment) {
        appointment.emailConsent = false;
        res.json({ success: true, message: 'Unsubscribed from Email' });
    } else {
        res.status(404).json({ error: 'Email not found' });
    }
});

// GDPR: Get User Data
app.get('/api/user-data/:email', (req, res) => {
    const appointment = appointments.find(a => a.email === req.params.email);
    if (appointment) {
        res.json({ success: true, data: appointment });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// GDPR/CCPA: Delete User Data
app.delete('/api/user-data/:email', (req, res) => {
    const index = appointments.findIndex(a => a.email === req.params.email);
    if (index > -1) {
        const deleted = appointments.splice(index, 1);
        res.json({ success: true, message: 'User data deleted', data: deleted });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// ============================================
// .env FILE (Create this and add your keys)
// ============================================

/*
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

SENDGRID_API_KEY=your_sendgrid_api_key

NODE_ENV=production
PORT=3000
*/


// ============================================
// OPTION 2: Firebase Cloud Functions
// ============================================

/*
npm install firebase-functions firebase-admin twilio @sendgrid/mail
firebase deploy --only functions
*/

/*
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();
const db = admin.firestore();

const twilioClient = twilio(
    functions.config().twilio.account_sid,
    functions.config().twilio.auth_token
);

sgMail.setApiKey(functions.config().sendgrid.api_key);

// Store appointment
exports.bookAppointment = functions.https.onCall(async (data, context) => {
    const { name, email, phone, service, smsConsent, emailConsent } = data;

    try {
        // Save to Firestore
        const appointmentRef = await db.collection('appointments').add({
            name,
            email,
            phone,
            service,
            smsConsent,
            emailConsent,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'confirmed'
        });

        // Send SMS
        if (smsConsent) {
            await twilioClient.messages.create({
                body: `Hi ${name}! Your BarberTime appointment confirmed. Reply STOP to opt out.`,
                from: functions.config().twilio.phone_number,
                to: phone
            });
        }

        // Send Email
        if (emailConsent) {
            await sgMail.send({
                to: email,
                from: 'noreply@barbertime.com',
                subject: 'BarberTime Appointment Confirmed',
                html: `<h2>Appointment Confirmed</h2><p>Hi ${name}, your ${service} appointment is confirmed!</p>`
            });
        }

        return { success: true, appointmentId: appointmentRef.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Scheduled: Send reminders daily at 10 AM
exports.sendDailyReminders = functions.pubsub
    .schedule('0 10 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointments = await db.collection('appointments')
            .where('appointmentDate', '==', tomorrow.toDateString())
            .get();

        for (const doc of appointments.docs) {
            const apt = doc.data();

            if (apt.smsConsent) {
                await twilioClient.messages.create({
                    body: `Reminder: Your BarberTime ${apt.service} appointment is tomorrow!`,
                    from: functions.config().twilio.phone_number,
                    to: apt.phone
                });
            }

            if (apt.emailConsent) {
                await sgMail.send({
                    to: apt.email,
                    subject: 'Appointment Reminder - Tomorrow',
                    html: `<p>Reminder: Your ${apt.service} appointment is tomorrow!</p>`
                });
            }
        }

        return null;
    });

// GDPR: Delete user data after 2 years
exports.deleteOldAppointments = functions.pubsub
    .schedule('0 0 * * 0') // Weekly
    .onRun(async (context) => {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const oldAppointments = await db.collection('appointments')
            .where('createdAt', '<', twoYearsAgo)
            .get();

        const batch = db.batch();
        oldAppointments.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return null;
    });
*/


// ============================================
// OPTION 3: Update Frontend to Use Backend
// ============================================

/*
Update script.js to call your backend:

function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: e.target[0].value,
        email: e.target[1].value,
        phone: e.target[2].value,
        service: e.target[3].value,
        smsConsent: e.target[4].checked,
        emailConsent: e.target[5].checked
    };
    
    // Call backend API
    fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('✅ Appointment confirmed! Check your ' + 
                  (formData.emailConsent ? 'email' : 'phone') + 
                  ' for confirmation.');
        }
    })
    .catch(error => console.error('Error:', error));
    
    e.target.reset();
}
*/


// ============================================
// TWILIO SETUP GUIDE
// ============================================

/*
1. Go to https://www.twilio.com/
2. Sign up for free trial ($15 credit)
3. Get your Account SID and Auth Token from dashboard
4. Get a Twilio phone number (e.g., +1234567890)
5. Add phone number to .env file
6. Test SMS: twilioClient.messages.create({ body: "Test", from: "+1234567890", to: "+recipient" })

IMPORTANT: Always include "Reply STOP to opt out" in SMS (TCPA requirement)
*/


// ============================================
// SENDGRID SETUP GUIDE
// ============================================

/*
1. Go to https://sendgrid.com/
2. Sign up (free tier: 100 emails/day)
3. Create API key
4. Verify sender email address
5. Add API key to .env file
6. Update from: 'noreply@yourdomain.com'
7. Test email: sgMail.send({ to: "test@example.com", from: "noreply@...", subject: "Test", html: "<p>Test</p>" })

IMPORTANT: Always include unsubscribe link in every email (CAN-SPAM requirement)
*/
