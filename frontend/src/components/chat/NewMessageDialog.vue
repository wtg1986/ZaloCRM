<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="520">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-message-plus</v-icon>
        Bắt đầu cuộc trò chuyện mới
      </v-card-title>

      <v-card-text>
        <!-- Pick nick CRM -->
        <v-select
          v-model="selectedAccountId"
          :items="accountItems"
          item-title="title"
          item-value="value"
          label="Gửi từ nick CRM"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          class="mb-3"
          @update:model-value="onAccountChange"
        />

        <!-- Search friend by name / phone / UID -->
        <v-text-field
          v-model="query"
          label="Tìm bạn theo tên, SĐT hoặc UID"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          hide-details="auto"
          :disabled="!selectedAccountId"
          @input="onSearchInput"
        />

        <!-- Result list -->
        <div class="mt-3 friend-result-list">
          <div v-if="searching" class="text-center text-grey pa-3">
            <v-progress-circular indeterminate size="20" />
          </div>
          <div v-else-if="!selectedAccountId" class="text-grey text-caption pa-3 text-center">
            Chọn nick CRM để tìm bạn
          </div>
          <div v-else-if="friends.length === 0 && query" class="text-grey text-caption pa-3 text-center">
            Không tìm thấy bạn — kiểm tra lại SĐT/tên hoặc sync friend list cho nick này
          </div>
          <div v-else-if="friends.length === 0" class="text-grey text-caption pa-3 text-center">
            Gõ tên / SĐT / UID để tìm
          </div>
          <button
            v-for="f in friends"
            :key="f.id"
            class="friend-row"
            :class="{ active: f.id === pickedFriendId }"
            @click="pickedFriendId = f.id"
          >
            <Avatar
              :src="f.zaloAvatarUrl"
              :name="f.zaloDisplayName || f.contact?.fullName || 'KH'"
              :size="36"
              :gradient-seed="f.id"
              platform="zalo"
            />
            <div class="friend-info">
              <div class="friend-name">{{ f.zaloDisplayName || f.contact?.fullName || `KH-${f.zaloUidInNick.slice(-4)}` }}</div>
              <div class="friend-meta">
                <span v-if="f.contact?.phone">📞 {{ f.contact.phone }}</span>
                <span class="uid">UID: {{ f.zaloUidInNick }}</span>
              </div>
            </div>
            <v-icon v-if="f.id === pickedFriendId" color="primary">mdi-check-circle</v-icon>
          </button>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Hủy</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!pickedFriendId || opening"
          :loading="opening"
          @click="onOpenChat"
        >
          Mở chat
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Avatar from '@/components/ui/Avatar.vue';
import { api } from '@/api';
import { useToast } from '@/composables/use-toast';

interface AccountLite { id: string; displayName: string | null }
interface FriendRow {
  id: string;
  zaloUidInNick: string;
  zaloDisplayName: string | null;
  zaloAvatarUrl: string | null;
  contact?: { id: string; fullName: string | null; phone: string | null } | null;
}

const props = defineProps<{
  modelValue: boolean;
  accounts: AccountLite[];
  defaultAccountId?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [v: boolean];
  opened: [conversationId: string];
}>();

const toast = useToast();

const accountItems = computed(() =>
  props.accounts.map(a => ({ value: a.id, title: a.displayName || 'Nick' })),
);

const selectedAccountId = ref<string | null>(props.defaultAccountId ?? null);
const query = ref('');
const friends = ref<FriendRow[]>([]);
const searching = ref(false);
const pickedFriendId = ref<string | null>(null);
const opening = ref(false);

// Reset state khi dialog mở lại
watch(() => props.modelValue, (v) => {
  if (v) {
    selectedAccountId.value = props.defaultAccountId
      ?? (props.accounts.length === 1 ? props.accounts[0].id : null);
    query.value = '';
    friends.value = [];
    pickedFriendId.value = null;
  }
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(), 250);
}
function onAccountChange() {
  friends.value = [];
  pickedFriendId.value = null;
  if (query.value) runSearch();
}

async function runSearch() {
  if (!selectedAccountId.value) return;
  searching.value = true;
  try {
    const res = await api.get<{ friends?: FriendRow[] }>(
      `/zalo-accounts/${selectedAccountId.value}/friends-db`,
      { params: { kind: 'all', page: 1, limit: 30, search: query.value } },
    );
    friends.value = res.data?.friends || [];
  } catch (err) {
    console.error('[NewMessageDialog] search failed:', err);
    friends.value = [];
  } finally {
    searching.value = false;
  }
}

async function onOpenChat() {
  if (!pickedFriendId.value) return;
  opening.value = true;
  try {
    const res = await api.post<{ conversationId: string; created: boolean }>(
      `/friends/${pickedFriendId.value}/ensure-conversation`, {},
    );
    if (res.data?.created) toast.success('Đã tạo cuộc trò chuyện mới');
    emit('opened', res.data.conversationId);
    emit('update:modelValue', false);
  } catch (err) {
    const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Không mở được chat';
    toast.error(msg);
  } finally {
    opening.value = false;
  }
}
</script>

<style scoped>
.friend-result-list {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid var(--smax-grey-200);
  border-radius: 8px;
}
.friend-row {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: transparent; border: none;
  border-bottom: 1px solid var(--smax-grey-100);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.friend-row:last-child { border-bottom: none; }
.friend-row:hover { background: var(--smax-grey-50); }
.friend-row.active { background: var(--smax-primary-soft); }
.friend-info { flex: 1; min-width: 0; }
.friend-name {
  font-weight: 600; font-size: 13.5px;
  color: var(--smax-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.friend-meta {
  font-size: 11px; color: var(--smax-grey-700);
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-top: 2px;
}
.friend-meta .uid {
  font-family: ui-monospace, monospace;
  background: var(--smax-grey-100);
  padding: 0 4px; border-radius: 3px;
  font-size: 10.5px;
}
</style>
