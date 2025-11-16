import { blox, rx } from "rxblox";
import { todoStore } from "../store/todoStore";

export const Footer = blox(() => {
  const allFilter = rx(() => (
    <a
      className={todoStore.filter() === "all" ? "selected" : ""}
      onClick={todoStore.setFilterAll}
      style={{ cursor: "pointer" }}
    >
      All
    </a>
  ));

  const activeFilter = rx(() => (
    <a
      className={todoStore.filter() === "active" ? "selected" : ""}
      onClick={todoStore.setFilterActive}
      style={{ cursor: "pointer" }}
    >
      Active
    </a>
  ));
  const completedFilter = rx(() => {
    console.log("rendering completedFilter");
    return (
      <a
        className={todoStore.filter() === "completed" ? "selected" : ""}
        onClick={todoStore.setFilterCompleted}
        style={{ cursor: "pointer" }}
      >
        Completed
      </a>
    );
  });
  const clearCompletedButton = rx(
    () =>
      todoStore.completed().length > 0 && (
        <button className="clear-completed" onClick={todoStore.clearCompleted}>
          Clear completed
        </button>
      )
  );

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
        <li>{allFilter}</li>
        <li>{activeFilter}</li>
        <li>{completedFilter}</li>
      </ul>
      {clearCompletedButton}
    </footer>
  );
});
