import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { saveAs } from 'file-saver';

export default function ViewTrips() {
  const [rides, setRides] = useState([]);
  const [filteredRides, setFilteredRides] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [addressSearch, setAddressSearch] = useState('');

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'rides'));
        const querySnapshot = await getDocs(q);
        const ridesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRides(ridesList);
        setFilteredRides(ridesList);
      } catch (error) {
        console.error('Error fetching rides:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  useEffect(() => {
    let filtered = [...rides];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ride => ride.status === statusFilter);
    }

    if (driverFilter.trim() !== '') {
      filtered = filtered.filter(ride =>
        (ride.acceptedBy || '').toLowerCase().includes(driverFilter.toLowerCase())
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(ride => {
        const rideDate = ride.createdAt?.seconds
          ? new Date(ride.createdAt.seconds * 1000)
          : null;
        return rideDate && rideDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(ride => {
        const rideDate = ride.createdAt?.seconds
          ? new Date(ride.createdAt.seconds * 1000)
          : null;
        return rideDate && rideDate <= end;
      });
    }

    if (addressSearch.trim() !== '') {
      const search = addressSearch.toLowerCase();
      filtered = filtered.filter(ride => {
        const pickup = ride.pickupLocation?.address || '';
        const dropoff = ride.dropoffLocation?.address || '';
        return (
          pickup.toLowerCase().includes(search) ||
          dropoff.toLowerCase().includes(search)
        );
      });
    }

    setFilteredRides(filtered);
  }, [rides, statusFilter, driverFilter, startDate, endDate, addressSearch]);

  const exportToCSV = () => {
    if (!filteredRides.length) return;

    const headers = [
      'Pickup Address',
      'Dropoff Address',
      'Status',
      'Fare',
      'Driver ID',
      'Created At',
    ];

    const rows = filteredRides.map(ride => [
      `"${ride.pickupLocation?.address || 'N/A'}"`,
      `"${ride.dropoffLocation?.address || 'N/A'}"`,
      `"${ride.status || 'N/A'}"`,
      `"${ride.finalFare?.toFixed(2) || '0.00'}"`,
      `"${ride.acceptedBy || 'N/A'}"`,
      `"${ride.createdAt?.seconds ? new Date(ride.createdAt.seconds * 1000).toLocaleString() : 'N/A'}"`,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'trips_export.csv');
  };

  return (
    <div>
      <h2>View All Trips</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <label style={{ marginLeft: 20 }}>
          Start Date:{' '}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label style={{ marginLeft: 20 }}>
          End Date:{' '}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Driver ID or Name:{' '}
          <input
            type="text"
            placeholder="Search driver..."
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
          />
        </label>

        <label style={{ marginLeft: 20 }}>
          Pickup/Dropoff Address:{' '}
          <input
            type="text"
            placeholder="Search address..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
          />
        </label>
      </div>

      <button onClick={exportToCSV} style={{ marginBottom: 15 }}>
        Export to CSV
      </button>

      {loading ? (
        <p>Loading trips...</p>
      ) : filteredRides.length === 0 ? (
        <p>No trips found.</p>
      ) : (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Status</th>
              <th>Fare</th>
              <th>Accepted By</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredRides.map((ride) => (
              <tr key={ride.id}>
                <td>{ride.pickupLocation?.address || 'N/A'}</td>
                <td>{ride.dropoffLocation?.address || 'N/A'}</td>
                <td>{ride.status || 'N/A'}</td>
                <td>${ride.finalFare?.toFixed(2) || '0.00'}</td>
                <td>{ride.acceptedBy || 'N/A'}</td>
                <td>
                  {ride.createdAt?.seconds
                    ? new Date(ride.createdAt.seconds * 1000).toLocaleString()
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
