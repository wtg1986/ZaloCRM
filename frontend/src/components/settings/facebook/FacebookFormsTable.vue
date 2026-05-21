<template>
  <div>
    <!-- Loading skeleton -->
    <div v-if="loading" class="d-flex flex-column gap-2 pa-2">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-two-line" />
    </div>

    <!-- Empty state -->
    <div v-else-if="forms.length === 0" class="text-center pa-4 text-medium-emphasis">
      <v-icon size="32" aria-hidden="true">mdi-form-select</v-icon>
      <p class="mt-1 text-body-2">Trang này chưa có Lead Form nào.</p>
    </div>

    <!-- Forms list -->
    <v-table v-else density="compact">
      <thead>
        <tr>
          <th>Tên form</th>
          <th>Trạng thái</th>
          <th>Leads</th>
          <th>Mapping</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="form in forms" :key="form.id">
          <td>
            <div class="font-weight-medium">{{ form.name }}</div>
            <div class="text-caption text-medium-emphasis">ID: {{ form.id }}</div>
          </td>
          <td>
            <v-chip
              :color="form.status === 'ACTIVE' ? 'success' : 'default'"
              size="x-small"
              variant="flat"
            >
              {{ form.status }}
            </v-chip>
          </td>
          <td class="text-body-2">{{ form.leads_count ?? '—' }}</td>
          <td>
            <template v-if="getMappingForForm(form.id)">
              <v-chip
                size="x-small"
                color="primary"
                variant="flat"
                class="mr-1"
              >
                {{ getMappingForForm(form.id)!.customerList.name }}
              </v-chip>
              <v-chip
                v-if="!hasSale(form.id)"
                size="x-small"
                color="warning"
                variant="flat"
                title="Pool sale trống — lead sẽ không được phân công"
              >
                ⚠️ Chưa có sale
              </v-chip>
              <v-chip
                v-if="!getMappingForForm(form.id)!.enabled"
                size="x-small"
                color="error"
                variant="flat"
              >
                Đã tắt
              </v-chip>
            </template>
            <span v-else class="text-caption text-medium-emphasis">Chưa map</span>
          </td>
          <td>
            <v-btn
              size="x-small"
              variant="text"
              :color="getMappingForForm(form.id) ? 'primary' : 'default'"
              :aria-label="getMappingForForm(form.id) ? `Chỉnh sửa mapping form ${form.name}` : `Tạo mapping cho form ${form.name}`"
              @click="$emit('map-form', form)"
            >
              {{ getMappingForForm(form.id) ? 'Sửa' : 'Map' }}
            </v-btn>
            <v-btn
              v-if="getMappingForForm(form.id)"
              size="x-small"
              variant="text"
              color="error"
              :aria-label="`Xóa mapping form ${form.name}`"
              @click="$emit('delete-mapping', getMappingForForm(form.id)!.id)"
            >
              Xóa
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import type { FacebookLeadgenForm, FacebookFormMappingDto } from '@/api/facebook-api';

const props = defineProps<{
  forms: FacebookLeadgenForm[];
  mappings: FacebookFormMappingDto[];
  /** Set of formIds that have ≥1 sale in pool */
  formIdsWithSale: Set<string>;
  loading?: boolean;
}>();

defineEmits<{
  'map-form': [form: FacebookLeadgenForm];
  'delete-mapping': [mappingId: string];
}>();

function getMappingForForm(formId: string): FacebookFormMappingDto | undefined {
  return props.mappings.find((m) => m.formId === formId);
}

function hasSale(formId: string): boolean {
  return props.formIdsWithSale.has(formId);
}
</script>
