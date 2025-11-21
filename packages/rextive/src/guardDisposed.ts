import { AnyFunc } from "./types";

export function guardDisposed<T extends AnyFunc>(
  isDisposed: () => boolean,
  message: string,
  fn: T
) {
  return (...args: Parameters<T>) => {
    if (isDisposed()) {
      throw new Error(message);
    }
    return fn(...args);
  };
}
