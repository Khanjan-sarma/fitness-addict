import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Member } from '../types';
import { calculateStatus } from '../utils/statusUtils';
import {
  Search, UserPlus, Edit2, RefreshCw, X, Receipt,
  Trash2, CheckCircle, AlertCircle, Users, Phone,
  Calendar, Target, Activity, DollarSign, Maximize2,
  AlertTriangle, Dumbbell, HeartPulse, Eye
} from 'lucide-react';

// --- Sub-components moved to top for better hoisting and explicit typing ---

/**
 * InfoLine component for displaying member details
 */
const InfoLine: React.FC<{ icon: React.ReactElement, label: string, value: string, bold?: boolean }> = ({ icon, label, value, bold = false }) => (
  <div className="flex items-center justify-between group/info">
    <div className="flex items-center gap-2 text-gray-400 group-hover/info:text-bullRed transition-colors">
      {React.cloneElement(icon, { className: 'h-4 w-4' } as any)}
      <span className="text-[10px] font-black uppercase tracking-[0.1em]">{label}</span>
    </div>
    <span className={`text-sm ${bold ? 'font-black text-white' : 'font-semibold text-gray-400'}`}>{value}</span>
  </div>
);

/**
 * Modal component for forms and history
 */
const Modal: React.FC<{ children: React.ReactNode, onClose: () => void, title: string }> = ({ children, onClose, title }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-bullDark/80 backdrop-blur-sm" onClick={onClose} />
    <div className="bg-bullSurface rounded-xl w-full max-w-lg relative z-10 overflow-hidden shadow-2xl animate-fade-in-up outline outline-1 outline-bullBorder">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6 border-b border-bullBorder pb-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 outline outline-1 outline-bullBorder rounded-md text-bullMuted hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

/**
 * MemberCard component for displaying member summary
 */
const MemberCard: React.FC<{
  member: Member,
  onRenew: () => void,
  onView: () => void,
  onPayments: () => void,
  onAvatarClick: (member: Member) => void
}> = ({ member, onRenew, onView, onPayments, onAvatarClick }) => {
  const status = calculateStatus(member.membership_end);
  const statusColors = {
    Active: 'text-emerald-500 bg-emerald-500/10',
    Due: 'text-orange-500 bg-orange-500/10',
    Expired: 'text-red-500 bg-red-500/10',
  };

  return (
    <div className="bg-bullSurface rounded-xl p-5 outline outline-1 outline-bullBorder relative overflow-hidden flex flex-col h-full cursor-pointer hover:outline-bullRed/50 transition-all" onClick={onView}>
      {/* Decorative corner accent */}
      <div className={`absolute top-0 right-0 w-12 h-12 rounded-bl-full ${status === 'Active' ? 'bg-emerald-500' : status === 'Due' ? 'bg-orange-500' : 'bg-red-500'}`} />

      <div className="flex items-start mb-6">
        <div
          className="w-12 h-12 rounded-lg bg-bullDark flex items-center justify-center font-black text-xl text-white outline outline-1 outline-bullBorder mr-4"
        >
          {member.name.charAt(0)}
        </div>
        <div className="flex-1 mt-1">
          <h3 className="text-[15px] font-bold text-white leading-tight mb-2 truncate pr-6">{member.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColors[status as keyof typeof statusColors]}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="space-y-4 mb-6 mt-auto">
        <InfoLine icon={<Phone />} label="Phone" value={member.phone} />
        <InfoLine icon={<Calendar />} label="Expires" value={member.membership_end} />
        <InfoLine icon={<Target />} label="Goal" value={member.goal || 'Not set'} />
        <InfoLine icon={<Phone />} label="Emergency" value={member.emergency_contact || 'None'} />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-bullBorder mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onRenew(); }}
          className="py-2.5 bg-bullRed text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-3 w-3" /> Renew
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPayments(); }}
          className="py-2.5 bg-bullDark text-bullText outline outline-1 outline-bullBorder rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-bullSurface transition-all flex items-center justify-center gap-2"
        >
          <Receipt className="h-3 w-3 opacity-60" /> Payments
        </button>
      </div>
    </div>
  );
};

export const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal States
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [expandedAvatarMember, setExpandedAvatarMember] = useState<Member | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);

  // Form States
  const [renewDuration, setRenewDuration] = useState('1');
  const [renewAmount, setRenewAmount] = useState('1000');
  const [renewCustomDate, setRenewCustomDate] = useState('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('cash');
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{ id: string; amount: string; paid_on: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Show success toast when arriving from Add Member
  const location = useLocation();
  useEffect(() => {
    if (location.state && (location.state as any).memberAdded) {
      showToast('Member added successfully!', 'success');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Sort once on fetch: Expired → Due → Active, closest expiry first
      const sorted = (data || []).sort((a: Member, b: Member) => {
        const statusA = calculateStatus(a.membership_end);
        const statusB = calculateStatus(b.membership_end);
        const priority: Record<string, number> = { Expired: 0, Due: 1, Active: 2 };
        if (priority[statusA] !== priority[statusB]) {
          return priority[statusA] - priority[statusB];
        }
        return new Date(a.membership_end).getTime() - new Date(b.membership_end).getTime();
      });
      setMembers(sorted);
    } catch (err) {
      showToast('Failed to fetch members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members
    .filter(
      (member) => {
        const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.phone.includes(searchTerm);
        const matchesStatus = statusFilter === 'All' || calculateStatus(member.membership_end) === statusFilter;
        return matchesSearch && matchesStatus;
      }
    );

  // --- Modal Opening Handlers ---
  const handleRenew = (member: Member) => {
    setSelectedMember(member);
    setRenewDuration('1');
    setRenewAmount('1000');
    setRenewCustomDate('');
    setIsRenewModalOpen(true);
  };

  const handleView = (member: Member) => {
    setSelectedMember(member);
    setIsEditMode(false);
    setIsEditModalOpen(true);
  };

  const handlePayments = async (member: Member) => {
    setSelectedMember(member);
    setIsPaymentsModalOpen(true);
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', member.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      showToast('Failed to load payments.', 'error');
    } finally {
      setPaymentsLoading(false);
    }
  };

  // --- Submit Handlers ---
  const submitRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setSubmitting(true);
    try {
      let newEndDateStr: string;

      if (renewDuration === 'custom') {
        if (!renewCustomDate) {
          showToast('Please select a custom end date.', 'error');
          setSubmitting(false);
          return;
        }
        newEndDateStr = renewCustomDate;
      } else {
        const currentEnd = new Date(selectedMember.membership_end);
        const newEndDate = new Date(currentEnd);
        newEndDate.setMonth(newEndDate.getMonth() + parseInt(renewDuration));
        newEndDateStr = newEndDate.toISOString().split('T')[0];
      }

      // Update membership_end, set renewal_reminder = false
      const { error: updateError } = await supabase
        .from('members')
        .update({
          membership_end: newEndDateStr,
          renewal_reminder: false
        })
        .eq('id', selectedMember.id);

      if (updateError) throw updateError;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          member_id: selectedMember.id,
          plan_name: `${renewDuration === 'custom' ? 'Custom' : renewDuration + (parseInt(renewDuration) === 1 ? ' Month' : ' Months')}`,
          amount: parseFloat(renewAmount),
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: renewPaymentMethod
        }]);

      if (paymentError) throw paymentError;

      showToast(`Renewed until ${newEndDateStr}`, 'success');
      setIsRenewModalOpen(false);
      // Update member in-place so card doesn't jump position
      setMembers(prev => prev.map(m =>
        m.id === selectedMember.id ? { ...m, membership_end: newEndDateStr, renewal_reminder: false } : m
      ));
    } catch (err) {
      showToast('Failed to renew.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('members')
        .update(selectedMember)
        .eq('id', selectedMember.id);
      if (error) throw error;
      showToast('Member updated.', 'success');
      setIsEditModalOpen(false);
      fetchMembers();
    } catch (err) {
      showToast('Update failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMember = async () => {
    if (!selectedMember || !window.confirm(`Delete ${selectedMember.name} permanently?`)) return;
    setSubmitting(true);
    try {
      await supabase.from('payments').delete().eq('member_id', selectedMember.id);
      const { error } = await supabase.from('members').delete().eq('id', selectedMember.id);
      if (error) throw error;
      showToast('Member deleted.', 'success');
      setIsEditModalOpen(false);
      fetchMembers();
    } catch (err) {
      showToast('Delete failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      showToast('Payment deleted.', 'success');
    } catch (err) {
      showToast('Failed to delete payment.', 'error');
    }
  };

  const updatePayment = async () => {
    if (!editingPayment) return;
    try {
      const { error } = await supabase
        .from('payments')
        .update({ amount: parseFloat(editingPayment.amount), payment_date: editingPayment.paid_on })
        .eq('id', editingPayment.id);
      if (error) throw error;
      setPayments(prev => prev.map(p =>
        p.id === editingPayment.id ? { ...p, amount: parseFloat(editingPayment.amount), payment_date: editingPayment.paid_on } : p
      ));
      setEditingPayment(null);
      showToast('Payment updated.', 'success');
    } catch (err) {
      showToast('Failed to update payment.', 'error');
    }
  };

  return (
    <div className="space-y-10">
      {toast && (
        <div className="fixed top-20 right-4 z-[100] flex items-center p-4 rounded-2xl shadow-2xl animate-fade-in-down max-w-sm w-full bg-bullSurface border border-bullBorder">
          {toast.type === 'success' ? (
            <CheckCircle className="flex-shrink-0 w-5 h-5 mr-3 text-emerald-500" />
          ) : (
            <AlertCircle className="flex-shrink-0 w-5 h-5 mr-3 text-bullRed" />
          )}
          <div className="font-bold text-white text-sm">{toast.message}</div>
          <button onClick={() => setToast(null)} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-black text-white uppercase tracking-tight leading-none mb-1">OUR MEMBERS</h1>
          <p className="text-bullMuted font-bold uppercase text-[10px] tracking-widest">FITNESS ADDICT UNISEX GYM</p>
        </div>
        <Link
          to="/add-member"
          className="px-6 py-3 bg-bullRed rounded-md text-white font-bold hover:bg-red-700 transition-all uppercase text-sm tracking-widest flex items-center justify-center"
        >
          <UserPlus className="h-4 w-4 mr-2" /> NEW MEMBER
        </Link>
      </section>

      {/* Filter Section */}
      <section className="space-y-4">
        <div className="relative w-full max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-bullMuted" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 outline outline-1 outline-bullBorder rounded-xl bg-bullSurface text-white focus:outline-bullRed sm:text-sm font-medium transition-all"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          {['All', 'Active', 'Due', 'Expired'].map((status) => {
            const isActive = statusFilter === status;
            
            let btnClass = isActive ? 'bg-bullRed text-white outline transition-colors outline-1 outline-bullRed' : 'bg-bullSurface text-bullMuted outline outline-1 outline-bullBorder hover:bg-[#1a1a1a] transition-colors';
            
            let dot = null;
            if (status !== 'All') {
              const dotColor = status === 'Active' ? 'bg-emerald-500' : status === 'Due' ? 'bg-orange-500' : 'bg-red-500';
              dot = <span className={`w-1.5 h-1.5 rounded-full mr-2 ${dotColor}`} />;
            }

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex items-center px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${btnClass}`}
              >
                {dot}
                {status.toUpperCase()}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted mt-4">
          SHOWING {filteredMembers.length} OF {members.length} MEMBERS
        </p>
      </section>

      {/* Members Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bullRed"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onRenew={() => handleRenew(member)}
                onView={() => handleView(member)}
                onPayments={() => handlePayments(member)}
                onAvatarClick={(m) => setExpandedAvatarMember(m)}
              />
            ))
          ) : (
            <div className="col-span-full bg-bullSurface p-20 rounded-2xl border border-dashed border-bullBorder text-center flex flex-col items-center gap-4">
              <Users className="h-16 w-16 text-gray-600" />
              <p className="text-xl font-bold text-gray-500 uppercase tracking-widest">No Members Found</p>
            </div>
          )}
        </div>
      )}

      {/* Image Expansion Overlay (Avatar Expansion) */}
      {expandedAvatarMember && (
        <div
          className="fixed inset-0 z-[200] bg-bullDark/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setExpandedAvatarMember(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpandedAvatarMember(null); }}
            className="absolute top-6 right-6 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all border border-white/10"
          >
            <X className="h-8 w-8" />
          </button>
          <div className="max-w-xl w-full flex flex-col items-center">
            <div
              className="w-64 h-64 sm:w-80 sm:h-80 rounded-[3rem] bg-bullSurface flex items-center justify-center text-8xl font-black text-bullRed shadow-2xl border-4 border-bullRed/20 transform animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {expandedAvatarMember.name.charAt(0)}
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-10 text-center">{expandedAvatarMember.name}</h2>
            <p className="text-bullYellow font-black uppercase tracking-[0.2em] text-sm mt-2">Active Warrior</p>
            <button
              onClick={() => setExpandedAvatarMember(null)}
              className="mt-8 px-8 py-3 bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
            >
              Back to normal
            </button>
          </div>
        </div>
      )}

      {/* Modals Container */}
      {isRenewModalOpen && selectedMember && (
        <Modal onClose={() => setIsRenewModalOpen(false)} title={`Renew - ${selectedMember.name}`}>
          <form onSubmit={submitRenewal} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">DURATION</label>
              <select
                value={renewDuration}
                onChange={e => {
                  const val = e.target.value;
                  setRenewDuration(val);
                  if (val === 'custom') {
                    setRenewAmount('');
                    setRenewCustomDate('');
                  } else {
                    setRenewAmount((parseInt(val) * 1000).toString());
                    setRenewCustomDate('');
                  }
                }}
                className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
              >
                <option value="1">1 MONTH</option>
                <option value="3">3 MONTHS</option>
                <option value="6">6 MONTHS</option>
                <option value="12">12 MONTHS</option>
                <option value="custom">CUSTOM DATE</option>
              </select>
            </div>
            {renewDuration === 'custom' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">NEW END DATE</label>
                <input
                  type="date"
                  value={renewCustomDate}
                  onChange={e => setRenewCustomDate(e.target.value)}
                  className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  required
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">AMOUNT (₹)</label>
              <input
                type="number"
                value={renewAmount}
                onChange={e => setRenewAmount(e.target.value)}
                className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">PAYMENT METHOD</label>
              <select
                value={renewPaymentMethod}
                onChange={e => setRenewPaymentMethod(e.target.value)}
                className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
              >
                <option value="cash">CASH</option>
                <option value="upi">UPI</option>
                <option value="card">CARD</option>
                <option value="bank_transfer">BANK TRANSFER</option>
                <option value="other">OTHER</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-bullRed text-white rounded-md font-bold uppercase tracking-widest text-[11px] hover:bg-[#981014] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Processing...' : 'Confirm Renewal'}
            </button>
          </form>
        </Modal>
      )}

      {isEditModalOpen && selectedMember && (
        <Modal onClose={() => { setIsEditModalOpen(false); setIsEditMode(false); }} title={isEditMode ? `Edit - ${selectedMember.name}` : selectedMember.name}>
          {!isEditMode ? (
            /* ===== VIEW MODE ===== */
            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">FULL NAME</span>
                  <span className="text-sm font-bold text-white">{selectedMember.name}</span>
                </div>
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">PHONE</span>
                  <span className="text-sm font-bold text-white">{selectedMember.phone}</span>
                </div>
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">GOAL</span>
                  <span className="text-sm font-bold text-white">{selectedMember.goal || 'NOT SET'}</span>
                </div>
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">EMERGENCY CONTACT</span>
                  <span className="text-sm font-bold text-white">{selectedMember.emergency_contact || 'NOT SET'}</span>
                </div>
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">PT ENQUIRY</span>
                  {selectedMember.pt_enquiry ? (
                    <span className="px-2.5 py-0.5 bg-[#981014]/20 text-[#ff4c4c] rounded font-bold uppercase tracking-widest border border-[#981014]/50 text-[10px]">YES</span>
                  ) : (
                    <span className="text-sm font-bold text-bullMuted">NO</span>
                  )}
                </div>
                <div className="flex items-center justify-between border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">MEDICAL CONDITION</span>
                  <span className="text-sm font-bold text-white max-w-[200px] truncate">{selectedMember.medical_condition || 'NONE'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted mb-1">JOIN DATE</p>
                    <p className="text-sm font-bold text-white">{selectedMember.join_date}</p>
                  </div>
                  <div className="border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted mb-1">START</p>
                    <p className="text-sm font-bold text-white">{selectedMember.membership_start}</p>
                  </div>
                  <div className="border border-bullBorder rounded-md px-4 py-3 bg-[#0a0a0a]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted mb-1">END</p>
                    <p className="text-sm font-bold text-white">{selectedMember.membership_end}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsEditMode(true)}
                className="w-full py-3 bg-bullDark hover:bg-[#1a1a1a] outline outline-1 outline-bullBorder text-white rounded-md font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-colors mt-6"
              >
                <Edit2 className="h-4 w-4" /> EDIT MEMBER
              </button>
            </div>
          ) : (
            /* ===== EDIT MODE ===== */
            <form onSubmit={submitEdit} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">FULL NAME</label>
                  <input
                    type="text"
                    value={selectedMember.name}
                    onChange={e => setSelectedMember({ ...selectedMember, name: e.target.value } as Member)}
                    className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">PHONE</label>
                  <input
                    type="text"
                    value={selectedMember.phone}
                    onChange={e => setSelectedMember({ ...selectedMember, phone: e.target.value } as Member)}
                    className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">GOAL</label>
                  <select
                    value={selectedMember.goal || ''}
                    onChange={e => setSelectedMember({ ...selectedMember, goal: e.target.value } as Member)}
                    className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  >
                    <option value="">NONE</option>
                    <option value="Weight Loss">WEIGHT LOSS</option>
                    <option value="Muscle Gain">MUSCLE GAIN</option>
                    <option value="General Fitness">GENERAL FITNESS</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">EMERGENCY CONTACT</label>
                  <input
                    type="text"
                    value={selectedMember.emergency_contact || ''}
                    onChange={e => setSelectedMember({ ...selectedMember, emergency_contact: e.target.value } as Member)}
                    className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                    placeholder="10 DIGIT NUMBER"
                  />
                </div>
                <div className="flex items-end col-span-2 sm:col-span-1">
                  <label className="flex items-center gap-3 w-full bg-[#0a0a0a] outline outline-1 outline-bullBorder rounded-md px-4 py-3 cursor-pointer hover:bg-bullBorder transition-colors h-[46px]">
                    <input
                      type="checkbox"
                      checked={selectedMember.pt_enquiry || false}
                      onChange={e => setSelectedMember({ ...selectedMember, pt_enquiry: e.target.checked } as Member)}
                      className="w-4 h-4 rounded border-bullBorder text-bullRed focus:ring-bullRed bg-[#141414]"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">PT ENQUIRY</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">MEDICAL CONDITION</label>
                <textarea
                  value={selectedMember.medical_condition || ''}
                  onChange={e => setSelectedMember({ ...selectedMember, medical_condition: e.target.value } as Member)}
                  className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all resize-none"
                  rows={2}
                  placeholder="E.G. ASTHMA, KNEE INJURY..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">JOIN DATE</label>
                  <input
                    type="date"
                    value={selectedMember.join_date}
                    onChange={e => setSelectedMember({ ...selectedMember, join_date: e.target.value } as Member)}
                    className="w-full text-[13px] outline outline-1 outline-bullBorder rounded-md py-3 px-2 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">START</label>
                  <input
                    type="date"
                    value={selectedMember.membership_start}
                    onChange={e => setSelectedMember({ ...selectedMember, membership_start: e.target.value } as Member)}
                    className="w-full text-[13px] outline outline-1 outline-bullBorder rounded-md py-3 px-2 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">END</label>
                  <input
                    type="date"
                    value={selectedMember.membership_end}
                    onChange={e => setSelectedMember({ ...selectedMember, membership_end: e.target.value } as Member)}
                    className="w-full text-[13px] outline outline-1 outline-bullBorder rounded-md py-3 px-2 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <button
                  type="button"
                  onClick={deleteMember}
                  className="flex-1 py-3 outline outline-1 outline-[#981014]/50 bg-[#981014]/10 text-bullRed rounded-md font-bold uppercase tracking-widest text-[11px] hover:bg-[#981014]/30 transition-colors"
                >
                  DELETE MEMBER
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-3 bg-bullRed text-white rounded-md font-bold uppercase tracking-widest text-[11px] disabled:opacity-50 transition-colors hover:bg-red-700"
                >
                  {submitting ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {isPaymentsModalOpen && selectedMember && (
        <Modal onClose={() => setIsPaymentsModalOpen(false)} title={`Payment History - ${selectedMember.name}`}>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
            {paymentsLoading ? (
              <div className="py-10 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-bullRed mx-auto rounded-full" /></div>
            ) : payments.length === 0 ? (
              <p className="text-center py-10 text-gray-400 font-bold uppercase text-[10px] tracking-widest">No payments found</p>
            ) : (
              payments.map(p => (
                <div key={p.id} className="bg-[#0a0a0a] p-5 rounded-lg outline outline-1 outline-bullBorder">
                  {editingPayment && editingPayment.id === p.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">AMOUNT (₹)</label>
                          <input
                            type="number"
                            value={editingPayment.amount}
                            onChange={e => setEditingPayment({ ...editingPayment, amount: e.target.value })}
                            className="w-full text-sm outline outline-1 outline-bullBorder rounded-md py-2 px-3 bg-[#111] text-white focus:outline-bullRed transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bullMuted block mb-2">DATE</label>
                          <input
                            type="date"
                            value={editingPayment.paid_on}
                            onChange={e => setEditingPayment({ ...editingPayment, paid_on: e.target.value })}
                            className="w-full text-[13px] outline outline-1 outline-bullBorder rounded-md py-2 px-2 bg-[#111] text-white focus:outline-bullRed transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingPayment(null)}
                          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-white outline outline-1 outline-bullBorder bg-bullDark hover:bg-[#1a1a1a] transition-all"
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={updatePayment}
                          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-bullRed text-white hover:bg-red-700 transition-all"
                        >
                          SAVE
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><DollarSign className="h-4 w-4" /></div>
                        <div>
                          <p className="text-sm font-black text-white">₹{p.amount}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.payment_date}</p>
                          {p.payment_method && <p className="text-[9px] font-bold text-bullRed uppercase tracking-widest mt-0.5">{p.payment_method}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Success</span>
                        <button
                          onClick={() => setEditingPayment({ id: p.id, amount: String(p.amount), paid_on: p.payment_date })}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-bullBorder transition-all"
                          title="Edit payment"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deletePayment(p.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-bullRed hover:bg-red-50 transition-all"
                          title="Delete payment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};