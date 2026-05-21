/**
 * use-facebook-channel.ts — State + actions for the Facebook channel settings page.
 *
 * Owns:
 *  - pages list (FacebookPageConnectionDto[])
 *  - forms per page (keyed by pageId)
 *  - mappings list (FacebookFormMappingDto[])
 *  - loading / error state
 *
 * Actions:
 *  - connectPage  — redirect browser to OAuth start URL
 *  - refreshPages — reload page list from API
 *  - fetchForms   — load live forms for a page (lazy, cached in formsMap)
 *  - saveMapping  — create or update a form mapping
 *  - deleteMapping — soft-delete a mapping
 *  - disconnect   — disconnect a page (returns { disabledMappings })
 */
import { ref, computed } from 'vue';
import {
  listPages,
  listPageForms,
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping as apiDeleteMapping,
  disconnectPage as apiDisconnectPage,
  getFbOAuthStartUrl,
  type FacebookPageConnectionDto,
  type FacebookLeadgenForm,
  type FacebookFormMappingDto,
  type CreateMappingInput,
  type UpdateMappingInput,
} from '@/api/facebook-api';

export function useFacebookChannel() {
  // ── State ────────────────────────────────────────────────────────────────

  const pages = ref<FacebookPageConnectionDto[]>([]);
  const mappings = ref<FacebookFormMappingDto[]>([]);
  const formsMap = ref<Record<string, FacebookLeadgenForm[]>>({});
  const formsLoading = ref<Record<string, boolean>>({});

  const loading = ref(false);
  const error = ref('');

  // ── Derived ──────────────────────────────────────────────────────────────

  /** mappings keyed by pageConnectionId for quick lookup */
  const mappingsByPageConnection = computed<Record<string, FacebookFormMappingDto[]>>(() => {
    const result: Record<string, FacebookFormMappingDto[]> = {};
    for (const m of mappings.value) {
      if (!result[m.pageConnectionId]) result[m.pageConnectionId] = [];
      result[m.pageConnectionId].push(m);
    }
    return result;
  });

  /** mappings keyed by formId */
  const mappingByFormId = computed<Record<string, FacebookFormMappingDto>>(() => {
    const result: Record<string, FacebookFormMappingDto> = {};
    for (const m of mappings.value) {
      result[m.formId] = m;
    }
    return result;
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Redirect to Meta OAuth. Returns to /settings/channels/facebook after auth. */
  function connectPage(): void {
    window.location.href = getFbOAuthStartUrl();
  }

  async function refreshPages(): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      const [pagesData, mappingsData] = await Promise.all([listPages(), listMappings()]);
      pages.value = pagesData;
      mappings.value = mappingsData;
    } catch (err) {
      error.value = (err as Error).message ?? 'Không thể tải danh sách trang Facebook';
    } finally {
      loading.value = false;
    }
  }

  async function fetchForms(pageId: string): Promise<void> {
    if (formsLoading.value[pageId]) return;
    formsLoading.value[pageId] = true;
    try {
      const forms = await listPageForms(pageId);
      formsMap.value = { ...formsMap.value, [pageId]: forms };
    } catch (err) {
      error.value = `Không thể tải forms của trang: ${(err as Error).message}`;
    } finally {
      formsLoading.value[pageId] = false;
    }
  }

  async function saveMapping(
    input: CreateMappingInput,
    existingId?: string,
  ): Promise<FacebookFormMappingDto> {
    let result: FacebookFormMappingDto;
    if (existingId) {
      const patch: UpdateMappingInput = {
        customerListId: input.customerListId,
        fieldMap: input.fieldMap,
        enabled: true,
      };
      result = await updateMapping(existingId, patch);
      mappings.value = mappings.value.map((m) => (m.id === existingId ? result : m));
    } else {
      result = await createMapping(input);
      mappings.value = [...mappings.value, result];
    }
    return result;
  }

  async function deleteMappingById(id: string): Promise<void> {
    await apiDeleteMapping(id);
    // Reflect soft-delete locally (set enabled=false)
    mappings.value = mappings.value.map((m) =>
      m.id === id ? { ...m, enabled: false } : m,
    );
  }

  async function disconnectPage(
    pageId: string,
  ): Promise<{ disabledMappings: number }> {
    const result = await apiDisconnectPage(pageId);
    // Remove page from local list
    pages.value = pages.value.filter((p) => p.pageId !== pageId);
    // Clear forms cache for this page
    const { [pageId]: _, ...rest } = formsMap.value;
    formsMap.value = rest;
    return result;
  }

  return {
    // state
    pages,
    mappings,
    formsMap,
    formsLoading,
    loading,
    error,
    // derived
    mappingsByPageConnection,
    mappingByFormId,
    // actions
    connectPage,
    refreshPages,
    fetchForms,
    saveMapping,
    deleteMappingById,
    disconnectPage,
  };
}
