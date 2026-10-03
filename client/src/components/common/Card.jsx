import React from 'react';

/**
 * Reusable Card Component
 */
export const Card = ({
  children,
  className = '',
  title = null,
  subtitle = null,
  action = null,
  headerBorder = true,
  hover = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-medical ${hover ? 'hover:shadow-medical-md hover:border-slate-300 transition-all' : ''} ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className={`px-5 py-4 flex items-center justify-between ${headerBorder ? 'border-b border-slate-100' : ''}`}>
          <div>
            {title && <h3 className="font-semibold text-slate-800 text-base">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};

export default Card;
