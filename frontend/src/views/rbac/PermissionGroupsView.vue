<template>
  <div class="rbac-page">
    <header class="page-head">
      <h2>Phân quyền (Nhóm quyền)</h2>
      <div class="head-actions">
        <button class="btn-ghost" @click="seedDefaults" :disabled="seeding">
          {{ seeding ? 'Đang seed...' : 'Seed 7 nhóm mặc định' }}
        </button>
      </div>
    </header>

    <div class="layout">
      <!-- Left: groups tree -->
      <aside class="groups-tree">
        <div class="tree-head">
          <strong>Nhóm quyền</strong>
        </div>
        <ul class="group-list">
          <li
            v-for="g in flatGroups"
            :key="g.id"
            :class="{ active: selectedId === g.id, system: g.isSystem }"
            @click="selectedId = g.id"
          >
            <span class="indent" :style="{ paddingLeft: (g._depth * 14) + 'px' }">
              {{ g.name }}
              <small v-if="g.isSystem" class="badge">hệ thống</small>
              <small class="muted">({{ g.memberCount }})</small>
            </span>
          </li>
        </ul>
      </aside>

      <!-- Right: matrix -->
      <section class="matrix-pane">
        <div v-if="!selected" class="empty">Chọn 1 nhóm quyền bên trái để xem ma trận</div>
        <div v-else>
          <div class="matrix-head">
            <h3>{{ selected.name }}</h3>
            <span v-if="selected.isSystem" class="badge">Nhóm hệ thống — chỉ sửa được grants</span>
          </div>
          <table class="matrix">
            <thead>
              <tr>
                <th>Chức năng</th>
                <th v-for="a in store.matrixMeta?.actions" :key="a">{{ actionLabel(a) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in store.matrixMeta?.resources" :key="r">
                <td class="resource-name">{{ resourceLabel(r) }}</td>
                <td v-for="a in store.matrixMeta?.actions" :key="a" class="check-cell">
                  <input
                    v-if="(store.matrixMeta?.resourceActions[r] ?? []).includes(a)"
                    type="checkbox"
                    :checked="!!selected.grants[r]?.[a]"
                    @change="toggleGrant(r, a, ($event.target as HTMLInputElement).checked)"
                  />
                  <span v-else class="dash">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRbacStore, type PermissionGroupNode } from '@/stores/rbac';

const store = useRbacStore();
const selectedId = ref<string | null>(null);
const seeding = ref(false);

onMounted(async () => {
  await store.loadPermissionGroups();
  if (store.permissionGroups.length > 0 && !selectedId.value) {
    selectedId.value = store.permissionGroups[0].id;
  }
});

// Flatten tree với depth indicator
const flatGroups = computed(() => {
  const result: Array<PermissionGroupNode & { _depth: number }> = [];
  function walk(nodes: PermissionGroupNode[], depth: number) {
    for (const n of nodes) {
      result.push({ ...n, _depth: depth });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  }
  walk(store.permissionGroups, 0);
  return result;
});

const selected = computed(() => flatGroups.value.find((g) => g.id === selectedId.value));

const ACTION_LABELS: Record<string, string> = {
  access: 'Truy cập',
  create: 'Thêm mới',
  edit: 'Chỉnh sửa',
  delete: 'Xóa',
  approve: 'Duyệt',
  pay: 'Thanh toán',
  view_all: 'Xem tất cả',
};
function actionLabel(a: string) { return ACTION_LABELS[a] ?? a; }

const RESOURCE_LABELS: Record<string, string> = {
  department: 'Quản lý phòng ban',
  user: 'Quản lý người dùng',
  permission_group: 'Quản lý quyền',
  conversation: 'Hội thoại',
  contact: 'Khách hàng',
  friend: 'Friends Zalo',
  customer_list: 'Tệp khách hàng',
  broadcast: 'Chiến dịch',
  sequence: 'Sequence',
  trigger: 'Trigger',
  block: 'Message Block',
  zalo_account: 'Nick Zalo',
  webhook: 'Webhook',
  engagement_score: 'Engagement / Score',
  audit_log: 'Audit Log',
  settings: 'Cài đặt',
};
function resourceLabel(r: string) { return RESOURCE_LABELS[r] ?? r; }

async function toggleGrant(resource: string, action: string, value: boolean) {
  if (!selected.value) return;
  const newGrants = JSON.parse(JSON.stringify(selected.value.grants ?? {}));
  if (!newGrants[resource]) newGrants[resource] = {};
  newGrants[resource][action] = value;
  try {
    await store.updateGroupGrants(selected.value.id, newGrants);
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi cập nhật');
  }
}

async function seedDefaults() {
  seeding.value = true;
  try {
    const res = await store.seedDefaultGroups();
    alert(`Seed xong: ${res.created} mới, ${res.existing} đã có`);
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi seed');
  } finally {
    seeding.value = false;
  }
}
</script>

<style scoped>
.rbac-page { padding: 20px 24px; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 18px; font-weight: 700; margin: 0; }
.btn-ghost { background: white; border: 1px solid #E4E5E9; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-ghost:disabled { opacity: 0.5; }
.layout { display: grid; grid-template-columns: 260px 1fr; gap: 16px; background: white; border: 1px solid #E4E5E9; border-radius: 8px; min-height: 500px; }
.groups-tree { border-right: 1px solid #E4E5E9; padding: 12px; }
.tree-head { font-size: 12px; color: #97A0AC; margin-bottom: 8px; text-transform: uppercase; }
.group-list { list-style: none; margin: 0; padding: 0; }
.group-list li { padding: 6px 8px; cursor: pointer; border-radius: 4px; font-size: 13px; }
.group-list li:hover { background: #F4F4F7; }
.group-list li.active { background: #EFF6FF; color: #1D4ED8; font-weight: 600; }
.group-list li.system { font-style: italic; }
.badge { background: #FEF3C7; color: #92400E; font-size: 9px; padding: 1px 6px; border-radius: 999px; margin-left: 4px; font-style: normal; font-weight: 600; }
.muted { color: #97A0AC; font-size: 10px; margin-left: 4px; }
.matrix-pane { padding: 16px; overflow-x: auto; }
.matrix-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.matrix-head h3 { margin: 0; font-size: 15px; }
.matrix { width: 100%; border-collapse: collapse; font-size: 12px; }
.matrix th { background: #F4F4F7; padding: 8px 6px; text-align: center; font-weight: 600; font-size: 11px; border-bottom: 1px solid #E4E5E9; }
.matrix th:first-child { text-align: left; }
.matrix td { padding: 6px; border-bottom: 1px solid #F4F4F7; }
.resource-name { font-weight: 500; }
.check-cell { text-align: center; }
.dash { color: #97A0AC; }
.empty { padding: 40px; text-align: center; color: #97A0AC; }
</style>
