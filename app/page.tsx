"use client";

/**
 * Página principal — Dashboard de FinanceWatch.
 *
 * Este es un Client Component porque utiliza:
 *   - useState / useEffect para el estado y efectos secundarios
 *   - localStorage para persistir la lista de símbolos del usuario
 *   - Fetch a la API Route /api/stock para obtener datos
 *
 * Flujo de datos:
 *   1. Al montar, carga los símbolos desde localStorage (o usa los defaults).
 *   2. Para cada símbolo, hace fetch a /api/stock?simbolo=XXX.
 *   3. Renderiza una StockCard por cada símbolo.
 *   4. Al hacer clic en una tarjeta, carga el historial y muestra el StockChart.
 *   5. El usuario puede añadir/quitar símbolos con la SearchBar.
 *
 * Estrategia de rendimiento:
 *   - StockCard usa React.memo (evita re-renderizados innecesarios).
 *   - Las llamadas fetch se paralelizan con Promise.allSettled.
 *   - El historial solo se carga bajo demanda (al seleccionar una acción).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { StockCard } from "@/components/StockCard";
import { SearchBar } from "@/components/SearchBar";
import { StockChart } from "@/components/StockChart";
import type { StockInfo, StockHistoryPoint, StockDataCompleto } from "@/lib/stock-data";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Símbolos por defecto si el usuario no tiene ninguno guardado */
const SIMBOLOS_POR_DEFECTO = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

/** Clave usada en localStorage para persistir la lista */
const LOCAL_STORAGE_KEY = "financewatch-simbolos";

/** Máximo de acciones que el usuario puede seguir a la vez */
const MAX_ACCIONES = 10;

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

/** Estado de los datos de una acción individual */
interface EstadoAccion {
  simbolo: string;
  datos: StockInfo | null;
  cargando: boolean;
  error: string | null;
}

/** Estructura de respuesta de nuestra API */
interface ApiResponse {
  error: boolean;
  datos?: StockInfo | StockDataCompleto;
  mensaje?: string;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Carga los símbolos desde localStorage de forma segura */
function cargarSimbolosGuardados(): string[] {
  if (typeof window === "undefined") return SIMBOLOS_POR_DEFECTO;

  try {
    const guardados = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!guardados) return SIMBOLOS_POR_DEFECTO;

    const parseados: unknown = JSON.parse(guardados);
    if (
      Array.isArray(parseados) &&
      parseados.every((s) => typeof s === "string" && s.trim().length > 0)
    ) {
      return parseados as string[];
    }

    return SIMBOLOS_POR_DEFECTO;
  } catch {
    // Si localStorage falla (ej: bloqueado por el navegador), usar defaults
    return SIMBOLOS_POR_DEFECTO;
  }
}

/** Guarda los símbolos en localStorage de forma segura */
function guardarSimbolos(simbolos: string[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(simbolos));
  } catch {
    console.warn("No se pudo guardar en localStorage (puede estar lleno o bloqueado).");
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  // ─── Estado ──────────────────────────────────────────────────────────

  /** Lista de símbolos que el usuario sigue */
  const [simbolos, setSimbolos] = useState<string[]>(SIMBOLOS_POR_DEFECTO);

  /** Datos de cada acción indexados por símbolo */
  const [estadoAcciones, setEstadoAcciones] = useState<Record<string, EstadoAccion>>({});

  /** Símbolo seleccionado para mostrar el gráfico (null = ninguno) */
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  /** Datos históricos de la acción seleccionada */
  const [historialSeleccionado, setHistorialSeleccionado] = useState<StockHistoryPoint[]>([]);

  /** Si se está cargando el historial de la acción seleccionada */
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  /** Si se está haciendo una recarga general (botón "Actualizar todos") */
  const [recargando, setRecargando] = useState(false);

  /** Ref para evitar llamadas duplicadas al montar (React Strict Mode) */
  const cargadoRef = useRef(false);

  // ─── Inicialización ──────────────────────────────────────────────────

  useEffect(() => {
    // Evitar doble ejecución en Strict Mode (desarrollo)
    if (cargadoRef.current) return;
    cargadoRef.current = true;

    const guardados = cargarSimbolosGuardados();
    setSimbolos(guardados);

    // Inicializar el estado de todas las acciones como "cargando"
    const inicial: Record<string, EstadoAccion> = {};
    for (const simbolo of guardados) {
      inicial[simbolo] = { simbolo, datos: null, cargando: true, error: null };
    }
    setEstadoAcciones(inicial);
  }, []);

  // ─── Cargar datos cuando cambia la lista de símbolos ─────────────────

  useEffect(() => {
    if (simbolos.length === 0) return;

    // Solo cargar símbolos que no tengan datos todavía
    const faltantes = simbolos.filter((s) => {
      const estado = estadoAcciones[s];
      return !estado || estado.cargando || estado.error;
    });

    if (faltantes.length === 0) return;

    // Marcar como cargando y hacer fetch
    setEstadoAcciones((prev) => {
      const nuevo = { ...prev };
      for (const s of faltantes) {
        nuevo[s] = { simbolo: s, datos: null, cargando: true, error: null };
      }
      return nuevo;
    });

    // Fetch en paralelo para todas las acciones faltantes
    Promise.allSettled(
      faltantes.map(async (simbolo) => {
        try {
          const res = await fetch(`/api/stock?simbolo=${encodeURIComponent(simbolo)}`);
          const json: ApiResponse = await res.json();

          if (json.error || !json.datos) {
            throw new Error(json.mensaje || "Error desconocido");
          }

          return { simbolo, datos: json.datos as StockInfo, error: null };
        } catch (err: unknown) {
          const mensaje =
            err instanceof Error ? err.message : "Error de red";
          return { simbolo, datos: null, error: mensaje };
        }
      })
    ).then((resultados) => {
      setEstadoAcciones((prev) => {
        const nuevo = { ...prev };
        for (const res of resultados) {
          if (res.status === "fulfilled") {
            const { simbolo, datos, error } = res.value;
            nuevo[simbolo] = { simbolo, datos, cargando: false, error };
          }
        }
        return nuevo;
      });
    });
  }, [simbolos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ────────────────────────────────────────────────────────

  /** Añadir un nuevo símbolo a la lista (desde SearchBar) */
  const manejarAgregarSimbolo = useCallback(
    (simbolo: string) => {
      setSimbolos((prev) => {
        if (prev.includes(simbolo)) return prev; // Ya existe
        if (prev.length >= MAX_ACCIONES) {
          alert(`Máximo ${MAX_ACCIONES} acciones permitidas. Elimina una para agregar otra.`);
          return prev;
        }
        const nuevaLista = [...prev, simbolo];
        guardarSimbolos(nuevaLista);
        return nuevaLista;
      });

      // Inicializar el estado de la nueva acción como cargando
      setEstadoAcciones((prev) => ({
        ...prev,
        [simbolo]: { simbolo, datos: null, cargando: true, error: null },
      }));
    },
    []
  );

  /** Eliminar un símbolo de la lista */
  const manejarEliminarSimbolo = useCallback((simbolo: string) => {
    setSimbolos((prev) => {
      const nuevaLista = prev.filter((s) => s !== simbolo);
      guardarSimbolos(nuevaLista);
      return nuevaLista;
    });

    // Limpiar estado de la acción eliminada
    setEstadoAcciones((prev) => {
      const nuevo = { ...prev };
      delete nuevo[simbolo];
      return nuevo;
    });

    // Si la acción eliminada estaba seleccionada, deseleccionar
    setSeleccionado((prev) => (prev === simbolo ? null : prev));
  }, []);

  /** Seleccionar una acción para mostrar su gráfico */
  const manejarSeleccionar = useCallback(
    async (simbolo: string) => {
      // Si ya está seleccionada, deseleccionar (toggle)
      if (seleccionado === simbolo) {
        setSeleccionado(null);
        setHistorialSeleccionado([]);
        return;
      }

      setSeleccionado(simbolo);
      setCargandoHistorial(true);
      setHistorialSeleccionado([]);

      try {
        const res = await fetch(
          `/api/stock?simbolo=${encodeURIComponent(simbolo)}&historial=30`
        );
        const json: ApiResponse = await res.json();

        if (json.error || !json.datos) {
          throw new Error(json.mensaje || "Error al cargar historial");
        }

        const datosCompletos = json.datos as StockDataCompleto;
        setHistorialSeleccionado(datosCompletos.historial || []);
      } catch (err: unknown) {
        console.error("Error cargando historial:", err);
        setHistorialSeleccionado([]);
      } finally {
        setCargandoHistorial(false);
      }
    },
    [seleccionado]
  );

  /** Recargar todos los datos */
  const manejarRecargar = useCallback(async () => {
    setRecargando(true);

    // Marcar todos como cargando
    setEstadoAcciones((prev) => {
      const nuevo: Record<string, EstadoAccion> = {};
      for (const simbolo of simbolos) {
        nuevo[simbolo] = { simbolo, datos: null, cargando: true, error: null };
      }
      return nuevo;
    });

    try {
      const resultados = await Promise.allSettled(
        simbolos.map(async (simbolo) => {
          try {
            const res = await fetch(`/api/stock?simbolo=${encodeURIComponent(simbolo)}`);
            const json: ApiResponse = await res.json();
            if (json.error || !json.datos) {
              throw new Error(json.mensaje || "Error");
            }
            return { simbolo, datos: json.datos as StockInfo, error: null };
          } catch (err: unknown) {
            return {
              simbolo,
              datos: null,
              error: err instanceof Error ? err.message : "Error",
            };
          }
        })
      );

      setEstadoAcciones((prev) => {
        const nuevo = { ...prev };
        for (const res of resultados) {
          if (res.status === "fulfilled") {
            const { simbolo, datos, error } = res.value;
            nuevo[simbolo] = { simbolo, datos, cargando: false, error };
          }
        }
        return nuevo;
      });
    } finally {
      setRecargando(false);
    }
  }, [simbolos]);

  // ─── Datos derivados ─────────────────────────────────────────────────

  /** Datos de la acción seleccionada (para mostrar nombre en el gráfico) */
  const datosSeleccionados = seleccionado ? estadoAcciones[seleccionado]?.datos : null;

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Cabecera + Buscador ──────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <SearchBar
            onAgregar={manejarAgregarSimbolo}
            simbolosExistentes={simbolos}
            cargando={recargando}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Botón de recarga */}
          <button
            type="button"
            onClick={manejarRecargar}
            disabled={recargando || simbolos.length === 0}
            className="btn-secundario flex items-center gap-2"
          >
            <svg
              className={`h-4 w-4 ${recargando ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {recargando ? "Actualizando…" : "Actualizar todo"}
          </button>
        </div>
      </div>

      {/* ─── Grid de acciones ─────────────────────────────────────── */}
      {simbolos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-3 text-4xl">📊</span>
          <h2 className="mb-2 text-lg font-medium text-slate-300">
            No hay acciones en seguimiento
          </h2>
          <p className="text-sm text-slate-500">
            Usa la barra de búsqueda para agregar tu primera acción.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {simbolos.map((simbolo, indice) => {
            const estado = estadoAcciones[simbolo];
            return (
              <div key={simbolo} className="animate-fade-in-up group relative">
                {/* Botón de eliminar (visible al hover) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    manejarEliminarSimbolo(simbolo);
                  }}
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center
                             rounded-full bg-slate-700 text-xs text-slate-400
                             opacity-0 transition-opacity duration-150
                             hover:bg-red-600 hover:text-white
                             group-hover:opacity-100"
                  aria-label={`Eliminar ${simbolo}`}
                  title={`Eliminar ${simbolo}`}
                >
                  ×
                </button>

                <StockCard
                  simbolo={simbolo}
                  datos={estado?.datos ?? null}
                  cargando={estado?.cargando ?? true}
                  error={estado?.error ?? undefined}
                  seleccionada={seleccionado === simbolo}
                  onClick={() => manejarSeleccionar(simbolo)}
                  indice={indice}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Panel del gráfico ────────────────────────────────────── */}
      {seleccionado && (
        <div className="animate-fade-in-up">
          {/* Encabezado del panel */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400">
              Historial de precios
            </h2>
            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cerrar ✕
            </button>
          </div>

          {cargandoHistorial ? (
            <div className="card-financiera flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="spinner h-8 w-8" />
                <p className="text-sm text-slate-500">Cargando historial…</p>
              </div>
            </div>
          ) : historialSeleccionado.length > 0 ? (
            <StockChart
              datos={historialSeleccionado}
              simbolo={seleccionado}
              nombre={datosSeleccionados?.nombre || seleccionado}
            />
          ) : (
            <div className="card-financiera flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">
                No hay datos históricos disponibles para {seleccionado}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
