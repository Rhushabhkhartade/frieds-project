import React from 'react';

/**
 * Reusable Badge Component
 * Variants: optimal, warning, critical, expiry, neutral, blood
 */
export const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false
}) => {
  const variants = {
    optimal: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    critical: 'bg-red-50 text-red-700 border-red-200/80',
    expiry: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    blood: 'bg-blood-50 text-blood-800 border-blood-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const dotColors = {
    optimal: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    expiry: 'bg-indigo-500',
    blood: 'bg-blood-600',
    neutral: 'bg-slate-400'
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variants[variant] || variants.neutral} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || dotColors.neutral}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
