import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const userList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
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
        isBlocked: !currentStatus,
      });
      setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: !currentStatus } : u));
    } catch (error) {
      console.error('Failed to update block status', error);
    }
  };

  const getFullName = (user) => {
    const first = user.firstname || '';
    const last = user.lastname || '';
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  const filteredUsers = users.filter(user => {
    const fullName = getFullName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return fullName.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  // --- Export Functions ---

  const exportToCSV = () => {
    if (!users.length) return;

    const headers = ['Full Name', 'Email', 'Phone', 'Status'];

    const rows = users.map(u => [
      getFullName(u),
      u.email || 'N/A',
      u.phone || 'N/A',
      u.isBlocked ? 'Blocked' : 'Active',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'users_export.csv');
  };

  const exportToXLSX = () => {
    if (!users.length) return;

    const data = users.map(u => ({
      'Full Name': getFullName(u),
      Email: u.email || 'N/A',
      Phone: u.phone || 'N/A',
      Status: u.isBlocked ? 'Blocked' : 'Active',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, 'users_export.xlsx');
  };

  const exportToPDF = () => {
    if (!users.length) return;

    const doc = new jsPDF();

    const tableColumn = ['Full Name', 'Email', 'Phone', 'Status'];
    const tableRows = users.map(u => [
      getFullName(u),
      u.email || 'N/A',
      u.phone || 'N/A',
      u.isBlocked ? 'Blocked' : 'Active',
    ]);

    doc.text('Users Export', 14, 15);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save('users_export.pdf');
  };

  if (loading) return <p style={{ fontFamily: 'sans-serif' }}>Loading users...</p>;

  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f8f9fa',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      minHeight: '100vh',
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Manage Users</h2>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          width: '100%',
          maxWidth: '400px',
          marginBottom: '1.5rem',
        }}
      />

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={exportToCSV} style={btnExport}>Export to CSV</button>{' '}
        <button onClick={exportToXLSX} style={btnExport}>Export to XLSX</button>{' '}
        <button onClick={exportToPDF} style={btnExport}>Export to PDF</button>
      </div>

      {filteredUsers.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <thead style={{ backgroundColor: '#f1f1f1' }}>
            <tr>
              <th style={thStyle}>Full Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{getFullName(user)}</td>
                <td style={tdStyle}>{user.email || 'N/A'}</td>
                <td style={tdStyle}>{user.phone || 'N/A'}</td>
                <td style={tdStyle}>{user.isBlocked ? 'Blocked' : 'Active'}</td>
                <td style={tdStyle}>
                  <button
                    style={user.isBlocked ? btnUnblock : btnBlock}
                    onClick={() => toggleBlockUser(user.id, user.isBlocked)}
                  >
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

// --- Inline styles reused from ManageRiders.js for consistency ---
const thStyle = {
  padding: '10px',
  textAlign: 'left',
  color: '#333',
  fontWeight: 'bold',
};

const tdStyle = {
  padding: '10px',
  verticalAlign: 'middle',
};

const btnBlock = {
  padding: '5px 10px',
  backgroundColor: '#dc3545',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const btnUnblock = {
  ...btnBlock,
  backgroundColor: '#28a745',
};

const btnExport = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '1rem',
};
