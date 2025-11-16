import { blox, rx } from "rxblox";
import { todoStore } from "../store/todoStore";
import { TodoItem } from "./TodoItem";

export const MainSection = blox(function MainSection() {
  return (
    <section className="main">
      {rx(() => (
        <input
          id="toggle-all"
          className="toggle-all"
          type="checkbox"
          checked={todoStore.allCompleted()}
          onChange={todoStore.toggleAll}
        />
      ))}
      <label htmlFor="toggle-all">Mark all as complete</label>
      <ul className="todo-list">
        {rx(() => {
          const filter = todoStore.filter();
          const filteredTodos =
            filter === "all"
              ? todoStore.keys()
              : filter === "active"
              ? todoStore.active()
              : todoStore.completed();

          return filteredTodos.map((id) => <TodoItem key={id} id={id} />);
        })}
      </ul>
    </section>
  );
});
