# Hybrid Calculator

This project is a modern, feature-rich, and visually appealing calculator built using **HTML5**, **CSS3**, and **JavaScript**. It's designed to be a showcase of robust front-end development, combining clean code with an exceptional user experience.

---

## Features

* **Full Arithmetic Functionality**: Supports all standard operations: addition `+`, subtraction `−`, multiplication `×`, division `÷`, and percentage `%`.
* **Scientific Mode**: `sin`, `cos`, `tan`, `log`, `ln`, `√`, `x^y`, `x²`, `1/x`, `n!`, `π`, `e`, and a DEG/RAD angle-mode toggle. Functions and the power operator are handled by a custom tokenizer + shunting-yard parser, so expressions like `2*sin(30)+5^2` evaluate correctly with proper precedence.
* **Memory Functions**: `MC`, `MR`, `M+`, `M-`, and `MS`, with a small on-screen indicator whenever a value is stored in memory.
* **Calculation History**: Every successful calculation is saved and persisted with `localStorage`, so it survives page reloads. Open it from the clock icon, tap any entry to reuse its result, or clear it entirely.
* **Unit Converter**: A dedicated tab for Length, Weight, and Temperature conversions with a one-click swap button.
* **Copy to Clipboard**: A copy icon on the display copies the current result, with a toast confirmation.
* **Sound Feedback**: Lightweight click sounds (generated with the Web Audio API, no external files) that can be muted/unmuted and remember the preference.
* **Dynamic Theming System**: A core feature that allows users to instantly switch between **20+ unique and predefined color themes** with a single click, remembered across sessions. This is achieved efficiently using **CSS variables**, making the design highly customizable and scalable.
* **Responsive Design**: The interface is fully responsive, ensuring a seamless experience on desktops, tablets, and mobile devices.
* **Interactive UI/UX**: The user interface is designed for clarity and ease of use, with distinct button styles for numbers, operators, functions, memory, and scientific keys. Buttons have subtle hover, active, and focus states for enhanced feedback.
* **Real-time Evaluation**: The calculator provides a live preview of the result as the user types, offering immediate feedback and reducing errors.
* **Advanced Expression Parsing**: The JavaScript logic handles complex expressions with multiple operations, functions, and parentheses, ensuring accurate calculations. It also correctly handles unary minus and order of operations (including right-associative exponentiation).
* **Keyboard Support**: Users can interact with the calculator directly using their keyboard, providing a faster and more efficient way to perform calculations.
* **Accessibility**: The calculator includes semantic HTML and `aria` attributes to ensure it's accessible to users with disabilities.

---

## Technologies Used

* **HTML5**: For the fundamental structure of the calculator.
* **CSS3**: For all styling, animations, and the dynamic theming system. It utilizes `CSS variables` and `linear-gradients` to create the polished, glassy UI.
* **JavaScript (ES6+)**: For all the core logic, including handling user input, expression parsing, calculation, and theme switching.

---

## Project Structure
```
hybrid-calculator/
├── index.html          # Main HTML file for the calculator
├── style.css           # All CSS for styling and theming
├── script.js           # The JavaScript logic for functionality
├── README.md           # This file
└── ...
```

---

## How to Run

1.  Clone the repository:
    `git clone <repository-url>`
2.  Open the `index.html` file in your preferred web browser.

No server or additional setup is required. The project runs completely on the client side.

---

This project was developed by **Noura Maher**.

---

## Contact

For questions or suggestions, please open an issue or contact:
Noura Maher Elamin
[LinkedIn](https://www.linkedin.com/in/nouramaher/)
[GitHub](https://github.com/NouraMaher)

---

<div align="center">

⭐️ If you find this project helpful, please give it a star!

</div>
