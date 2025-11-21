/**
 * Examples demonstrating rx, useScope, useAwaited, and useLoadable
 */

import { Suspense } from "react";
import { signal, rx, useScope, useAwaited, useLoadable } from "rextive";

// ============================================================================
// Example 1: rx with static render (no auto-tracking)
// ============================================================================

const StaticExample = () => {
  let count = 0;

  return (
    <div>
      {/* Never re-renders - static content */}
      {rx(() => (
        <button onClick={() => count++}>
          Count: {count}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Example 2: rx with manual watch array
// ============================================================================

const ManualWatchExample = ({ userId }: { userId: number }) => {
  return (
    <div>
      {/* Re-renders when userId prop changes */}
      {rx(() => (
        <div>User ID: {userId}</div>
      ), { watch: [userId] })}
    </div>
  );
};

// ============================================================================
// Example 3: rx with explicit signals (Suspense pattern)
// ============================================================================

const user = signal({ id: 1, name: "Alice" });
const posts = signal(
  { user },
  async ({ deps }) => {
    const response = await fetch(`/api/users/${deps.user.id}/posts`);
    return response.json();
  }
);

const ProfileWithSuspense = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* Automatically re-renders when user or posts change */}
      {/* awaited.posts throws promise until resolved (Suspense) */}
      {rx({ user, posts }, (awaited) => (
        <div>
          <h1>{awaited.user.name}</h1>
          <ul>
            {awaited.posts.map((post: any) => (
              <li key={post.id}>{post.title}</li>
            ))}
          </ul>
        </div>
      ))}
    </Suspense>
  );
};

// ============================================================================
// Example 4: rx with loadable (manual loading states)
// ============================================================================

const ProfileWithLoadable = () => {
  return (
    <div>
      {/* loadable provides manual control over loading/error states */}
      {rx({ user, posts }, (_awaited, loadable) => {
        const postsLoadable = loadable.posts;

        if (postsLoadable.status === "loading") {
          return <div>Loading posts...</div>;
        }

        if (postsLoadable.status === "error") {
          return <div>Error: {postsLoadable.error.message}</div>;
        }

        return (
          <div>
            <h1>{loadable.user.value.name}</h1>
            <ul>
              {postsLoadable.value.map((post: any) => (
                <li key={post.id}>{post.title}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// Example 5: useScope - Component-scoped signals
// ============================================================================

const CounterWithScope = () => {
  // Signals are created once and cleaned up on unmount
  const { count, doubled } = useScope(() => ({
    count: signal(0),
    doubled: signal({ count: signal(0) }, ({ deps }) => deps.count * 2)
  }));

  return (
    <div>
      {rx({ count, doubled }, (awaited) => (
        <>
          <div>Count: {awaited.count}</div>
          <div>Doubled: {awaited.doubled}</div>
          <button onClick={() => count.set(count() + 1)}>
            Increment
          </button>
        </>
      ))}
    </div>
  );
};

// ============================================================================
// Example 6: useScope with watch (recreate on prop change)
// ============================================================================

const UserDataFetcher = ({ userId }: { userId: number }) => {
  // Recreate scope when userId changes
  const { userData } = useScope(
    () => ({
      userData: signal(async () => {
        const response = await fetch(`/api/users/${userId}`);
        return response.json();
      })
    }),
    {
      watch: [userId], // Recreate when userId changes
      onDispose: () => {
        console.log('Cleaning up user data');
      }
    }
  );

  return (
    <Suspense fallback={<div>Loading user...</div>}>
      {rx({ userData }, (awaited) => (
        <div>
          <h2>{awaited.userData.name}</h2>
          <p>{awaited.userData.email}</p>
        </div>
      ))}
    </Suspense>
  );
};

// ============================================================================
// Example 7: useScope with onUpdate (sync with props)
// ============================================================================

const SyncedTimer = ({ initialValue }: { initialValue: number }) => {
  const { timer } = useScope(
    () => ({
      timer: signal(initialValue)
    }),
    {
      onUpdate: [(scope) => {
        // Sync timer with latest prop value
        scope.timer.set(initialValue);
      }, initialValue], // Re-run when initialValue changes
      watch: [] // Don't recreate scope
    }
  );

  return (
    <div>
      {rx({ timer }, (awaited) => (
        <>
          <div>Timer: {awaited.timer}</div>
          <button onClick={() => timer.set(timer() + 1)}>
            Tick
          </button>
        </>
      ))}
    </div>
  );
};

// ============================================================================
// Example 8: Lazy tracking - Only subscribes to accessed signals
// ============================================================================

const LazyTrackingExample = () => {
  const { flag, expensive, cheap } = useScope(() => ({
    flag: signal(true),
    expensive: signal(() => {
      console.log('🔴 Expensive computed!');
      return Array(10000).fill(0).reduce((a, b) => a + b);
    }),
    cheap: signal(() => {
      console.log('🟢 Cheap computed!');
      return 42;
    })
  }));

  return (
    <div>
      {/* Only subscribes to flag and whichever signal is accessed */}
      {rx({ flag, expensive, cheap }, (awaited) => (
        <>
          <div>
            {awaited.flag ? (
              <div>Cheap: {awaited.cheap}</div> // Only cheap is tracked
            ) : (
              <div>Expensive: {awaited.expensive}</div> // Only expensive is tracked
            )}
          </div>
          <button onClick={() => flag.set(!flag())}>
            Toggle
          </button>
        </>
      ))}
    </div>
  );
};

// ============================================================================
// Key Features Demonstrated:
// ============================================================================

/*
✅ rx() with two overloads:
   1. Static/manual render with optional watch array
   2. Explicit signals with awaited/loadable proxies

✅ useScope():
   - Component-scoped disposables (auto-cleanup)
   - Recreate on dependency changes (watch)
   - Sync with props (onUpdate)
   - Custom cleanup (onDispose)

✅ Lazy tracking via proxies:
   - Only subscribes to signals that are actually accessed
   - Conditional tracking based on render logic
   - Efficient - no unnecessary subscriptions

✅ Two async patterns:
   - awaited: Throws promises (Suspense integration)
   - loadable: Manual state handling (loading/success/error)

✅ Reactive rendering:
   - Automatic re-renders when tracked signals change
   - Memoization based on watch dependencies
   - Clean subscription management

⚡ Performance benefits:
   - Lazy signal computation
   - Conditional tracking
   - Automatic cleanup
   - Efficient re-renders
*/

export {
  StaticExample,
  ManualWatchExample,
  ProfileWithSuspense,
  ProfileWithLoadable,
  CounterWithScope,
  UserDataFetcher,
  SyncedTimer,
  LazyTrackingExample
};

