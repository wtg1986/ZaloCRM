<template>
  <v-card class="mb-3" variant="outlined">
    <!-- Page header row -->
    <v-card-text class="pa-3">
      <div class="d-flex align-center gap-3">
        <!-- Facebook icon + page info -->
        <v-avatar color="blue" size="40" aria-hidden="true">
          <v-icon color="white">mdi-facebook</v-icon>
        </v-avatar>

        <div class="flex-grow-1">
          <div class="d-flex align-center gap-2">
            <span class="font-weight-medium">{{ page.pageName }}</span>
            <v-chip
              :color="statusColor"
              size="x-small"
              variant="flat"
              :aria-label="`Trạng thái: ${statusLabel}`"
            >
              {{ statusLabel }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis">
            Page ID: {{ page.pageId }}
            <span v-if="page.lastLeadAt" class="ml-2">
              · Lead cuối: {{ formatDate(page.lastLeadAt) }}
            </span>
            <span v-if="page.lastError" class="ml-2 text-error">
              · {{ page.lastError.slice(0, 80) }}
            </span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="d-flex align-center gap-1">
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            :aria-label="expanded ? 'Thu gọn' : 'Xem forms'"
            @click="toggleExpand"
          >
            {{ expanded ? 'Thu gọn' : 'Xem forms' }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-link-off"
            aria-label="Ngắt kết nối trang này"
            @click="$emit('disconnect', page)"
          >
            Disconnect
          </v-btn>
        </div>
      </div>
    </v-card-text>

    <!-- Expanded forms section -->
    <template v-if="expanded">
      <v-divider />
      <v-card-text class="pa-0">
        <FacebookFormsTable
          :forms="forms"
          :mappings="mappings"
          :form-ids-with-sale="formIdsWithSale"
          :loading="formsLoading"
          @map-form="$emit('map-form', $event)"
          @delete-mapping="$emit('delete-mapping', $event)"
        />
      </v-card-text>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FacebookFormsTable from './FacebookFormsTable.vue';
import type { FacebookPageConnectionDto, FacebookLeadgenForm, FacebookFormMappingDto } from '@/api/facebook-api';

const props = defineProps<{
  page: FacebookPageConnectionDto;
  forms: FacebookLeadgenForm[];
  mappings: FacebookFormMappingDto[];
  formIdsWithSale: Set<string>;
  formsLoading?: boolean;
}>();

const emit = defineEmits<{
  disconnect: [page: FacebookPageConnectionDto];
  'map-form': [form: FacebookLeadgenForm];
  'delete-mapping': [mappingId: string];
  expand: [pageId: string];
}>();

const expanded = ref(false);

const statusColor = computed(() => {
  switch (props.page.status) {
    case 'connected': return 'success';
    case 'error':     return 'error';
    case 'revoked':   return 'default';
    default:          return 'default';
  }
});

const statusLabel = computed(() => {
  switch (props.page.status) {
    case 'connected': return 'Đang kết nối';
    case 'error':     return 'Lỗi token';
    case 'revoked':   return 'Đã ngắt';
    default:          return props.page.status;
  }
});

function toggleExpand(): void {
  expanded.value = !expanded.value;
  if (expanded.value) {
    emit('expand', props.page.pageId);
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
</script>
