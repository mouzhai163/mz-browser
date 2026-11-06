import type { ReactNode } from 'react';

/**
 * 列定义
 */
export interface ColumnDef<T> {
  /** 列唯一标识 */
  id: string;
  /** 列标题 */
  header: ReactNode | ((props: { column: ColumnDef<T> }) => ReactNode);
  /** 单元格渲染 */
  cell: (props: { row: T; rowIndex: number }) => ReactNode;
  /** 列宽度 */
  width?: string | number;
  /** 自定义表头类名 */
  headerClassName?: string;
  /** 自定义单元格类名 */
  cellClassName?: string;
}

/**
 * 自定义行渲染 Props
 */
export interface CustomRowRenderProps<T> {
  /** 行数据 */
  row: T;
  /** 行索引 */
  rowIndex: number;
  /** 行唯一键 */
  rowKey: string;
  /** 是否选中 */
  isSelected: boolean;
  /** 选择回调 */
  onSelect: (selected: boolean) => void;
}

/**
 * 表格 Props
 */
export interface DataTableProps<T> {
  /** 数据源 */
  data: T[];
  /** 列定义 */
  columns: ColumnDef<T>[];
  /** 获取行的唯一键 */
  getRowKey: (row: T) => string;
  /** 是否加载中 */
  loading?: boolean;
  /** 骨架屏行数 */
  skeletonRows?: number;
  /** 空状态文本 */
  emptyText?: ReactNode;
  /** 是否启用行选择 */
  selectable?: boolean;
  /** 已选择的行 ID 集合 */
  selectedIds?: Set<string>;
  /** 选择变化回调 */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /** 行点击回调 */
  onRowClick?: (row: T) => void;
  /** 固定在左侧的列 ID 数组（按顺序） */
  stickyLeftColumns?: string[];
  /** 固定在右侧的列 ID 数组（按顺序） */
  stickyRightColumns?: string[];
  /** 自定义容器类名 */
  className?: string;
  /** 自定义表格类名 */
  tableClassName?: string;
  /** 起始序号（用于分页） */
  startIndex?: number;
  /** 自定义行渲染器（完全替代默认行渲染） */
  renderRow?: (props: CustomRowRenderProps<T>) => ReactNode;
}

/**
 * 表格行 Props
 */
export interface DataTableRowProps<T> {
  /** 行数据 */
  row: T;
  /** 行索引 */
  rowIndex: number;
  /** 列定义 */
  columns: ColumnDef<T>[];
  /** 行唯一键 */
  rowKey: string;
  /** 是否选中 */
  isSelected?: boolean;
  /** 选择回调 */
  onSelect?: (selected: boolean) => void;
  /** 是否可选择 */
  selectable?: boolean;
  /** 行点击回调 */
  onClick?: () => void;
  /** 固定在左侧的列 ID 集合 */
  stickyLeftColumns?: Set<string>;
  /** 固定在右侧的列 ID 集合 */
  stickyRightColumns?: Set<string>;
  /** 选择列宽度（用于计算 sticky left 偏移） */
  selectColumnWidth?: number;
}

/**
 * 表格骨架屏 Props
 */
export interface DataTableSkeletonProps {
  /** 行数 */
  rows: number;
  /** 列数 */
  columns: number;
  /** 是否有选择列 */
  hasSelectColumn?: boolean;
}
