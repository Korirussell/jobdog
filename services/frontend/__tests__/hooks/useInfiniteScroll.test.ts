import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

describe('useInfiniteScroll', () => {
  it('returns a ref object', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(onLoadMore, true, false)
    );

    expect(result.current).toHaveProperty('current');
  });

  it('does not call onLoadMore when loading is true', () => {
    const onLoadMore = vi.fn();
    renderHook(() => useInfiniteScroll(onLoadMore, true, true));

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not call onLoadMore when hasMore is false', () => {
    const onLoadMore = vi.fn();
    renderHook(() => useInfiniteScroll(onLoadMore, false, false));

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
