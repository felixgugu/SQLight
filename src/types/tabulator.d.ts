/**
 * Minimal type surface for `tabulator-tables` 6.x.
 *
 * The published package ships no type definitions and the community `@types/tabulator-tables`
 * package lags behind the runtime (6.3.x) and does not describe the range/border APIs this
 * project relies on. Declaring only the members SQLight actually uses keeps `vue-tsc` honest
 * without pretending to cover the whole library.
 */
declare module 'tabulator-tables' {
  /** Row payload. Result grids use positional arrays, the structure viewer uses records. */
  export type TabulatorRowData = Record<string, unknown> & { readonly [index: number]: unknown };

  export interface TabulatorColumnDefinition {
    field?: string;
    title?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    frozen?: boolean;
    visible?: boolean;
    resizable?: boolean;
    headerSort?: boolean;
    headerSortTristate?: boolean;
    headerSortStartingDir?: 'asc' | 'desc';
    headerTooltip?: string;
    hozAlign?: 'left' | 'center' | 'right';
    cssClass?: string;
    tooltip?:
      | string
      | ((event: MouseEvent, cell: TabulatorCellComponent) => string | HTMLElement | '');
    formatter?: TabulatorFormatter;
    titleFormatter?: TabulatorFormatter;
    editor?: TabulatorEditor;
    editable?: boolean | ((cell: TabulatorCellComponent) => boolean);
    cellClick?: (event: MouseEvent, cell: TabulatorCellComponent) => void;
    headerClick?: (event: MouseEvent, column: TabulatorColumnComponent) => void;
    [key: string]: unknown;
  }

  export type TabulatorFormatter =
    | string
    | ((
        cell: TabulatorCellComponent,
        params: Record<string, unknown>,
        onRendered: (callback: () => void) => void
      ) => unknown);

  export type TabulatorEditor =
    | string
    | ((
        cell: TabulatorCellComponent,
        onRendered: (callback: () => void) => void,
        success: (value: unknown) => void,
        cancel: () => void,
        params: Record<string, unknown>
      ) => HTMLElement | void | undefined);

  export interface TabulatorColumnComponent {
    getField(): string;
    getElement(): HTMLElement;
    getWidth(): number;
    isVisible(): boolean;
    getDefinition(): TabulatorColumnDefinition;
    updateDefinition(updates: Record<string, unknown>): void;
    /** `to` accepts a target column, a field name or an index-like key. */
    move(to: number | string | TabulatorColumnComponent, after?: boolean): void;
  }

  export interface TabulatorRowComponent {
    getData(): TabulatorRowData;
    getPosition(): number;
    getCell(field: string): TabulatorCellComponent | false;
    getElement(): HTMLElement;
  }

  export interface TabulatorCellComponent {
    getValue(): unknown;
    setValue(value: unknown, mutate?: boolean): Promise<void> | void;
    getField(): string;
    getColumn(): TabulatorColumnComponent;
    getRow(): TabulatorRowComponent;
    getElement(): HTMLElement;
    getTable(): Tabulator;
  }

  export interface TabulatorRangeComponent {
    getRows(): TabulatorRowComponent[];
    getColumns(): TabulatorColumnComponent[];
    getTopEdge(): number;
    getBottomEdge(): number;
    getLeftEdge(): number;
    getRightEdge(): number;
    remove(): void;
  }

  export interface TabulatorSorter {
    /** Column component, or a field name when setting sorters programmatically. */
    column?: TabulatorColumnComponent | string;
    field?: string;
    dir: 'asc' | 'desc';
  }

  export interface TabulatorLayoutColumn {
    field?: string;
    width?: number;
    visible?: boolean;
    [key: string]: unknown;
  }

  export interface TabulatorOptions {
    [key: string]: unknown;
  }

  export interface Tabulator {
    element: HTMLElement;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback?: (...args: any[]) => void): void;
    destroy(): void;
    getElement(): HTMLElement;
    getColumns(): TabulatorColumnComponent[];
    getColumn(field: string): TabulatorColumnComponent | false;
    getRows(): TabulatorRowComponent[];
    getRowFromPosition(position: number): TabulatorRowComponent | false;
    getRanges(): TabulatorRangeComponent[];
    addRange(
      start?: TabulatorCellComponent | null,
      end?: TabulatorCellComponent | null
    ): TabulatorRangeComponent;
    getSorters(): TabulatorSorter[];
    setSort(sorters: TabulatorSorter[]): void;
    clearSort(): void;
    getColumnLayout(): TabulatorLayoutColumn[];
    setColumnLayout(layout: TabulatorLayoutColumn[]): boolean;
    setFilter(
      field: string | ((data: TabulatorRowData) => boolean),
      type?: string,
      value?: unknown,
      params?: Record<string, unknown>
    ): void;
    clearFilter(includeHeaderFilters?: boolean): void;
    getFilters(includeHeaderFilters?: boolean): unknown[];
    getData(active?: 'active' | 'display' | 'visible'): TabulatorRowData[];
    getDataCount(active?: 'active' | 'display' | 'visible'): number;
    replaceData(data: unknown[], params?: unknown, config?: unknown): Promise<void>;
    setData(data: unknown[], params?: unknown, config?: unknown): Promise<void>;
    redraw(force?: boolean): void;
    blockRedraw(): void;
    restoreRedraw(): void;
  }

  export const TabulatorFull: {
    new (element: HTMLElement | string, options: TabulatorOptions): Tabulator;
  };

  export const Tabulator: {
    new (element: HTMLElement | string, options: TabulatorOptions): Tabulator;
  };
}
