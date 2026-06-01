/**
 * stock-data.ts — Capa de lógica de negocio para obtener datos bursátiles.
 *
 * Esta capa abstrae la comunicación con el script Python (yfinance).
 * Si en el futuro se cambia la fuente de datos (ej: una API externa),
 * solo hay que modificar este archivo.
 *
 * Arquitectura:
 *   Next.js API Route  →  lib/stock-data.ts  →  scripts/fetch_stocks.py  →  Yahoo Finance
 *
 * La ejecución de Python se hace mediante child_process.execFile,
 * que es seguro (sin inyección de comandos) porque los argumentos
 * se pasan como array, no como string concatenado.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ---------------------------------------------------------------------------
// Tipos
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

/** Estructura de error devuelta por el script Python */
interface PythonError {
  error: string;
  solucion?: string;
  detalle?: string;
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);
const PYTHON_SCRIPT = path.join(process.cwd(), "scripts", "fetch_stocks.py");

/** Timeout de 15 segundos para las llamadas a Python (Yahoo Finance puede tardar) */
const PYTHON_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Utilidades privadas
// ---------------------------------------------------------------------------

/**
 * Encuentra el ejecutable de Python disponible en el sistema.
 * Prueba "python3" primero (Linux/macOS) y luego "python" (Windows).
 */
async function encontrarPython(): Promise<string> {
  // Intentamos python3 primero (estándar en Linux/macOS)
  try {
    await execFileAsync("python3", ["--version"], { timeout: 5000 });
    return "python3";
  } catch {
    // Fallback a python (Windows, o sistemas con solo python)
    return "python";
  }
}

/**
 * Ejecuta el script Python con los argumentos dados y devuelve el JSON parseado.
 */
async function ejecutarScript<T>(args: string[]): Promise<T> {
  const python = await encontrarPython();

  try {
    const { stdout, stderr } = await execFileAsync(python, [PYTHON_SCRIPT, ...args], {
      timeout: PYTHON_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1 MB de buffer (el historial puede ser grande)
    });

    // yfinance emite warnings por stderr que no son errores reales
    if (stderr && !stderr.includes("Warning")) {
      console.warn("[stock-data] stderr:", stderr);
    }

    const resultado: T | PythonError = JSON.parse(stdout.trim());

    // Verificar si el script Python devolvió un error
    if (resultado && typeof resultado === "object" && "error" in resultado) {
      const err = resultado as PythonError;
      throw new Error(err.error + (err.solucion ? ` — ${err.solucion}` : ""));
    }

    return resultado as T;
  } catch (error: unknown) {
    // Si ya es un Error nuestro, relanzarlo tal cual
    if (error instanceof Error && error.message.includes("yfinance")) {
      throw error;
    }

    // Error de ejecución (Python no instalado, etc.)
    if (error instanceof Error && "code" in error) {
      const nodeErr = error as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new Error(
          "Python no está instalado o no se encuentra en el PATH. " +
            "Instálalo desde https://python.org y asegúrate de agregarlo al PATH. " +
            "Luego instala yfinance con: pip install yfinance"
        );
      }
      if (nodeErr.code === "ETIMEDOUT") {
        throw new Error("La consulta a Yahoo Finance tardó demasiado. Intenta de nuevo.");
      }
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Obtiene la información actual de una acción por su símbolo.
 *
 * @param simbolo - Símbolo bursátil (ej: "AAPL", "MSFT")
 * @returns Promesa con los datos de la acción
 * @throws Error si el símbolo no existe o hay problemas de conexión
 */
export async function obtenerStockInfo(simbolo: string): Promise<StockInfo> {
  return ejecutarScript<StockInfo>(["info", simbolo]);
}

/**
 * Obtiene el historial de precios de una acción.
 *
 * @param simbolo - Símbolo bursátil
 * @param dias - Número de días hacia atrás (por defecto 30)
 * @returns Array de puntos históricos ordenados por fecha ascendente
 */
export async function obtenerStockHistorial(
  simbolo: string,
  dias: number = 30
): Promise<StockHistoryPoint[]> {
  return ejecutarScript<StockHistoryPoint[]>(["history", simbolo, String(dias)]);
}

/**
 * Obtiene información actual + historial en una sola llamada.
 * Más eficiente que hacer dos llamadas separadas porque
 * solo se ejecuta el script Python una vez.
 *
 * @param simbolo - Símbolo bursátil
 * @param diasHistorial - Días de historial (por defecto 30)
 */
export async function obtenerStockCompleto(
  simbolo: string,
  diasHistorial: number = 30
): Promise<StockDataCompleto> {
  return ejecutarScript<StockDataCompleto>(["completo", simbolo, String(diasHistorial)]);
}
