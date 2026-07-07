declare module "react-virtualized" {
  import type { ComponentType, CSSProperties, ReactNode } from "react";

  export type AutoSizerProps = {
    disableHeight?: boolean;
    disableWidth?: boolean;
    children: (dimensions: { width: number; height: number }) => ReactNode;
  };

  export type CellMeasurerCacheProps = {
    fixedWidth?: boolean;
    defaultHeight?: number;
    defaultWidth?: number;
  };

  export type ListProps = {
    autoHeight?: boolean;
    width: number;
    height: number;
    rowCount: number;
    rowHeight: number | ((params: { index: number }) => number);
    deferredMeasurementCache?: any;
    overscanRowCount?: number;
    rowRenderer: (params: {
      index: number;
      key: string;
      parent: any;
      style: CSSProperties;
    }) => ReactNode;
    onScroll?: (...args: any[]) => void;
    isScrolling?: boolean;
    scrollTop?: number;
    ref?: React.Ref<any>;
    style?: CSSProperties;
  };

  export type WindowScrollerProps = {
    children: (params: {
      height: number;
      isScrolling: boolean;
      onChildScroll: () => void;
      scrollTop: number;
    }) => ReactNode;
  };

  export const AutoSizer: ComponentType<AutoSizerProps>;
  export const CellMeasurer: ComponentType<any>;
  export const CellMeasurerCache: new (props: CellMeasurerCacheProps) => any;
  export const List: new (props: ListProps) => any;
  export const WindowScroller: ComponentType<WindowScrollerProps>;
}
