import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Clock,
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

const OffenderBadge = ({ offender }) => (
  <div className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm flex items-center gap-2">
    <User size={14} />
    <span>{offender.name}</span>
    <span className="px-1.5 py-0.5 bg-amber-200 rounded-full text-xs font-bold">
      {offender.count}x
    </span>
  </div>
);

const JobTitleBadge = ({ jobTitle }) => {
  const getClass = () => {
    const classes = {
      nurse: 'bg-purple-100 text-purple-700',
      senior_carer: 'bg-blue-100 text-blue-700',
      carer: 'bg-green-100 text-green-700',
      activities: 'bg-yellow-100 text-yellow-700',
      kitchen: 'bg-red-100 text-red-700',
      maintenance: 'bg-gray-100 text-gray-700'
    };
    return classes[jobTitle] || 'bg-gray-100 text-gray-700';
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
    if (minutes >= 30) return 'bg-red-100 text-red-700';
    if (minutes >= 15) return 'bg-orange-100 text-orange-700';
    return 'bg-yellow-100 text-yellow-700';
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
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-900">
        {formatDate(arrival.date)}
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{arrival.employee_name}</p>
          <p className="text-xs text-gray-500">{arrival.employee_id}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <JobTitleBadge jobTitle={arrival.job_title} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{arrival.scheduled_start}</td>
      <td className="px-4 py-3 text-sm text-gray-900 font-mono font-medium">{arrival.actual_clock_in}</td>
      <td className="px-4 py-3">
        <LatenessBadge minutes={arrival.minutes_late} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={arrival.reason || ''}>
        {arrival.reason || '-'}
      </td>
    </tr>
  );
};

const LateArrivalsTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  const headers = { Authorization: `Bearer ${token}` };
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
    <div data-testid="late-arrivals-tab">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={24} className="text-red-500" />
            Late Arrivals Report
          </h1>
          <p className="text-sm text-gray-500">Track and monitor late clock-ins</p>
        </div>
        <button onClick={exportToCSV} disabled={!reportData?.late_arrivals?.length} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" data-testid="export-btn">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" data-testid="prev-month-btn">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500" />
            <span className="text-lg font-semibold text-gray-900" data-testid="current-month">
              {monthNames[month - 1]} {year}
            </span>
          </div>
          <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" data-testid="next-month-btn">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button onClick={fetchReport} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="total-late-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Late Arrivals</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData?.summary?.total_late_arrivals || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="unique-employees-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Employees Affected</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData?.summary?.unique_employees || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="avg-minutes-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp size={24} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Minutes Late</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData?.summary?.average_minutes_late || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Repeat Offenders */}
          {repeatOffenders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6" data-testid="repeat-offenders">
              <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                Repeat Offenders (3+ late arrivals this month)
              </h3>
              <div className="flex flex-wrap gap-2">
                {repeatOffenders.map((offender, idx) => <OffenderBadge key={idx} offender={offender} />)}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by name or employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-testid="search-input" />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select value={filterJobTitle} onChange={(e) => setFilterJobTitle(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" data-testid="filter-job-title">
                  <option value="all">All Job Titles</option>
                  {uniqueJobTitles.map((jt, i) => <option key={i} value={jt}>{jt}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Late Arrivals Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredArrivals.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Late Arrivals</h3>
                <p className="text-gray-500">
                  {searchTerm || filterJobTitle !== 'all' ? 'No results match your filters' : `Great news! No late arrivals recorded for ${monthNames[month - 1]} ${year}`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="late-arrivals-table">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job Title</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Scheduled</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Late By</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredArrivals.map((arrival, idx) => <ArrivalRow key={idx} arrival={arrival} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filteredArrivals.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing {filteredArrivals.length} of {reportData?.late_arrivals?.length || 0} late arrivals
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LateArrivalsTab;
