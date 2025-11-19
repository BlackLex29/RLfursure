'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { 
  collection, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc,
  query,
  where
} from "firebase/firestore";
import styled, { createGlobalStyle, keyframes } from "styled-components";

// Global Styles
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f8fafc;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  * {
    box-sizing: border-box;
  }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(25px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

interface AppointmentType {
  id: string;
  clientName: string;
  petName?: string;
  birthday?: string;
  color?: string;
  petType?: string;
  petBreed?: string;
  breed?: string;
  gender?: string;
  date: string;
  timeSlot: string;
  status?: "Pending" | "Confirmed" | "Done" | "Cancelled";
  bookedByAdmin?: boolean;
  createdAt?: string;
  serviceType?: string;
  petId?: string;
  paymentMethod?: string;
}

interface UnavailableSlot {
  id: string;
  date: string;
  veterinarian: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  leaveDays?: number;
  endDate?: string;
  isMultipleDays?: boolean;
}

interface SidebarProps {
  $isOpen: boolean;
}

interface MenuItemProps {
  $active?: boolean;
}

interface AppointmentCardProps {
  $delay: number;
  $borderLeftColor: string;
}

interface UserRole {
  twoFactorEnabled?: boolean;
  email?: string;
  name?: string;
  role?: string;
}

const VetDashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentType[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "today" | "appointments" | "unavailable" | "settings">("dashboard");
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Modal States
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [showCancelUnavailableModal, setShowCancelUnavailableModal] = useState(false);
  const [unavailableToCancel, setUnavailableToCancel] = useState<UnavailableSlot | null>(null);
  const [newUnavailable, setNewUnavailable] = useState({
    date: new Date().toISOString().split('T')[0],
    isAllDay: true,
    startTime: "08:00",
    endTime: "09:00",
    reason: "",
    leaveDays: 1,
    isMultipleDays: false
  });
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [showUnavailableDetails, setShowUnavailableDetails] = useState(false);
  const [selectedUnavailable, setSelectedUnavailable] = useState<UnavailableSlot | null>(null);

  // Settings States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showOTPSetup, setShowOTPSetup] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  // ✅ FIXED: Improved date utility functions
  const getTodayDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ✅ FIXED: Enhanced date normalization function
  const normalizeDate = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      if (dateString.includes('T')) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return dateString;
        }
        if (parts.length === 3 && parts[2].length === 4) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      return dateString;
    } catch (error) {
      console.warn('Error normalizing date:', dateString, error);
      return dateString;
    }
  };
  

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // ✅ FIXED: Enhanced fetchAppointments function
  const fetchAppointments = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "appointments"));
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        const breed = docData.breed || docData.petBreed || "Not specified";
        
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          birthday: docData.birthday || "",
          color: docData.color || "",
          petType: docData.petType || "",
          petBreed: breed,
          breed: breed,
          gender: docData.gender || "",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending",
          bookedByAdmin: docData.bookedByAdmin || false,
          createdAt: docData.createdAt || "",
          serviceType: docData.serviceType || docData.appointmentType || "Check Up",
          paymentMethod: docData.paymentMethod || "Cash",
        });
      });
      
      setAppointments(data.sort((a, b) => a.date.localeCompare(b.date)));
      
      const todayString = getTodayDateString();
      const todayAppts = data.filter((appt) => {
        const normalizedDate = normalizeDate(appt.date);
        return normalizedDate === todayString;
      });
      
      setTodaysAppointments(todayAppts);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, []);

  // ✅ FIXED: Enhanced direct query for today's appointments
  const fetchTodaysAppointmentsDirectly = useCallback(async () => {
    try {
      const todayString = getTodayDateString();
      const appointmentsRef = collection(db, "appointments");
      
      let todayAppts: AppointmentType[] = [];
      
      try {
        const q = query(appointmentsRef, where("date", "==", todayString));
        const snapshot = await getDocs(q);
        
        snapshot.forEach((doc) => {
          const docData = doc.data();
          const breed = docData.breed || docData.petBreed || "Not specified";
          
          todayAppts.push({
            id: doc.id,
            clientName: docData.clientName || "",
            petName: docData.petName || "",
            birthday: docData.birthday || "",
            color: docData.color || "",
            petType: docData.petType || "",
            petBreed: breed,
            breed: breed,
            gender: docData.gender || "",
            date: docData.date || "",
            timeSlot: docData.timeSlot || "",
            status: docData.status || "Pending",
            bookedByAdmin: docData.bookedByAdmin || false,
            createdAt: docData.createdAt || "",
            serviceType: docData.serviceType || docData.appointmentType || "Check Up",
            paymentMethod: docData.paymentMethod || "Cash",
          });
        });
      } catch (queryError) {
        console.error("Direct query failed:", queryError);
      }
      
      if (todayAppts.length === 0) {
        const allSnapshot = await getDocs(appointmentsRef);
        const allAppts: AppointmentType[] = [];
        
        allSnapshot.forEach((doc) => {
          const docData = doc.data();
          const breed = docData.breed || docData.petBreed || "Not specified";
          
          allAppts.push({
            id: doc.id,
            clientName: docData.clientName || "",
            petName: docData.petName || "",
            birthday: docData.birthday || "",
            color: docData.color || "",
            petType: docData.petType || "",
            petBreed: breed,
            breed: breed,
            gender: docData.gender || "",
            date: docData.date || "",
            timeSlot: docData.timeSlot || "",
            status: docData.status || "Pending",
            bookedByAdmin: docData.bookedByAdmin || false,
            createdAt: docData.createdAt || "",
            serviceType: docData.serviceType || docData.appointmentType || "Check Up",
            paymentMethod: docData.paymentMethod || "Cash",
          });
        });
        
        todayAppts = allAppts.filter((appt) => {
          const normalizedDate = normalizeDate(appt.date);
          return normalizedDate === todayString;
        });
      }
      
      setTodaysAppointments(todayAppts);
    } catch (error) {
      console.error("Error fetching today's appointments directly:", error);
    }
  }, []);

const fetchUnavailableSlots = useCallback(async () => {
  try {
    const snapshot = await getDocs(collection(db, "unavailableSlots"));
    const data: UnavailableSlot[] = [];
    snapshot.forEach((doc) => {
      const docData = doc.data();
      
      // Handle date conversion properly
      let dateValue = docData.date || docData.startDate || "";
      
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        dateValue = dateValue.toDate().toISOString().split('T')[0];
      }
      
      // Handle endDate similarly
      let endDateValue = docData.endDate || "";
      if (endDateValue && typeof endDateValue === 'object' && endDateValue.toDate) {
        endDateValue = endDateValue.toDate().toISOString().split('T')[0];
      }

      data.push({
        id: doc.id,
        date: dateValue,
        veterinarian: docData.veterinarian || "",
        isAllDay: docData.isAllDay || true,
        startTime: docData.startTime || "",
        endTime: docData.endTime || "",
        reason: docData.reason || "",
        leaveDays: docData.leaveDays || 1,
        endDate: endDateValue,
        isMultipleDays: docData.isMultipleDays || false
      });
    });
    
    console.log("📅 Fetched unavailable slots (single documents):", data);
    setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)));
  } catch (error) {
    console.error("Error fetching unavailable slots:", error);
  }
}, []);

  useEffect(() => {
    const initialize2FAState = async () => {
      setIsMounted(true);
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserRole;
            const is2FAEnabled = userData.twoFactorEnabled || false;
            
            setTwoFactorEnabled(is2FAEnabled);
            localStorage.setItem('twoFactorEnabled', is2FAEnabled.toString());
          } else {
            const saved2FA = localStorage.getItem('twoFactorEnabled');
            if (saved2FA === 'true') {
              setTwoFactorEnabled(true);
            }
          }
          
          if (currentUser.email) {
            setOtpEmail(currentUser.email);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          const saved2FA = localStorage.getItem('twoFactorEnabled');
          if (saved2FA === 'true') {
            setTwoFactorEnabled(true);
          }
        }
      }
    };

    initialize2FAState();
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('twoFactorEnabled', twoFactorEnabled.toString());
    }
  }, [twoFactorEnabled, isMounted]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      alert("Logout failed: " + (error as Error).message);
    }
  };

  // ✅ FIXED: Enhanced real-time listener with better date handling
  useEffect(() => {
    fetchAppointments();
    fetchTodaysAppointmentsDirectly();
    fetchUnavailableSlots();

    const unsubscribeAppointments = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        const breed = docData.breed || docData.petBreed || "Not specified";
        
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          birthday: docData.birthday || "",
          color: docData.color || "",
          petType: docData.petType || "",
          petBreed: breed,
          breed: breed,
          gender: docData.gender || "",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending",
          bookedByAdmin: docData.bookedByAdmin || false,
          createdAt: docData.createdAt || "",
          serviceType: docData.serviceType || docData.appointmentType || "Check Up",
          paymentMethod: docData.paymentMethod || "Cash",
        });
      });
      
      setAppointments(data.sort((a, b) => a.date.localeCompare(b.date)));
      
      const todayString = getTodayDateString();
      const todayAppts = data.filter((appt) => {
        const normalizedDate = normalizeDate(appt.date);
        return normalizedDate === todayString;
      });
      
      setTodaysAppointments(todayAppts);
    });

    const unsubscribeUnavailable = onSnapshot(collection(db, "unavailableSlots"), (snapshot) => {
      const data: UnavailableSlot[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          date: docData.startDate || docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || "",
          reason: docData.reason || "",
          leaveDays: docData.leaveDays || 1,
          endDate: docData.endDate || "",
          isMultipleDays: docData.isMultipleDays || false
        });
      });
      setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)));
    });

    return () => {
      unsubscribeAppointments();
      unsubscribeUnavailable();
    };
  }, [fetchAppointments, fetchTodaysAppointmentsDirectly, fetchUnavailableSlots]);

  // ✅ FIXED: Enhanced handleAddUnavailable for proper multiple days handling
// 🔹 FIXED: Enhanced handleAddUnavailable with duplicate prevention
const handleAddUnavailable = async () => {
  if (!newUnavailable.date) {
    alert("Please select a date.");
    return;
  }

  if (!newUnavailable.reason.trim()) {
    alert("Please provide a reason for your unavailability.");
    return;
  }

  setIsLoading(true);
  try {
    const currentUser = auth.currentUser;
    const userDoc = currentUser ? await getDoc(doc(db, "users", currentUser.uid)) : null;
    const userData = userDoc?.exists() ? userDoc.data() : null;
    const vetName = userData?.name || "Veterinarian";

    const startDate = new Date(newUnavailable.date);
    let endDate = startDate;

    // Calculate end date for multiple days
    if (newUnavailable.isMultipleDays && newUnavailable.leaveDays > 1) {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + newUnavailable.leaveDays - 1);
    }

    // ✅ CHECK FOR EXISTING UNAVAILABLE SLOTS FIRST
    const existingSlotsSnapshot = await getDocs(collection(db, "unavailableSlots"));
    const existingDates = new Set();
    
    existingSlotsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.date) {
        const dateStr = new Date(data.date).toISOString().split('T')[0];
        existingDates.add(dateStr);
      }
    });

    // Create documents for each day in the range
    const datesToMark = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      // ✅ CHECK IF DATE ALREADY EXISTS
      if (existingDates.has(dateString)) {
        alert(`Date ${dateString} is already marked as unavailable!`);
        setIsLoading(false);
        return;
      }
      
      datesToMark.push(dateString);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // ✅ CREATE ONLY ONE DOCUMENT FOR THE DATE RANGE (not multiple)
    await addDoc(collection(db, "unavailableSlots"), {
      date: newUnavailable.date, // Start date
      startDate: newUnavailable.date,
      endDate: endDate.toISOString().split('T')[0],
      veterinarian: vetName,
      isAllDay: newUnavailable.isAllDay,
      startTime: newUnavailable.isAllDay ? "" : newUnavailable.startTime,
      endTime: newUnavailable.isAllDay ? "" : newUnavailable.endTime,
      reason: newUnavailable.reason,
      leaveDays: newUnavailable.leaveDays,
      isMultipleDays: newUnavailable.isMultipleDays && newUnavailable.leaveDays > 1,
      createdAt: new Date().toISOString(),
      // ✅ Add all dates in range for easy checking
      allDatesInRange: datesToMark
    });

    if (newUnavailable.isMultipleDays && newUnavailable.leaveDays > 1) {
      alert(`Unavailable time marked successfully for ${newUnavailable.leaveDays} days (${newUnavailable.date} to ${endDate.toISOString().split('T')[0]})!`);
    } else {
      alert("Unavailable time marked successfully!");
    }

    setShowUnavailableModal(false);
    setNewUnavailable({
      date: new Date().toISOString().split('T')[0],
      isAllDay: true,
      startTime: "08:00",
      endTime: "09:00",
      reason: "",
      leaveDays: 1,
      isMultipleDays: false
    });
  } catch (error) {
    console.error("Error marking unavailable:", error);
    alert("Failed to mark unavailable time. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

  const handleDeleteUnavailable = async (id: string) => {
    try {
      await deleteDoc(doc(db, "unavailableSlots", id));
      setShowCancelUnavailableModal(false);
      setUnavailableToCancel(null);
      alert("Unavailable date removed successfully!");
    } catch (error) {
      console.error("Error deleting unavailable slot:", error);
      alert("Failed to remove unavailable date. Please try again.");
    }
  };

  const openCancelUnavailableModal = (slot: UnavailableSlot) => {
    setUnavailableToCancel(slot);
    setShowCancelUnavailableModal(true);
  };

  const closeCancelUnavailableModal = () => {
    setShowCancelUnavailableModal(false);
    setUnavailableToCancel(null);
  };

  // ✅ FIXED: Enhanced formatDate function for date ranges
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateRange = (startDate: string, endDate?: string, isMultipleDays?: boolean) => {
    const start = new Date(startDate);
    const formattedStart = start.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });

    if (isMultipleDays && endDate) {
      const end = new Date(endDate);
      const formattedEnd = end.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      });
      
      // If same month: "Dec 25-28"
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-PH", { month: "short" })} ${start.getDate()}-${end.getDate()}`;
      } 
      // Different months: "Dec 25 - Jan 2"
      else {
        return `${formattedStart} - ${formattedEnd}`;
      }
    }
    
    return formattedStart;
  };

  // OTP 2FA Functions (unchanged)
  const handleSendOTP = async () => {
    if (!otpEmail) {
      alert("Please enter your email address");
      return;
    }

    setIsSendingOTP(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("User not authenticated");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userDoc.data();
      const userName = userData?.name || "Veterinarian";

      const response = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: otpEmail,
          name: userName
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('otpHash', data.otpHash);
        setOtpSent(true);
        alert("OTP sent successfully to your email! Please check your inbox.");
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      alert(error instanceof Error ? error.message : "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (verificationCode.length !== 6) {
      alert("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("User not authenticated");
        return;
      }

      const otpHash = localStorage.getItem('otpHash');
      if (!otpHash) {
        alert("OTP session expired. Please request a new OTP.");
        return;
      }

      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: otpEmail,
          code: verificationCode,
          otpHash: otpHash,
          userId: currentUser.uid
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date().toISOString()
        });
        
        setTwoFactorEnabled(true);
        localStorage.setItem('twoFactorEnabled', 'true');
        
        localStorage.removeItem('otpHash');
        setShowOTPSetup(false);
        setVerificationCode("");
        setOtpSent(false);
        
        alert("Two-Factor Authentication enabled successfully!");
      } else {
        throw new Error(data.error || 'Failed to verify OTP');
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      alert(error instanceof Error ? error.message : "Failed to verify OTP. Please try again.");
    }
  };

  const handleDisable2FA = async () => {
    if (confirm("Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.")) {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert("User not authenticated");
          return;
        }

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          twoFactorEnabled: false,
          twoFactorDisabledAt: new Date().toISOString()
        });

        setTwoFactorEnabled(false);
        localStorage.setItem('twoFactorEnabled', 'false');
        localStorage.removeItem('otpHash');
        
        alert("Two-Factor Authentication disabled successfully!");
      } catch (error) {
        console.error("Error disabling 2FA:", error);
        alert("Failed to disable 2FA. Please try again.");
      }
    }
  };

  const openAppointmentDetails = (appointment: AppointmentType) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const closeAppointmentDetails = () => {
    setShowAppointmentDetails(false);
    setSelectedAppointment(null);
  };

  const closeUnavailableDetails = () => {
    setShowUnavailableDetails(false);
    setSelectedUnavailable(null);
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case "Confirmed":
        return "#28a745";
      case "Cancelled":
        return "#dc3545";
      case "Done":
        return "#007bff";
      case "Pet Registered":
        return "#17a2b8";
      case "Booked by Admin":
        return "#17a2b8";
      default:
        return "#ffc107";
    }
  };

  const filteredAppointments = selectedMonth
    ? appointments.filter((appt) => {
        const date = new Date(appt.date);
        return date.getMonth() === months.indexOf(selectedMonth);
      })
    : appointments;

  const filteredUnavailableSlots = selectedMonth
    ? unavailableSlots.filter((slot) => {
        const date = new Date(slot.date);
        return date.getMonth() === months.indexOf(selectedMonth);
      })
    : unavailableSlots;

  if (!isMounted) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f8fafc'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <MenuToggle 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              $isOpen={isSidebarOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </MenuToggle>
            <Logo>
              <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
              <LogoText>
                <ClinicName>RL Clinic</ClinicName>
                <LogoSubtext>Fursure Care - Vet Dashboard</LogoSubtext>
              </LogoText>
            </Logo>
          </BrandSection>
          <UserSection>
            <VetBadge>Veterinarian</VetBadge>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserSection>
        </HeaderBar>

        <DashboardLayout>
          <Sidebar $isOpen={isSidebarOpen}>
            <SidebarHeader>
              <SidebarTitleRow>
                <SidebarTitle>Vet Menu</SidebarTitle>
              </SidebarTitleRow>
            </SidebarHeader>

            <MenuList>
              <MenuItem 
                $active={viewMode === "dashboard"} 
                onClick={() => setViewMode("dashboard")}
              >
                <MenuIcon>📊</MenuIcon>
                <MenuText>Dashboard</MenuText>
              </MenuItem>

              <MenuItem 
                $active={viewMode === "today"} 
                onClick={() => setViewMode("today")}
              >
                <MenuIcon>📅</MenuIcon>
                <MenuText>Today&apos;s Appointments</MenuText>
                {todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length > 0 && (
                  <MenuCount>{todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length}</MenuCount>
                )}
              </MenuItem>

              <MenuItem 
                $active={viewMode === "appointments"} 
                onClick={() => setViewMode("appointments")}
              >
                <MenuIcon>📋</MenuIcon>
                <MenuText>All Appointments</MenuText>
                {appointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length > 0 && (
                  <MenuCount>{appointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length}</MenuCount>
                )}
              </MenuItem>

              <MenuItem 
                $active={viewMode === "unavailable"} 
                onClick={() => setViewMode("unavailable")}
              >
                <MenuIcon>⏰</MenuIcon>
                <MenuText>My Availability</MenuText>
                {unavailableSlots.length > 0 && (
                  <MenuCount>{unavailableSlots.length}</MenuCount>
                )}
              </MenuItem>

              <MenuItem 
                $active={viewMode === "settings"} 
                onClick={() => setViewMode("settings")}
              >
                <MenuIcon>⚙️</MenuIcon>
                <MenuText>Settings</MenuText>
              </MenuItem>
            </MenuList>
          </Sidebar>

          {!isSidebarOpen && (
            <FloatingMenuButton onClick={() => setIsSidebarOpen(true)}>
              ☰
            </FloatingMenuButton>
          )}

          <ContentArea $sidebarOpen={isSidebarOpen}>
            {/* DASHBOARD VIEW */}
            {viewMode === "dashboard" && (
              <>
                <DashboardHeader>
                  <ContentTitle>Veterinarian Dashboard</ContentTitle>
                  <ContentSubtitle>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ContentSubtitle>
                </DashboardHeader>

                <StatisticsSection>
                  <SectionHeader>
                    <SectionTitle>📊 Quick Overview</SectionTitle>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchTodaysAppointmentsDirectly();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </SectionHeader>

                  <StatsGrid>
                    <StatsCard $delay={0.1}>
                      <StatsIcon>📅</StatsIcon>
                      <StatsTitle>Today&apos;s Appointments</StatsTitle>
                      <StatsNumber $color="#34B89C">{todaysAppointments.length}</StatsNumber>
                    </StatsCard>
                    
                    <StatsCard $delay={0.2}>
                      <StatsIcon>⏰</StatsIcon>
                      <StatsTitle>Unavailable Slots</StatsTitle>
                      <StatsNumber $color="#8884d8">{unavailableSlots.length}</StatsNumber>
                    </StatsCard>
                    
                    <StatsCard $delay={0.3}>
                      <StatsIcon>📋</StatsIcon>
                      <StatsTitle>Total Appointments</StatsTitle>
                      <StatsNumber $color="#82ca9d">{appointments.length}</StatsNumber>
                    </StatsCard>

                    <StatsCard $delay={0.4}>
                      <StatsIcon>✅</StatsIcon>
                      <StatsTitle>Completed Today</StatsTitle>
                      <StatsNumber $color="#007bff">
                        {todaysAppointments.filter(appt => appt.status === "Done").length}
                      </StatsNumber>
                    </StatsCard>
                  </StatsGrid>
                </StatisticsSection>

                <AppointmentsSection>
                  <SectionHeader>
                    <SectionTitle>Today&apos;s Appointments</SectionTitle>
                    <Badge>
                      {todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length}
                    </Badge>
                  </SectionHeader>

                  {todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length === 0 ? (
                    <EmptyState>
                      <EmptyStateIcon>📅</EmptyStateIcon>
                      <EmptyStateText>No appointments scheduled for today</EmptyStateText>
                    </EmptyState>
                  ) : (
                    <AppointmentsGrid>
                      {todaysAppointments
                        .filter(appt => appt.status !== "Done" && appt.status !== "Cancelled")
                        .map((appointment, index) => {
                          const borderColor = statusColor(appointment.status);
                          return (
                            <AppointmentCard
                              key={appointment.id}
                              $delay={index * 0.1}
                              $borderLeftColor={borderColor}
                            >
                              <AppointmentHeader>
                                <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                                <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                  {appointment.status}
                                </StatusBadge>
                              </AppointmentHeader>
                              <AppointmentDetails>
                                <DetailRow>
                                  <DetailLabelShort>Client:</DetailLabelShort>
                                  <DetailValueShort>{appointment.clientName}</DetailValueShort>
                                </DetailRow>
                                <DetailRow>
                                  <DetailLabelShort>Pet:</DetailLabelShort>
                                  <DetailValueShort>{appointment.petName || "-"}</DetailValueShort>
                                </DetailRow>
                                <DetailRow>
                                  <DetailLabelShort>Type:</DetailLabelShort>
                                  <DetailValueShort>{appointment.petType || "-"}</DetailValueShort>
                                </DetailRow>
                                <DetailRow>
                                  <DetailLabelShort>Service:</DetailLabelShort>
                                  <DetailValueShort>{appointment.serviceType || "Check Up"}</DetailValueShort>
                                </DetailRow>
                              </AppointmentDetails>
                              <AppointmentActions>
                                <ActionButton
                                  $variant="primary"
                                  onClick={() => openAppointmentDetails(appointment)}
                                >
                                  👁 View
                                </ActionButton>
                              </AppointmentActions>
                            </AppointmentCard>
                          );
                        })}
                    </AppointmentsGrid>
                  )}
                </AppointmentsSection>

                <QuickActionsSection>
                  <SectionTitle>Quick Actions</SectionTitle>
                  <QuickActionsGrid>
                    <QuickActionCard onClick={() => setViewMode("appointments")}>
                      <QuickActionIcon>📋</QuickActionIcon>
                      <QuickActionText>View All Appointments</QuickActionText>
                    </QuickActionCard>
                    <QuickActionCard onClick={() => setShowUnavailableModal(true)}>
                      <QuickActionIcon>⏰</QuickActionIcon>
                      <QuickActionText>Mark Unavailable</QuickActionText>
                    </QuickActionCard>
                    <QuickActionCard onClick={() => setViewMode("unavailable")}>
                      <QuickActionIcon>📅</QuickActionIcon>
                      <QuickActionText>My Schedule</QuickActionText>
                    </QuickActionCard>
                    <QuickActionCard onClick={() => router.push("/medicalrecord")}>
                      <QuickActionIcon>📖</QuickActionIcon>
                      <QuickActionText>Medical Records</QuickActionText>
                    </QuickActionCard>
                  </QuickActionsGrid>
                </QuickActionsSection>
              </>
            )}

            {/* TODAY'S APPOINTMENTS VIEW */}
            {viewMode === "today" && (
              <AppointmentsSection>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Today&apos;s Appointments</ContentTitle>
                  <ContentSubtitle>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ContentSubtitle>
                </DashboardHeader>

                <SectionHeader>
                  <ControlsContainer>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchTodaysAppointmentsDirectly();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                {todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length === 0 ? (
                  <NoAppointments>
                    No appointments for today.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {todaysAppointments
                      .filter(appt => appt.status !== "Done" && appt.status !== "Cancelled")
                      .map((appt, index) => {
                        const borderColor = statusColor(appt.status);
                        return (
                          <AppointmentCard key={appt.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                            <AppointmentHeader>
                              <AppointmentTime>{appt.timeSlot}</AppointmentTime>
                              <StatusBadge $status={appt.status} style={{ backgroundColor: borderColor }}>
                                {appt.status}
                              </StatusBadge>
                            </AppointmentHeader>
                            <AppointmentDetails>
                              <DetailRow>
                                <DetailLabel>Client:</DetailLabel>
                                <DetailValue>{appt.clientName}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Pet:</DetailLabel>
                                <DetailValue>{appt.petName || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Type:</DetailLabel>
                                <DetailValue>{appt.petType || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Breed:</DetailLabel>
                                <DetailValue>{appt.petBreed || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Service:</DetailLabel>
                                <DetailValue>{appt.serviceType || "Check Up"}</DetailValue>
                              </DetailRow>
                            </AppointmentDetails>
                            <AppointmentActions>
                              <ActionButton
                                $variant="primary"
                                onClick={() => openAppointmentDetails(appt)}
                              >
                                👁 View
                              </ActionButton>
                            </AppointmentActions>
                          </AppointmentCard>
                        );
                      })}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}

            {/* ALL APPOINTMENTS VIEW */}
            {viewMode === "appointments" && (
              <AppointmentsSection>
                <SectionHeader>
                  <SectionTitle>All Appointments</SectionTitle>
                  <ControlsContainer>
                    <MonthFilter>
                      <MonthSelect value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {months.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </MonthSelect>
                    </MonthFilter>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                <SectionSubtitle>Active Appointments</SectionSubtitle>
                {filteredAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length === 0 ? (
                  <NoAppointments>
                    No active appointments found.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {filteredAppointments
                      .filter(appt => appt.status !== "Done" && appt.status !== "Cancelled")
                      .map((appointment, index) => {
                        const borderColor = statusColor(appointment.status);
                        return (
                          <AppointmentCard key={appointment.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                            <AppointmentHeader>
                              <AppointmentDate>{appointment.date}</AppointmentDate>
                              <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                {appointment.status}
                              </StatusBadge>
                            </AppointmentHeader>
                            <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                            <AppointmentDetails>
                              <DetailRow>
                                <DetailLabel>Client:</DetailLabel>
                                <DetailValue>{appointment.clientName}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Pet:</DetailLabel>
                                <DetailValue>{appointment.petName || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Type:</DetailLabel>
                                <DetailValue>{appointment.petType || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Service:</DetailLabel>
                                <DetailValue>{appointment.serviceType || "Check Up"}</DetailValue>
                              </DetailRow>
                            </AppointmentDetails>
                            <AppointmentActions>
                              <ActionButton
                                $variant="primary"
                                onClick={() => openAppointmentDetails(appointment)}
                              >
                                👁 View
                              </ActionButton>
                            </AppointmentActions>
                          </AppointmentCard>
                        );
                      })}
                  </AppointmentsGrid>
                )}

                <SectionSubtitle style={{ marginTop: '3rem', color: '#007bff' }}>
                  Completed Appointments
                </SectionSubtitle>
                {filteredAppointments.filter(appt => appt.status === "Done").length === 0 ? (
                  <NoAppointments>
                    No completed appointments.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {filteredAppointments
                      .filter(appt => appt.status === "Done")
                      .map((appointment, index) => {
                        const borderColor = statusColor(appointment.status);
                        return (
                          <AppointmentCard key={appointment.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                            <AppointmentHeader>
                              <AppointmentDate>{appointment.date}</AppointmentDate>
                              <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                {appointment.status} ✅
                              </StatusBadge>
                            </AppointmentHeader>
                            <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                            <AppointmentDetails>
                              <DetailRow>
                                <DetailLabel>Client:</DetailLabel>
                                <DetailValue>{appointment.clientName}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Pet:</DetailLabel>
                                <DetailValue>{appointment.petName || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Type:</DetailLabel>
                                <DetailValue>{appointment.petType || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Service:</DetailLabel>
                                <DetailValue>{appointment.serviceType || "Check Up"}</DetailValue>
                              </DetailRow>
                            </AppointmentDetails>
                            <AppointmentActions>
                              <ActionButton
                                $variant="primary"
                                onClick={() => openAppointmentDetails(appointment)}
                              >
                                👁 View
                              </ActionButton>
                              <ActionButton
                                $variant="info"
                                onClick={() => router.push("/medicalrecord")}
                              >
                                📋 Records
                              </ActionButton>
                            </AppointmentActions>
                          </AppointmentCard>
                        );
                      })}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}

            {/* UNAVAILABLE DATES VIEW */}
            {viewMode === "unavailable" && (
              <AppointmentsSection>
                <SectionHeader>
                  <SectionTitle>My Unavailable Dates</SectionTitle>
                  <ControlsContainer>
                    <MonthFilter>
                      <MonthSelect value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {months.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </MonthSelect>
                    </MonthFilter>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                    <ActionButton
                      $variant="success"
                      onClick={() => setShowUnavailableModal(true)}
                    >
                      ⏰ Mark Unavailable
                    </ActionButton>
                  </ControlsContainer>
                </SectionHeader>

                {filteredUnavailableSlots.length === 0 ? (
                  <NoAppointments>
                    No unavailable dates set.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {filteredUnavailableSlots.map((slot, index) => (
                      <UnavailableCard key={slot.id} $delay={index * 0.1}>
                        <UnavailableIcon>⏰</UnavailableIcon>
                        <UnavailableInfo>
                          <UnavailableDate>
                            {slot.isMultipleDays && slot.endDate 
                              ? `${formatDateRange(slot.date, slot.endDate, true)}` 
                              : formatDate(slot.date)
                            }
                            {slot.isMultipleDays && slot.leaveDays && slot.leaveDays > 1 && (
                              <span style={{fontSize: '0.75rem', color: '#7f8c8d', marginLeft: '0.5rem'}}>
                                ({slot.leaveDays} days)
                              </span>
                            )}
                          </UnavailableDate>
                          <UnavailableTime>
                            {slot.isAllDay ? "🕐 All Day" : `🕐 ${slot.startTime} - ${slot.endTime}`}
                          </UnavailableTime>
                          {slot.reason && (
                            <UnavailableReason>
                              <strong>📝 Reason:</strong> {slot.reason}
                            </UnavailableReason>
                          )}
                          <UnavailableStatus>Unavailable</UnavailableStatus>
                        </UnavailableInfo>
                        <UnavailableActions>
                          <ActionButton
                            $variant="danger"
                            onClick={() => openCancelUnavailableModal(slot)}
                          >
                            🗑 Cancel
                          </ActionButton>
                        </UnavailableActions>
                      </UnavailableCard>
                    ))}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}

            {/* SETTINGS VIEW */}
            {viewMode === "settings" && (
              <>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Settings</ContentTitle>
                  <ContentSubtitle>Manage your account settings and security</ContentSubtitle>
                </DashboardHeader>

                <SettingsContainer>
                  <SettingsSection>
                    <SettingsSectionTitle>Two-Factor Authentication (2FA)</SettingsSectionTitle>
                    <SettingsSectionDesc>
                      Add an extra layer of security to your account by enabling two-factor authentication via OTP.
                    </SettingsSectionDesc>

                    <TwoFactorCard>
                      <TwoFactorStatus>
                        <StatusIndicator $enabled={twoFactorEnabled} />
                        <StatusText>{twoFactorEnabled ? "2FA is enabled" : "2FA is disabled"}</StatusText>
                      </TwoFactorStatus>

                      {!twoFactorEnabled && !showOTPSetup && (
                        <EnableButton onClick={() => setShowOTPSetup(true)}>
                          Enable Two-Factor Authentication
                        </EnableButton>
                      )}

                      {showOTPSetup && !twoFactorEnabled && (
                        <OTPSetupSection>
                          <OTPSetupTitle>Set up Two-Factor Authentication</OTPSetupTitle>

                          {!otpSent ? (
                            <OTPEmailSection>
                              <Label>Email Address for OTP</Label>
                              <EmailInput
                                type="email"
                                value={otpEmail}
                                onChange={(e) => setOtpEmail(e.target.value)}
                                placeholder="Enter your email"
                                disabled={isSendingOTP}
                              />
                              <SendOTPButton onClick={handleSendOTP} disabled={isSendingOTP || !otpEmail}>
                                {isSendingOTP ? "Sending OTP..." : "Send OTP"}
                              </SendOTPButton>
                            </OTPEmailSection>
                          ) : (
                            <OTPVerificationSection>
                              <OTPInstructions>
                                We&apos;ve sent a 6-digit verification code to <strong>{otpEmail}</strong>. 
                                Please enter it below to enable 2FA. The code will expire in 10 minutes.
                              </OTPInstructions>

                              <OTPInputGroup>
                                <Label>Enter 6-digit OTP</Label>
                                <OTPInput
                                  type="text"
                                  maxLength={6}
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                                  placeholder="000000"
                                  autoComplete="one-time-code"
                                />
                                <ResendOTPText>
                                  Didn&apos;t receive the code?{" "}
                                  <ResendLink onClick={handleSendOTP} disabled={isSendingOTP}>
                                    {isSendingOTP ? "Sending..." : "Resend OTP"}
                                  </ResendLink>
                                </ResendOTPText>
                              </OTPInputGroup>

                              <OTPButtonGroup>
                                <CancelButton
                                  onClick={() => {
                                    setShowOTPSetup(false);
                                    setOtpSent(false);
                                    setVerificationCode("");
                                    localStorage.removeItem('otpHash');
                                  }}
                                >
                                  Cancel
                                </CancelButton>
                                <SubmitButton onClick={handleVerifyOTP} disabled={verificationCode.length !== 6}>
                                  Verify & Enable 2FA
                                </SubmitButton>
                              </OTPButtonGroup>
                            </OTPVerificationSection>
                          )}
                        </OTPSetupSection>
                      )}

                      {twoFactorEnabled && (
                        <DisableButton onClick={handleDisable2FA}>Disable Two-Factor Authentication</DisableButton>
                      )}
                    </TwoFactorCard>
                  </SettingsSection>

                  <SettingsSection>
                    <SettingsSectionTitle>Account Information</SettingsSectionTitle>
                    <InfoGrid>
                      <InfoItem>
                        <InfoLabel>Email:</InfoLabel>
                        <InfoValue>{auth.currentUser?.email || "vet@rlclinic.com"}</InfoValue>
                      </InfoItem>
                      <InfoItem>
                        <InfoLabel>Role:</InfoLabel>
                        <InfoValue>Veterinarian</InfoValue>
                      </InfoItem>
                      <InfoItem>
                        <InfoLabel>Last Login:</InfoLabel>
                        <InfoValue>{new Date().toLocaleDateString()}</InfoValue>
                      </InfoItem>
                    </InfoGrid>
                  </SettingsSection>
                </SettingsContainer>
              </>
            )}

            {/* MARK UNAVAILABLE MODAL */}
            {showUnavailableModal && (
              <ModalOverlay onClick={() => !isLoading && setShowUnavailableModal(false)}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Mark Unavailable Time</ModalTitle>
                    <CloseButton onClick={() => !isLoading && setShowUnavailableModal(false)} disabled={isLoading}>
                      ×
                    </CloseButton>
                  </ModalHeader>
                  <Form onSubmit={(e) => { e.preventDefault(); handleAddUnavailable(); }}>
                    <FormColumns>
                      <FormColumn>
                        <FormGroup>
                          <Label>Leave Duration</Label>
                          <DurationToggle>
                            <ToggleOption 
                              $active={!newUnavailable.isMultipleDays} 
                              onClick={() => setNewUnavailable({...newUnavailable, isMultipleDays: false, leaveDays: 1})}
                            >
                              Single Day
                            </ToggleOption>
                            <ToggleOption 
                              $active={newUnavailable.isMultipleDays} 
                              onClick={() => setNewUnavailable({...newUnavailable, isMultipleDays: true})}
                            >
                              Multiple Days
                            </ToggleOption>
                          </DurationToggle>
                        </FormGroup>

                        <FormGroup>
                          <Label>Start Date *</Label>
                          <Input
                            type="date"
                            value={newUnavailable.date}
                            onChange={(e) => setNewUnavailable({
                              ...newUnavailable,
                              date: e.target.value
                            })}
                            required
                            disabled={isLoading}
                          />
                        </FormGroup>

                        {newUnavailable.isMultipleDays && (
                          <FormGroup>
                            <Label>Number of Days *</Label>
                            <Input
                              type="number"
                              min="1"
                              max="30"
                              value={newUnavailable.leaveDays}
                              onChange={(e) => setNewUnavailable({
                                ...newUnavailable,
                                leaveDays: parseInt(e.target.value) || 1
                              })}
                              required
                              disabled={isLoading}
                            />
                            <HelpText>Maximum 30 days</HelpText>
                          </FormGroup>
                        )}

                        <FormGroup>
                          <Label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={newUnavailable.isAllDay}
                              onChange={(e) => setNewUnavailable({
                                ...newUnavailable,
                                isAllDay: e.target.checked
                              })}
                            />
                            <span className="checkmark"></span>
                            All day unavailable
                          </Label>
                        </FormGroup>
                      </FormColumn>

                      <FormColumn>
                        {!newUnavailable.isAllDay && (
                          <>
                            <FormGroup>
                              <Label>Start Time *</Label>
                              <Input
                                type="time"
                                value={newUnavailable.startTime}
                                onChange={(e) => setNewUnavailable({
                                  ...newUnavailable,
                                  startTime: e.target.value
                                })}
                                required={!newUnavailable.isAllDay}
                                disabled={isLoading || newUnavailable.isAllDay}
                              />
                            </FormGroup>

                            <FormGroup>
                              <Label>End Time *</Label>
                              <Input
                                type="time"
                                value={newUnavailable.endTime}
                                onChange={(e) => setNewUnavailable({
                                  ...newUnavailable,
                                  endTime: e.target.value
                                })}
                                required={!newUnavailable.isAllDay}
                                disabled={isLoading || newUnavailable.isAllDay}
                              />
                            </FormGroup>
                          </>
                        )}

                        <FormGroup>
                          <Label>Reason for Unavailability *</Label>
                          <TextArea
                            value={newUnavailable.reason}
                            onChange={(e) => setNewUnavailable({
                              ...newUnavailable,
                              reason: e.target.value
                            })}
                            placeholder="Please specify the reason for your unavailability (e.g., vacation, sick leave, training, etc.)"
                            required
                            disabled={isLoading}
                            rows={4}
                          />
                        </FormGroup>
                      </FormColumn>
                    </FormColumns>

                    <ButtonGroup>
                      <CancelButton type="button" onClick={() => setShowUnavailableModal(false)} disabled={isLoading}>
                        Cancel
                      </CancelButton>
                      <SubmitButton
                        type="submit"
                        disabled={isLoading || !newUnavailable.date || !newUnavailable.reason.trim()}
                      >
                        {isLoading ? "Marking..." : "Mark Unavailable"}
                      </SubmitButton>
                    </ButtonGroup>
                  </Form>
                </ModalContent>
              </ModalOverlay>
            )}

            {/* CANCEL UNAVAILABLE MODAL */}
            {showCancelUnavailableModal && unavailableToCancel && (
              <ModalOverlay onClick={closeCancelUnavailableModal}>
                <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                  <ModalHeader>
                    <ModalTitle>Cancel Unavailable Date</ModalTitle>
                    <CloseButton onClick={closeCancelUnavailableModal} disabled={isLoading}>
                      ×
                    </CloseButton>
                  </ModalHeader>
                  <div style={{ padding: "2rem" }}>
                    <p style={{ marginBottom: "1.5rem", color: "#2c3e50" }}>
                      Are you sure you want to remove this unavailable period?
                    </p>
                    
                    <div style={{ 
                      background: "#f8f9fa", 
                      padding: "1rem", 
                      borderRadius: "8px", 
                      marginBottom: "1.5rem" 
                    }}>
                      <DetailRow>
                        <DetailLabel>Period:</DetailLabel>
                        <DetailValue>
                          {unavailableToCancel.isMultipleDays && unavailableToCancel.endDate
                            ? `${formatDate(unavailableToCancel.date)} to ${formatDate(unavailableToCancel.endDate)}`
                            : formatDate(unavailableToCancel.date)
                          }
                        </DetailValue>
                      </DetailRow>
                      <DetailRow>
                        <DetailLabel>Time:</DetailLabel>
                        <DetailValue>
                          {unavailableToCancel.isAllDay ? "All Day" : `${unavailableToCancel.startTime} - ${unavailableToCancel.endTime}`}
                        </DetailValue>
                      </DetailRow>
                      {unavailableToCancel.reason && (
                        <DetailRow>
                          <DetailLabel>Reason:</DetailLabel>
                          <DetailValue>{unavailableToCancel.reason}</DetailValue>
                        </DetailRow>
                      )}
                    </div>

                    <ButtonGroup>
                      <CancelButton 
                        type="button" 
                        onClick={closeCancelUnavailableModal} 
                        disabled={isLoading}
                      >
                        No, Keep It
                      </CancelButton>
                      <ActionButton
                        $variant="danger"
                        onClick={() => handleDeleteUnavailable(unavailableToCancel.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Removing..." : "Yes, Remove It"}
                      </ActionButton>
                    </ButtonGroup>
                  </div>
                </ModalContent>
              </ModalOverlay>
            )}

            {/* APPOINTMENT DETAILS MODAL */}
            {showAppointmentDetails && selectedAppointment && (
              <ModalOverlay onClick={closeAppointmentDetails}>
                <DetailsModal onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Appointment Details</ModalTitle>
                    <CloseButton onClick={closeAppointmentDetails}>×</CloseButton>
                  </ModalHeader>
                  <DetailsContent>
                    <DetailSection>
                      <DetailSectionTitle>Client Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Client Name:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.clientName}</DetailValueLarge>
                      </DetailItem>
                    </DetailSection>

                    <DetailSection>
                      <DetailSectionTitle>Pet Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Pet Name:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.petName || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Pet Type:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.petType || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Breed:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.petBreed || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Gender:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.gender || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Birthday:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.birthday || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Color/Markings:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.color || "-"}</DetailValueLarge>
                      </DetailItem>
                    </DetailSection>

                    <DetailSection>
                      <DetailSectionTitle>Appointment Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Date:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.date}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Time Slot:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.timeSlot}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Status:</DetailLabelLarge>
                        <StatusBadge $status={selectedAppointment.status} style={{ backgroundColor: statusColor(selectedAppointment.status) }}>
                          {selectedAppointment.status}
                        </StatusBadge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Service Type:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.serviceType || "Check Up"}</DetailValueLarge>
                      </DetailItem>
                    </DetailSection>
                  </DetailsContent>
                </DetailsModal>
              </ModalOverlay>
            )}

            {/* UNAVAILABLE DETAILS MODAL */}
            {showUnavailableDetails && selectedUnavailable && (
              <ModalOverlay onClick={closeUnavailableDetails}>
                <DetailsModal onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Unavailable Date Details</ModalTitle>
                    <CloseButton onClick={closeUnavailableDetails}>×</CloseButton>
                  </ModalHeader>
                  <DetailsContent>
                    <DetailSection>
                      <DetailSectionTitle>Unavailability Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Date:</DetailLabelLarge>
                        <DetailValueLarge>{formatDate(selectedUnavailable.date)}</DetailValueLarge>
                      </DetailItem>
                      {selectedUnavailable.endDate && (
                        <DetailItem>
                          <DetailLabelLarge>End Date:</DetailLabelLarge>
                          <DetailValueLarge>{formatDate(selectedUnavailable.endDate)}</DetailValueLarge>
                        </DetailItem>
                      )}
                      {selectedUnavailable.leaveDays && selectedUnavailable.leaveDays > 1 && (
                        <DetailItem>
                          <DetailLabelLarge>Duration:</DetailLabelLarge>
                          <DetailValueLarge>{selectedUnavailable.leaveDays} days</DetailValueLarge>
                        </DetailItem>
                      )}
                      <DetailItem>
                        <DetailLabelLarge>Veterinarian:</DetailLabelLarge>
                        <DetailValueLarge>{selectedUnavailable.veterinarian}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Duration:</DetailLabelLarge>
                        <DetailValueLarge>
                          {selectedUnavailable.isAllDay ? "All Day" : `${selectedUnavailable.startTime} - ${selectedUnavailable.endTime}`}
                        </DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Reason:</DetailLabelLarge>
                        <DetailValueLarge>
                          {selectedUnavailable.reason || "No reason provided"}
                        </DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Status:</DetailLabelLarge>
                        <UnavailableStatus>Unavailable</UnavailableStatus>
                      </DetailItem>
                    </DetailSection>
                  </DetailsContent>
                </DetailsModal>
              </ModalOverlay>
            )}
          </ContentArea>
        </DashboardLayout>
      </PageContainer>
    </>
  );
};

// Styled Components (same as before - keep all your existing styled components)

const PageContainer = styled.div`
  min-height: 100vh;
  background-color: #f8fafc;
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #34B89C;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
`;

const BrandSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const MenuToggle = styled.button<{ $isOpen: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 30px;
  height: 25px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;

  span {
    width: 100%;
    height: 3px;
    background: #2c3e50;
    border-radius: 5px;
    transition: all 0.3s linear;
    transform-origin: 1px;

    &:first-child {
      transform: ${({ $isOpen }) => ($isOpen ? 'rotate(45deg)' : 'rotate(0)')};
    }

    &:nth-child(2) {
      opacity: ${({ $isOpen }) => ($isOpen ? '0' : '1')};
      transform: ${({ $isOpen }) => ($isOpen ? 'translateX(20px)' : 'translateX(0)')};
    }

    &:nth-child(3) {
      transform: ${({ $isOpen }) => ($isOpen ? 'rotate(-45deg)' : 'rotate(0)')};
    }
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const LogoImage = styled.img`
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
`;

const LogoText = styled.div`
  display: flex;
  color: #0080ff;
  flex-direction: column;
`;

const ClinicName = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #000000;
`;

const LogoSubtext = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #000000;
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const VetBadge = styled.span`
  background: #009ece;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
`;

const LogoutButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;

  &:hover {
    background: #c0392b;
  }
`;

const DashboardLayout = styled.div`
  display: flex;
  min-height: calc(100vh - 80px);
`;

const Sidebar = styled.aside<SidebarProps>`
  width: ${props => props.$isOpen ? '280px' : '0'};
  background: white;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    position: fixed;
    height: 100vh;
    z-index: 99;
    width: ${props => props.$isOpen ? '280px' : '0'};
  }
`;

const SidebarHeader = styled.div`
  padding: 2rem 1.5rem 1rem;
  border-bottom: 1px solid #ecf0f1;
`;

const SidebarTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
`;

const MenuList = styled.div`
  flex: 1;
  padding: 1rem 0;
`;

const MenuItem = styled.div<MenuItemProps>`
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? '#f8f9fa' : 'transparent'};
  border-right: ${props => props.$active ? '4px solid #34B89C' : '4px solid transparent'};
  color: ${props => props.$active ? '#34B89C' : '#2c3e50'};

  &:hover {
    background: #f8f9fa;
    color: #34B89C;
  }
`;

const MenuIcon = styled.span`
  font-size: 1.25rem;
  margin-right: 1rem;
`;

const MenuText = styled.span`
  flex: 1;
  font-weight: 500;
`;

const MenuCount = styled.span`
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
`;

const FloatingMenuButton = styled.button`
  position: fixed;
  top: 1rem;
  left: 1rem;
  background: #34B89C;
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 98;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 769px) {
    display: none;
  }
`;

const ContentArea = styled.main<{ $sidebarOpen: boolean }>`
  flex: 1;
  padding: 2rem;
  margin-left: ${props => props.$sidebarOpen ? '0' : '0'};
  transition: margin-left 0.3s ease;

  @media (max-width: 768px) {
    margin-left: 0;
    padding: 1rem;
  }
`;

const DashboardHeader = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const ContentTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const ContentSubtitle = styled.p`
  font-size: 1.125rem;
  color: #7f8c8d;
  margin: 0;
`;

const StatisticsSection = styled.section`
  margin-bottom: 3rem;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
`;

const SectionSubtitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 2rem 0 1rem 0;
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const RefreshButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2980b9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatsCard = styled.div<{ $delay: number }>`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
  animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  }
`;

const StatsIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const StatsTitle = styled.h3`
  font-size: 1rem;
  color: #7f8c8d;
  margin: 0 0 0.5rem 0;
  font-weight: 500;
`;

const StatsNumber = styled.div<{ $color: string }>`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.$color};
  margin: 0;
`;

const AppointmentsSection = styled.section`
  margin-bottom: 3rem;
`;

const Badge = styled.span`
  background: #e74c3c;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
`;

const AppointmentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
`;

const AppointmentCard = styled.div<AppointmentCardProps>`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border-left: 4px solid ${props => props.$borderLeftColor};
  animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  }
`;

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const AppointmentDate = styled.span`
  font-weight: 600;
  color: #2c3e50;
`;

const AppointmentTime = styled.span`
  font-size: 0.875rem;
  color: #7f8c8d;
  margin-bottom: 1rem;
  display: block;
`;

const StatusBadge = styled.span<{ $status?: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
`;

const AppointmentDetails = styled.div`
  margin-bottom: 1rem;
`;

const DetailRow = styled.div`
  display: flex; 
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
`;

const DetailLabel = styled.span`
  font-weight: 500;
  color: #7f8c8d;
  min-width: 80px;
`;

const DetailValue = styled.span`
  color: #2c3e50;
  flex: 1;
`;

const DetailLabelShort = styled(DetailLabel)`
  min-width: 60px;
`;

const DetailValueShort = styled(DetailValue)``;

const AppointmentActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant: "primary" | "success" | "warning" | "danger" | "info" }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;

  background: ${props => 
    props.$variant === "primary" ? "#3498db" :
    props.$variant === "success" ? "#28a745" :
    props.$variant === "warning" ? "#ffc107" :
    props.$variant === "danger" ? "#dc3545" :
    "#17a2b8"
  };
  
  color: ${props => 
    props.$variant === "warning" ? "#212529" : "white"
  };

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const QuickActionsSection = styled.section`
  margin-bottom: 3rem;
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
`;

const QuickActionCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
    background: #f8f9fa;
  }
`;

const QuickActionIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const QuickActionText = styled.p`
  margin: 0;
  font-weight: 600;
  color: #2c3e50;
`;

const NoAppointments = styled.div`
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
  font-style: italic;
`;

const MonthFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MonthSelect = styled.select`
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
`;

const UnavailableCard = styled.div<{ $delay: number }>`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 1rem;
  animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  }
`;

const UnavailableIcon = styled.div`
  font-size: 2rem;
  color: #e74c3c;
`;

const UnavailableInfo = styled.div`
  flex: 1;
`;

const UnavailableDate = styled.h4`
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #2c3e50;
`;

const UnavailableTime = styled.p`
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  color: #7f8c8d;
`;

const UnavailableReason = styled.p`
  margin: 0.5rem 0;
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #2c3e50;
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  border-radius: 4px;
  line-height: 1.4;
`;

const UnavailableStatus = styled.span`
  color: #e74c3c;
  font-weight: 600;
  font-size: 0.75rem;
`;

const UnavailableActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
`;

const EmptyStateIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const EmptyStateText = styled.p`
  margin: 0;
  font-size: 1rem;
`;

const SettingsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const SettingsSection = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
`;

const SettingsSectionTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
`;

const SettingsSectionDesc = styled.p`
  margin: 0 0 1.5rem 0;
  color: #7f8c8d;
  font-size: 0.875rem;
`;

const TwoFactorCard = styled.div`
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
`;

const TwoFactorStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const StatusIndicator = styled.div<{ $enabled: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.$enabled ? "#28a745" : "#dc3545"};
`;

const StatusText = styled.span`
  font-weight: 500;
  color: #2c3e50;
`;

const EnableButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover {
    background: #218838;
  }
`;

const DisableButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover {
    background: #c82333;
  }
`;

const OTPSetupSection = styled.div`
  margin-top: 1rem;
`;

const OTPSetupTitle = styled.h4`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #2c3e50;
`;

const OTPEmailSection = styled.div`
  margin-bottom: 1rem;
`;

const EmailInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: #3498db;
  }

  &:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
  }
`;

const SendOTPButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2980b9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const OTPVerificationSection = styled.div``;

const OTPInstructions = styled.p`
  margin: 0 0 1rem 0;
  color: #7f8c8d;
  font-size: 0.875rem;
`;

const OTPInputGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const OTPInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1.125rem;
  text-align: center;
  letter-spacing: 0.5rem;
  margin-bottom: 0.5rem;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const ResendOTPText = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: #7f8c8d;
`;

const ResendLink = styled.button`
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.75rem;

  &:hover:not(:disabled) {
    color: #2980b9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const OTPButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const InfoLabel = styled.div`
  font-size: 0.875rem;
  color: #7f8c8d;
  margin-bottom: 0.25rem;
`;

const InfoValue = styled.div`
  font-size: 1rem;
  color: #2c3e50;
  font-weight: 500;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  animation: ${slideIn} 0.3s ease-out;
`;

const DetailsModal = styled.div`
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: ${slideIn} 0.3s ease-out;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #ecf0f1;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #2c3e50;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Form = styled.form`
  padding: 2rem;
`;

const FormColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const FormColumn = styled.div``;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.875rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3498db;
  }

  &:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
  }
`;

const DurationToggle = styled.div`
  display: flex;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1rem;
`;

const ToggleOption = styled.div<{ $active: boolean }>`
  flex: 1;
  padding: 0.75rem;
  text-align: center;
  cursor: pointer;
  background: ${props => props.$active ? '#3498db' : 'white'};
  color: ${props => props.$active ? 'white' : '#2c3e50'};
  font-weight: ${props => props.$active ? '600' : '400'};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$active ? '#3498db' : '#f8f9fa'};
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #3498db;
  }

  &:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
  }
`;

const HelpText = styled.span`
  font-size: 0.75rem;
  color: #7f8c8d;
  margin-top: 0.25rem;
  display: block;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #545b62;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #218838;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DetailsContent = styled.div`
  padding: 2rem;
`;

const DetailSection = styled.div`
  margin-bottom: 2rem;
`;

const DetailSectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #2c3e50;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ecf0f1;
`;

const DetailItem = styled.div`
  display: flex;
  margin-bottom: 1rem;
  font-size: 0.875rem;
`;

const DetailLabelLarge = styled.span`
  font-weight: 500;
  color: #7f8c8d;
  min-width: 120px;
`;

const DetailValueLarge = styled.span`
  color: #2c3e50;
  flex: 1;
`;

export default VetDashboard;