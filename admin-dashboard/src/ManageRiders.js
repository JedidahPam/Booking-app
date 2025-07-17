// src/ManageRiders.js
import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function ManageRiders() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRiderId, setEditingRiderId] = useState(null);
  const [editForm, setEditForm] = useState({ firstname: '', lastname: '', phone: '', email: '' });

  // Fetch riders on mount
  useEffect(() => {
    const fetchRiders = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'rider'));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRiders(list);
      } catch (error) {
        console.error('Error fetching riders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRiders();
  }, []);

  const approveRider = async (id) => {
    await updateDoc(doc(db, 'users', id), { approved: true });
    setRiders(riders.map(r => (r.id === id ? { ...r, approved: true } : r)));
  };

  const rejectRider = async (id) => {
    await updateDoc(doc(db, 'users', id), { approved: false });
    setRiders(riders.map(r => (r.id === id ? { ...r, approved: false } : r)));
  };

  const startEditing = (rider) => {
    setEditingRiderId(rider.id);
    setEditForm({
      firstname: rider.firstname || '',
      lastname: rider.lastname || '',
      phone: rider.phone || '',
      email: rider.email || '',
    });
  };

  const cancelEditing = () => {
    setEditingRiderId(null);
    setEditForm({ firstname: '', lastname: '', phone: '', email: '' });
  };

  const saveProfile = async () => {
    try {
      await updateDoc(doc(db, 'users', editingRiderId), {
        firstname: editForm.firstname,
        lastname: editForm.lastname,
        phone: editForm.phone,
        email: editForm.email,
      });
      setRiders(riders.map(r => (r.id === editingRiderId ? { ...r, ...editForm } : r)));
      cancelEditing();
    } catch (error) {
      alert('Failed to update profile');
      console.error(error);
    }
  };

  const getFullName = (rider) => {
    const first = rider.firstname || '';
    const last = rider.lastname || '';
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  if (loading) return <p>Loading riders...</p>;

  return (
    <div>
      <h2>Manage Riders</h2>
      {riders.length === 0 ? (
        <p>No riders found.</p>
      ) : (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Approved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {riders.map(rider => (
              <tr key={rider.id}>
                <td>{getFullName(rider)}</td>
                {editingRiderId === rider.id ? (
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
                    <td>{rider.firstname || 'N/A'}</td>
                    <td>{rider.lastname || 'N/A'}</td>
                  </>
                )}
                <td>
                  {editingRiderId === rider.id ? (
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  ) : (
                    rider.phone || 'N/A'
                  )}
                </td>
                <td>
                  {editingRiderId === rider.id ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  ) : (
                    rider.email || 'N/A'
                  )}
                </td>
                <td>{rider.approved ? 'Yes' : 'No'}</td>
                <td>
                  {editingRiderId === rider.id ? (
                    <>
                      <button onClick={saveProfile}>Save</button>{' '}
                      <button onClick={cancelEditing}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {!rider.approved ? (
                        <>
                          <button onClick={() => approveRider(rider.id)}>Approve</button>{' '}
                          <button onClick={() => rejectRider(rider.id)}>Reject</button>{' '}
                        </>
                      ) : (
                        <button onClick={() => rejectRider(rider.id)}>Reject</button>
                      )}
                      <button onClick={() => startEditing(rider)}>Edit Profile</button>
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
