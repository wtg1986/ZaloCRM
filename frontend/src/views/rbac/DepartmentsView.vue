<template>
  <div class="rbac-page">
    <header class="page-head">
      <h2>Quản lý phòng ban</h2>
      <button class="btn-primary" @click="openCreate(null)">+ Thêm phòng ban</button>
    </header>

    <div v-if="store.loading" class="loading">Đang tải...</div>
    <div v-else-if="store.departments.length === 0" class="empty">
      Chưa có phòng ban nào. Click "+ Thêm phòng ban" để tạo.
    </div>
    <div v-else class="dept-tree">
      <DeptNode
        v-for="node in store.departments"
        :key="node.id"
        :node="node"
        @add-child="openCreate"
        @rename="renameNode"
        @archive="archiveNode"
      />
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <div class="modal">
        <h3>{{ createParentId ? 'Thêm phòng ban con' : 'Thêm phòng ban' }}</h3>
        <p v-if="createParentId" class="muted">Sẽ thuộc: {{ createParentName }}</p>
        <input v-model="newName" placeholder="Tên phòng ban" autofocus @keyup.enter="submitCreate" />
        <div class="actions">
          <button class="btn-ghost" @click="showCreate = false">Hủy</button>
          <button class="btn-primary" :disabled="!newName.trim()" @click="submitCreate">Tạo</button>
        </div>
        <p v-if="createError" class="error">{{ createError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h, type Component } from 'vue';
import { useRbacStore, type DepartmentNode } from '@/stores/rbac';

const store = useRbacStore();
onMounted(() => store.loadDepartments());

const showCreate = ref(false);
const createParentId = ref<string | null>(null);
const createParentName = ref('');
const newName = ref('');
const createError = ref('');

function openCreate(parent: DepartmentNode | null) {
  createParentId.value = parent?.id ?? null;
  createParentName.value = parent?.name ?? '';
  newName.value = '';
  createError.value = '';
  showCreate.value = true;
}

async function submitCreate() {
  if (!newName.value.trim()) return;
  try {
    await store.createDepartment({ name: newName.value.trim(), parentId: createParentId.value });
    showCreate.value = false;
  } catch (e: any) {
    createError.value = e?.response?.data?.error || 'Lỗi tạo phòng ban';
  }
}

async function renameNode(node: DepartmentNode) {
  const newN = prompt('Tên mới cho ' + node.name, node.name);
  if (newN && newN.trim() && newN !== node.name) {
    try {
      await store.renameDepartment(node.id, newN.trim());
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Lỗi rename');
    }
  }
}

async function archiveNode(node: DepartmentNode) {
  if (!confirm(`Xóa phòng ban "${node.name}"? (cần empty)`)) return;
  try {
    await store.archiveDepartment(node.id);
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi xóa');
  }
}

// Inline recursive component
const DeptNode: Component = {
  name: 'DeptNode',
  props: ['node'],
  emits: ['add-child', 'rename', 'archive'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'dept-node' }, [
        h('div', { class: 'dept-row' }, [
          h('span', { class: 'dept-name' }, [
            h('span', { class: 'depth-indicator' }, '─'.repeat(props.node.depth) + (props.node.depth > 0 ? '▸ ' : '')),
            props.node.name,
            h('span', { class: 'meta' }, ` (${props.node.memberCount} thành viên${props.node.leaderUserId ? ' • có trưởng' : ''})`),
          ]),
          h('div', { class: 'actions' }, [
            h('button', { class: 'btn-mini', onClick: () => emit('add-child', props.node) }, '+ Con'),
            h('button', { class: 'btn-mini', onClick: () => emit('rename', props.node) }, 'Sửa'),
            h('button', { class: 'btn-mini btn-danger', onClick: () => emit('archive', props.node) }, 'Xóa'),
          ]),
        ]),
        ...(props.node.children?.map((child: DepartmentNode) =>
          h(DeptNode as any, {
            key: child.id,
            node: child,
            onAddChild: (n: DepartmentNode) => emit('add-child', n),
            onRename: (n: DepartmentNode) => emit('rename', n),
            onArchive: (n: DepartmentNode) => emit('archive', n),
          }),
        ) ?? []),
      ]);
  },
};
</script>

<style scoped>
.rbac-page { padding: 20px 24px; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 18px; font-weight: 700; margin: 0; }
.btn-primary { background: #5E6AD2; color: white; border: 0; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid #E4E5E9; padding: 8px 14px; border-radius: 6px; cursor: pointer; }
.btn-mini { background: #F4F4F7; border: 0; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: 4px; }
.btn-mini.btn-danger { background: #FEE2E2; color: #DC2626; }
.dept-tree { background: white; border: 1px solid #E4E5E9; border-radius: 8px; padding: 12px; }
.dept-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 6px; border-bottom: 1px solid #F4F4F7; }
.dept-row:last-child { border-bottom: 0; }
.dept-name { font-size: 13px; }
.depth-indicator { color: #97A0AC; font-family: monospace; margin-right: 4px; }
.meta { color: #97A0AC; font-size: 11px; margin-left: 6px; }
.loading, .empty { padding: 40px; text-align: center; color: #97A0AC; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; padding: 24px; border-radius: 8px; min-width: 360px; }
.modal h3 { margin: 0 0 12px; font-size: 16px; }
.modal input { width: 100%; padding: 8px; border: 1px solid #E4E5E9; border-radius: 4px; margin-bottom: 12px; font-size: 14px; }
.modal .actions { display: flex; justify-content: flex-end; gap: 8px; }
.muted { color: #97A0AC; font-size: 12px; margin: 0 0 12px; }
.error { color: #DC2626; font-size: 12px; margin-top: 8px; }
</style>
