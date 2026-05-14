import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { formatDate, toLocalIsoDate } from '../utils/dateUtils';
import {
  Landmark, DollarSign, TrendingUp,
  CreditCard, Download, BarChart3, Search, Calendar, X, ChevronLeft, ChevronRight
} from 'lucide-react';

// --- Date Filter Types ---
type DateFilterMode = 'All' | 'Today' | 'This Cycle' | 'Single' | 'Range';

function getCycleRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // If today is >= 10th, cycle is 10th of this month → 9th of next month
  // If today is < 10th, cycle is 10th of last month → 9th of this month
  if (day >= 10) {
    const start = new Date(y, m, 10);
    const end = new Date(y, m + 1, 9);
    return { start: toLocalIsoDate(start), end: toLocalIsoDate(end) };
  } else {
    const start = new Date(y, m - 1, 10);
    const end = new Date(y, m, 9);
    return { start: toLocalIsoDate(start), end: toLocalIsoDate(end) };
  }
}

export const Finance: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  // Date filter state
  const [dateMode, setDateMode] = useState<DateFilterMode>('All');
  const [singleDate, setSingleDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDatePicker]);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    count: 0,
    avg: 0
  });
  const [monthlyData, setMonthlyData] = useState<{ month: string, revenue: number }[]>([]);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, members(name)')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);

      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      let total = 0;
      let monthTotal = 0;
      const monthlyMap: Record<string, number> = {};

      data?.forEach(p => {
        const amt = Number(p.amount) || 0;
        total += amt;
        if (p.payment_date?.startsWith(currentMonthStr)) {
          monthTotal += amt;
        }

        if (p.payment_date) {
          const mKey = p.payment_date.substring(0, 7);
          monthlyMap[mKey] = (monthlyMap[mKey] || 0) + amt;
        }
      });

      // Prepare last 6 months for chart, filling zeros where no data exists
      const chartData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        chartData.push({
          month: d.toLocaleString('en-US', { month: 'short' }),
          revenue: monthlyMap[mKey] || 0
        });
      }

      setMonthlyData(chartData);
      setStats({
        total,
        thisMonth: monthTotal,
        count: data?.length || 0,
        avg: data?.length ? Math.round(total / data.length) : 0
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue), 1);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentMonthStr = todayStr.substring(0, 7);

  const filteredPayments = payments.filter((payment) => {
    const normalizedSearch = paymentSearchTerm.trim().toLowerCase();
    const matchesMethod = methodFilter === 'All' || payment.payment_method === methodFilter;

    let matchesDate = true;
    const pd = payment.payment_date || '';
    if (dateMode === 'Today') {
      matchesDate = pd === todayStr;
    } else if (dateMode === 'This Cycle') {
      const cycle = getCycleRange();
      matchesDate = pd >= cycle.start && pd <= cycle.end;
    } else if (dateMode === 'Single' && singleDate) {
      matchesDate = pd === singleDate;
    } else if (dateMode === 'Range' && rangeStart && rangeEnd) {
      matchesDate = pd >= rangeStart && pd <= rangeEnd;
    }

    const matchesSearch =
      !normalizedSearch ||
      (payment.members?.name || '').toLowerCase().includes(normalizedSearch) ||
      (payment.plan_name || '').toLowerCase().includes(normalizedSearch) ||
      (payment.payment_method || '').toLowerCase().includes(normalizedSearch) ||
      (payment.payment_date || '').toLowerCase().includes(normalizedSearch) ||
      String(payment.amount ?? '').includes(normalizedSearch);

    return matchesMethod && matchesDate && matchesSearch;
  });

  const exportCSV = () => {
    if (filteredPayments.length === 0) return;
    const header = 'Member,Plan,Date,Amount,Payment Method\n';
    const rows = filteredPayments.map(p =>
      `"${p.members?.name || 'Unknown'}","${p.plan_name || '-'}",${p.payment_date},${p.amount},${p.payment_method || '-'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bull-fitness-payments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] leading-none font-black text-white uppercase tracking-tight">FINANCIAL TREASURY</h1>
          <p className="text-bullMuted font-bold uppercase text-[10px] tracking-widest mt-1">REAL-TIME REVENUE MONITORING AND TRANSACTION HISTORY.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={exportCSV} className="px-6 py-3 bg-[#981014] text-white rounded-md font-bold hover:bg-bullRed transition-all uppercase text-xs tracking-widest flex items-center">
            <Download className="h-4 w-4 mr-2" /> EXPORT CSV
          </button>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceCard label="LIFETIME REVENUE" value={formatCurrency(stats.total)} icon={<Landmark />} />
        <FinanceCard label="THIS MONTH" value={formatCurrency(stats.thisMonth)} icon={<DollarSign />} />
        <FinanceCard label="TRANSACTIONS" value={stats.count.toString()} icon={<CreditCard />} />
        <FinanceCard label="AVG. TICKET" value={formatCurrency(stats.avg)} icon={<TrendingUp />} />
      </section>

      {/* Analytics Preview */}
      <section className="grid grid-cols-1 gap-8 mt-10">
        <div className="bg-bullSurface outline outline-1 outline-bullBorder rounded-xl p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-bullRed" /> MONTHLY REVENUE
            </h3>
            <span className="text-[10px] font-bold text-bullMuted uppercase tracking-widest">LAST 6 MONTHS</span>
          </div>

          <div className="h-64 flex flex-col justify-end">
            {stats.total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-bullMuted gap-2 border border-dashed border-bullBorder rounded-lg">
                <TrendingUp className="h-10 w-10 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">NO FINANCIAL DATA</p>
              </div>
            ) : (
              <div className="flex-1 flex items-end justify-between gap-4 relative">
                {/* Y-Axis lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[4, 3, 2, 1, 0].map(i => (
                    <div key={i} className="flex items-center w-full">
                      <span className="text-[10px] text-bullMuted font-medium w-8">₹{Math.round((maxRevenue / 4) * i / 1000)}K</span>
                      <div className="flex-1 border-b border-dashed border-bullBorder"></div>
                    </div>
                  ))}
                </div>
                
                <div className="flex-1 flex items-end justify-between px-10 h-[calc(100%-20px)] mt-5 z-10">
                  {monthlyData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end px-2">
                      <div
                        className="w-full bg-[#DE1B22] rounded-t-sm transition-all duration-700 ease-out max-w-[60px]"
                        style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, 2)}%` }}
                      />
                      <span className="text-[10px] font-bold text-bullMuted uppercase">{d.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Transactions Table */}
      <section className="bg-bullSurface rounded-xl outline outline-1 outline-bullBorder mt-10">
        <div className="p-6 border-b border-bullBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">TRANSACTION HISTORY</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted mt-1">
              SHOWING {filteredPayments.length} OF {payments.length} PAYMENTS
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_160px_160px] gap-3 w-full lg:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-bullMuted" />
              <input
                type="text"
                value={paymentSearchTerm}
                onChange={(e) => setPaymentSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[11px] outline outline-1 outline-bullBorder rounded-md bg-[#0a0a0a] text-white focus:outline-bullRed transition-all font-bold tracking-widest"
                placeholder="SEARCH PAYMENTS..."
              />
            </div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="min-w-40 text-[11px] outline outline-1 outline-bullBorder rounded-md py-2 px-3 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all uppercase font-bold tracking-widest"
            >
              <option value="All">ALL METHODS</option>
              <option value="cash">CASH</option>
              <option value="upi">UPI</option>
              <option value="card">CARD</option>
              <option value="bank_transfer">BANK TRANSFER</option>
              <option value="other">OTHER</option>
            </select>
            <div className="relative min-w-40" ref={datePickerRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-full text-[11px] outline outline-1 outline-bullBorder rounded-md py-2 px-3 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all uppercase font-bold tracking-widest flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-bullMuted" />
                  {dateMode === 'All' && 'ALL DATES'}
                  {dateMode === 'Today' && 'TODAY'}
                  {dateMode === 'This Cycle' && 'THIS CYCLE'}
                  {dateMode === 'Single' && singleDate && formatDate(singleDate)}
                  {dateMode === 'Single' && !singleDate && 'PICK DATE'}
                  {dateMode === 'Range' && rangeStart && rangeEnd && `${formatDate(rangeStart)} - ${formatDate(rangeEnd)}`}
                  {dateMode === 'Range' && (!rangeStart || !rangeEnd) && 'PICK RANGE'}
                </span>
                {dateMode !== 'All' && (
                  <X className="h-3.5 w-3.5 text-bullMuted hover:text-white" onClick={(e) => { e.stopPropagation(); setDateMode('All'); setSingleDate(''); setRangeStart(''); setRangeEnd(''); setShowDatePicker(false); }} />
                )}
              </button>

              {showDatePicker && (
                <DatePickerDropdown
                  dateMode={dateMode}
                  singleDate={singleDate}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onModeChange={(mode) => { setDateMode(mode); if (mode === 'All' || mode === 'Today' || mode === 'This Cycle') { setSingleDate(''); setRangeStart(''); setRangeEnd(''); setShowDatePicker(false); } }}
                  onSingleDateChange={(d) => { setSingleDate(d); setDateMode('Single'); setShowDatePicker(false); }}
                  onRangeChange={(s, e) => { setRangeStart(s); setRangeEnd(e); setDateMode('Range'); if (s && e) setShowDatePicker(false); }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#0f0f0f]">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-bullMuted">MEMBER</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-bullMuted">PLAN</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-bullMuted">DATE</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-bullMuted">AMOUNT</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-bullMuted">METHOD</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-bullMuted">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bullBorder">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bullRed mx-auto" /></td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-bullMuted">
                      <CreditCard className="h-12 w-12 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">No payments recorded</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-bullDark transition-colors">
                  <td className="px-6 py-5 whitespace-nowrap font-bold text-bullText text-sm">{p.members?.name || 'Unknown'}</td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-bullMuted">{p.plan_name || '-'}</td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm text-bullMuted font-medium">{formatDate(p.payment_date)}</td>
                  <td className="px-6 py-5 whitespace-nowrap font-bold text-white">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-900/30 text-[#4c84ff] rounded font-bold uppercase tracking-widest text-[9px] border border-blue-900/50">{p.payment_method || '-'}</span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <span className="px-2 py-1 bg-[#0a3018] text-[#34d399] rounded font-bold uppercase tracking-widest text-[9px] border border-[#104a25]">PAID</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const DatePickerDropdown: React.FC<{
  dateMode: DateFilterMode;
  singleDate: string;
  rangeStart: string;
  rangeEnd: string;
  onModeChange: (mode: DateFilterMode) => void;
  onSingleDateChange: (date: string) => void;
  onRangeChange: (start: string, end: string) => void;
  onClose: () => void;
}> = ({ dateMode, singleDate, rangeStart, rangeEnd, onModeChange, onSingleDateChange, onRangeChange, onClose }) => {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [pickingRange, setPickingRange] = useState(false);
  const [tempStart, setTempStart] = useState(rangeStart);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toLocalIsoDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const handleDayClick = (day: number) => {
    const dateStr = getDateStr(day);
    if (pickingRange) {
      if (!tempStart || (tempStart && rangeEnd)) {
        // Start new range
        setTempStart(dateStr);
        onRangeChange(dateStr, '');
      } else {
        // Complete range
        const start = dateStr < tempStart ? dateStr : tempStart;
        const end = dateStr < tempStart ? tempStart : dateStr;
        onRangeChange(start, end);
        setPickingRange(false);
      }
    } else {
      onSingleDateChange(dateStr);
    }
  };

  const isInRange = (day: number) => {
    if (!rangeStart || !rangeEnd) return false;
    const d = getDateStr(day);
    return d >= rangeStart && d <= rangeEnd;
  };

  const isRangeEdge = (day: number) => {
    const d = getDateStr(day);
    return d === rangeStart || d === rangeEnd;
  };

  return (
    <div className="absolute right-0 top-full mt-2 z-[100] bg-[#0f0f0f] border border-bullBorder rounded-xl shadow-2xl p-4 w-[300px] animate-fade-in-down max-h-[70vh] overflow-y-auto">
      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['All', 'Today', 'This Cycle'] as DateFilterMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => { onModeChange(mode); setPickingRange(false); }}
            className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-colors ${dateMode === mode ? 'bg-bullRed text-white' : 'bg-bullSurface text-bullMuted outline outline-1 outline-bullBorder hover:text-white'}`}
          >
            {mode === 'This Cycle' ? 'THIS CYCLE (10th-10th)' : mode === 'All' ? 'ALL DATES' : mode}
          </button>
        ))}
      </div>

      {/* Mode toggle: Single vs Range */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setPickingRange(false); setTempStart(''); }}
          className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-colors ${!pickingRange ? 'bg-bullRed text-white' : 'bg-bullSurface text-bullMuted outline outline-1 outline-bullBorder'}`}
        >
          SINGLE DATE
        </button>
        <button
          onClick={() => { setPickingRange(true); setTempStart(''); onRangeChange('', ''); }}
          className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-colors ${pickingRange ? 'bg-bullRed text-white' : 'bg-bullSurface text-bullMuted outline outline-1 outline-bullBorder'}`}
        >
          DATE RANGE
        </button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 text-bullMuted hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[11px] font-bold text-white uppercase tracking-widest">
          {viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 text-bullMuted hover:text-white transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-bullMuted uppercase">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = getDateStr(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === singleDate && dateMode === 'Single';
          const inRange = pickingRange ? (tempStart && !rangeEnd ? dateStr === tempStart : isInRange(day)) : isInRange(day);
          const isEdge = isRangeEdge(day);

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              className={`h-8 w-full rounded text-[11px] font-bold transition-all
                ${isSelected || isEdge ? 'bg-bullRed text-white' : ''}
                ${inRange && !isEdge ? 'bg-bullRed/20 text-white' : ''}
                ${!isSelected && !inRange && !isEdge ? 'text-bullText hover:bg-bullSurface' : ''}
                ${isToday && !isSelected && !isEdge ? 'outline outline-1 outline-bullRed' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Range hint */}
      {pickingRange && tempStart && !rangeEnd && (
        <p className="text-[9px] text-bullMuted font-bold uppercase tracking-widest mt-3 text-center">
          SELECT END DATE
        </p>
      )}
    </div>
  );
};

const FinanceCard = ({ label, value, icon }: any) => (
  <div className="bg-bullSurface p-6 rounded-xl outline outline-1 outline-bullBorder">
    <div className="flex items-center gap-3 mb-4">
      <div className="text-bullRed">
        {React.cloneElement(icon, { className: 'h-6 w-6' })}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-bullMuted">{label}</p>
    </div>
    <h3 className="text-3xl font-bold text-white leading-none">{value}</h3>
  </div>
);
