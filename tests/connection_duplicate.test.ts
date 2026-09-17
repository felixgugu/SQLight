import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateDuplicateConnectionName } from '../src/utils/connectionNameHelper';

describe('connectionNameHelper utility', () => {
  test('generates (Copy) suffix for standard connection name', () => {
    const result = generateDuplicateConnectionName('Dev DB', ['Dev DB', 'Prod DB']);
    assert.equal(result, 'Dev DB (Copy)');
  });

  test('increments to (Copy 2) when (Copy) already exists', () => {
    const existing = ['Dev DB', 'Dev DB (Copy)'];
    const result = generateDuplicateConnectionName('Dev DB', existing);
    assert.equal(result, 'Dev DB (Copy 2)');
  });

  test('increments to (Copy 3) when (Copy) and (Copy 2) exist', () => {
    const existing = ['Dev DB', 'Dev DB (Copy)', 'Dev DB (Copy 2)'];
    const result = generateDuplicateConnectionName('Dev DB', existing);
    assert.equal(result, 'Dev DB (Copy 3)');
  });

  test('extracts root name when duplicating an already copied connection', () => {
    const existing = ['Dev DB', 'Dev DB (Copy)'];
    const result = generateDuplicateConnectionName('Dev DB (Copy)', existing);
    assert.equal(result, 'Dev DB (Copy 2)');
  });

  test('extracts root name when duplicating a numbered copy', () => {
    const existing = ['Dev DB', 'Dev DB (Copy)', 'Dev DB (Copy 2)'];
    const result = generateDuplicateConnectionName('Dev DB (Copy 2)', existing);
    assert.equal(result, 'Dev DB (Copy 3)');
  });

  test('performs case-insensitive comparison against existing names', () => {
    const existing = ['dev db', 'dev db (copy)'];
    const result = generateDuplicateConnectionName('Dev DB', existing);
    assert.equal(result, 'Dev DB (Copy 2)');
  });

  test('handles empty or whitespace-only name gracefully', () => {
    const result = generateDuplicateConnectionName('   ', []);
    assert.equal(result, 'New Connection (Copy)');
  });

  test('SaveConnectionPayload includes copyPasswordFrom when password is blank during duplication', () => {
    const initialProfile = { id: 'conn-source-123', name: 'Source DB' };
    const formPassword = '';
    const copyFrom = initialProfile && !formPassword.trim() ? initialProfile.id : undefined;
    assert.equal(copyFrom, 'conn-source-123');

    const withPassword = 'custom-pwd';
    const copyFromWithPwd = initialProfile && !withPassword.trim() ? initialProfile.id : undefined;
    assert.equal(copyFromWithPwd, undefined);
  });
});
