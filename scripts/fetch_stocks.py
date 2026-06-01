"""
Script auxiliar para obtener datos financieros desde Yahoo Finance usando yfinance.

Uso:
  python fetch_stocks.py info <SÍMBOLO>
  python fetch_stocks.py history <SÍMBOLO> [días]

Ejemplos:
  python fetch_stocks.py info AAPL     → Devuelve info actual de Apple
  python fetch_stocks.py history MSFT 30 → Devuelve historial de 30 días de Microsoft

La salida es siempre JSON en stdout para que Next.js pueda parsearlo fácilmente.
Los errores también se emiten como JSON con la clave "error".
"""

import json
import sys
import traceback
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Verificación temprana de dependencia: yfinance debe estar instalado
# ---------------------------------------------------------------------------
try:
    import yfinance as yf
except ImportError:
    print(
        json.dumps(
            {
                "error": "yfinance no está instalado",
                "solucion": "Ejecuta: pip install yfinance",
            }
        )
    )
    sys.exit(0)  # Salida limpia para que Next.js pueda leer el JSON


# ============================================================================
# Funciones auxiliares
# ============================================================================


def _precio_seguro(ticker_info, claves: list[str]) -> float | None:
    """
    Busca el primer valor numérico disponible entre una lista de claves.
    Yahoo Finance a veces usa nombres de campo distintos según el mercado.
    """
    for clave in claves:
        valor = ticker_info.get(clave)
        if isinstance(valor, (int, float)) and valor is not None:
            return round(float(valor), 2)
    return None


def obtener_info(simbolo: str) -> dict:
    """
    Obtiene la información actual de una acción: precio, nombre, cambio diario, etc.
    """
    simbolo = simbolo.upper().strip()
    ticker = yf.Ticker(simbolo)
    info = ticker.info

    # Si yfinance no devuelve datos útiles, el símbolo probablemente no existe
    if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
        return {"error": f"No se encontraron datos para el símbolo '{simbolo}'. Verifica que el símbolo sea correcto."}

    # Extraer campos relevantes de forma segura
    precio_actual = _precio_seguro(
        info,
        ["currentPrice", "regularMarketPrice", "bid", "ask", "previousClose"],
    )
    precio_anterior = _precio_seguro(info, ["previousClose", "regularMarketPreviousClose"])

    cambio = None
    cambio_pct = None
    if precio_actual is not None and precio_anterior is not None and precio_anterior != 0:
        cambio = round(precio_actual - precio_anterior, 2)
        cambio_pct = round((cambio / precio_anterior) * 100, 2)

    return {
        "simbolo": simbolo,
        "nombre": info.get("longName") or info.get("shortName") or simbolo,
        "precio": precio_actual,
        "precioAnterior": precio_anterior,
        "cambio": cambio,
        "cambioPorcentaje": cambio_pct,
        "moneda": info.get("currency", "USD"),
        "mercado": info.get("market", info.get("exchange", "")),
    }


def obtener_historial(simbolo: str, dias: int = 30) -> list[dict]:
    """
    Obtiene el historial de precios de los últimos `dias` días.
    """
    simbolo = simbolo.upper().strip()
    ticker = yf.Ticker(simbolo)

    # Calcular rango de fechas
    fecha_fin = datetime.now()
    fecha_inicio = fecha_fin - timedelta(days=dias + 5)  # Un poco de margen por fines de semana

    hist = ticker.history(start=fecha_inicio, end=fecha_fin)

    if hist.empty:
        return []

    puntos = []
    for fecha, fila in hist.iterrows():
        puntos.append(
            {
                "fecha": fecha.strftime("%Y-%m-%d"),
                "apertura": round(float(fila["Open"]), 2),
                "maximo": round(float(fila["High"]), 2),
                "minimo": round(float(fila["Low"]), 2),
                "cierre": round(float(fila["Close"]), 2),
                "volumen": int(fila["Volume"]),
            }
        )

    # Devolver solo los últimos `dias` puntos (por el margen añadido)
    return puntos[-dias:] if len(puntos) > dias else puntos


# ============================================================================
# Punto de entrada principal
# ============================================================================

if __name__ == "__main__":
    try:
        if len(sys.argv) < 3:
            print(
                json.dumps(
                    {
                        "error": "Argumentos insuficientes",
                        "uso": "python fetch_stocks.py <info|history> <SÍMBOLO> [días]",
                    }
                )
            )
            sys.exit(0)

        comando = sys.argv[1].lower()
        simbolo = sys.argv[2].upper().strip()

        if comando == "info":
            resultado = obtener_info(simbolo)
        elif comando == "history":
            dias = int(sys.argv[3]) if len(sys.argv) > 3 else 30
            resultado = obtener_historial(simbolo, dias)
        elif comando == "completo":
            # Modo combinado: devuelve info + historial en una sola llamada
            dias = int(sys.argv[3]) if len(sys.argv) > 3 else 30
            info = obtener_info(simbolo)
            historial = obtener_historial(simbolo, dias)
            resultado = {**info, "historial": historial}
        else:
            resultado = {"error": f"Comando desconocido: '{comando}'. Usa 'info', 'history' o 'completo'."}

        print(json.dumps(resultado, ensure_ascii=False))

    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": f"Error inesperado al procesar '{sys.argv[2] if len(sys.argv) > 2 else '?'}': {exc}",
                    "detalle": traceback.format_exc(),
                },
                ensure_ascii=False,
            )
        )
        sys.exit(0)
