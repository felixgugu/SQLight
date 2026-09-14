import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAlterColumnSql,
  generateDropColumnSql,
  generateAddColumnSql,
  generateAllAlterTableTemplateSql,
} from '../src/utils/alterTableGenerator';

describe('alterTableGenerator', () => {
  const baseOptions = {
    schema: 'dbo',
    tableName: 'Users',
    columnName: 'Email',
    dataType: 'nvarchar',
    fullType: 'nvarchar(100)',
    isNullable: 'YES',
    database: 'CRM_DB',
  };

  test('generateAlterColumnSql: formats standard ALTER COLUMN statement with USE database', () => {
    const sql = generateAlterColumnSql(baseOptions);

    assert.ok(sql.includes('USE [CRM_DB];\nGO'), 'Should include USE database header');
    assert.ok(
      sql.includes('ALTER TABLE [dbo].[Users]\nALTER COLUMN [Email] nvarchar(100) NULL;'),
      'Should generate standard ALTER COLUMN statement'
    );
  });

  test('generateAlterColumnSql: correctly handles NOT NULL and custom schemas', () => {
    const sql = generateAlterColumnSql({
      schema: 'sales',
      tableName: 'Customers',
      columnName: 'Phone',
      dataType: 'varchar',
      fullType: 'varchar(20)',
      isNullable: 'NO',
    });

    assert.ok(!sql.includes('USE ['), 'Should not include USE when database is omitted');
    assert.ok(
      sql.includes('ALTER TABLE [sales].[Customers]\nALTER COLUMN [Phone] varchar(20) NOT NULL;'),
      'Should resolve isNullable="NO" to NOT NULL'
    );
  });

  test('generateAlterColumnSql: safely escapes identifiers with spaces and special characters', () => {
    const sql = generateAlterColumnSql({
      schema: 'my schema',
      tableName: 'Order Details',
      columnName: 'Item [Code]',
      fullType: 'nvarchar(50)',
      isNullable: true,
    });

    assert.ok(
      sql.includes('ALTER TABLE [my schema].[Order Details]\nALTER COLUMN [Item [Code]]] nvarchar(50) NULL;'),
      'Should escape brackets and spaces safely'
    );
  });

  test('generateDropColumnSql: formats standard DROP COLUMN statement with constraint hints', () => {
    const sql = generateDropColumnSql({
      ...baseOptions,
      defaultValue: "('default@test.com')",
    });

    assert.ok(sql.includes('USE [CRM_DB];\nGO'), 'Should include USE database header');
    assert.ok(
      sql.includes('ALTER TABLE [dbo].[Users]\nDROP COLUMN [Email];'),
      'Should generate standard DROP COLUMN statement'
    );
    assert.ok(sql.includes("('default@test.com')"), 'Should include default constraint value hint');
    assert.ok(sql.includes('DROP CONSTRAINT'), 'Should include constraint drop instructions');
  });

  test('generateAddColumnSql: formats standard ADD COLUMN statement', () => {
    const sql = generateAddColumnSql(baseOptions);

    assert.ok(sql.includes('USE [CRM_DB];\nGO'), 'Should include USE database header');
    assert.ok(
      sql.includes('ALTER TABLE [dbo].[Users]\nADD [NewColumnName] nvarchar(100) NULL;'),
      'Should generate standard ADD statement'
    );
  });

  test('generateAllAlterTableTemplateSql: includes all three operations in one template', () => {
    const sql = generateAllAlterTableTemplateSql(baseOptions);

    assert.ok(sql.includes('ADD [NewColumnName]'), 'Template should include ADD');
    assert.ok(sql.includes('ALTER COLUMN [Email] nvarchar(100) NULL;'), 'Template should include ALTER');
    assert.ok(sql.includes('DROP COLUMN [Email];'), 'Template should include DROP');
  });

  test('TableStructureViewer.vue integration for ALTER TABLE context menu', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const viewerCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/editor/TableStructureViewer.vue'),
      'utf-8'
    );

    // Verify imports and methods exist in TableStructureViewer.vue
    assert.ok(viewerCode.includes('generateAlterColumnSql'), 'Should import generateAlterColumnSql');
    assert.ok(viewerCode.includes('generateDropColumnSql'), 'Should import generateDropColumnSql');
    assert.ok(viewerCode.includes('generateAddColumnSql'), 'Should import generateAddColumnSql');
    assert.ok(viewerCode.includes('generateAllAlterTableTemplateSql'), 'Should import generateAllAlterTableTemplateSql');

    // Verify context menu actions exist
    assert.ok(viewerCode.includes('handleAlterColumnScript'), 'Should define handleAlterColumnScript');
    assert.ok(viewerCode.includes('handleCopyAlterColumnScript'), 'Should define handleCopyAlterColumnScript');

    // Verify template labels exist
    assert.ok(viewerCode.includes('ALTER COLUMN'), 'Template should contain ALTER COLUMN action');
    assert.ok(viewerCode.includes('ADD COLUMN'), 'Template should contain ADD COLUMN action');
    assert.ok(viewerCode.includes('DROP COLUMN'), 'Template should contain DROP COLUMN action');
  });
});
