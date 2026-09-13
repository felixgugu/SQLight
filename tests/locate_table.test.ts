import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIdentifierSegments,
  segmentsToIdentifier,
  extractTableIdentifierAtCursor,
} from '../src/utils/sqlIdentifierExtractor';

describe('sqlIdentifierExtractor', () => {
  test('parseIdentifierSegments: parses unbracketed single identifier', () => {
    assert.deepEqual(parseIdentifierSegments('Orders'), ['Orders']);
  });

  test('parseIdentifierSegments: parses bracketed single identifier', () => {
    assert.deepEqual(parseIdentifierSegments('[Orders]'), ['Orders']);
  });

  test('parseIdentifierSegments: parses schema and table with brackets', () => {
    assert.deepEqual(parseIdentifierSegments('[dbo].[Orders]'), ['dbo', 'Orders']);
  });

  test('parseIdentifierSegments: parses schema and table without brackets', () => {
    assert.deepEqual(parseIdentifierSegments('dbo.Orders'), ['dbo', 'Orders']);
  });

  test('parseIdentifierSegments: parses bracketed identifiers with spaces', () => {
    assert.deepEqual(parseIdentifierSegments('[Sales].[Order Details]'), ['Sales', 'Order Details']);
  });

  test('parseIdentifierSegments: parses three-part identifiers [db].[schema].[table]', () => {
    assert.deepEqual(parseIdentifierSegments('[Northwind].[dbo].[Customers]'), ['Northwind', 'dbo', 'Customers']);
  });

  test('parseIdentifierSegments: returns empty array for empty string', () => {
    assert.deepEqual(parseIdentifierSegments(''), []);
  });

  test('segmentsToIdentifier: returns null for SQL reserved keywords', () => {
    assert.equal(segmentsToIdentifier(['SELECT']), null);
    assert.equal(segmentsToIdentifier(['FROM']), null);
    assert.equal(segmentsToIdentifier(['WHERE']), null);
    assert.equal(segmentsToIdentifier(['JOIN']), null);
  });

  test('segmentsToIdentifier: returns table for non-reserved single token', () => {
    assert.deepEqual(segmentsToIdentifier(['Orders']), { table: 'Orders' });
    assert.deepEqual(segmentsToIdentifier(['Users']), { table: 'Users' });
  });

  test('segmentsToIdentifier: returns schema and table for two segments', () => {
    assert.deepEqual(segmentsToIdentifier(['dbo', 'Orders']), { schema: 'dbo', table: 'Orders' });
    assert.deepEqual(segmentsToIdentifier(['sales', 'Customers']), { schema: 'sales', table: 'Customers' });
  });

  test('segmentsToIdentifier: returns database, schema, and table for three segments', () => {
    assert.deepEqual(segmentsToIdentifier(['AdventureWorks', 'dbo', 'Products']), {
      database: 'AdventureWorks',
      schema: 'dbo',
      table: 'Products',
    });
  });

  test('extractTableIdentifierAtCursor: prioritizes selection when provided', () => {
    const result = extractTableIdentifierAtCursor('SELECT * FROM Orders', 1, 'dbo.Orders');
    assert.deepEqual(result, { schema: 'dbo', table: 'Orders' });
  });

  test('extractTableIdentifierAtCursor: strips single and double quotes from selection', () => {
    assert.deepEqual(extractTableIdentifierAtCursor('', 1, "'Customers'"), { table: 'Customers' });
    assert.deepEqual(extractTableIdentifierAtCursor('', 1, '"Customers"'), { table: 'Customers' });
  });

  test('extractTableIdentifierAtCursor: extracts table when cursor is on unbracketed table name', () => {
    const line = 'SELECT * FROM Orders WHERE id = 1';
    const col = line.indexOf('Orders') + 2; // on 'r'
    const result = extractTableIdentifierAtCursor(line, col);
    assert.deepEqual(result, { table: 'Orders' });
  });

  test('extractTableIdentifierAtCursor: extracts schema and table when cursor is on [dbo].[Orders]', () => {
    const line = 'SELECT * FROM [dbo].[Orders] WHERE Id = 10';
    const col = line.indexOf('Orders') + 1;
    const result = extractTableIdentifierAtCursor(line, col);
    assert.deepEqual(result, { schema: 'dbo', table: 'Orders' });
  });

  test('extractTableIdentifierAtCursor: extracts schema and table when cursor is on schema part of dbo.Orders', () => {
    const line = 'SELECT * FROM dbo.Orders';
    const col = line.indexOf('dbo') + 1;
    const result = extractTableIdentifierAtCursor(line, col);
    assert.deepEqual(result, { schema: 'dbo', table: 'Orders' });
  });

  test('extractTableIdentifierAtCursor: extracts table with spaces in brackets: [Sales].[Order Details]', () => {
    const line = 'SELECT * FROM [Sales].[Order Details] o';
    const col = line.indexOf('Order Details') + 3;
    const result = extractTableIdentifierAtCursor(line, col);
    assert.deepEqual(result, { schema: 'Sales', table: 'Order Details' });
  });

  test('extractTableIdentifierAtCursor: returns null when cursor is on SQL keyword FROM or SELECT', () => {
    const line = 'SELECT * FROM Orders';
    const colSelect = line.indexOf('SELECT') + 2;
    assert.equal(extractTableIdentifierAtCursor(line, colSelect), null);

    const colFrom = line.indexOf('FROM') + 2;
    assert.equal(extractTableIdentifierAtCursor(line, colFrom), null);
  });

  test('extractTableIdentifierAtCursor: returns null for empty line or no identifier match', () => {
    assert.equal(extractTableIdentifierAtCursor('', 1), null);
    assert.equal(extractTableIdentifierAtCursor('   ', 2), null);
  });
});
