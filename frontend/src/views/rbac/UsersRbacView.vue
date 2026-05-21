<template>
  <div class="rbac-page">
    <header class="page-head">
      <h2>Quản lý người dùng</h2>
    </header>

    <div class="filters">
      <input v-model="searchQ" placeholder="Tìm theo tên / email" @input="applyFilter" />
      <select v-model="filterGroup" @change="applyFilter">
        <option value="">Mọi nhóm quyền</option>
        <option v-for="g in flatGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
    </div>

    <table class="users-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Họ tên</th>
          <th>Email</th>
          <th>Phòng ban</th>
          <th>Nhóm quyền</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(u, i) in store.users" :key="u.id">
          <td>{{ i + 1 }}</td>
          <td>{{ u.fullName }}</td>
          <td>{{ u.email }}</td>
          <td>{{ u.departmentMember?.department?.name ?? '—' }}<small v-if="u.departmentMember?.deptRole && u.departmentMember.deptRole !== 'member'" class="role-tag">{{ u.departmentMember.deptRole === 'leader' ? '👑 Trưởng' : '🎖️ Phó' }}</small></td>
          <td>
            <select :value="u.permissionGroupId ?? ''" @change="changeGroup(u.id, ($event.target as HTMLSelectElement).value)">
              <option value="">— Chưa gán —</option>
              <option v-for="g in flatGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </td>
          <td><small class="muted">{{ u.role }}</small></td>
        </tr>
      </tbody>
    </table>
    <div v-if="store.users.length === 0 && !store.loading" class="empty">Không có user nào</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRbacStore, type PermissionGroupNode } from '@/stores/rbac';

const store = useRbacStore();
const searchQ = ref('');
const filterGroup = ref('');

onMounted(async () => {
  await Promise.all([store.loadUsers(), store.loadPermissionGroups()]);
});

const flatGroups = computed(() => {
  const result: PermissionGroupNode[] = [];
  function walk(nodes: PermissionGroupNode[]) {
    for (const n of nodes) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(store.permissionGroups);
  return result;
});

let debounceTimer: any;
function applyFilter() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.loadUsers({
      q: searchQ.value || undefined,
      permissionGroupId: filterGroup.value || undefined,
    });
  }, 300);
}

async function changeGroup(userId: string, groupId: string) {
  try {
    await store.setUserPermissionGroup(userId, groupId || null);
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi đổi nhóm');
  }
}
</script>

<style scoped>
.rbac-page { padding: 20px 24px; }
.page-head { margin-bottom: 16px; }
.page-head h2 { font-size: 18px; font-weight: 700; margin: 0; }
.filters { display: flex; gap: 8px; margin-bottom: 12px; }
.filters input, .filters select { padding: 6px 10px; border: 1px solid #E4E5E9; border-radius: 4px; font-size: 13px; }
.filters input { flex: 1; }
.users-table { width: 100%; background: white; border: 1px solid #E4E5E9; border-radius: 8px; border-collapse: collapse; }
.users-table th, .users-table td { padding: 10px 12px; border-bottom: 1px solid #F4F4F7; text-align: left; font-size: 13px; }
.users-table th { background: #F9FAFB; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #6B7280; }
.users-table tbody tr:hover { background: #FAFAFB; }
.users-table select { padding: 4px 6px; border: 1px solid #E4E5E9; border-radius: 4px; font-size: 12px; }
.role-tag { display: inline-block; background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 999px; font-size: 10px; margin-left: 6px; }
.muted { color: #97A0AC; font-size: 11px; text-transform: uppercase; }
.empty { padding: 40px; text-align: center; color: #97A0AC; }
</style>
