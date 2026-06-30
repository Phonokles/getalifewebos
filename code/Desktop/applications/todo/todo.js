document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});

const DEFAULT_ROUTINE = [
  { name: 'Morning', items: [
    { id: 'm-eat',   text: 'eat',          type: 'check' },
    { id: 'm-drink', text: 'drink',        type: 'counter', target: 3 },
    { id: 'm-bed',   text: 'do your bed',  type: 'check' },
    { id: 'm-dress', text: 'dress up',     type: 'check' },
    { id: 'm-clean', text: 'be clean',     type: 'check' },
    { id: 'm-work',  text: 'go to work',   type: 'check' },
  ]},
  { name: 'Midday', items: [
    { id: 'd-eat',   text: 'eat',          type: 'check' },
    { id: 'd-water', text: 'drink water',  type: 'counter', target: 5 },
    { id: 'd-work',  text: 'work',         type: 'check' },
    { id: 'd-sport', text: 'do sport',     type: 'check' },
  ]},
  { name: 'Evening', items: [
    { id: 'e-eat',   text: 'eat',            type: 'check' },
    { id: 'e-water', text: 'drink water',    type: 'counter', target: 3 },
    { id: 'e-relax', text: 'relax',          type: 'check' },
    { id: 'e-plan',  text: 'plan tomorrow',  type: 'check' },
  ]},
  { name: 'Night', items: [
    { id: 'n-teeth', text: 'brush teeth', type: 'check' },
    { id: 'n-sleep', text: 'go to bed',   type: 'check' },
  ]},
  { name: 'Custom', items: [] },
];

function loadTodoState() {
  // Tiefe Kopie der Defaults mit Laufzeit-Feldern (done / count)
  // Es wird bewusst nichts gespeichert -- jeder Aufruf startet frisch.
  return DEFAULT_ROUTINE.map(section => ({
    name: section.name,
    items: section.items.map(item =>
      item.type === 'counter'
        ? { ...item, count: 0 }
        : { ...item, done: false }
    )
  }));
}

let todoState = loadTodoState();

function isItemDone(item) {
  return item.type === 'counter' ? item.count >= item.target : item.done;
}

function findTodoItem(id) {
  for (const section of todoState) {
    const item = section.items.find(i => i.id === id);
    if (item) return item;
  }
  return null;
}

function renderTodos() {
  const body = document.getElementById('todo-body');
  body.innerHTML = '';

  todoState.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'todo-section';

    const title = document.createElement('div');
    title.className = 'todo-section-title';
    title.textContent = section.name;
    sectionEl.appendChild(title);

    if (section.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'todo-empty';
      empty.textContent = 'nothing here yet';
      sectionEl.appendChild(empty);
    }

    section.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'todo-item' + (isItemDone(item) ? ' done' : '');

      if (item.type === 'counter') {
        row.innerHTML = `
          <button class="todo-check" data-id="${item.id}" data-action="toggle-counter"></button>
          <span class="todo-label">${item.text}</span>
          <div class="todo-counter">
            <button class="todo-counter-btn" data-id="${item.id}" data-action="dec">−</button>
            <span class="todo-counter-value">${item.count}/${item.target}</span>
            <button class="todo-counter-btn" data-id="${item.id}" data-action="inc">+</button>
          </div>
        `;
      } else {
        row.innerHTML = `
          <button class="todo-check" data-id="${item.id}" data-action="toggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
          <span class="todo-label">${item.text}</span>
        `;
      }

      sectionEl.appendChild(row);
    });

    body.appendChild(sectionEl);
  });

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleTodoAction(btn.dataset.id, btn.dataset.action));
  });
}

function handleTodoAction(id, action) {
  const item = findTodoItem(id);
  if (!item) return;

  if (action === 'toggle') {
    item.done = !item.done;
  } else if (action === 'inc') {
    item.count = Math.min(item.target, item.count + 1);
  } else if (action === 'dec') {
    item.count = Math.max(0, item.count - 1);
  } else if (action === 'toggle-counter') {
    item.count = item.count >= item.target ? 0 : item.target;
  }

  renderTodos();
}

function addCustomTodo() {
  const input = document.getElementById('todo-new-input');
  const text = input.value.trim();
  if (!text) return;

  let customSection = todoState.find(s => s.name === 'Custom');
  if (!customSection) {
    customSection = { name: 'Custom', items: [] };
    todoState.push(customSection);
  }

  customSection.items.push({
    id: 'c-' + Date.now(),
    text,
    type: 'check',
    done: false
  });

  input.value = '';
  renderTodos();
}

document.getElementById('todo-add-btn').addEventListener('click', addCustomTodo);
document.getElementById('todo-new-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCustomTodo();
});

renderTodos();