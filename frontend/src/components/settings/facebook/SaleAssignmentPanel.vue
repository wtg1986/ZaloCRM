<template>
  <div class="sale-assignment-panel">
    <!-- Loading skeleton -->
    <div v-if="loading" class="d-flex flex-column gap-2">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-avatar" />
    </div>

    <template v-else>
      <!-- Selected sale pool -->
      <div v-if="selectedPool.length > 0" class="mb-3">
        <p class="text-caption text-medium-emphasis mb-2">
          Sale trong pool (round-robin, weight đều nhau trong MVP)
        </p>
        <v-list density="compact" class="rounded border">
          <v-list-item
            v-for="entry in selectedPool"
            :key="entry.userId"
            :title="getUserLabel(entry.userId)"
            :subtitle="getUserEmail(entry.userId)"
          >
            <template #prepend>
              <v-avatar color="primary" size="32" aria-hidden="true">
                {{ getUserInitials(entry.userId) }}
              </v-avatar>
            </template>
            <template #append>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :aria-label="`Xóa ${getUserLabel(entry.userId)} khỏi pool`"
                @click="removeFromPool(entry.userId)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </div>

      <v-alert
        v-if="selectedPool.length === 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
        icon="mdi-alert"
      >
        ⚠️ Chưa có sale — lead về sẽ không được phân công tự động.
      </v-alert>

      <!-- Add sale picker -->
      <v-autocomplete
        v-model="pickerValue"
        :items="availableUsers"
        item-title="label"
        item-value="id"
        label="Thêm sale vào pool"
        placeholder="Tìm nhân viên..."
        clearable
        no-data-text="Không tìm thấy nhân viên"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-2"
        aria-label="Chọn sale để thêm vào pool"
        @update:model-value="onPickerSelect"
      />

      <p class="text-caption text-medium-emphasis mt-2">
        MVP: chia đều lead, weight reserve cho tính năng tỷ lệ close-rate sau.
      </p>
    </template>

    <v-alert v-if="error" type="error" density="compact" variant="tonal" class="mt-2">
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { OrgUserDto } from '@/api/list-sale-assignment-api';

export interface PoolEntry {
  userId: string;
  weight: number;
  enabled: boolean;
}

const props = defineProps<{
  modelValue: PoolEntry[];
  orgUsers: OrgUserDto[];
  loading?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [pool: PoolEntry[]];
}>();

const pickerValue = ref<string | null>(null);

const selectedPool = computed(() => props.modelValue);

/** Users not yet in the pool */
const availableUsers = computed(() =>
  props.orgUsers
    .filter((u) => u.isActive && !selectedPool.value.some((e) => e.userId === u.id))
    .map((u) => ({
      id: u.id,
      label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
    })),
);

function getUserById(userId: string): OrgUserDto | undefined {
  return props.orgUsers.find((u) => u.id === userId);
}

function getUserLabel(userId: string): string {
  const u = getUserById(userId);
  return u?.fullName ?? u?.email ?? userId;
}

function getUserEmail(userId: string): string {
  return getUserById(userId)?.email ?? '';
}

function getUserInitials(userId: string): string {
  const name = getUserLabel(userId);
  return name.slice(0, 2).toUpperCase();
}

function onPickerSelect(userId: string | null): void {
  if (!userId) return;
  if (selectedPool.value.some((e) => e.userId === userId)) return;
  emit('update:modelValue', [
    ...selectedPool.value,
    { userId, weight: 1, enabled: true },
  ]);
  // Reset picker after selection (nextTick not needed — v-model clears on next render)
  pickerValue.value = null;
}

function removeFromPool(userId: string): void {
  emit('update:modelValue', selectedPool.value.filter((e) => e.userId !== userId));
}
</script>

<style scoped>
.sale-assignment-panel {
  min-height: 120px;
}
</style>
