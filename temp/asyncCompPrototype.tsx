import React, { ReactNode, useLayoutEffect } from "react";

export declare function fetchInitialValue(): Promise<number>;

export type AsyncComponentContext = {
  state<T>(
    initialValue: T
  ): [get: () => T, set: (value: T | ((value: T) => T)) => void];
  hook<T>(renderHook: () => T): { current: T | undefined };
  part(renderPart: () => ReactNode): ReactNode;
  on(options: { cleanup?: VoidFunction | VoidFunction[] }): void;
  use<TLogic extends Logic<any[], any>>(
    logic: TLogic,
    ...params: Parameters<TLogic> extends [AsyncComponentContext, ...infer P]
      ? P
      : never
  ): ReturnType<TLogic>;
};

export type Logic<TParams extends any[], TReturn> = (
  context: AsyncComponentContext,
  ...params: TParams
) => TReturn;

export declare function async<TProps>(
  render: (
    props: TProps,
    context: AsyncComponentContext
  ) => ReactNode | Promise<ReactNode>
): ReactNode;

export const CounterApp = async(async (_, { state, part, hook }) => {
  const initialValue = await fetchInitialValue();
  const [getCount, setCount] = state(initialValue);
  const increment = () => setCount(getCount() + 1);

  const hook1 = hook(() => {
    useLayoutEffect(() => {});

    return true;
  });

  return (
    <div>
      <h1>Counter</h1>
      <p>{part(getCount)}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
});
