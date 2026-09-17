<template>
  <div
    class="w-full h-full rounded-lg shadow-xl border overflow-hidden flex flex-col font-sans transition-all relative select-none group"
    :class="[
      themeClasses.container,
      isSelected ? 'ring-2 ring-brand-400 shadow-brand-500/20' : ''
    ]"
  >
    <!-- Card Header (Drag Handle) -->
    <div
      class="h-7 px-2 flex items-center justify-between flex-shrink-0 cursor-move border-b select-none"
      :class="themeClasses.header"
    >
      <!-- Left: Icon & Color Palette -->
      <div class="flex items-center space-x-1.5">
        <Type class="w-3 h-3 flex-shrink-0 opacity-80" />
        <div class="flex items-center space-x-1 ml-1" @mousedown.stop @click.stop>
          <button
            v-for="colorOption in colorOptions"
            :key="colorOption.key"
            type="button"
            @click="setColor(colorOption.key)"
            class="w-2.5 h-2.5 rounded-full transition-transform hover:scale-125 cursor-pointer"
            :class="[
              colorOption.bgClass,
              nodeData.color === colorOption.key ? 'ring-1 ring-white scale-110' : 'opacity-70 hover:opacity-100'
            ]"
            :title="`切換為 ${colorOption.label}`"
          />
        </div>
      </div>

      <!-- Right: Actions (Delete) -->
      <div class="flex items-center space-x-1" @mousedown.stop @click.stop>
        <button
          type="button"
          @click="removeNode"
          class="p-0.5 rounded hover:bg-black/20 text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          title="刪除此文字備註"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Card Body: Editable Textarea -->
    <div class="flex-1 w-full relative overflow-hidden p-2 flex flex-col">
      <textarea
        ref="textareaRef"
        v-model="textContent"
        @input="handleTextInput"
        @mousedown.stop
        @click.stop
        @keydown.stop
        class="w-full flex-1 bg-transparent resize-none outline-none border-none text-xs font-sans leading-relaxed break-words"
        :class="themeClasses.textarea"
        placeholder="點擊輸入文字備註或說明..."
      ></textarea>
    </div>

    <!-- Drag Resize Grip Handle (Bottom-Right) -->
    <div
      @mousedown.stop="startResize"
      class="absolute bottom-0 right-0 w-3.5 h-3.5 flex items-center justify-center cursor-se-resize select-none opacity-40 hover:opacity-100 text-current z-10 transition-opacity"
      title="拖曳以縮放大小"
    >
      <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
        <circle cx="8" cy="8" r="1" />
        <circle cx="5" cy="8" r="1" />
        <circle cx="8" cy="5" r="1" />
        <circle cx="2" cy="8" r="1" />
        <circle cx="5" cy="5" r="1" />
        <circle cx="8" cy="2" r="1" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue';
import { Type, X } from 'lucide-vue-next';
import type { Node } from '@antv/x6';

export type NoteColor = 'amber' | 'blue' | 'emerald' | 'purple' | 'dark';

export interface ErTextNodeData {
  text: string;
  color?: NoteColor;
}

const getNode = inject<() => Node>('getNode');
const node = getNode ? getNode() : null;

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const textContent = ref('');
const isSelected = ref(false);

const nodeData = ref<ErTextNodeData>({
  text: '',
  color: 'amber',
});

const colorOptions: Array<{ key: NoteColor; label: string; bgClass: string }> = [
  { key: 'amber', label: '經典便箋黃', bgClass: 'bg-amber-400' },
  { key: 'blue', label: '科技藍', bgClass: 'bg-sky-400' },
  { key: 'emerald', label: '清新綠', bgClass: 'bg-emerald-400' },
  { key: 'purple', label: '高雅紫', bgClass: 'bg-purple-400' },
  { key: 'dark', label: '極簡深灰', bgClass: 'bg-zinc-400' },
];

const themeClasses = computed(() => {
  const c = nodeData.value.color || 'amber';
  switch (c) {
    case 'blue':
      return {
        container: 'bg-sky-950/40 border-sky-500/50 hover:border-sky-400 text-sky-100 shadow-sky-950/40 backdrop-blur-md',
        header: 'bg-sky-900/40 border-sky-500/30 text-sky-200',
        textarea: 'text-sky-100 placeholder:text-sky-300/40',
      };
    case 'emerald':
      return {
        container: 'bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400 text-emerald-100 shadow-emerald-950/40 backdrop-blur-md',
        header: 'bg-emerald-900/40 border-emerald-500/30 text-emerald-200',
        textarea: 'text-emerald-100 placeholder:text-emerald-300/40',
      };
    case 'purple':
      return {
        container: 'bg-purple-950/40 border-purple-500/50 hover:border-purple-400 text-purple-100 shadow-purple-950/40 backdrop-blur-md',
        header: 'bg-purple-900/40 border-purple-500/30 text-purple-200',
        textarea: 'text-purple-100 placeholder:text-purple-300/40',
      };
    case 'dark':
      return {
        container: 'bg-dark-850/95 border-dark-700 hover:border-dark-600 text-dark-100 shadow-dark-950/60 backdrop-blur-md',
        header: 'bg-dark-800 border-dark-700/80 text-dark-300',
        textarea: 'text-dark-100 placeholder:text-dark-500',
      };
    case 'amber':
    default:
      return {
        container: 'bg-amber-950/40 border-amber-500/50 hover:border-amber-400 text-amber-100 shadow-amber-950/40 backdrop-blur-md',
        header: 'bg-amber-900/40 border-amber-500/30 text-amber-200',
        textarea: 'text-amber-100 placeholder:text-amber-300/40',
      };
  }
});

function handleTextInput() {
  if (!node) return;
  const current = node.getData<ErTextNodeData>() || {};
  node.setData({ ...current, text: textContent.value }, { overwrite: true });
}

function setColor(color: NoteColor) {
  if (!node) return;
  nodeData.value.color = color;
  const current = node.getData<ErTextNodeData>() || {};
  node.setData({ ...current, color }, { overwrite: true });
}

function removeNode() {
  if (node) {
    node.remove();
  }
}

function startResize(e: MouseEvent) {
  if (!node) return;
  e.preventDefault();
  e.stopPropagation();

  const graph = node.model?.graph;
  const zoom = graph ? graph.zoom() : 1;
  const startX = e.clientX;
  const startY = e.clientY;
  const currentSize = node.size();
  const startW = currentSize.width;
  const startH = currentSize.height;

  function onMouseMove(moveEvent: MouseEvent) {
    const dx = (moveEvent.clientX - startX) / zoom;
    const dy = (moveEvent.clientY - startY) / zoom;
    const newW = Math.max(140, Math.round(startW + dx));
    const newH = Math.max(70, Math.round(startH + dy));
    node?.setSize({ width: newW, height: newH });
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

onMounted(() => {
  if (node) {
    const d = node.getData<ErTextNodeData>();
    if (d) {
      nodeData.value = {
        text: d.text || '',
        color: d.color || 'amber',
      };
      textContent.value = d.text || '';
    }

    node.on('change:data', ({ current }) => {
      if (current) {
        nodeData.value = {
          text: current.text || '',
          color: current.color || 'amber',
        };
        textContent.value = current.text || '';
      }
    });

    const graph = node.model?.graph;
    if (graph) {
      graph.on('cell:selected', ({ cell }) => {
        if (cell === node) isSelected.value = true;
      });
      graph.on('cell:unselected', ({ cell }) => {
        if (cell === node) isSelected.value = false;
      });
    }
  }
});
</script>
