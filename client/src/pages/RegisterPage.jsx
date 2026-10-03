import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Toast from '../components/common/Toast';
import { HeartPulse, Eye, EyeOff, UserPlus, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    facility: '',
    role: 'STAFF',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const roleOptions = [
    { value: 'STAFF', label: 'STAFF — Inventory & Transfusion Specialist' },
    { value: 'ADMIN', label: 'ADMIN — Blood Bank Administrator / Medical Officer' }
  ];

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must include at least one uppercase letter (A-Z)';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must include at least one number (0-9)';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!['ADMIN', 'STAFF'].includes(formData.role)) {
      newErrors.role = 'Role must be either ADMIN or STAFF';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        facility: formData.facility.trim() || 'General Blood Bank',
        role: formData.role,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });

      setToast({
        type: 'success',
        title: 'Registration Successful',
        message: 'Account created successfully! Redirecting you to sign in...'
      });

      // Redirect to login page after short delay, passing registered email
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            registeredEmail: formData.email.trim().toLowerCase(),
            justRegistered: true
          }
        });
      }, 1500);
    } catch (err) {
      const message = err.message || (err.code === 'EMAIL_ALREADY_EXISTS'
        ? 'An account with this email already exists.'
        : 'Failed to create account. Please check your information and try again.');

      setToast({
        type: 'error',
        title: 'Registration Failed',
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
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-900 py-12 px-4 font-sans">
      <div className="w-full max-w-xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blood-600 to-blood-800 text-white shadow-xl shadow-blood-950/60 mb-4">
            <HeartPulse className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BLOOD AI</h1>
          <p className="text-sm text-slate-400 mt-1">AI-Powered Smart Blood Inventory Management</p>
          <div className="mt-2">
            <Badge variant="blood" size="sm">Personnel Registration</Badge>
          </div>
        </div>

        {/* Toast Alert */}
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

        {/* Registration Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-800">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-800">Create Clinical Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your clinical credentials to register for inventory access.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="e.g. Dr. Jane Doe"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                error={errors.fullName}
                required
                disabled={submitting}
              />

              <Input
                label="Work Email Address"
                type="email"
                placeholder="e.g. jdoe@hospital.org"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={errors.email}
                required
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Facility / Department"
                placeholder="e.g. Central Transfusion Center"
                value={formData.facility}
                onChange={(e) => handleChange('facility', e.target.value)}
                helperText="Optional (defaults to General Blood Bank)"
                disabled={submitting}
              />

              <Select
                label="Assigned System Role"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                options={roleOptions}
                error={errors.role}
                required
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                error={errors.password}
                required
                disabled={submitting}
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

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                required
                disabled={submitting}
                rightAction={
                  <button
                    type="button"
                    tabIndex="-1"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            {/* Password requirements reminder */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-700 block">Security Requirements:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                <li>Minimum 8 characters in length</li>
                <li>At least one uppercase character (A-Z)</li>
                <li>At least one numeric digit (0-9)</li>
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-4"
              disabled={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registering Account...</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </span>
              )}
            </Button>
          </form>

          {/* Switch to Login link */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-blood-700 hover:text-blood-800 hover:underline transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Security / Compliance Notice */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Authorized hospital and transfusion center personnel only. System activity is logged.
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
