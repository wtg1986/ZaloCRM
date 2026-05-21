/**
 * list-sale-assignment-api.ts — Axios wrappers for CustomerList sale assignment endpoints.
 * Endpoints live under /api/v1/integrations/facebook/customer-lists/:listId/sale-assignments
 * (co-located with Facebook routes since the feature is FB-driven).
 */
import { api } from '@/api/index';

const PREFIX = (listId: string) =>
  `/integrations/facebook/customer-lists/${listId}/sale-assignments`;

// ── DTO types ────────────────────────────────────────────────────────────────

export interface SaleAssignmentDto {
  id: string;
  customerListId: string;
  userId: string;
  weight: number;
  enabled: boolean;
  createdAt: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    role: string;
  };
}

export interface UpsertAssignmentInput {
  userId: string;
  weight?: number;
  enabled?: boolean;
}

export interface OrgUserDto {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  teamId: string | null;
  createdAt: string;
  team: { id: string; name: string } | null;
}

// ── API functions ─────────────────────────────────────────────────────────────

/** List sale assignments for a customer list (with user info). */
export async function listSaleAssignments(listId: string): Promise<SaleAssignmentDto[]> {
  const { data } = await api.get<SaleAssignmentDto[]>(PREFIX(listId));
  return data;
}

/**
 * Upsert assignment pool for a customer list.
 * Assignments not present in the array will be deleted.
 * Returns updated full list.
 */
export async function upsertSaleAssignments(
  listId: string,
  assignments: UpsertAssignmentInput[],
): Promise<SaleAssignmentDto[]> {
  const { data } = await api.put<SaleAssignmentDto[]>(PREFIX(listId), { assignments });
  return data;
}

/** List all users in the org (for sale picker). */
export async function listOrgUsers(): Promise<OrgUserDto[]> {
  const { data } = await api.get<{ users: OrgUserDto[] }>('/users');
  return data.users;
}
