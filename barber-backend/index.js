// ✅ Load environment variables
require('dotenv').config();

// ✅ Import dependencies (CommonJS style)
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db } = require('./firebase');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const FROM = process.env.EMAIL_FROM;


const app = express();

// ✅ Stripe Webhook requires raw body BEFORE express.json()
app.post('/webhook', express.raw({ type: 'application/json' }));

// ✅ JSON body parsing for all other routes
app.use(express.json());
app.use(cors());

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('Daril Barber Backend is running 🚀');
});

// ✅ Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { slotId, time, customerName, customerPhone } = req.body;

    const amount = 4000; // 40.00 PLN
    const applicationFee = Math.round(amount * 0.30); // 30% fee

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: { name: `Barber Slot: ${time}` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: process.env.BARBER_STRIPE_ACCOUNT_ID,
        },
      },
      metadata: { slotId, customerName, customerPhone },
      success_url: `http://localhost:5173/success`,
      cancel_url: `http://localhost:5173/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Stripe error:', error);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

// ✅ Stripe Webhook handler
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
    const { slotId, customerName, customerPhone } = session.metadata || {};

    if (!slotId || !customerName || !customerPhone) {
      console.error('❌ Missing metadata in Stripe session:', session.metadata);
      return res.status(400).send('Missing metadata in Stripe session');
    }

    try {
      const slotRef = db.collection('slots').doc(slotId);
      await slotRef.update({
        status: 'booked',
        customerName,
        customerPhone,
        paymentType: 'card',
      });

      // After await slotRef.update(...)
      const customerEmail = session.customer_details?.email; // optional if you collected it
      const msgToCustomer = {
        to: customerEmail || session.metadata.customerPhone + '@sms-gateway.example.com', // or skip if you don't have email
        from: FROM,
        subject: `Your barber slot is booked!`,
        text: `Hi ${session.metadata.customerName},\n\n` +
          `You’re confirmed for ${session.metadata.serviceType === 'atHome' ? 'At‑Home' : 'In‑Shop'} service on ${session.metadata.date} at ${session.metadata.time}.\n\n` +
          `Thanks for booking!`,
      };

      const msgToAdmin = {
        to: 'tsepomkwebu',
        from: FROM,
        subject: `New booking: ${session.metadata.customerName}`,
        text: `📌 ${session.metadata.customerName} booked ${session.metadata.serviceType === 'atHome' ? 'At‑Home' : 'In‑Shop'} • ${session.metadata.date} @ ${session.metadata.time}\n☎️ ${session.metadata.customerPhone}`
      };

      await Promise.all([
        sgMail.send(msgToCustomer),
        sgMail.send(msgToAdmin)
      ]);

      console.log(`✅ Booking confirmed for ${customerName}`);
    } catch (error) {
      console.error('❌ Firebase update failed:', error.message);
    }
  }

  res.status(200).send();
});

// ✅ Start server
app.listen(4242, () => console.log('Server running on http://localhost:4242'));
