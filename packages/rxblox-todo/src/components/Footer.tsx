import { blox, rx } from "rxblox";
import { todoStore } from "../store/todoStore";

export const Footer = blox(() => {
  return (
    <footer className="footer">
      <span className="todo-count">
        {rx(() => (
          <>
            <strong>{todoStore.activeTodos().length}</strong>{" "}
            {todoStore.activeTodos().length === 1 ? "item" : "items"} left
          </>
        ))}
      </span>
      <ul className="filters">
        <li>
          {rx(() => (
            <a
              className={todoStore.filter() === "all" ? "selected" : ""}
              onClick={todoStore.setFilterAll}
              style={{ cursor: "pointer" }}
            >
              All
            </a>
          ))}
        </li>
        <li>
          {rx(() => (
            <a
              className={todoStore.filter() === "active" ? "selected" : ""}
              onClick={todoStore.setFilterActive}
              style={{ cursor: "pointer" }}
            >
              Active
            </a>
          ))}
        </li>
        <li>
          {rx(() => (
            <a
              className={todoStore.filter() === "completed" ? "selected" : ""}
              onClick={todoStore.setFilterCompleted}
              style={{ cursor: "pointer" }}
            >
              Completed
            </a>
          ))}
        </li>
      </ul>
      {rx(
        () =>
          todoStore.completedTodos().length > 0 && (
            <button
              className="clear-completed"
              onClick={todoStore.clearCompleted}
            >
              Clear completed
            </button>
          )
      )}
    </footer>
  );
});
