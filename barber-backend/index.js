require('dotenv').config();

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
// Add raw body support ONLY for the webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next(); // skip express.json()
  } else {
    express.json()(req, res, next);
  }
});


app.get('/', (req, res) => {
  res.send('Daril Barber Backend is running 🚀');
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { slotId, time, customerName, customerPhone } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card','blik'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `Barber Slot: ${time}`,
          },
          unit_amount: 4000, // ✅ 40.00 PLN
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
    console.error("Stripe error:", error);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

const { doc, updateDoc } = require('firebase/firestore');
const { db } = require('./firebase'); // make sure you have this setup

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe needs the raw body for webhooks:
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
    const { slotId, customerName, customerPhone } = session.metadata;

    try {
      const slotRef = doc(db, 'slots', slotId);
      await updateDoc(slotRef, {
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


app.listen(4242, () => console.log('Server running on http://localhost:4242'));
