// src/RideAnalytics.js
import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function RideAnalytics() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'rides'));
        const querySnapshot = await getDocs(q);
        const ridesList = querySnapshot.docs.map(doc => doc.data());
        setRides(ridesList);
      } catch (error) {
        console.error('Error fetching rides:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  const totalRides = rides.length;
  const totalEarnings = rides.reduce((sum, ride) => sum + (ride.finalFare || 0), 0).toFixed(2);

  const statusCounts = rides.reduce((acc, ride) => {
    const status = ride.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pieData = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        label: '# of Rides',
        data: Object.values(statusCounts),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#66BB6A', '#BA68C8'],
        hoverOffset: 4,
      },
    ],
  };

  const ridesByDay = rides.reduce((acc, ride) => {
    const date = ride.createdAt?.seconds
      ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString()
      : 'Unknown';
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const barData = {
    labels: Object.keys(ridesByDay),
    datasets: [
      {
        label: 'Rides Per Day',
        data: Object.values(ridesByDay),
        backgroundColor: '#42A5F5',
      },
    ],
  };

  // --- Export Functions ---

  const exportToCSV = () => {
    if (!rides.length) return;

    const headers = ['Created Date', 'Status', 'Final Fare'];

    const rows = rides.map(ride => {
      const date = ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString()
        : 'Unknown';
      return [
        date,
        ride.status || 'Unknown',
        ride.finalFare != null ? ride.finalFare.toFixed(2) : '0.00',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'rides_export.csv');
  };

  const exportToXLSX = () => {
    if (!rides.length) return;

    const data = rides.map(ride => ({
      'Created Date': ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString()
        : 'Unknown',
      Status: ride.status || 'Unknown',
      'Final Fare': ride.finalFare != null ? ride.finalFare.toFixed(2) : '0.00',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rides');
    XLSX.writeFile(workbook, 'rides_export.xlsx');
  };

  const exportToPDF = () => {
    if (!rides.length) return;

    const doc = new jsPDF();

    const tableColumn = ['Created Date', 'Status', 'Final Fare'];
    const tableRows = rides.map(ride => [
      ride.createdAt?.seconds
        ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString()
        : 'Unknown',
      ride.status || 'Unknown',
      ride.finalFare != null ? ride.finalFare.toFixed(2) : '0.00',
    ]);

    doc.text('Rides Export', 14, 15);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save('rides_export.pdf');
  };

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minHeight: '100vh',
      }}
    >
      <h2 style={{ marginBottom: '1rem', color: '#333' }}>Ride Analytics</h2>

      {loading ? (
        <p style={{ fontFamily: 'sans-serif' }}>Loading analytics...</p>
      ) : (
        <>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Total Rides:</strong> {totalRides}
          </p>
          <p style={{ marginBottom: '2rem' }}>
            <strong>Total Earnings:</strong> ${totalEarnings}
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <button onClick={exportToCSV} style={btnExport}>
              Export to CSV
            </button>{' '}
            <button onClick={exportToXLSX} style={btnExport}>
              Export to XLSX
            </button>{' '}
            <button onClick={exportToPDF} style={btnExport}>
              Export to PDF
            </button>
          </div>

          <div style={{ maxWidth: '600px', marginBottom: '3rem' }}>
            <Pie data={pieData} />
          </div>

          <div style={{ maxWidth: '600px' }}>
            <Bar data={barData} />
          </div>
        </>
      )}
    </div>
  );
}

const btnExport = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '1rem',
};
