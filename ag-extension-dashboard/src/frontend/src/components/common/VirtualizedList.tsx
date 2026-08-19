import React, { useState, useRef, useLayoutEffect, UIEvent } from 'react';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  /** Fixed viewport height in px. When omitted, the list measures its own height (flex/percentage layouts). */
  containerHeight?: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  emptyComponent?: React.ReactNode;
  className?: string;
}

/**
 * Lightweight, high-performance DOM window virtualization designed for
 * budget mobile hardware (2GB RAM Android phones). Prevents WebView crashes by
 * rendering only the visible window slice of items (+ overscan buffer).
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
  renderItem,
  keyExtractor,
  emptyComponent,
  className = '',
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-measure the scroll viewport so the list works inside flex layouts
  // without a hardcoded pixel height (fixed `containerHeight` remains supported).
  useLayoutEffect(() => {
    if (containerHeight !== undefined) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setMeasuredHeight(el.clientHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [containerHeight]);

  const viewportHeight = containerHeight ?? measuredHeight;
  const totalHeight = items.length * itemHeight;

  // Until the viewport is measured (first paint), render everything so no items flash missing.
  const startIndex =
    viewportHeight > 0 ? Math.max(0, Math.floor(scrollTop / itemHeight) - overscan) : 0;
  const endIndex =
    viewportHeight > 0
      ? Math.min(items.length - 1, Math.floor((scrollTop + viewportHeight) / itemHeight) + overscan)
      : items.length - 1;

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={containerHeight !== undefined ? { height: containerHeight } : undefined}
      >
        {emptyComponent || <p className="text-sm text-stone-500">No items available</p>}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto relative ${className}`}
      style={containerHeight !== undefined ? { height: containerHeight } : { minHeight: 0 }}
      role="feed"
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <div
                key={keyExtractor(item, actualIndex)}
                style={{ height: itemHeight }}
                className="overflow-hidden"
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
