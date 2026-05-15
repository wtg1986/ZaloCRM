<template>
  <div class="tag-crm-bar" v-if="contactId">
    <div class="tag-pills">
      <!-- Assigned pills (lấy style từ CrmTag master list nếu match) -->
      <span
        v-for="(tag, idx) in tags"
        :key="tag"
        class="tag-pill"
        :style="tagStyle(tag) || `border-color: ${fallbackHue(idx)}; color: ${fallbackHue(idx)}`"
        :title="findDef(tag)?.description || 'Click × để xoá'"
      >
        <span v-if="findDef(tag)?.emoji">{{ findDef(tag)?.emoji }} </span>{{ tag }}
        <button class="tag-x" title="Xoá tag" @click="removeTag(tag)">×</button>
      </span>

      <!-- Quick-add picker từ CrmTag master (autocomplete + search) -->
      <span v-if="adding" class="tag-pill adding">
        <input
          ref="addInput"
          v-model="newTag"
          class="tag-input-inline"
          placeholder="Gõ tên / chọn từ danh sách…"
          list="crm-tag-options"
          @keydown.enter.prevent="confirmAdd"
          @keydown.escape.prevent="cancelAdd"
          @blur="confirmAdd"
        />
        <datalist id="crm-tag-options">
          <option v-for="def in availableDefs" :key="def.id" :value="def.name">
            {{ def.category ? `[${def.category}]` : '' }} {{ def.description || '' }}
          </option>
        </datalist>
      </span>
      <button v-else class="tag-add-btn" @click="startAdd">
        + Thêm thẻ
      </button>
    </div>

    <!-- Quick-add buttons từ CrmTag master (chỉ hiện khi chưa có tag nào) -->
    <div v-if="!tags.length && !adding && tagDefs.length" class="tag-suggestions">
      <span class="sug-label">Gắn nhanh:</span>
      <button
        v-for="def in tagDefs.slice(0, 8)"
        :key="def.id"
        class="tag-sug"
        :style="`color: ${def.color}; border-color: ${def.color}`"
        @click="quickAdd(def.name)"
      >+ <span v-if="def.emoji">{{ def.emoji }} </span>{{ def.name }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import { api } from '@/api/index';
import { useToast } from '@/composables/use-toast';

interface CrmTagDef {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  description: string | null;
  category: string | null;
  order: number;
  isActive: boolean;
}

const props = defineProps<{
  contactId: string | null;
  modelValue: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [tags: string[]];
}>();

const toast = useToast();

// CrmTag master list — fetch 1 lần, cache module-level dùng chung mọi instance
const tagDefs = ref<CrmTagDef[]>([]);
let fetchedOnce = false;

async function loadTagDefs() {
  if (fetchedOnce) return;
  try {
    const { data } = await api.get('/crm-tags');
    tagDefs.value = (data.tags || []).filter((t: CrmTagDef) => t.isActive);
    fetchedOnce = true;
  } catch (err) {
    console.warn('[crm-tags] Cannot load master list', err);
  }
}

/* Sort tags theo priority order trong CrmTag.order (định nghĩa ở settings).
 * Tag không match → đẩy xuống cuối theo alphabetical. */
const tags = computed(() => {
  const list = props.modelValue || [];
  return [...list].sort((a, b) => {
    const da = findDef(a);
    const db = findDef(b);
    if (da && db) return da.order - db.order;          // cả 2 có def → sort theo order
    if (da) return -1;                                  // a có def, b không → a trước
    if (db) return 1;                                   // b có def, a không → b trước
    return a.localeCompare(b);                          // cả 2 không def → alphabet
  });
});

const adding = ref(false);
const newTag = ref('');
const addInput = ref<HTMLInputElement | null>(null);

// Tag chưa gán → hiện trong autocomplete
const availableDefs = computed(() =>
  tagDefs.value.filter(d => !tags.value.includes(d.name)),
);

function findDef(name: string): CrmTagDef | null {
  return tagDefs.value.find(d => d.name === name) || null;
}

function tagStyle(name: string): string | null {
  const def = findDef(name);
  if (!def) return null;
  return `background: ${def.color}15; color: ${def.color}; border-color: ${def.color}`;
}

const FALLBACK_HUES = ['#c62828', '#1565c0', '#d84315', '#f9a825', '#ef6c00', '#2e7d32', '#00838f', '#6a1b9a'];
function fallbackHue(idx: number): string {
  return FALLBACK_HUES[idx % FALLBACK_HUES.length];
}

function startAdd() {
  adding.value = true;
  newTag.value = '';
  nextTick(() => addInput.value?.focus());
}

function cancelAdd() {
  adding.value = false;
  newTag.value = '';
}

async function confirmAdd() {
  const t = newTag.value.trim();
  if (!t) { cancelAdd(); return; }
  if (tags.value.includes(t)) {
    toast.warning('Tag đã tồn tại');
    cancelAdd();
    return;
  }
  await persist([...tags.value, t]);

  // Auto-create CrmTag definition nếu chưa có (free-text mới)
  if (!findDef(t)) {
    try {
      const { data } = await api.post('/crm-tags', { name: t, category: 'Khác' });
      tagDefs.value.push(data.tag);
    } catch {
      // Silent — Contact.tags vẫn lưu được
    }
  }
  cancelAdd();
}

async function quickAdd(value: string) {
  if (tags.value.includes(value)) return;
  await persist([...tags.value, value]);
}

async function removeTag(tag: string) {
  await persist(tags.value.filter(t => t !== tag));
}

async function persist(next: string[]) {
  if (!props.contactId) return;
  emit('update:modelValue', next); // optimistic
  try {
    await api.patch(`/contacts/${props.contactId}`, { tags: next });
  } catch {
    toast.error('Lưu tag thất bại');
  }
}

onMounted(() => { void loadTagDefs(); });
</script>

<style scoped>
.tag-crm-bar {
  /* Extend full-width của input-area (input-area có padding 7px 13px) */
  margin: -7px -13px 7px;
  padding: 7px 13px 6px;
  background: var(--smax-bg);
  border-bottom: 1px solid var(--smax-grey-100);
}

.tag-pills {
  display: flex;
  flex-wrap: nowrap;             /* 1 dòng — không wrap */
  align-items: center;
  gap: 6px;
  overflow-x: auto;              /* scroll ngang nếu nhiều tag */
  overflow-y: hidden;
  padding-bottom: 2px;           /* chừa chỗ scrollbar */
  scrollbar-width: thin;
}
.tag-pills::-webkit-scrollbar { height: 4px; }
.tag-pills::-webkit-scrollbar-thumb {
  background: var(--smax-grey-200);
  border-radius: 2px;
}
.tag-pills::-webkit-scrollbar-thumb:hover { background: var(--smax-grey-300); }
.tag-pills::-webkit-scrollbar-track { background: transparent; }
.tag-pill { flex-shrink: 0; }   /* giữ kích thước, không co lại khi overflow */
.tag-add-btn { flex-shrink: 0; }

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 5px 3px 9px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1.4px solid;
  background: transparent;
  white-space: nowrap;
  transition: filter 0.12s;
}
.tag-pill.adding {
  padding: 0 6px;
  color: var(--smax-primary, #2962ff);
  border-color: var(--smax-primary);
}

.tag-x {
  background: none;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  color: inherit;
  opacity: 0.55;
  transition: opacity 0.1s;
}
.tag-x:hover { opacity: 1; }

.tag-input-inline {
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--smax-primary);
  padding: 2px 0;
  min-width: 70px;
  font-family: inherit;
}

.tag-add-btn {
  background: var(--smax-grey-100);
  border: 1.4px dashed var(--smax-grey-300);
  color: var(--smax-grey-600);
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 10px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.tag-add-btn:hover {
  background: var(--smax-primary-soft, #e3f2fd);
  color: var(--smax-primary);
  border-color: var(--smax-primary);
}

.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  font-size: 11px;
}
.sug-label { color: var(--smax-grey-500); font-size: 10.5px; }
.tag-sug {
  background: transparent;
  border: 1px dashed currentColor;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 7px;
  cursor: pointer;
  opacity: 0.7;
}
.tag-sug:hover { opacity: 1; }
</style>
