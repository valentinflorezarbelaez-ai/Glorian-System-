// src/components/EosSolarSanctum.tsx
"use client";

import React, { useState } from "react";
import { MANDATO_TEURGICO, PRACTICAS_OPERATIVAS } from "../core/samaelCodex";

interface Agregado {
  id: string;
  nombre: string;
  centro: string;
  comprension: string;
  estado: "En Juicio" | "Incinerado por RAM-IO";
}

interface ObraDharma {
  id: string;
  descripcion: string;
  factor: "Morir" | "Nacer (Si-12)" | "Sacrificio por la Humanidad";
  puntosLuz: number;
}

export default function EosSolarSanctum() {
  const [moduloActivo, setModuloActivo] = useState<"mandato" | "tresFactores" | "liturgia" | "oraculo">("mandato");

  // Estado del Oráculo Ciber-Teúrgico (/api/teurgia)
  const [consultaOraculo, setConsultaOraculo] = useState(
    "¿Cómo inclinar la Balanza de Anubis a favor de la Gran Obra hoy?",
  );
  const [esferaOraculo, setEsferaOraculo] = useState<"tribunal" | "morir" | "nacer" | "proteccion">("tribunal");
  const [respuestaOraculo, setRespuestaOraculo] = useState<string>(
    "ECUACIÓN DE LA BALANZA CÓSMICA: «Al León de la Ley se le combate con la Balanza». Realiza las 6 inclinaciones hacia el Templo Corazón, invoca a RAM-IO y deposita obras de Sacrificio por la Humanidad.",
  );

  // Estado del Factor Morir (Muerte en Marcha)
  const [agregados, setAgregados] = useState<Agregado[]>([
    {
      id: "1",
      nombre: "Yo de la Impaciencia e Ira Reactiva",
      centro: "Centro Emocional Inferior / Motor",
      comprension: "Reacción mecánica ante la contradicción externa por falta de recuerdo de sí.",
      estado: "Incinerado por RAM-IO",
    },
  ]);
  const [nuevoDefecto, setNuevoDefecto] = useState("");
  const [centroAfectado, setCentroAfectado] = useState("Centro Intelectual");
  const [comprensionTexto, setComprensionTexto] = useState("");

  // Estado de la Balanza Kármica y Tres Factores
  const [dharmaLedger, setDharmaLedger] = useState<ObraDharma[]>([
    {
      id: "d1",
      descripcion: "Vocalización matutina I.A.O. y Transmutación de Hidrógeno Si-12",
      factor: "Nacer (Si-12)",
      puntosLuz: 33,
    },
    {
      id: "d2",
      descripcion: "Difusión gratuita de la Gnosis Solar a través de Eos-System",
      factor: "Sacrificio por la Humanidad",
      puntosLuz: 42,
    },
  ]);
  const [nuevaObra, setNuevaObra] = useState("");
  const [factorSeleccionado, setFactorSeleccionado] = useState<ObraDharma["factor"]>("Sacrificio por la Humanidad");

  // Estado de la Cámara Litúrgica
  const [inclinacionesAnubis, setInclinacionesAnubis] = useState(0);
  const [ciclosRamIo, setCiclosRamIo] = useState(0);

  const registrarAgregado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoDefecto.trim() || !comprensionTexto.trim()) return;
    setAgregados([
      {
        id: Date.now().toString(),
        nombre: nuevoDefecto,
        centro: centroAfectado,
        comprension: comprensionTexto,
        estado: "En Juicio",
      },
      ...agregados,
    ]);
    setNuevoDefecto("");
    setComprensionTexto("");
  };

  const ejecutarLanzaDeEros = (id: string) => {
    setAgregados(agregados.map((ag) => (ag.id === id ? { ...ag, estado: "Incinerado por RAM-IO" } : ag)));
  };

  const registrarDharma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaObra.trim()) return;
    setDharmaLedger([
      {
        id: Date.now().toString(),
        descripcion: nuevaObra,
        factor: factorSeleccionado,
        puntosLuz: 12,
      },
      ...dharmaLedger,
    ]);
    setNuevaObra("");
  };

  const capitalCosmicoTotal = dharmaLedger.reduce((acc, item) => acc + item.puntosLuz, 0);

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100 font-serif selection:bg-amber-500 selection:text-black">
      {/* Cabecera Solar */}
      <header className="border-b border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-transparent py-8 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 mb-2">AUM · TETRAGRAMMATON · THELEMA</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-red-500">
            EOS · TEMPLO SOLAR SAMAELIANO
          </h1>
          <p className="mt-3 text-sm text-slate-400 max-w-2xl mx-auto font-sans">
            Sistema Operativo de los Tres Factores de la Revolución de la Conciencia, Teurgia Crística y Negociación
            ante el Tribunal de la Ley Divina.
          </p>

          {/* Navegación Sefirótica */}
          <nav className="mt-8 flex flex-wrap justify-center gap-3 font-sans text-sm">
            <button
              onClick={() => setModuloActivo("mandato")}
              className={`px-5 py-2.5 rounded border transition-all ${
                moduloActivo === "mandato"
                  ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-lg shadow-amber-500/20"
                  : "border-amber-500/30 text-amber-200 hover:bg-amber-950/40"
              }`}
            >
              🏛️ Mandato Teúrgico Supremo
            </button>
            <button
              onClick={() => setModuloActivo("tresFactores")}
              className={`px-5 py-2.5 rounded border transition-all ${
                moduloActivo === "tresFactores"
                  ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-lg shadow-amber-500/20"
                  : "border-amber-500/30 text-amber-200 hover:bg-amber-950/40"
              }`}
            >
              ⚔️ Laboratorio de los 3 Factores
            </button>
            <button
              onClick={() => setModuloActivo("liturgia")}
              className={`px-5 py-2.5 rounded border transition-all ${
                moduloActivo === "liturgia"
                  ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-lg shadow-amber-500/20"
                  : "border-amber-500/30 text-amber-200 hover:bg-amber-950/40"
              }`}
            >
              ⚖️ Cámara RAM-IO y Tribunal de Anubis
            </button>
            <button
              onClick={() => setModuloActivo("oraculo")}
              className={`px-5 py-2.5 rounded border transition-all ${
                moduloActivo === "oraculo"
                  ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-lg shadow-amber-500/20"
                  : "border-amber-500/30 text-amber-200 hover:bg-amber-950/40"
              }`}
            >
              ☀️ Oráculo /api/teurgia &amp; Geometría Sagrada
            </button>
          </nav>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* MÓDULO 1: MANDATO TEÚRGICO SUPREMO */}
        {moduloActivo === "mandato" && (
          <div className="space-y-6">
            <div className="p-4 rounded border border-red-500/30 bg-red-950/10 text-center font-sans text-xs uppercase tracking-widest text-red-300">
              Ecuación Exacta · Cero Improvisación · Activación Consciente del Verbo
            </div>

            {MANDATO_TEURGICO.map((bloque) => (
              <div
                key={bloque.id}
                className="p-6 rounded-lg border border-amber-500/25 bg-[#0d0d12] hover:border-amber-400/60 transition-all shadow-md"
              >
                <span className="text-xs font-sans uppercase tracking-widest text-amber-400/80 block mb-1">
                  {bloque.sephirah}
                </span>
                <h2 className="text-xl font-bold text-amber-200 mb-3">{bloque.titulo}</h2>
                <p className="text-slate-300 leading-relaxed italic">«{bloque.decreto}»</p>
              </div>
            ))}
          </div>
        )}

        {/* MÓDULO 2: LABORATORIO DE LOS TRES FACTORES */}
        {moduloActivo === "tresFactores" && (
          <div className="grid md:grid-cols-2 gap-8 font-sans">
            {/* Columna Izquierda: Muerte en Marcha (Lanza de Eros) */}
            <section className="p-6 rounded-lg border border-red-500/30 bg-[#0d0d12]">
              <h2 className="text-lg font-bold text-red-400 uppercase tracking-wider mb-2">
                1. Factor Morir · Lanza de Devi Kundalini
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Auto-observación, enjuiciamiento crítico y súplica a la Divina Madre RAM-IO para desintegrar el agregado
                psicológico.
              </p>

              <form onSubmit={registrarAgregado} className="space-y-3 mb-6">
                <input
                  type="text"
                  placeholder="Defecto descubierto (ej. Orgullo místico, Ira, Pereza)..."
                  value={nuevoDefecto}
                  onChange={(e) => setNuevoDefecto(e.target.value)}
                  className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
                />
                <select
                  value={centroAfectado}
                  onChange={(e) => setCentroAfectado(e.target.value)}
                  className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-amber-200"
                >
                  <option>Centro Intelectual</option>
                  <option>Centro Emocional</option>
                  <option>Centro Motor</option>
                  <option>Centro Instintivo</option>
                  <option>Centro Sexual</option>
                </select>
                <textarea
                  placeholder="Comprensión de la raíz del defecto en la escena cotidiana..."
                  value={comprensionTexto}
                  onChange={(e) => setComprensionTexto(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded text-sm transition"
                >
                  Someter Agregado a Juicio
                </button>
              </form>

              <div className="space-y-3">
                {agregados.map((ag) => (
                  <div key={ag.id} className="p-3.5 rounded border border-slate-800 bg-black/60 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-amber-200 text-sm">{ag.nombre}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded uppercase ${
                          ag.estado === "Incinerado por RAM-IO"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-950 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {ag.estado}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{ag.comprension}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[11px] text-slate-500">{ag.centro}</span>
                      {ag.estado === "En Juicio" && (
                        <button
                          onClick={() => ejecutarLanzaDeEros(ag.id)}
                          className="text-xs px-3 py-1 rounded bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500 hover:text-black transition"
                        >
                          ⚡ Invocar Lanza de Eros (RAM-IO)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Columna Derecha: Nacer y Sacrificio (Balanza del Dharma) */}
            <section className="p-6 rounded-lg border border-amber-500/30 bg-[#0d0d12]">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-amber-400 uppercase tracking-wider">
                  2 &amp; 3. Nacer y Balanza del Dharma
                </h2>
                <span className="text-xs px-3 py-1 rounded bg-amber-500/20 border border-amber-400 text-amber-300 font-bold">
                  Capital Cósmico: {capitalCosmicoTotal} Dharma
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                «Al León de la Ley se le combate con la Balanza». Registra la transmutación del Hidrógeno Si-12 y las
                obras de caridad universal.
              </p>

              <form onSubmit={registrarDharma} className="space-y-3 mb-6">
                <input
                  type="text"
                  placeholder="Obra realizada (ej. Práctica de Pranayama, Caridad, Difusión)..."
                  value={nuevaObra}
                  onChange={(e) => setNuevaObra(e.target.value)}
                  className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
                />
                <select
                  value={factorSeleccionado}
                  onChange={(e) => setFactorSeleccionado(e.target.value as ObraDharma["factor"])}
                  className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-amber-200"
                >
                  <option value="Nacer (Si-12)">Factor Nacer (Transmutación / Si-12)</option>
                  <option value="Sacrificio por la Humanidad">Factor Sacrificio por la Humanidad</option>
                  <option value="Morir">Factor Morir (Rectitud y Auto-observación)</option>
                </select>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-sm transition"
                >
                  Depositar en el Platillo del Dharma
                </button>
              </form>

              <div className="space-y-2.5">
                {dharmaLedger.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded border border-slate-800 bg-black/60 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm text-slate-200">{item.descripcion}</p>
                      <span className="text-[11px] text-amber-400/80">{item.factor}</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">+{item.puntosLuz} Luz</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* MÓDULO 3: CÁMARA LITÚRGICA (RAM-IO Y TEMPLO CORAZÓN) */}
        {moduloActivo === "liturgia" && (
          <div className="grid md:grid-cols-2 gap-8 font-sans">
            {/* Práctica Nocturna RAM-IO */}
            <div className="p-6 rounded-lg border border-amber-500/30 bg-[#0d0d12] flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-400">
                  Novena Esfera &amp; Divina Madre
                </span>
                <h2 className="text-xl font-bold text-white mt-1 mb-2">{PRACTICAS_OPERATIVAS.ramIo.titulo}</h2>
                <p className="text-xs text-slate-400 mb-4">{PRACTICAS_OPERATIVAS.ramIo.frecuencia}</p>
                <ul className="space-y-3 text-sm text-slate-300 mb-6">
                  {PRACTICAS_OPERATIVAS.ramIo.pasos.map((paso, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-black/50 border border-slate-800">
                      {paso}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-amber-950/20 border border-amber-500/40 text-center">
                <p className="text-xs uppercase tracking-widest text-amber-300 mb-2">
                  Contador de Vocalización Consciente ({ciclosRamIo} / 33)
                </p>
                <button
                  onClick={() => setCiclosRamIo((c) => c + 1)}
                  className="px-6 py-2.5 rounded bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
                >
                  Vocalizar: RAAAAAM... IOOOOO... (+1)
                </button>
              </div>
            </div>

            {/* Negociación en el Templo Corazón (Anubis) */}
            <div className="p-6 rounded-lg border border-amber-500/30 bg-[#0d0d12] flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-red-400">Jerarca Anubis y los 42 Jueces</span>
                <h2 className="text-xl font-bold text-white mt-1 mb-2">{PRACTICAS_OPERATIVAS.temploCorazon.titulo}</h2>
                <p className="text-xs text-slate-400 mb-4">{PRACTICAS_OPERATIVAS.temploCorazon.frecuencia}</p>
                <ul className="space-y-3 text-sm text-slate-300 mb-6">
                  {PRACTICAS_OPERATIVAS.temploCorazon.pasos.map((paso, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-black/50 border border-slate-800">
                      {paso}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-red-950/20 border border-red-500/40 text-center">
                <p className="text-xs uppercase tracking-widest text-red-300 mb-2">
                  Seis Inclinaciones Rituales ({inclinacionesAnubis} / 6)
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setInclinacionesAnubis((i) => (i < 6 ? i + 1 : 6))}
                    className="px-5 py-2.5 rounded bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition"
                  >
                    {inclinacionesAnubis < 6
                      ? `Realizar Inclinación (${inclinacionesAnubis + 1}ª)`
                      : "✓ Audiencia Sellada ante Anubis"}
                  </button>
                  {inclinacionesAnubis > 0 && (
                    <button
                      onClick={() => setInclinacionesAnubis(0)}
                      className="px-3 py-2.5 rounded border border-slate-700 text-xs text-slate-400 hover:text-white"
                    >
                      Reiniciar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 4: ORÁCULO CIBER-TEÚRGICO (/API/TEURGIA) & GEOMETRÍA SAGRADA */}
        {moduloActivo === "oraculo" && (
          <div className="p-6 rounded-lg border border-amber-500/30 bg-[#0d0d12] font-sans space-y-4">
            <h2 className="text-xl font-bold text-amber-300">
              Oráculo del Gran Arquitecto (/api/teurgia) · Ecuación Kármica en Vivo
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                value={consultaOraculo}
                onChange={(e) => setConsultaOraculo(e.target.value)}
                className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-white"
              />
              <select
                value={esferaOraculo}
                onChange={(e) => setEsferaOraculo(e.target.value as typeof esferaOraculo)}
                className="w-full p-2.5 rounded bg-black border border-slate-700 text-sm text-amber-200"
              >
                <option value="tribunal">Chesed · Geburah (Tribunal de Anubis)</option>
                <option value="morir">Binah · Devi Kundalini (Muerte Mística RAM-IO)</option>
                <option value="nacer">Yesod · Tiphereth (Transmutación Si-12 / I.A.O.)</option>
                <option value="proteccion">Kether · Chokmah (Belilin y Círculo Mágico)</option>
              </select>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/teurgia", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      consulta: consultaOraculo,
                      esfera: esferaOraculo,
                      dharma: capitalCosmicoTotal,
                      enJuicio: agregados.filter((a) => a.estado === "En Juicio").length,
                    }),
                  });
                  const data = await res.json();
                  setRespuestaOraculo(`${data.sephirahActiva} — ${data.dictamenTeurgico}`);
                } catch {
                  setRespuestaOraculo(
                    "Dictamen Local Determinista: Mantén el Recuerdo de Sí (Clave de SOL), vocaliza RAM-IO y combate al León de la Ley con la Balanza.",
                  );
                }
              }}
              className="px-5 py-2.5 rounded bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
            >
              Consultar Tribunal &amp; Emitir Sello SHA-256
            </button>
            <p className="p-4 rounded bg-black/60 border border-amber-500/20 text-sm text-slate-200">
              {respuestaOraculo}
            </p>
          </div>
        )}
      </main>

      {/* Pie de Sellado Teúrgico */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-sans">
        EOS-SYSTEM · GRAN OBRA DEL PADRE · PAZ INVERENCIAL
      </footer>
    </div>
  );
}
