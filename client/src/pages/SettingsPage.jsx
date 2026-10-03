import React from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { Settings, Save, ShieldAlert, Sliders } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Thresholds</h1>
            <Badge variant="neutral">Admin Configuration</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">Configure facility metadata, emergency buffer thresholds per blood group, and advance notice windows.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm">
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>

      {/* Thresholds Table Container */}
      <Card
        title="Blood Group Stock Thresholds"
        subtitle="Trigger limits for automatic Low-Stock and Critical-Deficit alerts"
      >
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Sliders className="w-6 h-6 text-slate-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Threshold Configuration Scaffolding Ready</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Editable threshold matrix for all 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-), shelf-life alert buffer sliders, and sound notification controls will be activated in Step 9.
          </p>
        </div>
      </Card>

      {/* Storage & Environment Diagnostics */}
      <Card title="Storage Engine & Environment Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 uppercase block text-[10px]">Storage Mode</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">Atomic JSON Storage</span>
            <span className="text-slate-400">Zero-Config Safe Persistence</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 uppercase block text-[10px]">Active Port</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">Port 5000</span>
            <span className="text-slate-400">Backend Express Server</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 uppercase block text-[10px]">ML Subsystem</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">XGBoost Dual Engine</span>
            <span className="text-slate-400">Fallback Statistical Ready</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 uppercase block text-[10px]">Blood Groups</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">8 Standard Groups</span>
            <span className="text-slate-400">ABO & Rh Complete</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
