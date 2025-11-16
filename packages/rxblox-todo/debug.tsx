// Add debug logging to see what's happening
import { signal } from "rxblox";

const todos = signal([
  { id: 1, text: "a", completed: false },
  { id: 2, text: "b", completed: false },
]);

const oldArray = todos();
console.log("Array before:", oldArray);

// Toggle todo 1
todos.set(draft => {
  draft[0].completed = true;
});

const newArray = todos();
console.log("Array after:", newArray);
console.log("Array changed?", oldArray !== newArray);
console.log("Todo 1 changed?", oldArray[0] !== newArray[0]);
console.log("Todo 2 changed?", oldArray[1] !== newArray[1]);
