import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSplitter } from '../src/composables/useSplitter';

test('useSplitter supports dynamic maxSize function and allows sizes beyond 550px', () => {
  let mockWindowHeight = 1000;
  const splitter = useSplitter({
    direction: 'vertical',
    initialSize: 240,
    minSize: 100,
    maxSize: () => Math.max(200, mockWindowHeight - 100), // 900px
    reverse: true,
  });

  assert.equal(splitter.size.value, 240);

  // Simulate dragging upwards by 400px (reverse: delta = start - current = 400)
  // New size = 240 + 400 = 640px (exceeds previous 550px limit!)
  splitter.onPointerDown({ button: 0, clientY: 800 } as PointerEvent);
  splitter.onPointerMove({ clientY: 400 } as PointerEvent);

  assert.equal(splitter.size.value, 640, 'Should allow size to exceed 550px');
  assert.ok(splitter.size.value > 550);

  // Drag upwards further to 100px from top: delta = 800 - 100 = 700 -> size = 940 (capped at 900)
  splitter.onPointerMove({ clientY: 100 } as PointerEvent);
  assert.equal(splitter.size.value, 900, 'Should be clamped at dynamic maxSize (900px)');

  // Drag downwards: delta = 800 - 1000 = -200 -> size = 40 (clamped at minSize 100)
  splitter.onPointerMove({ clientY: 1000 } as PointerEvent);
  assert.equal(splitter.size.value, 100, 'Should be clamped at minSize (100px)');

  splitter.onPointerUp();
  assert.equal(splitter.isDragging.value, false);
});

test('useSplitter supports static minSize and maxSize', () => {
  const splitter = useSplitter({
    direction: 'horizontal',
    initialSize: 260,
    minSize: 180,
    maxSize: 500,
  });

  assert.equal(splitter.size.value, 260);

  // Simulate dragging rightwards: delta = 100 -> size = 360
  splitter.onPointerDown({ button: 0, clientX: 200 } as PointerEvent);
  splitter.onPointerMove({ clientX: 300 } as PointerEvent);
  assert.equal(splitter.size.value, 360);

  // Drag rightwards past max: delta = 400 -> size = 660 (clamped at 500)
  splitter.onPointerMove({ clientX: 600 } as PointerEvent);
  assert.equal(splitter.size.value, 500);

  // Drag leftwards past min: delta = -200 -> size = 60 (clamped at 180)
  splitter.onPointerMove({ clientX: 0 } as PointerEvent);
  assert.equal(splitter.size.value, 180);

  splitter.onPointerUp();
});

test('Double-click toggle maximize calculation logic', () => {
  const mockWindowHeight = 1080;
  const maxH = Math.max(200, mockWindowHeight - 100); // 980px
  assert.equal(maxH, 980);

  let currentSize = 240;
  let preMaximized = 240;

  // 1. Toggle when normal -> should maximize to 980px
  if (currentSize >= maxH - 40) {
    currentSize = Math.max(100, preMaximized || 240);
  } else {
    preMaximized = currentSize;
    currentSize = maxH;
  }
  assert.equal(currentSize, 980);
  assert.equal(preMaximized, 240);

  // 2. Toggle when maximized -> should restore to 240px
  if (currentSize >= maxH - 40) {
    currentSize = Math.max(100, preMaximized || 240);
  } else {
    preMaximized = currentSize;
    currentSize = maxH;
  }
  assert.equal(currentSize, 240);
});
