<template>
  <!-- Phase A UI fix v2 (2026-05-21): flex-nowrap để chip xếp hàng NGANG.
       P5 2026-05-21: thêm tooltip + click hint cho mỗi chip. Hover thấy ai react. -->
  <div v-if="reactions.length > 0" class="d-flex ga-1 reaction-row">
    <v-chip
      v-for="r in reactions"
      :key="r.emoji"
      size="x-small"
      :variant="r.reacted ? 'tonal' : 'outlined'"
      :color="r.reacted ? 'primary' : undefined"
      class="reaction-chip"
      :class="{ 'reaction-chip--reacted': r.reacted }"
      :title="tooltipFor(r)"
      @click="emit('toggle', r.emoji)"
    >
      {{ r.emoji }}&nbsp;{{ r.count }}
    </v-chip>
  </div>
</template>

<script setup lang="ts">
interface ReactionView { emoji: string; count: number; reacted: boolean }

defineProps<{
  reactions: ReactionView[];
}>();

const emit = defineEmits<{
  toggle: [emoji: string];
}>();

// Hover tooltip cho từng chip — anh chốt 2026-05-21: hiện "❤️ 3 người, click để (gỡ|thả) reaction".
// Phase 2 (defer): popover hiện avatar list từng người. Hiện chỉ count + action hint.
function tooltipFor(r: ReactionView): string {
  const people = r.count === 1 ? '1 người' : `${r.count} người`;
  const verb = r.reacted ? 'gỡ' : 'thả';
  return `${r.emoji} ${people} đã thả · click để ${verb} reaction`;
}
</script>

<style scoped>
.reaction-row {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.reaction-chip {
  cursor: pointer;
  transition: transform 0.12s;
  flex-shrink: 0;
}
.reaction-chip:hover {
  transform: scale(1.1);
}
.reaction-chip--reacted {
  border-width: 1.5px;
}
</style>
