import { ref, getCurrentInstance, onUnmounted } from 'vue';

export interface UseSplitterOptions {
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize?: number | (() => number);
  maxSize?: number | (() => number);
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

  function resolveBound(val: number | (() => number) | undefined, defaultVal: number): number {
    if (typeof val === 'function') return val();
    if (typeof val === 'number') return val;
    return defaultVal;
  }

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

    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);

      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging.value) return;

    const currentPos = direction === 'horizontal' ? event.clientX : event.clientY;
    const delta = reverse ? startPos - currentPos : currentPos - startPos;
    let newSize = startSize + delta;

    const currentMin = resolveBound(minSize, 50);
    const currentMax = resolveBound(maxSize, Infinity);

    if (newSize < currentMin) {
      newSize = currentMin;
    } else if (newSize > currentMax) {
      newSize = currentMax;
    }

    size.value = Math.round(newSize);
    onResize?.(size.value);
  }

  function onPointerUp() {
    if (!isDragging.value) return;

    isDragging.value = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  }

  function handleWindowResize() {
    if (typeof window === 'undefined') return;
    const currentMin = resolveBound(minSize, 50);
    const currentMax = resolveBound(maxSize, Infinity);

    if (size.value > currentMax) {
      size.value = Math.round(Math.max(currentMin, currentMax));
      onResize?.(size.value);
    } else if (size.value < currentMin) {
      size.value = Math.round(currentMin);
      onResize?.(size.value);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowResize);
      }
    });
  }

  return {
    size,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
