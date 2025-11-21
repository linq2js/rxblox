import debounce from "lodash/debounce";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

export type RerenderOptions = {
  debounce?: number | "microtask";
};

export type RerenderFunction<TData = void> = {
  (data?: TData): void;
  data?: TData;
  rendering: () => boolean;
  cancel: () => void;
  flush: () => void;
  immediate: (data?: TData) => void;
};

/**
 * Hook for managing component re-renders with optional debouncing and data passing.
 * Returns a stable function reference that only changes when dependencies change.
 *
 * @template TData - Type of data to pass with re-render
 * @param options - Configuration options
 * @param options.debounce - Debounce delay in milliseconds (0 = microtask queue)
 * @returns Stable rerender function with cancel, flush, immediate, data, and rendering properties
 *
 * @example
 * ```tsx
 * const rerender = useRerender<number>({ debounce: 100 });
 * rerender(42); // Debounced re-render with data
 * rerender.immediate(42); // Immediate re-render
 * rerender.cancel(); // Cancel pending debounced re-render
 * console.log(rerender.data); // Access last re-render data
 * console.log(rerender.rendering()); // Check if currently rendering
 * ```
 */
export function useRerender<TData = void>(
  options: RerenderOptions = {}
): RerenderFunction<TData> {
  const [rerenderData, originalRerender] = useState<{ data?: TData }>({});
  const rerenderWrapper = useCallback(
    (data?: TData) => originalRerender({ data }),
    [originalRerender]
  );
  const isRenderingRef = useRef(false);

  const debounced = useMemo(() => {
    if (typeof options.debounce === "number") {
      const d = debounce(rerenderWrapper, options.debounce);
      return {
        call: d,
        cancel: d.cancel.bind(d),
        flush: d.flush.bind(d),
      };
    }

    if (options.debounce === "microtask") {
      let token = {};
      return {
        call(data?: TData) {
          const currentToken = {};
          token = currentToken;
          Promise.resolve().then(() => {
            if (currentToken === token) {
              rerenderWrapper(data);
            }
          });
        },
        cancel: () => {},
        flush: () => {},
      };
    }
    return {
      call: rerenderWrapper,
      cancel: () => {},
      flush: () => {},
    };
  }, [rerenderWrapper, options.debounce]);
  const debouncedRef = useRef(debounced);
  debouncedRef.current = debounced;
  isRenderingRef.current = true;

  // Only recreate the function when rerenderWrapper changes (stable)
  const rerender = useMemo(() => {
    return Object.assign((data?: TData) => debouncedRef.current.call(data!), {
      cancel() {
        debouncedRef.current.cancel();
      },
      flush() {
        debouncedRef.current.flush();
      },
      rendering: () => isRenderingRef.current,
      immediate: rerenderWrapper,
    });
  }, [rerenderWrapper]);

  // Track rendering state: set to true during render, false after paint
  useLayoutEffect(() => {
    isRenderingRef.current = false;
    return () => {
      isRenderingRef.current = false;
    };
  });

  return Object.assign(rerender, {
    data: rerenderData.data,
  });
}
