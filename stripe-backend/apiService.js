// apiService.js - Create this file in your React Native project

const API_BASE_URL = 'http://localhost:3000/api';

class ApiService {
    
    // Get payment methods for a customer
    static async getPaymentMethods(customerId) {
        try {
            const response = await fetch(`${API_BASE_URL}/payment-methods?customerId=${customerId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch payment methods');
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            throw error;
        }
    }
    
    // Create a new customer
    static async createCustomer(email, name) {
        try {
            const response = await fetch(`${API_BASE_URL}/create-customer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, name }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create customer');
            }
            
            return data;
        } catch (error) {
            console.error('Error creating customer:', error);
            throw error;
        }
    }
    
    // Attach payment method to customer
    static async attachPaymentMethod(paymentMethodId, customerId) {
        try {
            const response = await fetch(`${API_BASE_URL}/attach-payment-method`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paymentMethodId, customerId }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to attach payment method');
            }
            
            return data;
        } catch (error) {
            console.error('Error attaching payment method:', error);
            throw error;
        }
    }
    
    // Create payment intent for ride booking
    static async createRidePayment(amount, paymentMethodId, customerId, rideDetails) {
        try {
            const response = await fetch(`${API_BASE_URL}/create-ride-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    paymentMethodId,
                    customerId,
                    rideDetails,
                }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment');
            }
            
            return data;
        } catch (error) {
            console.error('Error creating ride payment:', error);
            throw error;
        }
    }
    
    // Remove payment method
    static async removePaymentMethod(paymentMethodId) {
        try {
            const response = await fetch(`${API_BASE_URL}/payment-method/${paymentMethodId}`, {
                method: 'DELETE',
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to remove payment method');
            }
            
            return data;
        } catch (error) {
            console.error('Error removing payment method:', error);
            throw error;
        }
    }
}

export default ApiService;