// ✅ Load environment variables
require('dotenv').config();

// ✅ Import dependencies (CommonJS style)
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db } = require('./firebase');
const admin = require('firebase-admin');

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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `Barber Slot: ${time}`,
          },
          unit_amount: 4000,
        },
        quantity: 1,
      }],
      metadata: {
        slotId,
        customerName,
        customerPhone,
      },
      success_url: `http://localhost:5173/success`,
      cancel_url: `http://localhost:5173/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe error:", error);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

// Cash booking endpoint
app.post('/bookings', async (req, res) => {
  try {
    const { slotId, customerName, customerPhone, time, paymentType } = req.body;

    if (!slotId || !customerName || !customerPhone || !paymentType) {
      return res.status(400).json({ error: 'Missing booking data' });
    }

    // Reference the slot document
    const slotRef = db.collection('slots').doc(slotId);

    // Update it as booked
    await slotRef.update({
      status:       'booked',
      customerName,
      customerPhone,
      paymentType,   // will be 'cash'
      bookedAt:     admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Cash booking failed:', err);
    return res.status(500).json({ error: 'Cash booking failed' });
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
    console.error('❌ Webhook error:', err.message);
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

      console.log(`✅ Booking confirmed for ${customerName}`);
    } catch (error) {
      console.error('❌ Firebase update failed:', error.message);
    }
  }


  res.status(200).send();
});

// ✅ Start server
app.listen(4242, () => console.log('Server running on http://localhost:4242'));
