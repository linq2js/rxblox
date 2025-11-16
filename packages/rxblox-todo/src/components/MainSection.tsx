import { blox, rx } from "rxblox";
import { todoStore } from "../store/todoStore";
import { TodoItem } from "./TodoItem";

export const MainSection = blox(function MainSection() {
  return (
    <>
      <section className="main">
        {rx(() => {
          return (
            <input
              id="toggle-all"
              className="toggle-all"
              type="checkbox"
              checked={todoStore.allCompleted()}
              onChange={todoStore.toggleAll}
            />
          );
        })}
        <label htmlFor="toggle-all">Mark all as complete</label>
        <ul className="todo-list">
          {/* use peek to avoid tracking dependencies */}
          {rx(() => {
            const filter = todoStore.filter();
            const filteredTodos =
              filter === "all"
                ? todoStore.todos()
                : filter === "active"
                ? todoStore.activeTodos()
                : todoStore.completedTodos();

            return filteredTodos.map((todo) => (
              <TodoItem key={todo.id} {...todo} />
            ));
          })}
        </ul>
      </section>
    </>
  );
});
