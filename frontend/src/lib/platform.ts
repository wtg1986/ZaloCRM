// Bảng giá + thông tin chuyển khoản + fetchers quản trị nền tảng (SaaS).
// GIÁ THAM KHẢO theo đối thủ VN (Zework ~90k/tháng/nick) — bạn sửa tự do.
import { apiGet, apiPatch } from "@/lib/api";

export interface PlanCatalogItem {
  key: string;
  name: string;
  priceMonthly: number; // VNĐ/tháng (0 = miễn phí)
  highlight?: boolean;
  features: string[];
}

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    key: "free",
    name: "Miễn phí",
    priceMonthly: 0,
    features: ["1 nick Zalo", "3 nhân viên", "500 khách hàng", "Chat + CRM cơ bản"],
  },
  {
    key: "pro",
    name: "Pro",
    priceMonthly: 299_000,
    highlight: true,
    features: [
      "5 nick Zalo",
      "15 nhân viên",
      "50.000 khách hàng",
      "Gửi hàng loạt, Pipeline, Phân quyền",
    ],
  },
  {
    key: "business",
    name: "Business",
    priceMonthly: 899_000,
    features: [
      "20 nick Zalo",
      "100 nhân viên",
      "Không giới hạn khách",
      "Toàn bộ tính năng + ưu tiên hỗ trợ",
    ],
  },
];

// Thông tin chuyển khoản — SỬA thành tài khoản thật của bạn.
export const BANK_INFO = {
  bank: "Vietcombank",
  account: "0123456789",
  holder: "NGUYEN VAN A",
};

// Tên miền gốc cho workspace của tổ chức (subdomain).
// Org slug "acme" → acme.zalocrm.vn. Đổi thành tên miền thật của bạn khi deploy.
// Routing subdomain thật cần wildcard DNS (*.zalocrm.vn) + reverse proxy + TLS.
export const WORKSPACE_DOMAIN = "zalocrm.vn";

export function formatVnd(n: number): string {
  return n === 0 ? "Miễn phí" : `${n.toLocaleString("vi-VN")}đ/tháng`;
}

// ── Quản trị nền tảng (super-admin) ──────────────────────────────────────────
export const getPlatformMe = () =>
  apiGet<{ isSuperAdmin: boolean }>("/platform/me");

export interface PlatformOrg {
  id: string;
  name: string;
  plan: string;
  planLabel: string;
  createdAt: string;
  owner: { email: string; fullName: string | null } | null;
  usage: { nicks: number; staff: number; contacts: number };
}
export const getPlatformOrgs = () =>
  apiGet<{
    orgs: PlatformOrg[];
    plans: { key: string; label: string; limits: Record<string, number> }[];
  }>("/platform/orgs");

export const setOrgPlan = (orgId: string, plan: string) =>
  apiPatch<{ ok: boolean }>(`/platform/orgs/${orgId}/plan`, { plan });
