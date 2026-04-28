import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { 
  Dumbbell, LayoutDashboard, Users, LogOut, 
  CalendarOff, Menu, X, Landmark, Settings 
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/members', label: 'Members', icon: Users },
  { path: '/finance', label: 'Finance', icon: Landmark },
  { path: '/off-days', label: 'Off Days', icon: CalendarOff },
];

interface NavLinkProps {
  item: NavItem;
  isMobile?: boolean;
  pathname: string;
  onCloseMobile?: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ item, isMobile = false, pathname, onCloseMobile }) => {
  const Icon = item.icon;
  const isActive = pathname.startsWith(item.path);
  
  const baseClass = isMobile 
    ? "flex items-center px-4 py-3 text-base font-medium transition-all "
    : "flex items-center px-6 py-4 text-sm font-semibold transition-all relative group ";
  
  const activeClass = isActive 
    ? "text-bullText bg-bullSurface border-l-4 border-bullRed" 
    : "text-bullMuted hover:text-bullText hover:bg-bullSurface/50 border-l-4 border-transparent";

  return (
    <Link
      to={item.path}
      onClick={() => isMobile && onCloseMobile?.()}
      className={`${baseClass} ${activeClass}`}
      style={{ marginLeft: isActive ? '-4px' : '0' }}
    >
      <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-bullRed' : 'opacity-70 group-hover:opacity-100'}`} />
      {item.label}
    </Link>
  );
};

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-bullDark font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#0A0A0A] fixed inset-y-0 z-50 border-r border-[#1a1a1a]">
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="px-6 py-8 flex items-center gap-3 border-b border-[#1A1A1A]">
            <Dumbbell className="h-8 w-8 text-bullRed transform -rotate-12" strokeWidth={2.5} />
            <div className="flex flex-col">
              <h1 className="text-white font-black text-lg tracking-wider leading-none">
                FITNESS ADDICT
              </h1>
              <span className="text-[#888888] text-[10px] font-bold tracking-widest mt-1 uppercase">
                UNISEX GYM
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="mt-8 flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                item={item} 
                pathname={location.pathname} 
              />
            ))}
          </nav>

          {/* Footer Branding */}
          <div className="p-6 mt-auto">
            <div className="flex flex-col gap-4">
              <Link to="/settings" className="flex items-center gap-3 text-bullMuted hover:text-bullText transition-colors font-medium text-sm">
                <Settings className="h-5 w-5" />
                Settings
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 text-bullMuted hover:text-bullText transition-colors font-medium text-sm"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
            <p className="text-[10px] text-[#555] mt-8 uppercase font-bold tracking-widest">
              POWERED BY HUMICA AI
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-[260px]">
        {/* Top bar - Mobile / Tablet */}
        <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] h-20 sticky top-0 z-40 lg:hidden flex items-center shadow-sm">
          <div className="flex items-center justify-between px-6 w-full">
            <div className="flex items-center gap-3 overflow-hidden">
              <Dumbbell className="h-6 w-6 text-bullRed transform -rotate-12 flex-shrink-0" strokeWidth={2.5} />
              <div className="flex flex-col">
                <h1 className="text-white font-black tracking-wider leading-none uppercase text-sm">FITNESS ADDICT</h1>
                <span className="text-bullMuted text-[8px] font-bold tracking-widest mt-1 uppercase">UNISEX GYM</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-bullMuted hover:text-white transition-colors flex-shrink-0"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div 
            className="fixed inset-0 bg-bullDark/80 backdrop-blur-sm" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <nav className="fixed inset-y-0 left-0 w-72 bg-[#0a0a0a] shadow-2xl flex flex-col border-r border-[#1a1a1a] animate-fade-in-left">
            <div className="px-6 py-8 flex items-center justify-between border-b border-[#1A1A1A]">
              <div className="flex items-center gap-3">
                <Dumbbell className="h-6 w-6 text-bullRed transform -rotate-12" strokeWidth={2.5} />
                <div className="flex flex-col">
                  <h1 className="text-white font-black tracking-wider leading-none uppercase text-sm">FITNESS ADDICT</h1>
                  <span className="text-bullMuted text-[8px] font-bold tracking-widest mt-1 uppercase">UNISEX GYM</span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-bullMuted hover:text-white p-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 mt-4">
              {navItems.map((item) => (
                <NavLink 
                  key={item.path} 
                  item={item} 
                  isMobile 
                  pathname={location.pathname}
                  onCloseMobile={() => setMobileMenuOpen(false)} 
                />
              ))}
            </div>
            <div className="p-6 border-t border-[#1a1a1a]">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 text-bullMuted font-medium hover:text-white transition-colors text-sm"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
              <p className="text-[10px] text-[#555] mt-8 uppercase font-bold tracking-widest">
                POWERED BY HUMICA AI
              </p>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};