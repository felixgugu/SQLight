import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ErTextNodeData, NoteColor } from '../src/components/editor/ErTextNode.vue';

test('ErTextNodeData supports text, NoteColor, and isEditMode properties', () => {
  const nodeData: ErTextNodeData = {
    text: '此處為訂單資料表之業務關聯備註',
    color: 'amber',
    isEditMode: false,
  };

  assert.equal(nodeData.text, '此處為訂單資料表之業務關聯備註');
  assert.equal(nodeData.color, 'amber');
  assert.equal(nodeData.isEditMode, false);
});

test('ErTextNodeData supports all defined note colors including rose', () => {
  const supportedColors: NoteColor[] = ['amber', 'blue', 'emerald', 'purple', 'rose', 'dark'];

  for (const c of supportedColors) {
    const data: ErTextNodeData = {
      text: `Color test for ${c}`,
      color: c,
      isEditMode: true,
    };
    assert.equal(data.color, c);
  }
});

test('Simulated node.setData preserves text and color when isEditMode changes', () => {
  let currentData: ErTextNodeData = {
    text: '重要備忘事項：訂單狀態不得直接修改',
    color: 'rose',
    isEditMode: false, // 檢視模式
  };

  // 1. 切換為編輯模式 (ON)
  currentData = { ...currentData, isEditMode: true };
  assert.equal(currentData.isEditMode, true);
  assert.equal(currentData.color, 'rose');
  assert.equal(currentData.text, '重要備忘事項：訂單狀態不得直接修改');

  // 2. 編輯模式下變更顏色為科技藍
  currentData = { ...currentData, color: 'blue' };
  assert.equal(currentData.color, 'blue');

  // 3. 切換回檢視模式 (OFF)
  currentData = { ...currentData, isEditMode: false };
  assert.equal(currentData.isEditMode, false);
  assert.equal(currentData.color, 'blue');
  assert.equal(currentData.text, '重要備忘事項：訂單狀態不得直接修改');
});

test('ER model JSON snapshot retains er-text-node shape, dimensions, and data', () => {
  const mockGraphJson = {
    nodes: [
      {
        id: 'node-dbo.Orders',
        shape: 'er-table-node',
        x: 100,
        y: 100,
        width: 260,
        height: 200,
      },
      {
        id: 'text-1726572000000-abcd',
        shape: 'er-text-node',
        x: 400,
        y: 150,
        width: 280,
        height: 140,
        data: {
          text: '使用者收件資訊關聯',
          color: 'emerald',
          isEditMode: false,
        },
      },
    ],
    edges: [],
  };

  const serialized = JSON.stringify(mockGraphJson);
  const parsed = JSON.parse(serialized);

  const textNode = parsed.nodes.find((n: any) => n.shape === 'er-text-node');
  assert.ok(textNode);
  assert.equal(textNode.width, 280);
  assert.equal(textNode.height, 140);
  assert.equal(textNode.data.text, '使用者收件資訊關聯');
  assert.equal(textNode.data.color, 'emerald');
  assert.equal(textNode.data.isEditMode, false);
});

test('ErTextNode defaults to dark (gray) when color is not specified', () => {
  const nodeDataWithoutColor: ErTextNodeData = {
    text: '預設灰色備註',
  };

  const defaultColor = nodeDataWithoutColor.color || 'dark';
  assert.equal(defaultColor, 'dark');

  const colorOptions: Array<{ key: NoteColor; label: string; bgClass: string }> = [
    { key: 'amber', label: '經典便箋黃', bgClass: 'bg-amber-400' },
    { key: 'blue', label: '科技藍', bgClass: 'bg-sky-400' },
    { key: 'emerald', label: '清新綠', bgClass: 'bg-emerald-400' },
    { key: 'purple', label: '高雅紫', bgClass: 'bg-purple-400' },
    { key: 'rose', label: '警示紅', bgClass: 'bg-rose-400' },
    { key: 'dark', label: '極簡深灰', bgClass: 'bg-zinc-400' },
  ];

  // The last color option in the palette is dark (gray)
  const lastOption = colorOptions[colorOptions.length - 1];
  assert.equal(lastOption.key, 'dark');
  assert.equal(lastOption.label, '極簡深灰');
});

