import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { AlertCircle } from 'lucide-react';

export const AddMember: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState('1');
  const [totalAmount, setTotalAmount] = useState('2000');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    join_date: today,
    membership_start: today,
    membership_end: '',
    goal: '',
    emergency_contact: '',
    medical_condition: '',
  });

  const [ptEnquiry, setPtEnquiry] = useState(false);

  // Auto-calculate the end date and total amount when duration or start date changes
  useEffect(() => {
    if (duration !== 'custom' && formData.membership_start) {
      const startDate = new Date(formData.membership_start);
      const months = parseInt(duration, 10);

      startDate.setMonth(startDate.getMonth() + months);
      const newEndDate = startDate.toISOString().split('T')[0];

      setFormData((prev) => ({
        ...prev,
        membership_end: newEndDate,
      }));

      setTotalAmount((1000 + (1000 * months)).toString());
    } else if (duration === 'custom') {
      setTotalAmount('');
    }
  }, [duration, formData.membership_start]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Map duration value to a human-readable plan name
  const getPlanName = (dur: string): string => {
    const map: Record<string, string> = {
      '1': '1 Month',
      '3': '3 Months',
      '6': '6 Months',
      '12': '12 Months',
      'custom': 'Custom',
    };
    return map[dur] || dur;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formData.name.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }
    if (new Date(formData.membership_end) <= new Date(formData.membership_start)) {
      setError("Membership end date must be after the start date.");
      return;
    }

    setLoading(true);
    setError(null);

    let createdMemberId: string | null = null;

    try {
      // 1. Insert Member
      const { data: memberData, error: insertError } = await supabase.from('members').insert([
        {
          name: formData.name,
          phone: formData.phone,
          join_date: formData.join_date,
          membership_start: formData.membership_start,
          membership_end: formData.membership_end,
          goal: formData.goal,
          emergency_contact: formData.emergency_contact || null,
          pt_enquiry: ptEnquiry,
          medical_condition: formData.medical_condition || null,
        },
      ]).select().single();

      if (insertError) throw insertError;
      createdMemberId = memberData.id;

      // 2. Insert Initial Payment (required)
      const { error: paymentError } = await supabase.from('payments').insert([{
        member_id: memberData.id,
        plan_name: getPlanName(duration),
        amount: Number(totalAmount),
        payment_date: today,
        payment_method: paymentMethod
      }]);

      if (paymentError) throw paymentError;

      navigate('/members', { state: { memberAdded: true } });
    } catch (err: any) {
      // Rollback: if payment insert failed but member was created, delete the member
      if (createdMemberId) {
        await supabase.from('members').delete().eq('id', createdMemberId);
      }
      setError(err.message || 'Failed to add member. Check your database permissions or input values.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-bullBorder pb-4">
        <div>
          <h1 className="text-[28px] font-black text-white uppercase tracking-tight leading-none mb-1">NEW MEMBER REGISTRATION</h1>
          <p className="text-bullMuted font-bold uppercase text-[10px] tracking-widest">ADD A NEW MEMBER TO THE SYSTEM AND CONFIGURE THEIR PLAN.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/members')}
          className="text-[10px] font-bold text-bullMuted hover:text-white transition-colors uppercase tracking-widest outline outline-1 outline-bullBorder px-4 py-2 rounded-md"
        >
          BACK TO LIST
        </button>
      </div>

      <div className="bg-bullSurface rounded-xl outline outline-1 outline-bullBorder overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="bg-[#981014]/20 outline outline-1 outline-[#981014]/50 rounded-md p-4 text-sm text-[#ff4c4c] flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-sm font-black text-white border-b border-bullBorder pb-3 uppercase tracking-widest">PERSONAL INFORMATION</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="name" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  FULL NAME <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                    placeholder="JOHN DOE"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="phone" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  PHONE NUMBER <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    required
                    pattern="\d{10}"
                    title="Must be exactly 10 digits"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                    placeholder="10 DIGIT NUMBER"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="goal" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  FITNESS GOAL
                </label>
                <div className="mt-1">
                  <select
                    id="goal"
                    name="goal"
                    value={formData.goal}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  >
                    <option value="">SELECT A GOAL</option>
                    <option value="Weight Loss">WEIGHT LOSS</option>
                    <option value="Muscle Gain">MUSCLE GAIN</option>
                    <option value="General Fitness">GENERAL FITNESS</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="emergency_contact" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  EMERGENCY CONTACT
                </label>
                <div className="mt-1">
                  <input
                    type="tel"
                    name="emergency_contact"
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                    placeholder="10 DIGIT NUMBER"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  PT ENQUIRY
                </label>
                <div className="mt-1">
                  <label className="inline-flex items-center gap-3 cursor-pointer bg-[#0a0a0a] outline outline-1 outline-bullBorder rounded-md py-3 px-4 hover:bg-bullBorder transition-colors w-full">
                    <input
                      type="checkbox"
                      checked={ptEnquiry}
                      onChange={(e) => setPtEnquiry(e.target.checked)}
                      className="w-4 h-4 rounded border-bullBorder text-bullRed focus:ring-bullRed bg-[#141414]"
                    />
                    <span className="text-[11px] font-bold text-white uppercase tracking-widest">INTERESTED IN PERSONAL TRAINING</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="medical_condition" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  MEDICAL CONDITION
                </label>
                <div className="mt-1">
                  <textarea
                    name="medical_condition"
                    id="medical_condition"
                    value={formData.medical_condition}
                    onChange={(e) => setFormData(prev => ({ ...prev, medical_condition: e.target.value }))}
                    rows={2}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all resize-none"
                    placeholder="E.G. ASTHMA, KNEE INJURY..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-black text-white border-b border-bullBorder pb-3 uppercase tracking-widest">MEMBERSHIP DETAILS</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-8 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label htmlFor="duration" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  DURATION <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <select
                    id="duration"
                    name="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  >
                    <option value="1">1 MONTH</option>
                    <option value="3">3 MONTHS</option>
                    <option value="6">6 MONTHS</option>
                    <option value="12">12 MONTHS</option>
                    <option value="custom">CUSTOM DATE</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="join_date" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  JOIN DATE <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="join_date"
                    id="join_date"
                    required
                    value={formData.join_date}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="membership_start" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  MEMBERSHIP START <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="membership_start"
                    id="membership_start"
                    required
                    value={formData.membership_start}
                    onChange={handleChange}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="membership_end" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  MEMBERSHIP END <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="membership_end"
                    id="membership_end"
                    required
                    value={formData.membership_end}
                    onChange={handleChange}
                    readOnly={duration !== 'custom'}
                    className={`block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all ${duration !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="totalAmount" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  TOTAL AMOUNT <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-bullMuted text-sm font-bold">₹</span>
                  </div>
                  <input
                    type="number"
                    name="totalAmount"
                    id="totalAmount"
                    min="0"
                    step="0.01"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="block w-full text-sm pl-8 pr-4 py-3 outline outline-1 outline-bullBorder rounded-md bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                    placeholder="E.G. 2000"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="paymentMethod" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  PAYMENT METHOD <span className="text-bullRed">*</span>
                </label>
                <div className="mt-1">
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="block w-full text-sm outline outline-1 outline-bullBorder rounded-md py-3 px-4 bg-[#0a0a0a] text-white focus:outline-bullRed transition-all"
                  >
                    <option value="cash">CASH</option>
                    <option value="upi">UPI</option>
                    <option value="card">CARD</option>
                    <option value="bank_transfer">BANK TRANSFER</option>
                    <option value="other">OTHER</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-bullBorder flex flex-col sm:flex-row justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/members')}
              className="w-full sm:w-auto py-3 px-8 outline outline-1 outline-bullBorder rounded-md text-[11px] font-bold text-bullMuted hover:bg-[#1a1a1a] hover:text-white transition-colors uppercase tracking-widest"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto py-3 px-8 rounded-md text-white bg-bullRed hover:bg-[#981014] text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
            >
              {loading ? 'SAVING...' : 'SAVE MEMBER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
