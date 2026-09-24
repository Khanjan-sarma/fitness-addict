import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { addMonthsClamped, toLocalIsoDate } from '../utils/dateUtils';
import {
  buildTakenMap, checkId, suggestFreeIds, isBlocked, findNameClash, TakenMap, DeviceId
} from '../utils/idCheck';
import { syncMemberToDoor } from '../utils/syncDoor';
import { AlertCircle } from 'lucide-react';

const CustomDateInput = ({ id, name, value, onChange, readOnly, required, className }: any) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setDisplayValue(`${parts[2]}/${parts[1]}/${parts[0]}`); // DD/MM/YYYY
      } else {
        setDisplayValue(value);
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw.length > 2) {
      raw = raw.substring(0, 2) + '/' + raw.substring(2);
    }
    if (raw.length > 5) {
      raw = raw.substring(0, 5) + '/' + raw.substring(5);
    }
    raw = raw.substring(0, 10);
    setDisplayValue(raw);

    if (raw.length === 10) {
      const parts = raw.split('/');
      if (parts.length === 3) {
        const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          onChange({ target: { name, value: iso } } as any);
        }
      }
    } else {
      // Don't update parent state until full date is typed, unless clearing
      if (raw.length === 0) {
        onChange({ target: { name, value: '' } } as any);
      }
    }
  };

  const dateRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="DD/MM/YYYY"
        id={id}
        name={name}
        value={displayValue}
        onChange={handleTextChange}
        readOnly={readOnly}
        required={required}
        className={className}
        maxLength={10}
      />
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => dateRef.current?.showPicker()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-bullMuted hover:text-white z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <input
            ref={dateRef}
            type="date"
            value={value}
            onChange={(e) => onChange({ target: { name, value: e.target.value } } as any)}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
          />
        </>
      )}
    </div>
  );
};

export const AddMember: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState('1');
  const [totalAmount, setTotalAmount] = useState('2000');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [hasMedicalCondition, setHasMedicalCondition] = useState(false);

  const today = toLocalIsoDate();

  const [formData, setFormData] = useState({
    member_id: '',
    name: '',
    phone: '',
    join_date: today,
    membership_start: today,
    membership_end: '',
    goal: '',
    medical_condition: '',
  });

  const [ptEnquiry, setPtEnquiry] = useState(false);

  // ---- member ID conflict checking -------------------------------------
  // Loads ids already used by members AND ids in use on the door terminal.
  // The second list matters: 73 device records belong to nobody in the CRM,
  // and reusing one of those numbers gives two people the same ID.
  const [taken, setTaken] = useState<TakenMap>({ crm: new Map(), door: new Map(), claimed: new Map(), members: [] });
  const [idsLoaded, setIdsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [mRes, dRes] = await Promise.all([
          supabase.from('members').select('member_id, name, phone, membership_end, hik_person_id'),
          supabase.from('hik_device_ids').select('employee_no, name')
        ]);
        if (cancelled) return;
        // hik_device_ids may not exist yet - the member check still works
        setTaken(buildTakenMap(mRes.data || [], (dRes.data || []) as DeviceId[]));
        setIdsLoaded(true);
      } catch {
        /* never block adding a member because this lookup failed */
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const idConflict = checkId(formData.member_id, taken, formData.name);
  // Staff must tick this when the door record carries a different name. Only
  // they can tell a spelling variant from a different person.
  const [idConfirmed, setIdConfirmed] = useState(false);
  useEffect(() => { setIdConfirmed(false); }, [formData.member_id, formData.name]);
  // People who share a name. Same name AND same phone almost always means
  // staff failed to find an existing member and are creating a second record.
  const nameClash = findNameClash(formData.name, formData.phone, taken);
  const [dupConfirmed, setDupConfirmed] = useState(false);
  useEffect(() => { setDupConfirmed(false); }, [formData.name, formData.phone]);
  const freeIds = idsLoaded ? suggestFreeIds(taken, 5) : [];

  // Auto-calculate the end date and total amount when duration or start date changes
  useEffect(() => {
    if (duration !== 'custom' && formData.membership_start) {
      const months = parseInt(duration, 10);
      const newEndDate = addMonthsClamped(formData.membership_start, months);

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
    if (formData.membership_end <= formData.membership_start) {
      setError("Membership end date must be after the start date.");
      return;
    }
    // Two people must never share one ID - it means the door can be opened by
    // the wrong person and nothing looks wrong on screen.
    // Two people must never share one ID. But an ID that exists only on the
    // door, under this same person's name, is not a clash - it is the record
    // we are about to link to.
    if (isBlocked(idConflict)) {
      setError(
        `Member ID "${formData.member_id.trim()}" is already in use. ${idConflict.message}` +
        (freeIds.length ? ` Try ${freeIds.slice(0, 3).join(', ')} instead.` : '')
      );
      return;
    }
    if (nameClash.kind === 'likely_same_person' && !dupConfirmed) {
      setError(`${nameClash.message} Tick the box under the name to add them anyway.`);
      return;
    }
    if (idConflict.severity === 'confirm' && !idConfirmed) {
      setError(`${idConflict.message} Tick the box under the ID field to confirm, or change the ID.`);
      return;
    }

    setLoading(true);
    setError(null);

    let createdMemberId: string | null = null;
    try {
      // 1. Insert Member
      const insertData: any = {
        name: formData.name,
        phone: formData.phone,
        join_date: formData.join_date,
        membership_start: formData.membership_start,
        membership_end: formData.membership_end,
        goal: formData.goal,
        pt_enquiry: ptEnquiry,
        medical_condition: hasMedicalCondition ? formData.medical_condition || null : null,
      };
      if (formData.member_id.trim()) {
        insertData.member_id = formData.member_id.trim();
      }
      // Link to the door record now, so the nightly sync owns this member from
      // the start instead of skipping them until someone repairs it by hand.
      if (idConflict.linkDeviceId) {
        insertData.hik_person_id = idConflict.linkDeviceId;
      }

      const { data: memberData, error: insertError } = await supabase.from('members').insert([
        insertData,
      ]).select().single();

      if (insertError) throw insertError;
      createdMemberId = memberData.id;

      // 2. Insert Initial Payment (required)
      const { error: paymentError } = await supabase.from('payments').insert([{
        member_id: memberData.id,
        plan_name: getPlanName(duration),
        amount: Number(totalAmount),
        payment_date: formData.join_date,
        payment_method: paymentMethod
      }]);

      if (paymentError) throw paymentError;

      // If this member was linked to a door record, their fingerprint is still
      // carrying whatever window the terminal gave it - usually 2036. Push the
      // real end date now rather than leaving them with a decade of access
      // until the 03:00 reconcile picks it up.
      if (idConflict.linkDeviceId) {
        const newUuid = memberData.id;
        setTimeout(() => { syncMemberToDoor(newUuid); }, 2000);
      }

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
                <label htmlFor="member_id" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  MEMBER ID
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="member_id"
                    id="member_id"
                    value={formData.member_id}
                    onChange={handleChange}
                    className={`block w-full text-sm outline outline-1 rounded-md py-3 px-4 bg-[#0a0a0a] text-white transition-all ${
                      idConflict.severity === 'block'
                        ? 'outline-bullRed focus:outline-bullRed'
                        : idConflict.severity === 'confirm'
                          ? 'outline-amber-500 focus:outline-amber-500'
                          : 'outline-bullBorder focus:outline-bullRed'
                    }`}
                    placeholder="E.G. BULL-001"
                  />
                </div>

                {/* a real duplicate - cannot proceed */}
                {idConflict.severity === 'block' && (
                  <p className="mt-2 text-[11px] font-bold text-bullRed flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{idConflict.message}</span>
                  </p>
                )}

                {/* on the door under a different name - staff decide */}
                {idConflict.severity === 'confirm' && (
                  <div className="mt-2">
                    <p className="text-[11px] font-bold text-amber-400 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{idConflict.message}</span>
                    </p>
                    <label className="mt-2 flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={idConfirmed}
                        onChange={(e) => setIdConfirmed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-[10px] font-bold text-bullMuted uppercase tracking-widest">
                        Yes, this is the same person &mdash; use this ID
                      </span>
                    </label>
                  </div>
                )}

                {/* already enrolled at the door under this name - will be linked */}
                {idConflict.severity === 'allow' && idConflict.linkDeviceId && (
                  <p className="mt-2 text-[11px] font-bold text-emerald-400 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{idConflict.message}</span>
                  </p>
                )}

                {idConflict.severity === 'allow' && !idConflict.linkDeviceId && freeIds.length > 0 && (
                  <p className="mt-2 text-[10px] font-bold text-bullMuted uppercase tracking-widest">
                    Free to use here and at the terminal:{' '}
                    <span className="text-emerald-400">{freeIds.join('  Â·  ')}</span>
                  </p>
                )}
              </div>

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
                    className={`block w-full text-sm outline outline-1 rounded-md py-3 px-4 bg-[#0a0a0a] text-white transition-all ${
                      nameClash.kind === 'likely_same_person'
                        ? 'outline-bullRed focus:outline-bullRed'
                        : 'outline-bullBorder focus:outline-bullRed'
                    }`}
                    placeholder="JOHN DOE"
                  />
                </div>

                {/* same name AND same phone - almost certainly a second record
                    for somebody who already exists */}
                {nameClash.kind === 'likely_same_person' && (
                  <div className="mt-2">
                    <p className="text-[11px] font-bold text-bullRed flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{nameClash.message}</span>
                    </p>
                    <label className="mt-2 flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dupConfirmed}
                        onChange={(e) => setDupConfirmed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 accent-bullRed"
                      />
                      <span className="text-[10px] font-bold text-bullMuted uppercase tracking-widest">
                        I checked &mdash; this is a different person, add them
                      </span>
                    </label>
                  </div>
                )}

                {/* same name, different phone is a genuine namesake and is not
                    flagged - 12 such pairs already exist and none share a
                    phone, so warning there would just train staff to ignore
                    warnings. */}
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

              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                  MEDICAL CONDITION
                </label>
                <div className="mt-1">
                  <label className="inline-flex items-center gap-3 cursor-pointer bg-[#0a0a0a] outline outline-1 outline-bullBorder rounded-md py-3 px-4 hover:bg-bullBorder transition-colors w-full">
                    <input
                      type="checkbox"
                      checked={hasMedicalCondition}
                      onChange={(e) => {
                        setHasMedicalCondition(e.target.checked);
                        if (!e.target.checked) {
                          setFormData(prev => ({ ...prev, medical_condition: '' }));
                        }
                      }}
                      className="w-4 h-4 rounded border-bullBorder text-bullRed focus:ring-bullRed bg-[#141414]"
                    />
                    <span className="text-[11px] font-bold text-white uppercase tracking-widest">HAS MEDICAL CONDITION</span>
                  </label>
                </div>
              </div>

              {hasMedicalCondition && (
                <div className="sm:col-span-2">
                  <label htmlFor="medical_condition" className="block text-[10px] font-bold text-bullMuted uppercase tracking-widest mb-2">
                    CONDITION DETAILS
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
              )}
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
                  <CustomDateInput
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
                  <CustomDateInput
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
                  <CustomDateInput
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
                    <span className="text-bullMuted text-sm font-bold">â‚¹</span>
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




