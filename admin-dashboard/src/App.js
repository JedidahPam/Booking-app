import React, { useState } from 'react';
import { auth, signOut } from './firebase';
import Login from './Login';
import ViewTrips from './ViewTrips';
import ManageDrivers from './ManageDrivers';
import ManageRiders from './ManageRiders';
import RideAnalytics from './RideAnalytics';
import ManageUsers from './ManageUsers';
import Settings from './Settings';

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
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontWeight: '700', fontSize: '1.8rem' }}>Welcome Admin 🚀</h1>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div style={styles.main}>
        <nav style={styles.sidebar}>
          <NavButton
            label="Manage Drivers"
            active={page === 'drivers'}
            onClick={() => setPage('drivers')}
          />
          <NavButton
            label="Manage Riders"
            active={page === 'riders'}
            onClick={() => setPage('riders')}
          />
          <NavButton
            label="View All Trips"
            active={page === 'trips'}
            onClick={() => setPage('trips')}
          />
          <NavButton
            label="Manage Users"
            active={page === 'users'}
            onClick={() => setPage('users')}
          />
          <NavButton
            label="Ride Analytics"
            active={page === 'analytics'}
            onClick={() => setPage('analytics')}
          />
          <NavButton
            label="Settings"
            active={page === 'settings'}
            onClick={() => setPage('settings')}
          />

        </nav>

        <section style={styles.content}>
          {page === 'drivers' && <ManageDrivers />}
          {page === 'riders' && <ManageRiders />}
          {page === 'trips' && <ViewTrips />}
          {page === 'users' && <ManageUsers />}
          {page === 'analytics' && <RideAnalytics />}
          {page === 'settings' && <Settings />}
        </section>
      </div>
    </div>
  );
}

function NavButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      style={{
        ...styles.navButton,
        ...(active ? styles.navButtonActive : {}),
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f7f9fc',
    color: '#222',
  },
  header: {
    padding: '1rem 2rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#e74c3c',
    border: 'none',
    borderRadius: 4,
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  main: {
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 220,
    backgroundColor: '#2c3e50',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
  },
  navButton: {
    padding: '0.75rem 1rem',
    marginBottom: '0.75rem',
    border: 'none',
    borderRadius: 4,
    backgroundColor: '#34495e',
    color: '#ecf0f1',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  navButtonActive: {
    backgroundColor: '#1abc9c',
    cursor: 'default',
    color: '#fff',
  },
  content: {
    flexGrow: 1,
    padding: '1.5rem 2rem',
    overflowY: 'auto',
    backgroundColor: '#fff',
    boxShadow: 'inset 0 0 10px rgb(0 0 0 / 0.05)',
  },
};
