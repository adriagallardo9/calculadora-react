# 🧮 Calculadora en React

Una calculadora moderna, responsiva y completa creada con **React** y **Vite**.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## ✨ Características

- ➕ **Operaciones básicas**: Suma (`+`), Resta (`−`), Multiplicación (`×`) y División (`÷`).
- 🔬 **Funciones científicas**:
  - **Raíz cuadrada (`√x`)**: Con control de números negativos.
  - **Logaritmo base 10 (`log`)**: Con validación de dominio ($x > 0$).
  - **Logaritmo natural (`ln`)**: En base $e$ con validación de dominio ($x > 0$).
  - **Potencia al cuadrado (`x²`)**: Elevar un número al cuadrado directamente.
- 🎯 **Operaciones complementarias**:
  - Porcentaje (`%`)
  - Cambio de signo positivo/negativo (`±`)
  - Borrado dígito a dígito (`⌫`) y borrado total (`AC`)
- 🕒 **Historial de operaciones**: Panel deslizable que almacena los últimos cálculos con posibilidad de reutilizar resultados pasados o vaciar el historial.
- 🌓 **Temas Claro y Oscuro**: Alternancia de tema con persistencia automática en `localStorage`.
- 📋 **Copiar al portapapeles**: Botón rápido para copiar el resultado actual con confirmación visual.
- 🔊 **Feedback sonoro**: Efectos sutiles de clic sintetizados mediante Web Audio API con opción de silenciar.
- ⌨️ **Soporte completo de teclado físico**:
  - Números: `0` - `9`
  - Operadores: `+`, `-`, `*`, `/`
  - Calcular: `Enter` o `=`
  - Raíz cuadrada: `R`
  - Logaritmo (base 10): `L`
  - Logaritmo natural: `N`
  - Elevar al cuadrado: `S` o `^`
  - Borrar: `Backspace`
  - Limpiar: `Escape`
  - Decimal: `.` o `,`

---

## 🚀 Instalación y uso local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/adriagallardo9/calculadora-react.git
   cd calculadora-react
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

4. **Compilar para producción**:
   ```bash
   npm run build
   ```
