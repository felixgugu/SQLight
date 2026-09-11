<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs">
    <!-- Multiple Result Sets Tabs (if more than 1 result set) -->
    <div
      v-if="resultSets.length > 1"
      class="h-7 bg-dark-850 border-b border-dark-700 flex items-center px-2 space-x-1 flex-shrink-0"
    >
      <button
        v-for="(_, idx) in resultSets"
        :key="idx"
        @click="activeSetIndex = idx"
        :class="[
          'h-5 px-2 rounded text-xxs font-medium transition-colors',
          activeSetIndex === idx
            ? 'bg-dark-750 text-brand-300 font-semibold shadow-xs'
            : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
        ]"
      >
        Result Set #{{ idx + 1 }} ({{ resultSets[idx]?.rowCount ?? 0 }})
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-if="!currentSet || currentSet.rows.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-dark-500 space-y-1"
    >
      <Inbox class="w-6 h-6 stroke-1" />
      <span>No rows returned</span>
    </div>

    <!-- Table Grid Area -->
    <div v-else class="flex-1 overflow-auto relative">
      <table class="w-full text-left border-collapse font-mono text-xs select-text">
        <thead class="bg-dark-850 sticky top-0 z-10 border-b border-dark-700 text-dark-300 text-xxs uppercase tracking-wider select-none">
          <tr>
            <!-- Row Index Column Header -->
            <th class="p-2 w-12 text-center text-dark-500 border-r border-dark-750 bg-dark-850 sticky left-0 z-20">
              #
            </th>

            <!-- Data Column Headers with Resizing -->
            <th
              v-for="(col, colIdx) in currentSet.columns"
              :key="col.name + colIdx"
              :style="{ width: columnWidths[col.name] ? `${columnWidths[col.name]}px` : undefined }"
              class="p-2 border-r border-dark-750 font-semibold text-dark-200 relative group truncate max-w-[320px]"
            >
              <div class="flex items-center justify-between space-x-1">
                <span class="truncate">{{ col.name }}</span>
                <span class="text-dark-500 font-normal font-sans lowercase text-xxs flex-shrink-0">
                  {{ col.dataType }}
                </span>
              </div>

              <!-- Column Resizer Handle -->
              <div
                @pointerdown="startColResize($event, col.name)"
                class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-500/60 z-30"
              />
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-dark-800 text-dark-200">
          <tr
            v-for="(row, rIdx) in currentSet.rows"
            :key="rIdx"
            class="hover:bg-dark-800/60 transition-colors"
          >
            <!-- Row Index Number -->
            <td class="p-2 text-center text-dark-500 bg-dark-850/40 border-r border-dark-800 sticky left-0 font-mono text-xxs">
              {{ rIdx + 1 }}
            </td>

            <!-- Row Cells -->
            <td
              v-for="(cell, cIdx) in row"
              :key="cIdx"
              class="p-2 border-r border-dark-800 truncate max-w-[320px]"
            >
              <!-- NULL Value Display -->
              <span v-if="cell === null" class="italic text-dark-500 font-mono text-xxs">
                NULL
              </span>

              <!-- Binary Data Value Display -->
              <span
                v-else-if="typeof cell === 'object' && 'type' in cell && cell.type === 'binary'"
                class="bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded text-xxs font-sans font-medium border border-indigo-800/50"
              >
                [Binary {{ cell.length }} B]
              </span>

              <!-- Boolean Display -->
              <span
                v-else-if="typeof cell === 'boolean'"
                :class="cell ? 'text-emerald-400' : 'text-rose-400'"
                class="font-semibold text-xxs"
              >
                {{ cell ? 'TRUE' : 'FALSE' }}
              </span>

              <!-- Standard / Text / Number / Date Display -->
              <span v-else>{{ cell }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Inbox } from 'lucide-vue-next';
import type { ResultSet } from '@/types/query';

const props = defineProps<{
  resultSets: ResultSet[];
}>();

const activeSetIndex = ref(0);
const columnWidths = ref<Record<string, number>>({});

const currentSet = computed(() => {
  return props.resultSets[activeSetIndex.value] ?? props.resultSets[0] ?? null;
});

function startColResize(event: PointerEvent, colName: string) {
  event.preventDefault();
  event.stopPropagation();

  const startX = event.clientX;
  const currentWidth = columnWidths.value[colName] || 150;

  function onPointerMove(e: PointerEvent) {
    const delta = e.clientX - startX;
    columnWidths.value[colName] = Math.max(60, currentWidth + delta);
  }

  function onPointerUp() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
</script>
