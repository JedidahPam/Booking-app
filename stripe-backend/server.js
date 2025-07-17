const express = require('express');
const stripe = require('stripe')('sk_test_51RgPPsIEq6B8XLxXcdnQnGZOi7KrmeXgSJrhMjktwNSiXinvnEQSIhvcnE7YZBrPSdDGO8SAfExLiZUZZnWYFrfo00ZMS3Jjex'); // Replace with your actual secret key
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Stripe payments backend is running!' });
});

// Test endpoint without authentication
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint working!', timestamp: new Date().toISOString() });
});

// Get payment methods for a customer (temporarily without auth for testing)
app.get('/api/payment-methods', async (req, res) => {
    try {
        const { customerId } = req.query;
        
        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }
        
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });
        
        res.json(paymentMethods);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a customer
app.post('/api/create-customer', async (req, res) => {
    try {
        const { email, name } = req.body;
        
        const customer = await stripe.customers.create({
            email,
            name,
        });
        
        res.json({ success: true, customer });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create payment method
app.post('/api/create-payment-method', async (req, res) => {
    try {
        const { type, card } = req.body;
        
        const paymentMethod = await stripe.paymentMethods.create({
            type,
            card,
        });
        
        res.json({ success: true, paymentMethod });
    } catch (error) {
        console.error('Error creating payment method:', error);
        res.status(500).json({ error: error.message });
    }
});

// Attach payment method to customer
app.post('/api/attach-payment-method', async (req, res) => {
    try {
        const { paymentMethodId, customerId } = req.body;
        
        const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });
        
        res.json({ success: true, paymentMethod });
    } catch (error) {
        console.error('Error attaching payment method:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create payment intent for ride booking
app.post('/api/create-ride-payment', async (req, res) => {
    try {
        const { amount, paymentMethodId, customerId, rideDetails } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            payment_method: paymentMethodId,
            customer: customerId,
            confirm: true,
            return_url: 'your-app://payment-success',
            metadata: {
                ride_id: rideDetails?.rideId || 'unknown',
                pickup_location: rideDetails?.pickup || 'unknown',
                destination: rideDetails?.destination || 'unknown',
            },
        });
        
        res.json({
            success: true,
            paymentIntent,
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get payment intent status
app.get('/api/payment-intent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const paymentIntent = await stripe.paymentIntents.retrieve(id);
        
        res.json({ success: true, paymentIntent });
    } catch (error) {
        console.error('Error retrieving payment intent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete payment method
app.delete('/api/payment-method/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const paymentMethod = await stripe.paymentMethods.detach(id);
        
        res.json({ success: true, message: 'Payment method removed' });
    } catch (error) {
        console.error('Error removing payment method:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Stripe payments backend running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  GET  /api/payment-methods?customerId=cus_xxx`);
    console.log(`  POST /api/create-customer`);
    console.log(`  POST /api/create-payment-method`);
    console.log(`  POST /api/attach-payment-method`);
    console.log(`  POST /api/create-ride-payment`);
    console.log(`  GET  /api/payment-intent/:id`);
    console.log(`  DELETE /api/payment-method/:id`);
});