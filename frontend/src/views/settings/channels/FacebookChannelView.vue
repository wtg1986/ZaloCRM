<template>
  <div class="fb-channel-view">
    <!-- Page header -->
    <div class="page-head">
      <div>
        <h2 class="page-title">
          <v-icon color="#1877F2" class="mr-1" aria-hidden="true">mdi-facebook</v-icon>
          Kênh Facebook
        </h2>
        <p class="page-desc">Kết nối Facebook Page, cấu hình form mapping và phân sale tự động.</p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-facebook"
        :loading="loading"
        @click="onConnectPage"
      >
        Kết nối Facebook Page
      </v-btn>
    </div>

    <!-- OAuth callback status banner -->
    <v-alert
      v-if="oauthStatus"
      :type="oauthStatus === 'success' ? 'success' : 'error'"
      variant="tonal"
      density="compact"
      closable
      class="mb-4"
      @click:close="clearOauthStatus"
    >
      <template v-if="oauthStatus === 'success'">
        Kết nối thành công {{ oauthPages }} trang Facebook!
      </template>
      <template v-else>
        Kết nối thất bại: {{ oauthReason }}
      </template>
    </v-alert>

    <!-- General error -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="error = ''"
    >
      {{ error }}
    </v-alert>

    <!-- Loading skeleton -->
    <div v-if="loading && pages.length === 0" class="d-flex flex-column gap-3">
      <v-skeleton-loader v-for="n in 2" :key="n" type="card" />
    </div>

    <!-- Empty state -->
    <v-card
      v-else-if="!loading && pages.length === 0"
      variant="outlined"
      class="text-center pa-8"
    >
      <v-icon size="56" color="blue" aria-hidden="true">mdi-facebook</v-icon>
      <h3 class="mt-3 mb-2">Chưa kết nối Page nào</h3>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Click "Kết nối Facebook Page" để bắt đầu nhận lead từ Facebook.
      </p>
      <v-btn color="primary" prepend-icon="mdi-facebook" @click="onConnectPage">
        Kết nối Facebook Page
      </v-btn>
    </v-card>

    <!-- Page rows -->
    <template v-else>
      <FacebookPageRow
        v-for="page in pages"
        :key="page.id"
        :page="page"
        :forms="formsMap[page.pageId] ?? []"
        :mappings="mappingsByPageConnection[page.id] ?? []"
        :form-ids-with-sale="formIdsWithSale"
        :forms-loading="!!formsLoading[page.pageId]"
        @disconnect="onDisconnectIntent"
        @expand="fetchForms"
        @map-form="onMapForm(page, $event)"
        @delete-mapping="onDeleteMapping"
      />
    </template>

    <!-- Disconnect confirm dialog -->
    <FacebookDisconnectDialog
      v-model="showDisconnect"
      :page-name="disconnectTarget?.pageName ?? ''"
      :active-mapping-count="activeMappingCountForTarget"
      :loading="disconnecting"
      :error="disconnectError"
      @confirm="onDisconnectConfirm"
    />

    <!-- Form mapping dialog -->
    <FacebookFormMappingDialog
      v-if="mappingDialog.open"
      v-model="mappingDialog.open"
      :page-connection-id="mappingDialog.pageConnectionId"
      :form-id="mappingDialog.formId"
      :form-name="mappingDialog.formName"
      :form-questions="mappingDialog.formQuestions"
      :existing-mapping="mappingDialog.existingMapping"
      :customer-lists="customerListOptions"
      :lists-loading="listsLoading"
      :org-users="orgUsers"
      :sale-loading="saleAssignments.loading.value"
      :sale-error="saleAssignments.error.value"
      :saving="mappingSaving"
      @save="onMappingSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFacebookChannel } from '@/composables/use-facebook-channel';
import { useListSaleAssignments } from '@/composables/use-list-sale-assignments';
import { api } from '@/api/index';
import FacebookPageRow from '@/components/settings/facebook/FacebookPageRow.vue';
import FacebookDisconnectDialog from '@/components/settings/facebook/FacebookDisconnectDialog.vue';
import FacebookFormMappingDialog from '@/components/settings/facebook/FacebookFormMappingDialog.vue';
import type { FacebookPageConnectionDto, FacebookLeadgenForm, FacebookFormMappingDto } from '@/api/facebook-api';
import { upsertSaleAssignments } from '@/api/list-sale-assignment-api';

const route = useRoute();
const router = useRouter();

// ── Facebook channel composable ───────────────────────────────────────────────
const {
  pages, mappings, formsMap, formsLoading, loading, error,
  mappingsByPageConnection, mappingByFormId,
  connectPage, refreshPages, fetchForms, saveMapping, deleteMappingById, disconnectPage,
} = useFacebookChannel();

// ── Sale assignments composable ───────────────────────────────────────────────
const saleAssignments = useListSaleAssignments();
const { orgUsers } = saleAssignments;

// ── Customer lists (for dropdown) ─────────────────────────────────────────────
interface ListOption { id: string; displayLabel: string; }
const customerListOptions = ref<ListOption[]>([]);
const listsLoading = ref(false);

async function loadCustomerLists(): Promise<void> {
  listsLoading.value = true;
  try {
    const { data } = await api.get<{ lists: Array<{ id: string; name: string; iconEmoji: string | null }> }>(
      '/customer-lists',
    );
    customerListOptions.value = (data.lists ?? []).map((l) => ({
      id: l.id,
      displayLabel: l.iconEmoji ? `${l.iconEmoji} ${l.name}` : l.name,
    }));
  } catch {
    // non-fatal — user sees empty dropdown
  } finally {
    listsLoading.value = false;
  }
}

// ── Set of formIds that have ≥1 enabled sale in pool ─────────────────────────
// Populated lazily when a page expands (we load sale-assignments per list)
const salePoolByListId = ref<Record<string, boolean>>({});

const formIdsWithSale = computed<Set<string>>(() => {
  const result = new Set<string>();
  for (const m of mappings.value) {
    if (m.enabled && salePoolByListId.value[m.customerListId]) {
      result.add(m.formId);
    }
  }
  return result;
});

// ── Disconnect flow ───────────────────────────────────────────────────────────
const showDisconnect = ref(false);
const disconnectTarget = ref<FacebookPageConnectionDto | null>(null);
const disconnecting = ref(false);
const disconnectError = ref('');

const activeMappingCountForTarget = computed(() => {
  if (!disconnectTarget.value) return 0;
  return (mappingsByPageConnection.value[disconnectTarget.value.id] ?? []).filter(
    (m) => m.enabled,
  ).length;
});

function onDisconnectIntent(page: FacebookPageConnectionDto): void {
  disconnectTarget.value = page;
  disconnectError.value = '';
  showDisconnect.value = true;
}

async function onDisconnectConfirm(): Promise<void> {
  if (!disconnectTarget.value) return;
  disconnecting.value = true;
  disconnectError.value = '';
  try {
    await disconnectPage(disconnectTarget.value.pageId);
    showDisconnect.value = false;
    disconnectTarget.value = null;
  } catch (err) {
    disconnectError.value = (err as Error).message ?? 'Không thể ngắt kết nối';
  } finally {
    disconnecting.value = false;
  }
}

// ── Mapping dialog ────────────────────────────────────────────────────────────
interface MappingDialogState {
  open: boolean;
  pageConnectionId: string;
  formId: string;
  formName: string;
  formQuestions: string[];
  existingMapping: FacebookFormMappingDto | null;
  customerListId: string;
}

const mappingDialog = ref<MappingDialogState>({
  open: false,
  pageConnectionId: '',
  formId: '',
  formName: '',
  formQuestions: [],
  existingMapping: null,
  customerListId: '',
});
const mappingSaving = ref(false);

async function onMapForm(page: FacebookPageConnectionDto, form: FacebookLeadgenForm): Promise<void> {
  const existing = mappingByFormId.value[form.id] ?? null;

  mappingDialog.value = {
    open: true,
    pageConnectionId: page.id,
    formId: form.id,
    formName: form.name,
    formQuestions: [], // form questions not available from list API — auto-map uses empty
    existingMapping: existing,
    customerListId: existing?.customerListId ?? '',
  };

  // Load sale assignments if editing existing mapping
  if (existing) {
    await saleAssignments.load(existing.customerListId);
  } else {
    await saleAssignments.load(''); // pre-load org users
    saleAssignments.reset();
  }
}

async function onMappingSave(payload: {
  pageConnectionId: string;
  formId: string;
  formName: string;
  customerListId: string;
  fieldMap: Record<string, string>;
  pool: Array<{ userId: string; weight: number; enabled: boolean }>;
  existingId?: string;
}): Promise<void> {
  mappingSaving.value = true;
  try {
    const savedMapping = await saveMapping(
      {
        pageConnectionId: payload.pageConnectionId,
        formId: payload.formId,
        formName: payload.formName,
        customerListId: payload.customerListId,
        fieldMap: payload.fieldMap,
      },
      payload.existingId,
    );

    // Upsert sale assignment pool
    await upsertSaleAssignments(payload.customerListId, payload.pool);

    // Update local sale pool status
    salePoolByListId.value = {
      ...salePoolByListId.value,
      [payload.customerListId]: payload.pool.length > 0,
    };

    mappingDialog.value.open = false;
  } catch (err) {
    error.value = (err as Error).message ?? 'Không thể lưu mapping';
  } finally {
    mappingSaving.value = false;
  }
}

async function onDeleteMapping(mappingId: string): Promise<void> {
  try {
    await deleteMappingById(mappingId);
  } catch (err) {
    error.value = (err as Error).message ?? 'Không thể xóa mapping';
  }
}

// ── OAuth status from URL query params ───────────────────────────────────────
const oauthStatus = ref<'success' | 'error' | null>(null);
const oauthPages = ref(0);
const oauthReason = ref('');

function readOauthStatus(): void {
  const status = route.query.status as string | undefined;
  if (!status) return;
  if (status === 'success') {
    oauthStatus.value = 'success';
    oauthPages.value = parseInt(String(route.query.pages ?? '0'), 10);
  } else if (status === 'error') {
    oauthStatus.value = 'error';
    oauthReason.value = decodeURIComponent(String(route.query.reason ?? ''));
  }
  // Clean URL params
  router.replace({ path: route.path, query: {} });
}

function clearOauthStatus(): void {
  oauthStatus.value = null;
}

function onConnectPage(): void {
  connectPage();
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  readOauthStatus();
  await Promise.all([
    refreshPages(),
    loadCustomerLists(),
    saleAssignments.load(''),
  ]);
});
</script>

<style scoped>
.fb-channel-view {
  max-width: 900px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px;
  display: flex;
  align-items: center;
}
.page-desc {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  margin: 0;
}
</style>
