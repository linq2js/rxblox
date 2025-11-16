import { blox, rx, signal } from "rxblox";
import { todoStore } from "../store/todoStore";
import { Todo } from "../store/createTodoStore";

type TodoItemProps = Todo;

export const TodoItem = blox((props: TodoItemProps) => {
  // Use signals instead of useState in blox components
  const editing = signal(false);
  const editText = signal("");

  const handleDoubleClick = () => {
    editing.set(true);
    editText.set(props.text);
  };

  const handleSubmit = () => {
    const trimmed = editText().trim();
    if (trimmed) {
      todoStore.updateTodoText(props.id, trimmed);
      editing.set(false);
    } else {
      todoStore.removeTodo(props.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      editText.set(props.text);
      editing.set(false);
    }
  };

  const handleBlur = () => {
    handleSubmit();
  };

  const handleToggle = () => {
    todoStore.toggleTodo(props.id);
  };

  const handleRemove = () => {
    todoStore.removeTodo(props.id);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    editText.set(e.target.value);
  };

  const editPart = rx(
    () =>
      editing() && (
        <input
          className="edit"
          value={editText()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
        />
      )
  );

  const textPart = rx(() => {
    console.log("rendering textPart", Math.random());
    return <label onDoubleClick={handleDoubleClick}>{props.text}</label>;
  });

  const removePart = <button className="destroy" onClick={handleRemove} />;

  const inputPart = rx(() => (
    <input
      className="toggle"
      type="checkbox"
      checked={props.completed}
      onChange={handleToggle}
    />
  ));

  return rx(() => (
    <li
      className={`${props.completed && "completed"} ${editing() && "editing"}`}
    >
      <div className="view">
        {inputPart}
        {textPart}
        {removePart}
      </div>
      {editPart}
    </li>
  ));
});
