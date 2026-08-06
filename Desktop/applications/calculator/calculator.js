document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

window.addEventListener('message', (e) => {
  if (e.data?.type === 'setTheme') {
    document.documentElement.dataset.theme = e.data.theme;
  }
});
const displayEl = document.getElementById('calc-display');

let display = '0';
let firstOperand = null;
let operator = null;
let waitingForSecondOperand = false;

function updateDisplay() {
  displayEl.textContent = display;
}

function inputDigit(digit) {
  if (waitingForSecondOperand) {
    display = digit;
    waitingForSecondOperand = false;
  } else {
    display = display === '0' ? digit : display + digit;
  }
  updateDisplay();
}

function inputDecimal() {
  if (waitingForSecondOperand) {
    display = '0.';
    waitingForSecondOperand = false;
    updateDisplay();
    return;
  }
  if (!display.includes('.')) {
    display += '.';
    updateDisplay();
  }
}

function calculate(first, second, op) {
  switch (op) {
    case '+': return first + second;
    case '-': return first - second;
    case '×': return first * second;
    case '÷': return second === 0 ? NaN : first / second;
    default: return second;
  }
}

function roundResult(value) {
  return Math.round(value * 1e10) / 1e10; 
}

function handleOperator(nextOperator) {
  const inputValue = parseFloat(display);

  if (operator && waitingForSecondOperand) {
    operator = nextOperator;
    return;
  }

  if (firstOperand === null) {
    firstOperand = inputValue;
  } else if (operator) {
    const result = calculate(firstOperand, inputValue, operator);
    display = isNaN(result) ? 'Error' : String(roundResult(result));
    firstOperand = isNaN(result) ? null : result;
    updateDisplay();
  }

  waitingForSecondOperand = true;
  operator = nextOperator;
}

function handleEquals() {
  if (operator === null || waitingForSecondOperand) return;
  const inputValue = parseFloat(display);
  const result = calculate(firstOperand, inputValue, operator);
  display = isNaN(result) ? 'Error' : String(roundResult(result));
  firstOperand = null;
  operator = null;
  waitingForSecondOperand = false;
  updateDisplay();
}

function clearAll() {
  display = '0';
  firstOperand = null;
  operator = null;
  waitingForSecondOperand = false;
  updateDisplay();
}

function backspace() {
  if (waitingForSecondOperand || display === 'Error') {
    clearAll();
    return;
  }
  display = display.length > 1 ? display.slice(0, -1) : '0';
  updateDisplay();
}

function inputPercent() {
  const value = parseFloat(display);
  display = String(roundResult(value / 100));
  updateDisplay();
}


document.querySelectorAll('[data-action="digit"]').forEach(btn => {
  btn.addEventListener('click', () => inputDigit(btn.dataset.value));
});

document.querySelectorAll('[data-action="operator"]').forEach(btn => {
  btn.addEventListener('click', () => handleOperator(btn.dataset.value));
});

document.querySelector('[data-action="decimal"]').addEventListener('click', inputDecimal);
document.querySelector('[data-action="equals"]').addEventListener('click', handleEquals);
document.querySelector('[data-action="clear"]').addEventListener('click', clearAll);
document.querySelector('[data-action="backspace"]').addEventListener('click', backspace);
document.querySelector('[data-action="percent"]').addEventListener('click', inputPercent);


document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    inputDigit(e.key);
  } else if (e.key === '.' || e.key === ',') {
    inputDecimal();
  } else if (e.key === '+') {
    handleOperator('+');
  } else if (e.key === '-') {
    handleOperator('-');
  } else if (e.key === '*') {
    handleOperator('×');
  } else if (e.key === '/') {
    e.preventDefault();
    handleOperator('÷');
  } else if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault();
    handleEquals();
  } else if (e.key === 'Backspace') {
    backspace();
  } else if (e.key === 'Escape') {
    clearAll();
  } else if (e.key === '%') {
    inputPercent();
  }
});