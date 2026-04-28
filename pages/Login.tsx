import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Dumbbell, Lock, User, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = email.includes('@') ? email : `${email}@humica.ai`;
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-bullDark flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-bullRed rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/20 mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <Dumbbell className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter text-center leading-none whitespace-nowrap">
            FITNESS ADDICT UNISEX GYM
          </h1>
          <p className="mt-3 text-center text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
            Gym Management System by humica.ai
          </p>
        </div>

        <div className="bg-bullSurface py-10 px-6 shadow-2xl rounded-[2.5rem] border border-bullBorder sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 bg-bullDark border-none rounded-2xl text-sm font-bold text-white placeholder-gray-500 focus:ring-2 focus:ring-bullRed transition-all"
                  placeholder="Humica"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">
                Secret Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 bg-bullDark border-none rounded-2xl text-sm font-bold text-white placeholder-gray-500 focus:ring-2 focus:ring-bullRed transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs font-bold text-bullRed bg-bullRed/10 border border-bullRed/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in-down">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl shadow-red-900/10 text-xs font-black uppercase tracking-widest text-white bg-bullRed hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bullRed disabled:opacity-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? 'Authenticating...' : 'Access the Gym'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Proprietary Internal Access Only
          </p>
        </div>
      </div>
    </div>
  );
};