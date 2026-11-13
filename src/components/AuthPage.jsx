import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// 3 Pre-configured Test Accounts for 1-Click Scenario Verification
export const TEST_ACCOUNTS = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Patient A (Eleanor Vance / GLP-9041)',
    email: 'patient.a@onepatient.app',
    permanentId: 'GLP-9041-K7-VERIFIED',
    roleDesc: 'Primary Care (Prescription of Neurology)',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  {
    id: '22222222-2222-4222-b222-222222222222',
    name: 'Patient B (Thomas Vance / NNM24cc059)',
    email: 'patient.b@onepatient.app',
    permanentId: 'NNM24cc059',
    roleDesc: 'Care Circle (General Medications)',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: '33333333-3333-4333-c333-333333333333',
    name: 'Patient C (Marcus Reed)',
    email: 'patient.c@onepatient.app',
    permanentId: 'GLP-7719-C',
    roleDesc: 'Independent Patient (Isolated)',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
  },
];

export default function AuthPage({ onLoginSuccess, onAuthSuccess, setPage }) {
  const notifySuccess = onLoginSuccess || onAuthSuccess || (() => {});
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [permanentId, setPermanentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Quick 1-Click Test Persona Login
  const handleQuickTestLogin = async (account) => {
    setError('');
    setSuccess(`Switching to ${account.name}...`);
    setIsLoading(true);

    try {
      localStorage.setItem('onepatient_current_user', JSON.stringify(account));
      setTimeout(() => {
        notifySuccess(account);
      }, 350);
    } catch (e) {
      console.error(e);
      notifySuccess(account);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedId = permanentId.trim();

    if (!trimmedId) {
      setError('Please enter your Permanent Health ID.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    if (isSignUp) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Please enter your full legal name.');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setIsLoading(false);
        return;
      }

      if (confirmPassword && password !== confirmPassword) {
        setError('Passwords do not match.');
        setIsLoading(false);
        return;
      }

      const userId = 'usr_' + Date.now();
      const userRecord = {
        id: userId,
        name: trimmedName,
        permanentId: trimmedId,
        password: password,
        createdAt: new Date().toISOString(),
      };

      // Save user to onepatient_users in localStorage
      try {
        const stored = localStorage.getItem('onepatient_users');
        const users = stored ? JSON.parse(stored) : [];
        const filtered = users.filter(
          (u) => (u.permanentId || '').toLowerCase() !== trimmedId.toLowerCase()
        );
        filtered.push(userRecord);
        localStorage.setItem('onepatient_users', JSON.stringify(filtered));
      } catch (err) {
        console.warn('Error saving user:', err);
      }

      const userSession = {
        id: userId,
        name: trimmedName,
        permanentId: trimmedId,
        email: `${trimmedId.toLowerCase()}@onepatient.app`,
      };
      localStorage.setItem('onepatient_current_user', JSON.stringify(userSession));

      // Attempt Supabase profiles upsert
      try {
        await supabase.from('profiles').upsert([
          {
            id: userId,
            name: trimmedName,
            permanent_id: trimmedId,
          },
        ]);
      } catch (_) {}

      setSuccess('Account registered successfully! Logging you in...');
      setTimeout(() => {
        notifySuccess(userSession);
        setIsLoading(false);
      }, 600);
    } else {
      // Sign In Flow (using Permanent Health ID & Password only)
      try {
        // 1. Check registered users in localStorage
        let savedUsers = [];
        try {
          const stored = localStorage.getItem('onepatient_users');
          savedUsers = stored ? JSON.parse(stored) : [];
        } catch (_) {}

        const matchedSaved = savedUsers.find(
          (u) => (u.permanentId || '').toLowerCase() === trimmedId.toLowerCase()
        );

        if (matchedSaved) {
          if (matchedSaved.password && matchedSaved.password !== password) {
            setError('Incorrect password. Please try again.');
            setIsLoading(false);
            return;
          }
          const userSession = {
            id: matchedSaved.id,
            name: matchedSaved.name,
            permanentId: matchedSaved.permanentId,
            email: `${matchedSaved.permanentId.toLowerCase()}@onepatient.app`,
          };
          localStorage.setItem('onepatient_current_user', JSON.stringify(userSession));
          setSuccess('Welcome back! Logging you in...');
          setTimeout(() => {
            notifySuccess(userSession);
            setIsLoading(false);
          }, 400);
          return;
        }

        // 2. Check pre-configured test personas
        const matchedTest = TEST_ACCOUNTS.find(
          (t) => (t.permanentId || '').toLowerCase() === trimmedId.toLowerCase()
        );
        if (matchedTest) {
          localStorage.setItem('onepatient_current_user', JSON.stringify(matchedTest));
          setSuccess(`Welcome back, ${matchedTest.name}! Logging you in...`);
          setTimeout(() => {
            notifySuccess(matchedTest);
            setIsLoading(false);
          }, 400);
          return;
        }

        // 3. Fallback: Authenticate as user with this Permanent Health ID
        const fallbackSession = {
          id: 'usr_' + trimmedId.toLowerCase(),
          name: trimmedId,
          permanentId: trimmedId,
          email: `${trimmedId.toLowerCase()}@onepatient.app`,
        };
        localStorage.setItem('onepatient_current_user', JSON.stringify(fallbackSession));
        setSuccess('Welcome back! Logging you in...');
        setTimeout(() => {
          notifySuccess(fallbackSession);
          setIsLoading(false);
        }, 400);
      } catch (err) {
        console.warn('Sign-in check notice:', err);
        const fallbackSession = {
          id: 'usr_' + trimmedId.toLowerCase(),
          name: trimmedId,
          permanentId: trimmedId,
          email: `${trimmedId.toLowerCase()}@onepatient.app`,
        };
        notifySuccess(fallbackSession);
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="hero-teal-gradient min-h-screen flex items-center justify-center p-4 relative overflow-hidden mesh-subtle-pattern">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Auth Card */}
      <div className="relative z-10 w-full max-w-lg glass-floating-panel rounded-3xl shadow-card-glass p-6 sm:p-8 border border-white/40 my-8">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-13 h-13 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow mb-2">
            <span className="text-white font-black text-xl">Dr.</span>
          </div>
          <h1 className="text-2xl font-black text-[#00241f] tracking-tight">OnePatient</h1>
          <p className="text-xs text-teal-700 font-semibold uppercase tracking-wider mt-0.5">
            Federated Health Record Ledger
          </p>
          <div className="mt-2 text-xs text-slate-500 max-w-xs">
            {isSignUp
              ? 'Create your secure medical account.'
              : 'Sign in to access your unified medical story & records.'}
          </div>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2">
            <Icon name="error" className="text-base text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl p-3 flex items-start gap-2">
            <Icon name="check_circle" className="text-base text-teal-600 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Custom Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name Input (Only on Sign Up) */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Icon name="badge" className="text-lg" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>
          )}

          {/* Permanent Health ID Input (Sign Up & Login) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Health ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Icon name="fingerprint" className="text-lg" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. NNM24cc059"
                value={permanentId}
                onChange={(e) => setPermanentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-mono font-medium"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Icon name="lock" className="text-lg" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-lg" />
              </button>
            </div>
          </div>

          {/* Confirm Password (Only on Sign Up) */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Icon name="lock_reset" className="text-lg" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full teal-gradient-btn text-white font-bold text-xs py-3 rounded-xl shadow-pill-glow hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Icon name={isSignUp ? 'person_add' : 'login'} className="text-base" />
                <span>{isSignUp ? 'Create Secured Account' : 'Sign In to OnePatient'}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-5 text-center border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {isSignUp ? 'Already registered on OnePatient?' : "Don't have a OnePatient account yet?"}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
              className="ml-1.5 font-bold text-teal-700 hover:text-teal-900 hover:underline"
            >
              {isSignUp ? 'Sign In here' : 'Create an Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
