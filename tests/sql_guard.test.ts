import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectDangerousSqlStatements, stripCommentsAndLiterals } from '../src/utils/sqlGuard';

describe('sqlGuard utility', () => {
  test('safe queries are not flagged as dangerous', () => {
    const safeQueries = [
      'SELECT * FROM Users',
      'SELECT id, name FROM [Orders] WHERE status = 1',
      'EXEC sp_who2',
      'PRINT 1',
    ];

    for (const sql of safeQueries) {
      const res = detectDangerousSqlStatements(sql);
      assert.equal(res.isDangerous, false, `Expected false for: ${sql}`);
      assert.deepEqual(res.detectedKeywords, []);
    }
  });

  test('keywords inside single-quoted strings are not flagged', () => {
    const queriesWithStrings = [
      "SELECT 'UPDATE' AS col",
      "SELECT * FROM Logs WHERE message = 'DROP TABLE Customers'",
      "SELECT 'INSERT INTO foo VALUES (1)' AS sql_text",
      "SELECT 'truncate table audits' FROM tbl",
    ];

    for (const sql of queriesWithStrings) {
      const res = detectDangerousSqlStatements(sql);
      assert.equal(res.isDangerous, false, `Should ignore strings in: ${sql}`);
      assert.deepEqual(res.detectedKeywords, []);
    }
  });

  test('keywords inside line and block comments are not flagged', () => {
    const queriesWithComments = [
      "-- UPDATE Users SET active = 0\nSELECT * FROM Users",
      "/* DROP TABLE Test */ SELECT 1",
      "/* multi\n * line\n * TRUNCATE\n */ SELECT 1",
      "SELECT 1 /* nested /* DELETE FROM Users */ comment */",
    ];

    for (const sql of queriesWithComments) {
      const res = detectDangerousSqlStatements(sql);
      assert.equal(res.isDangerous, false, `Should ignore comments in: ${sql}`);
      assert.deepEqual(res.detectedKeywords, []);
    }
  });

  test('keywords used as bracketed identifiers or column names are not flagged', () => {
    const queriesWithBracketedIdentifiers = [
      'SELECT [UPDATE] FROM Config',
      'SELECT [DROP], [ALTER] FROM Status',
      'SELECT 1 AS [CREATE]',
    ];

    for (const sql of queriesWithBracketedIdentifiers) {
      const res = detectDangerousSqlStatements(sql);
      assert.equal(res.isDangerous, false, `Should ignore bracketed identifiers in: ${sql}`);
    }
  });

  test('detects single dangerous statement properly', () => {
    const cases: Array<{ sql: string; expected: string[] }> = [
      { sql: 'UPDATE Users SET Active = 1 WHERE Id = 5', expected: ['UPDATE'] },
      { sql: 'insert into Orders (id) values (10)', expected: ['INSERT'] },
      { sql: 'DELETE FROM Sessions WHERE expired = 1', expected: ['DELETE'] },
      { sql: 'ALTER TABLE Users ADD Nickname nvarchar(50)', expected: ['ALTER'] },
      { sql: 'create table #Temp (id int)', expected: ['CREATE'] },
      { sql: 'drop table OldLogs', expected: ['DROP'] },
      { sql: 'truncate table StagingTable', expected: ['TRUNCATE'] },
    ];

    for (const c of cases) {
      const res = detectDangerousSqlStatements(c.sql);
      assert.equal(res.isDangerous, true, `Expected dangerous for: ${c.sql}`);
      assert.deepEqual(res.detectedKeywords, c.expected);
    }
  });

  test('detects multiple dangerous keywords in complex batches', () => {
    const batch = `
      SELECT * FROM Users;
      UPDATE Users SET balance = 0;
      DROP TABLE Staging;
    `;
    const res = detectDangerousSqlStatements(batch);
    assert.equal(res.isDangerous, true);
    assert.ok(res.detectedKeywords.includes('UPDATE'));
    assert.ok(res.detectedKeywords.includes('DROP'));
  });

  test('handles empty or whitespace SQL safely', () => {
    assert.equal(detectDangerousSqlStatements('').isDangerous, false);
    assert.equal(detectDangerousSqlStatements('   \n  \t ').isDangerous, false);
  });
});
