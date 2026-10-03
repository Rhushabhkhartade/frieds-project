import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Toast from '../components/common/Toast';
import { HeartPulse, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Check for registration redirect or session expiration notification
  useEffect(() => {
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
    }
    if (location.state?.justRegistered) {
      setToast({
        type: 'success',
        title: 'Registration Complete',
        message: 'Your clinical account has been created. Please sign in with your credentials.'
      });
    }

    const sessionNotice = sessionStorage.getItem('auth_notice');
    if (sessionNotice) {
      setToast({
        type: 'warning',
        title: 'Session Expired',
        message: sessionNotice
      });
      sessionStorage.removeItem('auth_notice');
    }
  }, [location.state]);

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password
      });

      // Redirect to intended route or default dashboard
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err.message || (err.code === 'INVALID_CREDENTIALS'
        ? 'Invalid email or password. Please verify your credentials.'
        : 'Sign in failed. Please verify the server is running on port 5000.');

      setToast({
        type: 'error',
        title: 'Authentication Error',
        message
      });

      if (err.details && Array.isArray(err.details)) {
        const fieldErrors = {};
        err.details.forEach(d => {
          if (d.field) fieldErrors[d.field] = d.message;
        });
        setErrors(prev => ({ ...prev, ...fieldErrors }));
      }
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail, demoPw) => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setErrors({});
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-slate-900 px-4 font-sans select-none">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blood-600 to-blood-800 text-white shadow-xl shadow-blood-950/60 mb-4">
            <HeartPulse className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BLOOD AI</h1>
          <p className="text-sm text-slate-400 mt-1">AI-Powered Smart Blood Inventory Management</p>
          <div className="mt-2">
            <Badge variant="blood" size="sm">Clinical Workspace Sign In</Badge>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {toast && (
          <div className="mb-6">
            <Toast
              type={toast.type}
              title={toast.title}
              message={toast.message}
              onClose={() => setToast(null)}
            />
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-800">
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <Input
              label="Staff / Administrator Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors(prev => ({ ...prev, email: null }));
              }}
              placeholder="e.g. admin@bloodai.local"
              error={errors.email}
              required
              disabled={loading}
            />

            <Input
              label="Secure Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors(prev => ({ ...prev, password: null }));
              }}
              placeholder="••••••••"
              error={errors.password}
              required
              disabled={loading}
              rightAction={
                <button
                  type="button"
                  tabIndex="-1"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Quick Demo Credentials Helpers */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-2">
                <ShieldCheck className="w-4 h-4 text-blood-700" />
                <span>Development Seed Accounts:</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@bloodai.local', 'Admin@1234')}
                  className="text-left flex items-center justify-between p-1.5 rounded hover:bg-slate-200/70 transition-colors text-[11px] font-mono text-slate-700 border border-slate-200"
                >
                  <span>admin@bloodai.local (ADMIN)</span>
                  <span className="text-[10px] text-blood-700 font-sans font-medium">Use Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('staff@bloodai.local', 'Staff@1234')}
                  className="text-left flex items-center justify-between p-1.5 rounded hover:bg-slate-200/70 transition-colors text-[11px] font-mono text-slate-700 border border-slate-200"
                >
                  <span>staff@bloodai.local (STAFF)</span>
                  <span className="text-[10px] text-slate-600 font-sans font-medium">Use Staff</span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Create Account Link */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-blood-700 hover:text-blood-800 hover:underline transition-colors"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>

        {/* Security / Compliance Notice */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Authorized personnel only. Transfusion service audit trails are actively recorded.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
