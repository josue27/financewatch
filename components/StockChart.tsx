"use client";

/**
 * StockChart — Gráfico interactivo de línea para precios de cierre históricos.
 *
 * Usa Recharts para renderizar un gráfico de líneas responsive con:
 *   - Tooltip personalizado que muestra fecha, precio, máx/mín y volumen.
 *   - Eje Y con formato de dólares.
 *   - Zoom mediante el componente Brush (slider inferior).
 *   - Gradiente bajo la línea para un aspecto más profesional.
 *   - Indicador de tendencia (precio inicial → final).
 *
 * Props:
 *   - datos: Array de puntos históricos ordenados por fecha.
 *   - simbolo: Símbolo de la acción (para el título).
 *   - nombre: Nombre de la empresa (para el título).
 *   - color: Color base de la línea (verde si subió en el período, rojo si bajó).
 */

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import type { StockHistoryPoint } from "@/lib/stock-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StockChartProps {
  datos: StockHistoryPoint[];
  simbolo: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Tipos para Recharts
// ---------------------------------------------------------------------------

/** Estructura de dato que espera Recharts (nombres en español → inglés para el chart) */
interface ChartPoint {
  fecha: string;
  cierre: number;
  minimo: number;
  maximo: number;
  volumen: number;
}

// ---------------------------------------------------------------------------
// Tooltip personalizado
// ---------------------------------------------------------------------------

/**
 * Tooltip que se muestra al hacer hover sobre un punto del gráfico.
 * Muestra fecha, precio de cierre, máximo, mínimo y volumen.
 */
function TooltipPersonalizado({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  const datos = payload[0].payload as ChartPoint & { [key: string]: number };

  return (
    <div className="rounded-lg border border-slate-600/50 bg-slate-800/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold text-slate-400">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Cierre</span>
          <span className="font-mono font-semibold text-white">
            ${datos.cierre?.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Máximo</span>
          <span className="font-mono text-market-green">
            ${datos.maximo?.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Mínimo</span>
          <span className="font-mono text-market-red">
            ${datos.minimo?.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 border-t border-slate-700/50 pt-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Vol.</span>
            <span className="font-mono text-xs text-slate-400">
              {datos.volumen?.toLocaleString("es-MX")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function StockChart({ datos, simbolo, nombre }: StockChartProps) {
  // Calcular color y tendencia basados en los datos
  const { colorLinea, colorGradiente, precioInicial, precioFinal, cambioPct } =
    useMemo(() => {
      if (datos.length < 2) {
        return {
          colorLinea: "#3b82f6",
          colorGradiente: "#3b82f640",
          precioInicial: null,
          precioFinal: null,
          cambioPct: null,
        };
      }

      const inicio = datos[0].cierre;
      const fin = datos[datos.length - 1].cierre;
      const cambio = ((fin - inicio) / inicio) * 100;
      const esPositivo = cambio >= 0;

      return {
        colorLinea: esPositivo ? "#16a34a" : "#dc2626",
        colorGradiente: esPositivo ? "#16a34a40" : "#dc262640",
        precioInicial: inicio,
        precioFinal: fin,
        cambioPct: cambio,
      };
    }, [datos]);

  // Transformar datos al formato que espera Recharts
  const chartData: ChartPoint[] = useMemo(
    () =>
      datos.map((p) => ({
        fecha: p.fecha,
        cierre: p.cierre,
        minimo: p.minimo,
        maximo: p.maximo,
        volumen: p.volumen,
      })),
    [datos]
  );

  // Precio de referencia (primer día) para la línea punteada
  const precioReferencia = datos.length > 0 ? datos[0].cierre : null;

  return (
    <div className="card-financiera">
      {/* Encabezado del gráfico */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">
            {simbolo} — {nombre}
          </h3>
          <p className="text-xs text-slate-500">Precio de cierre · Últimos {datos.length} días</p>
        </div>

        {/* Resumen del período */}
        {precioInicial !== null && precioFinal !== null && cambioPct !== null && (
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">
                ${precioInicial.toFixed(2)}
              </span>
              <span className="text-slate-600">→</span>
              <span className="font-semibold text-white">
                ${precioFinal.toFixed(2)}
              </span>
            </div>
            <p
              className={`text-xs font-medium ${
                cambioPct >= 0 ? "text-market-green" : "text-market-red"
              }`}
            >
              {cambioPct >= 0 ? "▲" : "▼"}{" "}
              {cambioPct >= 0 ? "+" : ""}
              {cambioPct.toFixed(2)}% en el período
            </p>
          </div>
        )}
      </div>

      {/* Gráfico */}
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            {/* Grid con líneas sutiles */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              strokeOpacity={0.5}
              vertical={false}
            />

            {/* Eje X — Fechas */}
            <XAxis
              dataKey="fecha"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              interval="preserveStartEnd"
              minTickGap={50}
            />

            {/* Eje Y — Precio en USD */}
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(valor: number) => `$${valor.toFixed(0)}`}
              domain={["auto", "auto"]}
              width={55}
            />

            {/* Tooltip personalizado */}
            <Tooltip
              content={(props) => <TooltipPersonalizado {...props} />}
            />

            {/* Línea de referencia: precio inicial */}
            {precioReferencia && (
              <ReferenceLine
                y={precioReferencia}
                stroke="#64748b"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{
                  value: `Inicio: $${precioReferencia.toFixed(2)}`,
                  fill: "#64748b",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}

            {/* Línea principal de cierre */}
            <Line
              type="monotone"
              dataKey="cierre"
              stroke={colorLinea}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: colorLinea,
                stroke: "#fff",
                strokeWidth: 2,
              }}
              animationDuration={800}
              animationEasing="ease-out"
            />

            {/* Control de zoom (Brush) */}
            <Brush
              dataKey="fecha"
              height={30}
              stroke="#475569"
              fill="#1e293b"
              tickFormatter={(valor: string) => {
                // Mostrar solo día y mes en el brush
                const partes = valor.split("-");
                return `${partes[2]}/${partes[1]}`;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Guía de uso */}
      <p className="mt-3 text-center text-[11px] text-slate-600">
        Usa el deslizador inferior para hacer zoom · Haz hover sobre la línea para ver detalles
      </p>
    </div>
  );
}
