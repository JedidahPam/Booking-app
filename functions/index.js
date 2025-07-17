const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Use env var for security

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory store for demo
const userPaymentMethods = {};
const paymentHistory = {};



// Add Payment Method
app.post("/payments/methods", async (req, res) => {
  const userId = req.userId;
  // const {type, cardNumber,
  //  expiryMonth, expiryYear, cvv, holderName} = req.body;
  const {type, testToken, holderName} = req.body;

  if (type !== "card") {
    return res.status(400).json({error: "Only card type supported"});
  }

  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: testToken,
      },
      billing_details: {
        name: holderName,
      },
    });

    let customerId;
    if (!userPaymentMethods[userId]) {
      const customer = await stripe.customers.create({
        name: holderName,
        metadata: {userId},
      });
      customerId = customer.id;
      userPaymentMethods[userId] = {customerId, methods: []};
    } else {
      customerId = userPaymentMethods[userId].customerId;
    }

    await stripe.paymentMethods.attach(paymentMethod.id,
        {customer: customerId});

    userPaymentMethods[userId].methods.push(paymentMethod.id);

    res.json({paymentMethodId: paymentMethod.id});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// Get Payment Methods
app.get("/payments/methods", async (req, res) => {
  const userId = req.userId;
  const userData = userPaymentMethods[userId];
  if (!userData) return res.json({paymentMethods: []});

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userData.customerId,
      type: "card",
    });
    res.json({paymentMethods: paymentMethods.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// Process Payment
app.post("/payments/process", async (req, res) => {
  const userId = req.userId;
  const {rideId, paymentMethodId, amount, tip = 0, currency = "usd"} = req.body;

  if (!rideId || !paymentMethodId || !amount) {
    return res.status(400).json({error: "Missing required parameters"});
  }

  try {
    const userData = userPaymentMethods[userId];
    if (!userData) {
      return res.status(400).json({
        error: "User has no payment methods"});
    }


    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round((amount + tip) * 100),
      currency,
      customer: userData.customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {rideId, userId},
    });

    if (!paymentHistory[userId]) paymentHistory[userId] = [];
    paymentHistory[userId].push({
      paymentId: paymentIntent.id,
      amount: amount + tip,
      currency,
      date: new Date(),
      rideId,
    });

    res.json({success: true, paymentIntentId: paymentIntent.id});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// Payment History
app.get("/payments/history", (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const history = paymentHistory[userId] || [];
  const start = (page - 1) * limit;
  const paginated = history.slice(start, start + limit);

  res.json({
    page,
    limit,
    total: history.length,
    payments: paginated,
  });
});

app.listen(3000, () =>
  console.log("Stripe payments backend running on port 3000"));
