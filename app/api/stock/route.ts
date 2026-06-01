/**
 * API Route — /api/stock
 *
 * Proporciona datos bursátiles al frontend usando `yahoo-finance2`
 * como fuente de datos gratuita (sin necesidad de Python).
 *
 * Endpoints:
 *   GET /api/stock?simbolo=AAPL              → Información actual de una acción
 *   GET /api/stock?simbolo=AAPL&historial=30 → Info + historial de 30 días
 *
 * Estrategia de caché:
 *   Next.js ISR con revalidate de 60s. Durante el horario de mercado,
 *   los datos se refrescan automáticamente cada minuto.
 */

import { NextRequest, NextResponse } from "next/server";
import { obtenerStockInfo, obtenerStockCompleto } from "@/lib/stock-data";

// ---------------------------------------------------------------------------
// Configuración de caché (ISR de Next.js)
// ---------------------------------------------------------------------------

/** Los datos se revalidan cada 60 segundos como máximo */
export const revalidate = 60;

/** Símbolos permitidos: letras, números, puntos y guiones (máx 10 chars) */
const SIMBOLO_REGEX = /^[A-Za-z0-9.]{1,10}$/;

// ---------------------------------------------------------------------------
// GET — Obtener datos de una acción
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const simbolo = request.nextUrl.searchParams.get("simbolo");
  const historialParam = request.nextUrl.searchParams.get("historial");

  // ─── Validación del símbolo ───────────────────────────────────────────
  if (!simbolo) {
    return NextResponse.json(
      {
        error: true,
        mensaje:
          "Debes proporcionar un símbolo bursátil. Ejemplo: /api/stock?simbolo=AAPL",
      },
      { status: 400 }
    );
  }

  if (!SIMBOLO_REGEX.test(simbolo)) {
    return NextResponse.json(
      {
        error: true,
        mensaje: `Símbolo inválido: "${simbolo}". Solo se permiten letras, números y puntos (máx. 10 caracteres).`,
      },
      { status: 400 }
    );
  }

  // ─── Obtener datos ────────────────────────────────────────────────────
  try {
    const diasHistorial = historialParam ? parseInt(historialParam, 10) || 30 : 0;

    if (diasHistorial > 0) {
      // Modo completo: info actual + historial en paralelo
      const datos = await obtenerStockCompleto(simbolo.toUpperCase(), diasHistorial);
      return NextResponse.json({ error: false, datos });
    }

    // Solo información actual
    const datos = await obtenerStockInfo(simbolo.toUpperCase());
    return NextResponse.json({ error: false, datos });
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message
        : "Error desconocido al obtener los datos.";

    console.error(`[API /api/stock] Error con símbolo "${simbolo}":`, mensaje);

    return NextResponse.json(
      {
        error: true,
        mensaje: `No se pudieron obtener datos para "${simbolo.toUpperCase()}". ${mensaje}`,
      },
      { status: 502 }
    );
  }
}
