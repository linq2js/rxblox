import { debounce } from "lodash-es";
import { Persistor, signal } from "rxblox";
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
  const persist: Persistor<Todo[]> = {
    get() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        console.log("todos loaded");
        return {
          value: (JSON.parse(stored) as Todo[]).map((todo) => todo),
        };
      }
      console.log("no todos found");
      return null;
    },
    set: debounce((value: Todo[]) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      console.log("todos saved");
    }, 300),
  };

  /**
   * Main todos signal with persistence.
   * Contains an array of signals, where each signal holds one todo.
   */
  const todos = signal<Todo[]>([], { persist });

  /**
   * Current filter for displaying todos.
   */
  const filter = signal<TodoFilter>("all");
  const activeTodos = signal(
    () => {
      return todos().filter((todo) => !todo.completed);
    },
    { equals: shallowEqual }
  );
  const completedTodos = signal(
    () => {
      return todos().filter((todo) => todo.completed);
    },
    { equals: shallowEqual }
  );

  const allCompleted = signal(
    () => {
      return todos().every((todo) => todo.completed);
    },
    { equals: shallowEqual }
  );

  const updateTodo = (
    filter: (todo: Todo) => boolean,
    updater: (todo: Todo) => void | "remove",
    count = -1
  ) => {
    const removed: number[] = [];

    todos.set((draft) => {
      draft.forEach((todo, index) => {
        if (filter(todo)) {
          if (count === 0) return;
          if (count > 0) {
            count--;
          }
          if (updater(todo) === "remove") {
            removed.push(index);
          }
        }
      });

      while (removed.length > 0) {
        draft.splice(removed.pop()!, 1);
      }
    });
  };

  return {
    // Expose state
    todos,
    filter,
    activeTodos,
    completedTodos,
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

      todos.set((draft) => {
        draft.push(createTodo(trimmed));
      });
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
      updateTodo(
        (todo) => todo.id === id,
        () => "remove",
        1
      );
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
      updateTodo(
        (todo) => todo.id === id,
        (todo) => {
          todo.completed = !todo.completed;
        },
        1
      );
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
      updateTodo(
        (todo) => todo.id === id,
        (todo) => {
          todo.text = text;
        },
        1
      );
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
      const allCompleted = todos().every((todo) => todo.completed);

      updateTodo(
        () => true,
        (todo) => {
          todo.completed = !allCompleted;
        }
      );
    },

    /**
     * Remove all completed todos.
     *
     * Automatically triggers persistence via the todos signal change.
     * No need to emit onTodosChange since the array itself changes.
     */
    clearCompleted() {
      updateTodo(
        (todo) => todo.completed,
        () => "remove"
      );
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
