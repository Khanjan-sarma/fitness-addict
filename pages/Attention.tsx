import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Member } from '../types';
import {
  computeFlags, countBySeverity, totalDaysOwed, Flag, Severity, PaymentRow
} from '../utils/attentionChecks';
import {
  AlertTriangle, AlertCircle, Info, ChevronRight, RefreshCw, CheckCircle2
} from 'lucide-react';

const SEVERITY_STYLE: Record<Severity, { label: string; ring: string; text: string; bg: string; Icon: any }> = {
  high:   { label: 'Needs fixing now', ring: 'border-bullRed/40',   text: 'text-bullRed',   bg: 'bg-bullRed/10',   Icon: AlertTriangle },
  medium: { label: 'Worth checking',   ring: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-500/10', Icon: AlertCircle },
  low:    { label: 'Tidy up',          ring: 'border-bullBorder',   text: 'text-gray-400',  bg: 'bg-white/5',      Icon: Info }
};

export const Attention: React.FC = () => {
  const navigate = useNavigate();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<Severity, boolean>>({ high: true, medium: true, low: false });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, pRes] = await Promise.all([
        supabase.from('members').select('id, member_id, name, phone, membership_start, membership_end'),
        supabase.from('payments').select('member_id, amount, payment_date, plan_name')
      ]);
      if (mRes.error) throw mRes.error;
      if (pRes.error) throw pRes.error;
      setFlags(computeFlags((mRes.data || []) as Member[], (pRes.data || []) as PaymentRow[]));
    } catch (err: any) {
      setError(err?.message || 'Could not load the checks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = countBySeverity(flags);
  const owed = totalDaysOwed(flags);

  const openMember = (name: string) => {
    navigate('/members', { state: { searchMember: name } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-bullRed" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Needs Attention</h1>
          <p className="text-[11px] font-bold uppercase tracking-widest text-bullMuted mt-1">
            Checks run on your live data every time this page opens
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 border border-bullBorder rounded-md text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-bullBorder/30 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </button>
      </div>

      {error && (
        <div className="text-xs font-bold text-bullRed bg-bullRed/10 border border-bullRed/20 rounded-md p-4">
          {error}
        </div>
      )}

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['high', 'medium', 'low'] as Severity[]).map(sev => {
          const s = SEVERITY_STYLE[sev];
          return (
            <div key={sev} className={`border ${s.ring} ${s.bg} rounded-md p-4`}>
              <div className="flex items-center gap-2">
                <s.Icon className={`h-4 w-4 ${s.text}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-bullMuted">{s.label}</span>
              </div>
              <p className={`text-3xl font-black mt-2 ${s.text}`}>{counts[sev]}</p>
            </div>
          );
        })}
        <div className="border border-bullBorder bg-white/5 rounded-md p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-bullMuted">Access owed</span>
          <p className="text-3xl font-black mt-2 text-white">{owed}</p>
          <span className="text-[10px] font-bold uppercase tracking-widest text-bullMuted">days</span>
        </div>
      </div>

      {flags.length === 0 && !error && (
        <div className="flex items-center gap-3 border border-emerald-600/30 bg-emerald-600/10 rounded-md p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-sm font-bold text-white">Nothing needs attention. Everything checks out.</p>
        </div>
      )}

      {/* groups */}
      {(['high', 'medium', 'low'] as Severity[]).map(sev => {
        const group = flags.filter(f => f.severity === sev);
        if (group.length === 0) return null;
        const s = SEVERITY_STYLE[sev];
        const open = openGroups[sev];
        return (
          <div key={sev} className="space-y-2">
            <button
              onClick={() => setOpenGroups(prev => ({ ...prev, [sev]: !prev[sev] }))}
              className="flex items-center gap-2 w-full text-left"
            >
              <ChevronRight className={`h-4 w-4 text-bullMuted transition-transform ${open ? 'rotate-90' : ''}`} />
              <s.Icon className={`h-4 w-4 ${s.text}`} />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">{s.label}</span>
              <span className="text-[11px] font-black text-bullMuted">({group.length})</span>
            </button>

            {open && (
              <div className="space-y-2">
                {group.map((f, i) => (
                  <div
                    key={`${f.memberUuid}-${f.code}-${i}`}
                    className={`border ${s.ring} rounded-md bg-bullSurface p-4 flex items-start justify-between gap-4`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{f.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-bullMuted border border-bullBorder rounded px-1.5 py-0.5">
                          {f.memberId}
                        </span>
                        {f.phone && (
                          <span className="text-[10px] font-bold text-bullMuted">{f.phone}</span>
                        )}
                      </div>
                      <p className={`text-[11px] font-black uppercase tracking-widest mt-1.5 ${s.text}`}>{f.title}</p>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{f.detail}</p>
                    </div>
                    <button
                      onClick={() => openMember(f.name)}
                      className="flex-shrink-0 px-3 py-2 border border-bullBorder rounded-md text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-bullBorder/30 transition-colors"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] font-bold uppercase tracking-widest text-bullMuted pt-2">
        Door-related checks (not enrolled, no fingerprint, on the door but not a member)
        will appear here once the nightly device check is running.
      </p>
    </div>
  );
};
