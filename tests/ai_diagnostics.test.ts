import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildErrorDiagnosisPrompt,
  extractPlanInsights,
  buildExecutionPlanAdvicePrompt,
  buildExecutionStatsAdvicePrompt,
} from '../src/utils/aiPromptBuilder.ts';

describe('AI Diagnostics & Plan Tuning Prompt Builder', () => {
  describe('buildErrorDiagnosisPrompt', () => {
    it('should generate complete diagnostic prompt with all metadata and SQL', () => {
      const prompt = buildErrorDiagnosisPrompt({
        message: "Column 'Customers.ContactName' is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause.",
        code: 8120,
        lineNumber: 1,
        database: 'Northwind',
        sql: 'SELECT City, ContactName, COUNT(*) FROM Customers GROUP BY City',
      });

      assert.ok(prompt.includes('Msg 8120'));
      assert.ok(prompt.includes('Line 1'));
      assert.ok(prompt.includes('Northwind'));
      assert.ok(prompt.includes('Customers.ContactName'));
      assert.ok(prompt.includes('SELECT City, ContactName, COUNT(*) FROM Customers GROUP BY City'));
      assert.ok(prompt.includes('錯誤根本原因分析'));
      assert.ok(prompt.includes('修復後的完整 T-SQL 語法'));
    });

    it('should handle error prompt with minimal fields gracefully', () => {
      const prompt = buildErrorDiagnosisPrompt({
        message: 'Syntax error near keyword WHERE.',
      });

      assert.ok(prompt.includes('Syntax error near keyword WHERE.'));
      assert.ok(prompt.includes('(未提供具體 SQL 語法'));
      assert.ok(!prompt.includes('Msg undefined'));
      assert.ok(!prompt.includes('Line undefined'));
    });
  });

  describe('extractPlanInsights', () => {
    it('should extract missing index recommendations, warnings, and top operators from ShowPlanXML', () => {
      const sampleXml = `
<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.2" Build="15.0.2000.5">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple StatementText="SELECT * FROM Orders WHERE CustomerID = 1045 AND OrderDate &gt; '2023-01-01'">
          <QueryPlan DegreeOfParallelism="1">
            <Warnings SpillToTempDb="true" PlanAffectingConvert="true" UnmatchedIndexes="true" />
            <MissingIndexes>
              <MissingIndexGroup Impact="87.6543">
                <MissingIndex Database="[Northwind]" Schema="[dbo]" Table="[Orders]">
                  <ColumnGroup Usage="EQUALITY">
                    <Column Name="[CustomerID]" ColumnId="1" />
                  </ColumnGroup>
                  <ColumnGroup Usage="INEQUALITY">
                    <Column Name="[OrderDate]" ColumnId="2" />
                  </ColumnGroup>
                  <ColumnGroup Usage="INCLUDE">
                    <Column Name="[ShipCity]" ColumnId="3" />
                    <Column Name="[Freight]" ColumnId="4" />
                  </ColumnGroup>
                </MissingIndex>
              </MissingIndexGroup>
            </MissingIndexes>
            <RelOp NodeId="0" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="1250" EstimatedTotalSubtreeCost="0.7523">
              <OutputList>
                <ColumnReference Table="[Orders]" Column="OrderID" />
              </OutputList>
              <IndexScan>
                <Object Table="[Orders]" Index="[PK_Orders]" />
              </IndexScan>
            </RelOp>
            <RelOp NodeId="1" PhysicalOp="Sort" LogicalOp="Sort" EstimateRows="500" EstimatedTotalSubtreeCost="0.3120">
              <OutputList>
                <ColumnReference Table="[Orders]" Column="OrderID" />
              </OutputList>
            </RelOp>
            <RelOp NodeId="2" PhysicalOp="Compute Scalar" LogicalOp="Compute Scalar" EstimateRows="1" EstimatedTotalSubtreeCost="0.0012">
            </RelOp>
          </QueryPlan>
        </StmtSimple>
      </Statements>
    </Batch>
  </BatchSequence>
</ShowPlanXML>
      `;

      const insights = extractPlanInsights(sampleXml);

      // Missing Indexes
      assert.equal(insights.missingIndexes.length, 1);
      const mi = insights.missingIndexes[0];
      assert.equal(mi.table, '[Orders]');
      assert.equal(mi.schema, '[dbo]');
      assert.equal(mi.impact, '87.6543');
      assert.deepEqual(mi.equalityColumns, ['[CustomerID]']);
      assert.deepEqual(mi.inequalityColumns, ['[OrderDate]']);
      assert.deepEqual(mi.includeColumns, ['[ShipCity]', '[Freight]']);

      // Warnings
      assert.equal(insights.warnings.length, 3);
      assert.ok(insights.warnings.some((w) => w.includes('SpillToTempDb')));
      assert.ok(insights.warnings.some((w) => w.includes('PlanAffectingConvert')));
      assert.ok(insights.warnings.some((w) => w.includes('UnmatchedIndexes')));

      // Top Operators (sorted descending by cost)
      assert.ok(insights.topOperators.length >= 2);
      assert.equal(insights.topOperators[0].physicalOp, 'Clustered Index Scan');
      assert.equal(insights.topOperators[0].cost, 0.7523);
      assert.equal(insights.topOperators[0].targetObject, '[Orders]');
      assert.equal(insights.topOperators[1].physicalOp, 'Sort');
      assert.equal(insights.topOperators[1].cost, 0.3120);
    });

    it('should return empty insights on empty or invalid XML input', () => {
      const emptyInsights = extractPlanInsights('');
      assert.equal(emptyInsights.missingIndexes.length, 0);
      assert.equal(emptyInsights.warnings.length, 0);
      assert.equal(emptyInsights.topOperators.length, 0);

      const nullInsights = extractPlanInsights(null);
      assert.equal(nullInsights.missingIndexes.length, 0);
    });
  });

  describe('buildExecutionPlanAdvicePrompt', () => {
    it('should assemble comprehensive execution plan prompt with missing index DDL and warnings', () => {
      const sampleXml = `
        <QueryPlan>
          <Warnings SpillToTempDb="true" />
          <MissingIndexes>
            <MissingIndexGroup Impact="92.4">
              <MissingIndex Table="[Customers]">
                <ColumnGroup Usage="EQUALITY">
                  <Column Name="[City]" />
                </ColumnGroup>
                <ColumnGroup Usage="INCLUDE">
                  <Column Name="[CompanyName]" />
                </ColumnGroup>
              </MissingIndex>
            </MissingIndexGroup>
          </MissingIndexes>
          <RelOp NodeId="0" PhysicalOp="Table Scan" EstimatedTotalSubtreeCost="1.2345" EstimateRows="5000">
            <TableScan>
              <Object Table="[Customers]" />
            </TableScan>
          </RelOp>
        </QueryPlan>
      `;

      const prompt = buildExecutionPlanAdvicePrompt({
        sql: 'SELECT City, CompanyName FROM Customers WHERE City = "Berlin"',
        planXml: sampleXml,
        durationMs: 450,
        database: 'Northwind',
      });

      assert.ok(prompt.includes('執行耗時：450 ms'));
      assert.ok(prompt.includes('資料庫：Northwind'));
      assert.ok(prompt.includes('SpillToTempDb'));
      assert.ok(prompt.includes('92.4%'));
      assert.ok(prompt.includes('[Customers]'));
      assert.ok(prompt.includes('CREATE NONCLUSTERED INDEX'));
      assert.ok(prompt.includes('Table Scan'));
      assert.ok(prompt.includes('SELECT City, CompanyName FROM Customers WHERE City = "Berlin"'));
      assert.ok(prompt.includes('執行計畫效能瓶頸深入診斷'));
      assert.ok(prompt.includes('SQL 語句重構調校建言'));
    });
  });

  describe('buildExecutionStatsAdvicePrompt', () => {
    it('should build execution stats advice prompt with table IO breakdown and wait stats', () => {
      const prompt = buildExecutionStatsAdvicePrompt({
        sql: 'SELECT o.OrderID, c.CompanyName FROM Orders o JOIN Customers c ON o.CustomerID = c.CustomerID',
        cpuTimeMs: 145,
        elapsedTimeMs: 420,
        compileCpuTimeMs: 12,
        compileElapsedTimeMs: 25,
        totalLogicalReads: 15400,
        logicalReadsFormatted: '120.3 MB',
        totalPhysicalReads: 320,
        cacheHitRatio: 97.9,
        database: 'Northwind',
        tableStats: [
          {
            tableName: 'Orders',
            scanCount: 2,
            logicalReads: 12000,
            physicalReads: 250,
            readAheadReads: 50,
            bytesFormatted: '93.8 MB',
            isHighIo: true,
          },
          {
            tableName: 'Customers',
            scanCount: 1,
            logicalReads: 3400,
            physicalReads: 70,
            readAheadReads: 10,
            bytesFormatted: '26.5 MB',
            isHighIo: false,
          },
        ],
        waitStats: [
          {
            waitType: 'PAGEIOLATCH_SH',
            waitingTasksCount: 15,
            waitTimeMs: 180,
            maxWaitTimeMs: 45,
          },
        ],
      });

      assert.ok(prompt.includes('CPU 耗時: 145 ms'));
      assert.ok(prompt.includes('總執行耗時: 420 ms'));
      assert.ok(prompt.includes('15,400 頁 (120.3 MB)'));
      assert.ok(prompt.includes('快取命中率: 97.9%'));
      assert.ok(prompt.includes('Orders ⚠️ (高讀取)'));
      assert.ok(prompt.includes('Customers'));
      assert.ok(prompt.includes('PAGEIOLATCH_SH'));
      assert.ok(prompt.includes('180'));
      assert.ok(prompt.includes('IO 消耗與效能瓶頸評估'));
      assert.ok(prompt.includes('索引與覆蓋索引最佳化建議'));
      assert.ok(prompt.includes('SQL 查詢重構調優'));
    });
  });
});
