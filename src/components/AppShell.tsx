import React, { useState } from 'react';
import {
  BellRing,
  ClipboardList,
  Database,
  Download,
  LayoutDashboard,
  MessageSquarePlus,
  RotateCcw,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AppTab } from '../types/serviceflow';
import type { QuarantineRecord } from '../utils/storage';
import { BackupSettingsModal } from './BackupSettingsModal';

interface AppShellProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pendingFollowUpCount: number;
  activeJobCount: number;
  aiConfigured: boolean;
  onResetSampleData: () => void;
  onClearAllData: () => void;
  toastMessage: string | null;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  inMemoryQuarantine?: QuarantineRecord[];
  quarantineSaved?: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  pendingFollowUpCount,
  activeJobCount,
  aiConfigured,
  onResetSampleData,
  onClearAllData,
  toastMessage,
  settingsOpen: controlledSettingsOpen,
  onSettingsOpenChange,
  inMemoryQuarantine,
  quarantineSaved,
  children,
}) => {
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const settingsOpen =
    controlledSettingsOpen !== undefined ? controlledSettingsOpen : internalSettingsOpen;
  const setSettingsOpen = (next: boolean) => {
    if (onSettingsOpenChange) {
      onSettingsOpenChange(next);
    } else {
      setInternalSettingsOpen(next);
    }
  };

  const navItems: {
    id: AppTab;
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'dashboard', label: 'ภาพรวม', mobileLabel: 'ภาพรวม', icon: LayoutDashboard },
    { id: 'ai-creator', label: 'AI สร้างใบงาน', mobileLabel: 'AI ใบงาน', icon: MessageSquarePlus },
    { id: 'jobs', label: 'ใบงาน', mobileLabel: 'ใบงาน', icon: ClipboardList, badge: activeJobCount },
    { id: 'customers', label: 'ลูกค้า', mobileLabel: 'ลูกค้า', icon: Users },
    {
      id: 'followups',
      label: 'ติดตามงาน',
      mobileLabel: 'ติดตาม',
      icon: BellRing,
      badge: pendingFollowUpCount,
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-[#F6F8FB] text-[#0F2544] overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0F2544] text-white sticky top-0 h-[100dvh] justify-between">
        <div className="p-5 space-y-6">
          <div className="px-2 pt-1">
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              ServiceFlow AI
            </span>
          </div>

          <nav aria-label="เมนูหลัก" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-xs font-mono-num ${
                        active ? 'text-teal-100' : 'text-teal-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2">
          <p className="px-2 text-xs text-slate-400">
            {aiConfigured ? 'AI: Gemini พร้อมใช้งาน' : 'AI: โหมดสาธิต (Demo)'}
          </p>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold bg-teal-600/20 text-teal-200 border border-teal-500/30 hover:bg-teal-600/30 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>ตั้งค่า &amp; สำรองข้อมูล (JSON)</span>
          </button>
          <button
            type="button"
            onClick={onResetSampleData}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>รีเซ็ตข้อมูลตัวอย่าง</span>
          </button>
          <button
            type="button"
            onClick={onClearAllData}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้างข้อมูลทั้งหมด</span>
          </button>
        </div>
      </aside>

      {/* Mobile Compact Top Header (<= 52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between gap-4 pt-safe">
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="text-base font-bold tracking-tight text-[#0F2544] whitespace-nowrap shrink-0 cursor-pointer"
        >
          ServiceFlow AI
        </button>

        <button
          type="button"
          onClick={() => setDataMenuOpen(true)}
          aria-label="จัดการข้อมูลในเครื่อง"
          className="min-h-[44px] px-3 text-xs font-medium text-slate-600 hover:text-[#0F2544] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>จัดการข้อมูล</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 lg:py-8">{children}</div>
      </main>

      {/* Mobile Fixed Bottom Navigation (60px + safe area) */}
      <nav
        aria-label="แถบนำทางมือถือ"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-[60px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 transition-colors cursor-pointer ${
                  active ? 'text-teal-700' : 'text-slate-500 hover:text-[#0F2544]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {typeof item.badge === 'number' && item.badge > 0 && item.id === 'followups' && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`mt-1 text-[11px] leading-none whitespace-nowrap ${
                    active ? 'font-bold text-teal-800' : 'font-medium'
                  }`}
                >
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Data Management Bottom Sheet */}
      {dataMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F2544]/50 backdrop-blur-xs lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8 pb-safe space-y-4">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F2544]">จัดการข้อมูลใน Browser</h3>
              <button
                type="button"
                onClick={() => setDataMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ข้อมูลใบงานและลูกค้าถูกจัดเก็บไว้ใน Browser (localStorage) รีเฟรชหน้าแล้วข้อมูลไม่หาย ·{' '}
              {aiConfigured ? 'เชื่อมต่อ Gemini AI แล้ว' : 'กำลังใช้โหมดสาธิต (Demo Mode)'}
            </p>
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDataMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full min-h-[48px] px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ตั้งค่า &amp; Export Backup (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataMenuOpen(false);
                  onResetSampleData();
                }}
                className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-[#0F2544] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>รีเซ็ตเป็นข้อมูลตัวอย่าง</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataMenuOpen(false);
                  onClearAllData();
                }}
                className="w-full min-h-[48px] px-4 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ล้างข้อมูลทั้งหมดให้ว่าง</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings: Backup & Data Management Modal */}
      <BackupSettingsModal
        open={settingsOpen}
        aiConfigured={aiConfigured}
        inMemoryQuarantine={inMemoryQuarantine}
        quarantineSaved={quarantineSaved}
        onClose={() => setSettingsOpen(false)}
        onResetSampleData={onResetSampleData}
        onClearAllData={onClearAllData}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F2544] text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-[90vw] text-center"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};
