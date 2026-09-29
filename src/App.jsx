import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import './App.css';

// Helper to round floating point numbers accurately (e.g. 0.1 + 0.2 = 0.3)
function cleanPrecision(num) {
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return 'Error';
  const rounded = parseFloat(Number(num).toPrecision(12));
  return rounded;
}

// Format number display with commas while preserving in-progress typing (like trailing dot)
function formatNumberDisplay(value) {
  if (value === 'Error') return 'Error';
  if (!value) return '0';

  const isNegative = value.startsWith('-');
  const rawValue = isNegative ? value.slice(1) : value;

  const parts = rawValue.split('.');
  const integerPart = parts[0] || '0';
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (parts.length > 1) {
    return `${isNegative ? '-' : ''}${formattedInteger}.${parts[1]}`;
  }

  return `${isNegative ? '-' : ''}${formattedInteger}${value.endsWith('.') ? '.' : ''}`;
}

export default function App() {
  const [currentInput, setCurrentInput] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [expression, setExpression] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('calc_theme') || 'dark';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  // Sync theme attribute with document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('calc_theme', theme);
  }, [theme]);

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('calc_history', JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }, [history]);

  // Load cloud history from Supabase if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isMounted = true;
    async function loadCloudHistory() {
      try {
        const { data, error } = await supabase
          .from('calculations')
          .select('id, expression, result, created_at')
          .order('created_at', { ascending: false })
          .limit(25);

        if (!error && data && data.length > 0 && isMounted) {
          setHistory(
            data.map((item) => ({
              id: item.id,
              expression: item.expression,
              result: item.result,
            }))
          );
        }
      } catch (err) {
        console.warn('Supabase fetch error:', err);
      }
    }

    loadCloudHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save calculation helper (saves to local state and Supabase if active)
  const saveCalculation = useCallback(
    async (exprString, res) => {
      const newEntry = { id: Date.now(), expression: exprString, result: res };
      setHistory((prevHist) => [newEntry, ...prevHist.slice(0, 24)]);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('calculations').insert([
            {
              expression: exprString,
              result: String(res),
            },
          ]);
        } catch (err) {
          console.warn('Error saving to Supabase:', err);
        }
      }
    },
    []
  );

  // Play subtle audio feedback
  const playClick = useCallback((freq = 550) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Audio not permitted or not supported
    }
  }, [soundEnabled]);

  // Handle number input (0 - 9)
  const handleDigit = useCallback((digit) => {
    playClick(600);
    setCurrentInput((prev) => {
      if (prev === 'Error' || overwrite) {
        setOverwrite(false);
        return digit;
      }
      if (prev === '0') {
        return digit;
      }
      // Maximum length limit for clean layout
      if (prev.replace(/[-.]/g, '').length >= 14) {
        return prev;
      }
      return prev + digit;
    });
  }, [overwrite, playClick]);

  // Handle decimal point
  const handleDecimal = useCallback(() => {
    playClick(650);
    setCurrentInput((prev) => {
      if (prev === 'Error' || overwrite) {
        setOverwrite(false);
        return '0.';
      }
      if (!prev.includes('.')) {
        return prev + '.';
      }
      return prev;
    });
  }, [overwrite, playClick]);

  // Calculate binary operations
  const calculateResult = (a, b, op) => {
    let res = 0;
    switch (op) {
      case '+':
        res = a + b;
        break;
      case '-':
        res = a - b;
        break;
      case '×':
      case '*':
        res = a * b;
        break;
      case '÷':
      case '/':
        if (b === 0) return 'Error';
        res = a / b;
        break;
      default:
        return b;
    }
    return cleanPrecision(res);
  };

  // Handle operation selection (+, -, ×, ÷)
  const handleOperator = useCallback((op) => {
    playClick(750);
    if (currentInput === 'Error') {
      return;
    }

    const currentNum = parseFloat(currentInput);

    if (prevValue === null) {
      setPrevValue(currentNum);
      setOperation(op);
      setExpression(`${currentInput} ${op}`);
      setOverwrite(true);
      return;
    }

    if (overwrite) {
      setOperation(op);
      setExpression(`${prevValue} ${op}`);
      return;
    }

    const res = calculateResult(prevValue, currentNum, operation);
    if (res === 'Error') {
      setCurrentInput('Error');
      setPrevValue(null);
      setOperation(null);
      setExpression('');
      setOverwrite(true);
    } else {
      setPrevValue(res);
      setCurrentInput(String(res));
      setOperation(op);
      setExpression(`${res} ${op}`);
      setOverwrite(true);
    }
  }, [currentInput, prevValue, operation, overwrite, playClick]);

  // Handle Equals (=)
  const handleEquals = useCallback(() => {
    playClick(900);
    if (prevValue === null || operation === null || currentInput === 'Error') {
      return;
    }

    const currentNum = parseFloat(currentInput);
    const res = calculateResult(prevValue, currentNum, operation);
    const exprString = `${prevValue} ${operation} ${currentNum}`;

    if (res === 'Error') {
      setCurrentInput('Error');
      setExpression(`${exprString} =`);
      setPrevValue(null);
      setOperation(null);
      setOverwrite(true);
    } else {
      setCurrentInput(String(res));
      setExpression(`${exprString} =`);
      setPrevValue(null);
      setOperation(null);
      setOverwrite(true);

      // Save to history & Supabase
      saveCalculation(exprString, res);
    }
  }, [prevValue, operation, currentInput, playClick, saveCalculation]);

  // Handle Clear All (AC)
  const handleClear = useCallback(() => {
    playClick(400);
    setCurrentInput('0');
    setPrevValue(null);
    setOperation(null);
    setExpression('');
    setOverwrite(false);
  }, [playClick]);

  // Handle Backspace (Delete last digit)
  const handleBackspace = useCallback(() => {
    playClick(450);
    setCurrentInput((prev) => {
      if (prev === 'Error' || overwrite) {
        return '0';
      }
      if (prev.length === 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [overwrite, playClick]);

  // Handle Sign Toggle (+/-)
  const handleToggleSign = useCallback(() => {
    playClick(500);
    setCurrentInput((prev) => {
      if (prev === '0' || prev === 'Error') return prev;
      if (prev.startsWith('-')) {
        return prev.slice(1);
      }
      return '-' + prev;
    });
  }, [playClick]);

  // Handle Percentage (%)
  const handlePercentage = useCallback(() => {
    playClick(600);
    if (currentInput === 'Error') return;

    const currentNum = parseFloat(currentInput);
    let val;

    if (prevValue !== null && (operation === '+' || operation === '-')) {
      // e.g. 100 + 10% = 100 + (100 * 0.1)
      val = cleanPrecision((prevValue * currentNum) / 100);
    } else {
      // Standalone or with multiplication/division: 50% = 0.5
      val = cleanPrecision(currentNum / 100);
    }

    setCurrentInput(String(val));
  }, [currentInput, prevValue, operation, playClick]);

  // Unary operation handler (Square root, Log, Ln, Square)
  const handleUnary = useCallback(
    (mathFn, displaySymbol) => {
      playClick(650);
      if (currentInput === 'Error') return;

      const num = parseFloat(currentInput);
      const computed = mathFn(num);

      if (computed === 'Error' || isNaN(computed) || !isFinite(computed)) {
        setCurrentInput('Error');
        setExpression(`${displaySymbol}(${currentInput}) =`);
        setPrevValue(null);
        setOperation(null);
        setOverwrite(true);
        return;
      }

      const res = cleanPrecision(computed);
      const unaryExpr = `${displaySymbol}(${num})`;

      if (prevValue !== null && operation !== null) {
        // Chained within an existing expression (e.g., 5 + √(9))
        setCurrentInput(String(res));
        setExpression(`${prevValue} ${operation} ${unaryExpr}`);
        setOverwrite(true);
      } else {
        // Standalone operation
        setCurrentInput(String(res));
        setExpression(`${unaryExpr} =`);
        setOverwrite(true);

        saveCalculation(unaryExpr, res);
      }
    },
    [currentInput, prevValue, operation, playClick, saveCalculation]
  );

  const handleSquareRoot = useCallback(() => {
    handleUnary((n) => (n < 0 ? 'Error' : Math.sqrt(n)), '√');
  }, [handleUnary]);

  const handleLog10 = useCallback(() => {
    handleUnary((n) => (n <= 0 ? 'Error' : Math.log10(n)), 'log');
  }, [handleUnary]);

  const handleLn = useCallback(() => {
    handleUnary((n) => (n <= 0 ? 'Error' : Math.log(n)), 'ln');
  }, [handleUnary]);

  const handleSquare = useCallback(() => {
    handleUnary((n) => n * n, 'sqr');
  }, [handleUnary]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        handleDecimal();
      } else if (e.key === '+') {
        handleOperator('+');
      } else if (e.key === '-') {
        handleOperator('-');
      } else if (e.key === '*' || e.key === 'x') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === '%') {
        handlePercentage();
      } else if (e.key === 'r' || e.key === 'R') {
        handleSquareRoot();
      } else if (e.key === 'l' || e.key === 'L') {
        handleLog10();
      } else if (e.key === 'n' || e.key === 'N') {
        handleLn();
      } else if (e.key === 's' || e.key === 'S' || e.key === '^') {
        handleSquare();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleDigit,
    handleDecimal,
    handleOperator,
    handleEquals,
    handleBackspace,
    handleClear,
    handlePercentage,
    handleSquareRoot,
    handleLog10,
    handleLn,
    handleSquare,
  ]);

  // Copy current result to clipboard
  const handleCopy = () => {
    if (currentInput === 'Error') return;
    navigator.clipboard.writeText(currentInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // Determine dynamic font size based on input length
  const displayValue = formatNumberDisplay(currentInput);
  const getFontSizeClass = () => {
    if (displayValue.length > 13) return 'size-sm';
    if (displayValue.length > 8) return 'size-md';
    return 'size-lg';
  };

  return (
    <div className="app-container">
      <div className="calculator-card">
        {/* Top bar controls */}
        <div className="calc-header">
          <div className="calc-title">
            <span>Calculadora</span>
            <span className="calc-title-badge">React</span>
          </div>

          <div className="header-actions">
            {/* Audio toggle button */}
            <button
              className={`icon-btn ${soundEnabled ? 'active' : ''}`}
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
              type="button"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>

            {/* History drawer toggle */}
            <button
              className={`icon-btn ${showHistory ? 'active' : ''}`}
              onClick={() => setShowHistory((prev) => !prev)}
              title="Historial de operaciones"
              type="button"
            >
              🕒
            </button>

            {/* Theme switcher */}
            <button
              className="icon-btn"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              type="button"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Display Screen */}
        <div className="screen">
          <div className="screen-expression">
            {expression || '\u00A0'}
          </div>

          <div className="screen-bottom">
            <button
              className={`screen-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title="Copiar resultado"
              type="button"
            >
              {copied ? '✓ Copiado' : '📋'}
            </button>

            <div className={`screen-current ${getFontSizeClass()}`}>
              {displayValue}
            </div>
          </div>
        </div>

        {/* Keypad */}
        <div className="keypad">
          {/* Row 0: Scientific Functions */}
          <button
            className="keypad-btn btn-sci"
            onClick={handleSquareRoot}
            title="Raíz cuadrada (tecla R)"
            type="button"
          >
            √x
          </button>
          <button
            className="keypad-btn btn-sci"
            onClick={handleLog10}
            title="Logaritmo en base 10 (tecla L)"
            type="button"
          >
            log
          </button>
          <button
            className="keypad-btn btn-sci"
            onClick={handleLn}
            title="Logaritmo natural (tecla N)"
            type="button"
          >
            ln
          </button>
          <button
            className="keypad-btn btn-sci"
            onClick={handleSquare}
            title="Elevar al cuadrado (tecla S o ^)"
            type="button"
          >
            x²
          </button>

          {/* Row 1 */}
          <button
            className="keypad-btn btn-fn"
            onClick={handleClear}
            type="button"
          >
            AC
          </button>
          <button
            className="keypad-btn btn-fn"
            onClick={handleBackspace}
            title="Borrar último dígito"
            type="button"
          >
            ⌫
          </button>
          <button
            className="keypad-btn btn-fn"
            onClick={handlePercentage}
            type="button"
          >
            %
          </button>
          <button
            className={`keypad-btn btn-op ${operation === '÷' && overwrite ? 'active-op' : ''}`}
            onClick={() => handleOperator('÷')}
            type="button"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('7')}
            type="button"
          >
            7
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('8')}
            type="button"
          >
            8
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('9')}
            type="button"
          >
            9
          </button>
          <button
            className={`keypad-btn btn-op ${operation === '×' && overwrite ? 'active-op' : ''}`}
            onClick={() => handleOperator('×')}
            type="button"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('4')}
            type="button"
          >
            4
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('5')}
            type="button"
          >
            5
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('6')}
            type="button"
          >
            6
          </button>
          <button
            className={`keypad-btn btn-op ${operation === '-' && overwrite ? 'active-op' : ''}`}
            onClick={() => handleOperator('-')}
            type="button"
          >
            −
          </button>

          {/* Row 4 */}
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('1')}
            type="button"
          >
            1
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('2')}
            type="button"
          >
            2
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('3')}
            type="button"
          >
            3
          </button>
          <button
            className={`keypad-btn btn-op ${operation === '+' && overwrite ? 'active-op' : ''}`}
            onClick={() => handleOperator('+')}
            type="button"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            className="keypad-btn btn-num"
            onClick={handleToggleSign}
            title="Cambiar signo"
            type="button"
          >
            ±
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={() => handleDigit('0')}
            type="button"
          >
            0
          </button>
          <button
            className="keypad-btn btn-num"
            onClick={handleDecimal}
            type="button"
          >
            .
          </button>
          <button
            className="keypad-btn btn-equals"
            onClick={handleEquals}
            type="button"
          >
            =
          </button>
        </div>

        {/* History Modal / Drawer */}
        {showHistory && (
          <div className="history-drawer">
            <div className="history-header">
              <div className="history-title-wrap">
                <h3>🕒 Historial</h3>
                <span
                  className={`cloud-badge ${isSupabaseConfigured ? 'connected' : 'offline'}`}
                  title={
                    isSupabaseConfigured
                      ? 'Conectado y sincronizado con Supabase'
                      : 'Modo local (Agrega VITE_SUPABASE_ANON_KEY en .env)'
                  }
                >
                  {isSupabaseConfigured ? '☁️ Supabase' : '💾 Local'}
                </span>
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowHistory(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">No hay operaciones recientes</div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="history-item"
                    onClick={() => {
                      setCurrentInput(String(item.result));
                      setOverwrite(true);
                      setShowHistory(false);
                      playClick(600);
                    }}
                    title="Click para usar este resultado"
                  >
                    <div className="history-expr">{item.expression} =</div>
                    <div className="history-res">{item.result}</div>
                  </div>
                ))
              )}
            </div>

            {history.length > 0 && (
              <div className="history-footer">
                <button
                  className="btn-clear-history"
                  onClick={async () => {
                    setHistory([]);
                    if (isSupabaseConfigured && supabase) {
                      try {
                        await supabase.from('calculations').delete().neq('id', 0);
                      } catch (err) {
                        console.warn('Error clearing Supabase history:', err);
                      }
                    }
                  }}
                  type="button"
                >
                  Vaciar Historial
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helpful keyboard hint */}
      <div className="keyboard-hint">
        <span>💡 Teclado:</span>
        <span className="kbd-badge">0-9</span>
        <span className="kbd-badge">+ - * /</span>
        <span className="kbd-badge">R (√)</span>
        <span className="kbd-badge">L (log)</span>
        <span className="kbd-badge">N (ln)</span>
        <span className="kbd-badge">Enter</span>
      </div>
    </div>
  );
}
