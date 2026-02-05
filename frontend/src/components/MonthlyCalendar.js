import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MonthlyCalendar = ({ onSwapClick }) => {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({ shifts: [], leave: [] });
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchCalendarData();
  }, [year, month, token]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/calendar/monthly-rota?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarData(response.data);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get shift type color
  const getShiftColor = (startTime) => {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour >= 6 && hour < 14) return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800', label: 'Early' };
    if (hour >= 14 && hour < 22) return { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', label: 'Late' };
    return { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', label: 'Night' };
  };

  // Generate calendar grid
  const generateCalendar = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Adjust to start week on Monday
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push({ day: null, shifts: [], leave: false });
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = calendarData.shifts.filter(s => s.shift_date === dateStr);
      const hasLeave = calendarData.leave.some(l => 
        dateStr >= l.start_date && dateStr <= l.end_date
      );
      
      days.push({ day, dateStr, shifts: dayShifts, leave: hasLeave });
    }
    
    return days;
  };

  const calendarDays = generateCalendar();
  const today = new Date().toISOString().split('T')[0];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="frappe-card">
      {/* Calendar Header */}
      <div className="frappe-card-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-semibold">
            {monthNames[month - 1]} {year}
          </h3>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={20} />
          </button>
        </div>
        <button onClick={goToToday} className="frappe-btn frappe-btn-secondary text-sm">
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded"></div>
          <span>Early (07:00-15:00)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded"></div>
          <span>Late (15:00-23:00)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-400 rounded"></div>
          <span>Night (23:00-07:00)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-400 rounded"></div>
          <span>Leave</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="frappe-spinner"></div>
          </div>
        ) : (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((dayData, index) => (
                <div
                  key={index}
                  className={`min-h-[100px] p-1 rounded border ${
                    dayData.day === null 
                      ? 'bg-gray-50 border-transparent' 
                      : dayData.dateStr === today
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {dayData.day !== null && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${
                        dayData.dateStr === today ? 'text-blue-600' : 'text-gray-700'
                      }`}>
                        {dayData.day}
                      </div>

                      {/* Leave indicator */}
                      {dayData.leave && (
                        <div className="text-xs px-1 py-0.5 bg-green-100 border border-green-400 text-green-800 rounded mb-1">
                          Leave
                        </div>
                      )}

                      {/* Shifts */}
                      {dayData.shifts.map((shift, idx) => {
                        const colors = getShiftColor(shift.start_time);
                        return (
                          <div
                            key={idx}
                            className={`text-xs px-1 py-0.5 ${colors.bg} border ${colors.border} ${colors.text} rounded mb-1 cursor-pointer hover:opacity-80`}
                            onClick={() => shift.status === 'scheduled' && onSwapClick && onSwapClick(shift)}
                            title={`${shift.start_time} - ${shift.end_time}${shift.status === 'scheduled' ? ' (Click to swap)' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{shift.start_time}</span>
                              {shift.status === 'scheduled' && (
                                <RefreshCcw size={10} />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* No shift indicator */}
                      {dayData.shifts.length === 0 && !dayData.leave && (
                        <div className="text-xs text-gray-400 text-center py-2">
                          Off
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyCalendar;
