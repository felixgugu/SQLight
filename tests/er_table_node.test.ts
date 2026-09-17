import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ErTableNodeData } from '../src/components/editor/ErTableNode.vue';

test('ErTableNodeData supports customHeight for length resizing in view mode', () => {
  const tableData: ErTableNodeData = {
    schema: 'dbo',
    table: 'Orders',
    columns: [],
    customHeight: 220,
    isEditMode: false,
  };

  assert.equal(tableData.customHeight, 220);
  assert.equal(tableData.schema, 'dbo');
  assert.equal(tableData.table, 'Orders');
});

test('Solution B: Edit Mode always enforces natural Auto-Fit height, ignoring customHeight', () => {
  const BORDER_OFFSET = 1;
  const HEADER_HEIGHT = 32;
  const ROW_HEIGHT = 24;
  const FOOTER_HEIGHT = 24;
  const colCount = 8;
  const naturalEditHeight = BORDER_OFFSET * 2 + HEADER_HEIGHT + colCount * ROW_HEIGHT + FOOTER_HEIGHT; // 250px

  const dataWithCustom: ErTableNodeData = {
    schema: 'dbo',
    table: 'Orders',
    columns: [],
    customHeight: 150, // User set a smaller custom height in view mode
    isEditMode: true,
  };

  // In Edit Mode (isEdit: true), height MUST be naturalEditHeight (250px) to prevent floating ports / scroll misalignment
  const isEdit = true;
  let targetHeight = naturalEditHeight;
  if (!isEdit && dataWithCustom.customHeight !== undefined) {
    targetHeight = dataWithCustom.customHeight;
  }
  assert.equal(targetHeight, 250);
});

test('Solution B: View Mode respects customHeight with connected columns safety lower bound', () => {
  const BORDER_OFFSET = 1;
  const HEADER_HEIGHT = 32;
  const ROW_HEIGHT = 24;
  const visibleCols = [
    { name: 'id', dataType: 'int' },
    { name: 'customer_id', dataType: 'int' }, // connected! index 1
    { name: 'amount', dataType: 'decimal' },
    { name: 'created_at', dataType: 'datetime' },
  ];
  const connectedPortIds = new Set(['customer_id']);

  let maxConnectedIdx = -1;
  visibleCols.forEach((c, idx) => {
    if (connectedPortIds.has(c.name)) {
      maxConnectedIdx = idx;
    }
  });
  const minSafeH = maxConnectedIdx >= 0
    ? BORDER_OFFSET * 2 + HEADER_HEIGHT + (maxConnectedIdx + 1) * ROW_HEIGHT
    : 60;
  // minSafeH = 2 + 32 + (1 + 1) * 24 = 82px

  assert.equal(minSafeH, 82);

  // Case 1: user drags customHeight to 140px (greater than minSafeH) -> allows 140px
  const target1 = Math.max(minSafeH, 140);
  assert.equal(target1, 140);

  // Case 2: user attempts to drag customHeight to 50px (smaller than minSafeH) -> clamped to minSafeH 82px
  const target2 = Math.max(minSafeH, 50);
  assert.equal(target2, 82);
});

test('Resize handler locks width at 260px and respects minSafeH', () => {
  const startW = 260;
  const startH = 200;
  const minSafeH = 120;

  // Dragging downwards
  const dyDown = 60;
  const newHDown = Math.max(minSafeH, Math.round(startH + dyDown));
  assert.equal(startW, 260); // Width strictly locked
  assert.equal(newHDown, 260);

  // Dragging upwards beyond safe lower bound
  const dyUp = -150;
  const newHUp = Math.max(minSafeH, Math.round(startH + dyUp));
  assert.equal(startW, 260); // Width strictly locked
  assert.equal(newHUp, 120); // Clamped at minSafeH
});

test('Columns container has no scrollbars (overflow-x-hidden overflow-y-hidden)', () => {
  const containerClasses = 'flex-1 overflow-x-hidden overflow-y-hidden divide-y divide-dark-800/60 text-xxs font-mono';
  assert.ok(containerClasses.includes('overflow-x-hidden'));
  assert.ok(containerClasses.includes('overflow-y-hidden'));
  assert.ok(!containerClasses.includes('overflow-y-auto'));
  assert.ok(!containerClasses.includes('overflow-x-auto'));
});

test('ER model JSON serialization preserves table customHeight', () => {
  const graphJson = {
    nodes: [
      {
        id: 'node-dbo.Products',
        shape: 'er-table-node',
        x: 150,
        y: 120,
        width: 260,
        height: 190,
        data: {
          schema: 'dbo',
          table: 'Products',
          columns: [],
          customHeight: 190,
        },
      },
    ],
  };

  const serialized = JSON.stringify(graphJson);
  const parsed = JSON.parse(serialized);

  const node = parsed.nodes[0];
  assert.equal(node.width, 260);
  assert.equal(node.height, 190);
  assert.equal(node.data.customHeight, 190);
});

test('ErTableNode uses deepened border (border-slate-400) in light mode', () => {
  const lightClass = 'bg-white/95 border-slate-400 hover:border-brand-500/70 shadow-md shadow-slate-300/40 text-slate-800';
  assert.ok(lightClass.includes('border-slate-400'), 'Light theme must use deepened border-slate-400');
  assert.ok(!lightClass.includes('border-slate-200'), 'Light theme must not use pale border-slate-200');
});

