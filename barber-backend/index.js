// ✅ Load environment variables
require('dotenv').config();

// ✅ Import dependencies
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db } = require('./firebase');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = process.env.EMAIL_FROM;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FRONTEND_URL = process.env.FRONTEND_URL;

const app = express();

// ✅ Stripe Webhook requires raw body BEFORE express.json()
app.post('/webhook', express.raw({ type: 'application/json' }));

// ✅ JSON body parsing & CORS for other routes
app.use(express.json());
app.use(cors());

// ✅ Health check
app.get('/', (req, res) => {
  res.send('Daril Barber Backend is running 🚀');
});

// ✅ Create Checkout Session (card only, with customer_email & metadata)
app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      slotId,
      date,             // new!
      time,
      customerName,
      customerPhone,
      customerEmail,    // new!
      serviceType,
      address,
      amount
    } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      mode: 'payment',
      customer_email: customerEmail,  // stripe will email receipt here
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `Barber ${serviceType === 'inShop' ? 'In‑Shop' : 'At‑Home'} • ${date} @ ${time}`,
            description: serviceType === 'atHome' ? `Address: ${address}` : undefined
          },
          unit_amount: amount, // e.g. 5000 or 7000
        },
        quantity: 1,
      }],
      metadata: {
        slotId,
        date,               // pass date/time into metadata
        time,
        customerName,
        customerPhone,
        customerEmail,      // pass through for SMS fallback
        serviceType,
        address: address || '',
        amount: amount.toString()
      },
      success_url: `${FRONTEND_URL}/success`,
      cancel_url: `${FRONTEND_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Stripe error:', error);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

// ✅ Webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const {
      slotId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      address
    } = session.metadata || {};

    // Validate
    if (!slotId || !customerName || !customerPhone || !customerEmail) {
      console.error('❌ Missing metadata in Stripe session:', session.metadata);
      return res.status(400).send('Missing metadata in Stripe session');
    }

    try {
      // Update Firestore slot
      const slotRef = db.collection('slots').doc(slotId);
      await slotRef.update({
        status: 'booked',
        customerName,
        customerPhone,
        paymentType: 'card',
        serviceType,
        address: address || '',
        amount: parseInt(session.metadata.amount, 10),
        bookedAt: new Date()
      });

      // Prepare emails
      const msgToCustomer = {
        to: customerEmail,
        from: FROM,
        subject: 'Your barber slot is booked!',
        text: `Hi ${customerName},\n\n` +
          `You’re confirmed for ${serviceType === 'atHome' ? 'At‑Home' : 'In‑Shop'} service on ${date} at ${time}.\n\n` +
          `Thanks for booking!`
      };

      const msgToAdmin = {
        to: ADMIN_EMAIL,
        from: FROM,
        subject: `New booking: ${customerName}`,
        text: `📌 ${customerName} booked ${serviceType === 'atHome' ? 'At‑Home' : 'In‑Shop'} • ${date} @ ${time}\n` +
          `☎️ ${customerPhone}\n` +
          `✉️ ${customerEmail}`
      };

      // Send both
      await Promise.all([
        sgMail.send(msgToCustomer),
        sgMail.send(msgToAdmin)
      ]);

      console.log(`✅ Booking confirmed and emails sent for ${customerName}`);
    } catch (error) {
      console.error('❌ Firebase update or email send failed:', error);
    }
  }

  res.status(200).send();
});

// ✅ Start server
app.listen(4242, () => console.log('Server running on http://localhost:4242'));
