import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { saveAs } from 'file-saver';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ViewTrips() {
  const [rides, setRides] = useState([]);
  const [filteredRides, setFilteredRides] = useState([]);
  const [loading, setLoading] = useState(true);

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

        const ridesList = querySnapshot.docs.map((doc) => {
          const rideData = doc.data();
          const rideId = doc.id;

          return {
            id: rideId,
            ...rideData,
            // Extract addresses directly from the document fields
            pickupAddress: rideData.pickup?.address || 'N/A',
            dropoffAddress: rideData.dropoff?.address || 'N/A',
            // Extract coordinates if needed
            pickupLatitude: rideData.pickup?.latitude || null,
            pickupLongitude: rideData.pickup?.longitude || null,
            dropoffLatitude: rideData.dropoff?.latitude || null,
            dropoffLongitude: rideData.dropoff?.longitude || null,
            // Extract timestamp - it can be a string or Firestore Timestamp
            timestamp: rideData.timestamp || null,
          };
        });

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

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // If it's a string (ISO format)
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    
    // If it's a Firestore Timestamp object
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    
    return 'N/A';
  };

  // Helper function to get Date object from timestamp for filtering
  const getDateFromTimestamp = (timestamp) => {
    if (!timestamp) return null;
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    
    return null;
  };

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
        // Check both timestamp and createdAt for date filtering
        const rideDate = getDateFromTimestamp(ride.timestamp) || 
                         (ride.createdAt?.seconds ? new Date(ride.createdAt.seconds * 1000) : null);
        return rideDate && rideDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(ride => {
        // Check both timestamp and createdAt for date filtering
        const rideDate = getDateFromTimestamp(ride.timestamp) || 
                         (ride.createdAt?.seconds ? new Date(ride.createdAt.seconds * 1000) : null);
        return rideDate && rideDate <= end;
      });
    }

    if (addressSearch.trim() !== '') {
      const search = addressSearch.toLowerCase();
      filtered = filtered.filter(ride => {
        return (
          ride.pickupAddress.toLowerCase().includes(search) ||
          ride.dropoffAddress.toLowerCase().includes(search)
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
      'Distance',
      'Payment Method',
      'Timestamp',
      'Created At',
    ];

    const rows = filteredRides.map(ride => [
      ride.pickupAddress,
      ride.dropoffAddress,
      ride.status || 'N/A',
      ride.price?.toFixed(2) || ride.finalFare?.toFixed(2) || '0.00',
      ride.acceptedBy || 'N/A',
      ride.distance || 'N/A',
      ride.paymentMethod || 'N/A',
      formatTimestamp(ride.timestamp),
      ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleString()
        : 'N/A',
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'trips_export.csv');
  };

  const exportToXLSX = () => {
    if (!filteredRides.length) return;

    const data = filteredRides.map(ride => ({
      'Pickup Address': ride.pickupAddress,
      'Dropoff Address': ride.dropoffAddress,
      Status: ride.status || 'N/A',
      Fare: ride.price?.toFixed(2) || ride.finalFare?.toFixed(2) || '0.00',
      'Driver ID': ride.acceptedBy || 'N/A',
      Distance: ride.distance || 'N/A',
      'Payment Method': ride.paymentMethod || 'N/A',
      'Timestamp': formatTimestamp(ride.timestamp),
      'Created At': ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleString()
        : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trips');
    XLSX.writeFile(workbook, 'trips_export.xlsx');
  };

  const exportToPDF = () => {
    if (!filteredRides.length) return;

    const doc = new jsPDF();

    const tableColumn = [
      'Pickup Address',
      'Dropoff Address',
      'Status',
      'Fare',
      'Driver ID',
      'Distance',
      'Payment Method',
      'Timestamp',
      'Created At',
    ];

    const tableRows = filteredRides.map(ride => [
      ride.pickupAddress,
      ride.dropoffAddress,
      ride.status || 'N/A',
      ride.price?.toFixed(2) || ride.finalFare?.toFixed(2) || '0.00',
      ride.acceptedBy || 'N/A',
      ride.distance || 'N/A',
      ride.paymentMethod || 'N/A',
      formatTimestamp(ride.timestamp),
      ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleString()
        : 'N/A',
    ]);

    doc.text('Trips Export', 14, 15);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save('trips_export.pdf');
  };

  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f8f9fa',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      minHeight: '100vh',
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>View All Trips</h2>

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <label style={labelStyle}>
          Status:{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <label style={labelStyle}>
          Start Date:{' '}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          End Date:{' '}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <label style={labelStyle}>
          Driver ID or Name:{' '}
          <input
            type="text"
            placeholder="Search driver..."
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Pickup/Dropoff Address:{' '}
          <input
            type="text"
            placeholder="Search address..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={exportToCSV} style={btnExport}>Export to CSV</button>{' '}
        <button onClick={exportToXLSX} style={btnExport}>Export to XLSX</button>{' '}
        <button onClick={exportToPDF} style={btnExport}>Export to PDF</button>
      </div>

      {loading ? (
        <p>Loading trips...</p>
      ) : filteredRides.length === 0 ? (
        <p>No trips found.</p>
      ) : (
        <table style={tableStyle}>
          <thead style={{ backgroundColor: '#f1f1f1' }}>
            <tr>
              <th style={thStyle}>Pickup</th>
              <th style={thStyle}>Dropoff</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Fare</th>
              <th style={thStyle}>Distance</th>
              <th style={thStyle}>Payment</th>
              <th style={thStyle}>Accepted By</th>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredRides.map((ride) => (
              <tr key={ride.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{ride.pickupAddress}</td>
                <td style={tdStyle}>{ride.dropoffAddress}</td>
                <td style={tdStyle}>{ride.status || 'N/A'}</td>
                <td style={tdStyle}>${ride.price?.toFixed(2) || ride.finalFare?.toFixed(2) || '0.00'}</td>
                <td style={tdStyle}>{ride.distance || 'N/A'}</td>
                <td style={tdStyle}>{ride.paymentMethod || 'N/A'}</td>
                <td style={tdStyle}>{ride.acceptedBy || 'N/A'}</td>
                <td style={tdStyle}>{formatTimestamp(ride.timestamp)}</td>
                <td style={tdStyle}>
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

// --- Reused styles ---
const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  fontWeight: 'bold',
  color: '#333',
};

const inputStyle = {
  marginLeft: '8px',
  padding: '6px 8px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  minWidth: '180px',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
};

const btnExport = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '1rem',
  marginBottom: '1rem',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#fff',
  borderRadius: '8px',
  overflow: 'hidden',
};

const thStyle = {
  padding: '10px',
  textAlign: 'left',
  color: '#333',
  fontWeight: 'bold',
  borderBottom: '1px solid #ddd',
};

const tdStyle = {
  padding: '10px',
  verticalAlign: 'middle',
};