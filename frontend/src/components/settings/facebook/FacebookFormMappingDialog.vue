<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center gap-2 pb-0">
        <v-icon color="primary" aria-hidden="true">mdi-facebook</v-icon>
        {{ isEdit ? 'Chỉnh sửa mapping' : 'Tạo mapping mới' }}
        <v-spacer />
        <span class="text-caption text-medium-emphasis">{{ formName }}</span>
      </v-card-title>

      <v-tabs v-model="activeTab" class="px-4 pt-2">
        <v-tab value="list">Danh sách KH</v-tab>
        <v-tab value="sale">Phân sale</v-tab>
        <v-tab value="fieldmap">Field Map</v-tab>
      </v-tabs>

      <v-divider />

      <v-card-text class="pt-4" style="min-height: 300px;">
        <v-tabs-window v-model="activeTab">

          <!-- Tab 1: CustomerList selection -->
          <v-tabs-window-item value="list">
            <p class="text-body-2 mb-3">
              Chọn Danh sách khách hàng để lead từ form này sẽ được thêm vào.
            </p>
            <v-select
              v-model="localListId"
              :items="customerLists"
              item-title="displayLabel"
              item-value="id"
              label="Danh sách KH *"
              placeholder="Chọn danh sách..."
              :loading="listsLoading"
              no-data-text="Không có danh sách nào"
              variant="outlined"
              density="compact"
              clearable
              aria-label="Chọn danh sách khách hàng"
              class="mb-3"
            />
            <p class="text-caption text-medium-emphasis">
              Lead hợp lệ (có số điện thoại) sẽ tạo Contact + CustomerListEntry trong danh sách này.
            </p>
          </v-tabs-window-item>

          <!-- Tab 2: Sale assignment -->
          <v-tabs-window-item value="sale">
            <p class="text-body-2 mb-3">
              Cấu hình pool sale để round-robin giao KH tự động khi lead về.
            </p>
            <SaleAssignmentPanel
              v-model="localPool"
              :org-users="orgUsers"
              :loading="saleLoading"
              :error="saleError"
            />
            <v-alert
              v-if="localPool.length === 0"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              Phải có ít nhất 1 sale để lưu mapping.
            </v-alert>
          </v-tabs-window-item>

          <!-- Tab 3: Field mapping -->
          <v-tabs-window-item value="fieldmap">
            <div class="d-flex align-center justify-space-between mb-2">
              <p class="text-body-2 mb-0">
                Map trường từ Facebook Form → trường trong ZaloCRM.
              </p>
              <v-chip
                v-if="autoMappedCount > 0"
                size="small"
                color="info"
                variant="flat"
              >
                Tự động map: {{ autoMappedCount }}/{{ localFieldMap.length }} trường
              </v-chip>
            </div>

            <v-alert
              v-if="!hasPhoneMapping"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              icon="mdi-phone-alert"
            >
              Khuyến nghị map ít nhất <strong>số điện thoại</strong> để dedup contact.
            </v-alert>

            <div
              v-for="(row, idx) in localFieldMap"
              :key="idx"
              class="d-flex align-center gap-2 mb-2"
            >
              <v-text-field
                v-model="row.fbField"
                label="Trường FB"
                density="compact"
                variant="outlined"
                hide-details
                class="flex-1-1"
                :aria-label="`Tên trường Facebook hàng ${idx + 1}`"
              />
              <v-icon size="small" color="medium-emphasis" aria-hidden="true">mdi-arrow-right</v-icon>
              <v-select
                v-model="row.crmField"
                :items="CRM_FIELD_OPTIONS"
                item-title="label"
                item-value="value"
                label="Trường CRM"
                density="compact"
                variant="outlined"
                hide-details
                class="flex-1-1"
                :aria-label="`Trường CRM hàng ${idx + 1}`"
              />
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :aria-label="`Xóa hàng ${idx + 1}`"
                @click="removeFieldRow(idx)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>

            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-plus"
              class="mt-1"
              @click="addFieldRow"
            >
              Thêm trường
            </v-btn>
          </v-tabs-window-item>

        </v-tabs-window>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="$emit('update:modelValue', false)">
          Hủy
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="handleSave"
        >
          Lưu
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import SaleAssignmentPanel from './SaleAssignmentPanel.vue';
import type { PoolEntry } from './SaleAssignmentPanel.vue';
import type { OrgUserDto } from '@/api/list-sale-assignment-api';
import type { FacebookFormMappingDto } from '@/api/facebook-api';

// ── Vietnamese field heuristic ────────────────────────────────────────────────
const FIELD_HEURISTIC: Record<string, string> = {
  tên_đầy_đủ: 'name', họ_tên: 'name', họ_và_tên: 'name',
  full_name: 'name', name: 'name', fullname: 'name',
  số_điện_thoại: 'phone', phone_number: 'phone', phone: 'phone',
  dien_thoai: 'phone', sdt: 'phone', mobile: 'phone',
  email: 'email', email_address: 'email', địa_chỉ_email: 'email',
};

const CRM_FIELD_OPTIONS = [
  { value: 'name',  label: 'Họ tên (name)' },
  { value: 'phone', label: 'Số điện thoại (phone)' },
  { value: 'email', label: 'Email' },
  { value: 'note',  label: 'Ghi chú (note)' },
  { value: 'custom', label: 'Trường tùy chỉnh (custom)' },
];

// ── Props / Emits ─────────────────────────────────────────────────────────────
interface CustomerListOption {
  id: string;
  displayLabel: string;
}

const props = defineProps<{
  modelValue: boolean;
  pageConnectionId: string;
  formId: string;
  formName: string;
  /** Form questions slug list (for auto-map heuristic) */
  formQuestions?: string[];
  /** Existing mapping (if editing) */
  existingMapping?: FacebookFormMappingDto | null;
  customerLists: CustomerListOption[];
  listsLoading?: boolean;
  orgUsers: OrgUserDto[];
  saleLoading?: boolean;
  saleError?: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: {
    pageConnectionId: string;
    formId: string;
    formName: string;
    customerListId: string;
    fieldMap: Record<string, string>;
    pool: PoolEntry[];
    existingId?: string;
  }];
}>();

// ── Local state ───────────────────────────────────────────────────────────────
const activeTab = ref<'list' | 'sale' | 'fieldmap'>('list');
const localListId = ref<string>('');
const localPool = ref<PoolEntry[]>([]);
const localFieldMap = ref<Array<{ fbField: string; crmField: string }>>([]);

const isEdit = computed(() => !!props.existingMapping);

// ── Initialise when dialog opens ──────────────────────────────────────────────
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    activeTab.value = 'list';

    if (props.existingMapping) {
      localListId.value = props.existingMapping.customerListId;
      const fm = props.existingMapping.fieldMap ?? {};
      localFieldMap.value = Object.entries(fm).map(([fbField, crmField]) => ({
        fbField,
        crmField,
      }));
    } else {
      localListId.value = '';
      localFieldMap.value = buildAutoFieldMap(props.formQuestions ?? []);
    }
  },
  { immediate: true },
);

function buildAutoFieldMap(questions: string[]): Array<{ fbField: string; crmField: string }> {
  if (questions.length === 0) {
    return [{ fbField: '', crmField: 'phone' }];
  }
  return questions.map((q) => ({
    fbField: q,
    crmField: FIELD_HEURISTIC[q.toLowerCase().replace(/\s+/g, '_')] ?? 'custom',
  }));
}

const autoMappedCount = computed(() =>
  localFieldMap.value.filter(
    (r) => r.crmField !== 'custom' && r.crmField !== '',
  ).length,
);

const hasPhoneMapping = computed(() =>
  localFieldMap.value.some((r) => r.crmField === 'phone' && r.fbField.trim() !== ''),
);

// ── Field map row operations ──────────────────────────────────────────────────
function addFieldRow(): void {
  localFieldMap.value.push({ fbField: '', crmField: 'custom' });
}

function removeFieldRow(idx: number): void {
  localFieldMap.value.splice(idx, 1);
}

// ── Save guard ────────────────────────────────────────────────────────────────
const canSave = computed(
  () => !!localListId.value && localPool.value.length > 0 && !props.saving,
);

function handleSave(): void {
  if (!canSave.value) return;

  const fieldMap: Record<string, string> = {};
  for (const row of localFieldMap.value) {
    if (row.fbField.trim()) fieldMap[row.fbField.trim()] = row.crmField;
  }

  emit('save', {
    pageConnectionId: props.pageConnectionId,
    formId: props.formId,
    formName: props.formName,
    customerListId: localListId.value,
    fieldMap,
    pool: localPool.value,
    existingId: props.existingMapping?.id,
  });
}
</script>
