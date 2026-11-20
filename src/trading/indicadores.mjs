/**
 * Glorian System — Quantitative Technical Indicators Engine (Layer-0, Zero-Dependencies)
 * Pure Node.js 22+ ESM. High-precision arithmetic for M1/M5 financial time series.
 *
 * @module src/trading/indicadores.mjs
 */

/**
 * Calculates Exponential Moving Average (EMA).
 * @param {number[]} valores - Array of price values (e.g., closing prices).
 * @param {number} periodo - Smoothing period (e.g., 9, 20, 50, 200).
 * @returns {(number|null)[]} Array of EMA values matching input length.
 */
export function calcularEMA(valores, periodo) {
  if (!Array.isArray(valores) || valores.length < periodo || periodo <= 0) {
    return new Array(Array.isArray(valores) ? valores.length : 0).fill(null);
  }
  const k = 2 / (periodo + 1);
  const ema = new Array(valores.length).fill(null);

  let sumaInicial = 0;
  for (let i = 0; i < periodo; i++) {
    sumaInicial += valores[i];
  }
  ema[periodo - 1] = sumaInicial / periodo;

  for (let i = periodo; i < valores.length; i++) {
    ema[i] = valores[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Calculates Wilder's Relative Strength Index (RSI).
 * @param {number[]} cierres - Array of closing prices.
 * @param {number} [periodo=14] - RSI period.
 * @returns {(number|null)[]} Array of RSI values [0-100].
 */
export function calcularRSI(cierres, periodo = 14) {
  if (!Array.isArray(cierres) || cierres.length <= periodo || periodo <= 0) {
    return new Array(Array.isArray(cierres) ? cierres.length : 0).fill(null);
  }
  const rsi = new Array(cierres.length).fill(null);
  let ganancias = 0;
  let perdidas = 0;

  for (let i = 1; i <= periodo; i++) {
    const diff = cierres[i] - cierres[i - 1];
    if (diff >= 0) {
      ganancias += diff;
    } else {
      perdidas -= diff;
    }
  }

  let avgGain = ganancias / periodo;
  let avgLoss = perdidas / periodo;
  rsi[periodo] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = periodo + 1; i < cierres.length; i++) {
    const diff = cierres[i] - cierres[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/**
 * Calculates Bollinger Bands (Upper, Middle/SMA, Lower).
 * @param {number[]} cierres - Array of closing prices.
 * @param {number} [periodo=20] - Moving average period.
 * @param {number} [desviacion=2.2] - Standard deviation multiplier.
 * @returns {({ superior: number, media: number, inferior: number }|null)[]}
 */
export function calcularBollinger(cierres, periodo = 20, desviacion = 2.2) {
  if (!Array.isArray(cierres) || cierres.length < periodo || periodo <= 0) {
    return new Array(Array.isArray(cierres) ? cierres.length : 0).fill(null);
  }
  const bandas = new Array(cierres.length).fill(null);

  for (let i = periodo - 1; i < cierres.length; i++) {
    const ventana = cierres.slice(i - periodo + 1, i + 1);
    const media = ventana.reduce((acc, v) => acc + v, 0) / periodo;
    const varianza = ventana.reduce((acc, v) => acc + (v - media) ** 2, 0) / periodo;
    const std = Math.sqrt(varianza);

    bandas[i] = {
      superior: media + desviacion * std,
      media,
      inferior: media - desviacion * std,
    };
  }
  return bandas;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * @param {number[]} cierres - Array of closing prices.
 * @param {number} [rapida=12] - Fast EMA period.
 * @param {number} [lenta=26] - Slow EMA period.
 * @param {number} [senal=9] - Signal line EMA period.
 * @returns {({ macd: number, senal: number|null, histograma: number|null }|null)[]}
 */
export function calcularMACD(cierres, rapida = 12, lenta = 26, senal = 9) {
  if (!Array.isArray(cierres) || cierres.length < lenta) {
    return new Array(Array.isArray(cierres) ? cierres.length : 0).fill(null);
  }
  const emaRapida = calcularEMA(cierres, rapida);
  const emaLenta = calcularEMA(cierres, lenta);
  const lineaMACD = cierres.map((_, i) =>
    emaRapida[i] !== null && emaLenta[i] !== null ? emaRapida[i] - emaLenta[i] : null,
  );

  const validos = lineaMACD.filter((v) => v !== null);
  const emaSenalValida = calcularEMA(validos, senal);
  const resultado = new Array(cierres.length).fill(null);

  let idxValido = 0;
  for (let i = 0; i < cierres.length; i++) {
    if (lineaMACD[i] !== null) {
      const sig = emaSenalValida[idxValido] ?? null;
      resultado[i] = {
        macd: lineaMACD[i],
        senal: sig,
        histograma: sig !== null ? lineaMACD[i] - sig : null,
      };
      idxValido++;
    }
  }
  return resultado;
}

/**
 * Calculates Stochastic Oscillator (%K and %D).
 * @param {Array<{ high: number, low: number, close: number }>} velas - Array of OHLC candles.
 * @param {number} [periodoK=14] - Lookback period for %K.
 * @param {number} [suavizadoK=3] - Smoothing period for %K.
 * @param {number} [periodoD=3] - Moving average period for %D.
 * @returns {({ k: number, d: number }|null)[]}
 */
export function calcularEstocastico(velas, periodoK = 14, suavizadoK = 3, periodoD = 3) {
  if (!Array.isArray(velas) || velas.length < periodoK + suavizadoK + periodoD - 2) {
    return new Array(Array.isArray(velas) ? velas.length : 0).fill(null);
  }
  const rawK = new Array(velas.length).fill(null);
  for (let i = periodoK - 1; i < velas.length; i++) {
    const slice = velas.slice(i - periodoK + 1, i + 1);
    const maxAlto = Math.max(...slice.map((v) => v.high));
    const minBajo = Math.min(...slice.map((v) => v.low));
    rawK[i] = maxAlto === minBajo ? 50 : ((velas[i].close - minBajo) / (maxAlto - minBajo)) * 100;
  }

  const kSuavizado = new Array(velas.length).fill(null);
  for (let i = periodoK + suavizadoK - 2; i < velas.length; i++) {
    const slice = rawK.slice(i - suavizadoK + 1, i + 1);
    kSuavizado[i] = slice.reduce((a, b) => a + b, 0) / suavizadoK;
  }

  const resultado = new Array(velas.length).fill(null);
  for (let i = periodoK + suavizadoK + periodoD - 3; i < velas.length; i++) {
    const slice = kSuavizado.slice(i - periodoD + 1, i + 1);
    const d = slice.reduce((a, b) => a + b, 0) / periodoD;
    resultado[i] = { k: kSuavizado[i], d };
  }
  return resultado;
}

/**
 * Calculates Average True Range (ATR) and Average Directional Index (ADX).
 * @param {Array<{ high: number, low: number, close: number }>} velas - Array of OHLC candles.
 * @param {number} [periodo=14] - Period for ATR and ADX.
 * @returns {({ adx: number, atr: number }|null)[]}
 */
export function calcularATR_y_ADX(velas, periodo = 14) {
  if (!Array.isArray(velas) || velas.length < periodo * 2) {
    return new Array(Array.isArray(velas) ? velas.length : 0).fill(null);
  }
  const tr = [0];
  const plusDM = [0];
  const minusDM = [0];

  for (let i = 1; i < velas.length; i++) {
    const upMove = velas[i].high - velas[i - 1].high;
    const downMove = velas[i - 1].low - velas[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    tr.push(
      Math.max(
        velas[i].high - velas[i].low,
        Math.abs(velas[i].high - velas[i - 1].close),
        Math.abs(velas[i].low - velas[i - 1].close),
      ),
    );
  }

  let atrSmooth = tr.slice(1, periodo + 1).reduce((a, b) => a + b, 0);
  let plusDMSmooth = plusDM.slice(1, periodo + 1).reduce((a, b) => a + b, 0);
  let minusDMSmooth = minusDM.slice(1, periodo + 1).reduce((a, b) => a + b, 0);

  const dxList = [];
  const salida = new Array(velas.length).fill(null);

  for (let i = periodo; i < velas.length; i++) {
    if (i > periodo) {
      atrSmooth = atrSmooth - atrSmooth / periodo + tr[i];
      plusDMSmooth = plusDMSmooth - plusDMSmooth / periodo + plusDM[i];
      minusDMSmooth = minusDMSmooth - minusDMSmooth / periodo + minusDM[i];
    }
    const plusDI = atrSmooth === 0 ? 0 : (plusDMSmooth / atrSmooth) * 100;
    const minusDI = atrSmooth === 0 ? 0 : (minusDMSmooth / atrSmooth) * 100;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
    dxList.push({ index: i, dx, atr: atrSmooth / periodo });
  }

  let adx = dxList.slice(0, periodo).reduce((a, b) => a + b.dx, 0) / periodo;
  salida[dxList[periodo - 1].index] = { adx, atr: dxList[periodo - 1].atr };

  for (let j = periodo; j < dxList.length; j++) {
    adx = (adx * (periodo - 1) + dxList[j].dx) / periodo;
    salida[dxList[j].index] = { adx, atr: dxList[j].atr };
  }
  return salida;
}

/**
 * Performs full multi-indicator analysis over a series of M1/M5 candles.
 * @param {Array<{ open: number, high: number, low: number, close: number }>} velas - OHLC candle array.
 * @returns {object} Calculated indicator metrics for the current candle.
 */
export function analizarMercadoM1(velas) {
  if (!Array.isArray(velas) || velas.length < 50) {
    throw new Error("analizarMercadoM1 requires at least 50 historical candles for accurate indicator convergence.");
  }
  const cierres = velas.map((v) => v.close);
  const ema9 = calcularEMA(cierres, 9);
  const ema20 = calcularEMA(cierres, 20);
  const ema50 = calcularEMA(cierres, 50);
  const rsi14 = calcularRSI(cierres, 14);
  const bb = calcularBollinger(cierres, 20, 2.2);
  const stoch = calcularEstocastico(velas, 14, 3, 3);
  const volTendencia = calcularATR_y_ADX(velas, 14);

  const idx = velas.length - 1;
  const v = velas[idx];
  const rango = v.high - v.low;
  const mechaInfPct = rango === 0 ? 0 : ((Math.min(v.open, v.close) - v.low) / rango) * 100;
  const mechaSupPct = rango === 0 ? 0 : ((v.high - Math.max(v.open, v.close)) / rango) * 100;

  return {
    velaActual: v,
    velaPrevia: velas[idx - 1],
    mechaInfPct,
    mechaSupPct,
    ema9: ema9[idx],
    ema9Prev: ema9[idx - 1],
    ema20: ema20[idx],
    ema20Prev: ema20[idx - 1],
    ema50: ema50[idx],
    ema50Prev: ema50[idx - 1],
    rsi: rsi14[idx],
    bollinger: bb[idx],
    bollingerPrev: bb[idx - 1],
    estocastico: stoch[idx],
    adx: volTendencia[idx]?.adx ?? null,
    atr: volTendencia[idx]?.atr ?? null,
  };
}
