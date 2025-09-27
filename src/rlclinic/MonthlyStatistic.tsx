'use client';

import React, { useEffect, useState, useCallback, useMemo } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Global Styles
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f0f9f7;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
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
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

interface AppointmentType {
  id: string;
  clientName: string;
  petName?: string;
  petType?: string;
  serviceType?: string;
  date: string;
  timeSlot: string;
  status?: string;
}

interface ServiceStats {
  service: string;
  dogs: number;
  cats: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    fill: string;
    name: string;
  }>;
  label?: string;
}

interface PieTooltipPayload {
  name: string;
  value: number;
  payload: {
    percent?: number;
  };
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayload[];
}

const MonthlyStatistic: React.FC = () => {
  const router = useRouter();
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ 
    totalDogs: 0, 
    totalCats: 0, 
    totalAppointments: 0 
  });

  // Memoized arrays and objects to prevent unnecessary re-renders
  const months = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);

  const services = useMemo(() => [
    "vaccination",
    "checkup", 
    "antiRabies",
    "ultrasound",
    "groom",
    "spayNeuter",
    "deworm"
  ], []);

  const serviceLabels = useMemo(() => ({
    "vaccination": "Vaccination",
    "checkup": "Check Up", 
    "antiRabies": "Anti Rabies",
    "ultrasound": "Ultrasound",
    "groom": "Grooming",
    "spayNeuter": "Spay/Neuter (Kapon)",
    "deworm": "Deworming (Purga)"
  }), []);

  const years = useMemo(() => 
    Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()),
    []
  );

  // Calculate statistics from appointments
  const calculateStats = useCallback(async (appointmentsData: AppointmentType[]) => {
    const stats: { [key: string]: { dogs: number; cats: number } } = {};
    
    // Initialize all services with 0
    services.forEach(service => {
      stats[service] = { dogs: 0, cats: 0 };
    });

    // Get pet data to determine pet types
    try {
      const petsSnapshot = await getDocs(collection(db, "pets"));
      const petTypeMap: { [key: string]: string } = {};
      
      petsSnapshot.forEach((doc) => {
        const petData = doc.data();
        petTypeMap[doc.id] = petData.petType?.toLowerCase() || "";
      });

      // Count appointments by service and pet type
      appointmentsData.forEach(appointment => {
        const service = appointment.serviceType || "checkup";
        let petType = appointment.petType?.toLowerCase();
        
        // If petType is not in appointment, try to find it in pet data
        if (!petType && appointment.petName) {
          // Simple fallback - in a real app you'd want a better way to match pets
          const petEntry = Object.entries(petTypeMap).find(([, type]) => type);
          if (petEntry) {
            petType = petEntry[1];
          }
        }
        
        if (stats[service]) {
          if (petType === "dog") {
            stats[service].dogs++;
          } else if (petType === "cat") {
            stats[service].cats++;
          } else {
            // If pet type is unknown, default to dogs
            stats[service].dogs++;
          }
        }
      });

    } catch (error) {
      console.error("Error fetching pet data:", error);
      // Fallback: just count appointments without pet type distinction
      appointmentsData.forEach(appointment => {
        const service = appointment.serviceType || "checkup";
        if (stats[service]) {
          stats[service].dogs++;
        }
      });
    }

    // Convert to array format for charts with proper labels - FIXED
    const serviceStatsArray: ServiceStats[] = services.map(service => {
      const serviceLabel = serviceLabels[service as keyof typeof serviceLabels] || service;
      return {
        service: serviceLabel,
        dogs: stats[service].dogs,
        cats: stats[service].cats
      };
    });

    setServiceStats(serviceStatsArray);

    // Calculate totals
    const totalDogs = serviceStatsArray.reduce((sum, item) => sum + item.dogs, 0);
    const totalCats = serviceStatsArray.reduce((sum, item) => sum + item.cats, 0);
    const totalAppointments = totalDogs + totalCats;
    
    setTotalStats({ totalDogs, totalCats, totalAppointments });
  }, [serviceLabels, services]);

  // Fetch appointments from Firebase
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const appointmentsCollection = collection(db, "appointments");
      
      const snapshot = await getDocs(appointmentsCollection);
      const data: AppointmentType[] = [];
      
      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          petType: docData.petType || "",
          serviceType: docData.appointmentType || docData.serviceType || "checkup",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending"
        });
      });

      // Filter by selected month/year if needed
      let filteredData = data;
      if (selectedMonth || selectedYear) {
        filteredData = data.filter(appt => {
          const appointmentDate = new Date(appt.date);
          const monthMatch = !selectedMonth || appointmentDate.getMonth() === months.indexOf(selectedMonth);
          const yearMatch = !selectedYear || appointmentDate.getFullYear().toString() === selectedYear;
          return monthMatch && yearMatch;
        });
      }

      await calculateStats(filteredData);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, months, calculateStats]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Pie chart data - SIMPLIFIED VERSION
  const pieData = useMemo(() => [
    { name: 'Dogs', value: totalStats.totalDogs },
    { name: 'Cats', value: totalStats.totalCats }
  ], [totalStats.totalDogs, totalStats.totalCats]);

  const COLORS = useMemo(() => ['#8884d8', '#82ca9d'], []);

  // Custom tooltip for bar chart
  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <TooltipContainer>
          <TooltipTitle>{label}</TooltipTitle>
          {payload.map((entry, index) => (
            <TooltipItem key={index} $color={entry.fill}>
              {entry.dataKey === 'dogs' ? '🐕 Dogs' : '🐱 Cats'}: {entry.value}
            </TooltipItem>
          ))}
          <TooltipTotal>
            Total: {payload.reduce((sum, entry) => sum + entry.value, 0)}
          </TooltipTotal>
        </TooltipContainer>
      );
    }
    return null;
  };

  // Custom tooltip for pie chart
  const PieTooltip: React.FC<PieTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <TooltipContainer>
          <TooltipTitle>{data.name}</TooltipTitle>
          <TooltipItem $color="#666">
            Count: {data.value}
          </TooltipItem>
        </TooltipContainer>
      );
    }
    return null;
  };

  const handleClearFilters = () => {
    setSelectedMonth("");
    setSelectedYear("");
  };

  const handleRefresh = () => {
    fetchAppointments();
  };

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        {/* Header */}
        <HeaderSection>
          <BackButton onClick={() => router.push("/admindashboard")}>
            ← Back to Dashboard
          </BackButton>
          <HeaderContent>
            <HeaderIcon>📊</HeaderIcon>
            <HeaderText>
              <HeaderTitle>Pet Appointment Statistics</HeaderTitle>
              <HeaderSubtitle>Monthly overview of dog and cat appointments by service type</HeaderSubtitle>
            </HeaderText>
          </HeaderContent>
        </HeaderSection>

        {/* Filters */}
        <FiltersSection>
          <FilterGroup>
            <FilterLabel>Filter by Year:</FilterLabel>
            <FilterSelect 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Filter by Month:</FilterLabel>
            <FilterSelect 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">All Months</option>
              {months.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <RefreshButton onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? "Loading..." : "🔄 Refresh Data"}
          </RefreshButton>

          {(selectedMonth || selectedYear) && (
            <ActiveFilters>
              <span>Active Filters:</span>
              {selectedYear && <FilterTag>{selectedYear}</FilterTag>}
              {selectedMonth && <FilterTag>{selectedMonth}</FilterTag>}
              <ClearFilters onClick={handleClearFilters}>
                Clear All
              </ClearFilters>
            </ActiveFilters>
          )}
        </FiltersSection>

        {/* Stats Cards */}
        <StatsGrid>
          <StatsCard $delay={0.1}>
            <StatsIcon>🐕</StatsIcon>
            <StatsTitle>Total Dogs</StatsTitle>
            <StatsNumber $color="#8884d8">{totalStats.totalDogs}</StatsNumber>
          </StatsCard>
          
          <StatsCard $delay={0.2}>
            <StatsIcon>🐱</StatsIcon>
            <StatsTitle>Total Cats</StatsTitle>
            <StatsNumber $color="#82ca9d">{totalStats.totalCats}</StatsNumber>
          </StatsCard>
          
          <StatsCard $delay={0.3}>
            <StatsIcon>📅</StatsIcon>
            <StatsTitle>Total Appointments</StatsTitle>
            <StatsNumber $color="#34B89C">{totalStats.totalAppointments}</StatsNumber>
          </StatsCard>
        </StatsGrid>

        {/* Charts Container */}
        <ChartsContainer>
          {/* Bar Chart */}
          <ChartCard $delay={0.4}>
            <ChartTitle>🏥 Appointments by Service Type</ChartTitle>
            {isLoading ? (
              <LoadingContainer>
                <LoadingSpinner />
                <LoadingText>Loading chart data...</LoadingText>
              </LoadingContainer>
            ) : (
              <ChartWrapper>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={serviceStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    barGap={10}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="service" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12, fill: '#666' }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="rect"
                    />
                    <Bar 
                      dataKey="dogs" 
                      fill="#8884d8" 
                      name="🐕 Dogs"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="cats" 
                      fill="#82ca9d" 
                      name="🐱 Cats"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            )}
          </ChartCard>

          {/* Pie Chart - SIMPLIFIED VERSION */}
          <PieChartCard $delay={0.5}>
            <ChartTitle>🐾 Pet Distribution</ChartTitle>
            {isLoading ? (
              <LoadingContainer>
                <LoadingSpinner />
                <LoadingText>Loading...</LoadingText>
              </LoadingContainer>
            ) : totalStats.totalAppointments > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        value, 
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <PieLegend>
                  <LegendItem>
                    <LegendColor $color="#8884d8" />
                    <span>🐕 Dogs: {totalStats.totalDogs}</span>
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#82ca9d" />
                    <span>🐱 Cats: {totalStats.totalCats}</span>
                  </LegendItem>
                </PieLegend>
              </>
            ) : (
              <NoDataMessage>No data to display</NoDataMessage>
            )}
          </PieChartCard>
        </ChartsContainer>

        {/* Service Details Table */}
        <TableCard $delay={0.6}>
          <ChartTitle>📋 Service Details Summary</ChartTitle>
          
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner />
              <LoadingText>Loading table data...</LoadingText>
            </LoadingContainer>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Service Type</TableHeaderCell>
                    <TableHeaderCell>🐕 Dogs</TableHeaderCell>
                    <TableHeaderCell>🐱 Cats</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceStats.map((item, index) => (
                    <TableRow key={item.service} $even={index % 2 === 0}>
                      <TableCell>{item.service}</TableCell>
                      <TableCell $color="#8884d8">{item.dogs}</TableCell>
                      <TableCell $color="#82ca9d">{item.cats}</TableCell>
                      <TableCell $color="#34B89C" $bold>{item.dogs + item.cats}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TableCard>

        {/* Footer */}
        <FooterNote>
          💡 <strong>Note:</strong> This dashboard shows the count of appointments by service type for dogs and cats. 
          Data updates in real-time based on your appointment bookings.
        </FooterNote>
      </PageContainer>
    </>
  );
};

/* Styled Components - SAME AS BEFORE */
const PageContainer = styled.div`
  min-height: 100vh;
  padding: 20px;
  position: relative;
  
  @media (max-width: 768px) {
    padding: 15px;
  }
`;

const HeaderSection = styled.div`
  position: relative;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  padding: 30px;
  border-radius: 16px;
  margin-bottom: 30px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  animation: ${slideIn} 0.6s ease forwards;
  
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const BackButton = styled.button`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    position: static;
    margin-bottom: 15px;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 40px;
  
  @media (max-width: 768px) {
    margin-top: 0;
    flex-direction: column;
    text-align: center;
  }
`;

const HeaderIcon = styled.div`
  font-size: 4rem;
  
  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const HeaderText = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h1`
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const HeaderSubtitle = styled.p`
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
  line-height: 1.4;
`;

const FiltersSection = styled.div`
  background: white;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 25px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  animation: ${fadeInUp} 0.5s ease forwards;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FilterLabel = styled.label`
  font-weight: 600;
  color: #2C5E4F;
  white-space: nowrap;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 2px solid #34B89C;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  color: #2C5E4F;
  font-weight: 500;
  min-width: 120px;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.2);
  }
`;

const RefreshButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: #2a947c;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ActiveFilters = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  font-size: 14px;
`;

const FilterTag = styled.span`
  background: #34B89C;
  color: white;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
`;

const ClearFilters = styled.button`
  background: none;
  border: 1px solid #dc3545;
  color: #dc3545;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #dc3545;
    color: white;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatsCard = styled.div<{ $delay: number }>`
  background: white;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-top: 4px solid #34B89C;
  animation: ${fadeInUp} 0.5s ease forwards;
  animation-delay: ${props => props.$delay}s;
  opacity: 0;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-3px);
  }
`;

const StatsIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 15px;
`;

const StatsTitle = styled.h3`
  margin: 0 0 10px 0;
  color: #2C5E4F;
  font-size: 1.1rem;
`;

const StatsNumber = styled.p<{ $color: string }>`
  margin: 0;
  font-size: 2.5rem;
  font-weight: bold;
  color: ${props => props.$color};
`;

const ChartsContainer = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 25px;
  margin-bottom: 30px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div<{ $delay: number }>`
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  animation: ${fadeInUp} 0.5s ease forwards;
  animation-delay: ${props => props.$delay}s;
  opacity: 0;
`;

const PieChartCard = styled(ChartCard)``;

const ChartWrapper = styled.div`
  position: relative;
  z-index: 1;
`;

const ChartTitle = styled.h2`
  margin: 0 0 20px 0;
  color: #2C5E4F;
  text-align: center;
  font-size: 1.3rem;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 15px;
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #34B89C;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: #666;
  font-size: 14px;
  margin: 0;
`;

const NoDataMessage = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 40px;
`;

const PieLegend = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LegendColor = styled.div<{ $color: string }>`
  width: 12px;
  height: 12px;
  background-color: ${props => props.$color};
  border-radius: 2px;
`;

const TableCard = styled.div<{ $delay: number }>`
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 20px;
  animation: ${fadeInUp} 0.5s ease forwards;
  animation-delay: ${props => props.$delay}s;
  opacity: 0;
`;

const TableContainer = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;

const TableHeader = styled.thead``;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $even?: boolean }>`
  background-color: ${props => props.$even ? '#f8f9fa' : '#ffffff'};
`;

const TableHeaderCell = styled.th`
  padding: 15px 12px;
  text-align: left;
  border-bottom: 2px solid #34B89C;
  color: #2C5E4F;
  font-weight: 600;
  
  &:nth-child(2), &:nth-child(3), &:nth-child(4) {
    text-align: center;
  }
`;

const TableCell = styled.td<{ $color?: string; $bold?: boolean }>`
  padding: 12px;
  border-bottom: 1px solid #eee;
  color: ${props => props.$color || '#333'};
  font-weight: ${props => props.$bold ? '700' : '500'};
  
  &:nth-child(2), &:nth-child(3), &:nth-child(4) {
    text-align: center;
  }
`;

const TooltipContainer = styled.div`
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  z-index: 1000;
  position: relative;
  min-width: 150px;
  
  &::before {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid white;
  }
`;

const TooltipTitle = styled.p`
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #2C5E4F;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
`;

const TooltipItem = styled.p<{ $color: string }>`
  margin: 4px 0;
  color: ${props => props.$color};
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TooltipTotal = styled.p`
  margin: 8px 0 0 0;
  font-weight: 600;
  border-top: 1px solid #eee;
  padding-top: 6px;
  color: #2C5E4F;
  font-size: 14px;
`;

const FooterNote = styled.div`
  background: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  color: #666;
  font-size: 14px;
  line-height: 1.5;
`;

export default MonthlyStatistic;