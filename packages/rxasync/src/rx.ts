import type { ReactNode } from "react";
import type { RxContext, RxOptions } from "./types";

/**
 * Factory function for creating reactive async components.
 *
 * Components created with rx() support:
 * - Async/await in the render function
 * - Fine-grained reactivity with ctx.part()
 * - Safe conditional hooks with ctx.hook()
 * - Local and global state with ctx.state()
 * - Composable logic with ctx.use()
 * - Cleanup with ctx.onCleanup()
 *
 * @template TProps Component props type
 * @param render Render function (can be async)
 * @param options Optional configuration (loading/error components)
 * @returns React component
 *
 * @example
 * ```tsx
 * const Counter = rx((props, ctx) => {
 *   const [count, setCount] = ctx.state(0);
 *   return <div>{ctx.part(count)}</div>;
 * });
 * ```
 */
export function rx<TProps = {}>(
  render: (
    props: TProps,
    context: RxContext
  ) => ReactNode | Promise<ReactNode>,
  options?: RxOptions
): React.ComponentType<TProps> {
  // Implementation will be added in runtime/
  throw new Error("rx() implementation not yet complete");
}

