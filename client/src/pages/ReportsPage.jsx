import React from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { BarChart3, Download, Printer, FileText } from 'lucide-react';

export const ReportsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Clinical Analytics</h1>
            <Badge variant="neutral">Regulatory Compliance Ready</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">Audit logs, inventory turnover rates, wastage summaries, and CSV data export.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </Button>
          <Button variant="primary" size="sm">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Reports Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blood-50 text-blood-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Inventory Turnover Audit</h3>
              <p className="text-xs text-slate-500">Intake, testing, and dispatch log</p>
            </div>
          </div>
        </Card>

        <Card className="hover:border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Wastage & Expiry Analysis</h3>
              <p className="text-xs text-slate-500">Shelf-life expiration metrics</p>
            </div>
          </div>
        </Card>

        <Card className="hover:border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Full Transaction Ledger</h3>
              <p className="text-xs text-slate-500">Immutable clinical audit stream</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Container */}
      <Card title="Analytics & Export Pipeline" subtitle="Compliant with National Blood Transfusion Council guidelines">
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <BarChart3 className="w-6 h-6 text-blood-700" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Reports Scaffolding Ready</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Data aggregation services, CSV streaming generator, and print-ready stylesheets will be activated in Step 8.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ReportsPage;
