import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  collapseAllTreeNodes,
  type ExplorerTreeState,
} from '../src/utils/explorerTreeState';

describe('explorerTreeState utility', () => {
  test('collapseAllTreeNodes: collapses all connections, databases, folders, and tables', () => {
    const state: ExplorerTreeState = {
      expandedConns: {
        'conn-1': true,
        'conn-2': true,
      },
      expandedDbs: {
        'conn-1:dbA': true,
        'conn-1:dbB': true,
        'conn-2:dbC': true,
      },
      expandedFolders: {
        'conn-1:dbA:tables': true,
        'conn-1:dbA:views': true,
        'conn-1:dbA:procs': true,
      },
      expandedTables: {
        'conn-1:dbA:dbo.Users': true,
        'conn-1:dbA:dbo.Orders': true,
        'conn-2:dbC:sales.Customers': true,
      },
    };

    collapseAllTreeNodes(state);

    // Verify connections collapsed
    assert.deepEqual(state.expandedConns, {
      'conn-1': false,
      'conn-2': false,
    });

    // Verify databases collapsed
    assert.deepEqual(state.expandedDbs, {
      'conn-1:dbA': false,
      'conn-1:dbB': false,
      'conn-2:dbC': false,
    });

    // Verify folders reset
    assert.deepEqual(state.expandedFolders, {});

    // Verify tables collapsed
    assert.deepEqual(state.expandedTables, {
      'conn-1:dbA:dbo.Users': false,
      'conn-1:dbA:dbo.Orders': false,
      'conn-2:dbC:sales.Customers': false,
    });
  });

  test('collapseAllTreeNodes: respects collapseConnections = false', () => {
    const state: ExplorerTreeState = {
      expandedConns: {
        'conn-1': true,
        'conn-2': true,
      },
      expandedDbs: {
        'conn-1:dbA': true,
      },
      expandedFolders: {
        'conn-1:dbA:views': true,
      },
      expandedTables: {
        'conn-1:dbA:dbo.Users': true,
      },
    };

    collapseAllTreeNodes(state, { collapseConnections: false });

    // Connections should remain true
    assert.equal(state.expandedConns['conn-1'], true);
    assert.equal(state.expandedConns['conn-2'], true);

    // Databases, folders, and tables should be collapsed
    assert.equal(state.expandedDbs['conn-1:dbA'], false);
    assert.deepEqual(state.expandedFolders, {});
    assert.equal(state.expandedTables['conn-1:dbA:dbo.Users'], false);
  });

  test('collapseAllTreeNodes: explicitly marks knownConnectionIds as false', () => {
    const state: ExplorerTreeState = {
      expandedConns: {
        'conn-1': true,
      },
      expandedDbs: {},
      expandedFolders: {},
      expandedTables: {},
    };

    collapseAllTreeNodes(state, {
      collapseConnections: true,
      knownConnectionIds: ['conn-1', 'conn-2', 'conn-3'],
    });

    assert.equal(state.expandedConns['conn-1'], false);
    assert.equal(state.expandedConns['conn-2'], false);
    assert.equal(state.expandedConns['conn-3'], false);
  });

  test('collapseAllTreeNodes: handles empty records gracefully', () => {
    const state: ExplorerTreeState = {
      expandedConns: {},
      expandedDbs: {},
      expandedFolders: {},
      expandedTables: {},
    };

    assert.doesNotThrow(() => {
      collapseAllTreeNodes(state);
    });

    assert.deepEqual(state.expandedConns, {});
    assert.deepEqual(state.expandedDbs, {});
    assert.deepEqual(state.expandedFolders, {});
    assert.deepEqual(state.expandedTables, {});
  });
});
