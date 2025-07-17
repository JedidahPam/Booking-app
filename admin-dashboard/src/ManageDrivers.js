// src/ManageDrivers.js
import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function ManageDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [editForm, setEditForm] = useState({ firstname: '', lastname: '', phone: '', email: '' });

  // Fetch drivers on mount
  useEffect(() => {
    const fetchDrivers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'driver'));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDrivers(list);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDrivers();
  }, []);

  const approveDriver = async (id) => {
    await updateDoc(doc(db, 'users', id), { approved: true });
    setDrivers(drivers.map(d => (d.id === id ? { ...d, approved: true } : d)));
  };

  const rejectDriver = async (id) => {
    await updateDoc(doc(db, 'users', id), { approved: false });
    setDrivers(drivers.map(d => (d.id === id ? { ...d, approved: false } : d)));
  };

  const startEditing = (driver) => {
    setEditingDriverId(driver.id);
    setEditForm({
      firstname: driver.firstname || '',
      lastname: driver.lastname || '',
      phone: driver.phone || '',
      email: driver.email || '',
    });
  };

  const cancelEditing = () => {
    setEditingDriverId(null);
    setEditForm({ firstname: '', lastname: '', phone: '', email: '' });
  };

  const saveProfile = async () => {
    try {
      await updateDoc(doc(db, 'users', editingDriverId), {
        firstname: editForm.firstname,
        lastname: editForm.lastname,
        phone: editForm.phone,
        email: editForm.email,
      });
      setDrivers(drivers.map(d => (d.id === editingDriverId ? { ...d, ...editForm } : d)));
      cancelEditing();
    } catch (error) {
      alert('Failed to update profile');
      console.error(error);
    }
  };

  const getFullName = (driver) => {
    const first = driver.firstname || '';
    const last = driver.lastname || '';
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  if (loading) return <p>Loading drivers...</p>;

  return (
    <div>
      <h2>Manage Drivers</h2>
      {drivers.length === 0 ? (
        <p>No drivers found.</p>
      ) : (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Full Name</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Approved</th>
              <th>Documents</th>
              <th>Ratings / Feedback</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(driver => (
              <tr key={driver.id}>
                <td>{getFullName(driver)}</td>
                {editingDriverId === driver.id ? (
                  <>
                    <td>
                      <input
                        type="text"
                        value={editForm.firstname}
                        onChange={e => setEditForm({ ...editForm, firstname: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.lastname}
                        onChange={e => setEditForm({ ...editForm, lastname: e.target.value })}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td>{driver.firstname || 'N/A'}</td>
                    <td>{driver.lastname || 'N/A'}</td>
                  </>
                )}
                <td>
                  {editingDriverId === driver.id ? (
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  ) : (
                    driver.phone || 'N/A'
                  )}
                </td>
                <td>
                  {editingDriverId === driver.id ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  ) : (
                    driver.email || 'N/A'
                  )}
                </td>
                <td>{driver.approved ? 'Yes' : 'No'}</td>
                <td>
                  <div>
                    <strong>License:</strong>{' '}
                    {driver.driverLicense ? (
                      <a href={driver.driverLicense} target="_blank" rel="noreferrer">View</a>
                    ) : 'No Document'}
                  </div>
                  <div>
                    <strong>Insurance:</strong>{' '}
                    {driver.insurance ? (
                      <a href={driver.insurance} target="_blank" rel="noreferrer">View</a>
                    ) : 'No Document'}
                  </div>
                  <div>
                    <strong>Vehicle Registration:</strong>{' '}
                    {driver.vehicleRegistration ? (
                      <a href={driver.vehicleRegistration} target="_blank" rel="noreferrer">View</a>
                    ) : 'No Document'}
                  </div>
                </td>
                <td>
                  {driver.ratings?.length ? (
                    <ul style={{ maxHeight: 100, overflowY: 'auto' }}>
                      {driver.ratings.map((r, i) => (
                        <li key={i}>
                          ⭐ {r.score} - {r.comment || 'No comment'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <em>No ratings</em>
                  )}
                </td>
                <td>
                  {editingDriverId === driver.id ? (
                    <>
                      <button onClick={saveProfile}>Save</button>{' '}
                      <button onClick={cancelEditing}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {!driver.approved ? (
                        <>
                          <button onClick={() => approveDriver(driver.id)}>Approve</button>{' '}
                          <button onClick={() => rejectDriver(driver.id)}>Reject</button>{' '}
                        </>
                      ) : (
                        <button onClick={() => rejectDriver(driver.id)}>Reject</button>
                      )}
                      <button onClick={() => startEditing(driver)}>Edit Profile</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
