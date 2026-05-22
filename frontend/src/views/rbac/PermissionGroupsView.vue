<template>
  <div class="dept-page">
    <header class="page-hero">
      <div class="hero-left">
        <h1 class="hero-title">Nhóm quyền</h1>
        <p class="hero-sub">
          Quản lý các nhóm quyền · Ma trận {{ resources.length }} chức năng × {{ actions.length }} hành động ·
          Áp dụng quyền cho từng user qua nhóm
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn-ghost" :disabled="seeding" @click="seedDefaults">
          {{ seeding ? 'Đang seed...' : '⚙ Seed 7 nhóm mặc định' }}
        </button>
        <button class="btn-primary" @click="openCreate(null)">
          <span class="btn-icon">+</span> Thêm nhóm quyền
        </button>
      </div>
    </header>

    <section class="stats-row" v-if="!loading && stats.total > 0">
      <div class="stat-card stat-primary">
        <div class="stat-label">Tổng nhóm</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card stat-forest">
        <div class="stat-label">Nhóm hệ thống</div>
        <div class="stat-value">{{ stats.system }}<span class="stat-unit"> / {{ stats.total }}</span></div>
      </div>
      <div class="stat-card stat-mustard">
        <div class="stat-label">Tổng user đã gán</div>
        <div class="stat-value">{{ stats.totalMembers }}</div>
      </div>
      <div class="stat-card stat-cream">
        <div class="stat-label">Slot quyền tối đa</div>
        <div class="stat-value">{{ totalSlots }}<span class="stat-unit"> / nhóm</span></div>
      </div>
    </section>

    <!-- Filter bar -->
    <div class="at-toolbar" v-if="!loading && store.permissionGroups.length > 0">
      <div class="search-box at-search">
        <span class="search-icon">🔍</span>
        <input v-model="searchQ" placeholder="Tìm nhóm quyền..." />
        <button v-if="searchQ" class="search-clear" @click="searchQ = ''">×</button>
      </div>
      <select class="filter-select" v-model="filterType">
        <option value="">Mọi loại nhóm</option>
        <option value="system">🛡 Hệ thống</option>
        <option value="custom">✎ Tùy chỉnh</option>
      </select>
      <div class="at-toolbar-spacer"></div>
      <span class="at-count">{{ filteredFlat.length }} / {{ stats.total }} nhóm</span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skel-card" v-for="i in 3" :key="i" style="height: 52px"></div>
    </div>

    <div v-else-if="store.permissionGroups.length === 0" class="empty-state">
      <div class="empty-icon">🛡</div>
      <h3>Chưa có nhóm quyền nào</h3>
      <p>Bắt đầu bằng seed 7 nhóm mặc định (CEO, Trưởng phòng, Sale Senior, Sale, Marketing, Kế toán, Khách).</p>
      <button class="btn-primary" :disabled="seeding" @click="seedDefaults">
        {{ seeding ? 'Đang seed...' : '⚙ Seed 7 nhóm mặc định' }}
      </button>
    </div>

    <div v-else-if="filteredFlat.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>Không tìm thấy nhóm phù hợp</h3>
      <p>Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</p>
    </div>

    <!-- AIRTABLE TABLE -->
    <section v-else class="at-table-wrap">
      <table class="at-table">
        <thead>
          <tr>
            <th class="th-num">#</th>
            <th class="th-name-pg">Tên nhóm</th>
            <th class="th-type">Loại</th>
            <th class="th-parent">Thuộc nhóm</th>
            <th class="th-users">User đã gán</th>
            <th class="th-grants">Quyền active</th>
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(g, i) in filteredFlat"
            :key="g.id"
            :class="{ 'row-active': selectedNode?.id === g.id }"
            @click="openPanel(g)"
          >
            <td class="cell-num">{{ i + 1 }}</td>
            <td class="cell-name-pg">
              <span class="pg-accent" :style="{ background: accentByDepth(g._depth) }"></span>
              <div class="cell-name-text">
                <div class="cell-name-main">
                  <span v-if="g._depth > 0" class="pg-indent">{{ '└─ '.repeat(1) }}</span>{{ g.name }}
                </div>
                <div v-if="g.children?.length" class="cell-name-sub">{{ g.children.length }} nhóm con</div>
              </div>
            </td>
            <td class="cell-type">
              <span v-if="g.isSystem" class="at-chip chip-system">🛡 Hệ thống</span>
              <span v-else class="at-chip chip-custom">✎ Tùy chỉnh</span>
            </td>
            <td class="cell-parent">
              <span v-if="parentNameOf(g.id)" class="at-chip chip-dept">
                📁 {{ parentNameOf(g.id) }}
              </span>
              <span v-else class="at-empty">(Gốc)</span>
            </td>
            <td class="cell-users">
              <span class="user-count-badge" :class="{ 'count-zero': (memberCountsLive[g.id] ?? 0) === 0 }">
                👥 {{ memberCountsLive[g.id] ?? 0 }}
              </span>
            </td>
            <td class="cell-grants">
              <div class="grants-bar-wrap">
                <div class="grants-bar-track">
                  <div
                    class="grants-bar-fill"
                    :style="{ width: grantsPct(g) + '%', background: grantsColor(grantsPct(g)) }"
                  ></div>
                </div>
                <span class="grants-num">{{ grantsActive(g) }} / {{ totalSlots }}</span>
              </div>
            </td>
            <td class="cell-actions">
              <button
                class="at-btn-icon at-btn-add"
                title="Thêm nhóm con"
                @click.stop="openCreate(g)"
              >+</button>
              <button class="at-btn-icon" title="Mở chi tiết" @click.stop="openPanel(g)">✎</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Create modal -->
    <Transition name="modal-fade">
      <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
        <div class="modal-card">
          <header class="modal-head">
            <h3>{{ createParentId ? 'Thêm nhóm con' : 'Thêm nhóm quyền gốc' }}</h3>
            <button class="modal-close" @click="showCreate = false">×</button>
          </header>
          <div class="modal-body">
            <p v-if="createParentName" class="parent-hint">
              <span class="hint-label">Thuộc:</span><strong>{{ createParentName }}</strong>
            </p>
            <label class="form-label">Tên nhóm quyền</label>
            <input
              ref="nameInput"
              v-model="newName"
              placeholder="VD: Sale Cấp Cao"
              class="form-input"
              @keyup.enter="submitCreate"
            />
            <label class="form-label" style="margin-top: 14px">Clone quyền từ</label>
            <select v-model="cloneFromId" class="form-input">
              <option value="">— Tạo mới (không clone) —</option>
              <option v-for="g in flatGroupsList" :key="g.id" :value="g.id">
                {{ '— '.repeat(g._depth) }}{{ g.name }} {{ g.isSystem ? '(hệ thống)' : '' }}
              </option>
            </select>
            <p v-if="createError" class="form-error">{{ createError }}</p>
          </div>
          <footer class="modal-foot">
            <button class="btn-ghost" @click="showCreate = false">Hủy</button>
            <button class="btn-primary" :disabled="!newName.trim()" @click="submitCreate">
              Tạo nhóm
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- Side panel -->
    <PermissionGroupEditPanel
      :open="panelOpen"
      :node="selectedNode"
      :parent-name="selectedParentName"
      :all-users="allUsers"
      @close="closePanel"
      @archived="onArchived"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRbacStore, type PermissionGroupNode, type RbacUser } from '@/stores/rbac';
import { api } from '@/api/index';
import PermissionGroupEditPanel from '@/components/rbac/PermissionGroupEditPanel.vue';

const store = useRbacStore();
const allUsers = ref<RbacUser[]>([]);
const searchQ = ref('');
const filterType = ref<'' | 'system' | 'custom'>('');
const seeding = ref(false);

const panelOpen = ref(false);
const selectedNode = ref<(PermissionGroupNode & { _depth?: number }) | null>(null);
const selectedParentName = ref<string | null>(null);

onMounted(async () => {
  await Promise.all([
    store.loadPermissionGroups(),
    api.get('/rbac/users').then((r) => { allUsers.value = r.data.users ?? []; }).catch(() => {}),
  ]);
});

const resources = computed(() => store.matrixMeta?.resources ?? []);
const actions = computed(() => store.matrixMeta?.actions ?? []);
const resourceActions = computed(() => store.matrixMeta?.resourceActions ?? {});
const totalSlots = computed(() => {
  let total = 0;
  for (const r of resources.value) total += (resourceActions.value[r] ?? []).length;
  return total;
});

const memberCountsLive = computed(() => {
  const m: Record<string, number> = {};
  for (const u of allUsers.value) {
    if (u.permissionGroupId) m[u.permissionGroupId] = (m[u.permissionGroupId] ?? 0) + 1;
  }
  return m;
});

// Flat list cho table + dropdown clone
const flatGroupsList = computed(() => {
  const out: Array<PermissionGroupNode & { _depth: number }> = [];
  function walk(nodes: PermissionGroupNode[], depth: number) {
    for (const n of nodes) {
      out.push({ ...n, _depth: depth });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  }
  walk(store.permissionGroups, 0);
  return out;
});

const filteredFlat = computed(() => {
  const q = searchQ.value.trim().toLowerCase();
  return flatGroupsList.value.filter((g) => {
    if (filterType.value === 'system' && !g.isSystem) return false;
    if (filterType.value === 'custom' && g.isSystem) return false;
    if (q && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

function parentNameOf(nodeId: string): string | null {
  function walk(nodes: PermissionGroupNode[], parentName: string | null): string | null {
    for (const n of nodes) {
      if (n.id === nodeId) return parentName;
      if (n.children?.length) {
        const found = walk(n.children, n.name);
        if (found !== null) return found;
      }
    }
    return null;
  }
  return walk(store.permissionGroups, null);
}

function getNodeDepth(nodeId: string): number {
  function walk(nodes: PermissionGroupNode[], depth: number): number {
    for (const n of nodes) {
      if (n.id === nodeId) return depth;
      if (n.children?.length) {
        const found = walk(n.children, depth + 1);
        if (found >= 0) return found;
      }
    }
    return -1;
  }
  return Math.max(0, walk(store.permissionGroups, 0));
}

function openPanel(node: PermissionGroupNode & { _depth?: number }) {
  selectedNode.value = { ...node, _depth: node._depth ?? getNodeDepth(node.id) };
  selectedParentName.value = parentNameOf(node.id);
  panelOpen.value = true;
}
function closePanel() {
  panelOpen.value = false;
  selectedNode.value = null;
  selectedParentName.value = null;
}
async function onArchived() {
  closePanel();
  await Promise.all([
    store.loadPermissionGroups(),
    api.get('/rbac/users').then((r) => { allUsers.value = r.data.users ?? []; }).catch(() => {}),
  ]);
}

watch(
  () => store.permissionGroups,
  async () => {
    try {
      const { data } = await api.get('/rbac/users');
      allUsers.value = data.users ?? [];
    } catch {}
  }
);

const stats = computed(() => {
  let total = 0, system = 0, totalMembers = 0;
  function walk(nodes: PermissionGroupNode[]) {
    for (const n of nodes) {
      total++;
      if (n.isSystem) system++;
      totalMembers += memberCountsLive.value[n.id] ?? 0;
      if (n.children?.length) walk(n.children);
    }
  }
  walk(store.permissionGroups);
  return { total, system, totalMembers };
});

const loading = computed(() => store.loading);

// Compute active grants count
function grantsActive(g: PermissionGroupNode): number {
  let count = 0;
  for (const r of resources.value) {
    const row = g.grants?.[r];
    if (!row) continue;
    for (const a of resourceActions.value[r] ?? []) {
      if (row[a]) count++;
    }
  }
  return count;
}
function grantsPct(g: PermissionGroupNode): number {
  if (totalSlots.value === 0) return 0;
  return Math.round((grantsActive(g) / totalSlots.value) * 100);
}
function grantsColor(pct: number): string {
  if (pct >= 80) return '#aa2d00';
  if (pct >= 50) return '#d9a441';
  if (pct >= 20) return '#1b61c9';
  if (pct > 0) return '#0a2e0e';
  return '#c9ccd1';
}
function accentByDepth(d: number): string {
  return ['#181d26', '#aa2d00', '#0a2e0e', '#d9a441', '#1b61c9'][Math.min(d, 4)];
}

// ── Create modal ──
const showCreate = ref(false);
const createParentId = ref<string | null>(null);
const createParentName = ref('');
const newName = ref('');
const cloneFromId = ref('');
const createError = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

function openCreate(parent: PermissionGroupNode | null) {
  createParentId.value = parent?.id ?? null;
  createParentName.value = parent?.name ?? '';
  newName.value = '';
  cloneFromId.value = '';
  createError.value = '';
  showCreate.value = true;
  setTimeout(() => nameInput.value?.focus(), 50);
}
async function submitCreate() {
  if (!newName.value.trim()) return;
  try {
    await store.createPermissionGroup({
      name: newName.value.trim(),
      parentId: createParentId.value,
      cloneFromId: cloneFromId.value || undefined,
    });
    showCreate.value = false;
  } catch (e: any) {
    createError.value = e?.response?.data?.error || 'Lỗi tạo nhóm';
  }
}

async function seedDefaults() {
  seeding.value = true;
  try {
    await store.seedDefaultGroups();
    const { data } = await api.get('/rbac/users');
    allUsers.value = data.users ?? [];
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi seed');
  } finally {
    seeding.value = false;
  }
}
</script>

<style>
/* PermissionGroupsView — Airtable-style table */

.hero-actions { display: flex; gap: 8px; }

/* Reuse .at-toolbar / .at-table / .at-chip from UsersRbacView (cùng theme Airtable) */

.th-name-pg { min-width: 220px; }
.th-type { width: 130px; }
.th-parent { min-width: 160px; }
.th-users { width: 110px; text-align: center !important; }
.th-grants { min-width: 200px; }
.th-actions { width: 88px; }

.cell-name-pg {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.pg-accent {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}
.pg-indent {
  color: #c9ccd1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  margin-right: 4px;
}

.cell-users { text-align: center; }
.user-count-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: #e0e9f5;
  color: #1b61c9;
  font-weight: 600;
  font-size: 12px;
}
.user-count-badge.count-zero {
  background: #f0f1f3;
  color: #9297a0;
  font-weight: 500;
}

/* Grants progress bar */
.cell-grants { min-width: 200px; }
.grants-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.grants-bar-track {
  flex: 1;
  height: 6px;
  background: #f0f1f3;
  border-radius: 9999px;
  overflow: hidden;
  min-width: 80px;
}
.grants-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s;
}
.grants-num {
  font-size: 11px;
  color: #41454d;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  min-width: 56px;
  text-align: right;
}

.at-btn-add {
  color: #0a2e0e !important;
  border-color: #c8d8c9 !important;
  margin-right: 4px;
}
.at-btn-add:hover {
  background: #0a2e0e !important;
  color: white !important;
  border-color: #0a2e0e !important;
}
</style>
