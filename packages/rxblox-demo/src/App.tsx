import { signal, rx, blox, effect, provider } from "rxblox";
import "./App.css";

// Create a global counter signal
const globalCount = signal(0);

// Create providers for dependency injection
const [withTheme, ThemeProvider] = provider(
  "theme",
  "light" as "light" | "dark"
);
const [withCount, CountProvider] = provider("count", 0);

const Greeting = blox(() => {
  const name = signal("World");

  return (
    <div>
      <h1>Hello, {rx(name)}</h1>
      <div>
        {rx("input", {
          value: name,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            name.set(e.target.value),
        })}
      </div>
    </div>
  );
});

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>RxBlox Counter Demo</h1>
        <p>
          Demonstrating reactive state management with signals, effects, and
          reactive components
        </p>
      </header>

      <main className="App-main">
        <section>
          <h3>Greeting</h3>
          <Greeting />
        </section>
        {/* Simple counter using rx() for reactive rendering */}
        <section className="counter-section">
          <h2>Simple Counter (using rx)</h2>
          <div className="counter-display">
            {rx(() => (
              <div className="count-value">{globalCount()}</div>
            ))}
          </div>
          <div className="counter-controls">
            <button onClick={() => globalCount.set(globalCount() - 1)}>
              -
            </button>
            <button onClick={() => globalCount.set(0)}>Reset</button>
            <button onClick={() => globalCount.set(globalCount() + 1)}>
              +
            </button>
            <button onClick={() => globalCount.set((prev) => prev + 10)}>
              +10
            </button>
          </div>
        </section>

        {/* Counter component using blox */}
        <section className="counter-section">
          <h2>Counter Component (using blox)</h2>
          <CounterComponent initialCount={0} />
        </section>

        {/* Counter with effects */}
        <section className="counter-section">
          <h2>Counter with Effects</h2>
          <CounterWithEffects />
        </section>

        {/* Multiple counters */}
        <section className="counter-section">
          <h2>Multiple Independent Counters</h2>
          <div className="counters-grid">
            <CounterComponent initialCount={0} />
            <CounterComponent initialCount={5} />
            <CounterComponent initialCount={10} />
          </div>
        </section>

        {/* Provider example */}
        <section className="counter-section">
          <h2>Provider Pattern (Dependency Injection)</h2>
          <ProviderExample />
        </section>

        {/* Theme provider example */}
        <section className="counter-section">
          <h2>Theme Provider Example</h2>
          <ThemeExample />
        </section>
      </main>
    </div>
  );
}

// Counter component using blox
const CounterComponent = blox<{ initialCount: number }>((props) => {
  // Create a local signal for this component instance
  const localCount = signal(props.initialCount);

  // Lifecycle hook example
  blox.onMount(() => {
    console.log(`Counter mounted with initial value: ${props.initialCount}`);
  });

  // Log when count changes
  effect(() => {
    const current = localCount();
    if (current > 0) {
      console.log(`Counter (initial: ${props.initialCount}) is now:`, current);
    }
  });

  return (
    <div className="counter-card">
      <div className="counter-display">
        {rx(() => (
          <div className="count-value">{localCount()}</div>
        ))}
      </div>
      <div className="counter-controls">
        <button onClick={() => localCount.set(localCount() - 1)}>-</button>
        <button onClick={() => localCount.set(props.initialCount)}>
          Reset
        </button>
        <button onClick={() => localCount.set(localCount() + 1)}>+</button>
      </div>
      <div className="counter-info">Initial: {props.initialCount}</div>
    </div>
  );
});

const EvenBadge = rx(() => {
  const isEven = globalCount() % 2 === 0;
  return (
    <span className={isEven ? "status-badge even" : "status-badge odd"}>
      {isEven ? "Even" : "Odd"}
    </span>
  );
});

const PositiveNegativeBadge = rx(() => {
  const isPositive = globalCount() >= 0;

  return (
    <span
      className={isPositive ? "status-badge positive" : "status-badge negative"}
    >
      {isPositive ? "Positive" : "Negative"}
    </span>
  );
});

// Counter component with effects that track the global count
const CounterWithEffects = blox(() => {
  // Effect that runs when count changes
  effect(() => {
    const current = globalCount();

    if (current === 10) {
      console.log("🎉 Count reached 10!");
    }
    if (current < 0) {
      console.warn("⚠️ Count is negative:", current);
    }
  });

  return (
    <div className="counter-card">
      <div className="counter-display">
        {rx(() => (
          <div className="count-value">{globalCount()}</div>
        ))}
      </div>
      <div className="counter-info">
        {rx(() => (
          <div className="status-info">
            {EvenBadge}
            {PositiveNegativeBadge}
          </div>
        ))}
      </div>
      <div className="counter-controls">
        <button onClick={() => globalCount.set(globalCount() - 1)}>-</button>
        <button onClick={() => globalCount.set(0)}>Reset</button>
        <button onClick={() => globalCount.set(globalCount() + 1)}>+</button>
      </div>
    </div>
  );
});

// Provider example - demonstrates dependency injection
const ProviderExample = blox(() => {
  const Parent = blox<{ count: number }>((props) => {
    return rx(() => (
      <CountProvider value={props.count}>
        <div className="counter-card">
          <h3>Provider Counter</h3>
          <ProviderCounter />
          <ProviderDisplay />
        </div>
      </CountProvider>
    ));
  });

  const count = signal(0);

  return (
    <div>
      <div className="counter-controls" style={{ marginBottom: "1rem" }}>
        <button onClick={() => count.set(count() - 1)}>-</button>
        <button onClick={() => count.set(0)}>Reset</button>
        <button onClick={() => count.set(count() + 1)}>+</button>
      </div>
      {rx(() => (
        <Parent count={count()} />
      ))}
    </div>
  );
});

// Consumer component that uses the provider
const ProviderCounter = blox(() => {
  const count = withCount();

  return (
    <div className="counter-display">
      {rx(() => (
        <div className="count-value">{count()}</div>
      ))}
    </div>
  );
});

// Another consumer of the same provider
const ProviderDisplay = blox(() => {
  const count = withCount();

  return (
    <div className="counter-info">
      {rx(() => (
        <div>
          <p>Count from provider: {count()}</p>
          <p>Doubled: {count() * 2}</p>
        </div>
      ))}
    </div>
  );
});

const ThemeProviderWrapper = blox<{ theme: "light" | "dark" }>((props) => {
  return rx(() => (
    <ThemeProvider value={props.theme}>
      <div className="theme-example">
        <ThemeDisplay />
        <ThemeButton />
      </div>
    </ThemeProvider>
  ));
});

// Theme provider example
const ThemeExample = blox(() => {
  const theme = signal<"light" | "dark">("light");
  const changeTheme = () => {
    theme.set((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div>
      <div className="counter-controls" style={{ marginBottom: "1rem" }}>
        <button onClick={changeTheme}>Toggle Theme</button>
      </div>
      {rx(() => (
        <ThemeProviderWrapper theme={theme()} />
      ))}
    </div>
  );
});

const ThemeDisplay = blox(() => {
  const theme = withTheme();

  return rx(() => (
    <div
      style={{
        padding: "1rem",
        backgroundColor: theme() === "light" ? "#fff" : "#333",
        color: theme() === "light" ? "#000" : "#fff",
        borderRadius: "8px",
        marginBottom: "1rem",
      }}
    >
      <div>
        <h4>Current Theme: {theme()}</h4>
        <p>This component receives theme from provider</p>
      </div>
    </div>
  ));
});

const ThemeButton = blox(() => {
  const theme = withTheme();

  return rx(() => (
    <button
      style={{
        padding: "0.5rem 1rem",
        backgroundColor: theme() === "light" ? "#007bff" : "#0056b3",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Theme: {theme()}
    </button>
  ));
});

export default App;
