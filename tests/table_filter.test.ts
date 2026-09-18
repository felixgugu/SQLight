import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  type FilterRule,
  validateRegexPattern,
  isTableHiddenByRules,
  isDatabaseHiddenByRules,
  testFilterPatternByRules,
  testTablePatternByRules,
  DEFAULT_OBJECT_FILTER_PRESETS,
  DEFAULT_TABLE_FILTER_PRESETS,
} from '../src/utils/tableFilter';

describe('Table & Database Filter Utility', () => {
  test('DEFAULT_OBJECT_FILTER_PRESETS provides valid regex presets with targets', () => {
    assert.ok(DEFAULT_OBJECT_FILTER_PRESETS.length >= 7);
    for (const preset of DEFAULT_OBJECT_FILTER_PRESETS) {
      assert.ok(preset.label);
      assert.ok(preset.pattern);
      assert.ok(preset.description);
      assert.ok(['all', 'database', 'table'].includes(preset.target));
      const val = validateRegexPattern(preset.pattern);
      assert.equal(val.isValid, true, `Preset pattern ${preset.pattern} must be valid regex`);
    }
  });

  test('validateRegexPattern detects valid and invalid regex strings', () => {
    assert.equal(validateRegexPattern('^bak_').isValid, true);
    assert.equal(validateRegexPattern('_backup$').isValid, true);
    assert.equal(validateRegexPattern('.*').isValid, true);
    assert.equal(validateRegexPattern('^__EFMigrationsHistory$').isValid, true);
    assert.equal(validateRegexPattern('^(master|model|msdb|tempdb)$').isValid, true);

    // Empty strings
    assert.equal(validateRegexPattern('').isValid, false);
    assert.equal(validateRegexPattern('   ').isValid, false);

    // Invalid syntax
    assert.equal(validateRegexPattern('[').isValid, false);
    assert.equal(validateRegexPattern('(').isValid, false);
    assert.equal(validateRegexPattern('*foo').isValid, false);
  });

  test('isTableHiddenByRules returns false when no rules exist or are disabled', () => {
    const rules: FilterRule[] = [];
    assert.equal(isTableHiddenByRules(rules, 'bak_Users'), false);
    assert.equal(isTableHiddenByRules(rules, 'Orders', 'dbo'), false);

    const disabledRules: FilterRule[] = [
      { id: '1', pattern: '^bak_', target: 'table', enabled: false },
      { id: '2', pattern: '_old$', target: 'all', enabled: false },
    ];
    assert.equal(isTableHiddenByRules(disabledRules, 'bak_Users'), false);
    assert.equal(isTableHiddenByRules(disabledRules, 'Users_old'), false);
  });

  test('isTableHiddenByRules correctly matches prefix and suffix patterns (case-insensitive)', () => {
    const rules: FilterRule[] = [
      { id: '1', pattern: '^bak_', target: 'table', enabled: true },
      { id: '2', pattern: '(_backup|_old)$', target: 'all', enabled: true },
    ];

    assert.equal(isTableHiddenByRules(rules, 'bak_Users'), true);
    assert.equal(isTableHiddenByRules(rules, 'BAK_ORDERS'), true);
    assert.equal(isTableHiddenByRules(rules, 'Users_backup'), true);
    assert.equal(isTableHiddenByRules(rules, 'ORDERS_OLD'), true);
    assert.equal(isTableHiddenByRules(rules, 'Users_bak'), false);
    assert.equal(isTableHiddenByRules(rules, 'Orders'), false);
  });

  test('isTableHiddenByRules matches schema-qualified names as well as plain table names', () => {
    const rules: FilterRule[] = [
      { id: '1', pattern: '^audit\\..*', target: 'table', enabled: true },
      { id: '2', pattern: '^tmp_', target: 'table', enabled: true },
    ];

    assert.equal(isTableHiddenByRules(rules, 'Logins', 'audit'), true);
    assert.equal(isTableHiddenByRules(rules, 'Logins', 'dbo'), false);
    assert.equal(isTableHiddenByRules(rules, 'tmp_Calculations', 'dbo'), true);
    assert.equal(isTableHiddenByRules(rules, 'tmp_Calculations'), true);
    assert.equal(isTableHiddenByRules(rules, 'Calculations', 'dbo'), false);
  });

  test('isDatabaseHiddenByRules filters databases correctly and isolates scope', () => {
    const rules: FilterRule[] = [
      // Database-only rule
      { id: '1', pattern: '^(master|model|msdb|tempdb)$', target: 'database', enabled: true },
      // Table-only rule
      { id: '2', pattern: '^bak_', target: 'table', enabled: true },
      // All rule
      { id: '3', pattern: '.*_archive$', target: 'all', enabled: true },
    ];

    // Database matches
    assert.equal(isDatabaseHiddenByRules(rules, 'master'), true);
    assert.equal(isDatabaseHiddenByRules(rules, 'tempdb'), true);
    assert.equal(isDatabaseHiddenByRules(rules, 'TEMPDB'), true); // case-insensitive
    assert.equal(isDatabaseHiddenByRules(rules, 'crm_archive'), true);
    assert.equal(isDatabaseHiddenByRules(rules, 'AdventureWorks'), false);

    // Target isolation: database rule does NOT hide a table with the same name!
    assert.equal(isTableHiddenByRules(rules, 'master', 'dbo'), false);
    assert.equal(isTableHiddenByRules(rules, 'tempdb', 'dbo'), false);

    // Target isolation: table-only rule does NOT hide a database!
    assert.equal(isDatabaseHiddenByRules(rules, 'bak_SalesDB'), false);
    assert.equal(isTableHiddenByRules(rules, 'bak_SalesDB'), true);

    // Target all: hides both database and table
    assert.equal(isDatabaseHiddenByRules(rules, 'crm_archive'), true);
    assert.equal(isTableHiddenByRules(rules, 'orders_archive'), true);
  });

  test('isTableHiddenByRules and isDatabaseHiddenByRules handle malformed regex gracefully', () => {
    const rules: FilterRule[] = [
      { id: '1', pattern: '[unclosed', target: 'all', enabled: true },
      { id: '2', pattern: '^valid_target$', target: 'all', enabled: true },
    ];

    assert.equal(isTableHiddenByRules(rules, 'anything'), false);
    assert.equal(isTableHiddenByRules(rules, 'valid_target'), true);
    assert.equal(isDatabaseHiddenByRules(rules, 'anything'), false);
    assert.equal(isDatabaseHiddenByRules(rules, 'valid_target'), true);
  });

  test('testFilterPatternByRules returns target details for both database and table', () => {
    const rules: FilterRule[] = [
      { id: '1', pattern: '^sys_', target: 'database', enabled: true },
      { id: '2', pattern: '^tmp_', target: 'table', enabled: true },
    ];

    // Testing database
    const resDb = testFilterPatternByRules(rules, 'sys_catalog', 'database');
    assert.equal(resDb.isHidden, true);
    assert.equal(resDb.matchedPattern, '^sys_');
    assert.equal(resDb.matchedTarget, 'database');

    // sys_ is not a table rule
    const resDbAsTable = testFilterPatternByRules(rules, 'sys_catalog', 'table');
    assert.equal(resDbAsTable.isHidden, false);

    // Testing table
    const resTbl = testFilterPatternByRules(rules, 'tmp_users', 'table');
    assert.equal(resTbl.isHidden, true);
    assert.equal(resTbl.matchedPattern, '^tmp_');

    // tmp_ is not a database rule
    const resTblAsDb = testFilterPatternByRules(rules, 'tmp_users', 'database');
    assert.equal(resTblAsDb.isHidden, false);
  });

  test('updating a filter rule updates pattern, target, and matching behavior', () => {
    const rules: FilterRule[] = [
      { id: 'rule_1', pattern: '^old_pattern_', target: 'table', enabled: true, description: 'initial' },
    ];

    assert.equal(isTableHiddenByRules(rules, 'old_pattern_users'), true);
    assert.equal(isTableHiddenByRules(rules, 'new_pattern_users'), false);
    assert.equal(isDatabaseHiddenByRules(rules, 'old_pattern_db'), false);

    // Modify pattern to new_pattern_
    const rule = rules.find((r) => r.id === 'rule_1')!;
    rule.pattern = '^new_pattern_';
    assert.equal(isTableHiddenByRules(rules, 'old_pattern_users'), false);
    assert.equal(isTableHiddenByRules(rules, 'new_pattern_users'), true);

    // Modify target to database
    rule.target = 'database';
    assert.equal(isTableHiddenByRules(rules, 'new_pattern_users'), false);
    assert.equal(isDatabaseHiddenByRules(rules, 'new_pattern_db'), true);

    // Modify target to all
    rule.target = 'all';
    assert.equal(isTableHiddenByRules(rules, 'new_pattern_users'), true);
    assert.equal(isDatabaseHiddenByRules(rules, 'new_pattern_db'), true);
  });
});
