require('dotenv').config();

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

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

app.listen(4242, () => console.log('Server running on http://localhost:4242'));
