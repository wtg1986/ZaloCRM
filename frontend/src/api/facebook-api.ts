/**
 * facebook-api.ts — Axios wrappers for Facebook integration endpoints.
 * All paths relative to /api/v1 (baseURL set in api/index.ts).
 */
import { api } from '@/api/index';

const FB = '/integrations/facebook';

// ── DTO types ────────────────────────────────────────────────────────────────

export interface FacebookPageConnectionDto {
  id: string;
  pageId: string;
  pageName: string;
  status: 'connected' | 'revoked' | 'error';
  subscribedAt: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  lastLeadAt: string | null;
}

export interface FacebookLeadgenForm {
  id: string;
  name: string;
  status: string;
  created_time: string;
  leads_count?: number;
}

export interface FacebookFormMappingDto {
  id: string;
  orgId: string;
  pageConnectionId: string;
  formId: string;
  formName: string;
  customerListId: string;
  fieldMap: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  pageConnection: {
    pageId: string;
    pageName: string;
    status: string;
  };
  customerList: {
    id: string;
    name: string;
    iconEmoji: string | null;
  };
}

export interface CreateMappingInput {
  pageConnectionId: string;
  formId: string;
  formName: string;
  customerListId: string;
  fieldMap?: Record<string, string>;
}

export interface UpdateMappingInput {
  customerListId?: string;
  fieldMap?: Record<string, string>;
  enabled?: boolean;
}

export interface TokenRefreshSummary {
  checked: number;
  refreshed: number;
  errors: number;
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Redirect browser to OAuth start — returns the URL to navigate to. */
export function getFbOAuthStartUrl(): string {
  return `${window.location.origin}/api/v1${FB}/oauth/start`;
}

/** List connected Facebook pages for current org. */
export async function listPages(): Promise<FacebookPageConnectionDto[]> {
  const { data } = await api.get<FacebookPageConnectionDto[]>(`${FB}/pages`);
  return data;
}

/** Disconnect a page. Returns count of mappings that were disabled. */
export async function disconnectPage(
  pageId: string,
): Promise<{ success: boolean; disabledMappings: number }> {
  const { data } = await api.post<{ success: boolean; disabledMappings: number }>(
    `${FB}/pages/${pageId}/disconnect`,
  );
  return data;
}

/** Fetch live leadgen forms for a connected page (backend caches 60s). */
export async function listPageForms(pageId: string): Promise<FacebookLeadgenForm[]> {
  const { data } = await api.get<FacebookLeadgenForm[]>(`${FB}/pages/${pageId}/forms`);
  return data;
}

/** List all form mappings for current org. */
export async function listMappings(): Promise<FacebookFormMappingDto[]> {
  const { data } = await api.get<FacebookFormMappingDto[]>(`${FB}/mappings`);
  return data;
}

/** Create a new form → CustomerList mapping. */
export async function createMapping(input: CreateMappingInput): Promise<FacebookFormMappingDto> {
  const { data } = await api.post<FacebookFormMappingDto>(`${FB}/mappings`, input);
  return data;
}

/** Update an existing mapping. */
export async function updateMapping(
  id: string,
  patch: UpdateMappingInput,
): Promise<FacebookFormMappingDto> {
  const { data } = await api.put<FacebookFormMappingDto>(`${FB}/mappings/${id}`, patch);
  return data;
}

/** Soft-delete a mapping (sets enabled=false). */
export async function deleteMapping(id: string): Promise<void> {
  await api.delete(`${FB}/mappings/${id}`);
}

/** Manual trigger: refresh tokens for all connected pages in current org. */
export async function adminRefreshTokens(): Promise<TokenRefreshSummary> {
  const { data } = await api.post<TokenRefreshSummary>(`${FB}/admin/refresh-tokens`);
  return data;
}
