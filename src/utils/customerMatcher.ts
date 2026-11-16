import { Customer, Job } from '../types/serviceflow';

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type CustomerMatchType =
  | 'phone_exact'
  | 'phone_ambiguous'
  | 'name_only_unconfirmed'
  | 'name_different_phone'
  | 'none';

export interface CustomerMatchAnalysis {
  matchType: CustomerMatchType;
  autoSelectedCustomerId: string | null;
  matchedCustomer: Customer | null;
  candidateCustomers: Customer[];
  nameConflictWarning: boolean;
  noticeMessage: string | null;
}

/**
 * Deterministic customer matching rules:
 * 1. NEVER auto-merge or auto-link by name alone.
 * 2. Same name + different phone MUST be treated as distinct customers.
 * 3. Only exact phone match (>= 9 digits, unique) suggests linking to existing customer.
 * 4. Missing phone or name-only matches require explicit technician selection.
 */
export function matchCustomerForJob(
  input: { name?: string | null; phone?: string | null },
  customers: Customer[]
): CustomerMatchAnalysis {
  const cleanTargetPhone = normalizePhone(input.phone);
  const cleanTargetName = normalizeName(input.name);

  const hasValidPhone = cleanTargetPhone.length >= 9;

  if (hasValidPhone) {
    const phoneMatches = customers.filter(
      (c) => normalizePhone(c.phone) === cleanTargetPhone
    );

    if (phoneMatches.length === 1) {
      const matched = phoneMatches[0];
      const matchedNameNorm = normalizeName(matched.name);
      const nameDiffers =
        Boolean(cleanTargetName) &&
        Boolean(matchedNameNorm) &&
        matchedNameNorm !== cleanTargetName &&
        !matchedNameNorm.includes(cleanTargetName) &&
        !cleanTargetName.includes(matchedNameNorm);

      return {
        matchType: 'phone_exact',
        autoSelectedCustomerId: matched.id,
        matchedCustomer: matched,
        candidateCustomers: phoneMatches,
        nameConflictWarning: nameDiffers,
        noticeMessage: nameDiffers
          ? `เบอร์โทรตรงกับลูกค้าเดิม "${matched.name}" แต่ชื่อในข้อความต่างกัน กรุณาตรวจสอบก่อนบันทึก`
          : `พบข้อมูลลูกค้าเดิมที่เบอร์โทรตรงกัน: ${matched.name} (${matched.phone})`,
      };
    }

    if (phoneMatches.length > 1) {
      return {
        matchType: 'phone_ambiguous',
        autoSelectedCustomerId: null,
        matchedCustomer: null,
        candidateCustomers: phoneMatches,
        nameConflictWarning: false,
        noticeMessage: `พบลูกค้าในระบบ ${phoneMatches.length} รายที่ใช้เบอร์โทรเดียวกัน กรุณาเลือกลูกค้าที่ต้องการเชื่อมด้วยตนเอง`,
      };
    }

    // Phone provided, no phone match. Check if same name exists with a DIFFERENT phone.
    if (cleanTargetName) {
      const sameNameCustomers = customers.filter(
        (c) => normalizeName(c.name) === cleanTargetName
      );
      if (sameNameCustomers.length > 0) {
        return {
          matchType: 'name_different_phone',
          autoSelectedCustomerId: null,
          matchedCustomer: null,
          candidateCustomers: sameNameCustomers,
          nameConflictWarning: false,
          noticeMessage: `พบลูกค้าชื่อ "${input.name?.trim()}" ในระบบอยู่แล้ว แต่เบอร์โทรศัพท์ต่างกัน ระบบจึงแยกเป็นลูกค้าคนละรายให้โดยไม่รวมประวัติอัตโนมัติ`,
        };
      }
    }

    return {
      matchType: 'none',
      autoSelectedCustomerId: null,
      matchedCustomer: null,
      candidateCustomers: [],
      nameConflictWarning: false,
      noticeMessage: null,
    };
  }

  // No valid phone provided: NEVER auto-merge by name alone
  if (cleanTargetName) {
    const sameNameCustomers = customers.filter((c) => {
      const cn = normalizeName(c.name);
      return cn === cleanTargetName || cn.includes(cleanTargetName);
    });

    if (sameNameCustomers.length > 0) {
      return {
        matchType: 'name_only_unconfirmed',
        autoSelectedCustomerId: null,
        matchedCustomer: null,
        candidateCustomers: sameNameCustomers,
        nameConflictWarning: false,
        noticeMessage: `พบลูกค้าชื่อคล้ายกัน ${sameNameCustomers.length} รายในระบบ แต่ยังไม่มีเบอร์โทรยืนยัน — ระบบจะไม่รวมประวัติอัตโนมัติ กรุณาตรวจสอบและเลือกเอง`,
      };
    }
  }

  return {
    matchType: 'none',
    autoSelectedCustomerId: null,
    matchedCustomer: null,
    candidateCustomers: [],
    nameConflictWarning: false,
    noticeMessage: null,
  };
}

/**
 * Always resolves the latest customer information from the master customers list via customerId.
 */
export function resolveJobCustomer(
  job: Job,
  customers: Customer[]
): {
  customer: Customer | null;
  customerName: string;
  phone: string;
  area: string;
  address: string;
} {
  const linked = job.customerId
    ? customers.find((c) => c.id === job.customerId) || null
    : null;

  if (!linked) {
    return {
      customer: null,
      customerName: job.customerName,
      phone: job.phone,
      area: job.area,
      address: job.address,
    };
  }

  return {
    customer: linked,
    customerName: linked.name || job.customerName,
    phone: linked.phone || job.phone,
    area: job.area || linked.area,
    address: job.address || linked.address,
  };
}
