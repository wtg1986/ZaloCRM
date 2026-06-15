/**
 * plans.ts — Gói dịch vụ + quota. Không tích hợp thanh toán: nâng gói thủ công
 * (đổi Organization.plan). Giới hạn suy ra từ PLAN_LIMITS theo code.
 */
import { prisma } from '../../shared/database/prisma-client.js';

export interface PlanLimits {
  nicks: number; // số nick Zalo
  staff: number; // số nhân viên (user)
  contacts: number; // số khách hàng
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { nicks: 1, staff: 3, contacts: 500 },
  pro: { nicks: 5, staff: 15, contacts: 50_000 },
  business: { nicks: 20, staff: 100, contacts: 1_000_000 },
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'Miễn phí',
  pro: 'Pro',
  business: 'Business',
};

export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'free'] ?? PLAN_LIMITS.free;
}

export async function getOrgUsage(orgId: string): Promise<PlanLimits> {
  const [nicks, staff, contacts] = await Promise.all([
    prisma.zaloAccount.count({ where: { orgId, archivedAt: null } }),
    prisma.user.count({ where: { orgId, isActive: true } }),
    prisma.contact.count({ where: { orgId, mergedInto: null } }),
  ]);
  return { nicks, staff, contacts };
}

const RESOURCE_LABEL: Record<keyof PlanLimits, string> = {
  nicks: 'nick Zalo',
  staff: 'nhân viên',
  contacts: 'khách hàng',
};

/**
 * Ném lỗi 403 nếu org đã đạt giới hạn gói cho resource. Gọi TRƯỚC khi tạo mới.
 */
export async function assertQuota(
  orgId: string,
  resource: keyof PlanLimits,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const limit = planLimits(org?.plan)[resource];
  const usage = await getOrgUsage(orgId);
  if (usage[resource] >= limit) {
    const err = new Error(
      `Đã đạt giới hạn ${limit} ${RESOURCE_LABEL[resource]} của gói ${PLAN_LABELS[org?.plan ?? 'free'] ?? org?.plan}. Nâng gói để thêm.`,
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 403;
    err.code = 'PLAN_QUOTA_EXCEEDED';
    throw err;
  }
}
