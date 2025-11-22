import React from "react";
import { rx, store, type RxContext } from "../src/index";

// ============================================
// Example 1: Simple Counter (Local State)
// ============================================

export const Counter = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);

  return (
    <div>
      <h1>{ctx.part(count)}</h1>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
    </div>
  );
});

// ============================================
// Example 2: Async Component
// ============================================

async function fetchUser(id: string): Promise<{ name: string; email: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { name: "John Doe", email: "john@example.com" };
}

export const UserProfile = rx(
  async ({ userId }: { userId: string }, ctx) => {
    const user = await fetchUser(userId);
    const [getUser, setUser] = ctx.state(user);

    return (
      <div>
        <h1>{ctx.part(() => getUser().name)}</h1>
        <p>{ctx.part(() => getUser().email)}</p>
        <button
          onClick={() =>
            setUser((u) => ({ ...u, name: u.name + " Updated" }))
          }
        >
          Update Name
        </button>
      </div>
    );
  },
  {
    loading: <div>Loading user...</div>,
    error: (err) => <div>Error: {err.message}</div>,
  }
);

// ============================================
// Example 3: Global Store
// ============================================

const appStore = store({
  theme: "dark" as "dark" | "light",
  count: 0,
});

export const ThemedCounter = rx((props, ctx) => {
  const [theme, setTheme] = ctx.state(appStore, "theme");
  const [count, setCount] = ctx.state(appStore, "count");

  return (
    <div className={ctx.part(theme)}>
      <h1>Count: {ctx.part(count)}</h1>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      >
        Toggle Theme
      </button>
    </div>
  );
});

// ============================================
// Example 4: Composable Logic
// ============================================

const useCounter = (ctx: RxContext, initialValue: number) => {
  const [count, setCount] = ctx.state(initialValue);

  return {
    count,
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
    reset: () => setCount(initialValue),
  };
};

const useToggle = (ctx: RxContext, initialValue = false) => {
  const [value, setValue] = ctx.state(initialValue);

  return {
    value,
    toggle: () => setValue((v) => !v),
    setTrue: () => setValue(true),
    setFalse: () => setValue(false),
  };
};

export const ComposedApp = rx((props, ctx) => {
  const counter = ctx.use(useCounter, 0);
  const darkMode = ctx.use(useToggle, false);

  return (
    <div className={ctx.part(() => (darkMode.value() ? "dark" : "light"))}>
      <h1>{ctx.part(counter.count)}</h1>
      <button onClick={counter.increment}>+</button>
      <button onClick={counter.decrement}>-</button>
      <button onClick={counter.reset}>Reset</button>

      <label>
        Dark Mode:{" "}
        <input
          type="checkbox"
          checked={ctx.part(darkMode.value)}
          onChange={darkMode.toggle}
        />
      </label>
    </div>
  );
});

// ============================================
// Example 5: Cleanup with WebSocket
// ============================================

export const WebSocketDemo = rx(
  async ({ url }: { url: string }, ctx) => {
    const [getMessage, setMessage] = ctx.state<string | null>(null);
    const [getStatus, setStatus] = ctx.state<"connecting" | "connected" | "error">("connecting");

    const ws = new WebSocket(url);

    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (event) => setMessage(event.data);

    // Single cleanup
    ctx.on({ cleanup: () => ws.close() });

    // Or multiple cleanups
    ctx.on({
      cleanup: [
        () => ws.close(),
        () => console.log("WebSocket cleaned up"),
      ],
    });

    return (
      <div>
        <h1>WebSocket Status: {ctx.part(getStatus)}</h1>
        <p>Latest message: {ctx.part(() => getMessage() ?? "None")}</p>
        <button onClick={() => ws.send("Hello")}>Send Message</button>
      </div>
    );
  },
  {
    loading: <div>Connecting to WebSocket...</div>,
    error: (err) => <div>Connection failed: {err.message}</div>,
  }
);

// ============================================
// Example 6: Reactive Hooks
// ============================================

export const ReactiveHooksDemo = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);
  const [name, setName] = ctx.state("John");

  // Hook re-executes when count changes
  const doubled = ctx.hook(() => {
    const c = count(); // Tracks count
    return React.useMemo(() => c * 2, [c]);
  });

  // Hook re-executes when count OR name changes
  const message = ctx.hook(() => {
    const c = count();
    const n = name();
    return React.useMemo(() => `${n} has ${c} items`, [c, n]);
  });

  return (
    <div>
      <h1>{ctx.part(() => message.current)}</h1>
      <p>Doubled: {ctx.part(() => doubled.current)}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <input value={ctx.part(name)} onChange={(e) => setName(e.target.value)} />
    </div>
  );
});

// ============================================
// Example 7: Conditional Hooks (Safe!)
// ============================================

export const ConditionalHooksDemo = rx((props, ctx) => {
  const [showAdvanced, setShowAdvanced] = ctx.state(false);

  // This is safe! Hook collected once, then rendered consistently
  const advancedFeature =
    showAdvanced() &&
    ctx.hook(() => {
      React.useEffect(() => {
        console.log("Advanced feature mounted");
        return () => console.log("Advanced feature unmounted");
      }, []);
      return "Advanced feature data";
    });

  return (
    <div>
      <button onClick={() => setShowAdvanced((v) => !v)}>
        Toggle Advanced
      </button>
      {ctx.part(() => showAdvanced() && <div>Advanced Mode Active</div>)}
      {ctx.part(
        () => advancedFeature && <div>Data: {advancedFeature.current}</div>
      )}
    </div>
  );
});

