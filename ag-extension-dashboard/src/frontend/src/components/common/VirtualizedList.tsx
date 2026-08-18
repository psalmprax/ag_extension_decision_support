import React, { useState, useRef, UIEvent } from 'react';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  emptyComponent?: React.ReactNode;
  className?: string;
}

/**
 * Lightweight, high-performance DOM virtualization component designed for
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
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;

  // Calculate visible range with overscan boundaries
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height: containerHeight }}
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
      style={{ height: containerHeight, willChange: 'transform' }}
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
