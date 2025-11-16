import { useState } from "react";
import { todoStore } from "../store/todoStore";

export function Header() {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      todoStore.addTodo(input);
      setInput("");
    }
  };

  return (
    <header className="header">
      <h1>todos</h1>
      <input
        className="new-todo"
        placeholder="What needs to be done?"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleSubmit}
        autoFocus
      />
    </header>
  );
}
