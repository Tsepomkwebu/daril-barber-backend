// ✅ Load environment variables
require('dotenv').config();

// ✅ Import dependencies (CommonJS style)
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { doc, updateDoc } = require('firebase/firestore');
const { db } = require('./firebase'); // Make sure this exports `db`

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
          unit_amount: 4000, // 40.00 PLN
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

// ✅ Start server
app.listen(4242, () => console.log('Server running on http://localhost:4242'));
