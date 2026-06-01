"use client";

/**
 * SearchBar — Barra de búsqueda para añadir nuevas acciones al dashboard.
 *
 * Características:
 *   - Validación en tiempo real del formato del símbolo
 *   - Búsqueda al presionar Enter o hacer clic en "Agregar"
 *   - Feedback visual de estados (vacío, inválido, duplicado, cargando)
 *   - Accesible con teclado y lectores de pantalla
 */

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  /** Callback que se ejecuta cuando el usuario añade un símbolo válido */
  onAgregar: (simbolo: string) => void;
  /** Lista de símbolos ya existentes para evitar duplicados */
  simbolosExistentes: string[];
  /** Si actualmente se está cargando/verificando el símbolo */
  cargando: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Regex para validar el formato de un símbolo bursátil */
const SIMBOLO_REGEX = /^[A-Za-z0-9.]{1,10}$/;

/** Mensajes de validación */
const MENSAJES = {
  DUPLICADO: "Este símbolo ya está en el dashboard",
  INVALIDO: "Símbolo inválido (solo letras, números y puntos, máx. 10 caracteres)",
  VACIO: "Escribe un símbolo para buscar",
} as const;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SearchBar({ onAgregar, simbolosExistentes, cargando }: SearchBarProps) {
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Validación del input ────────────────────────────────────────────

  /**
   * Valida el símbolo ingresado y devuelve un mensaje de error o null si es válido.
   * Se ejecuta en cada cambio del input para dar feedback en tiempo real.
   */
  const validar = useCallback(
    (texto: string): string | null => {
      const limpio = texto.trim().toUpperCase();

      if (!limpio) return null; // No mostrar error si está vacío

      if (!SIMBOLO_REGEX.test(limpio)) {
        return MENSAJES.INVALIDO;
      }

      if (simbolosExistentes.includes(limpio)) {
        return MENSAJES.DUPLICADO;
      }

      return null; // Válido
    },
    [simbolosExistentes]
  );

  // ─── Manejo del envío ────────────────────────────────────────────────

  const manejarEnvio = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();

      const simbolo = valor.trim().toUpperCase();

      // Validar antes de enviar
      if (!simbolo) {
        setError(MENSAJES.VACIO);
        inputRef.current?.focus();
        return;
      }

      const errorValidacion = validar(simbolo);
      if (errorValidacion) {
        setError(errorValidacion);
        inputRef.current?.focus();
        return;
      }

      // Limpiar estado y notificar al padre
      setError(null);
      setValor("");
      onAgregar(simbolo);
    },
    [valor, validar, onAgregar]
  );

  // ─── Manejo del teclado ──────────────────────────────────────────────

  const manejarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        manejarEnvio();
      } else if (e.key === "Escape") {
        setValor("");
        setError(null);
        inputRef.current?.blur();
      }
    },
    [manejarEnvio]
  );

  // ─── Manejo del cambio de texto ──────────────────────────────────────

  const manejarCambio = useCallback(
    (texto: string) => {
      // Convertir a mayúsculas automáticamente (los símbolos son uppercase)
      const mayusculas = texto.toUpperCase();
      setValor(mayusculas);
      // Validar en tiempo real, pero solo si hay texto
      setError(texto.trim() ? validar(mayusculas) : null);
    },
    [validar]
  );

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={manejarEnvio}
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:gap-3"
    >
      {/* Contenedor del input con mensaje de error */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={valor}
          onChange={(e) => manejarCambio(e.target.value)}
          onKeyDown={manejarKeyDown}
          placeholder="Buscar símbolo (ej: MU, NFLX)..."
          disabled={cargando}
          aria-label="Símbolo de la acción a buscar"
          aria-invalid={!!error}
          aria-describedby={error ? "searchbar-error" : undefined}
          className={`w-full rounded-lg border bg-slate-800 px-4 py-2.5 text-sm text-white
            placeholder:text-slate-500
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-dark
            disabled:cursor-not-allowed disabled:opacity-50
            ${
              error
                ? "border-red-500/50 focus:ring-red-500/30"
                : valor.trim() && !validar(valor)
                  ? "border-market-green/50 focus:ring-market-green/30"
                  : "border-slate-600 focus:ring-accent"
            }
          `}
        />

        {/* Mensaje de error/éxito debajo del input */}
        {error && (
          <p
            id="searchbar-error"
            className="mt-1.5 text-xs text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {valor.trim() && !error && !simbolosExistentes.includes(valor.trim().toUpperCase()) && (
          <p className="mt-1.5 text-xs text-market-green">
            Símbolo válido — presiona Enter para agregar
          </p>
        )}
      </div>

      {/* Botón de agregar */}
      <button type="submit" disabled={cargando || !!error || !valor.trim()} className="btn-primario whitespace-nowrap">
        {cargando ? (
          <span className="flex items-center gap-2">
            <span className="spinner" />
            Verificando…
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Agregar
          </span>
        )}
      </button>
    </form>
  );
}
