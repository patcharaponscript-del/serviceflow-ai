import React, { useMemo, useState } from 'react';
import {
  AirVent,
  ArrowLeft,
  ChevronRight,
  Edit3,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { ACUnit, Customer, Job } from '../types/serviceflow';
import { displayOrUnspecified, formatThaiDate, UNSPECIFIED_TEXT } from '../utils/constants';
import { normalizePhone } from '../utils/customerMatcher';
import { generateId } from '../utils/storage';
import { StatusText } from './StatusText';

interface CustomersViewProps {
  customers: Customer[];
  jobs: Job[];
  selectedCustomerId: string | null;
  onSelectCustomerId: (id: string | null) => void;
  onSaveCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDeleteCustomerRequest: (customer: Customer) => void;
  onSelectJob: (job: Job) => void;
  onCreateJobForCustomer: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  jobs,
  selectedCustomerId,
  onSelectCustomerId,
  onSaveCustomer,
  onDeleteCustomerRequest,
  onSelectJob,
  onCreateJobForCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Customer Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [acUnits, setAcUnits] = useState<ACUnit[]>([]);

  // Inline new AC unit state inside customer form
  const [newAcBrand, setNewAcBrand] = useState('');
  const [newAcBtu, setNewAcBtu] = useState('');
  const [newAcLocation, setNewAcLocation] = useState('');

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setArea('');
    setAddress('');
    setNotes('');
    setAcUnits([]);
    setNewAcBrand('');
    setNewAcBtu('');
    setNewAcLocation('');
    setShowFormModal(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setArea(cust.area);
    setAddress(cust.address);
    setNotes(cust.notes || '');
    setAcUnits(cust.acUnits);
    setNewAcBrand('');
    setNewAcBtu('');
    setNewAcLocation('');
    setShowFormModal(true);
  };

  const handleAddAcUnit = () => {
    if (!newAcBrand.trim() && !newAcBtu.trim() && !newAcLocation.trim()) return;
    setAcUnits((prev) => [
      ...prev,
      {
        id: generateId('ac'),
        brand: newAcBrand.trim() || UNSPECIFIED_TEXT,
        btu: newAcBtu.trim() || UNSPECIFIED_TEXT,
        locationInHome: newAcLocation.trim() || 'ทั่วไป',
      },
    ]);
    setNewAcBrand('');
    setNewAcBtu('');
    setNewAcLocation('');
  };

  const handleRemoveAcUnit = (id: string) => {
    setAcUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !phone.trim()) return;
    onSaveCustomer({
      id: editingCustomer?.id,
      name: name.trim() || UNSPECIFIED_TEXT,
      phone: phone.trim(),
      area: area.trim(),
      address: address.trim(),
      notes: notes.trim(),
      acUnits,
      lineDisplayName: editingCustomer?.lineDisplayName,
      isSample: editingCustomer?.isSample,
    });
    setEditingCustomer(null);
    setShowFormModal(false);
  };

  const duplicatePhoneCustomer = useMemo(() => {
    const target = normalizePhone(phone);
    if (target.length < 9) return null;
    return (
      customers.find(
        (c) => c.id !== editingCustomer?.id && normalizePhone(c.phone) === target
      ) || null
    );
  }, [customers, editingCustomer?.id, phone]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery]);

  const selectedCustomer = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId) || null
    : null;

  const getCustomerJobs = (custId: string) =>
    jobs
      .filter((j) => j.customerId === custId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Detail View when a customer is selected
  if (selectedCustomer) {
    const linkedJobs = getCustomerJobs(selectedCustomer.id);

    // Also combine AC units explicitly saved on customer + unique units mentioned in linked jobs
    const jobDerivedUnits = linkedJobs
      .filter((j) => j.brand || j.btu)
      .map((j) => ({
        brand: j.brand || UNSPECIFIED_TEXT,
        btu: j.btu || UNSPECIFIED_TEXT,
        jobCode: j.jobCode,
        jobType: j.jobType,
        date: j.preferredDate || j.createdAt.slice(0, 10),
      }));

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => onSelectCustomerId(null)}
              className="min-h-[40px] -ml-2 px-2 text-xs font-medium text-slate-600 hover:text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับหน้ารายชื่อลูกค้า</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">
              {selectedCustomer.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openEditModal(selectedCustomer)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>แก้ไขข้อมูล</span>
            </button>
            <button
              type="button"
              onClick={() => onCreateJobForCustomer(selectedCustomer.id)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างใบงานให้ลูกค้านี้</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#0F2544]">ข้อมูลติดต่อและที่อยู่</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">เบอร์โทรศัพท์</dt>
                <dd className="mt-0.5">
                  {selectedCustomer.phone ? (
                    <a
                      href={`tel:${selectedCustomer.phone.replace(/[^0-9+]/g, '')}`}
                      className="font-mono-num font-semibold text-teal-700 hover:underline inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedCustomer.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500 text-xs">{UNSPECIFIED_TEXT}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">พื้นที่ / ย่าน</dt>
                <dd className="mt-0.5 font-medium text-[#0F2544]">
                  {displayOrUnspecified(selectedCustomer.area)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>ที่อยู่</span>
                </dt>
                <dd className="mt-0.5 font-medium text-[#0F2544] leading-relaxed">
                  {displayOrUnspecified(selectedCustomer.address)}
                </dd>
              </div>
              {selectedCustomer.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <dt className="text-xs text-slate-500">หมายเหตุ</dt>
                  <dd className="mt-0.5 text-xs sm:text-sm text-slate-700">
                    {selectedCustomer.notes}
                  </dd>
                </div>
              )}
            </dl>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onDeleteCustomerRequest(selectedCustomer)}
                className="min-h-[40px] text-xs font-medium text-rose-700 hover:text-rose-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายชื่อลูกค้านี้</span>
              </button>
            </div>
          </div>

          {/* AC Units + Service History */}
          <div className="lg:col-span-2 space-y-5">
            {/* AC Equipment History */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <AirVent className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-semibold text-[#0F2544]">
                    ประวัติเครื่องปรับอากาศ ({selectedCustomer.acUnits.length} เครื่องที่บันทึกไว้)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedCustomer)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  + เพิ่มเครื่องแอร์
                </button>
              </div>

              {selectedCustomer.acUnits.length === 0 && jobDerivedUnits.length === 0 ? (
                <p className="text-xs text-slate-500">
                  ยังไม่มีบันทึกเครื่องปรับอากาศของลูกค้ารายนี้
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedCustomer.acUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#0F2544]">
                          {unit.brand} · <span className="font-mono-num">{unit.btu}</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          ตำแหน่ง: {unit.locationInHome}
                          {unit.notes ? ` · ${unit.notes}` : ''}
                        </p>
                      </div>
                      {unit.lastServicedAt && (
                        <span className="text-xs font-mono-num text-slate-500 shrink-0">
                          ล่าสุด {formatThaiDate(unit.lastServicedAt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Linked Service History */}
            <section className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-semibold text-[#0F2544]">
                    ประวัติการใช้บริการ ({linkedJobs.length} ใบงาน)
                  </h2>
                </div>
              </div>

              {linkedJobs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  ยังไม่มีใบงานที่เชื่อมโยงกับลูกค้ารายนี้
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {linkedJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => onSelectJob(job)}
                      className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0F2544]">
                            {job.jobType}
                          </span>
                          <span className="text-xs font-mono-num text-slate-400">
                            {job.jobCode}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {[job.brand, job.btu, job.symptom].filter(Boolean).join(' · ') ||
                            'ไม่มีรายละเอียดอาการ'}
                        </p>
                        <p className="mt-0.5 text-xs font-mono-num text-slate-500">
                          {job.preferredDate
                            ? formatThaiDate(job.preferredDate)
                            : 'ยังไม่ระบุวันนัด'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusText status={job.status} compact />
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {showFormModal && renderFormModal()}
      </div>
    );
  }

  function renderFormModal() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F2544]/50 backdrop-blur-xs p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full sm:max-w-lg max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F2544]">
              {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </h3>
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            id="customer-form"
            onSubmit={handleSubmitCustomer}
            className="flex-1 overflow-y-auto p-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อลูกค้า *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คุณสมชาย"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-[#0F2544]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="080-000-0000"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono-num text-[#0F2544]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  พื้นที่ / ย่าน
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="เช่น บางนา"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-[#0F2544]"
                />
              </div>
            </div>

            {duplicatePhoneCustomer && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
                หมายเหตุ: เบอร์โทรนี้มีอยู่ในรายชื่อลูกค้า &ldquo;{duplicatePhoneCustomer.name}&rdquo; แล้ว หากเป็นคนละคนสามารถบันทึกแยกได้ หรือกดยกเลิกเพื่อเชื่อมใบงานกับรายชื่อเดิม
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ที่อยู่ละเอียด
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ซอย หมู่บ้าน คอนโด"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-[#0F2544]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุลูกค้า
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น สะดวกช่วงบ่าย / จอดรถหน้าบ้านได้"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-[#0F2544]"
              />
            </div>

            {/* AC Units List inside Form */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <p className="text-xs font-semibold text-[#0F2544]">
                เครื่องปรับอากาศของลูกค้า ({acUnits.length})
              </p>

              {acUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <span>
                    <strong>{unit.brand}</strong> · {unit.btu} · {unit.locationInHome}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAcUnit(unit.id)}
                    className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                    aria-label="ลบเครื่องแอร์"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newAcBrand}
                  onChange={(e) => setNewAcBrand(e.target.value)}
                  placeholder="ยี่ห้อ (Daikin)"
                  className="min-h-[40px] rounded-xl border border-slate-300 px-2.5 text-xs"
                />
                <input
                  type="text"
                  value={newAcBtu}
                  onChange={(e) => setNewAcBtu(e.target.value)}
                  placeholder="BTU (12,000)"
                  className="min-h-[40px] rounded-xl border border-slate-300 px-2.5 text-xs"
                />
                <input
                  type="text"
                  value={newAcLocation}
                  onChange={(e) => setNewAcLocation(e.target.value)}
                  placeholder="ห้อง (ห้องนอน)"
                  className="min-h-[40px] rounded-xl border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleAddAcUnit}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-teal-600 text-teal-700 text-xs font-semibold hover:bg-teal-50 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มเครื่องปรับอากาศ</span>
              </button>
            </div>
          </form>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-2.5 pb-safe">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="customer-form"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกลูกค้า</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">รายชื่อลูกค้า</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            เก็บประวัติลูกค้า เครื่องแอร์ และเชื่อมโยงใบงานย้อนหลังทั้งหมด
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0F2544] hover:bg-[#163663] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มลูกค้าใหม่</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า เบอร์โทร พื้นที่ หรือที่อยู่..."
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="ล้างคำค้นหา"
              className="min-h-[40px] min-w-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#0F2544]">ยังไม่มีข้อมูลลูกค้าที่ค้นหา</p>
            <p className="mt-1 text-xs text-slate-500">
              เพิ่มลูกค้าใหม่ หรือบันทึกใบงานจาก LINE แล้วระบบจะสร้างรายชื่อให้อัตโนมัติ
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 cursor-pointer"
            >
              เพิ่มลูกค้าคนแรก
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((cust) => {
              const jobCount = getCustomerJobs(cust.id).length;
              return (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => onSelectCustomerId(cust.id)}
                  className="w-full text-left p-4 sm:px-5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0F2544] truncate">
                        {cust.name}
                      </span>
                      {cust.phone && (
                        <span className="text-xs font-mono-num text-teal-700">
                          {cust.phone}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 truncate">
                      {cust.area || UNSPECIFIED_TEXT}
                      {cust.address ? ` · ${cust.address}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 font-mono-num">
                      แอร์ {cust.acUnits.length} เครื่อง · ประวัติ {jobCount} ใบงาน
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showFormModal && renderFormModal()}
    </div>
  );
};
