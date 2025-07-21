import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ManageRiders() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRiderId, setEditingRiderId] = useState(null);
  const [editForm, setEditForm] = useState({ firstname: '', lastname: '', phone: '', email: '' });

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

  const deleteProfile = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setRiders(riders.filter(r => r.id !== id));
    } catch (error) {
      alert('Failed to delete profile');
      console.error(error);
    }
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
    const fullName = `${rider.firstname || ''} ${rider.lastname || ''}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  // --- Export functions ---

  const exportToCSV = () => {
    if (!riders.length) return;

    const headers = ['Full Name', 'First Name', 'Last Name', 'Phone', 'Email'];

    const rows = riders.map(r => [
      getFullName(r),
      r.firstname || 'N/A',
      r.lastname || 'N/A',
      r.phone || 'N/A',
      r.email || 'N/A',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'riders_export.csv');
  };

  const exportToXLSX = () => {
    if (!riders.length) return;

    const data = riders.map(r => ({
      'Full Name': getFullName(r),
      'First Name': r.firstname || 'N/A',
      'Last Name': r.lastname || 'N/A',
      Phone: r.phone || 'N/A',
      Email: r.email || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riders');
    XLSX.writeFile(workbook, 'riders_export.xlsx');
  };

  const exportToPDF = () => {
    if (!riders.length) return;

    const doc = new jsPDF();

    const tableColumn = ['Full Name', 'First Name', 'Last Name', 'Phone', 'Email'];
    const tableRows = riders.map(r => [
      getFullName(r),
      r.firstname || 'N/A',
      r.lastname || 'N/A',
      r.phone || 'N/A',
      r.email || 'N/A',
    ]);

    doc.text('Riders Export', 14, 15);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save('riders_export.pdf');
  };

  if (loading) return <p style={{ fontFamily: 'sans-serif' }}>Loading riders...</p>;

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <h2 style={{ marginBottom: '1rem', color: '#333' }}>Manage Riders</h2>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={exportToCSV} style={btnExport}>Export to CSV</button>{' '}
        <button onClick={exportToXLSX} style={btnExport}>Export to XLSX</button>{' '}
        <button onClick={exportToPDF} style={btnExport}>Export to PDF</button>
      </div>

      {riders.length === 0 ? (
        <p>No riders found.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <thead style={{ backgroundColor: '#f1f1f1' }}>
            <tr>
              <th style={thStyle}>Full Name</th>
              <th style={thStyle}>First Name</th>
              <th style={thStyle}>Last Name</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((rider) => (
              <tr key={rider.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{getFullName(rider)}</td>
                {editingRiderId === rider.id ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={editForm.firstname}
                        onChange={e => setEditForm({ ...editForm, firstname: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={editForm.lastname}
                        onChange={e => setEditForm({ ...editForm, lastname: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{rider.firstname || 'N/A'}</td>
                    <td style={tdStyle}>{rider.lastname || 'N/A'}</td>
                  </>
                )}
                <td style={tdStyle}>
                  {editingRiderId === rider.id ? (
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      style={inputStyle}
                    />
                  ) : (
                    rider.phone || 'N/A'
                  )}
                </td>
                <td style={tdStyle}>
                  {editingRiderId === rider.id ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      style={inputStyle}
                    />
                  ) : (
                    rider.email || 'N/A'
                  )}
                </td>
                <td style={tdStyle}>
                  {editingRiderId === rider.id ? (
                    <>
                      <button style={btnSave} onClick={saveProfile}>Save</button>
                      <button style={btnCancel} onClick={cancelEditing}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button style={btnEdit} onClick={() => startEditing(rider)}>Edit</button>
                      <button
                        style={btnDelete}
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this rider?')) {
                            deleteProfile(rider.id);
                          }
                        }}
                      >
                        Delete
                      </button>
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

const inputStyle = {
  padding: '6px 8px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  width: '100%',
};

const btnEdit = {
  padding: '5px 10px',
  marginRight: '5px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const btnSave = {
  ...btnEdit,
  backgroundColor: '#28a745',
};

const btnCancel = {
  ...btnEdit,
  backgroundColor: '#6c757d',
};

const btnDelete = {
  ...btnEdit,
  backgroundColor: '#dc3545',
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
