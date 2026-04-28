import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { X, Trash2, CheckCircle, AlertCircle, Calendar, Clock } from 'lucide-react';

// ── types ────────────────────────────────────────────────────────────
interface OffDayRow {
  id: string;
  start_date: string;
  end_date: string;
  note: string;
}

// ── helpers ──────────────────────────────────────────────────────────
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDateNice(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Build a map: dateStr → OffDayRow (for calendar colouring)
function buildDateMap(rows: OffDayRow[]): Record<string, OffDayRow> {
  const map: Record<string, OffDayRow> = {};
  for (const row of rows) {
    const dates = datesBetween(row.start_date, row.end_date);
    for (const d of dates) {
      map[d] = row;
    }
  }
  return map;
}

// ── component ────────────────────────────────────────────────────────
export const OffDays: React.FC = () => {
  const [rows, setRows] = useState<OffDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── modal state ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<OffDayRow | null>(null);

  const YEAR = new Date().getFullYear();
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const todayStr = new Date().toISOString().split('T')[0];

  // ── data ──
  useEffect(() => { fetchOffDays(); }, []);

  const fetchOffDays = async () => {
    try {
      setLoading(true);
      // Fetch any row whose range overlaps the current year
      const { data, error } = await supabase
        .from('off_days')
        .select('*')
        .lte('start_date', `${YEAR}-12-31`)
        .gte('end_date', `${YEAR}-01-01`)
        .order('start_date', { ascending: true });
      if (error) throw error;
      setRows(data ?? []);
    } catch {
      showToast('Failed to load off days.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── derived data ──
  const dateMap = useMemo(() => buildDateMap(rows), [rows]);

  const upcomingRows = useMemo(() => {
    return rows.filter((r) => r.end_date >= todayStr).slice(0, 5);
  }, [rows, todayStr]);

  // ── modal open / close ──
  const openNewModal = (dateStr: string) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setNoteInput('');
    setEditingRow(null);
    setIsModalOpen(true);
  };

  const openEditModal = (row: OffDayRow) => {
    setStartDate(row.start_date);
    setEndDate(row.end_date);
    setNoteInput(row.note);
    setEditingRow(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setStartDate('');
    setEndDate('');
    setNoteInput('');
    setEditingRow(null);
  };

  // ── calendar day click ──
  const handleDayClick = (dateStr: string) => {
    const existing = dateMap[dateStr];
    if (existing) {
      openEditModal(existing);
    } else {
      openNewModal(dateStr);
    }
  };

  // ── save (create / update) ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      showToast('End date must be on or after start date.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingRow) {
        // Update the single row
        const { error } = await supabase
          .from('off_days')
          .update({ start_date: startDate, end_date: endDate, note: noteInput })
          .eq('id', editingRow.id);
        if (error) throw error;
        showToast('Off-day event updated.', 'success');
      } else {
        // Insert a single row
        const { error } = await supabase
          .from('off_days')
          .insert([{ start_date: startDate, end_date: endDate, note: noteInput }]);
        if (error) throw error;
        const days = datesBetween(startDate, endDate).length;
        showToast(days === 1 ? 'Off day saved.' : `${days}-day off event saved.`, 'success');
      }
      await fetchOffDays();
      closeModal();
    } catch {
      showToast('Failed to save off day.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── delete ──
  const handleDelete = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('off_days').delete().eq('id', editingRow.id);
      if (error) throw error;
      const days = datesBetween(editingRow.start_date, editingRow.end_date).length;
      showToast(days === 1 ? 'Off day removed.' : `${days}-day event removed.`, 'success');
      await fetchOffDays();
      closeModal();
    } catch {
      showToast('Failed to delete.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── preview count ──
  const previewDates = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return datesBetween(startDate, endDate);
  }, [startDate, endDate]);

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 flex items-center p-4 rounded-2xl shadow-2xl animate-fade-in-down max-w-sm w-full bg-bullSurface border border-bullBorder">
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-3 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-3 text-bullRed shrink-0" />
          )}
          <div className="font-bold text-white text-sm">{toast.message}</div>
          <button onClick={() => setToast(null)} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* header */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] leading-none font-black text-white uppercase tracking-tight">GYM CALENDAR {YEAR}</h1>
          <p className="text-bullMuted font-bold uppercase text-[10px] tracking-widest mt-1">SCHEDULE OPERATIONAL OFF-DAYS AND HOLIDAYS.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#141414] py-3 rounded-md outline outline-1 outline-bullBorder flex items-center gap-4 px-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded bg-bullRed" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">OFF DAY</span>
            </div>
            <div className="flex items-center gap-2 border-l border-bullBorder pl-4">
              <div className="w-2.5 h-2.5 rounded outline outline-1 outline-bullRed bg-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">TODAY</span>
            </div>
          </div>
        </div>
      </header>

      {/* upcoming off-days */}
      {upcomingRows.length > 0 && (
        <div className="bg-bullSurface rounded-xl p-6 outline outline-1 outline-bullBorder">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#981014]/20 rounded-lg outline outline-1 outline-[#981014]/50">
              <Clock className="w-4 h-4 text-[#ff4c4c]" />
            </div>
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
              UPCOMING OFF-DAYS
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {upcomingRows.map((row) => {
              const days = datesBetween(row.start_date, row.end_date).length;
              return (
                <button
                  key={row.id}
                  onClick={() => openEditModal(row)}
                  className="text-left bg-bullDark hover:bg-bullBorder transition-all rounded-2xl p-4 group border border-bullBorder hover:border-bullRed/30"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-bullRed transition-colors">
                    {days === 1
                      ? formatDateNice(row.start_date)
                      : `${formatDateNice(row.start_date)} → ${formatDateNice(row.end_date)}`}
                  </p>
                  <p className="text-sm font-bold text-white mt-1 truncate">{row.note}</p>
                  {days > 1 && (
                    <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest text-bullRed bg-bullRed/10 px-2 py-0.5 rounded-lg">
                      {days} days
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* calendar grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {MONTHS.map((monthName, monthIndex) => {
          const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();
          const firstDay = new Date(YEAR, monthIndex, 1).getDay();
          const blanks = Array.from({ length: firstDay }, (_, i) => i);
          const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

          return (
            <div
              key={monthName}
              className="bg-bullSurface p-8 rounded-2xl border border-bullBorder flex flex-col hover:border-bullRed/20 transition-all"
            >
              <h3 className="text-lg font-black text-white text-center mb-6 uppercase tracking-[0.2em]">
                {monthName}
              </h3>

              <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-[10px] font-black text-gray-600 uppercase">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {blanks.map((b) => <div key={b} className="aspect-square" />)}
                {days.map((day) => {
                  const dateStr = `${YEAR}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isOff = !!dateMap[dateStr];
                  const isToday = dateStr === todayStr;

                  let cellClass =
                    'aspect-square flex items-center justify-center text-xs rounded-xl font-bold transition-all cursor-pointer ';
                  if (isOff) cellClass += 'bg-bullRed text-white shadow-lg shadow-red-900/20 ';
                  else cellClass += 'hover:bg-bullBorder text-gray-400 ';
                  if (isToday) cellClass += 'ring-2 ring-bullRed ring-offset-2 ring-offset-bullSurface ';

                  return (
                    <button key={day} onClick={() => handleDayClick(dateStr)} className={cellClass}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-bullDark/80 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-bullSurface rounded-[2.5rem] w-full max-w-lg relative z-10 overflow-hidden shadow-2xl animate-fade-in-up border border-bullBorder">
            <form onSubmit={handleSave} className="p-8">
              {/* title */}
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">
                  {editingRow ? 'Edit Event' : 'New Off Day'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 bg-bullDark rounded-xl text-gray-400 hover:text-white transition-colors"
                >
                  <X />
                </button>
              </div>

              {/* date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-bullDark p-5 rounded-2xl border border-bullBorder">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className="w-full bg-bullSurface rounded-xl px-4 py-3 text-sm font-bold text-white border-none focus:ring-2 focus:ring-bullRed transition-all"
                  />
                </div>
                <div className="bg-bullDark p-5 rounded-2xl border border-bullBorder">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-bullSurface rounded-xl px-4 py-3 text-sm font-bold text-white border-none focus:ring-2 focus:ring-bullRed transition-all"
                  />
                </div>
              </div>

              {/* range preview */}
              {previewDates.length > 1 && (
                <div className="mb-6 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Selected:</span>
                  <span className="inline-flex items-center gap-1.5 bg-bullRed/10 text-bullRed text-xs font-black px-3 py-1.5 rounded-xl border border-bullRed/20">
                    <Calendar className="w-3.5 h-3.5" />
                    {previewDates.length} days
                    <span className="text-gray-400 font-medium">
                      ({formatDateNice(previewDates[0])} → {formatDateNice(previewDates[previewDates.length - 1])})
                    </span>
                  </span>
                </div>
              )}

              {/* note */}
              <div className="space-y-2 mb-8">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">
                  Reason for closure
                </label>
                <textarea
                  required
                  rows={3}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-bullDark text-white border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-bullRed transition-all"
                  placeholder="e.g. Diwali Holiday, Renovation..."
                />
              </div>

              {/* actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-4">
                {editingRow && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 py-4 text-bullRed font-black uppercase tracking-widest text-xs hover:bg-red-50 rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {datesBetween(editingRow.start_date, editingRow.end_date).length > 1
                      ? `Remove All ${datesBetween(editingRow.start_date, editingRow.end_date).length} Days`
                      : 'Remove Off-Day'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-4 bg-bullRed text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : previewDates.length > 1
                      ? `Confirm ${previewDates.length} Off-Days`
                      : 'Confirm Off-Day'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};