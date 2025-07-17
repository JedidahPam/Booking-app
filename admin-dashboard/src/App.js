import React, { useState } from 'react';
import { auth, signOut } from './firebase';
import Login from './Login';
import ViewTrips from './ViewTrips';
import ManageDrivers from './ManageDrivers';
import ManageRiders from './ManageRiders';  // ← Import ManageRiders
import RideAnalytics from './RideAnalytics';
import ManageUsers from './ManageUsers';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [page, setPage] = useState('trips');

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
  };

  if (!isAdmin) {
    return <Login onLoginSuccess={() => setIsAdmin(true)} />;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome Admin 🚀</h1>
      <button onClick={handleLogout}>Logout</button>
      <nav style={{ margin: '1rem 0' }}>
        <button
          onClick={() => setPage('drivers')}
          disabled={page === 'drivers'}
          style={{ marginRight: 10 }}
        >
          Manage Drivers
        </button>

        <button
          onClick={() => setPage('riders')}
          disabled={page === 'riders'}
          style={{ marginRight: 10 }}
        >
          Manage Riders
        </button>

        <button
          onClick={() => setPage('trips')}
          disabled={page === 'trips'}
          style={{ marginRight: 10 }}
        >
          View All Trips
        </button>

        <button
          onClick={() => setPage('users')}
          disabled={page === 'users'}
          style={{ marginRight: 10 }}
        >
          Manage Users
        </button>

        <button
          onClick={() => setPage('analytics')}
          disabled={page === 'analytics'}
        >
          Ride Analytics
        </button>
      </nav>

      {page === 'drivers' && <ManageDrivers />}
      {page === 'riders' && <ManageRiders />}
      {page === 'trips' && <ViewTrips />}
      {page === 'users' && <ManageUsers />}
      {page === 'analytics' && <RideAnalytics />}
    </div>
  );
}
