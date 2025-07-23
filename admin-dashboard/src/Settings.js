import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { TextField, Button, Typography, Grid, Paper } from '@mui/material';

const vehicleTypes = ['taxi', 'bus', 'van'];

const Settings = () => {
  const db = getFirestore();
  const [pricing, setPricing] = useState({
    taxi: { baseFare: '', pricePerKm: '', pricePerMinute: '' },
    bus: { baseFare: '', pricePerKm: '', pricePerMinute: '' },
    van: { baseFare: '', pricePerKm: '', pricePerMinute: '' },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPricing = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'settings', 'pricing');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPricing(docSnap.data());
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
        alert('Failed to load pricing data.');
      }
      setLoading(false);
    };

    fetchPricing();
  }, []);

  const handleChange = (vehicle, field, value) => {
    // Allow empty string for clearing inputs
    const parsed = value === '' ? '' : parseFloat(value);
    setPricing(prev => ({
      ...prev,
      [vehicle]: {
        ...prev[vehicle],
        [field]: isNaN(parsed) ? '' : parsed,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'settings', 'pricing');
      await setDoc(docRef, pricing, { merge: true });
      alert('Pricing updated successfully!');
    } catch (error) {
      console.error('Error updating pricing:', error);
      alert('Failed to update pricing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper style={{ padding: 24, maxWidth: 800, margin: '20px auto' }}>
      <Typography variant="h4" gutterBottom>
        Vehicle Pricing Settings
      </Typography>

      {vehicleTypes.map(vehicle => (
        <div key={vehicle} style={{ marginBottom: 24 }}>
          <Typography variant="h6" gutterBottom>
            {vehicle.toUpperCase()}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Base Fare"
                type="number"
                value={pricing[vehicle]?.baseFare ?? ''}
                onChange={e => handleChange(vehicle, 'baseFare', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Price per Km"
                type="number"
                value={pricing[vehicle]?.pricePerKm ?? ''}
                onChange={e => handleChange(vehicle, 'pricePerKm', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Price per Minute"
                type="number"
                value={pricing[vehicle]?.pricePerMinute ?? ''}
                onChange={e => handleChange(vehicle, 'pricePerMinute', e.target.value)}
              />
            </Grid>
          </Grid>
        </div>
      ))}

      <Button
        variant="contained"
        color="primary"
        onClick={handleSave}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save Changes'}
      </Button>
    </Paper>
  );
};

export default Settings;
