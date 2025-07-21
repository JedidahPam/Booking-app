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

export default function ManageDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [editForm, setEditForm] = useState({ firstname: '', lastname: '', phone: '', email: '' });

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
      await updateDoc(doc(db, 'users', editingDriverId), editForm);
      setDrivers(drivers.map(d => (d.id === editingDriverId ? { ...d, ...editForm } : d)));
      cancelEditing();
    } catch (error) {
      alert('Failed to update profile');
      console.error(error);
    }
  };

  const deleteDriver = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this driver?');
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setDrivers(drivers.filter(d => d.id !== id));
    } catch (error) {
      alert('Failed to delete driver.');
      console.error('Delete error:', error);
    }
  };

  const getFullName = (driver) => {
    const first = driver.firstname || '';
    const last = driver.lastname || '';
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'N/A';
  };

  const filteredDrivers = drivers.filter(driver =>
    getFullName(driver).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (driver.phone || '').includes(searchTerm) ||
    (driver.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Export functions ---

  // CSV export
  const exportToCSV = () => {
    if (!filteredDrivers.length) return;

    const headers = [
      'Full Name',
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Approved',
      'Driver License URL',
      'Insurance URL',
      'Vehicle Registration URL',
      'Ratings Count'
    ];

    const rows = filteredDrivers.map(d => [
      getFullName(d),
      d.firstname || 'N/A',
      d.lastname || 'N/A',
      d.phone || 'N/A',
      d.email || 'N/A',
      d.approved ? 'Yes' : 'No',
      d.driverLicense || 'N/A',
      d.insurance || 'N/A',
      d.vehicleRegistration || 'N/A',
      d.ratings?.length || 0,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'drivers_export.csv');
  };

  // XLSX export
  const exportToXLSX = () => {
    if (!filteredDrivers.length) return;

    const data = filteredDrivers.map(d => ({
      'Full Name': getFullName(d),
      'First Name': d.firstname || 'N/A',
      'Last Name': d.lastname || 'N/A',
      Phone: d.phone || 'N/A',
      Email: d.email || 'N/A',
      Approved: d.approved ? 'Yes' : 'No',
      'Driver License URL': d.driverLicense || 'N/A',
      'Insurance URL': d.insurance || 'N/A',
      'Vehicle Registration URL': d.vehicleRegistration || 'N/A',
      'Ratings Count': d.ratings?.length || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Drivers');
    XLSX.writeFile(workbook, 'drivers_export.xlsx');
  };

  // PDF export
  const exportToPDF = () => {
    if (!filteredDrivers.length) return;

    const doc = new jsPDF();

    const tableColumn = [
      'Full Name',
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Approved',
      'Driver License URL',
      'Insurance URL',
      'Vehicle Registration URL',
      'Ratings Count',
    ];

    const tableRows = filteredDrivers.map(d => [
      getFullName(d),
      d.firstname || 'N/A',
      d.lastname || 'N/A',
      d.phone || 'N/A',
      d.email || 'N/A',
      d.approved ? 'Yes' : 'No',
      d.driverLicense || 'N/A',
      d.insurance || 'N/A',
      d.vehicleRegistration || 'N/A',
      d.ratings?.length || 0,
    ]);

    doc.text('Drivers Export', 14, 15);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [0, 123, 255] },
      columnStyles: { 6: { cellWidth: 'wrap' }, 7: { cellWidth: 'wrap' }, 8: { cellWidth: 'wrap' } },
    });

    doc.save('drivers_export.pdf');
  };

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
      <h2 style={{ marginBottom: '1rem', color: '#333' }}>Manage Drivers</h2>

      <input
        type="text"
        placeholder="Search by name, phone or email..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{
          padding: '10px',
          width: '100%',
          marginBottom: '20px',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}
      />

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={exportToCSV} style={btnExport}>Export to CSV</button>{' '}
        <button onClick={exportToXLSX} style={btnExport}>Export to XLSX</button>{' '}
        <button onClick={exportToPDF} style={btnExport}>Export to PDF</button>
      </div>

      {loading ? (
        <p>Loading drivers...</p>
      ) : filteredDrivers.length === 0 ? (
        <p>No drivers found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
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
                <th style={thStyle}>Approved</th>
                <th style={thStyle}>Documents</th>
                <th style={thStyle}>Ratings</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map(driver => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={tdStyle}>{getFullName(driver)}</td>
                  {editingDriverId === driver.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          value={editForm.firstname}
                          onChange={e => setEditForm({ ...editForm, firstname: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          value={editForm.lastname}
                          onChange={e => setEditForm({ ...editForm, lastname: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{driver.firstname || 'N/A'}</td>
                      <td style={tdStyle}>{driver.lastname || 'N/A'}</td>
                    </>
                  )}
                  <td style={tdStyle}>
                    {editingDriverId === driver.id ? (
                      <input
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        style={inputStyle}
                      />
                    ) : (
                      driver.phone || 'N/A'
                    )}
                  </td>
                  <td style={tdStyle}>
                    {editingDriverId === driver.id ? (
                      <input
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        style={inputStyle}
                      />
                    ) : (
                      driver.email || 'N/A'
                    )}
                  </td>
                  <td style={tdStyle}>{driver.approved ? '✅' : '❌'}</td>
                  <td style={tdStyle}>
                    <div>
                      <strong>License:</strong>{' '}
                      {driver.driverLicense ? (
                        <a href={driver.driverLicense} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </div>
                    <div>
                      <strong>Insurance:</strong>{' '}
                      {driver.insurance ? (
                        <a href={driver.insurance} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </div>
                    <div>
                      <strong>Vehicle Reg:</strong>{' '}
                      {driver.vehicleRegistration ? (
                        <a href={driver.vehicleRegistration} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {driver.ratings?.length ? (
                      <ul style={{ maxHeight: 80, overflowY: 'auto', paddingLeft: 16 }}>
                        {driver.ratings.map((r, i) => (
                          <li key={i}>
                            ⭐ {r.score} - {r.comment || 'No comment'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'No ratings'
                    )}
                  </td>
                  <td style={tdStyle}>
                    {editingDriverId === driver.id ? (
                      <>
                        <button style={btnSave} onClick={saveProfile}>
                          Save
                        </button>
                        <button style={btnCancel} onClick={cancelEditing}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {!driver.approved ? (
                          <>
                            <button style={btnApprove} onClick={() => approveDriver(driver.id)}>
                              Approve
                            </button>
                            <button style={btnReject} onClick={() => rejectDriver(driver.id)}>
                              Reject
                            </button>
                          </>
                        ) : (
                          <button style={btnReject} onClick={() => rejectDriver(driver.id)}>
                            Reject
                          </button>
                        )}
                        <button style={btnEdit} onClick={() => startEditing(driver)}>
                          Edit
                        </button>
                        <button style={btnDelete} onClick={() => deleteDriver(driver.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

const btnApprove = {
  ...btnEdit,
  backgroundColor: '#28a745',
};

const btnReject = {
  ...btnEdit,
  backgroundColor: '#ffc107',
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
