import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Reusable Toast Alert Component
 */
export const Toast = ({
  type = 'info',
  title,
  message,
  onClose,
  className = ''
}) => {
  const configs = {
    success: {
      border: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
    },
    warning: {
      border: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
    },
    error: {
      border: 'border-red-200 bg-red-50 text-red-900',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
    },
    info: {
      border: 'border-slate-200 bg-white text-slate-800',
      icon: <Info className="w-5 h-5 text-blood-600 shrink-0" />
    }
  };

  const current = configs[type] || configs.info;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-medical-md ${current.border} ${className}`}>
      {current.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-sm font-semibold">{title}</h4>}
        {message && <p className="text-xs text-slate-600 mt-0.5">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Toast;
