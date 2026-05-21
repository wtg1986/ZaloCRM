<template>
  <div class="apt-week">
    <div class="cal-head">
      <div class="corner" />
      <div v-for="d in days" :key="d.iso" class="dcol" :class="{ today: d.isToday }">
        <div class="dow">{{ d.dowLabel }}{{ d.isToday ? ' — Hôm nay' : '' }}</div>
        <div class="date">{{ d.day }}</div>
        <div class="count">{{ d.count }} lịch<span v-if="d.pending"> · {{ d.pending }} quá hạn</span></div>
      </div>
    </div>

    <div ref="bodyEl" class="cal-body">
      <div class="timecol">
        <div v-for="h in hourRange" :key="h" class="slot">{{ String(h).padStart(2,'0') }}:00</div>
      </div>

      <div v-for="d in days" :key="d.iso" class="daycol" :class="{ today: d.isToday }">
        <div
          v-for="h in hourRange"
          :key="h"
          class="slot"
          @click="onSlotClick(d.date, h, 0)"
        >
          <div class="halfslot" @click.stop="onSlotClick(d.date, h, 30)" />
        </div>

        <div
          v-for="ev in d.events"
          :key="ev.appt.id"
          class="event"
          :class="[`state-${ev.appt.status}`, ev.appt.status === 'overdue' ? 'striped' : '']"
          :style="{
            top: ev.top + 'px',
            height: ev.height + 'px',
            background: ev.appt.status === 'cancelled' ? '#94a3b8' : saleColor(ownerId(ev.appt)).bg,
            left: ev.left,
            width: ev.width,
          }"
          @click.stop="$emit('select-appointment', ev.appt)"
        >
          <div class="ev-time">{{ ev.timeLabel }}</div>
          <div class="ev-title">{{ ev.appt.contact?.fullName || 'KH' }}</div>
          <div class="ev-meta">{{ typeIcon(ev.appt.type) }} {{ ev.appt.source === 'zalo' ? 'Zalo' : 'Thủ công' }}</div>
        </div>

        <div v-if="d.isToday && nowOffset !== null" class="nowline" :style="{ top: nowOffset + 'px' }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import {
  saleColor,
  typeIcon,
  appointmentOwnerId as ownerId,
  appointmentStart,
  appointmentEnd,
  type AppointmentEx as Appointment,
} from '@/composables/appointment-helpers';

const props = defineProps<{
  weekStart: Date;
  appointments: Appointment[];
}>();

const emit = defineEmits<{
  (e: 'select-appointment', a: Appointment): void;
  (e: 'create-slot', payload: { date: Date }): void;
}>();

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_PX = 48;
const hourRange = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const bodyEl = ref<HTMLElement | null>(null);

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);

const days = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(props.weekStart);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const iso = isoDay(date);
    const dayApts = props.appointments.filter(a => isoDay(appointmentStart(a)) === iso);
    return {
      date,
      iso,
      dowLabel: DOW[i],
      day: date.getDate(),
      isToday: date.getTime() === todayMid.getTime(),
      count: dayApts.length,
      pending: dayApts.filter(a => a.status === 'overdue').length,
      events: layoutEvents(dayApts),
    };
  });
});

type LaidOut = {
  appt: Appointment;
  top: number;
  height: number;
  left: string;
  width: string;
  timeLabel: string;
};
function layoutEvents(items: Appointment[]): LaidOut[] {
  const sorted = [...items].sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime());
  const clusters: Appointment[][] = [];
  let current: Appointment[] = [];
  let currentEnd = 0;
  for (const a of sorted) {
    const s = appointmentStart(a).getTime();
    const e = appointmentEnd(a).getTime();
    if (current.length === 0 || s < currentEnd) {
      current.push(a);
      currentEnd = Math.max(currentEnd, e);
    } else {
      clusters.push(current);
      current = [a];
      currentEnd = e;
    }
  }
  if (current.length) clusters.push(current);

  const out: LaidOut[] = [];
  for (const cluster of clusters) {
    const columns: Appointment[][] = [];
    for (const a of cluster) {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (appointmentEnd(last).getTime() <= appointmentStart(a).getTime()) {
          col.push(a);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([a]);
    }
    const nCols = columns.length;
    columns.forEach((col, colIdx) => {
      for (const a of col) {
        out.push(buildLaidOut(a, colIdx, nCols));
      }
    });
  }
  return out;
}

function buildLaidOut(a: Appointment, colIdx: number, nCols: number): LaidOut {
  const start = appointmentStart(a);
  const end = appointmentEnd(a);
  const startH = start.getHours() + start.getMinutes() / 60;
  const endH = end.getHours() + end.getMinutes() / 60;
  const top = (startH - HOUR_START) * SLOT_PX;
  const height = Math.max(18, (endH - startH) * SLOT_PX - 2);
  const widthPct = 100 / nCols;
  return {
    appt: a,
    top,
    height,
    left: `calc(${colIdx * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
    timeLabel: `${fmtTime(start)}–${fmtTime(end)}`,
  };
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const nowTick = ref(Date.now());
let tickHandle: number | null = null;
onMounted(() => {
  tickHandle = window.setInterval(() => { nowTick.value = Date.now(); }, 60_000);
  const now = new Date();
  const hour = Math.max(HOUR_START, Math.min(HOUR_END - 2, now.getHours() - 1));
  if (bodyEl.value) bodyEl.value.scrollTop = (hour - HOUR_START) * SLOT_PX;
});
onBeforeUnmount(() => { if (tickHandle) window.clearInterval(tickHandle); });

const nowOffset = computed(() => {
  void nowTick.value;
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < HOUR_START || h > HOUR_END) return null;
  return (h - HOUR_START) * SLOT_PX;
});

function onSlotClick(date: Date, hour: number, minute: number) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  emit('create-slot', { date: d });
}
</script>

<style scoped>
@import '@/components/automation/phase7/airtable.css';

.apt-week {
  display: grid; grid-template-rows: auto 1fr;
  height: 100%;
  background: var(--at-canvas);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Day header row */
.cal-head {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  border-bottom: 1px solid var(--at-hairline);
}
.cal-head .corner { border-right: 1px solid var(--at-hairline); }
.cal-head .dcol {
  padding: var(--at-s-sm) var(--at-s-xs);
  border-right: 1px solid var(--at-hairline);
  text-align: center;
  background: var(--at-canvas);
}
.cal-head .dcol .dow {
  font-size: 10.5px;
  text-transform: uppercase;
  color: var(--at-muted);
  font-weight: 500;
  letter-spacing: 0.08em;
}
.cal-head .dcol .date {
  font-size: 20px;
  font-weight: 400;
  color: var(--at-ink);
  line-height: 1;
  margin-top: 2px;
}
.cal-head .dcol.today .dow { color: var(--at-coral); }
.cal-head .dcol.today .date {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 32px; height: 32px;
  background: var(--at-ink);
  color: var(--at-on-primary);
  border-radius: var(--at-r-pill);
  font-size: 16px;
  font-weight: 500;
}
.cal-head .dcol .count {
  font-size: 10px;
  color: var(--at-muted);
  margin-top: 2px;
  font-weight: 500;
}

/* Body grid */
.cal-body {
  position: relative;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  background: var(--at-canvas);
}

/* Time column */
.timecol { border-right: 1px solid var(--at-hairline); }
.timecol .slot {
  height: 48px;
  border-bottom: 1px solid var(--at-hairline);
  font-size: 10.5px;
  color: var(--at-muted);
  padding: 2px 6px;
  text-align: right;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  box-sizing: border-box;
}

/* Day columns */
.daycol {
  border-right: 1px solid var(--at-hairline);
  position: relative;
}
.daycol .slot {
  height: 48px;
  border-bottom: 1px solid var(--at-hairline);
  cursor: pointer;
  position: relative;
}
.daycol .slot:active { background: var(--at-surface-soft); }
.daycol .slot .halfslot {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 50%;
  border-top: 1px dashed var(--at-hairline);
}
.daycol .slot .halfslot:active { background: rgba(170,45,0,0.04); }
.daycol.today { background: rgba(170,45,0,0.018); }

/* Event card — Airtable signature accents */
.event {
  position: absolute;
  border-radius: var(--at-r-sm);
  padding: 5px 8px;
  font-size: 11px;
  line-height: 1.3;
  cursor: pointer;
  overflow: hidden;
  border-left: 3px solid;
  background: var(--at-canvas);
  box-shadow: 0 1px 3px rgba(24,29,38,0.06);
  color: var(--at-ink);
}
.event:active { transform: translateY(1px); }
.event .ev-time {
  font-weight: 500;
  font-size: 10px;
  color: var(--at-muted);
  letter-spacing: 0.06em;
}
.event .ev-title {
  font-weight: 500;
  font-size: 11.5px;
  color: var(--at-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
.event .ev-meta {
  font-size: 10.5px;
  color: var(--at-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event.striped {
  background-image: repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(24,29,38,0.06) 6px, rgba(24,29,38,0.06) 12px) !important;
}
.event.state-completed { opacity: 0.55; }
.event.state-completed .ev-title { text-decoration: line-through; }
.event.state-cancelled {
  opacity: 0.5;
  background: var(--at-surface-soft) !important;
  border-left-color: var(--at-border-strong) !important;
}
.event.state-cancelled .ev-title { text-decoration: line-through; color: var(--at-muted); }

/* Now line — coral instead of red */
.nowline {
  position: absolute; left: 0; right: 0;
  height: 2px;
  background: var(--at-coral);
  z-index: 4;
  pointer-events: none;
}
.nowline::before {
  content: "";
  position: absolute;
  left: -5px; top: -5px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--at-coral);
}
</style>
