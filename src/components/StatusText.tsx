import React from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { JobStatus } from '../types/serviceflow';
import { JOB_STATUS_CONFIG } from '../utils/constants';

interface StatusTextProps {
  status: JobStatus;
  compact?: boolean;
}

export const StatusText: React.FC<StatusTextProps> = ({ status, compact = false }) => {
  const cfg = JOB_STATUS_CONFIG[status];

  const renderIcon = () => {
    const cls = 'w-3.5 h-3.5 shrink-0';
    switch (status) {
      case 'new':
        return <Sparkles className={cls} />;
      case 'needs_info':
        return <HelpCircle className={cls} />;
      case 'pending_confirmation':
        return <Clock className={cls} />;
      case 'confirmed':
        return <Wrench className={cls} />;
      case 'completed':
        return <CheckCircle2 className={cls} />;
      case 'cancelled':
        return <XCircle className={cls} />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${cfg.textClass}`}
    >
      {renderIcon()}
      <span>{compact ? cfg.shortLabel : cfg.label}</span>
    </span>
  );
};
