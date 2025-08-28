'use client';

import React, { useState, useEffect } from "react";
import styled from "styled-components";

// --- Styled Components ---
const Container = styled.div`
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%);
  min-height: 100vh;
  
  @media (max-width: 768px) {
    padding: 15px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const Title = styled.h1`
  color: #2c3e50;
  margin: 0;
  font-size: 2.2rem;
  text-align: center;
  flex: 1;
  
  @media (max-width: 768px) {
    font-size: 1.8rem;
    text-align: left;
  }
`;

const Section = styled.div`
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
`;

const SectionTitle = styled.h3`
  color: #3498db;
  margin-bottom: 15px;
  font-size: 1.4rem;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 8px;
  
  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const NotificationGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
`;

const NotificationCard = styled.div<{ read: boolean }>`
  display: flex;
  padding: 15px;
  border-radius: 12px;
  background: ${(props) => (props.read ? "#f9f9f9" : "#e8f4fd")};
  border: 2px solid ${(props) => (props.read ? "#e0e0e0" : "#3498db")};
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const NotificationIcon = styled.div`
  margin-right: 15px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #3498db;
  border-radius: 50%;
  color: white;
  font-size: 1.2rem;
`;

const NotificationContent = styled.div`
  flex: 1;
`;

const NotificationDate = styled.div`
  color: #7f8c8d;
  font-size: 0.85rem;
  margin-bottom: 5px;
`;

const NotificationTitle = styled.div`
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
  font-size: 1.1rem;
`;

const NotificationMessage = styled.div`
  color: #7f8c8d;
  margin-bottom: 8px;
  line-height: 1.4;
`;

const VaccineList = styled.ul`
  margin: 10px 0;
  padding-left: 20px;
`;

const VaccineItem = styled.li`
  color: #2c3e50;
  margin-bottom: 5px;
  line-height: 1.4;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 30px;
`;

const Button = styled.button`
  padding: 14px 28px;
  background: #3498db;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 200px;

  &:hover {
    background: #2980b9;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const LoadingText = styled.p`
  text-align: center;
  color: #7f8c8d;
  font-style: italic;
  padding: 20px;
`;

const NoDataText = styled.p`
  text-align: center;
  color: #95a5a6;
  padding: 20px;
`;

// Interface for notification data
interface VaccineSuggestion {
  vaccineName: string;
  reason: string;
  recommendedDate: string;
}

interface Notification {
  id: string;
  date: string;
  message: string;
  read: boolean;
  suggestions: VaccineSuggestion[];
}

// Main Component
const UserVaccinationNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 🔹 Load User Notifications
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // In a real app, you would query notifications for the specific user
    // For this example, we'll simulate some notifications
    const simulateUserNotifications = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sample notifications data
        const sampleNotifications: Notification[] = [
          {
            id: "1",
            date: "2023-10-15T14:30:00Z",
            message: "Your pet is due for vaccinations. Please schedule an appointment with your veterinarian.",
            read: false,
            suggestions: [
              {
                vaccineName: "DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)",
                reason: "Core vaccine – protects against fatal diseases",
                recommendedDate: "2025-09-15"
              },
              {
                vaccineName: "Rabies",
                reason: "Legally required – protects against rabies virus",
                recommendedDate: "2025-09-22"
              }
            ]
          },
          {
            id: "2",
            date: "2023-09-28T10:15:00Z",
            message: "Vaccination reminder for your pet. The following vaccines are recommended:",
            read: true,
            suggestions: [
              {
                vaccineName: "Bordetella (Kennel Cough)",
                reason: "Recommended for dogs exposed to other pets",
                recommendedDate: "2025-09-29"
              }
            ]
          }
        ];
        
        setNotifications(sampleNotifications);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading notifications:", error);
        setIsLoading(false);
      }
    };
    
    simulateUserNotifications();
  }, []);

  // 🔹 Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  // 🔹 Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 🔹 Calculate weeks until recommendedDate
  const getWeeksUntil = (recommendedDate: string) => {
    const today = new Date();
    const recDate = new Date(recommendedDate);
    const diffTime = recDate.getTime() - today.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks > 0 ? `${diffWeeks} week(s)` : "Due now!";
  };

  // Don't render anything until we're on the client to prevent hydration mismatch
  if (!isClient) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => window.history.back()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </BackButton>
          <Title>🐾 Vaccination Notifications</Title>
          <div style={{width: "100px"}}></div> {/* Spacer for alignment */}
        </Header>
        <LoadingText>Loading...</LoadingText>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => window.history.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </BackButton>
        <Title>🐾 Vaccination Notifications</Title>
        <div style={{width: "100px"}}></div> {/* Spacer for alignment */}
      </Header>

      {/* Notifications Section */}
      <Section>
        <SectionTitle>Your Vaccination Notifications:</SectionTitle>
        {isLoading ? (
          <LoadingText>Loading notifications...</LoadingText>
        ) : notifications.length === 0 ? (
          <NoDataText>No notifications found.</NoDataText>
        ) : (
          <NotificationGrid>
            {notifications.map((notification) => (
              <NotificationCard 
                key={notification.id} 
                read={notification.read}
                onClick={() => markAsRead(notification.id)}
              >
                <NotificationIcon>
                  {notification.read ? "✓" : "!"}
                </NotificationIcon>
                <NotificationContent>
                  <NotificationDate>
                    {formatDate(notification.date)}
                  </NotificationDate>
                  <NotificationTitle>
                    Vaccination Recommendation
                  </NotificationTitle>
                  <NotificationMessage>
                    {notification.message}
                  </NotificationMessage>
                  {notification.suggestions && notification.suggestions.length > 0 && (
                    <>
                      <div>Recommended vaccinations:</div>
                      <VaccineList>
                        {notification.suggestions.map((suggestion, index) => (
                          <VaccineItem key={index}>
                            <strong>{suggestion.vaccineName}</strong> - {suggestion.reason} 
                            (Recommended: {suggestion.recommendedDate}, in {getWeeksUntil(suggestion.recommendedDate)})
                          </VaccineItem>
                        ))}
                      </VaccineList>
                    </>
                  )}
                </NotificationContent>
              </NotificationCard>
            ))}
          </NotificationGrid>
        )}
      </Section>

      <ButtonContainer>
        <Button onClick={() => alert("Scheduling appointment...")}>
          Schedule Appointment
        </Button>
      </ButtonContainer>
    </Container>
  );
};

export default UserVaccinationNotifications;  