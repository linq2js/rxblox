import { debounce, remove } from "lodash-es";
import { batch, Persistor, signal } from "rxblox";
import shallowEqual from "shallowequal";
/**
 * Filter types for displaying todos.
 */
export type TodoFilter = "all" | "active" | "completed";

/**
 * A single todo item.
 */
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

/**
 * Creates a todo store with reactive state and localStorage persistence.
 *
 * Architecture:
 * - Each todo is wrapped in its own signal for fine-grained reactivity
 * - The todos array is also a signal, tracking additions/removals
 * - Individual todo changes (toggle, edit) don't modify the array signal
 * - Uses an emitter to manually trigger persistence when todos change
 *
 * Why signals within an array?
 * - Allows updating a single todo without re-rendering all todos
 * - Components can subscribe to individual todo signals
 * - Provides optimal performance for large todo lists
 *
 * Persistence strategy:
 * - Hydrates from localStorage on initialization
 * - Debounces saves to avoid excessive writes
 * - Manually triggers persistence when individual todos change
 *   (since changing a todo signal doesn't change the array signal)
 */
export function createTodoStore() {
  const STORAGE_KEY = "rxblox-todos";

  /**
   * Custom persistor for storing todo signals in localStorage.
   *
   * On load:
   * - Reads plain todo objects from localStorage
   * - Wraps each todo in a signal for reactivity
   *
   * On save:
   * - Serializes the array of todo signals to JSON
   * - Debounced to batch multiple rapid changes
   * - Note: JSON.stringify automatically calls toJSON() on signals
   */
  const persistor = <T>(postfix: string = ""): Persistor<T> => {
    const key = STORAGE_KEY + "_" + postfix;
    return {
      get() {
        const stored = localStorage.getItem(key);
        if (stored) {
          console.log(`${key} loaded`);
          return {
            value: JSON.parse(stored),
          };
        }
        console.log(`${key} data not found`);
        return null;
      },
      set: debounce((value) => {
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`${key} saved`);
      }, 300),
    };
  };

  const keys = signal<string[]>([], { persist: persistor("keys") });
  const values = signal<Record<string, Todo>>(
    {},
    { persist: persistor("values") }
  );

  /**
   * Current filter for displaying todos.
   */
  const filter = signal<TodoFilter>("all");

  const active = signal(
    () => {
      const k = keys();
      const v = values();
      return k.filter((k) => !v[k].completed);
    },
    { equals: shallowEqual }
  );

  const completed = signal(
    () => {
      const k = keys();
      const v = values();
      return k.filter((k) => v[k].completed);
    },
    { equals: shallowEqual }
  );

  const allCompleted = signal(() => {
    return completed().length === keys().length;
  });

  return {
    // Expose state
    keys,
    values,
    filter,
    active,
    completed,
    allCompleted,

    /**
     * Add a new todo to the list.
     *
     * Automatically triggers persistence via the todos signal change.
     * No need to emit onTodosChange since the array itself changes.
     *
     * @param text - The text content of the new todo
     */
    addTodo(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return;
      const todo = createTodo(trimmed);
      values.set((prev) => ({ ...prev, [todo.id]: todo }));
      keys.set((prev) => [...prev, todo.id]);
    },

    /**
     * Remove a todo by ID.
     *
     * Automatically triggers persistence via the todos signal change.
     * No need to emit onTodosChange since the array itself changes.
     *
     * @param id - The ID of the todo to remove
     */
    removeTodo(id: string) {
      batch([keys, values], (k, v) => {
        remove(k, (x) => x === id);
        delete v[id];
      });
    },

    /**
     * Toggle a todo's completed status.
     *
     * Note: This modifies an individual todo signal, NOT the todos array.
     * The array reference stays the same, so persistence won't trigger
     * automatically. However, we don't emit here because toggleTodo is
     * often called rapidly (user clicking multiple items) and the debounced
     * persistence will batch these changes efficiently.
     *
     * @param id - The ID of the todo to toggle
     */
    toggleTodo(id: string) {
      values.set((draft) => {
        draft[id].completed = !draft[id].completed;
      });
    },

    /**
     * Update a todo's text content.
     *
     * Note: This modifies an individual todo signal, NOT the todos array.
     * Must manually emit onTodosChange to trigger persistence since the
     * array reference doesn't change.
     *
     * @param id - The ID of the todo to update
     * @param text - The new text content
     */
    updateTodoText(id: string, text: string) {
      values.set((draft) => {
        draft[id].text = text;
      });
    },

    /**
     * Toggle all todos between completed and active.
     *
     * If all todos are completed, mark all as active.
     * Otherwise, mark all as completed.
     *
     * Note: This modifies individual todo signals, NOT the todos array.
     * Must manually emit onTodosChange to trigger persistence.
     */
    toggleAll() {
      const completed = !allCompleted.peek();

      values.set((draft) => {
        keys.peek().forEach((key) => {
          draft[key].completed = completed;
        });
      });
    },

    /**
     * Remove all completed todos.
     *
     * Automatically triggers persistence via the todos signal change.
     * No need to emit onTodosChange since the array itself changes.
     */
    clearCompleted() {
      const completedKeys = completed.peek();
      values.set((draft) => {
        completedKeys.forEach((key) => {
          if (draft[key].completed) {
            delete draft[key];
          }
        });
      });
      keys.set((prev) => prev.filter((key) => !completedKeys.includes(key)));
    },
    setFilterCompleted() {
      filter.set("completed");
    },
    setFilterAll() {
      filter.set("all");
    },
    setFilterActive() {
      filter.set("active");
    },
  };
}

/**
 * Helper function to create a new todo wrapped in a signal.
 *
 * @param text - The text content of the todo
 * @param completed - Whether the todo is completed (default: false)
 * @returns A signal containing the todo object
 */
function createTodo(text: string, completed = false) {
  return {
    id: Math.random().toString(36).substring(7),
    text,
    completed,
  };
}
