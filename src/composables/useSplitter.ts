import { ref, onUnmounted } from 'vue';

export interface UseSplitterOptions {
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  reverse?: boolean; // When true, dragging backwards increases the size (useful for bottom or right panels)
  onResize?: (newSize: number) => void;
}

export function useSplitter(options: UseSplitterOptions) {
  const {
    direction,
    initialSize,
    minSize = 50,
    maxSize = Infinity,
    reverse = false,
    onResize,
  } = options;

  const size = ref<number>(initialSize);
  const isDragging = ref<boolean>(false);

  let startPos = 0;
  let startSize = 0;

  function onPointerDown(event: PointerEvent) {
    // Only respond to primary mouse button
    if (event.button !== 0) return;

    isDragging.value = true;
    startPos = direction === 'horizontal' ? event.clientX : event.clientY;
    startSize = size.value;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging.value) return;

    const currentPos = direction === 'horizontal' ? event.clientX : event.clientY;
    const delta = reverse ? startPos - currentPos : currentPos - startPos;
    let newSize = startSize + delta;

    if (newSize < minSize) {
      newSize = minSize;
    } else if (newSize > maxSize) {
      newSize = maxSize;
    }

    size.value = Math.round(newSize);
    onResize?.(size.value);
  }

  function onPointerUp() {
    if (!isDragging.value) return;

    isDragging.value = false;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  });

  return {
    size,
    isDragging,
    onPointerDown,
  };
}
