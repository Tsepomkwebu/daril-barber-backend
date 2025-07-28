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

// ✅ Stripe Checkout Session (direct charge only)
app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      slotId,
      time,
      customerName,
      customerPhone,
      serviceType,
      address,
      amount
    } = req.body;

    // Create a simple Checkout Session—no application_fee or transfer_data
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `Barber ${serviceType === 'inShop' ? 'In‑Shop' : 'At‑Home'} • ${time}`,
            description: serviceType === 'atHome' ? `Address: ${address}` : undefined
          },
          unit_amount: amount, // e.g. 5000 or 7000
        },
        quantity: 1,
      }],
      metadata: { slotId, customerName, customerPhone, serviceType, address, amount: amount.toString() },
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url:  `${process.env.FRONTEND_URL}/cancel`,
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
    const { slotId, customerName, customerPhone, serviceType, address } = session.metadata || {};

    if (!slotId || !customerName || !customerPhone) {
      console.error('❌ Missing metadata in Stripe session:', session.metadata);
      return res.status(400).send('Missing metadata in Stripe session');
    }

    try {
      const slotRef = db.collection('slots').doc(slotId);
      await slotRef.update({
        status:       'booked',
        customerName,
        customerPhone,
        paymentType:  'card',
        serviceType,
        address:      address || '',
        amount:       parseInt(session.metadata.amount, 10),
      });

      // Send confirmation emails (or SMS)
      const customerEmail = session.customer_details?.email;
      const msgToCustomer = {
        to:     customerEmail || `${customerPhone}@sms-gateway.example.com`,
        from:   FROM,
        subject:`Your barber slot is booked!`,
        text:   `Hi ${customerName},\n\nYou’re confirmed for ${serviceType==='atHome'?'At‑Home':'In‑Shop'} service on ${session.metadata.date||''} at ${time}.\n\nThanks for booking!`,
      };

      const msgToAdmin = {
        to:     'your-admin-email@domain.com',
        from:   FROM,
        subject:`New booking: ${customerName}`,
        text:   `📌 ${customerName} booked ${serviceType==='atHome'?'At‑Home':'In‑Shop'} • ${time}\n☎️ ${customerPhone}`,
      };

      await Promise.all([ sgMail.send(msgToCustomer), sgMail.send(msgToAdmin) ]);
      console.log(`✅ Booking confirmed for ${customerName}`);
    } catch (error) {
      console.error('❌ Firebase update failed:', error.message);
    }
  }

  res.status(200).send();
});

// ✅ Start server
app.listen(4242, () => console.log('Server running on http://localhost:4242'));
