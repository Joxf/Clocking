import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Separate components to avoid complex inline JSX
const OffenderBadge = ({ offender }) => (
  <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full text-sm flex items-center gap-2">
    <User size={14} />
    <span>{offender.name}</span>
    <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded-full text-xs font-bold">
      {offender.count}x
    </span>
  </div>
);

const JobTitleBadge = ({ jobTitle }) => {
  const getClass = () => {
    const classes = {
      nurse: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      senior_carer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      carer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      activities: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      kitchen: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      maintenance: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return classes[jobTitle] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };
  
  const getDisplay = () => {
    const titles = {
      nurse: 'Nurse',
      senior_carer: 'Senior Carer', 
      carer: 'Carer',
      activities: 'Activities',
      kitchen: 'Kitchen',
      maintenance: 'Maintenance'
    };
    return titles[jobTitle] || jobTitle || 'N/A';
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClass()}`}>
      {getDisplay()}
    </span>
  );
};

const LatenessBadge = ({ minutes }) => {
  const getClass = () => {
    if (minutes >= 30) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    if (minutes >= 15) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClass()}`}>
      {minutes} min
    </span>
  );
};

const ArrivalRow = ({ arrival }) => {
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) {
      return dateStr;
    }
  };
  
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
        {formatDate(arrival.date)}
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{arrival.employee_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{arrival.employee_id}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <JobTitleBadge jobTitle={arrival.job_title} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">{arrival.scheduled_start}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono font-medium">{arrival.actual_clock_in}</td>
      <td className="px-4 py-3">
        <LatenessBadge minutes={arrival.minutes_late} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={arrival.reason || ''}>
        {arrival.reason || '-'}
      </td>
    </tr>
  );
};

const LateArrivalsReport = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const fetchReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/attendance/late-arrivals-report`, {
        params: { year, month },
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data);
    } catch (err) {
      setError('Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [year, month, token]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.late_arrivals) return;
    const rows = ['Date,Employee ID,Employee Name,Job Title,Scheduled Start,Actual Clock-In,Minutes Late,Reason'];
    const data = reportData.late_arrivals;
    for (let i = 0; i < data.length; i++) {
      const a = data[i];
      rows.push(`"${a.date}","${a.employee_id}","${a.employee_name}","${a.job_title}","${a.scheduled_start}","${a.actual_clock_in}","${a.minutes_late}","${a.reason || ''}"`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `late-arrivals-${year}-${String(month).padStart(2, '0')}.csv`;
    link.click();
  };

  const getFilteredArrivals = () => {
    if (!reportData || !reportData.late_arrivals) return [];
    const result = [];
    const data = reportData.late_arrivals;
    for (let i = 0; i < data.length; i++) {
      const a = data[i];
      const nameMatch = (a.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = (a.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase());
      const jobMatch = filterJobTitle === 'all' || a.job_title === filterJobTitle;
      if ((nameMatch || idMatch) && jobMatch) result.push(a);
    }
    return result;
  };

  const getUniqueJobTitles = () => {
    if (!reportData || !reportData.late_arrivals) return [];
    const set = new Set();
    const data = reportData.late_arrivals;
    for (let i = 0; i < data.length; i++) {
      if (data[i].job_title) set.add(data[i].job_title);
    }
    return Array.from(set);
  };

  const filteredArrivals = getFilteredArrivals();
  const uniqueJobTitles = getUniqueJobTitles();
  const repeatOffenders = reportData?.summary?.repeat_offenders || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" data-testid="late-arrivals-report">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} data-testid="back-btn" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock size={24} className="text-red-500" />
              Late Arrivals Report
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track and monitor late clock-ins</p>
          </div>
        </div>
        <button onClick={exportToCSV} disabled={!reportData?.late_arrivals?.length} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" data-testid="export-btn">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Month Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center justify-between">
          <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" data-testid="prev-month-btn">
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="current-month">
              {monthNames[month - 1]} {year}
            </span>
          </div>
          <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" data-testid="next-month-btn">
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-red-500" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button onClick={fetchReport} className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5" data-testid="total-late-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Late Arrivals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData?.summary?.total_late_arrivals || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5" data-testid="unique-employees-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Employees Affected</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData?.summary?.unique_employees || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5" data-testid="avg-minutes-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <TrendingUp size={24} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Minutes Late</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData?.summary?.average_minutes_late || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Repeat Offenders */}
          {repeatOffenders.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6" data-testid="repeat-offenders">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                Repeat Offenders (3+ late arrivals this month)
              </h3>
              <div className="flex flex-wrap gap-2">
                {repeatOffenders.map((offender, idx) => <OffenderBadge key={idx} offender={offender} />)}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by name or employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-testid="search-input" />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" data-testid="filter-job-title">
                  <option value="all">All Job Titles</option>
                  {uniqueJobTitles.map((jt, i) => <option key={i} value={jt}>{jt}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Late Arrivals Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {filteredArrivals.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Late Arrivals</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm || filterJobTitle !== 'all' ? 'No results match your filters' : `Great news! No late arrivals recorded for ${monthNames[month - 1]} ${year}`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="late-arrivals-table">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Job Title</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Scheduled</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actual</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Late By</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredArrivals.map((arrival, idx) => <ArrivalRow key={idx} arrival={arrival} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filteredArrivals.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              Showing {filteredArrivals.length} of {reportData?.late_arrivals?.length || 0} late arrivals
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LateArrivalsReport;
