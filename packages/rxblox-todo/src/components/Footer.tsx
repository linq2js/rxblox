import { blox, rx } from "rxblox";
import { todoStore } from "../store/todoStore";

const allFilterPart = rx(() => (
  <a
    className={todoStore.filter() === "all" ? "selected" : ""}
    onClick={todoStore.setFilterAll}
    style={{ cursor: "pointer" }}
  >
    All
  </a>
));

const activeFilterPart = rx(() => (
  <a
    className={todoStore.filter() === "active" ? "selected" : ""}
    onClick={todoStore.setFilterActive}
    style={{ cursor: "pointer" }}
  >
    Active
  </a>
));
const completedFilterPart = rx(() => (
  <a
    className={todoStore.filter() === "completed" ? "selected" : ""}
    onClick={todoStore.setFilterCompleted}
    style={{ cursor: "pointer" }}
  >
    Completed
  </a>
));
const clearCompletedButtonPart = rx(
  () =>
    todoStore.completed().length > 0 && (
      <button className="clear-completed" onClick={todoStore.clearCompleted}>
        Clear completed
      </button>
    )
);

export const Footer = blox(() => {
  return (
    <footer className="footer">
      <span className="todo-count">
        {rx(() => (
          <>
            <strong>{todoStore.active().length}</strong>{" "}
            {todoStore.active().length === 1 ? "item" : "items"} left
          </>
        ))}
      </span>
      <ul className="filters">
        <li>{allFilterPart}</li>
        <li>{activeFilterPart}</li>
        <li>{completedFilterPart}</li>
      </ul>
      {clearCompletedButtonPart}
    </footer>
  );
});
