/**
 * stock-data.ts — Capa de lógica de negocio para obtener datos bursátiles.
 *
 * Esta capa abstrae la comunicación con Yahoo Finance usando el paquete
 * nativo de Node.js `yahoo-finance2`, eliminando la necesidad de Python.
 *
 * Arquitectura (nueva):
 *   Next.js API Route  →  lib/stock-data.ts  →  yahoo-finance2  →  Yahoo Finance
 *
 * Ventajas sobre el enfoque anterior (Python + yfinance):
 *   - Sin dependencia de Python instalado en el servidor
 *   - Tipado completo de TypeScript (los tipos vienen del paquete)
 *   - Menor latencia (sin spawn de procesos)
 *   - Manejo de errores más granular
 */

import YahooFinance from "yahoo-finance2";
import type { Quote } from "yahoo-finance2/modules/quote";
import type { HistoricalRowHistory } from "yahoo-finance2/modules/historical";

// ---------------------------------------------------------------------------
// Instancia singleton de Yahoo Finance
// ---------------------------------------------------------------------------

/**
 * Una única instancia compartida para toda la aplicación.
 * `yahoo-finance2` v3+ requiere crear una instancia con `new YahooFinance()`
 * en lugar de usar los métodos estáticos (que están deprecados).
 */
const yahooFinance = new YahooFinance();

// ---------------------------------------------------------------------------
// Tipos (públicos — usados por el frontend)
// ---------------------------------------------------------------------------

/** Información resumida de una acción (precio actual, cambio, etc.) */
export interface StockInfo {
  simbolo: string;
  nombre: string;
  precio: number | null;
  precioAnterior: number | null;
  cambio: number | null;
  cambioPorcentaje: number | null;
  moneda: string;
  mercado: string;
}

/** Un punto en el historial de precios diarios */
export interface StockHistoryPoint {
  fecha: string;
  apertura: number;
  maximo: number;
  minimo: number;
  cierre: number;
  volumen: number;
}

/** Respuesta combinada: info + historial */
export interface StockDataCompleto extends StockInfo {
  historial: StockHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Utilidades privadas de mapeo
// ---------------------------------------------------------------------------

/**
 * Convierte un objeto Quote de yahoo-finance2 a nuestro tipo StockInfo.
 * Centraliza el mapeo de campos para facilitar cambios futuros.
 */
function mapearQuoteAStockInfo(symbol: string, quote: Quote): StockInfo {
  return {
    simbolo: quote.symbol ?? symbol,
    nombre: quote.longName || quote.shortName || symbol,
    precio: quote.regularMarketPrice ?? null,
    precioAnterior: quote.regularMarketPreviousClose ?? null,
    cambio: quote.regularMarketChange ?? null,
    cambioPorcentaje: quote.regularMarketChangePercent ?? null,
    moneda: quote.currency || "USD",
    mercado: quote.exchange || quote.market || "",
  };
}

/**
 * Convierte un HistoricalRowHistory de yahoo-finance2 a nuestro tipo StockHistoryPoint.
 */
function mapearFilaAHistorialPoint(row: HistoricalRowHistory): StockHistoryPoint {
  return {
    fecha: row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date),
    apertura: redondear(row.open),
    maximo: redondear(row.high),
    minimo: redondear(row.low),
    cierre: redondear(row.close),
    volumen: row.volume,
  };
}

/** Redondea un número a 2 decimales */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Obtiene la información actual de una acción por su símbolo.
 *
 * Usa `yahooFinance.quote()` que devuelve datos en tiempo real
 * (o con ~15 min de retraso para mercados no premium).
 *
 * @param simbolo - Símbolo bursátil (ej: "AAPL", "MSFT")
 * @returns Promesa con los datos de la acción
 * @throws Error si el símbolo no existe o hay problemas de red
 */
export async function obtenerStockInfo(simbolo: string): Promise<StockInfo> {
  const symbol = simbolo.toUpperCase().trim();

  try {
    const quote = await yahooFinance.quote(symbol);
    return mapearQuoteAStockInfo(symbol, quote);
  } catch (error: unknown) {
    // Personalizar el mensaje según el tipo de error
    throw mejorarError(error, symbol);
  }
}

/**
 * Obtiene el historial de precios de una acción.
 *
 * Usa `yahooFinance.historical()` con intervalo diario.
 *
 * @param simbolo - Símbolo bursátil
 * @param dias - Número de días hacia atrás (por defecto 30)
 * @returns Array de puntos históricos ordenados por fecha ascendente
 */
export async function obtenerStockHistorial(
  simbolo: string,
  dias: number = 30
): Promise<StockHistoryPoint[]> {
  const symbol = simbolo.toUpperCase().trim();

  try {
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias - 5); // Margen extra por fines de semana/festivos

    const resultados = await yahooFinance.historical(symbol, {
      period1: fechaInicio,
      period2: fechaFin,
      events: "history",
      includeAdjustedClose: false,
    });

    // Mapear y devolver solo los últimos `dias` días
    const historial = resultados.map(mapearFilaAHistorialPoint);
    return historial.length > dias ? historial.slice(-dias) : historial;
  } catch (error: unknown) {
    throw mejorarError(error, symbol);
  }
}

/**
 * Obtiene información actual + historial en paralelo.
 * Más eficiente que dos llamadas secuenciales ya que
 * las consultas a Yahoo Finance se ejecutan simultáneamente.
 *
 * @param simbolo - Símbolo bursátil
 * @param diasHistorial - Días de historial (por defecto 30)
 */
export async function obtenerStockCompleto(
  simbolo: string,
  diasHistorial: number = 30
): Promise<StockDataCompleto> {
  // Ejecutar ambas consultas en paralelo
  const [info, historial] = await Promise.all([
    obtenerStockInfo(simbolo),
    obtenerStockHistorial(simbolo, diasHistorial),
  ]);

  return { ...info, historial };
}

// ---------------------------------------------------------------------------
// Manejo de errores
// ---------------------------------------------------------------------------

/**
 * Mejora los mensajes de error de yahoo-finance2 para que sean
 * más amigables para el usuario final.
 */
function mejorarError(error: unknown, symbol: string): Error {
  if (error instanceof Error) {
    const mensaje = error.message.toLowerCase();

    // Errores comunes de Yahoo Finance
    if (mensaje.includes("not found") || mensaje.includes("unknown symbol") || mensaje.includes("no data found")) {
      return new Error(
        `No se encontraron datos para "${symbol}". Verifica que el símbolo sea correcto.`
      );
    }

    if (mensaje.includes("timeout") || mensaje.includes("etimedout") || mensaje.includes("abort")) {
      return new Error("La consulta a Yahoo Finance tardó demasiado. Intenta de nuevo en unos segundos.");
    }

    if (mensaje.includes("rate limit") || mensaje.includes("too many")) {
      return new Error("Demasiadas consultas. Espera un momento antes de intentar de nuevo.");
    }

    if (mensaje.includes("fetch") || mensaje.includes("network") || mensaje.includes("econnrefused")) {
      return new Error("Error de conexión con Yahoo Finance. Verifica tu conexión a internet.");
    }

    // Error con el mensaje original (ya es descriptivo)
    return error;
  }

  return new Error(`Error desconocido al obtener datos para "${symbol}".`);
}
