import { useState } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const DEFAULT_USERS = [
  { permanentId: 'GLP-9041-K7-VERIFIED', password: 'password123', name: 'Eleanor Vance' },
  { permanentId: 'GLP-8842-X9', password: 'password123', name: 'Demo Patient' },
];

export default function AuthPage({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [permanentId, setPermanentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Retrieve stored users from localStorage or fall back to defaults
  const getUsers = () => {
    try {
      const stored = localStorage.getItem('onepatient_users');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_USERS;
  };

  const saveUsers = (users) => {
    try {
      localStorage.setItem('onepatient_users', JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedId = permanentId.trim();

    if (!trimmedId) {
      setError('Please enter your Permanent ID.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    const users = getUsers();

    if (isSignUp) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Please enter your full name.');
        return;
      }

      // Check if permanent ID already exists
      const idExists = users.some(
        (u) => u.permanentId.toLowerCase() === trimmedId.toLowerCase()
      );

      if (idExists) {
        setError('This Permanent ID is already registered. Please choose a different unique ID or log in.');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }

      if (confirmPassword && password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      // Add new user with their chosen name
      const newUser = { permanentId: trimmedId, password, name: trimmedName };
      const updatedUsers = [...users, newUser];
      saveUsers(updatedUsers);

      setSuccess('Account registered successfully! Logging you in...');
      setTimeout(() => {
        onLoginSuccess(newUser);
      }, 700);
    } else {
      // Login validation
      const foundUser = users.find(
        (u) =>
          u.permanentId.toLowerCase() === trimmedId.toLowerCase() &&
          u.password === password
      );

      if (!foundUser) {
        setError('Invalid Permanent ID or password. Please try again.');
        return;
      }

      setSuccess('Welcome back! Logging you in...');
      setTimeout(() => {
        onLoginSuccess(foundUser);
      }, 500);
    }
  };

  return (
    <div className="hero-teal-gradient min-h-screen flex items-center justify-center p-4 relative overflow-hidden mesh-subtle-pattern">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Auth Card */}
      <div className="relative z-10 w-full max-w-md glass-floating-panel rounded-3xl shadow-card-glass p-8 sm:p-10 border border-white/40">
        
        {/* Logo and Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow mb-3">
            <span className="text-white font-black text-xl">Dr.</span>
          </div>
          <h1 className="text-2xl font-black text-[#00241f] tracking-tight">OnePatient</h1>
          <p className="text-xs text-teal-700 font-semibold uppercase tracking-wider mt-0.5">
            Federated Health Record Ledger
          </p>
          <div className="mt-3 text-xs text-slate-500 max-w-xs">
            {isSignUp
              ? 'Create your sovereign cryptographic medical identity.'
              : 'Sign in to access your unified medical story & records.'}
          </div>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2">
            <Icon name="error" className="text-base text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl p-3 flex items-start gap-2">
            <Icon name="check_circle" className="text-base text-teal-600 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name Input (Only on Sign Up) */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400">
                  <Icon name="person" className="text-lg" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Permanent ID Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Permanent ID
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">
                <Icon name="badge" className="text-lg" />
              </span>
              <input
                type="text"
                placeholder={isSignUp ? "e.g. GLP-9921-M3" : "Enter your Permanent ID"}
                value={permanentId}
                onChange={(e) => setPermanentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-mono placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                required
              />
            </div>
            {isSignUp && (
              <span className="text-[11px] text-teal-700 font-medium block mt-1">
                Must be unique across the ledger database.
              </span>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">
                <Icon name="lock" className="text-lg" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-lg" />
              </button>
            </div>
          </div>

          {/* Confirm Password (only on Sign Up) */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400">
                  <Icon name="lock_reset" className="text-lg" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full teal-gradient-btn text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-pill-glow hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Icon name={isSignUp ? 'person_add' : 'login'} className="text-lg" />
              <span>{isSignUp ? 'Create Sovereign Account' : 'Log In'}</span>
            </button>
          </div>
        </form>

        {/* Toggle between Login and Sign Up */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          {isSignUp ? (
            <p className="text-xs text-slate-600">
              Already have a Permanent ID?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-teal-700 font-bold hover:underline ml-1"
              >
                Log In
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              New here?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  setSuccess('');
                }}
                className="text-teal-700 font-bold hover:underline ml-1"
              >
                Sign up
              </button>
            </p>
          )}
        </div>

        {/* Demo Hint */}
        {!isSignUp && (
          <div className="mt-4 bg-teal-50/60 rounded-xl p-2.5 text-center text-[11px] text-teal-800/80">
            <span>Demo ID: </span>
            <button
              type="button"
              onClick={() => {
                setPermanentId('GLP-9041-K7-VERIFIED');
                setPassword('password123');
              }}
              className="font-mono font-bold text-teal-900 underline hover:text-teal-700"
            >
              GLP-9041-K7-VERIFIED
            </button>
            <span className="block text-[10px] text-slate-400 mt-0.5">Password: password123</span>
          </div>
        )}
      </div>
    </div>
  );
}

