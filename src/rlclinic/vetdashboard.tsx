'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { 
  collection, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';

// Updated types to match the appointment booking component
interface Appointment {
  id: string;
  petName: string;
  clientName: string;
  date: string;
  timeSlot: string;
  appointmentType: string;
  status: string;
  paymentMethod: string;
  createdAt?: Timestamp;
}

interface Unavailable {
  id: string;
  date: string;
  veterinarian: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}

interface User {
  id: string;
  name: string;
  role: 'admin' | 'veterinarian' | 'user';
  email: string;
}

const VetDashboard: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unavailable, setUnavailable] = useState<Unavailable[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [newUnavailable, setNewUnavailable] = useState({
    date: new Date(),
    isAllDay: true,
    startTime: new Date(),
    endTime: new Date(new Date().setHours(new Date().getHours() + 1))
  });
  const [activeTab, setActiveTab] = useState<'appointments' | 'unavailable'>('appointments');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to get display name
  const getDisplayName = () => {
    if (!currentUser) return 'User';
    
    if (currentUser.name && currentUser.name.trim()) {
      const nameParts = currentUser.name.trim().split(' ').filter(part => part.length > 0);
      if (nameParts.length > 0) {
        return nameParts[nameParts.length - 1];
      }
    }
    
    return currentUser.email || 'User';
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch current user data
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          setUserLoading(true);
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User;
            setCurrentUser({ ...userData, id: querySnapshot.docs[0].id });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setUserLoading(false);
        }
      };
      
      fetchUserData();
    }
  }, [user]);

  // Load ALL appointments
  useEffect(() => {
    if (!currentUser) return;
    
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appointmentsData: Appointment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        appointmentsData.push({ 
          id: doc.id, 
          ...data,
          petName: data.petName || 'Unknown Pet',
          clientName: data.clientName || 'Unknown Client',
          date: data.date || '',
          timeSlot: data.timeSlot || '',
          appointmentType: data.appointmentType || 'General',
          status: data.status || 'Pending',
          paymentMethod: data.paymentMethod || ''
        } as Appointment);
      });
      setAppointments(appointmentsData);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  // Load unavailable slots - FIXED: Filter by current veterinarian
  useEffect(() => {
    if (!currentUser) return;
    
    const unavailableRef = collection(db, 'unavailableSlots');
    const q = query(unavailableRef, orderBy('date', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unavailableData: Unavailable[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only show unavailable slots for the current veterinarian
        if (data.veterinarian === currentUser.name) {
          unavailableData.push({ 
            id: doc.id, 
            date: data.date || '',
            veterinarian: data.veterinarian || '',
            isAllDay: data.isAllDay || true,
            startTime: data.startTime || '',
            endTime: data.endTime || ''
          } as Unavailable);
        }
      });
      setUnavailable(unavailableData);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  // Get today's appointments for quick stats
  const todaysAppointments = appointments.filter(apt => {
    if (!apt.date) return false;
    const aptDate = new Date(apt.date);
    const today = new Date();
    return aptDate.toDateString() === today.toDateString();
  });

  const handleAddUnavailable = async () => {
    if (!currentUser || currentUser.role !== 'veterinarian') return;
    
    try {
      const unavailableRef = collection(db, 'unavailableSlots');
      const newSlot = {
        date: newUnavailable.date.toISOString().split('T')[0],
        veterinarian: currentUser.name || 'Unknown Veterinarian',
        isAllDay: newUnavailable.isAllDay,
        startTime: newUnavailable.isAllDay ? '' : newUnavailable.startTime.toTimeString().slice(0, 5),
        endTime: newUnavailable.isAllDay ? '' : newUnavailable.endTime.toTimeString().slice(0, 5),
        createdAt: Timestamp.now()
      };
      
      await addDoc(unavailableRef, newSlot);
      
      setShowUnavailableModal(false);
      setNewUnavailable({
        date: new Date(),
        isAllDay: true,
        startTime: new Date(),
        endTime: new Date(new Date().setHours(new Date().getHours() + 1))
      });
      alert("Unavailable time marked successfully!");
    } catch (error) {
      console.error('Error marking unavailable:', error);
      alert("Failed to mark unavailable time. Please try again.");
    }
  };

  // Function to delete unavailable slot
  const handleDeleteUnavailable = async (id: string) => {
    if (!confirm("Are you sure you want to remove this unavailable date?")) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "unavailableSlots", id));
      alert("Unavailable date removed successfully!");
    } catch (error) {
      console.error("Error deleting unavailable slot:", error);
      alert("Failed to remove unavailable date. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeSlot: string) => {
    return timeSlot || 'No time specified';
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Helper function to check if appointment is for selected date
  const isAppointmentForSelectedDate = (appointment: Appointment) => {
    if (!appointment.date) return false;
    const aptDate = new Date(appointment.date);
    return aptDate.toDateString() === selectedDate.toDateString();
  };

  if (loading || userLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!user || !currentUser) {
    return (
      <div className="vet-dashboard">
        <div className="auth-error">
          <h2>Authentication Required</h2>
          <p>Please sign in to access the veterinary dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vet-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Veterinary Dashboard</h1>
          <div className="user-info">
            <span>Welcome, Dr. {getDisplayName()}!</span>
            <div className="user-avatar">
              {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
            </div>
            <button onClick={handleSignOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </div>
      </header>
     
      <div className="dashboard-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <h3>Navigation</h3>
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`nav-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          >
            <span className="nav-icon">📅</span>
            All Appointments
          </button>
          {currentUser.role === 'veterinarian' && (
            <button 
              onClick={() => setActiveTab('unavailable')}
              className={`nav-btn ${activeTab === 'unavailable' ? 'active' : ''}`}
            >
              <span className="nav-icon">🚫</span>
              Set Unavailable
            </button>
          )}

          <div className="quick-stats">
            <h4>Today&apos;s Stats</h4>
            <div className="stat-card">
              <div className="stat-number">{todaysAppointments.length}</div>
              <div className="stat-label">Appointments Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{todaysAppointments.filter(a => a.status === 'Pending').length}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{unavailable.length}</div>
              <div className="stat-label">Unavailable Days</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activeTab === 'appointments' ? (
            <div className="content-card">
              <div className="card-header">
                <h2>All Appointments</h2>
                <div className="date-navigation">
                  <button 
                    onClick={() => handleDateChange(-1)}
                    className="nav-button"
                  >
                    ←
                  </button>
                  <span className="current-date">
                    {formatDate(selectedDate)}
                  </span>
                  <button 
                    onClick={() => handleDateChange(1)}
                    className="nav-button"
                  >
                    →
                  </button>
                </div>
              </div>

              {appointments.filter(isAppointmentForSelectedDate).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <h3>No appointments scheduled for this day</h3>
                  <p>Appointments booked by users will appear here.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {appointments
                    .filter(isAppointmentForSelectedDate)
                    .map(apt => (
                      <div key={apt.id} className={`appointment-card ${apt.status.toLowerCase()}`}>
                        <div className="appointment-info">
                          <div className="pet-name">{apt.petName}</div>
                          <div className="owner">Client: {apt.clientName}</div>
                          <div className="time">Time: {formatTime(apt.timeSlot)}</div>
                          <div className="reason">Type: {apt.appointmentType}</div>
                          <div className="payment">Payment: {apt.paymentMethod || 'Not specified'}</div>
                        </div>
                        <div className="appointment-status">
                          <span className={`status-badge ${apt.status.toLowerCase()}`}>
                            {apt.status}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="content-card">
              <div className="card-header">
                <h2>Set Unavailable Time</h2>
                {currentUser.role === 'veterinarian' && (
                  <button 
                    onClick={() => setShowUnavailableModal(true)}
                    className="primary-button danger"
                  >
                    <span className="button-icon">🚫</span>
                    Mark Unavailable
                  </button>
                )}
              </div>

              {unavailable.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚫</div>
                  <h3>No unavailable times set</h3>
                  <p>Mark dates when you won&apos;t be available for appointments.</p>
                </div>
              ) : (
                <div>
                  <h3>Your Unavailable Periods</h3>
                  <div className="unavailable-list">
                    {unavailable.map(slot => (
                      <div key={slot.id} className="unavailable-card">
                        <div className="unavailable-icon">🚫</div>
                        <div className="unavailable-info">
                          <div className="unavailable-date">{formatDate(slot.date)}</div>
                          <div className="unavailable-time">
                            {slot.isAllDay ? 'All day' : `${slot.startTime} - ${slot.endTime}`}
                          </div>
                        </div>
                        <button 
                          className="delete-unavailable-btn"
                          onClick={() => handleDeleteUnavailable(slot.id)}
                          disabled={deletingId === slot.id}
                        >
                          {deletingId === slot.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Unavailable Modal */}
      {showUnavailableModal && currentUser.role === 'veterinarian' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Mark Unavailable Time</h2>
              <button 
                onClick={() => setShowUnavailableModal(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={new Date(newUnavailable.date.getTime() - newUnavailable.date.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 10)}
                  onChange={e => setNewUnavailable({
                    ...newUnavailable,
                    date: new Date(e.target.value)
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newUnavailable.isAllDay}
                    onChange={e => setNewUnavailable({
                      ...newUnavailable,
                      isAllDay: e.target.checked
                    })}
                  />
                  <span className="checkmark"></span>
                  All day unavailable
                </label>
              </div>
              {!newUnavailable.isAllDay && (
                <>
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={new Date(newUnavailable.startTime!.getTime() - newUnavailable.startTime!.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(11, 16)}
                      onChange={e => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(newUnavailable.startTime!);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setNewUnavailable({
                          ...newUnavailable,
                          startTime: newDate
                        });
                      }}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={new Date(newUnavailable.endTime!.getTime() - newUnavailable.endTime!.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(11, 16)}
                      onChange={e => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(newUnavailable.endTime!);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setNewUnavailable({
                          ...newUnavailable,
                          endTime: newDate
                        });
                      }}
                      className="form-input"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowUnavailableModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUnavailable}
                className="primary-button danger"
              >
                Mark Unavailable
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .vet-dashboard {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #334155;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 1rem;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top: 4px solid #34B89C;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .dashboard-header {
          background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
          color: white;
          padding: 1rem 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .dashboard-header h1 {
          font-size: 1.8rem;
          font-weight: 700;
          margin: 0;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 1rem;
        }
        
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .sign-out-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .sign-out-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .dashboard-content {
          display: flex;
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 1rem;
          gap: 1.5rem;
        }
        
        .sidebar {
          width: 280px;
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          height: fit-content;
          border: 1px solid #e2e8f0;
        }
        
        .sidebar h3 {
          color: #1e293b;
          margin-bottom: 1.2rem;
          font-size: 1.2rem;
          font-weight: 600;
        }
        
        .nav-btn {
          width: 100%;
          padding: 0.8rem 1rem;
          margin-bottom: 0.8rem;
          background: #f8fafc;
          color: #475569;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          transition: all 0.2s;
          font-size: 0.95rem;
          font-weight: 500;
        }
        
        .nav-btn:hover {
          background: #34B89C;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(52, 184, 156, 0.3);
        }
        
        .nav-btn.active {
          background: #34B89C;
          color: white;
          box-shadow: 0 4px 8px rgba(52, 184, 156, 0.3);
        }

        .nav-icon {
          font-size: 1.1rem;
        }
        
        .quick-stats {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e2e8f0;
        }
        
        .quick-stats h4 {
          color: 1e293b;
          margin-bottom: 1rem;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .stat-card {
          background: #f8fafc;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 0.8rem;
          border-left: 4px solid #34B89C;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.2rem;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #64748b;
        }

        .main-content {
          flex: 1;
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }

        .content-card {
          margin-bottom: 1.5rem;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .card-header h2 {
          font-size: 1.4rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .date-navigation {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }

        .nav-button {
          background: #34B89C;
          color: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .nav-button:hover {
          background: #2a9d83;
          transform: scale(1.05);
        }

        .current-date {
          font-weight: 600;
          color: #334155;
          min-width: 180px;
          text-align: center;
        }

        .primary-button {
          background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .primary-button:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(52, 184, 156, 0.3);
        }

        .secondary-button {
          background: #f1f5f9;
          color: #475569;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .secondary-button:hover {
          background: #e2e8f0;
        }

        .danger {
          background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #64748b;
        }

        .empty-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          opacity: 0.7;
        }

        .empty-state h3 {
          color: #475569;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .empty-state p {
          margin: 0;
          font-size: 0.95rem;
        }

        .appointments-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .appointment-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          border-radius: 8px;
          padding: 1rem;
          border-left: 4px solid #34B89C;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transition: all 0.2s;
        }

        .appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
        }

        .appointment-info {
          flex: 1;
        }

        .appointment-info > div {
          margin-bottom: 0.3rem;
          color: #475569;
          font-size: 0.9rem;
        }

        .pet-name {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 0.4rem;
          color: #1e293b;
        }

        .appointment-status .status-badge {
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        .status-badge.pending {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-badge.completed {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 500px;
          max-width: 100%;
          padding: 1.5rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          animation: fadeIn 0.3s ease-in-out;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-header h2 {
          color: #1e293b;
          margin: 0;
          font-size: 1.3rem;
        }

        .close-btn {
          border: none;
          background: transparent;
          font-size: 1.5rem;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: #1e293b;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.4rem;
          font-weight: 500;
          color: #374151;
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          padding: 0.6rem 0.8rem;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #34B89C;
          box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.2);
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          font-weight: 400;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.8rem;
          margin-top: 1.5rem;
        }

        .unavailable-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .unavailable-card {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border-radius: 8px;
          padding: 1rem;
          border-left: 4px solid #ef4444;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transition: all 0.2s;
          justify-content: space-between;
        }

        .unavailable-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
        }

        .unavailable-icon {
          font-size: 1.3rem;
          margin-right: 1rem;
          opacity: 0.7;
        }

        .unavailable-info {
          flex: 1;
        }

        .unavailable-info > div {
          margin-bottom: 0.3rem;
          color: #475569;
          font-size: 0.9rem;
        }

        .unavailable-date {
          font-weight: 600;
          margin-bottom: 0.4rem;
          color: #1e293b;
        }

        .delete-unavailable-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .delete-unavailable-btn:hover:not(:disabled) {
          background: #dc2626;
        }

        .delete-unavailable-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .dashboard-content {
            flex-direction: column;
          }
          
          .sidebar {
            width: 100%;
          }
          
          .card-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .date-navigation {
            width: 100%;
            justify-content: center;
          }

          .unavailable-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .delete-unavailable-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default VetDashboard;