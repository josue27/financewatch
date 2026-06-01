"use client";

/**
 * StockCard — Tarjeta individual de acción bursátil.
 *
 * Muestra: símbolo, nombre, precio actual, cambio porcentual diario.
 * Usa React.memo para evitar re-renderizados cuando las props no cambian.
 *
 * Props:
 *   - datos: Información de la acción (precio, cambio, etc.)
 *   - seleccionada: Si esta tarjeta está seleccionada (para resaltarla)
 *   - onClick: Callback al hacer clic (para mostrar el gráfico)
 *   - indice: Posición en el grid (para animación staggered)
 *   - cargando: Si los datos se están cargando (muestra skeleton)
 */

import { memo } from "react";
import type { StockInfo } from "@/lib/stock-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StockCardProps {
  /** Datos de la acción; si es null, se muestra el estado de error */
  datos: StockInfo | null;
  /** Si la tarjeta está seleccionada (activa) para mostrar el gráfico */
  seleccionada: boolean;
  /** Callback al hacer clic en la tarjeta */
  onClick: () => void;
  /** Índice en el grid, usado para la animación de entrada */
  indice: number;
  /** Si los datos están cargando (muestra skeleton) */
  cargando: boolean;
  /** Mensaje de error si falló la carga */
  error?: string;
  /** Símbolo de la acción (útil cuando datos es null por error) */
  simbolo: string;
}

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

/** Formatea un número como precio en USD */
function formatoPrecio(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Formatea un porcentaje con signo */
function formatoPorcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const signo = valor >= 0 ? "+" : "";
  return `${signo}${valor.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Sub-componentes de presentación
// ---------------------------------------------------------------------------

/** Skeleton que se muestra mientras se cargan los datos */
function SkeletonCard({ indice }: { indice: number }) {
  return (
    <div
      className="card-financiera animate-pulse"
      style={{ animationDelay: `${indice * 80}ms` }}
    >
      <div className="mb-3 h-4 w-16 rounded bg-slate-700" />
      <div className="mb-2 h-3 w-32 rounded bg-slate-700/60" />
      <div className="mb-4 h-8 w-24 rounded bg-slate-700/40" />
      <div className="h-4 w-20 rounded bg-slate-700/60" />
    </div>
  );
}

/** Tarjeta en estado de error */
function ErrorCard({ simbolo, mensaje }: { simbolo: string; mensaje?: string }) {
  return (
    <div className="card-financiera border-red-500/30 bg-red-950/20">
      <p className="mb-1 text-sm font-bold text-red-400">{simbolo}</p>
      <p className="text-xs text-red-300/70">
        {mensaje || "Error al cargar datos"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export const StockCard = memo(function StockCard({
  datos,
  seleccionada,
  onClick,
  indice,
  cargando,
  error,
  simbolo,
}: StockCardProps) {
  // ─── Estado de carga ────────────────────────────────────────────────
  if (cargando) {
    return <SkeletonCard indice={indice} />;
  }

  // ─── Estado de error ────────────────────────────────────────────────
  if (error || !datos) {
    return <ErrorCard simbolo={simbolo} mensaje={error} />;
  }

  // ─── Datos normales ─────────────────────────────────────────────────
  const { nombre, precio, cambio, cambioPorcentaje } = datos;

  // Determinar dirección para el color y la flecha
  const esPositivo = cambioPorcentaje !== null && cambioPorcentaje >= 0;
  const esNegativo = cambioPorcentaje !== null && cambioPorcentaje < 0;

  const colorCambio = esPositivo
    ? "text-market-green"
    : esNegativo
      ? "text-market-red"
      : "text-slate-400";

  const flecha = esPositivo ? "▲" : esNegativo ? "▼" : "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-financiera w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark
        ${seleccionada ? "border-accent/50 bg-surface-hover ring-1 ring-accent/30" : ""}
      `}
      style={{ animationDelay: `${indice * 80}ms` }}
      title={`Ver gráfico de ${simbolo}`}
      aria-label={`${simbolo} — ${nombre}. Precio: ${formatoPrecio(precio)}. Cambio: ${formatoPorcentaje(cambioPorcentaje)}. Haz clic para ver el gráfico.`}
    >
      {/* Símbolo + Mercado */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold tracking-wider text-white">
          {simbolo}
        </span>
        {datos.mercado && (
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {datos.mercado}
          </span>
        )}
      </div>

      {/* Nombre de la empresa */}
      <p className="mb-3 truncate text-xs text-slate-400">
        {nombre || simbolo}
      </p>

      {/* Precio actual */}
      <p className="mb-2 text-2xl font-semibold tracking-tight text-white">
        {formatoPrecio(precio)}
      </p>

      {/* Cambio diario */}
      <div className={`flex items-center gap-1.5 text-sm font-medium ${colorCambio}`}>
        <span className="text-xs">{flecha}</span>
        <span>
          {cambio !== null && cambio !== undefined
            ? `${cambio >= 0 ? "+" : ""}${formatoPrecio(Math.abs(cambio)).replace("$", "")}`
            : "—"}
        </span>
        <span className="ml-0.5 opacity-80">({formatoPorcentaje(cambioPorcentaje)})</span>
      </div>
    </button>
  );
});
