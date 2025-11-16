export function createRef<T>(): {
  current: T | undefined | null;
  (value: T | null | undefined): void;
} {
  let current: T | undefined | null = null;

  const setter = (value: T) => {
    current = value;
  };

  Object.defineProperty(setter, "current", {
    get: () => current,
    set: setter,
  });

  return setter as any;
}
