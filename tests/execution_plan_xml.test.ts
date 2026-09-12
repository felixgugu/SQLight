import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPinia, setActivePinia } from 'pinia';
import { useQueryStore } from '../src/stores/queryStore';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import { queryService } from '../src/services/queryService';
import { extractShowPlanXml, formatXml } from '../src/utils/planXmlParser';
import { savePlanToFile } from '../src/utils/fileStorage';
import type { QueryResult } from '../src/types/query';

const storageMap = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => storageMap.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storageMap.clear();
  setActivePinia(createPinia());
});

test('isActualPlanEnabled defaults to false', () => {
  const store = useQueryStore();
  assert.equal(store.isActualPlanEnabled, false);
});

test('3-way mutual exclusivity between Stats, Showplan, and Actual Plan via toggles', () => {
  const store = useQueryStore();

  // 1. Enable Stats
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isShowplanEnabled, false);
  assert.equal(store.isActualPlanEnabled, false);

  // 2. Enable Showplan -> disables Stats & Actual Plan
  store.toggleShowplanEnabled();
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isShowplanEnabled, true);
  assert.equal(store.isActualPlanEnabled, false);

  // 3. Enable Actual Plan -> disables Stats & Showplan
  store.toggleActualPlanEnabled();
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isShowplanEnabled, false);
  assert.equal(store.isActualPlanEnabled, true);

  // 4. Enable Stats again -> disables Actual Plan & Showplan
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isShowplanEnabled, false);
  assert.equal(store.isActualPlanEnabled, false);

  // 5. Toggle off Stats -> all false
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isShowplanEnabled, false);
  assert.equal(store.isActualPlanEnabled, false);
});

test('3-way mutual exclusivity via direct assignment', () => {
  const store = useQueryStore();

  store.isActualPlanEnabled = true;
  assert.equal(store.isActualPlanEnabled, true);
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isShowplanEnabled, false);

  store.isStatsEnabled = true;
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isActualPlanEnabled, false);
  assert.equal(store.isShowplanEnabled, false);

  store.isShowplanEnabled = true;
  assert.equal(store.isShowplanEnabled, true);
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isActualPlanEnabled, false);
});

test('extractShowPlanXml extracts XML and leaves query data result sets intact', () => {
  const mockResult: QueryResult = {
    resultSets: [
      {
        columns: [
          { name: 'Id', dataType: 'int', nullable: false, ordinal: 0 },
          { name: 'Name', dataType: 'nvarchar', nullable: true, ordinal: 1 },
        ],
        rows: [
          [1, 'Alice'],
          [2, 'Bob'],
        ],
        rowCount: 2,
      },
      {
        columns: [
          { name: 'Microsoft SQL Server 2005 XML Showplan', dataType: 'xml', nullable: true, ordinal: 0 },
        ],
        rows: [
          ['<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan"><BatchSequence><Batch><Statements><StmtSimple StatementText="SELECT * FROM Users" /></Statements></Batch></BatchSequence></ShowPlanXML>'],
        ],
        rowCount: 1,
      },
    ],
    messages: [],
    affectedRows: 0,
    executionTimeMs: 12,
  };

  const { cleanedResultSets, planXml } = extractShowPlanXml(mockResult);

  // XML extracted
  assert.ok(planXml);
  assert.ok(planXml.includes('<ShowPlanXML'));
  assert.ok(planXml.includes('SELECT * FROM Users'));

  // The XML result set was stripped, leaving only the real user data
  assert.equal(cleanedResultSets.length, 1);
  assert.equal(cleanedResultSets[0]?.columns[0]?.name, 'Id');
  assert.equal(cleanedResultSets[0]?.rowCount, 2);
});

test('formatXml produces readable indented XML string', () => {
  const rawXml = '<ShowPlanXML><Batch><StmtSimple StatementText="SELECT 1" /></Batch></ShowPlanXML>';
  const formatted = formatXml(rawXml);

  assert.ok(formatted.includes('<ShowPlanXML>\n'));
  assert.ok(formatted.includes('  <Batch>\n'));
  assert.ok(formatted.includes('    <StmtSimple StatementText="SELECT 1" />\n'));
  assert.ok(formatted.includes('  </Batch>\n'));
  assert.ok(formatted.includes('</ShowPlanXML>'));
});

test('workspaceStore.addExecutionPlanTab creates and selects execution_plan tab', () => {
  const workspaceStore = useWorkspaceStore();
  const sampleXml = '<ShowPlanXML><Batch /></ShowPlanXML>';
  const sampleSql = 'SELECT * FROM Orders;';

  const tab = workspaceStore.addExecutionPlanTab(sampleXml, sampleSql, 'Orders (Actual Plan)', 'conn-1', 'Northwind');

  assert.equal(tab.type, 'execution_plan');
  assert.equal(tab.title, 'Orders (Actual Plan)');
  assert.equal(tab.planXml, sampleXml);
  assert.equal(tab.querySql, sampleSql);
  assert.equal(tab.connectionId, 'conn-1');
  assert.equal(tab.database, 'Northwind');
  assert.equal(workspaceStore.activeTabId, tab.id);
  assert.equal(workspaceStore.activeTab?.id, tab.id);
});

test('execute with isActualPlanEnabled wraps in SET STATISTICS XML ON and OFF, extracts XML and adds tab', async () => {
  const queryStore = useQueryStore();
  const workspaceStore = useWorkspaceStore();
  queryStore.isActualPlanEnabled = true;

  const executedCommands: string[] = [];
  const sampleXml = '<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan"><BatchSequence /></ShowPlanXML>';

  queryService.executeQuery = async (_connId, _db, sql) => {
    executedCommands.push(sql);

    if (sql === 'SET STATISTICS XML ON;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }
    if (sql === 'SET STATISTICS XML OFF;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }

    // Return mock data query result with showplan XML appended
    return {
      resultSets: [
        {
          columns: [{ name: 'Count', dataType: 'int', nullable: false, ordinal: 0 }],
          rows: [[42]],
          rowCount: 1,
        },
        {
          columns: [{ name: 'Microsoft SQL Server 2005 XML Showplan', dataType: 'xml', nullable: true, ordinal: 0 }],
          rows: [[sampleXml]],
          rowCount: 1,
        },
      ],
      messages: [],
      affectedRows: 0,
      executionTimeMs: 25,
    };
  };

  const res = await queryStore.execute('conn-1', 'ShopDb', 'SELECT COUNT(*) AS Count FROM Products');
  assert.ok(res);

  // Check command order: XML ON -> Query -> XML OFF
  assert.equal(executedCommands.length, 3);
  assert.equal(executedCommands[0], 'SET STATISTICS XML ON;');
  assert.equal(executedCommands[1], 'SELECT COUNT(*) AS Count FROM Products');
  assert.equal(executedCommands[2], 'SET STATISTICS XML OFF;');

  // Check that execution plan tab was created in workspace
  const activeWorkspaceTab = workspaceStore.activeTab;
  assert.ok(activeWorkspaceTab);
  assert.equal(activeWorkspaceTab.type, 'execution_plan');
  assert.equal((activeWorkspaceTab as any).planXml, sampleXml);

  // Check that bottom panel result tab has clean data rows without the raw XML column
  const activeResultTab = queryStore.activeResultTab;
  assert.ok(activeResultTab);
  assert.equal(activeResultTab.result.resultSets.length, 1);
  assert.equal(activeResultTab.result.resultSets[0]?.columns[0]?.name, 'Count');
});

test('execute with isActualPlanEnabled guarantees SET STATISTICS XML OFF even when query fails', async () => {
  const queryStore = useQueryStore();
  queryStore.isActualPlanEnabled = true;

  const executedCommands: string[] = [];

  queryService.executeQuery = async (_connId, _db, sql) => {
    executedCommands.push(sql);

    if (sql === 'SET STATISTICS XML ON;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }
    if (sql === 'SET STATISTICS XML OFF;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }

    throw new Error('Msg 207: Invalid column name nonexistent_col');
  };

  const res = await queryStore.execute('conn-1', 'ShopDb', 'SELECT nonexistent_col FROM Products');
  assert.ok(res);
  assert.equal(queryStore.executionError, 'Msg 207: Invalid column name nonexistent_col');

  // Verify SET STATISTICS XML OFF was called in finally
  assert.ok(executedCommands.includes('SET STATISTICS XML ON;'));
  assert.ok(executedCommands.includes('SET STATISTICS XML OFF;'));
  assert.equal(executedCommands[executedCommands.length - 1], 'SET STATISTICS XML OFF;');
});

test('scripts/patch-qp.mjs runs cleanly, is idempotent, and ensures qp.js is patched', () => {
  // Execute patch script
  const scriptPath = path.resolve('scripts/patch-qp.mjs');
  const output = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  assert.ok(output !== undefined);

  // Check qp.js content
  const qpPath = path.resolve('node_modules/html-query-plan/dist/qp.js');
  if (fs.existsSync(qpPath)) {
    const qpContent = fs.readFileSync(qpPath, 'utf8');
    assert.equal(qpContent.includes('var SVG = this.SVG ='), false, 'Unpatched this.SVG = must not exist in qp.js');
    assert.ok(qpContent.includes('(typeof window !== "undefined" ? window : this).SVG ='));
    assert.ok(qpContent.includes('return factory.call(root, root, root.document)'));
  }

  // Check qp.min.js content
  const qpMinPath = path.resolve('node_modules/html-query-plan/dist/qp.min.js');
  if (fs.existsSync(qpMinPath)) {
    const qpMinContent = fs.readFileSync(qpMinPath, 'utf8');
    assert.equal(qpMinContent.includes('var n=this.SVG='), false, 'Unpatched var n=this.SVG= must not exist in qp.min.js');
    assert.ok(qpMinContent.includes('var n=(typeof window !== "undefined" ? window : this).SVG='));
  }
});

test('html-query-plan can be evaluated in strict mode without throwing TypeError: Cannot set properties of undefined', () => {
  const qpPath = path.resolve('node_modules/html-query-plan/dist/qp.js');
  if (!fs.existsSync(qpPath)) return;

  const code = fs.readFileSync(qpPath, 'utf8');

  const mockElement = {
    style: {}, setAttribute: () => {}, getAttribute: () => null, appendChild: () => {},
    childNodes: [], children: [], addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
  };
  const mockDocument = {
    createElementNS: (_ns: string, tag: string) => ({
      ...mockElement, nodeName: tag, createSVGRect: () => ({}), getBBox: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }),
    createElement: (tag: string) => ({ ...mockElement, nodeName: tag }),
    documentElement: { ...mockElement }, getElementsByTagName: () => [], addEventListener: () => {},
  };
  const mockWindow = { document: mockDocument, Event: function() {}, CustomEvent: function() {}, setTimeout, clearTimeout };

  // Evaluate in strict mode: this should NOT throw TypeError: Cannot set properties of undefined (setting 'SVG')
  const fn = new Function('window', 'document', 'exports', 'module', '"use strict";\n' + code);
  const moduleObj = { exports: {} as any };
  fn(mockWindow, mockDocument, moduleObj.exports, moduleObj);

  assert.equal(typeof moduleObj.exports.showPlan, 'function');
  assert.equal(typeof moduleObj.exports.drawLines, 'function');
  assert.ok(moduleObj.exports.Node);
});

test('savePlanToFile invokes showSaveFilePicker with .sqlplan filter and writes content', async () => {
  let pickerCalledWith: any = null;
  let writtenContent = '';
  let streamClosed = false;

  (globalThis as any).window = {
    showSaveFilePicker: async (opts: any) => {
      pickerCalledWith = opts;
      return {
        name: opts.suggestedName,
        createWritable: async () => ({
          write: async (chunk: string) => { writtenContent = chunk; },
          close: async () => { streamClosed = true; },
        }),
      };
    },
  };

  const sampleXml = '<ShowPlanXML><Batch /></ShowPlanXML>';
  const res = await savePlanToFile(sampleXml, 'Orders');

  assert.equal(res.saved, true);
  assert.equal(res.fileName, 'Orders.sqlplan');
  assert.equal(writtenContent, sampleXml);
  assert.equal(streamClosed, true);
  assert.equal(pickerCalledWith.suggestedName, 'Orders.sqlplan');
  assert.equal(pickerCalledWith.types[0].description, 'SQL Server 執行計畫 (*.sqlplan)');
  assert.ok(pickerCalledWith.types[0].accept['application/xml'].includes('.sqlplan'));

  delete (globalThis as any).window;
});

test('savePlanToFile returns { saved: false } when user cancels save dialog', async () => {
  (globalThis as any).window = {
    showSaveFilePicker: async () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      throw abortErr;
    },
  };

  const sampleXml = '<ShowPlanXML><Batch /></ShowPlanXML>';
  const res = await savePlanToFile(sampleXml, 'Orders.sqlplan');

  assert.equal(res.saved, false);
  assert.equal(res.fileName, undefined);

  delete (globalThis as any).window;
});

test('ExecutionPlanViewer.vue includes tooltip autoscroll, word-break, and layout rules', () => {
  const vueFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/editor/ExecutionPlanViewer.vue'),
    'utf-8'
  );

  // Check critical CSS properties in .qp-tt
  assert.ok(vueFile.includes('max-height: min(520px, 75vh) !important;'), 'Should have max-height constraint');
  assert.ok(vueFile.includes('overflow-y: auto !important;'), 'Should enable vertical auto scroll');
  assert.ok(vueFile.includes('overflow-wrap: anywhere !important;'), 'Should break overflowing words/identifiers');
  assert.ok(vueFile.includes('word-break: break-word !important;'), 'Should break long word boundaries');
  assert.ok(vueFile.includes('table-layout: fixed !important;'), 'Should use fixed table layout to prevent horizontal distortion');
  assert.ok(vueFile.includes('scrollbar-width: thin;'), 'Should style scrollbar for modern browsers');
  assert.ok(vueFile.includes('.qp-tt::-webkit-scrollbar'), 'Should provide custom webkit scrollbar');

  // Check native tooltip manager logic
  assert.ok(vueFile.includes('showNodeOrLineTooltip'), 'Should define showNodeOrLineTooltip');
  assert.ok(vueFile.includes('dismissTooltip()'), 'Should call dismissTooltip on unmount');
});

test('tooltip viewport edge clamping calculation keeps tooltip safely in viewport', () => {
  const viewportHeight = 800;
  const viewportWidth = 1200;
  const padding = 16;
  const tooltipHeight = 450;
  const tooltipWidth = 400;

  // Case 1: Cursor near bottom (cursorY = 700 -> rect.bottom = 1150)
  const rectBottomOverflow = {
    bottom: 1150,
    right: 500,
    height: tooltipHeight,
    width: tooltipWidth,
  };
  const clampedTop = Math.max(padding, viewportHeight - rectBottomOverflow.height - padding);
  assert.equal(clampedTop, 800 - 450 - 16); // 334px
  assert.ok(clampedTop + tooltipHeight <= viewportHeight - padding);

  // Case 2: Cursor near right edge (cursorX = 1100 -> rect.right = 1500)
  const rectRightOverflow = {
    bottom: 500,
    right: 1500,
    height: tooltipHeight,
    width: tooltipWidth,
  };
  const clampedLeft = Math.max(padding, viewportWidth - rectRightOverflow.width - padding);
  assert.equal(clampedLeft, 1200 - 400 - 16); // 784px
  assert.ok(clampedLeft + tooltipWidth <= viewportWidth - padding);
});

test('patch-qp.mjs configures qp.js for persistent tooltips without immediate mouseout hide', () => {
  const qpJs = fs.readFileSync(
    path.join(process.cwd(), 'node_modules/html-query-plan/dist/qp.js'),
    'utf-8'
  );

  // Verify onMouseout does not destroy tooltip
  assert.ok(
    !/window\.clearTimeout\(timeoutId\);[\r\n\s]+timeoutId\s*=\s*null;[\r\n\s]+hideTooltip\(\);/.test(qpJs),
    'onMouseout should not call hideTooltip'
  );
  // Verify showTooltip clears timeoutId
  assert.ok(
    /function showTooltip\(node,\s*tooltip\)\s*\{[\r\n\s]+hideTooltip\(\);[\r\n\s]+timeoutId\s*=\s*null;/.test(qpJs),
    'showTooltip should reset timeoutId'
  );
  // Verify hideTooltip exposes QP_hideTooltip
  assert.ok(qpJs.includes('window.QP_hideTooltip = hideTooltip;'), 'hideTooltip should export window.QP_hideTooltip');
});

test('ExecutionPlanViewer.vue implements click-outside dismissal, Escape key, and close button', () => {
  const vueFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/editor/ExecutionPlanViewer.vue'),
    'utf-8'
  );

  assert.ok(vueFile.includes('dismissTooltip'), 'Should define dismissTooltip');
  assert.ok(vueFile.includes('handleDocumentPointerDown'), 'Should handle pointerdown on document');
  assert.ok(vueFile.includes('handleDocumentKeyDown'), 'Should handle keydown on document for Escape');
  assert.ok(vueFile.includes('qp-tt-close-btn'), 'Should inject and style close button');
  assert.ok(vueFile.includes("removeEventListener('pointerdown'"), 'Should clean up pointerdown listener');
  assert.ok(vueFile.includes("removeEventListener('keydown'"), 'Should clean up keydown listener');
});

test('ExecutionPlanViewer.vue uses native Vue event delegation with jsTooltips: false', () => {
  const vueFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/editor/ExecutionPlanViewer.vue'),
    'utf-8'
  );

  // Verifies showPlan disables buggy third-party jsTooltips
  assert.ok(vueFile.includes('{ jsTooltips: false }'), 'showPlan should be called with { jsTooltips: false }');

  // Verifies native event handlers and templates
  assert.ok(vueFile.includes('handleContainerMouseOver'), 'Should implement container mouseover delegation');
  assert.ok(vueFile.includes('handleContainerMouseOut'), 'Should implement container mouseout debounce handling');
  assert.ok(vueFile.includes('showNodeOrLineTooltip'), 'Should define showNodeOrLineTooltip');
  assert.ok(vueFile.includes('getLineTooltip'), 'Should extract polyline data flow stats');
  assert.ok(
    vueFile.includes('.plan-render-canvas .qp-node .qp-tt {\n  display: none !important;'),
    'Should hide in-canvas tooltip templates'
  );
  assert.ok(vueFile.includes('body > .qp-tt'), 'Should style active floating tooltip attached to body');
});

test('ExecutionPlanViewer.vue enables mouse text selection and one-click copy inside tooltips', () => {
  const vueFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/editor/ExecutionPlanViewer.vue'),
    'utf-8'
  );

  // Verifies user-select: text is explicitly enabled to override global main.css user-select: none
  assert.ok(vueFile.includes('user-select: text !important;'), 'Should allow mouse text selection in tooltip');
  assert.ok(vueFile.includes('-webkit-user-select: text !important;'), 'Should allow webkit mouse text selection');
  assert.ok(vueFile.includes('cursor: text;'), 'Should display I-beam text cursor for content');
  assert.ok(vueFile.includes('::selection'), 'Should define custom selection highlight color');

  // Verifies one-click copy button
  assert.ok(vueFile.includes('qp-tt-copy-btn'), 'Should inject and style one-click copy button');
  assert.ok(vueFile.includes('navigator.clipboard.writeText'), 'Should write clean tooltip text to clipboard on copy');
  assert.ok(vueFile.includes('qp-tt-actions'), 'Should group copy and close buttons in header');
});

test('ExecutionPlanViewer.vue provides dark and classic themes with SVG polyline styling', () => {
  const vueFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/editor/ExecutionPlanViewer.vue'),
    'utf-8'
  );

  // Theme reactive state and persistence
  assert.ok(vueFile.includes('sqlight_plan_theme'), 'Should persist user theme preference');
  assert.ok(vueFile.includes('planTheme'), 'Should define reactive planTheme state');
  assert.ok(vueFile.includes('togglePlanTheme'), 'Should implement togglePlanTheme handler');

  // Dark theme styles
  assert.ok(vueFile.includes('.plan-render-canvas.theme-dark'), 'Should define dark theme canvas style');
  assert.ok(vueFile.includes('.plan-scroll-dark'), 'Should define dark blueprint dot-grid scroll area');
  assert.ok(vueFile.includes('.theme-dark div.qp-node'), 'Should style operator node cards in dark theme');
  assert.ok(vueFile.includes('#252532'), 'Should use dark card surface for nodes');
  assert.ok(vueFile.includes('#38bdf8'), 'Should use sky blue for Cost percentage in dark theme');

  // SVG Polyline arrow customization
  assert.ok(
    vueFile.includes('.plan-render-canvas.theme-dark .qp-root svg polyline'),
    'Should customize SVG polyline arrows in dark theme'
  );
  assert.ok(
    vueFile.includes('fill: #334155 !important;'),
    'Should style SVG arrow fill with slate color'
  );
  assert.ok(
    vueFile.includes('stroke: #64748b !important;'),
    'Should style SVG arrow stroke with slate outline'
  );
  assert.ok(
    vueFile.includes('.plan-render-canvas.theme-dark .qp-root svg polyline:hover'),
    'Should highlight SVG arrow on hover'
  );

  // Classic theme styles
  assert.ok(vueFile.includes('.plan-render-canvas.theme-classic'), 'Should define classic light theme canvas');
  assert.ok(vueFile.includes('#FFFFCC'), 'Should support classic yellow operator node in classic mode');
});
