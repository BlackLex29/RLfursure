'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  doc,
  limit,
  startAfter,
  DocumentSnapshot,
  updateDoc
} from "firebase/firestore";
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Types
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
  twoFactorEnabled?: boolean;
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
  const [activeTab, setActiveTab] = useState<'appointments' | 'unavailable' | 'settings'>('appointments');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updating2FA, setUpdating2FA] = useState(false);
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
  const getDisplayName = useCallback(() => {
    if (!currentUser) return 'User';
    
    if (currentUser.name && currentUser.name.trim()) {
      const nameParts = currentUser.name.trim().split(' ').filter(part => part.length > 0);
      if (nameParts.length > 0) {
        return nameParts[nameParts.length - 1];
      }
    }
    
    return currentUser.email || 'User';
  }, [currentUser]);

  // Redirect if not authenticated (but wait for user data to load)
   useEffect(() => {
    if (!loading && !user && !userLoading) {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, userLoading]);

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

  // Load appointments with pagination
  useEffect(() => {
    if (!currentUser) return;
    
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, orderBy('createdAt', 'desc'), limit(20));
    
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
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  // Load more appointments
  const loadMoreAppointments = async () => {
    if (!currentUser || !lastVisible) return;
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef, 
        orderBy('createdAt', 'desc'), 
        startAfter(lastVisible),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const newAppointments: Appointment[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        newAppointments.push({ 
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
      
      setAppointments(prev => [...prev, ...newAppointments]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
    } catch (error) {
      console.error('Error loading more appointments:', error);
    }
  };

  // Load unavailable slots - Filter by current veterinarian
  useEffect(() => {
    if (!currentUser) return;
    
    const unavailableRef = collection(db, 'unavailableSlots');
    const q = query(unavailableRef, orderBy('date', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unavailableData: Unavailable[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Include all unavailable slots or filter by veterinarian if needed
        unavailableData.push({ 
          id: doc.id, 
          date: data.date || '',
          veterinarian: data.veterinarian || '',
          isAllDay: data.isAllDay || true,
          startTime: data.startTime || '',
          endTime: data.endTime || ''
        } as Unavailable);
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

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isAppointmentForSelectedDate = (appointment: Appointment) => {
    if (!appointment.date) return false;
    const aptDate = new Date(appointment.date);
    return aptDate.toDateString() === selectedDate.toDateString();
  };

  const handleLogoError = () => {
    setLogoError(true);
  };

  // Handle 2FA toggle
  const handleToggle2FA = async () => {
    if (!currentUser) return;
    
    try {
      setUpdating2FA(true);
      const userRef = doc(db, 'users', currentUser.id);
      const new2FAStatus = !currentUser.twoFactorEnabled;
      
      await updateDoc(userRef, {
        twoFactorEnabled: new2FAStatus
      });
      
      setCurrentUser(prev => prev ? { ...prev, twoFactorEnabled: new2FAStatus } : null);
      
      alert(`Two-factor authentication ${new2FAStatus ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      console.error('Error updating 2FA status:', error);
      alert('Failed to update two-factor authentication. Please try again.');
    } finally {
      setUpdating2FA(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 1rem;
            background: #f8fafc;
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
          
          .loading-container p {
            color: #64748b;
            font-size: 1rem;
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 1rem;
            background: #f8fafc;
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
          
          .loading-container p {
            color: #64748b;
            font-size: 1rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="vet-dashboard">
      {/* Top Navigation Bar */}
      <nav className="top-navbar">
        <div className="nav-container">
          <div className="nav-left">
            <button 
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span className="menu-icon">☰</span>
              <span className="menu-text">Menu</span>
            </button>
            <div className="nav-brand">
              <div className="nav-logo">
                {!logoError ? (
                  <Image 
                    src="https://scontent.fmnl13-4.fna.fbcdn.net/v/t39.30808-1/308051699_1043145306431767_6902051210877649285_n.jpg?stp=cp0_dst-jpg_s60x60_tt6&_nc_cat=108&ccb=1-7&_nc_sid=2d3e12&_nc_eui2=AeH7C3PaObQLeqOOxA3pTYw1U6XSiAPBS_lTpdKIA8FL-aWJ6pOqX-tCsYAmdUOHVzzxg-T9gjpVH_1PkEO0urYZ&_nc_ohc=_IGNUXrA7VIQ7kNvwGverts&_nc_oc=Adn4yGvlqEmBbcvJy9fpqzZS-lcsbho9b-UbpfXA5TVHNF-m2LsLZkoh5MgqG3kGpbY&_nc_zt=24&_nc_ht=scontent.fmnl13-4.fna&_nc_gid=tRLkyrhTTf7--ojWnn9Hfg&oh=00_AfaGNX7atT_-t5Le75P4n8BeLaWdzkJSkBB7ZgM9dQ9clQ&oe=68D7A4DB"
                    alt="RL Clinic Logo" 
                    className="logo-image"
                    width={40}
                    height={40}
                    onError={handleLogoError}
                  />
                ) : (
                  <div className="logo-fallback">🐾</div>
                )}
              </div>
              <div className="brand-text">
                <h1>FursureCare</h1>
                <p>Veterinary Dashboard</p>
              </div>
            </div>
          </div>

          <div className="nav-right">
            <div className="user-welcome">
              Welcome, Dr. {getDisplayName()}!
            </div>
            <div className="user-actions">
              <div className="user-avatar">
                {currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <button onClick={handleSignOut} className="sign-out-btn">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar Menu */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Dashboard Menu</h3>
          <button 
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="sidebar-content">
          <div className="sidebar-section">
            <h4>Main Navigation</h4>
            <nav className="nav-menu">
              <button 
                onClick={() => {
                  setActiveTab('appointments');
                  setSidebarOpen(false);
                }}
                className={`nav-btn ${activeTab === 'appointments' ? 'active' : ''}`}
              >
                <span className="nav-icon">📅</span>
                <span className="nav-text">Appointments</span>
                <span className="nav-badge">{appointments.length}</span>
              </button>
              {currentUser.role === 'veterinarian' && (
                <button 
                  onClick={() => {
                    setActiveTab('unavailable');
                    setSidebarOpen(false);
                  }}
                  className={`nav-btn ${activeTab === 'unavailable' ? 'active' : ''}`}
                >
                  <span className="nav-icon">📋</span>
                  <span className="nav-text">Availability</span>
                  <span className="nav-badge">{unavailable.length}</span>
                </button>
              )}
              <button 
                onClick={() => {
                  setActiveTab('settings');
                  setSidebarOpen(false);
                }}
                className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Settings</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section">
            <h4>Today&apos;s Overview</h4>
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <div className="stat-number">{todaysAppointments.length}</div>
                  <div className="stat-label">Today&apos;s Appointments</div>
                </div>
              </div>
              <div className="stat-card warning">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <div className="stat-number">{todaysAppointments.filter(a => a.status === 'Pending').length}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <div className="stat-number">{unavailable.length}</div>
                  <div className="stat-label">Unavailable Days</div>
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Quick Actions</h4>
            <div className="quick-actions">
              {currentUser.role === 'veterinarian' && (
                <button 
                  onClick={() => {
                    setShowUnavailableModal(true);
                    setSidebarOpen(false);
                  }}
                  className="quick-action-btn"
                >
                  <span className="action-icon">📅</span>
                  Mark Unavailable
                </button>
              )}
              <button 
                onClick={() => {
                  setActiveTab('settings');
                  setSidebarOpen(false);
                }}
                className="quick-action-btn"
              >
                <span className="action-icon">👤</span>
                View Profile
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className="main-content-wrapper">
        <main className="main-content">
          {activeTab === 'appointments' ? (
            <div className="content-section">
              <div className="section-header">
                <div className="header-info">
                  <h2>Appointment Schedule</h2>
                  <p>Manage and view all scheduled appointments - {appointments.length} total appointments</p>
                </div>
                <div className="header-controls">
                  <div className="date-navigation">
                    <button 
                      onClick={() => handleDateChange(-1)}
                      className="nav-button"
                    >
                      ←
                    </button>
                    <span className="current-date">
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                    <button 
                      onClick={() => handleDateChange(1)}
                      className="nav-button"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              {appointments.filter(isAppointmentForSelectedDate).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <h3>No appointments scheduled for {selectedDate.toLocaleDateString()}</h3>
                  <p>There are no appointments booked for this date.</p>
                </div>
              ) : (
                <div className="appointments-grid maximized-grid">
                  {appointments
                    .filter(isAppointmentForSelectedDate)
                    .map(apt => (
                      <div key={apt.id} className={`appointment-card ${apt.status.toLowerCase()}`}>
                        <div className="appointment-header">
                          <div className="pet-info">
                            <h4 className="pet-name">{apt.petName}</h4>
                            <span className="pet-type">{apt.appointmentType}</span>
                          </div>
                          <div className={`status-badge ${apt.status.toLowerCase()}`}>
                            {apt.status}
                          </div>
                        </div>
                        <div className="appointment-details">
                          <div className="detail-row">
                            <span className="detail-label">Owner:</span>
                            <span className="detail-value">{apt.clientName}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Time:</span>
                            <span className="detail-value">{apt.timeSlot || 'Not specified'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Payment:</span>
                            <span className="detail-value payment-method">{apt.paymentMethod || 'Not specified'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Date:</span>
                            <span className="detail-value">
                              {new Date(apt.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
              
              {hasMore && (
                <div className="load-more-container">
                  <button onClick={loadMoreAppointments} className="load-more-btn">
                    Load More Appointments ({appointments.length} loaded)
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'unavailable' ? (
            <div className="content-section">
              <div className="section-header">
                <div className="header-info">
                  <h2>Availability Management</h2>
                  <p>Set your unavailable dates and times - {unavailable.length} unavailable periods set</p>
                </div>
                {currentUser.role === 'veterinarian' && (
                  <button 
                    onClick={() => setShowUnavailableModal(true)}
                    className="primary-button success"
                  >
                    <span className="button-icon">📅</span>
                    Mark Unavailable
                  </button>
                )}
              </div>

              {unavailable.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No unavailable periods set</h3>
                  <p>Mark dates when you won&apos;t be available for appointments.</p>
                </div>
              ) : (
                <div className="availability-section">
                  <div className="section-subheader">
                    <h3>Your Unavailable Periods</h3>
                    <span className="subheader-count">{unavailable.length} periods</span>
                  </div>
                  <div className="unavailable-grid maximized-grid">
                    {unavailable.map(slot => (
                      <div key={slot.id} className="unavailable-card success-card">
                        <div className="unavailable-icon">📋</div>
                        <div className="unavailable-info">
                          <div className="unavailable-date">
                            {new Date(slot.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="unavailable-time">
                            {slot.isAllDay ? '🕒 All day' : `🕒 ${slot.startTime} - ${slot.endTime}`}
                          </div>
                          <div className="unavailable-vet">
                            👨‍⚕️ {slot.veterinarian}
                          </div>
                        </div>
                        <button 
                          className="delete-unavailable-btn success"
                          onClick={() => handleDeleteUnavailable(slot.id)}
                          disabled={deletingId === slot.id}
                        >
                          {deletingId === slot.id ? 'Deleting...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="content-section">
              <div className="section-header">
                <div className="header-info">
                  <h2>Account Settings</h2>
                  <p>Manage your account preferences and security settings</p>
                </div>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">🔐</div>
                    <div className="setting-info">
                      <h3>Two-Factor Authentication</h3>
                      <p>Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <div className={`toggle-switch ${currentUser.twoFactorEnabled ? 'enabled' : 'disabled'}`}>
                      <input
                        type="checkbox"
                        checked={currentUser.twoFactorEnabled || false}
                        onChange={handleToggle2FA}
                        disabled={updating2FA}
                        className="toggle-input"
                        id="2fa-toggle"
                      />
                      <label className="toggle-slider" htmlFor="2fa-toggle">
                        <span className="toggle-text">
                          {currentUser.twoFactorEnabled ? 'ON' : 'OFF'}
                        </span>
                      </label>
                    </div>
                    <button
                      onClick={handleToggle2FA}
                      disabled={updating2FA}
                      className={`toggle-btn ${currentUser.twoFactorEnabled ? 'disable' : 'enable'}`}
                    >
                      {updating2FA ? 'Updating...' : currentUser.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                  </div>
                </div>

                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">👤</div>
                    <div className="setting-info">
                      <h3>Profile Information</h3>
                      <p>Update your personal details and contact information</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button className="secondary-button">
                      Edit Profile
                    </button>
                  </div>
                </div>

                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">🔔</div>
                    <div className="setting-info">
                      <h3>Notifications</h3>
                      <p>Manage your email and push notification preferences</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button className="secondary-button">
                      Configure
                    </button>
                  </div>
                </div>

                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">🛡️</div>
                    <div className="setting-info">
                      <h3>Security</h3>
                      <p>Change password and manage security settings</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button className="secondary-button">
                      Change Password
                    </button>
                  </div>
                </div>
              </div>

              <div className="security-info">
                <h4>About Two-Factor Authentication</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-icon">✅</span>
                    <div className="info-content">
                      <strong>Enhanced Security</strong>
                      <p>Protect your account with an additional verification step</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">📱</span>
                    <div className="info-content">
                      <strong>Mobile App</strong>
                      <p>Use authenticator apps like Google Authenticator or Authy</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">⚡</span>
                    <div className="info-content">
                      <strong>Quick Setup</strong>
                      <p>Get set up in less than 2 minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
                className="primary-button success"
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
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #334155;
        }
        
        /* Top Navigation Bar */
        .top-navbar {
          background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
          color: white;
          padding: 0;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .nav-container {
          max-width: 100%;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 70px;
        }
        
        .nav-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .menu-toggle {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
        }
        
        .menu-toggle:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }
        
        .menu-icon {
          font-size: 1.2rem;
          font-weight: bold;
        }
        
        .menu-text {
          font-weight: 500;
        }
        
        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        
        .nav-logo {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.2);
        }
        
        .logo-image {
          border-radius: 8px;
          object-fit: cover;
        }
        
        .logo-fallback {
          display: flex;
          font-size: 1.5rem;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.2);
        }
        
        .brand-text h1 {
          font-size: 1.3rem;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.5px;
        }
        
        .brand-text p {
          font-size: 0.8rem;
          opacity: 0.9;
          margin: 0;
        }
        
        .nav-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        
        .user-welcome {
          font-weight: 500;
          font-size: 0.9rem;
        }
        
        .user-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
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
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .sign-out-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
          font-size: 0.9rem;
        }

        .sign-out-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }
        
        /* Sidebar Menu */
        .sidebar {
          position: fixed;
          top: 0;
          left: -320px;
          width: 320px;
          height: 100vh;
          background: white;
          box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
          transition: left 0.3s ease;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        
        .sidebar.sidebar-open {
          left: 0;
        }
        
        .sidebar-header {
          background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
          color: white;
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .sidebar-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }
        
        .close-sidebar {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
        }
        
        .close-sidebar:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }
        
        .sidebar-content {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }
        
        .sidebar-section {
          margin-bottom: 2rem;
        }
        
        .sidebar-section:last-child {
          margin-bottom: 0;
        }
        
        .sidebar-section h4 {
          color: #1e293b;
          margin-bottom: 1rem;
          font-size: 1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .sidebar-section h4::before {
          content: '';
          width: 4px;
          height: 16px;
          background: linear-gradient(135deg, #34B89C, #6BC1E1);
          border-radius: 2px;
        }
        
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .nav-btn {
          width: 100%;
          padding: 1rem;
          background: #f8fafc;
          color: #475569;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          transition: all 0.3s;
          font-size: 0.95rem;
          font-weight: 500;
          position: relative;
        }
        
        .nav-btn:hover {
          background: linear-gradient(135deg, #34B89C, #6BC1E1);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(52, 184, 156, 0.3);
        }
        
        .nav-btn.active {
          background: linear-gradient(135deg, #34B89C, #6BC1E1);
          color: white;
          box-shadow: 0 8px 20px rgba(52, 184, 156, 0.3);
        }

        .nav-icon {
          font-size: 1.2rem;
        }

        .nav-text {
          flex: 1;
        }

        .nav-badge {
          background: rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.2rem 0.6rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .stats-grid {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        
        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          background: #f8fafc;
          transition: all 0.3s;
        }
        
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card.primary {
          border-left: 4px solid #34B89C;
        }
        
        .stat-card.warning {
          border-left: 4px solid #f59e0b;
        }
        
        .stat-card.success {
          border-left: 4px solid #10b981;
        }
        
        .stat-icon {
          font-size: 1.5rem;
          opacity: 0.8;
        }
        
        .stat-content {
          flex: 1;
        }
        
        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
          margin-bottom: 0.2rem;
        }
        
        .stat-label {
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 500;
        }
        
        .quick-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .quick-action-btn {
          width: 100%;
          padding: 0.8rem 1rem;
          background: #f8fafc;
          color: #475569;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          transition: all 0.3s;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .quick-action-btn:hover {
          background: #e2e8f0;
          transform: translateX(5px);
        }
        
        .action-icon {
          font-size: 1.1rem;
        }
        
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          backdrop-filter: blur(2px);
        }
        
        /* Main Content */
        .main-content-wrapper {
          margin-left: 0;
          transition: margin-left 0.3s ease;
          min-height: calc(100vh - 70px);
        }
        
        .main-content {
          background: white;
          border-radius: 16px;
          margin: 2rem;
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          min-height: 600px;
        }

        .content-section {
          height: 100%;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          gap: 1rem;
        }

        .header-info h2 {
          font-size: 1.8rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.5px;
        }

        .header-info p {
          color: #64748b;
          margin: 0;
          font-size: 1rem;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .date-navigation {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: #f8fafc;
          padding: 0.5rem;
          border-radius: 12px;
        }

        .nav-button {
          background: white;
          color: #34B89C;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .nav-button:hover {
          background: #34B89C;
          color: white;
          transform: scale(1.05);
        }

        .current-date {
          font-weight: 600;
          color: #334155;
          min-width: 250px;
          text-align: center;
          font-size: 1rem;
        }

        .primary-button {
          background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
          color: white;
          border: none;
          padding: 0.8rem 1.5rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          box-shadow: 0 4px 12px rgba(52, 184, 156, 0.3);
        }

        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(52, 184, 156, 0.4);
        }

        .primary-button.success {
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .button-icon {
          font-size: 1.1rem;
        }

        .secondary-button {
          background: #f1f5f9;
          color: #475569;
          border: none;
          padding: 0.8rem 1.5rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
        }

        .secondary-button:hover {
          background: #e2e8f0;
          transform: translateY(-1px);
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-state h3 {
          color: #475569;
          margin-bottom: 0.5rem;
          font-weight: 600;
          font-size: 1.5rem;
        }

        .empty-state p {
          margin: 0;
          font-size: 1rem;
          max-width: 400px;
          margin: 0 auto;
        }

        .maximized-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
          max-height: 60vh;
          overflow-y: auto;
          padding: 1rem;
        }

        .appointments-grid {
          max-height: none;
        }

        .appointment-card {
          background: #f8fafc;
          border-radius: 16px;
          padding: 1.5rem;
          border-left: 6px solid #34B89C;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
          min-height: 140px;
        }

        .appointment-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #34B89C, #6BC1E1);
        }

        .appointment-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .appointment-card.pending {
          border-left-color: #f59e0b;
        }

        .appointment-card.completed {
          border-left-color: #10b981;
        }

        .appointment-card.cancelled {
          border-left-color: #ef4444;
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .pet-info h4 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.3rem 0;
        }

        .pet-name {
          margin: 0 0 0.3rem 0;
        }

        .pet-type {
          background: #e2e8f0;
          color: #475569;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .status-badge {
          padding: 0.4rem 1rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #d97706;
        }

        .status-badge.completed {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.cancelled {
          background: #fee2e2;
          color: #dc2626;
        }

        .appointment-details {
          margin-bottom: 0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding: 0.3rem 0;
        }

        .detail-label {
          font-weight: 600;
          color: #64748b;
          font-size: 0.85rem;
        }

        .detail-value {
          color: #1e293b;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .payment-method {
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-size: 0.8rem;
        }

        .load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
        }

        .load-more-btn {
          background: linear-gradient(135deg, #34B89C, #6BC1E1);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(52, 184, 156, 0.3);
        }

        .load-more-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(52, 184, 156, 0.4);
        }

        .availability-section {
          margin-top: 1rem;
        }

        .section-subheader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-subheader h3 {
          color: #1e293b;
          margin: 0;
          font-size: 1.4rem;
          font-weight: 600;
        }

        .subheader-count {
          background: #10b981;
          color: white;
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .unavailable-grid {
          max-height: none;
        }

        .unavailable-card {
          display: flex;
          align-items: center;
          background: #f0fdf4;
          border-radius: 12px;
          padding: 1.5rem;
          border-left: 4px solid #10b981;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transition: all 0.3s;
          gap: 1rem;
          min-height: 100px;
        }

        .unavailable-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.2);
        }

        .success-card {
          background: #f0fdf4;
          border-left-color: #10b981;
        }

        .unavailable-icon {
          font-size: 1.8rem;
          opacity: 0.8;
        }

        .unavailable-info {
          flex: 1;
        }

        .unavailable-date {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.3rem;
          font-size: 1rem;
        }

        .unavailable-time {
          color: #64748b;
          font-size: 0.9rem;
          margin-bottom: 0.2rem;
        }

        .unavailable-vet {
          color: #059669;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .delete-unavailable-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .delete-unavailable-btn:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
        }

        .delete-unavailable-btn.success {
          background: #10b981;
        }

        .delete-unavailable-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Settings Styles */
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .setting-card {
          background: #f8fafc;
          border-radius: 16px;
          padding: 1.5rem;
          border-left: 4px solid #34B89C;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transition: all 0.3s;
        }

        .setting-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .setting-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .setting-icon {
          font-size: 2rem;
          opacity: 0.8;
        }

        .setting-info h3 {
          color: #1e293b;
          margin: 0 0 0.5rem 0;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .setting-info p {
          color: #64748b;
          margin: 0;
          font-size: 0.9rem;
        }

        .setting-control {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 80px;
          height: 34px;
        }

        .toggle-input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 34px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        .toggle-input:checked + .toggle-slider {
          background-color: #10b981;
        }

        .toggle-input:checked + .toggle-slider:before {
          transform: translateX(46px);
        }

        .toggle-switch.enabled .toggle-slider {
          background-color: #10b981;
        }

        .toggle-switch.disabled .toggle-slider {
          background-color: #ccc;
        }

        .toggle-text {
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
          z-index: 1;
        }

        .toggle-btn {
          padding: 0.6rem 1.2rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.85rem;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .toggle-btn.enable {
          background: #10b981;
          color: white;
        }

        .toggle-btn.disable {
          background: #ef4444;
          color: white;
        }

        .toggle-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .toggle-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Security Info */
        .security-info {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid #e2e8f0;
        }

        .security-info h4 {
          color: #1e293b;
          margin-bottom: 1.5rem;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .info-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }

        .info-icon {
          font-size: 1.5rem;
          opacity: 0.8;
        }

        .info-content strong {
          display: block;
          color: #1e293b;
          margin-bottom: 0.3rem;
          font-size: 1rem;
        }

        .info-content p {
          color: #64748b;
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          backdrop-filter: blur(5px);
        }

        .modal {
          background: white;
          border-radius: 20px;
          width: 500px;
          max-width: 95%;
          padding: 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-30px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
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
          font-size: 1.4rem;
          font-weight: 700;
        }

        .close-btn {
          border: none;
          background: #f1f5f9;
          color: #64748b;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .close-btn:hover {
          background: #e2e8f0;
          color: #374151;
        }

        .modal-body {
          margin-bottom: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #374151;
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          font-size: 0.95rem;
          transition: all 0.3s;
          background: #f8fafc;
        }

        .form-input:focus {
          outline: none;
          border-color: #34B89C;
          background: white;
          box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 0.8rem;
          cursor: pointer;
          font-weight: 500;
          color: #374151;
        }

        .checkmark {
          display: inline-block;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .nav-container {
            padding: 0 0.5rem;
          }
          
          .menu-text {
            display: none;
          }
          
          .user-welcome {
            display: none;
          }
          
          .brand-text h1 {
            font-size: 1.1rem;
          }
          
          .brand-text p {
            display: none;
          }
          
          .main-content {
            margin: 1rem;
            padding: 1.5rem;
          }
          
          .section-header {
            flex-direction: column;
            gap: 1rem;
          }
          
          .header-controls {
            width: 100%;
            justify-content: center;
          }
          
          .date-navigation {
            width: 100%;
            justify-content: space-between;
          }
          
          .settings-grid {
            grid-template-columns: 1fr;
          }
          
          .setting-control {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          
          .modal {
            padding: 1.5rem;
          }
          
          .modal-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .main-content {
            margin: 0.5rem;
            padding: 1rem;
          }
          
          .appointment-card {
            padding: 1rem;
          }
          
          .appointment-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          
          .maximized-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default VetDashboard;