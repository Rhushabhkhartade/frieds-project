import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import api from '../services/api';
import {
  Layers, Plus, Filter, Search, Edit3, Trash2, Eye,
  RefreshCw, ChevronLeft, ChevronRight, Droplets,
  Calendar, MapPin, Clock, X, Download, AlertTriangle
} from 'lucide-react';

// Constants matching server config
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENT_TYPES = [
  { value: 'WHOLE_BLOOD', label: 'Whole Blood' },
  { value: 'PRBC', label: 'PRBC (Packed RBC)' },
  { value: 'PLATELETS', label: 'Platelets' },
  { value: 'PLASMA', label: 'Plasma (FFP)' }
];
const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'USED', label: 'Used / Dispatched' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DISCARDED', label: 'Discarded' }
];

const STATUS_BADGE_MAP = {
  AVAILABLE: 'optimal',
  RESERVED: 'warning',
  USED: 'neutral',
  EXPIRED: 'critical',
  DISCARDED: 'neutral',
  DISPATCHED: 'neutral'
};

const COMPONENT_LABELS = {
  WHOLE_BLOOD: 'Whole Blood',
  PRBC: 'PRBC',
  PLATELETS: 'Platelets',
  PLASMA: 'Plasma'
};

// Helper: days until expiry
const daysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
};

// Helper: format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

// Helper: storage location display
const formatStorage = (loc) => {
  if (!loc) return '—';
  if (typeof loc === 'string') return loc;
  const parts = [];
  if (loc.refrigerator) parts.push(loc.refrigerator);
  if (loc.shelf) parts.push(loc.shelf);
  return parts.join(' / ') || '—';
};

// Default form state for new unit
const EMPTY_FORM = {
  unitCode: '',
  bloodGroup: '',
  component: '',
  volume: 350,
  collectionDate: '',
  expiryDate: '',
  status: 'AVAILABLE',
  storageLocation: { refrigerator: '', shelf: '' },
  donorReference: '',
  notes: ''
};

export const InventoryPage = () => {
  // ── Inventory list state ──
  const [units, setUnits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Summary state ──
  const [summary, setSummary] = useState(null);

  // ── Filter / Search state ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState('');
  const [filterComponent, setFilterComponent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal states ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);

  // ── Form state ──
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState(null);

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Data fetching ──
  const fetchUnits = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (filterBloodGroup) params.bloodGroup = filterBloodGroup;
      if (filterComponent) params.component = filterComponent;
      if (filterStatus) params.status = filterStatus;

      const res = await api.inventory.list(params);
      setUnits(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterBloodGroup, filterComponent, filterStatus]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.inventory.summary();
      setSummary(res.data || null);
    } catch {
      // Silently fail summary fetch
    }
  }, []);

  useEffect(() => {
    fetchUnits(1);
    fetchSummary();
  }, [fetchUnits, fetchSummary]);

  // ── Search debounce ──
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Form handlers ──
  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const updateStorageField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      storageLocation: { ...prev.storageLocation, [field]: value }
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.unitCode?.trim()) errors.unitCode = 'Unit code / barcode is required';
    if (!formData.bloodGroup) errors.bloodGroup = 'Blood group is required';
    if (!formData.component) errors.component = 'Component type is required';
    if (!formData.volume || formData.volume <= 0) errors.volume = 'Volume must be positive';
    if (!formData.collectionDate) errors.collectionDate = 'Collection date is required';
    if (!formData.expiryDate) errors.expiryDate = 'Expiry date is required';
    if (formData.collectionDate && formData.expiryDate) {
      if (new Date(formData.expiryDate) <= new Date(formData.collectionDate)) {
        errors.expiryDate = 'Expiry date must be after collection date';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── CRUD operations ──
  const handleAddUnit = async () => {
    if (!validateForm()) return;
    setFormLoading(true);
    try {
      const payload = {
        unitCode: formData.unitCode.trim(),
        bloodGroup: formData.bloodGroup,
        component: formData.component,
        volume: Number(formData.volume),
        collectionDate: formData.collectionDate,
        expiryDate: formData.expiryDate,
        status: formData.status || 'AVAILABLE',
        storageLocation: {
          refrigerator: formData.storageLocation?.refrigerator || 'FRIDGE-01',
          shelf: formData.storageLocation?.shelf || 'RACK-A1'
        },
        donorReference: formData.donorReference || undefined,
        notes: formData.notes || undefined
      };
      await api.inventory.create(payload);
      showToast('success', 'Unit Added', `Blood unit ${payload.unitCode} registered successfully.`);
      setShowAddModal(false);
      setFormData({ ...EMPTY_FORM });
      setFormErrors({});
      fetchUnits(1);
      fetchSummary();
    } catch (err) {
      const msg = err.message || 'Failed to create blood unit';
      if (err.code === 'DUPLICATE_UNIT_CODE') {
        setFormErrors(prev => ({ ...prev, unitCode: msg }));
      } else {
        showToast('error', 'Intake Failed', msg);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUnit = async () => {
    if (!validateForm()) return;
    setFormLoading(true);
    try {
      const payload = {
        unitCode: formData.unitCode.trim(),
        bloodGroup: formData.bloodGroup,
        component: formData.component,
        volume: Number(formData.volume),
        collectionDate: formData.collectionDate,
        expiryDate: formData.expiryDate,
        status: formData.status,
        storageLocation: {
          refrigerator: formData.storageLocation?.refrigerator || 'FRIDGE-01',
          shelf: formData.storageLocation?.shelf || 'RACK-A1'
        },
        donorReference: formData.donorReference || undefined,
        notes: formData.notes || undefined
      };
      await api.inventory.update(selectedUnit.id, payload);
      showToast('success', 'Unit Updated', `Blood unit ${payload.unitCode} updated successfully.`);
      setShowEditModal(false);
      setSelectedUnit(null);
      setFormData({ ...EMPTY_FORM });
      setFormErrors({});
      fetchUnits(pagination.page);
      fetchSummary();
    } catch (err) {
      const msg = err.message || 'Failed to update blood unit';
      if (err.code === 'DUPLICATE_UNIT_CODE') {
        setFormErrors(prev => ({ ...prev, unitCode: msg }));
      } else {
        showToast('error', 'Update Failed', msg);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!selectedUnit) return;
    setFormLoading(true);
    try {
      await api.inventory.remove(selectedUnit.id);
      showToast('success', 'Unit Removed', `Blood unit ${selectedUnit.unitCode} discarded from inventory.`);
      setShowDeleteConfirm(false);
      setSelectedUnit(null);
      fetchUnits(pagination.page);
      fetchSummary();
    } catch (err) {
      showToast('error', 'Deletion Failed', err.message || 'Could not remove blood unit');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Modal triggers ──
  const openAddModal = () => {
    setFormData({ ...EMPTY_FORM });
    setFormErrors({});
    setShowAddModal(true);
  };

  const openEditModal = (unit) => {
    setSelectedUnit(unit);
    setFormData({
      unitCode: unit.unitCode || '',
      bloodGroup: unit.bloodGroup || '',
      component: unit.component || '',
      volume: unit.volume || 350,
      collectionDate: unit.collectionDate || '',
      expiryDate: unit.expiryDate || '',
      status: unit.status || 'AVAILABLE',
      storageLocation: typeof unit.storageLocation === 'object'
        ? { refrigerator: unit.storageLocation?.refrigerator || '', shelf: unit.storageLocation?.shelf || '' }
        : { refrigerator: '', shelf: '' },
      donorReference: unit.donorReference || unit.donor || '',
      notes: unit.notes || ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openViewModal = (unit) => {
    setSelectedUnit(unit);
    setShowViewModal(true);
  };

  const openDeleteConfirm = (unit) => {
    setSelectedUnit(unit);
    setShowDeleteConfirm(true);
  };

  const clearFilters = () => {
    setFilterBloodGroup('');
    setFilterComponent('');
    setFilterStatus('');
    setSearchInput('');
  };

  const activeFilterCount = [filterBloodGroup, filterComponent, filterStatus].filter(Boolean).length;

  // ── Render helpers ──
  const renderExpiryBadge = (unit) => {
    if (unit.status === 'USED' || unit.status === 'DISCARDED' || unit.status === 'EXPIRED') {
      return <Badge variant={STATUS_BADGE_MAP[unit.status]} size="sm">{unit.status}</Badge>;
    }
    const days = daysUntilExpiry(unit.expiryDate);
    if (days === null) return <Badge variant="neutral" size="sm">No Date</Badge>;
    if (days < 0) return <Badge variant="critical" size="sm" dot>Expired</Badge>;
    if (days <= 3) return <Badge variant="critical" size="sm" dot>{days}d left</Badge>;
    if (days <= 7) return <Badge variant="warning" size="sm" dot>{days}d left</Badge>;
    return <Badge variant="optimal" size="sm">{days}d left</Badge>;
  };

  // ── Form markup (shared between Add & Edit) ──
  const renderUnitForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Unit Code / Barcode"
          id="unit-code"
          value={formData.unitCode}
          onChange={(e) => updateFormField('unitCode', e.target.value)}
          placeholder="e.g. BLD-2026-1014"
          error={formErrors.unitCode}
          required
        />
        <Select
          label="Blood Group"
          id="blood-group"
          options={BLOOD_GROUPS.map(bg => ({ value: bg, label: bg }))}
          value={formData.bloodGroup}
          onChange={(e) => updateFormField('bloodGroup', e.target.value)}
          error={formErrors.bloodGroup}
          required
          placeholder="Select blood group"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Component Type"
          id="component-type"
          options={COMPONENT_TYPES}
          value={formData.component}
          onChange={(e) => updateFormField('component', e.target.value)}
          error={formErrors.component}
          required
          placeholder="Select component"
        />
        <Input
          label="Volume (mL)"
          id="volume"
          type="number"
          value={formData.volume}
          onChange={(e) => updateFormField('volume', e.target.value)}
          placeholder="350"
          error={formErrors.volume}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Collection Date"
          id="collection-date"
          type="date"
          value={formData.collectionDate}
          onChange={(e) => updateFormField('collectionDate', e.target.value)}
          error={formErrors.collectionDate}
          required
        />
        <Input
          label="Expiry Date"
          id="expiry-date"
          type="date"
          value={formData.expiryDate}
          onChange={(e) => updateFormField('expiryDate', e.target.value)}
          error={formErrors.expiryDate}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Storage — Refrigerator"
          id="storage-fridge"
          value={formData.storageLocation?.refrigerator || ''}
          onChange={(e) => updateStorageField('refrigerator', e.target.value)}
          placeholder="e.g. FRIDGE-01"
        />
        <Input
          label="Storage — Shelf / Rack"
          id="storage-shelf"
          value={formData.storageLocation?.shelf || ''}
          onChange={(e) => updateStorageField('shelf', e.target.value)}
          placeholder="e.g. RACK-A1"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Donor Reference"
          id="donor-ref"
          value={formData.donorReference}
          onChange={(e) => updateFormField('donorReference', e.target.value)}
          placeholder="e.g. DNR-8900"
        />
        <Select
          label="Status"
          id="unit-status"
          options={STATUS_OPTIONS}
          value={formData.status}
          onChange={(e) => updateFormField('status', e.target.value)}
          placeholder="Select status"
        />
      </div>

      <Input
        label="Notes"
        id="unit-notes"
        value={formData.notes}
        onChange={(e) => updateFormField('notes', e.target.value)}
        placeholder="Any clinical or operational notes..."
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] w-96 animate-slide-in">
          <Toast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {/* ═══ Page Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Blood Inventory Management</h1>
            {summary && (
              <Badge variant="blood">{summary.totalUnits} Units Tracked</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">Real-time unit tracking, shelf-life monitoring, and FIFO dispatch system.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchUnits(pagination.page); fetchSummary(); }} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="primary" size="sm" onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            <span>Intake Blood Unit</span>
          </Button>
        </div>
      </div>

      {/* ═══ Summary KPI Strip ═══ */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            <div className="text-xl font-black text-slate-800">{summary.totalUnits}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Available</span>
            <div className="text-xl font-black text-emerald-700">{summary.availableUnits}</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Reserved</span>
            <div className="text-xl font-black text-amber-700">{summary.reservedUnits}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Used</span>
            <div className="text-xl font-black text-slate-600">{summary.usedUnits}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Expired</span>
            <div className="text-xl font-black text-red-700">{summary.expiredUnits}</div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 shadow-medical-sm text-center">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Expiring Soon</span>
            <div className="text-xl font-black text-indigo-700">{summary.expiringSoonUnitsCount}</div>
          </div>
        </div>
      )}

      {/* ═══ Blood Group Quick Overview ═══ */}
      {summary?.countsByBloodGroup && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {BLOOD_GROUPS.map((bg) => {
            const data = summary.countsByBloodGroup[bg] || { total: 0, available: 0 };
            const isCritical = summary.criticalStockGroups?.some(g => g.bloodGroup === bg);
            const isLow = summary.lowStockGroups?.some(g => g.bloodGroup === bg);
            return (
              <div
                key={bg}
                onClick={() => { setFilterBloodGroup(bg); setShowFilters(true); }}
                className={`p-3 bg-white rounded-lg border text-center cursor-pointer transition-all shadow-medical-sm hover:shadow-medical-md ${
                  isCritical ? 'border-red-300 bg-red-50/50' : isLow ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 hover:border-blood-300'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase">Group</span>
                <div className="text-lg font-black text-blood-700">{bg}</div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{data.available}</span> avail
                </div>
                <div className="mt-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    isCritical ? 'bg-red-500 animate-pulse' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Search & Filter Bar ═══ */}
      <Card headerBorder={false}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by unit code, blood group, donor, notes..."
              className="medical-input pl-10"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blood-600 text-white rounded-full">{activeFilterCount}</span>
            )}
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Blood Group"
                id="filter-blood-group"
                options={[{ value: '', label: 'All Blood Groups' }, ...BLOOD_GROUPS.map(bg => ({ value: bg, label: bg }))]}
                value={filterBloodGroup}
                onChange={(e) => setFilterBloodGroup(e.target.value)}
                placeholder=""
              />
              <Select
                label="Component"
                id="filter-component"
                options={[{ value: '', label: 'All Components' }, ...COMPONENT_TYPES]}
                value={filterComponent}
                onChange={(e) => setFilterComponent(e.target.value)}
                placeholder=""
              />
              <Select
                label="Status"
                id="filter-status"
                options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                placeholder=""
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ═══ Inventory Table ═══ */}
      <Card
        title="Unit-Level Inventory Registry"
        subtitle={`${pagination.total} blood unit${pagination.total !== 1 ? 's' : ''} total · Page ${pagination.page} of ${pagination.totalPages}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-blood-600 animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Loading inventory...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchUnits(1)} className="mt-3">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        ) : units.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-4">
              <Droplets className="w-7 h-7 text-blood-400" />
            </div>
            <h3 className="font-semibold text-slate-700 text-base">No Blood Units Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchTerm || activeFilterCount > 0
                ? 'No units match your current search or filter criteria. Try adjusting your filters.'
                : 'The inventory is empty. Click "Intake Blood Unit" to register the first donation.'}
            </p>
            {(searchTerm || activeFilterCount > 0) && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                <X className="w-3.5 h-3.5" /> Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Unit Code</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Blood Group</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Component</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Volume</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Collection</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Shelf Life</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Storage</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Status</th>
                    <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="text-sm font-semibold text-slate-800">{unit.unitCode}</div>
                        {unit.donorReference && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{unit.donorReference}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blood-50 text-blood-700 font-black text-sm border border-blood-200">
                          {unit.bloodGroup}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-slate-600">
                          {COMPONENT_LABELS[unit.component] || unit.component}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-slate-700 font-medium">{unit.volume} mL</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-slate-600">{formatDate(unit.collectionDate)}</span>
                      </td>
                      <td className="px-3 py-3">
                        {renderExpiryBadge(unit)}
                        <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(unit.expiryDate)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {formatStorage(unit.storageLocation)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={STATUS_BADGE_MAP[unit.status] || 'neutral'} size="sm" dot>
                          {unit.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openViewModal(unit)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(unit)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Edit Unit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(unit)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Discard Unit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchUnits(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => fetchUnits(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          p === pagination.page
                            ? 'bg-blood-700 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchUnits(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ═══ ADD UNIT MODAL ═══ */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setFormErrors({}); }}
        title="Intake New Blood Unit"
        subtitle="Register a new donation into the inventory"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddUnit} disabled={formLoading}>
              {formLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Register Unit</>}
            </Button>
          </>
        }
      >
        {renderUnitForm()}
      </Modal>

      {/* ═══ EDIT UNIT MODAL ═══ */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUnit(null); setFormErrors({}); }}
        title="Edit Blood Unit"
        subtitle={selectedUnit ? `Updating ${selectedUnit.unitCode}` : ''}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowEditModal(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditUnit} disabled={formLoading}>
              {formLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating...</> : <><Edit3 className="w-4 h-4" /> Save Changes</>}
            </Button>
          </>
        }
      >
        {renderUnitForm()}
      </Modal>

      {/* ═══ VIEW UNIT MODAL ═══ */}
      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setSelectedUnit(null); }}
        title="Blood Unit Details"
        subtitle={selectedUnit?.unitCode || ''}
        maxWidth="max-w-lg"
      >
        {selectedUnit && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-blood-50 rounded-xl border border-blood-200">
              <div className="w-16 h-16 rounded-xl bg-white border-2 border-blood-300 flex items-center justify-center">
                <span className="text-xl font-black text-blood-700">{selectedUnit.bloodGroup}</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">{selectedUnit.unitCode}</h4>
                <p className="text-xs text-slate-500">{COMPONENT_LABELS[selectedUnit.component] || selectedUnit.component} · {selectedUnit.volume} mL</p>
                <div className="mt-1">
                  <Badge variant={STATUS_BADGE_MAP[selectedUnit.status] || 'neutral'} size="sm" dot>{selectedUnit.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Collection Date</span>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(selectedUnit.collectionDate)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</span>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(selectedUnit.expiryDate)}
                </p>
                <div className="mt-1">{renderExpiryBadge(selectedUnit)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Storage Location</span>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {formatStorage(selectedUnit.storageLocation)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Donor Reference</span>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {selectedUnit.donorReference || selectedUnit.donor || '—'}
                </p>
              </div>
            </div>

            {selectedUnit.notes && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Clinical Notes</span>
                <p className="text-sm text-slate-700 mt-1">{selectedUnit.notes}</p>
              </div>
            )}

            <div className="text-[10px] text-slate-400 text-right">
              Created: {selectedUnit.createdAt ? new Date(selectedUnit.createdAt).toLocaleString() : '—'} ·
              Updated: {selectedUnit.updatedAt ? new Date(selectedUnit.updatedAt).toLocaleString() : '—'}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => { setShowViewModal(false); openEditModal(selectedUnit); }}>
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => { setShowViewModal(false); openDeleteConfirm(selectedUnit); }}>
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ DELETE CONFIRM DIALOG ═══ */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setSelectedUnit(null); }}
        onConfirm={handleDeleteUnit}
        title="Discard Blood Unit"
        message={`Are you sure you want to discard unit "${selectedUnit?.unitCode}"? This action will remove it from active inventory and create an audit trail entry.`}
        confirmText="Discard Unit"
        loading={formLoading}
      />
    </div>
  );
};

export default InventoryPage;
