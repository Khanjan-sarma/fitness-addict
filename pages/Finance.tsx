import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  Landmark, DollarSign, TrendingUp,
  CreditCard, Search, Download, Filter,
  ArrowUpRight, BarChart3
} from 'lucide-react';

export const Finance: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const exportCSV = () => {
    if (payments.length === 0) return;
    const header = 'Member,Plan,Date,Amount,Payment Method\n';
    const rows = payments.map(p =>
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
      <section className="bg-bullSurface rounded-xl outline outline-1 outline-bullBorder overflow-hidden mt-10">
        <div className="p-6 border-b border-bullBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">TRANSACTION HISTORY</h3>
          <div className="flex gap-2">
            <button className="p-2 outline outline-1 outline-bullBorder rounded-md text-bullMuted hover:text-white transition-colors">
              <Filter className="h-4 w-4" />
            </button>
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
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-bullMuted">
                      <CreditCard className="h-12 w-12 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">No payments recorded</p>
                    </div>
                  </td>
                </tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-bullDark transition-colors">
                  <td className="px-6 py-5 whitespace-nowrap font-bold text-bullText text-sm">{p.members?.name || 'Unknown'}</td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-bullMuted">{p.plan_name || '-'}</td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm text-bullMuted font-medium">{p.payment_date}</td>
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