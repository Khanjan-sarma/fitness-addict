import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { calculateStatus } from '../utils/statusUtils';
import {
  Users, UserCheck, AlertCircle, XCircle,
  TrendingUp, CalendarDays,
  Clock, CalendarClock, AlertOctagon, History,
  UserPlus, CalendarOff, ArrowRight
} from 'lucide-react';

const MONTHLY_GOAL = 200000; // ₹2L — change this to adjust the goal

interface MonthlyRevenue {
  sortKey: string;
  month: string;
  revenue: number;
}

interface AlertMember {
  id: string;
  name: string;
  phone: string;
  membership_end: string;
}

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [memberStats, setMemberStats] = useState({
    total: 0,
    active: 0,
    due: 0,
    expired: 0,
  });

  const [revenueStats, setRevenueStats] = useState({
    total: 0,
    currentMonth: 0,
    todayRevenue: 0,
    paymentsCount: 0,
  });

  const [alerts, setAlerts] = useState({
    in3Days: [] as AlertMember[],
    tomorrow: [] as AlertMember[],
    today: [] as AlertMember[],
    ago3Days: [] as AlertMember[],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [membersResponse, paymentsResponse] = await Promise.all([
        supabase.from('members').select('id, name, phone, membership_end'),
        supabase.from('payments').select('amount, payment_date')
      ]);

      if (membersResponse.error) throw membersResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      console.log('[Dashboard] Members:', membersResponse.data?.length, membersResponse.data);
      console.log('[Dashboard] Payments:', paymentsResponse.data?.length, paymentsResponse.data);

      if (membersResponse.data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const calculatedAlerts = {
          in3Days: [] as AlertMember[],
          tomorrow: [] as AlertMember[],
          today: [] as AlertMember[],
          ago3Days: [] as AlertMember[],
        };

        const calculatedMemberStats = membersResponse.data.reduce(
          (acc, member) => {
            acc.total += 1;
            const status = calculateStatus(member.membership_end);
            if (status === 'Active') acc.active += 1;
            else if (status === 'Due') acc.due += 1;
            else if (status === 'Expired') acc.expired += 1;

            if (member.membership_end) {
              const [year, month, day] = member.membership_end.split('-').map(Number);
              const endDate = new Date(year, month - 1, day);
              endDate.setHours(0, 0, 0, 0);

              const diffTime = endDate.getTime() - today.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays === 3) calculatedAlerts.in3Days.push(member);
              else if (diffDays === 1) calculatedAlerts.tomorrow.push(member);
              else if (diffDays === 0) calculatedAlerts.today.push(member);
              else if (diffDays === -3) calculatedAlerts.ago3Days.push(member);
            }

            return acc;
          },
          { total: 0, active: 0, due: 0, expired: 0 }
        );

        setMemberStats(calculatedMemberStats);
        setAlerts(calculatedAlerts);
      }

      if (paymentsResponse.data) {
        let totalRev = 0;
        let currentMonthRev = 0;
        let todayRev = 0;
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const todayStr = now.toISOString().split('T')[0];

        paymentsResponse.data.forEach((payment) => {
          const amt = Number(payment.amount) || 0;
          totalRev += amt;
          if (payment.payment_date && payment.payment_date.startsWith(currentMonthStr)) {
            currentMonthRev += amt;
          }
          if (payment.payment_date === todayStr) {
            todayRev += amt;
          }
        });

        setRevenueStats({
          total: totalRev,
          currentMonth: currentMonthRev,
          todayRevenue: todayRev,
          paymentsCount: paymentsResponse.data.length,
        });
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bullRed"></div>
      </div>
    );
  }

  const kpiCards = [
    { name: 'Total Members', value: memberStats.total, icon: Users, color: 'text-white', bg: 'bg-bullDark', strip: 'bg-bullRed' },
    { name: 'Active Members', value: memberStats.active, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10', strip: 'bg-bullRed' },
    { name: 'Due Today', value: memberStats.due, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10', strip: 'bg-bullRed' },
    { name: 'Expired', value: memberStats.expired, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', strip: 'bg-bullRed' },
  ];

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-10 font-sans">
      {/* Greeting Area */}
      <section className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <p className="text-bullText font-medium text-sm mb-1">Welcome back,</p>
          <h1 className="text-[40px] leading-none font-black text-white uppercase tracking-tight">COACH</h1>
          <p className="text-bullMuted font-medium mt-3 flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" /> {todayStr}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-2">
          <Link
            to="/off-days"
            className="px-6 py-3 bg-transparent border border-bullBorder rounded-md text-bullText font-bold hover:bg-bullSurface transition-all uppercase text-sm tracking-widest flex items-center"
          >
            <CalendarOff className="h-4 w-4 mr-2 opacity-70" /> MARK OFF DAY
          </Link>
          <Link
            to="/add-member"
            className="px-6 py-3 bg-bullRed rounded-md text-white font-bold hover:bg-red-700 transition-all uppercase text-sm tracking-widest flex items-center"
          >
            <UserPlus className="h-4 w-4 mr-2" /> ADD MEMBER
          </Link>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-bullSurface outline outline-1 outline-bullBorder rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.strip || 'bg-bullRed'}`} />
              <div className="flex items-center gap-4 mt-1">
                <div className={`p-3 rounded-full outline outline-1 outline-bullBorder ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-bullMuted font-bold uppercase text-[10px] tracking-widest">{card.name}</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{card.value}</h3>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Alerts Grid - Takes 2 cols */}
        <section className="xl:col-span-2 space-y-4">
          <h2 className="text-[13px] font-black text-white uppercase tracking-[0.2em] mb-4 pb-2 border-b border-bullRed inline-block">
            MEMBERSHIP ALERTS
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AlertBox title="DUE TODAY" items={alerts.today} themeColor="red" />
            <AlertBox title="DUE TOMORROW" items={alerts.tomorrow} themeColor="red" />
            <AlertBox title="DUE IN 3 DAYS" items={alerts.in3Days} themeColor="red" />
            <AlertBox title="EXPIRED 3+ DAYS AGO" items={alerts.ago3Days} themeColor="red" />
          </div>
        </section>

        {/* Financial Preview Sidebar */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-bullRed pb-2">
            <h2 className="text-[13px] font-black text-white uppercase tracking-[0.2em]">
              FINANCE SUMMARY
            </h2>
            <Link to="/finance" className="text-bullRed font-bold text-xs uppercase tracking-widest flex items-center gap-1 group">
              VIEW ALL <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="bg-bullSurface rounded-xl p-6 outline outline-1 outline-bullBorder">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-2">
                <p className="text-bullText uppercase text-[10px] font-bold tracking-widest">THIS MONTH REVENUE</p>
                <h3 className="text-4xl font-bold text-white">{formatCurrency(revenueStats.currentMonth)}</h3>
              </div>
              <div className="text-bullRed opacity-20">
                <TrendingUp className="h-16 w-16" />
              </div>
            </div>
            
            <div className="h-[1px] w-full bg-bullBorder my-6"></div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bullDark rounded-lg p-4 outline outline-1 outline-bullBorder">
                <p className="text-bullMuted uppercase text-[10px] font-bold tracking-widest mb-2">TOTAL REVENUE</p>
                <p className="text-2xl font-bold text-bullText">{formatCurrency(revenueStats.total)}</p>
              </div>
              <div className="bg-bullDark rounded-lg p-4 outline outline-1 outline-bullBorder">
                <p className="text-bullMuted uppercase text-[10px] font-bold tracking-widest mb-2">TODAY</p>
                <p className="text-2xl font-bold text-bullRed">{formatCurrency(revenueStats.todayRevenue)}</p>
              </div>
            </div>
            
            <div className="h-[1px] w-full bg-bullBorder my-6"></div>

            <div className="flex items-center justify-between">
              <p className="text-bullMuted uppercase text-[10px] font-bold tracking-widest">TOTAL PAYMENTS</p>
              <p className="text-2xl font-bold text-white">{revenueStats.paymentsCount}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const AlertBox = ({ title, items, themeColor = 'red' }: any) => {
  const headerBg = themeColor === 'red' ? 'bg-red-500' : themeColor === 'orange' ? 'bg-orange-500' : 'bg-bullSurface';
  const valBg = themeColor === 'red' ? 'bg-[#981014] text-white' : themeColor === 'orange' ? 'bg-orange-700 text-white' : 'bg-[#330000] text-bullRed';
  
  return (
    <div className={`rounded-xl overflow-hidden outline outline-1 outline-bullBorder bg-bullSurface flex flex-col h-[180px]`}>
      <div className={`px-4 py-3 flex items-center justify-between ${headerBg}`}>
        <div className="text-[11px] font-bold text-bullText tracking-widest uppercase">
          {title}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${valBg}`}>
          {items.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-bullMuted gap-2">
            <Users className="h-8 w-8 opacity-30 mt-2" />
            <span className="text-[10px] font-medium tracking-widest pt-2">No members</span>
            <span className="text-[10px]">
              {title === 'DUE TODAY' ? 'Great! No payments due today.' :
               title === 'DUE TOMORROW' ? 'Great! No payments due tomorrow.' :
               title === 'DUE IN 3 DAYS' ? 'No payments due in the next 3 days.' :
               'No expired members.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-bullBorder">
            {items.map((m: any) => (
              <div key={m.id} className="p-4 hover:bg-bullDark transition-colors">
                <p className="text-sm font-bold text-bullText truncate">{m.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] text-bullMuted font-medium">{m.phone}</p>
                  <p className="text-[10px] font-bold text-bullRed">{m.membership_end}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};