import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TeamCalendar = () => {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchCalendarData();
  }, [token]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/calendar/team-availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarData(response.data.calendar || []);
    } catch (err) {
      console.error('Failed to fetch team calendar:', err);
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

  // Get leave type color
  const getLeaveColor = (leaveType) => {
    switch (leaveType) {
      case 'annual': return { bg: 'bg-blue-100', text: 'text-blue-800' };
      case 'sick': return { bg: 'bg-red-100', text: 'text-red-800' };
      case 'compassionate': return { bg: 'bg-purple-100', text: 'text-purple-800' };
      case 'maternity':
      case 'paternity': return { bg: 'bg-pink-100', text: 'text-pink-800' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  const allAbsences = calendarData || [];

  // Generate calendar grid
  const generateCalendar = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    const days = [];
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push({ day: null, absences: [] });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const absences = allAbsences.filter(l => 
        dateStr >= l.start_date && dateStr <= l.end_date
      );
      days.push({ day, dateStr, absences });
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
          <Users size={20} className="text-gray-500" />
          <span className="font-semibold">Team Availability</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">
            {monthNames[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 rounded"></div>
          <span>Annual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 rounded"></div>
          <span>Sick</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 rounded"></div>
          <span>Compassionate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-pink-100 rounded"></div>
          <span>Maternity/Paternity</span>
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
                  className={`min-h-[80px] p-1 rounded border ${
                    dayData.day === null 
                      ? 'bg-gray-50 border-transparent' 
                      : dayData.dateStr === today
                        ? 'border-blue-500 bg-blue-50'
                        : dayData.absences.length > 0
                          ? 'border-orange-200 bg-orange-50'
                          : 'border-gray-200'
                  }`}
                >
                  {dayData.day !== null && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${
                          dayData.dateStr === today ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {dayData.day}
                        </span>
                        {dayData.absences.length > 0 && (
                          <span className="text-xs bg-orange-200 text-orange-800 px-1 rounded">
                            {dayData.absences.length}
                          </span>
                        )}
                      </div>

                      {/* Absences */}
                      <div className="space-y-0.5 overflow-y-auto max-h-[60px]">
                        {dayData.absences.slice(0, 3).map((absence, idx) => {
                          const colors = getLeaveColor(absence.leave_type);
                          return (
                            <div
                              key={idx}
                              className={`text-xs px-1 py-0.5 ${colors.bg} ${colors.text} rounded truncate`}
                              title={`${absence.employee_name} - ${absence.leave_type}`}
                            >
                              {absence.employee_name?.split(' ')[0]}
                            </div>
                          );
                        })}
                        {dayData.absences.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayData.absences.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-600">
          <Calendar size={14} className="inline mr-1" />
          View team availability before booking leave to avoid scheduling conflicts.
        </p>
      </div>
    </div>
  );
};

export default TeamCalendar;
