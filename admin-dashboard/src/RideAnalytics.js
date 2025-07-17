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
  ArcElement
} from 'chart.js';

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

  // Total rides
  const totalRides = rides.length;

  // Total earnings (sum of finalFare)
  const totalEarnings = rides.reduce((sum, ride) => sum + (ride.finalFare || 0), 0).toFixed(2);

  // Count rides by status for pie chart
  const statusCounts = rides.reduce((acc, ride) => {
    const status = ride.status || 'unknown';
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

  // Rides per day (for bar chart)
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

  return (
    <div>
      <h2>Ride Analytics</h2>

      {loading ? (
        <p>Loading analytics...</p>
      ) : (
        <>
          <p><strong>Total Rides:</strong> {totalRides}</p>
          <p><strong>Total Earnings:</strong> ${totalEarnings}</p>

          <div style={{ maxWidth: 600, marginBottom: 40 }}>
            <Pie data={pieData} />
          </div>

          <div style={{ maxWidth: 600 }}>
            <Bar data={barData} />
          </div>
        </>
      )}
    </div>
  );
}
