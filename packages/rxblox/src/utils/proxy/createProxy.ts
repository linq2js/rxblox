/**
 * Function type for use with proxies.
 */
export type AnyFunc = (...args: any[]) => any;

/**
 * Options for creating a dynamic proxy.
 *
 * Function methods are automatically bound to their target, ensuring stable
 * references and correct `this` binding even when destructured or cached.
 */
export type ProxyOptions<T> = {
  /**
   * Get the current target value.
   * Called on every property access to retrieve the latest value.
   */
  get: () => T;

  /**
   * Handle property writes (shallow updates).
   * If omitted, the proxy is readonly.
   */
  set?: (key: keyof T, value: any) => void;

  /**
   * Enable direct mutation of target properties.
   *
   * - `true`: All properties are writable (throws error for function targets)
   * - `false` (default): Uses custom `set` handler or throws readonly error
   * - `(keyof T)[]`: Only listed properties are writable
   *
   * Note: `traps.set` always takes precedence if provided.
   */
  writable?: boolean | (keyof T)[];

  /**
   * Custom trap handlers to override default behavior.
   * All traps receive the actual current target (not the wrapper function).
   */
  traps?: Partial<ProxyHandler<any>>;
};

/**
 * Create a dynamic proxy with configurable behavior.
 *
 * Always uses a function as the proxy target for maximum flexibility.
 * The actual target value is retrieved dynamically via the `get` option,
 * and behavior is determined at runtime based on the target's type.
 *
 * ## ✨ Auto-Binding
 *
 * Function methods are automatically bound to their target and cached for
 * stable references:
 *
 * ```ts
 * const obj = {
 *   name: 'Hello',
 *   greet() { return this.name; }
 * };
 * const proxy = createProxy({ get: () => obj });
 *
 * // ✅ Destructuring works (auto-bound)
 * const { greet } = proxy;
 * greet();  // 'Hello' ✅
 *
 * // ✅ Caching works (stable reference)
 * const greetMethod = proxy.greet;
 * greetMethod === proxy.greet;  // true ✅
 * greetMethod();  // 'Hello' ✅
 * ```
 *
 * @example Readonly object proxy (signal.value)
 * ```ts
 * const todo = signal({ title: 'hello', done: false })
 *
 * const valueProxy = createProxy({
 *   get: () => todo(),
 *   set: (key, val) => todo.set(prev => ({ ...prev, [key]: val }))
 * })
 *
 * valueProxy.title = 'new'  // ✅ Works
 * valueProxy()              // ❌ Error: target is not a function
 * ```
 *
 * @example Readonly object proxy (computed.value)
 * ```ts
 * const doubled = computed(() => ({ count: state().count * 2 }))
 *
 * const valueProxy = createProxy({
 *   get: () => doubled()
 *   // No set = readonly
 * })
 *
 * valueProxy.count       // ✅ Read
 * valueProxy.count = 5   // ❌ Error: readonly
 * valueProxy()           // ❌ Error: target is not a function
 * ```
 *
 * @example Invocable function proxy
 * ```ts
 * const fn = signal(() => 'hello')
 *
 * const proxy = createProxy({
 *   get: () => fn()
 * })
 *
 * proxy()  // ✅ 'hello' (automatically invokes if target is a function)
 * ```
 *
 * @example Writable proxy - all properties
 * ```ts
 * const state = { count: 0, name: 'todo' }
 *
 * const proxy = createProxy({
 *   get: () => state,
 *   writable: true
 * })
 *
 * proxy.count = 10      // ✅ Mutates state.count directly
 * proxy.name = 'done'   // ✅ Mutates state.name directly
 * ```
 *
 * @example Writable proxy - specific properties only
 * ```ts
 * const state = { count: 0, name: 'todo', id: 1 }
 *
 * const proxy = createProxy({
 *   get: () => state,
 *   writable: ['count', 'name']  // Only these can be mutated
 * })
 *
 * proxy.count = 10    // ✅ Works
 * proxy.name = 'done' // ✅ Works
 * proxy.id = 2        // ❌ Error: readonly
 * ```
 */
export function createProxy<T>(options: ProxyOptions<T>): T {
  const { get, set, writable = false, traps = {} } = options;

  // Cache bound methods to ensure stable references and correct 'this' binding
  // WeakMap key: target object, value: Map of property -> bound function
  const boundMethodsCache = new WeakMap<any, Map<PropertyKey, AnyFunc>>();

  // Helper to branch behavior based on current target type
  const branch = <T1, T2>(
    ifFunc: (target: AnyFunc) => T1,
    ifNonFunc: (target: any) => T2
  ): T1 | T2 => {
    const current = get();

    if (typeof current === "function") {
      return ifFunc(current as AnyFunc);
    }

    return ifNonFunc(current);
  };

  // Always use function target for maximum flexibility
  const target = function proxyTarget(this: any, ...args: any[]) {
    // Branch behavior based on runtime type
    return branch(
      // If target is function, invoke it
      (fn) => fn.apply(this, args),

      // If target is not function, throw error
      (obj) => {
        throw new Error(
          `Cannot invoke proxy: target is ${typeof obj}, not a function.`
        );
      }
    );
  };

  const handler: ProxyHandler<any> = {
    get(_, prop, receiver) {
      const current = get();

      if (traps.get) {
        return traps.get(current, prop, receiver);
      }

      const value = (current as any)[prop];

      // Auto-bind function properties to maintain correct 'this' context
      if (typeof value === "function" && typeof current === "object") {
        // Get or create cache for this target
        if (!boundMethodsCache.has(current)) {
          boundMethodsCache.set(current, new Map());
        }
        const cache = boundMethodsCache.get(current)!;

        // Get or create bound method
        if (!cache.has(prop)) {
          cache.set(prop, value.bind(current));
        }
        return cache.get(prop);
      }

      return value;
    },

    set(_, prop, value, receiver) {
      const current = get();

      // Custom trap has full control
      if (traps.set) {
        return traps.set(current, prop, value, receiver);
      }

      // Check if property is writable
      const isWritable =
        writable === true ||
        (Array.isArray(writable) && writable.includes(prop as keyof T));

      // Writable mode - direct mutation
      if (isWritable) {
        return branch(
          // For functions, allow custom props but block built-in props
          (fn) => {
            if (prop in target) {
              throw new Error(
                `Cannot set built-in property '${String(
                  prop
                )}' on function target. ` +
                  `Built-in function properties are readonly.`
              );
            }

            // Allow writing to custom properties
            (fn as any)[prop] = value;
            return true;
          },
          // Direct mutation for objects
          (obj) => {
            obj[prop] = value;
            return true;
          }
        );
      }

      // Custom set handler
      if (set) {
        set(prop as any, value);
        return true;
      }

      // Readonly
      throw new Error(
        `Cannot set property '${String(prop)}' on readonly proxy`
      );
    },

    has(_, prop) {
      const current = get();

      if (traps.has) {
        return traps.has(current, prop);
      }

      return prop in (current as any);
    },

    ownKeys(proxyTarget) {
      const current = get();

      let customKeys: (string | symbol)[];
      if (traps.ownKeys) {
        customKeys = traps.ownKeys(current);
      } else {
        customKeys = Reflect.ownKeys(current as any);
      }

      // Merge with function target's own keys to satisfy proxy invariants
      // Functions have non-configurable properties like 'prototype', 'length', etc.
      const targetKeys = Reflect.ownKeys(proxyTarget);
      const allKeys = new Set([...targetKeys, ...customKeys]);

      return Array.from(allKeys);
    },

    getOwnPropertyDescriptor(proxyTarget, prop) {
      const current = get();

      // If custom trap is provided, give it priority
      if (traps.getOwnPropertyDescriptor) {
        const customDesc = traps.getOwnPropertyDescriptor(current, prop);
        // If custom trap explicitly returns a descriptor, use it
        if (customDesc !== undefined) {
          return customDesc;
        }
        // If custom trap returns undefined, check if property exists on proxy target
        // (for non-configurable function properties that must be reported)
        const targetDesc = Object.getOwnPropertyDescriptor(proxyTarget, prop);
        if (targetDesc && !targetDesc.configurable) {
          return targetDesc;
        }
        // Otherwise, respect the custom trap's undefined return
        return undefined;
      }

      // No custom trap - use default behavior
      let desc = Object.getOwnPropertyDescriptor(current as any, prop);

      // If not found, check the proxy target (function properties)
      // This is crucial for satisfying proxy invariants
      if (!desc) {
        desc = Object.getOwnPropertyDescriptor(proxyTarget, prop);
      }

      // If still not found, return a configurable descriptor
      if (!desc) {
        return {
          enumerable: true,
          configurable: true,
          value: (current as any)[prop],
        };
      }

      return desc;
    },

    apply(_, thisArg, args) {
      const current = get();

      if (traps.apply) {
        return traps.apply(current, thisArg, args);
      }

      return target.apply(thisArg, args);
    },
  };

  return new Proxy(target, handler) as T;
}
