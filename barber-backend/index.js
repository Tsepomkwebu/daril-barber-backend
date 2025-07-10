// index.js
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // 🔁 Replace this

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { slotId, time, customerName, customerPhone } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'pln',
        product_data: {
          name: `Barber Slot: ${time}`,
        },
        unit_amount: 40, // 40 PLN
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
});

app.listen(4242, () => console.log('Server running on http://localhost:4242'));
