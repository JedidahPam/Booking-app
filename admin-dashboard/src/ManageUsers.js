import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const userList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(userList);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const toggleBlockUser = async (userId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      });
      setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: !currentStatus } : u));
    } catch (error) {
      console.error('Failed to update block status', error);
    }
  };

  // Helper to get full name from firstname and lastname
  const getFullName = (user) => {
    const first = user.firstname || '';
    const last = user.lastname || '';
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div>
      <h2>Manage Users</h2>
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{getFullName(user)}</td>
                <td>{user.email || 'N/A'}</td>
                <td>{user.phone || 'N/A'}</td>
                <td>{user.isBlocked ? 'Blocked' : 'Active'}</td>
                <td>
                  <button onClick={() => toggleBlockUser(user.id, user.isBlocked)}>
                    {user.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
