/**
 * 🏯 JUJUTSU KAISEN: SHINJUKU SHOWDOWN - ETERNITY ENGINE
 * @developer Orlas (José Orlando)
 * @version 10.0 - MOTOR COMPLETO
 * SISTEMAS INCLUIDOS:
 * - 120 Técnicas Totales (7 Clanes).
 * - Identificación por Roles Reales.
 * - Pasiva Seis Ojos (99% reducción EN).
 * - Choque de Dominios (Prioridad por XP).
 * - Tienda, Economía y Sistema de Dedos (1-20).
 * - Eventos de Bosses Aleatorios (timer autónomo c/30min).
 * - Sistema Gokumonkyō 3 variantes (Pequeño/Estándar/Eterno).
 * - Spawn Autónomo Callejón c/15min.
 * - Sistema de Equipamiento con Buffs reales.
 * - Comandos de Dios (Admins).
 * - RCT: cura al lanzador, sin objetivo.
 * - Rankings separados: XP, Yenes, Dedos, HP.
 * - !exorcizar, !inventario.
 */

import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import { Client, GatewayIntentBits, Events, EmbedBuilder, TextChannel } from 'discord.js';

// ==========================================
// 💾 TIPOS
// ==========================================
interface MisionActiva {
    tipo: string;
    desc: string;
    objetivo: number;
    progreso: number;
    recompY: number;
    recompXP: number;
}

interface Usuario {
    n: string;
    hp: number;
    en: number;
    y: number;
    xp: number;
    dedos: number;
    inv: string[];
    lastDom: number;
    sellado: number | null;
    rolesSellado: string[];
    equipado: string | null;
    meditarCooldown: number;
    trabajarCooldown: number;
    pactadoCon: string | null;
    tieneBrazo: boolean;
    cooldowns: Record<string, number>;
    kills: number;
    bossKills: number;
    tecUsadas: number;
    ultimoDiario: number;
    escudo: number;
    vecesTrabajado: number;
    vecesRobadoExito: number;
    vecesDiario: number;
    vecesRecogido: number;
    vecesVendido: number;
    vecesMeditado: number;
    vecesRecuperado: number;
    vecesIntercambio: number;
    vecesSellado: number;
    vecesReroll: number;
    misionesCumplidas: number;
    logrosDesbloqueados: string[];
    misionActual: MisionActiva | null;
}

interface Config {
    setupMaldiciones: string | null;
    setupCallejon: string | null;
    itemCallejonActual: string | null;
    itemCallejonExpira: number | null;
    setupTrabajo: string | null;
    setupCombate: string | null;
    setupTienda: string | null;
    setupPerfil: string | null;
}

interface Grado {
    n: string;
    xp: number;
    dmgM: number;
    hpBase: number;
    enBase: number;
}

interface Tecnica {
    n: string;
    d: number;
    c: number;
    g: string;
    clan: string;
    dom?: boolean;
    def?: boolean;
    buff?: boolean;
    gif?: string;
}

interface ItemTienda {
    n: string;
    precio: number;
    desc: string;
    duracion?: number;
}

interface ItemEquipamiento {
    desc: string;
    sinClan?: boolean;
    dmgBossBonus?: number;
    dmgBonus?: number;
    dmgZeninBonus?: number;
    ignoraDef?: boolean;
    regenX2?: boolean;
}

interface SpawnConfig {
    n: string;
    hp: number;
    y: number;
    xp: number;
    prob: number;
}

interface BossActivo {
    s: SpawnConfig;
    hpActual: number;
}

// ==========================================
// 💾 SISTEMA DE BASE DE DATOS LOCAL
// ==========================================
let db = new Map<string, Usuario>();
const DB_PATH = './shinjuku_data.json';
const CONFIG_PATH = './shinjuku_config.json';
let config: Config = {
    setupMaldiciones: null,
    setupCallejon: null,
    itemCallejonActual: null,
    itemCallejonExpira: null,
    setupTrabajo: null,
    setupCombate: null,
    setupTienda: null,
    setupPerfil: null,
};

const bossesActivos        = new Map<string, BossActivo>();
const retosActivos         = new Map<string, { retadorId: string; retadorName: string; expira: number }>();
const intercambiosActivos  = new Map<string, { solicitanteId: string; solicitanteName: string; itemOfrecido: string; expira: number }>();
const historialEventos: string[] = [];

const agregarHistorial = (evento: string): void => {
    historialEventos.unshift(`<t:${Math.floor(Date.now() / 1000)}:R> ${evento}`);
    if (historialEventos.length > 15) historialEventos.pop();
};

// ==========================================
// 🏆 100 LOGROS
// ==========================================
interface Logro { id: string; n: string; desc: string; icono: string; recompY: number; recompXP: number; check: (u: Usuario) => boolean; }
const LOGROS: Logro[] = [
    // PvP Kills (10)
    { id: 'primera_sangre',        n: 'Primera Sangre',            desc: 'Consigue tu primer kill PvP',                              icono: '⚔️',  recompY: 2000,    recompXP: 500,    check: u => (u.kills ?? 0) >= 1 },
    { id: 'cazador_novato',        n: 'Cazador Novato',            desc: 'Derrota a 5 hechiceros en PvP',                            icono: '🗡️',  recompY: 5000,    recompXP: 1000,   check: u => (u.kills ?? 0) >= 5 },
    { id: 'cazador',               n: 'Cazador',                   desc: 'Derrota a 10 hechiceros en PvP',                           icono: '⚔️',  recompY: 10000,   recompXP: 2000,   check: u => (u.kills ?? 0) >= 10 },
    { id: 'cazador_experimentado', n: 'Cazador Experimentado',     desc: 'Derrota a 25 hechiceros en PvP',                           icono: '🔪',  recompY: 25000,   recompXP: 5000,   check: u => (u.kills ?? 0) >= 25 },
    { id: 'cazador_experto',       n: 'Cazador Experto',           desc: 'Derrota a 50 hechiceros en PvP',                           icono: '💀',  recompY: 50000,   recompXP: 10000,  check: u => (u.kills ?? 0) >= 50 },
    { id: 'cazador_elite',         n: 'Cazador Élite',             desc: 'Derrota a 100 hechiceros en PvP',                          icono: '💀',  recompY: 100000,  recompXP: 20000,  check: u => (u.kills ?? 0) >= 100 },
    { id: 'leyenda_pvp',           n: 'Leyenda del Combate',       desc: 'Derrota a 200 hechiceros en PvP',                          icono: '🏆',  recompY: 200000,  recompXP: 40000,  check: u => (u.kills ?? 0) >= 200 },
    { id: 'asesino_implacable',    n: 'Asesino Implacable',        desc: 'Derrota a 500 hechiceros en PvP',                          icono: '👁️',  recompY: 500000,  recompXP: 100000, check: u => (u.kills ?? 0) >= 500 },
    { id: 'dios_guerra',           n: 'Dios de la Guerra',         desc: 'Derrota a 1000 hechiceros en PvP',                         icono: '🔱',  recompY: 1000000, recompXP: 200000, check: u => (u.kills ?? 0) >= 1000 },
    { id: 'eterno_asesino',        n: 'Asesino Eterno',            desc: 'Derrota a 2000 hechiceros en PvP',                         icono: '♾️',  recompY: 2000000, recompXP: 500000, check: u => (u.kills ?? 0) >= 2000 },
    // Boss Kills (8)
    { id: 'primer_exorcismo',      n: 'Primer Exorcismo',          desc: 'Exorciza tu primera maldición',                            icono: '👾',  recompY: 3000,    recompXP: 500,    check: u => (u.bossKills ?? 0) >= 1 },
    { id: 'exorcista_novato',      n: 'Exorcista Novato',          desc: 'Exorciza 5 maldiciones',                                   icono: '👾',  recompY: 10000,   recompXP: 2000,   check: u => (u.bossKills ?? 0) >= 5 },
    { id: 'exorcista',             n: 'Exorcista',                 desc: 'Exorciza 10 maldiciones',                                  icono: '🔥',  recompY: 20000,   recompXP: 4000,   check: u => (u.bossKills ?? 0) >= 10 },
    { id: 'exorcista_elite',       n: 'Exorcista Élite',           desc: 'Exorciza 25 maldiciones',                                  icono: '🔥',  recompY: 50000,   recompXP: 10000,  check: u => (u.bossKills ?? 0) >= 25 },
    { id: 'guardian',              n: 'Guardián de Shinjuku',      desc: 'Exorciza 50 maldiciones',                                  icono: '🛡️',  recompY: 100000,  recompXP: 20000,  check: u => (u.bossKills ?? 0) >= 50 },
    { id: 'exorcista_legendario',  n: 'Exorcista Legendario',      desc: 'Exorciza 100 maldiciones',                                 icono: '🏆',  recompY: 250000,  recompXP: 50000,  check: u => (u.bossKills ?? 0) >= 100 },
    { id: 'maestro_exorcismo',     n: 'Maestro del Exorcismo',     desc: 'Exorciza 200 maldiciones',                                 icono: '🌟',  recompY: 500000,  recompXP: 100000, check: u => (u.bossKills ?? 0) >= 200 },
    { id: 'azote_maldiciones',     n: 'Azote de Maldiciones',      desc: 'Exorciza 500 maldiciones',                                 icono: '⚡',  recompY: 1000000, recompXP: 250000, check: u => (u.bossKills ?? 0) >= 500 },
    // Técnicas (8)
    { id: 'primer_tecnica',        n: 'Primera Técnica',           desc: 'Usa tu primera técnica de combate',                        icono: '✨',  recompY: 1000,    recompXP: 100,    check: u => (u.tecUsadas ?? 0) >= 1 },
    { id: 'aprendiz_hechicero',    n: 'Aprendiz de Hechicero',     desc: 'Usa 10 técnicas',                                          icono: '📚',  recompY: 3000,    recompXP: 500,    check: u => (u.tecUsadas ?? 0) >= 10 },
    { id: 'practicante',           n: 'Practicante',               desc: 'Usa 50 técnicas',                                          icono: '📖',  recompY: 10000,   recompXP: 2000,   check: u => (u.tecUsadas ?? 0) >= 50 },
    { id: 'hechicero_activo',      n: 'Hechicero Activo',          desc: 'Usa 100 técnicas',                                         icono: '⚡',  recompY: 20000,   recompXP: 5000,   check: u => (u.tecUsadas ?? 0) >= 100 },
    { id: 'tecnico',               n: 'Técnico',                   desc: 'Usa 250 técnicas',                                         icono: '🔮',  recompY: 50000,   recompXP: 10000,  check: u => (u.tecUsadas ?? 0) >= 250 },
    { id: 'maestro_tecnico',       n: 'Maestro Técnico',           desc: 'Usa 500 técnicas',                                         icono: '🌟',  recompY: 100000,  recompXP: 25000,  check: u => (u.tecUsadas ?? 0) >= 500 },
    { id: 'virtuoso_jujutsu',      n: 'Virtuoso del Jujutsu',      desc: 'Usa 1000 técnicas',                                        icono: '💫',  recompY: 200000,  recompXP: 50000,  check: u => (u.tecUsadas ?? 0) >= 1000 },
    { id: 'enciclopedia_viviente', n: 'Enciclopedia Viviente',     desc: 'Usa 2000 técnicas',                                        icono: '📜',  recompY: 500000,  recompXP: 100000, check: u => (u.tecUsadas ?? 0) >= 2000 },
    // Grado / XP (8)
    { id: 'ascenso_grado3',        n: 'Ascenso: Grado 3',          desc: 'Alcanza el rango de Grado 3',                              icono: '🎖️',  recompY: 5000,    recompXP: 0,      check: u => u.xp >= 5000 },
    { id: 'ascenso_grado2',        n: 'Ascenso: Grado 2',          desc: 'Alcanza el rango de Grado 2',                              icono: '🎖️',  recompY: 20000,   recompXP: 0,      check: u => u.xp >= 20000 },
    { id: 'ascenso_grado1',        n: 'Ascenso: Grado 1',          desc: 'Alcanza el rango de Grado 1',                              icono: '🎖️',  recompY: 50000,   recompXP: 0,      check: u => u.xp >= 60000 },
    { id: 'grado_especial_logro',  n: 'Grado Especial',            desc: 'Alcanza el rango de Grado Especial',                       icono: '👑',  recompY: 100000,  recompXP: 0,      check: u => u.xp >= 150000 },
    { id: 'xp_10k',                n: '10.000 de Energía',         desc: 'Acumula 10.000 XP',                                        icono: '✨',  recompY: 5000,    recompXP: 0,      check: u => u.xp >= 10000 },
    { id: 'xp_100k',               n: '100.000 de Experiencia',    desc: 'Acumula 100.000 XP',                                       icono: '💫',  recompY: 10000,   recompXP: 0,      check: u => u.xp >= 100000 },
    { id: 'xp_500k',               n: 'Medio Millón de XP',        desc: 'Acumula 500.000 XP',                                       icono: '🌟',  recompY: 25000,   recompXP: 0,      check: u => u.xp >= 500000 },
    { id: 'xp_1M',                 n: 'Un Millón de XP',           desc: 'Acumula 1.000.000 XP',                                     icono: '🏆',  recompY: 50000,   recompXP: 0,      check: u => u.xp >= 1000000 },
    // Dedos de Sukuna (7)
    { id: 'primer_dedo',           n: 'Primer Recipiente',         desc: 'Obtén tu primer dedo de Sukuna',                           icono: '☝️',  recompY: 10000,   recompXP: 5000,   check: u => u.dedos >= 1 },
    { id: 'coleccionista_dedos',   n: 'Coleccionista',             desc: 'Acumula 5 dedos de Sukuna',                                icono: '✋',  recompY: 30000,   recompXP: 15000,  check: u => u.dedos >= 5 },
    { id: 'recipiente',            n: 'Recipiente',                desc: 'Acumula 10 dedos de Sukuna',                               icono: '🖐️',  recompY: 80000,   recompXP: 40000,  check: u => u.dedos >= 10 },
    { id: 'recipiente_avanzado',   n: 'Recipiente Avanzado',       desc: 'Acumula 15 dedos de Sukuna',                               icono: '💀',  recompY: 150000,  recompXP: 80000,  check: u => u.dedos >= 15 },
    { id: 'recipiente_completo',   n: 'Recipiente Completo',       desc: 'Reúne los 20 dedos de Sukuna',                             icono: '👑',  recompY: 500000,  recompXP: 200000, check: u => u.dedos >= 20 },
    { id: 'brazo_sukuna_logro',    n: 'Reliquia del Rey',          desc: 'Obtén el Brazo de Sukuna',                                 icono: '💪',  recompY: 100000,  recompXP: 50000,  check: u => u.tieneBrazo },
    { id: 'rey_completo',          n: 'El Rey Completo',           desc: 'Reúne los 20 dedos y el Brazo de Sukuna',                  icono: '🔱',  recompY: 1000000, recompXP: 500000, check: u => u.dedos >= 20 && u.tieneBrazo },
    // Yenes actuales (6)
    { id: 'primeros_pasos',        n: 'Primeros Pasos',            desc: 'Acumula 10.000 yenes',                                     icono: '💴',  recompY: 0,       recompXP: 500,    check: u => u.y >= 10000 },
    { id: 'ahorro_serio',          n: 'Ahorro Serio',              desc: 'Acumula 50.000 yenes',                                     icono: '💰',  recompY: 0,       recompXP: 1000,   check: u => u.y >= 50000 },
    { id: 'rico_novato',           n: 'Rico Novato',               desc: 'Acumula 200.000 yenes',                                    icono: '💰',  recompY: 0,       recompXP: 5000,   check: u => u.y >= 200000 },
    { id: 'millonario',            n: 'Millonario',                desc: 'Acumula 1.000.000 yenes',                                  icono: '💎',  recompY: 0,       recompXP: 20000,  check: u => u.y >= 1000000 },
    { id: 'archimillonario',       n: 'Archimillonario',           desc: 'Acumula 5.000.000 yenes',                                  icono: '💎',  recompY: 0,       recompXP: 50000,  check: u => u.y >= 5000000 },
    { id: 'magnate',               n: 'Magnate',                   desc: 'Acumula 10.000.000 yenes',                                 icono: '👑',  recompY: 0,       recompXP: 100000, check: u => u.y >= 10000000 },
    // Trabajo (6)
    { id: 'primer_trabajo',        n: 'Primer Trabajo',            desc: 'Trabaja por primera vez',                                  icono: '💼',  recompY: 1000,    recompXP: 200,    check: u => (u.vecesTrabajado ?? 0) >= 1 },
    { id: 'obrero',                n: 'Obrero',                    desc: 'Trabaja 10 veces',                                         icono: '💼',  recompY: 5000,    recompXP: 1000,   check: u => (u.vecesTrabajado ?? 0) >= 10 },
    { id: 'empleado_dedicado',     n: 'Empleado Dedicado',         desc: 'Trabaja 25 veces',                                         icono: '🏢',  recompY: 10000,   recompXP: 3000,   check: u => (u.vecesTrabajado ?? 0) >= 25 },
    { id: 'veterano_trabajo',      n: 'Veterano del Trabajo',      desc: 'Trabaja 50 veces',                                         icono: '🏆',  recompY: 20000,   recompXP: 6000,   check: u => (u.vecesTrabajado ?? 0) >= 50 },
    { id: 'workaholic',            n: 'Workaholic',                desc: 'Trabaja 100 veces',                                        icono: '⚡',  recompY: 50000,   recompXP: 15000,  check: u => (u.vecesTrabajado ?? 0) >= 100 },
    { id: 'leyenda_trabajo',       n: 'Leyenda del Trabajo',       desc: 'Trabaja 500 veces',                                        icono: '🌟',  recompY: 200000,  recompXP: 80000,  check: u => (u.vecesTrabajado ?? 0) >= 500 },
    // Robo (6)
    { id: 'primer_robo',           n: 'Primer Robo',               desc: 'Roba exitosamente por primera vez',                        icono: '🦹',  recompY: 5000,    recompXP: 1000,   check: u => (u.vecesRobadoExito ?? 0) >= 1 },
    { id: 'ladron_novato',         n: 'Ladrón Novato',             desc: 'Roba exitosamente 5 veces',                                icono: '🦹',  recompY: 15000,   recompXP: 3000,   check: u => (u.vecesRobadoExito ?? 0) >= 5 },
    { id: 'ladron',                n: 'Ladrón',                    desc: 'Roba exitosamente 15 veces',                               icono: '🌑',  recompY: 30000,   recompXP: 7000,   check: u => (u.vecesRobadoExito ?? 0) >= 15 },
    { id: 'maestro_ladron',        n: 'Maestro Ladrón',            desc: 'Roba exitosamente 30 veces',                               icono: '🕶️',  recompY: 70000,   recompXP: 15000,  check: u => (u.vecesRobadoExito ?? 0) >= 30 },
    { id: 'sombra_oscura',         n: 'Sombra Oscura',             desc: 'Roba exitosamente 75 veces',                               icono: '🌚',  recompY: 150000,  recompXP: 40000,  check: u => (u.vecesRobadoExito ?? 0) >= 75 },
    { id: 'rey_sombras',           n: 'Rey de las Sombras',        desc: 'Roba exitosamente 150 veces',                              icono: '🖤',  recompY: 350000,  recompXP: 100000, check: u => (u.vecesRobadoExito ?? 0) >= 150 },
    // Diario (4)
    { id: 'primer_diario',         n: 'Recompensa Diaria',         desc: 'Reclama tu primera recompensa diaria',                     icono: '🎁',  recompY: 1000,    recompXP: 200,    check: u => (u.vecesDiario ?? 0) >= 1 },
    { id: 'constante',             n: 'Constante',                 desc: 'Reclama 7 recompensas diarias',                            icono: '📅',  recompY: 5000,    recompXP: 1000,   check: u => (u.vecesDiario ?? 0) >= 7 },
    { id: 'dedicado',              n: 'Dedicado',                  desc: 'Reclama 30 recompensas diarias',                           icono: '🗓️',  recompY: 20000,   recompXP: 5000,   check: u => (u.vecesDiario ?? 0) >= 30 },
    { id: 'fanatico_diario',       n: 'Fanático',                  desc: 'Reclama 100 recompensas diarias',                          icono: '🔥',  recompY: 100000,  recompXP: 25000,  check: u => (u.vecesDiario ?? 0) >= 100 },
    // Callejón (5)
    { id: 'primer_hallazgo',       n: 'Primer Hallazgo',           desc: 'Recoge tu primer objeto del callejón',                     icono: '🎁',  recompY: 2000,    recompXP: 500,    check: u => (u.vecesRecogido ?? 0) >= 1 },
    { id: 'buscador',              n: 'Buscador',                  desc: 'Recoge 5 objetos del callejón',                            icono: '🔍',  recompY: 8000,    recompXP: 2000,   check: u => (u.vecesRecogido ?? 0) >= 5 },
    { id: 'explorador',            n: 'Explorador',                desc: 'Recoge 15 objetos del callejón',                           icono: '🗺️',  recompY: 20000,   recompXP: 5000,   check: u => (u.vecesRecogido ?? 0) >= 15 },
    { id: 'habitual',              n: 'Habitual del Callejón',     desc: 'Recoge 30 objetos del callejón',                           icono: '🌆',  recompY: 40000,   recompXP: 10000,  check: u => (u.vecesRecogido ?? 0) >= 30 },
    { id: 'maestro_callejon',      n: 'Maestro del Callejón',      desc: 'Recoge 75 objetos del callejón',                           icono: '🏙️',  recompY: 100000,  recompXP: 30000,  check: u => (u.vecesRecogido ?? 0) >= 75 },
    // Inventario / Equipamiento (5)
    { id: 'primer_item',           n: 'Primer Objeto',             desc: 'Obtén tu primer objeto',                                   icono: '🎒',  recompY: 2000,    recompXP: 500,    check: u => u.inv.length >= 1 },
    { id: 'coleccionista_items',   n: 'Coleccionista de Objetos',  desc: 'Ten 5 objetos en el inventario',                           icono: '🎒',  recompY: 10000,   recompXP: 2000,   check: u => u.inv.length >= 5 },
    { id: 'arsenal_logro',         n: 'Arsenal',                   desc: 'Ten 10 objetos en el inventario',                          icono: '⚔️',  recompY: 20000,   recompXP: 5000,   check: u => u.inv.length >= 10 },
    { id: 'primer_equipo',         n: 'Primer Equipo',             desc: 'Equipa un objeto',                                         icono: '🛡️',  recompY: 2000,    recompXP: 500,    check: u => u.equipado !== null },
    { id: 'arsenal_completo',      n: 'Arsenal Completo',          desc: 'Posee todos los equipamientos',                            icono: '🔱',  recompY: 300000,  recompXP: 100000, check: u => u.tieneBrazo && u.inv.includes('Gafas de Maki') && u.inv.includes('Nube Itinerante') && u.inv.includes('Lanza Invertida') },
    // Venta (4)
    { id: 'primer_venta',          n: 'Primera Venta',             desc: 'Vende tu primer objeto',                                   icono: '🏪',  recompY: 2000,    recompXP: 500,    check: u => (u.vecesVendido ?? 0) >= 1 },
    { id: 'vendedor',              n: 'Vendedor',                  desc: 'Vende 10 objetos',                                         icono: '🛒',  recompY: 15000,   recompXP: 3000,   check: u => (u.vecesVendido ?? 0) >= 10 },
    { id: 'mercader',              n: 'Mercader',                  desc: 'Vende 25 objetos',                                         icono: '💹',  recompY: 40000,   recompXP: 10000,  check: u => (u.vecesVendido ?? 0) >= 25 },
    { id: 'magnate_mercado',       n: 'Magnate del Mercado',       desc: 'Vende 75 objetos',                                         icono: '🏦',  recompY: 100000,  recompXP: 30000,  check: u => (u.vecesVendido ?? 0) >= 75 },
    // Meditación (4)
    { id: 'primer_meditacion',     n: 'Primera Meditación',        desc: 'Medita por primera vez',                                   icono: '🧘',  recompY: 1000,    recompXP: 200,    check: u => (u.vecesMeditado ?? 0) >= 1 },
    { id: 'monje',                 n: 'Monje',                     desc: 'Medita 10 veces',                                          icono: '🧘',  recompY: 5000,    recompXP: 1000,   check: u => (u.vecesMeditado ?? 0) >= 10 },
    { id: 'maestro_zen',           n: 'Maestro Zen',               desc: 'Medita 50 veces',                                          icono: '☯️',  recompY: 20000,   recompXP: 5000,   check: u => (u.vecesMeditado ?? 0) >= 50 },
    { id: 'buda_del_jujutsu',      n: 'Buda del Jujutsu',          desc: 'Medita 150 veces',                                         icono: '🌸',  recompY: 60000,   recompXP: 20000,  check: u => (u.vecesMeditado ?? 0) >= 150 },
    // Recuperar (2)
    { id: 'primer_recuperacion',   n: 'Primera Recuperación',      desc: 'Usa !recuperar por primera vez',                           icono: '💊',  recompY: 1000,    recompXP: 200,    check: u => (u.vecesRecuperado ?? 0) >= 1 },
    { id: 'doctor_jujutsu',        n: 'Médico del Jujutsu',        desc: 'Usa !recuperar 20 veces',                                  icono: '🏥',  recompY: 10000,   recompXP: 2000,   check: u => (u.vecesRecuperado ?? 0) >= 20 },
    // Pacto (2)
    { id: 'primer_pacto',          n: 'Primer Pacto',              desc: 'Establece un pacto con alguien',                           icono: '🤝',  recompY: 5000,    recompXP: 1000,   check: u => u.pactadoCon !== null },
    { id: 'alianza_eterna',        n: 'Alianza Eterna',            desc: 'Mantén un pacto y alcanza Grado 1',                        icono: '🤝',  recompY: 20000,   recompXP: 5000,   check: u => u.pactadoCon !== null && u.xp >= 60000 },
    // Misiones (5)
    { id: 'primera_mision',        n: 'Primera Misión',            desc: 'Completa tu primera misión',                               icono: '📋',  recompY: 10000,   recompXP: 3000,   check: u => (u.misionesCumplidas ?? 0) >= 1 },
    { id: 'misionero',             n: 'Misionero',                 desc: 'Completa 10 misiones',                                     icono: '📋',  recompY: 30000,   recompXP: 8000,   check: u => (u.misionesCumplidas ?? 0) >= 10 },
    { id: 'veterano_misiones',     n: 'Veterano de Misiones',      desc: 'Completa 50 misiones',                                     icono: '🏅',  recompY: 100000,  recompXP: 30000,  check: u => (u.misionesCumplidas ?? 0) >= 50 },
    { id: 'mision_legendaria',     n: 'Misiones Legendarias',      desc: 'Completa 100 misiones',                                    icono: '🥇',  recompY: 300000,  recompXP: 100000, check: u => (u.misionesCumplidas ?? 0) >= 100 },
    { id: 'incansable_misiones',   n: 'Incansable',                desc: 'Completa 500 misiones',                                    icono: '♾️',  recompY: 1000000, recompXP: 500000, check: u => (u.misionesCumplidas ?? 0) >= 500 },
    // Especiales / Mix (4)
    { id: 'intercambiante',        n: 'Comerciante',               desc: 'Completa un intercambio de objetos',                       icono: '🔄',  recompY: 5000,    recompXP: 1000,   check: u => (u.vecesIntercambio ?? 0) >= 1 },
    { id: 'sellador_logro',        n: 'Sellador',                  desc: 'Sella a un jugador con el Gokumonkyō',                     icono: '🔒',  recompY: 15000,   recompXP: 3000,   check: u => (u.vecesSellado ?? 0) >= 1 },
    { id: 'maestro_dual',          n: 'Maestro Dual',              desc: 'Consigue 50 kills PvP y 25 boss kills',                    icono: '⚔️',  recompY: 80000,   recompXP: 20000,  check: u => (u.kills ?? 0) >= 50 && (u.bossKills ?? 0) >= 25 },
    { id: 'rerolleador',           n: 'Renegado',                  desc: 'Cambia de clan una vez',                                   icono: '🔀',  recompY: 20000,   recompXP: 5000,   check: u => (u.vecesReroll ?? 0) >= 1 },
    // Meta-logros (4)
    { id: 'dominio_maestro',       n: 'Maestro de Dominios',       desc: 'Usa un Dominio de Extensión 5 veces',              icono: '🌌',  recompY: 50000,   recompXP: 15000,  check: u => Object.entries(u.cooldowns).filter(([k]) => TECNICAS[k]?.dom).length >= 1 && (u.tecUsadas ?? 0) >= 5 },
    { id: 'logros_10',             n: '10 Logros',                 desc: 'Desbloquea 10 logros',                                     icono: '🥉',  recompY: 5000,    recompXP: 1000,   check: u => (u.logrosDesbloqueados?.length ?? 0) >= 10 },
    { id: 'logros_25',             n: '25 Logros',                 desc: 'Desbloquea 25 logros',                                     icono: '🥈',  recompY: 15000,   recompXP: 4000,   check: u => (u.logrosDesbloqueados?.length ?? 0) >= 25 },
    { id: 'logros_50',             n: '50 Logros',                 desc: 'Desbloquea 50 logros',                                     icono: '🥇',  recompY: 50000,   recompXP: 15000,  check: u => (u.logrosDesbloqueados?.length ?? 0) >= 50 },
    { id: 'logros_75',             n: '75 Logros',                 desc: 'Desbloquea 75 logros',                                     icono: '🏆',  recompY: 150000,  recompXP: 50000,  check: u => (u.logrosDesbloqueados?.length ?? 0) >= 75 },
    { id: 'leyenda_shinjuku',      n: 'Leyenda de Shinjuku',       desc: 'Desbloquea 95 logros',                                     icono: '👑',  recompY: 2000000, recompXP: 1000000,check: u => (u.logrosDesbloqueados?.length ?? 0) >= 95 },
];

// ==========================================
// 🎯 MISIONES INFINITAS
// ==========================================
const MISIONES_POOL: Array<{ tipo: string; desc: string; objetivoBase: number; recompYBase: number; recompXPBase: number }> = [
    { tipo: 'kills',    desc: 'Derrota a {n} hechiceros en combate PvP',        objetivoBase: 1,  recompYBase: 8000,  recompXPBase: 2000 },
    { tipo: 'kills',    desc: 'Elimina a {n} hechiceros usando técnicas',        objetivoBase: 2,  recompYBase: 15000, recompXPBase: 4000 },
    { tipo: 'kills',    desc: 'Limpia Shinjuku: derrota {n} hechiceros',         objetivoBase: 3,  recompYBase: 22000, recompXPBase: 6000 },
    { tipo: 'bossKills',desc: 'Exorciza {n} maldición(es) del barrio',           objetivoBase: 1,  recompYBase: 12000, recompXPBase: 3000 },
    { tipo: 'bossKills',desc: 'Derrota {n} amenaza(s) sobrenaturales',           objetivoBase: 2,  recompYBase: 20000, recompXPBase: 5000 },
    { tipo: 'bossKills',desc: 'El Colegio Jujutsu pide: exorciza {n} amenazas',  objetivoBase: 3,  recompYBase: 32000, recompXPBase: 8000 },
    { tipo: 'tecnicas', desc: 'Usa {n} técnicas de combate',                     objetivoBase: 3,  recompYBase: 5000,  recompXPBase: 1000 },
    { tipo: 'tecnicas', desc: 'Demuestra tu poder: usa {n} técnicas hoy',        objetivoBase: 5,  recompYBase: 8000,  recompXPBase: 2000 },
    { tipo: 'tecnicas', desc: 'Entrena tu Arte: usa {n} técnicas sin parar',     objetivoBase: 10, recompYBase: 14000, recompXPBase: 3500 },
    { tipo: 'trabajar', desc: 'Trabaja {n} veces en Shinjuku',                   objetivoBase: 2,  recompYBase: 6000,  recompXPBase: 1500 },
    { tipo: 'trabajar', desc: 'Completa {n} encargos de trabajo',                objetivoBase: 3,  recompYBase: 10000, recompXPBase: 2500 },
    { tipo: 'meditar',  desc: 'Medita {n} vez(veces) para fortalecer tu EN',     objetivoBase: 1,  recompYBase: 4000,  recompXPBase: 1000 },
    { tipo: 'meditar',  desc: 'Recarga tu energía: medita {n} veces',            objetivoBase: 2,  recompYBase: 7000,  recompXPBase: 1800 },
    { tipo: 'diario',   desc: 'Reclama {n} recompensa(s) diaria(s)',             objetivoBase: 1,  recompYBase: 5000,  recompXPBase: 1200 },
    { tipo: 'robar',    desc: 'Roba exitosamente {n} vez(veces)',                 objetivoBase: 1,  recompYBase: 10000, recompXPBase: 2500 },
    { tipo: 'robar',    desc: 'El mercado negro necesita: roba {n} veces',       objetivoBase: 2,  recompYBase: 18000, recompXPBase: 4500 },
    { tipo: 'recoger',  desc: 'Recoge {n} objeto(s) del callejón',               objetivoBase: 1,  recompYBase: 7000,  recompXPBase: 1800 },
    { tipo: 'recoger',  desc: 'Busca en las sombras: recoge {n} objetos',        objetivoBase: 2,  recompYBase: 12000, recompXPBase: 3000 },
    { tipo: 'vender',   desc: 'Vende {n} objeto(s) de tu inventario',            objetivoBase: 1,  recompYBase: 6000,  recompXPBase: 1500 },
    { tipo: 'vender',   desc: 'Limpia tu inventario: vende {n} objetos',         objetivoBase: 2,  recompYBase: 10000, recompXPBase: 2500 },
];

const generarMision = (misionesCumplidas: number): MisionActiva => {
    const template = MISIONES_POOL[Math.floor(Math.random() * MISIONES_POOL.length)];
    const escala   = 1 + Math.floor(misionesCumplidas / 10) * 0.25;
    const objetivo = Math.max(1, Math.round(template.objetivoBase * escala));
    return {
        tipo:     template.tipo,
        desc:     template.desc.replace('{n}', objetivo.toString()),
        objetivo,
        progreso: 0,
        recompY:  Math.round(template.recompYBase  * escala),
        recompXP: Math.round(template.recompXPBase * escala),
    };
};

const verificarLogros = (u: Usuario): string => {
    if (!u.logrosDesbloqueados) u.logrosDesbloqueados = [];
    const msgs: string[] = [];
    let huboNuevo = true;
    while (huboNuevo) {
        huboNuevo = false;
        for (const logro of LOGROS) {
            if (!u.logrosDesbloqueados.includes(logro.id) && logro.check(u)) {
                u.logrosDesbloqueados.push(logro.id);
                u.y   += logro.recompY;
                u.xp  += logro.recompXP;
                const bonos = (logro.recompY > 0 || logro.recompXP > 0)
                    ? ` *(+$${logro.recompY.toLocaleString()} | +${logro.recompXP.toLocaleString()} XP)*`
                    : '';
                msgs.push(`${logro.icono} **${logro.n}** — ${logro.desc}${bonos}`);
                huboNuevo = true;
            }
        }
    }
    return msgs.join('\n');
};

const actualizarMision = (u: Usuario, tipo: string, cantidad = 1): string | null => {
    if (!u.misionActual || u.misionActual.tipo !== tipo) return null;
    u.misionActual.progreso = Math.min(u.misionActual.objetivo, u.misionActual.progreso + cantidad);
    if (u.misionActual.progreso >= u.misionActual.objetivo) {
        u.y   += u.misionActual.recompY;
        u.xp  += u.misionActual.recompXP;
        u.misionesCumplidas = (u.misionesCumplidas ?? 0) + 1;
        const msg = `🎯 **¡MISIÓN COMPLETADA!** +$${u.misionActual.recompY.toLocaleString()} | +${u.misionActual.recompXP.toLocaleString()} XP`;
        u.misionActual = generarMision(u.misionesCumplidas);
        return `${msg}\n📋 Nueva misión: **${u.misionActual.desc}**`;
    }
    return null;
};

// Helper: verifica si el comando se usa en el canal correcto
const checkCanal = (canalConfig: string | null, msgChannelId: string, nombreCanal: string): string | null => {
    if (!canalConfig) return null; // sin restricción configurada
    if (msgChannelId !== canalConfig) return `❌ Este comando solo puede usarse en <#${canalConfig}> (zona de **${nombreCanal}**).`;
    return null;
};

const usuarioBase = (nombre: string): Usuario => ({
    n: nombre, hp: 200, en: 200, y: 5000, xp: 0, dedos: 0,
    inv: [], lastDom: 0, sellado: null, rolesSellado: [],
    equipado: null, meditarCooldown: 0, trabajarCooldown: 0, pactadoCon: null, tieneBrazo: false,
    cooldowns: {}, kills: 0, bossKills: 0, tecUsadas: 0, ultimoDiario: 0, escudo: 0,
    vecesTrabajado: 0, vecesRobadoExito: 0, vecesDiario: 0, vecesRecogido: 0,
    vecesVendido: 0, vecesMeditado: 0, vecesRecuperado: 0, vecesIntercambio: 0,
    vecesSellado: 0, vecesReroll: 0, misionesCumplidas: 0,
    logrosDesbloqueados: [], misionActual: null,
});

const cargarDatos = (): void => {
    if (fs.existsSync(DB_PATH)) {
        try {
            const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as Record<string, Usuario>;
            db = new Map(Object.entries(raw));
            console.log("✅ Datos cargados correctamente.");
        } catch { console.error("Error leyendo BD."); }
    }
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const rawCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<Config>;
            config = { ...config, ...rawCfg };
        } catch { console.error("Error leyendo Config."); }
    }
};

const guardarDatos = (): void => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(Object.fromEntries(db), null, 4));
    } catch (e) { console.error("❌ Error guardando DB:", e); }
};

const guardarConfig = (): void => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
    } catch (e) { console.error("❌ Error guardando Config:", e); }
};

// ==========================================
// 🆔 IDS DE CLANES Y JERARQUÍA
// ==========================================
const CLANES = {
    GOJO:     { id: "1482426167087595671", emoji: "👁️", n: "Gojo" },
    SUKUNA:   { id: "1482429120469139526", emoji: "💀", n: "Sukuna" },
    ZENIN:    { id: "1482428805586096138", emoji: "⚔️", n: "Zenin" },
    ERRANTE:  { id: "1482429432655380540", emoji: "🌌", n: "Errante" },
    MALDICION:{ id: "1482429681428201552", emoji: "👾", n: "Maldición" },
    KAMO:     { id: "1482428425988866210", emoji: "🩸", n: "Kamo" },
    INUMAKI:  { id: "1482428594792693781", emoji: "🗣️", n: "Inumaki" }
} as const;

const ROL_MIEMBRO         = "1482429543883997347";
const ROL_GOKUMONKYO      = "1482489278562045964";
const ROL_REY_MALDICIONES = "1482429120469139526";

const GRADOS: Grado[] = [
    { n: "Grado 4",        xp: 0,      dmgM: 1.0,  hpBase: 200,   enBase: 200   },
    { n: "Grado 3",        xp: 5000,   dmgM: 2.5,  hpBase: 600,   enBase: 700   },
    { n: "Grado 2",        xp: 20000,  dmgM: 6.0,  hpBase: 1500,  enBase: 1800  },
    { n: "Grado 1",        xp: 60000,  dmgM: 12.0, hpBase: 4000,  enBase: 5000  },
    { n: "Grado Especial", xp: 150000, dmgM: 30.0, hpBase: 12000, enBase: 15000 }
];

const getGrado = (xp: number): Grado =>
    GRADOS.slice().reverse().find(g => xp >= g.xp) ?? GRADOS[0];

// ==========================================
// ⚔️ DICCIONARIO: 120 TÉCNICAS (7 CLANES)
// ==========================================
const TECNICAS: Record<string, Tecnica> = {
    // --- LINAJE GOJO (20) ---
    '!azul':             { n: "Azul (Laplace)",          d: 150,  c: 100,  g: "Grado 3",        clan: CLANES.GOJO.id },
    '!rojo':             { n: "Rojo (Inversión)",         d: 350,  c: 250,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!purpura':          { n: "Púrpura Imaginario",       d: 1200, c: 900,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!vacio':            { n: "Vacío Infinito",           d: 6000, c: 5000, g: "Grado Especial",  clan: CLANES.GOJO.id, dom: true },
    '!infinito':         { n: "Mugen (Barrera)",          d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.GOJO.id, def: true },
    '!seisojos':         { n: "Despertar Seis Ojos",      d: 0,    c: 0,    g: "Grado Especial",  clan: CLANES.GOJO.id, buff: true },
    '!teleport':         { n: "Salto Espacial",           d: 50,   c: 80,   g: "Grado 3",        clan: CLANES.GOJO.id },
    '!rct_gojo':         { n: "Técnica Inversa (RCT)",    d: -400, c: 800,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!vuelo':            { n: "Levitación",               d: 10,   c: 30,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!brillo':           { n: "Brillo Maldito",           d: 80,   c: 50,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!ola_gojo':         { n: "Ola de Energía",           d: 70,   c: 40,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!pulso_gojo':       { n: "Pulso de Mugen",           d: 90,   c: 55,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!destello_gojo':    { n: "Kokusen",                  d: 600,  c: 400,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!laplace_max':      { n: "Azul Máximo",              d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!inversion_max':    { n: "Rojo Máximo",              d: 1000, c: 750,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!purpura_200':      { n: "Púrpura 200%",             d: 3000, c: 2500, g: "Grado Especial",  clan: CLANES.GOJO.id },
    '!barrera_simple':   { n: "Dominio Simple",           d: 0,    c: 150,  g: "Grado 3",        clan: CLANES.GOJO.id, def: true },
    '!caida':            { n: "Caída Libre",              d: 120,  c: 90,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!puño_gojo':        { n: "Puño con Infinito",        d: 300,  c: 150,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!aura_gojo':        { n: "Presencia Abrumadora",     d: 0,    c: 500,  g: "Grado 1",        clan: CLANES.GOJO.id, buff: true },
    '!percepcion':       { n: "Lectura de Alma",          d: 0,    c: 100,  g: "Grado 2",        clan: CLANES.GOJO.id, buff: true },
    '!infinito_exp':     { n: "Expansión de Mugen",       d: 0,    c: 1000, g: "Grado Especial",  clan: CLANES.GOJO.id, buff: true },

    // --- CLAN SUKUNA (20) ---
    '!desmantelar':      { n: "Kai",                      d: 160,  c: 80,   g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!partir':           { n: "Hachi",                    d: 400,  c: 200,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!santuario':        { n: "Santuario Malévolo",       d: 6500, c: 4500, g: "Grado Especial",  clan: CLANES.SUKUNA.id, dom: true },
    '!fuga':             { n: "Abierto: Fuga",            d: 2000, c: 1200, g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!mahoraga':         { n: "Invocación: Mahoraga",     d: 1500, c: 2000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!corte_mundo':      { n: "Corte del Mundo",          d: 9999, c: 8000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!telaraña':         { n: "Escala de Araña",          d: 450,  c: 300,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!boxeo':            { n: "Taijutsu Heian",           d: 200,  c: 50,   g: "Grado 4",        clan: CLANES.SUKUNA.id },
    '!aranazo':          { n: "Zarpazo del Rey",          d: 110,  c: 35,   g: "Grado 4",        clan: CLANES.SUKUNA.id },
    '!mordida_sukuna':   { n: "Mordida Maldita",          d: 80,   c: 25,   g: "Grado 4",        clan: CLANES.SUKUNA.id },
    '!presion_rey':      { n: "Presión Primordial",       d: 130,  c: 45,   g: "Grado 4",        clan: CLANES.SUKUNA.id },
    '!instinto_rey':     { n: "Instinto del Rey",         d: 0,    c: 50,   g: "Grado 4",        clan: CLANES.SUKUNA.id, def: true },
    '!nue':              { n: "Nue (Quimera)",            d: 350,  c: 250,  g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!agito':            { n: "Bestia Agito",             d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!rct_sukuna':       { n: "Regeneración del Rey",     d: -500, c: 1000, g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!cleave_max':       { n: "Hachi Concentrado",        d: 900,  c: 500,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!escision':         { n: "Escisión",                 d: 250,  c: 150,  g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!flecha_fuego':     { n: "Lluvia de Fuego",          d: 1100, c: 800,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!corte_invisible':  { n: "Tajo Indetectable",        d: 600,  c: 400,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!adaptacion':       { n: "Giro de Rueda",            d: 0,    c: 1500, g: "Grado Especial",  clan: CLANES.SUKUNA.id, def: true },
    '!aura_rey':         { n: "Sed de Sangre",            d: 100,  c: 300,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!intimidacion':     { n: "Miedo Primordial",         d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.SUKUNA.id, buff: true },
    '!tajo_divino':      { n: "Corte a los Dioses",       d: 4000, c: 3000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!regen_absoluta':   { n: "Restauración de Alma",     d: -2000,c: 4000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },

    // --- FAMILIA ZENIN (20) ---
    '!proyeccion':       { n: "Proyección 24 FPS",        d: 300,  c: 180,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!sombras_10':       { n: "Diez Sombras",             d: 450,  c: 350,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!toji_slash':       { n: "Tajo Físico",              d: 350,  c: 20,   g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!dominio_simple':   { n: "Dominio Simple",           d: 0,    c: 150,  g: "Grado 3",        clan: CLANES.ZENIN.id, def: true },
    '!sapo':             { n: "Invocación: Sapo",         d: 150,  c: 100,  g: "Grado 4",        clan: CLANES.ZENIN.id },
    '!lobo':             { n: "Perro Divino",             d: 250,  c: 150,  g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!nue_zenin':        { n: "Nue",                      d: 280,  c: 200,  g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!serpiente':        { n: "Gran Serpiente",           d: 400,  c: 250,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!elefante':         { n: "Elefante Máximo",          d: 600,  c: 400,  g: "Grado 1",        clan: CLANES.ZENIN.id },
    '!conejo':           { n: "Escape de Conejos",        d: 50,   c: 100,  g: "Grado 4",        clan: CLANES.ZENIN.id, def: true },
    '!mahoraga_zenin':   { n: "General Divino",           d: 1500, c: 2000, g: "Grado Especial",  clan: CLANES.ZENIN.id },
    '!espada_zenin':     { n: "Katana Maldita",           d: 200,  c: 50,   g: "Grado 4",        clan: CLANES.ZENIN.id },
    '!nube':             { n: "Nube Itinerante",          d: 800,  c: 30,   g: "Grado 1",        clan: CLANES.ZENIN.id },
    '!lanza':            { n: "Lanza del Cielo",          d: 1200, c: 40,   g: "Grado Especial",  clan: CLANES.ZENIN.id },
    '!cadena':           { n: "Cadena de Mil Millas",     d: 500,  c: 20,   g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!percepcion_toji':  { n: "Sentidos Agudizados",      d: 0,    c: 0,    g: "Grado Especial",  clan: CLANES.ZENIN.id, buff: true },
    '!corte_rapido':     { n: "Iaijutsu",                 d: 350,  c: 100,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!barrera_zenin':    { n: "Arte Secreto",             d: 0,    c: 300,  g: "Grado 1",        clan: CLANES.ZENIN.id, def: true },
    '!taijutsu_zenin':   { n: "Artes Marciales",          d: 180,  c: 15,   g: "Grado 4",        clan: CLANES.ZENIN.id },
    '!destello_zenin':   { n: "Impacto Crítico",          d: 700,  c: 200,  g: "Grado 1",        clan: CLANES.ZENIN.id },

    // --- MALDICIONES DESASTROSAS (20) ---
    '!metamorfosis':     { n: "Mutación Inactiva",        d: 600,  c: 400,  g: "Grado 2",        clan: CLANES.MALDICION.id },
    '!desastre_fuego':   { n: "Llama de Jogo",            d: 400,  c: 250,  g: "Grado 3",        clan: CLANES.MALDICION.id },
    '!clon_mahito':      { n: "Clon de Alma",             d: 200,  c: 150,  g: "Grado 3",        clan: CLANES.MALDICION.id },
    '!enjambre':         { n: "Muerte Enjambrada",        d: 900,  c: 700,  g: "Grado 1",        clan: CLANES.MALDICION.id },
    '!raices':           { n: "Raíces de Hanami",         d: 350,  c: 200,  g: "Grado 3",        clan: CLANES.MALDICION.id },
    '!flor_sangre':      { n: "Campo de Flores",          d: 100,  c: 300,  g: "Grado 2",        clan: CLANES.MALDICION.id, def: true },
    '!magma':            { n: "Roca Volcánica",           d: 700,  c: 500,  g: "Grado 1",        clan: CLANES.MALDICION.id },
    '!meteorito':        { n: "Meteorito Máximo",         d: 2500, c: 2000, g: "Grado Especial",  clan: CLANES.MALDICION.id },
    '!ataud':            { n: "Ataúd de la Montaña",      d: 5000, c: 4000, g: "Grado Especial",  clan: CLANES.MALDICION.id, dom: true },
    '!autoencarnacion':  { n: "Perfección de Alma",       d: 5500, c: 4500, g: "Grado Especial",  clan: CLANES.MALDICION.id, dom: true },
    '!dominio_hanami':   { n: "Mar de Luz",               d: 4800, c: 3800, g: "Grado Especial",  clan: CLANES.MALDICION.id, dom: true },
    '!dominio_dagon':    { n: "Horizonte Cautivador",     d: 4900, c: 3900, g: "Grado Especial",  clan: CLANES.MALDICION.id, dom: true },
    '!agua_maldita':     { n: "Torrente Oscuro",          d: 300,  c: 200,  g: "Grado 3",        clan: CLANES.MALDICION.id },
    '!tiburon':          { n: "Tiburón de Dagon",         d: 500,  c: 350,  g: "Grado 2",        clan: CLANES.MALDICION.id },
    '!toque_alma':       { n: "Deformación",              d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.MALDICION.id },
    '!espina':           { n: "Madera Maldita",           d: 150,  c: 100,  g: "Grado 4",        clan: CLANES.MALDICION.id },
    '!zarpa_maldita':    { n: "Zarpa Maldita",            d: 100,  c: 55,   g: "Grado 4",        clan: CLANES.MALDICION.id },
    '!veneno_maldito':   { n: "Aliento Tóxico",           d: 80,   c: 45,   g: "Grado 4",        clan: CLANES.MALDICION.id },
    '!grito_maldicion':  { n: "Aullido de Maldición",    d: 120,  c: 65,   g: "Grado 4",        clan: CLANES.MALDICION.id },
    '!emanacion':        { n: "Emanación Oscura",         d: 0,    c: 35,   g: "Grado 4",        clan: CLANES.MALDICION.id, buff: true },
    '!armadura':         { n: "Corteza de Hanami",        d: 0,    c: 400,  g: "Grado 2",        clan: CLANES.MALDICION.id, def: true },
    '!regen_maldita':    { n: "Curación de Maldición",    d: -400, c: 300,  g: "Grado 2",        clan: CLANES.MALDICION.id },
    '!aura_desastre':    { n: "Miedo Humano",             d: 250,  c: 250,  g: "Grado 3",        clan: CLANES.MALDICION.id },
    '!explosion':        { n: "Detonación de Jogo",       d: 1200, c: 900,  g: "Grado 1",        clan: CLANES.MALDICION.id },

    // --- HECHICEROS ERRANTES (20) ---
    '!kokusen_errante':      { n: "Destello Negro",       d: 700,  c: 450,  g: "Grado 1",        clan: CLANES.ERRANTE.id },
    '!simple_errante':       { n: "Dominio Simple",       d: 0,    c: 150,  g: "Grado 3",        clan: CLANES.ERRANTE.id, def: true },
    '!rct_basico':           { n: "Curación Menor",       d: -200, c: 500,  g: "Grado 2",        clan: CLANES.ERRANTE.id },
    '!corte_espada':         { n: "Tajo Imbuido",         d: 200,  c: 100,  g: "Grado 3",        clan: CLANES.ERRANTE.id },
    '!golpe_maldito':        { n: "Puñetazo Básico",      d: 100,  c: 50,   g: "Grado 4",        clan: CLANES.ERRANTE.id },
    '!barrera_errante':      { n: "Escudo de Energía",    d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.ERRANTE.id, def: true },
    '!talisman':             { n: "Sello Explosivo",      d: 300,  c: 200,  g: "Grado 3",        clan: CLANES.ERRANTE.id },
    '!invocacion':           { n: "Shikigami Menor",      d: 150,  c: 120,  g: "Grado 4",        clan: CLANES.ERRANTE.id },
    '!divergente':           { n: "Puño Divergente",      d: 400,  c: 300,  g: "Grado 2",        clan: CLANES.ERRANTE.id },
    '!aura_errante':         { n: "Flujo Constante",      d: 0,    c: 400,  g: "Grado 2",        clan: CLANES.ERRANTE.id, buff: true },
    '!patada':               { n: "Patada Imbuida",       d: 180,  c: 90,   g: "Grado 4",        clan: CLANES.ERRANTE.id },
    '!bloqueo':              { n: "Guardia",              d: 0,    c: 100,  g: "Grado 4",        clan: CLANES.ERRANTE.id, def: true },
    '!esquive':              { n: "Paso Rápido",          d: 0,    c: 80,   g: "Grado 4",        clan: CLANES.ERRANTE.id, def: true },
    '!concentracion':        { n: "Foco Total",           d: 0,    c: 500,  g: "Grado 1",        clan: CLANES.ERRANTE.id, buff: true },
    '!disparo':              { n: "Bala de Energía",      d: 250,  c: 180,  g: "Grado 3",        clan: CLANES.ERRANTE.id },
    '!rafaga':               { n: "Golpes Consecutivos",  d: 500,  c: 400,  g: "Grado 2",        clan: CLANES.ERRANTE.id },
    '!golpe_doble':          { n: "Impacto Dual",         d: 350,  c: 250,  g: "Grado 2",        clan: CLANES.ERRANTE.id },
    '!sacrificio':           { n: "Voto Vinculante",      d: 2000, c: 1500, g: "Grado Especial",  clan: CLANES.ERRANTE.id },
    '!cañon':                { n: "Cañón Maldito",        d: 1500, c: 1200, g: "Grado 1",        clan: CLANES.ERRANTE.id },
    '!expansion_incompleta': { n: "Dominio Incompleto",   d: 3000, c: 2500, g: "Grado Especial",  clan: CLANES.ERRANTE.id, dom: true },

    // --- CLAN KAMO (10) ---
    '!gota_sangre':      { n: "Gota de Sangre",           d: 80,   c: 50,   g: "Grado 4",        clan: CLANES.KAMO.id },
    '!marca_carmesi':    { n: "Marca Carmesí",            d: 0,    c: 55,   g: "Grado 4",        clan: CLANES.KAMO.id, buff: true },
    '!pulso_sangre':     { n: "Pulso de Sangre",          d: 100,  c: 65,   g: "Grado 4",        clan: CLANES.KAMO.id },
    '!escudo_kamo':      { n: "Escudo de Sangre Básico",  d: 0,    c: 75,   g: "Grado 4",        clan: CLANES.KAMO.id, def: true },
    '!rociado':          { n: "Rociado Carmesí",          d: 120,  c: 80,   g: "Grado 4",        clan: CLANES.KAMO.id },
    '!sangre_bala':      { n: "Lluvia de Sangre",         d: 280,  c: 180,  g: "Grado 3",        clan: CLANES.KAMO.id },
    '!sangre_lanza':     { n: "Lanza de Sangre",          d: 450,  c: 300,  g: "Grado 2",        clan: CLANES.KAMO.id },
    '!coagulacion':      { n: "Coagulación",              d: 200,  c: 150,  g: "Grado 3",        clan: CLANES.KAMO.id },
    '!escudo_sangre':    { n: "Escudo Carmesí",           d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.KAMO.id, def: true },
    '!armadura_sangre':  { n: "Armadura de Sangre",       d: 0,    c: 350,  g: "Grado 2",        clan: CLANES.KAMO.id, def: true },
    '!transfusion':      { n: "Transfusión Maldita",      d: -350, c: 600,  g: "Grado 2",        clan: CLANES.KAMO.id },
    '!torrente_sangre':  { n: "Torrente Carmesí",         d: 700,  c: 500,  g: "Grado 1",        clan: CLANES.KAMO.id },
    '!explosion_sangre': { n: "Detonación de Sangre",     d: 1100, c: 800,  g: "Grado 1",        clan: CLANES.KAMO.id },
    '!meteoro_sangre':   { n: "Meteoro Carmesí",          d: 2500, c: 2000, g: "Grado Especial",  clan: CLANES.KAMO.id },
    '!dominio_kamo':     { n: "Campo Carmesí Eterno",     d: 5500, c: 4500, g: "Grado Especial",  clan: CLANES.KAMO.id, dom: true },

    // --- HEREDERO INUMAKI (10) ---
    '!resonar':          { n: "Resonancia Maldita",       d: 200,  c: 120,  g: "Grado 4",        clan: CLANES.INUMAKI.id },
    '!susurro':          { n: "Susurro Maldito",          d: 60,   c: 70,   g: "Grado 4",        clan: CLANES.INUMAKI.id },
    '!eco_voz':          { n: "Eco de Voz",               d: 80,   c: 85,   g: "Grado 4",        clan: CLANES.INUMAKI.id },
    '!chillido':         { n: "Chillido Maldito",         d: 110,  c: 95,   g: "Grado 4",        clan: CLANES.INUMAKI.id },
    '!murmuro':          { n: "Murmullo del Alma",        d: 0,    c: 65,   g: "Grado 4",        clan: CLANES.INUMAKI.id, buff: true },
    '!detente':          { n: "¡Alto!",                   d: 0,    c: 180,  g: "Grado 3",        clan: CLANES.INUMAKI.id, def: true },
    '!dormir':           { n: "¡Duerme!",                 d: 100,  c: 200,  g: "Grado 3",        clan: CLANES.INUMAKI.id },
    '!explotar_voz':     { n: "¡Explota!",                d: 600,  c: 400,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!encogete':         { n: "¡Encógete!",               d: 400,  c: 300,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!aplastado':        { n: "¡Aplástate!",              d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.INUMAKI.id },
    '!voz_maldita':      { n: "Onda de Voz Maldita",      d: 350,  c: 250,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!grito_inumaki':    { n: "Grito Inumaki",            d: 1300, c: 1000, g: "Grado 1",        clan: CLANES.INUMAKI.id },
    '!morir':            { n: "¡Muere!",                  d: 4500, c: 3500, g: "Grado Especial",  clan: CLANES.INUMAKI.id },
    '!dominio_inumaki':  { n: "Eco del Alma",             d: 5200, c: 4200, g: "Grado Especial",  clan: CLANES.INUMAKI.id, dom: true }
};

// ==========================================
// 🔤 NORMALIZACIÓN DE ACENTOS PARA COMANDOS
// ==========================================
const quitarAcentos = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TECNICAS_NORM = new Map<string, Tecnica>();
for (const [key, val] of Object.entries(TECNICAS)) {
    TECNICAS_NORM.set(quitarAcentos(key.slice(1)), val);
}

// ==========================================
// ⏱️ COOLDOWNS POR NIVEL DE DAÑO
// ==========================================
const getCooldownMs = (tech: Tecnica): number => {
    const d = tech.d;
    if (d <= 0)    return 20_000;                   // buff/def/heal:  20s
    if (d < 50)    return 30_000;                   // golpe mínimo:   30s
    if (d < 150)   return 5  * 60_000;              // débil:          5min
    if (d < 300)   return 20 * 60_000;              // ligero (azul):  20min
    if (d < 600)   return 60 * 60_000;              // medio (rojo):   1h
    if (d < 1500)  return 2  * 60 * 60_000;         // fuerte:         2h
    if (d < 3000)  return 6  * 60 * 60_000;         // muy fuerte (púrpura): 6h
    if (d < 5500)  return 12 * 60 * 60_000;         // dominio/ultra:  12h
    return 24 * 60 * 60_000;                        // dios (vacío):   24h
};

const formatCooldown = (ms: number): string => {
    if (ms < 60_000)       return `${Math.ceil(ms / 1000)} segundo(s)`;
    if (ms < 3_600_000)    return `${Math.ceil(ms / 60_000)} minuto(s)`;
    if (ms < 86_400_000)   return `${(ms / 3_600_000).toFixed(1)} hora(s)`;
    return `${Math.ceil(ms / 86_400_000)} día(s)`;
};

// ==========================================
// 🛒 TIENDA Y ARTÍCULOS
// ==========================================
const TIENDA: Record<string, ItemTienda> = {
    'dedo':                { n: "Dedo de Sukuna",          precio: 100000, desc: "+500 EN y +10% Daño permanentemente." },
    'gokumonkyo_pequeño':  { n: "Gokumonkyō (Pequeño)",   precio: 50000,  desc: "Sella a un usuario por 10 minutos.",  duracion: 10 * 60 * 1000 },
    'gokumonkyo_estandar': { n: "Gokumonkyō (Estándar)",  precio: 120000, desc: "Sella a un usuario por 30 minutos.", duracion: 30 * 60 * 1000 },
    'gokumonkyo_eterno':   { n: "Gokumonkyō (Eterno)",    precio: 250000, desc: "Sella a un usuario por 1 hora.",     duracion: 60 * 60 * 1000 },
    'gafas_maki':          { n: "Gafas de Maki",           precio: 80000,  desc: "Atacar sin clan. +20% daño a Bosses." },
    'nube_itinerante':     { n: "Nube Itinerante",          precio: 200000, desc: "+50% daño general (+75% contra Zenin)." },
    'lanza_invertida':     { n: "Lanza Invertida",          precio: 150000, desc: "El daño ignora la defensa del enemigo." },
    'brazo_de_sukuna':     { n: "Brazo de Sukuna",          precio: 750000, desc: "Daño x3 y regeneración de Energía Maldita x2." }
};

// ==========================================
// 🎒 EQUIPAMIENTO Y EFECTOS
// ==========================================
const EQUIPAMIENTO: Record<string, ItemEquipamiento> = {
    'Gafas de Maki':   { desc: "Atacar sin clan. +20% daño a Bosses.",        sinClan: true,  dmgBossBonus: 1.20 },
    'Nube Itinerante': { desc: "+50% daño general (+75% contra Zenin).",       dmgBonus: 1.50, dmgZeninBonus: 1.75 },
    'Lanza Invertida': { desc: "El daño ignora la defensa del enemigo.",       ignoraDef: true },
    'Brazo de Sukuna': { desc: "Regeneración de Energía Maldita x2/minuto.",  regenX2: true }
};

// ==========================================
// 👾 SPAWN DE BOSSES
// ==========================================
const SPAWNS: SpawnConfig[] = [
    { n: "Maldición de Grado 4",         hp: 300,   y: 2000,    xp: 200,    prob: 0.10  },
    { n: "Maldición de Grado 1",         hp: 5000,  y: 30000,   xp: 4000,   prob: 0.04  },
    { n: "BOSS: Toji Fushiguro",         hp: 20000, y: 200000,  xp: 25000,  prob: 0.01  },
    { n: "BOSS: Rey de las Maldiciones", hp: 80000, y: 1000000, xp: 100000, prob: 0.002 }
];

const spawnBossAleatorio = (): SpawnConfig => {
    const total = SPAWNS.reduce((acc, s) => acc + s.prob, 0);
    let r = Math.random() * total;
    for (const s of SPAWNS) {
        r -= s.prob;
        if (r <= 0) return s;
    }
    return SPAWNS[0];
};

// ==========================================
// 🎁 ITEMS DEL CALLEJÓN
// ==========================================
const ITEMS_CALLEJON = {
    comun:    ["Katana Maldita", "Sello Explosivo", "Poción de Energía"],
    raro:     ["Gafas de Maki", "Nube Itinerante", "Lanza Invertida"],
    especial: ["Gokumonkyō (Pequeño)", "Gokumonkyō (Estándar)", "Gokumonkyō (Eterno)", "Brazo de Sukuna"]
};

const spawnItemCallejon = (): string => {
    const r = Math.random();
    let lista: string[];
    if (r < 0.60) lista = ITEMS_CALLEJON.comun;
    else if (r < 0.90) lista = ITEMS_CALLEJON.raro;
    else lista = ITEMS_CALLEJON.especial;
    return lista[Math.floor(Math.random() * lista.length)];
};

// ==========================================
// 🔒 SERVIDOR AUTORIZADO
// ==========================================
const GUILD_AUTORIZADO = "1482421330694377685";

// ==========================================
// 🤖 CLIENTE DISCORD
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// ⚙️ MOTOR DE EVENTOS
// ==========================================
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (!msg.member || !msg.guild) return;
    if (msg.guild.id !== GUILD_AUTORIZADO) return;

    const uid = msg.author.id;
    if (!db.has(uid)) db.set(uid, usuarioBase(msg.author.username));
    const u = db.get(uid)!;
    const gU = getGrado(u.xp);

    // --- 👁️ SEIS OJOS ---
    let costoMultiplicador = 1.0;
    if (msg.member.roles.cache.has(CLANES.GOJO.id) && gU.n === "Grado Especial") {
        costoMultiplicador = 0.01;
    }

    if (!msg.content.startsWith('!')) return;
    const args = msg.content.slice(1).trim().split(/ +/);
    const cmd = args.shift()!.toLowerCase();

    // ==========================================
    // 📋 PERFIL
    // ==========================================
    if (cmd === 'perfil') {
        const errCanal = checkCanal(config.setupPerfil, msg.channel.id, 'Perfil');
        if (errCanal) return void msg.reply(errCanal);
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Hechicero: ${u.n}`, iconURL: msg.author.displayAvatarURL() })
            .addFields(
                { name: '🎖️ Grado',    value: gU.n,                                                    inline: true },
                { name: '💴 Yenes',    value: `$${u.y.toLocaleString()}`,                              inline: true },
                { name: '✨ XP',       value: `${u.xp.toLocaleString()}`,                              inline: true },
                { name: '❤️ HP',       value: `${Math.floor(u.hp)}/${gU.hpBase + (u.dedos * 100)}`,   inline: true },
                { name: '⚡ Energía',  value: `${Math.floor(u.en)}/${gU.enBase + (u.dedos * 500)}`,   inline: true },
                { name: '☝️ Dedos',    value: `${u.dedos}/20`,                                         inline: true },
                { name: '🎒 Equipado', value: u.equipado ?? 'Ninguno',                                 inline: true },
                { name: '⛓️ Estado',   value: (u.sellado && Date.now() < u.sellado) ? '🔒 Sellado' : '✅ Libre', inline: true }
            )
            .setColor(gU.n === "Grado Especial" ? 0xFFD700 : 0xFFFFFF);
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🎒 INVENTARIO
    // ==========================================
    if (cmd === 'inventario') {
        const errCanal = checkCanal(config.setupPerfil, msg.channel.id, 'Perfil');
        if (errCanal) return void msg.reply(errCanal);
        const inv = u.inv.length > 0 ? u.inv.map((i, idx) => `**${idx + 1}.** ${i}`).join('\n') : '_Inventario vacío_';
        const embed = new EmbedBuilder()
            .setTitle(`🎒 Inventario de ${u.n}`)
            .setDescription(inv)
            .addFields({ name: '🎒 Equipado ahora', value: u.equipado ?? 'Ninguno', inline: true })
            .setColor(0x2C2F33);
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🏆 RANKINGS
    // ==========================================
    if (cmd === 'ranking') {
        const errCanal = checkCanal(config.setupPerfil, msg.channel.id, 'Perfil');
        if (errCanal) return void msg.reply(errCanal);
        const tipo = args[0]?.toLowerCase() ?? 'xp';
        const jugadores = Array.from(db.entries());
        type RankTipo = 'xp' | 'yenes' | 'dedos' | 'hp' | 'kills';

        const configs: Record<RankTipo, { label: string; color: number; fn: (u: Usuario) => number; fmt: (v: number) => string }> = {
            xp:     { label: '✨ Top 10 — Experiencia',  color: 0xFFD700, fn: u => u.xp,           fmt: v => `${v.toLocaleString()} XP` },
            yenes:  { label: '💴 Top 10 — Yenes',        color: 0x00FF88, fn: u => u.y,            fmt: v => `$${v.toLocaleString()}` },
            dedos:  { label: '☝️ Top 10 — Dedos',        color: 0x8B0000, fn: u => u.dedos,        fmt: v => `${v}/20` },
            hp:     { label: '❤️ Top 10 — HP Actual',    color: 0xFF4444, fn: u => u.hp,           fmt: v => `${Math.floor(v)} HP` },
            kills:  { label: '⚔️ Top 10 — Kills PvP',   color: 0xFF0000, fn: u => u.kills ?? 0,   fmt: v => `${v} kills` }
        };

        const cfg = configs[tipo as RankTipo];
        if (!cfg) return void msg.reply("❌ Tipos válidos: `xp`, `yenes`, `dedos`, `hp`, `kills`.\nEjemplo: `!ranking kills`");

        const top10 = jugadores
            .sort((a, b) => cfg.fn(b[1]) - cfg.fn(a[1]))
            .slice(0, 10);

        const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const desc = top10.map(([, u], i) =>
            `${medallas[i]} **${u.n}** — ${cfg.fmt(cfg.fn(u))}`
        ).join('\n') || '_Sin datos aún_';

        const embed = new EmbedBuilder()
            .setTitle(cfg.label)
            .setDescription(desc)
            .setColor(cfg.color)
            .setFooter({ text: 'Usa !ranking xp | yenes | dedos | hp | kills' });
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🛒 TIENDA
    // ==========================================
    if (cmd === 'tienda') {
        const errCanal = checkCanal(config.setupTienda, msg.channel.id, 'Tienda');
        if (errCanal) return void msg.reply(errCanal);
        const embed = new EmbedBuilder()
            .setTitle("🛒 TIENDA DEL MERCADO MALDITO")
            .setDescription("Usa `!comer_dedo` para Dedos de Sukuna.\nUsa `!comprar [item]` para el resto.\nEjemplo: `!comprar gafas maki`")
            .addFields(
                { name: "☝️ Dedo de Sukuna — $100,000",         value: "```+500 EN y +10% Daño permanente```",       inline: false },
                { name: "⛓️ Gokumonkyō (Pequeño) — $50,000",    value: "```Sella usuario 10 minutos```",             inline: false },
                { name: "⛓️ Gokumonkyō (Estándar) — $120,000",  value: "```Sella usuario 30 minutos```",            inline: false },
                { name: "⛓️ Gokumonkyō (Eterno) — $250,000",    value: "```Sella usuario 1 hora```",                inline: false },
                { name: "👓 Gafas de Maki — $80,000",            value: "```Atacar sin clan. +20% daño Bosses```",   inline: false },
                { name: "☁️ Nube Itinerante — $200,000",         value: "```+50% daño (+75% vs Zenin)```",           inline: false },
                { name: "🗡️ Lanza Invertida — $150,000",         value: "```El daño ignora la defensa```",           inline: false },
                { name: "💪 Brazo de Sukuna — $750,000",         value: "```Daño x3 y regen EN x2```",              inline: false },
                { name: "🎲 Reroll de Clan — $150,000",          value: "```!comprar_reroll para cambiar clan```",   inline: false }
            )
            .setColor(0x2C2F33)
            .setFooter({ text: `Tu saldo: $${u.y.toLocaleString()} Yenes` });
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🛍️ COMPRAR ITEM
    // ==========================================
    if (cmd === 'comprar') {
        const errCanal = checkCanal(config.setupTienda, msg.channel.id, 'Tienda');
        if (errCanal) return void msg.reply(errCanal);
        const itemKey = args.join('_').toLowerCase();
        const item = TIENDA[itemKey];
        if (!item) return void msg.reply("❌ Item no encontrado. Usa `!tienda` para ver los disponibles.");
        if (itemKey === 'dedo') return void msg.reply("☝️ Para comprar dedos usa `!comer_dedo`.");
        if (itemKey === 'brazo_de_sukuna' && u.tieneBrazo) return void msg.reply("❌ Ya posees el Brazo de Sukuna.");
        if (u.y < item.precio) return void msg.reply(`❌ Necesitas **$${item.precio.toLocaleString()} Yenes**. Tienes $${u.y.toLocaleString()}.`);
        u.y -= item.precio;
        u.inv.push(item.n);
        if (itemKey === 'brazo_de_sukuna') u.tieneBrazo = true;
        const logComprar = verificarLogros(u);
        guardarDatos();
        let resComprar = `✅ Compraste **${item.n}**. Añadido a tu inventario.\n💴 Saldo: $${u.y.toLocaleString()}`;
        if (logComprar) resComprar += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logComprar}`;
        return void msg.reply(resComprar);
    }

    // ==========================================
    // ⛓️ USAR SELLO (Gokumonkyō)
    // ==========================================
    if (cmd === 'usar_sello') {
        const variante = quitarAcentos(args[0] ?? '');
        const variantesMap: Record<string, string> = {
            'pequeno':  'gokumonkyo_pequeño',
            'estandar': 'gokumonkyo_estandar',
            'eterno':   'gokumonkyo_eterno'
        };
        const itemKey = variantesMap[variante];
        if (!itemKey) return void msg.reply("❌ Variantes: `pequeño`, `estandar`, `eterno`.");

        const item = TIENDA[itemKey];
        if (!u.inv.includes(item.n)) return void msg.reply(`❌ No tienes **${item.n}** en tu inventario.`);

        const target = msg.mentions.members?.first();
        if (!target) return void msg.reply("🎯 Menciona al usuario que deseas sellar.");
        if (target.id === uid) return void msg.reply("❌ No puedes sellarte a ti mismo.");

        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.user.username));
        const vU = db.get(target.id)!;

        if (vU.sellado && Date.now() < vU.sellado) return void msg.reply("⚠️ Ese usuario ya está sellado.");

        const rolesSalvados: string[] = [];
        if (target.roles.cache.has(ROL_MIEMBRO)) rolesSalvados.push(ROL_MIEMBRO);
        Object.values(CLANES).forEach(c => {
            if (target.roles.cache.has(c.id)) rolesSalvados.push(c.id);
        });

        try {
            const rolesAQuitar = [ROL_MIEMBRO, ...Object.values(CLANES).map(c => c.id)]
                .filter(r => target.roles.cache.has(r));
            if (rolesAQuitar.length > 0) await target.roles.remove(rolesAQuitar);
            await target.roles.add(ROL_GOKUMONKYO);
        } catch {
            return void msg.reply("❌ No tengo permisos para gestionar roles.");
        }

        vU.sellado = Date.now() + (item.duracion ?? 0);
        vU.rolesSellado = rolesSalvados;
        db.set(target.id, vU);
        const idxItemSello = u.inv.indexOf(item.n);
        if (idxItemSello !== -1) u.inv.splice(idxItemSello, 1);
        u.vecesSellado = (u.vecesSellado ?? 0) + 1;
        verificarLogros(u);
        guardarDatos();
        agregarHistorial(`⛓️ **${u.n}** selló a **${target.user.username}**`);

        const durTexto = variante === 'pequeno' ? '10 minutos' : variante === 'estandar' ? '30 minutos' : '1 hora';
        void msg.channel.send({ embeds: [
            new EmbedBuilder()
                .setTitle("⛓️ REINO DE PRISIÓN ACTIVADO")
                .setDescription(`**${target.user.username}** ha sido sellado.\n⏳ Duración: **${durTexto}**\nSus poderes han sido suspendidos.`)
                .setColor(0x4B0082)
        ]});

        const targetId = target.id;
        const targetName = target.user.username;
        setTimeout(async () => {
            try {
                const guild = client.guilds.cache.first();
                if (!guild) return;
                const miembroActual = await guild.members.fetch(targetId).catch(() => null);
                const datosActuales = db.get(targetId);
                if (!miembroActual || !datosActuales) return;
                if (miembroActual.roles.cache.has(ROL_GOKUMONKYO)) await miembroActual.roles.remove(ROL_GOKUMONKYO);
                if (datosActuales.rolesSellado.length > 0) await miembroActual.roles.add(datosActuales.rolesSellado);
                datosActuales.sellado = null;
                datosActuales.rolesSellado = [];
                db.set(targetId, datosActuales);
                guardarDatos();
                void msg.channel.send(`🔓 El sello sobre **${targetName}** ha expirado. Sus poderes han sido restaurados.`);
            } catch (e) { console.error("Error restaurando roles:", e); }
        }, item.duracion ?? 0);
        return;
    }

    // ==========================================
    // 🎒 EQUIPAR
    // ==========================================
    if (cmd === 'equipar') {
        const nombreItem = args.join(' ');
        if (!u.inv.includes(nombreItem)) return void msg.reply(`❌ No tienes **${nombreItem}** en tu inventario.`);
        if (!EQUIPAMIENTO[nombreItem]) return void msg.reply("❌ Ese objeto no es equipable.");
        u.equipado = nombreItem;
        guardarDatos();
        return void msg.reply(`✅ Has equipado **${nombreItem}**.\n📋 Efecto: ${EQUIPAMIENTO[nombreItem].desc}`);
    }

    // ==========================================
    // 🛒 RECOGER ITEM DEL CALLEJÓN
    // ==========================================
    if (cmd === 'recoger') {
        if (!config.itemCallejonActual) return void msg.reply("🕳️ No hay ningún objeto en el callejón ahora mismo.");
        if (Date.now() > (config.itemCallejonExpira ?? 0)) {
            config.itemCallejonActual = null;
            config.itemCallejonExpira = null;
            guardarConfig();
            return void msg.reply("⌛ El objeto ya expiró. Espera el próximo spawn.");
        }
        const itemRecogido = config.itemCallejonActual;
        u.inv.push(itemRecogido);
        if (itemRecogido === "Brazo de Sukuna") u.tieneBrazo = true;
        config.itemCallejonActual = null;
        config.itemCallejonExpira = null;
        guardarConfig();
        u.vecesRecogido = (u.vecesRecogido ?? 0) + 1;
        const misionRec = actualizarMision(u, 'recoger');
        const logRec    = verificarLogros(u);
        guardarDatos();
        let resRec = `🎁 ¡Recogiste **${itemRecogido}**! Añadido a tu inventario.`;
        if (misionRec) resRec += `\n\n${misionRec}`;
        if (logRec)    resRec += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logRec}`;
        return void msg.reply(resRec);
    }

    // ==========================================
    // ⚔️ EXORCIZAR BOSS ACTIVO
    // ==========================================
    if (cmd === 'exorcizar') {
        const errCanal = checkCanal(config.setupCombate, msg.channel.id, 'Combate');
        if (errCanal) return void msg.reply(errCanal);
        const boss = bossesActivos.get(msg.channel.id);
        if (!boss) return void msg.reply("🕊️ No hay ninguna maldición activa en este canal.");

        if (u.sellado && Date.now() < u.sellado) {
            return void msg.reply("⛓️ Estás sellado. No puedes exorcizar.");
        }

        const maxHpAtacante = gU.hpBase + (u.dedos * 100);
        if (u.hp <= 0) {
            u.hp = Math.ceil(maxHpAtacante * 0.10);
            guardarDatos();
            return void msg.reply("💀 Estás inconsciente. Tu HP ha sido restaurado al 10%. Espera para recuperarte.");
        }

        const costExorcizar = 30;
        if (u.en < costExorcizar) return void msg.reply("🪫 Sin Energía Maldita para exorcizar.");

        const equip = u.equipado ? EQUIPAMIENTO[u.equipado] : null;
        let dano = Math.ceil(100 * gU.dmgM * (1 + u.dedos * 0.10));

        if (equip?.dmgBossBonus) dano = Math.ceil(dano * equip.dmgBossBonus);
        if (u.equipado === 'Brazo de Sukuna') dano *= 3;

        u.en -= costExorcizar;
        boss.hpActual -= dano;

        if (boss.hpActual <= 0) {
            bossesActivos.delete(msg.channel.id);
            u.y += boss.s.y;
            u.xp += boss.s.xp;
            u.bossKills = (u.bossKills ?? 0) + 1;
            agregarHistorial(`👾 **${u.n}** exorcizó a **${boss.s.n}**`);
            const misionBoss = actualizarMision(u, 'bossKills');
            const logBoss    = verificarLogros(u);
            guardarDatos();

            if (u.dedos >= 20) {
                try { await msg.member.roles.add(ROL_REY_MALDICIONES); } catch { }
            }

            const embed = new EmbedBuilder()
                .setTitle("💀 ¡MALDICIÓN EXORCIZADA!")
                .setDescription(
                    `**${u.n}** eliminó a **${boss.s.n}**.\n` +
                    `💥 Golpe final: **${dano.toLocaleString()}**\n` +
                    `💴 Recompensa: **$${boss.s.y.toLocaleString()}**\n` +
                    `✨ XP ganada: **+${boss.s.xp.toLocaleString()}**`
                )
                .setColor(0x00FF88);
            await msg.reply({ embeds: [embed] });
            const extraBoss = [misionBoss, logBoss ? `🏆 **LOGROS:**\n${logBoss}` : ''].filter(Boolean).join('\n\n');
            if (extraBoss) void msg.channel.send(extraBoss);
            return;
        }

        guardarDatos();
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Ataque a ${boss.s.n}`)
            .setDescription(
                `**${u.n}** causó **${dano.toLocaleString()}** de daño.\n` +
                `❤️ HP restante: **${boss.hpActual.toLocaleString()}**`
            )
            .setColor(0xFF6600);
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🧘 MEDITAR
    // ==========================================
    if (cmd === 'meditar') {
        const cooldown = 2 * 60 * 60 * 1000;
        const tiempoEspera = cooldown - (Date.now() - (u.meditarCooldown || 0));
        if (tiempoEspera > 0) {
            const restante = Math.ceil(tiempoEspera / 60000);
            return void msg.reply(`⏳ Debes esperar **${restante} minuto(s)** para meditar.`);
        }
        const maxEn = gU.enBase + (u.dedos * 500);
        u.en = Math.min(maxEn, u.en + 100);
        u.meditarCooldown = Date.now();
        u.vecesMeditado = (u.vecesMeditado ?? 0) + 1;
        const misionMeditar = actualizarMision(u, 'meditar');
        const logMeditar = verificarLogros(u);
        guardarDatos();
        let resMeditar = `🧘 Has meditado. Recuperaste **+100 de Energía Maldita**.`;
        if (misionMeditar) resMeditar += `\n\n${misionMeditar}`;
        if (logMeditar)    resMeditar += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logMeditar}`;
        return void msg.reply(resMeditar);
    }

    // ==========================================
    // 📊 TECNICAS
    // ==========================================
    if (cmd === 'tecnicas') {
        const clanEntry = Object.values(CLANES).find(c => msg.member!.roles.cache.has(c.id));
        if (!clanEntry) return void msg.reply("❌ No perteneces a ningún clan.");
        const tecsClan = Object.entries(TECNICAS)
            .filter(([, t]) => t.clan === clanEntry.id)
            .sort((a, b) => {
                const orden = ['Grado 4', 'Grado 3', 'Grado 2', 'Grado 1', 'Grado Especial'];
                return orden.indexOf(a[1].g) - orden.indexOf(b[1].g);
            });
        const porGrado: Record<string, string[]> = {};
        for (const [cmdKey, t] of tecsClan) {
            if (!porGrado[t.g]) porGrado[t.g] = [];
            porGrado[t.g].push(`\`${cmdKey}\` ${t.n} *(${t.c} EN)*`);
        }
        const embedTec = new EmbedBuilder()
            .setTitle(`${clanEntry.emoji} TÉCNICAS · CLAN ${clanEntry.n.toUpperCase()}`)
            .setColor(0x2C2F33)
            .setFooter({ text: `${tecsClan.length} técnicas en total` });
        for (const grado of ['Grado 4', 'Grado 3', 'Grado 2', 'Grado 1', 'Grado Especial']) {
            if (porGrado[grado]?.length) {
                embedTec.addFields({ name: `🎖️ ${grado}`, value: porGrado[grado].join('\n'), inline: false });
            }
        }
        return void msg.reply({ embeds: [embedTec] });
    }

    // ==========================================
    // 🏪 VENDER ITEM
    // ==========================================
    if (cmd === 'vender') {
        const nombreVenta = args.join(' ');
        if (!nombreVenta) return void msg.reply("Uso: `!vender [nombre exacto del objeto]`");
        if (!u.inv.includes(nombreVenta)) return void msg.reply(`❌ No tienes **${nombreVenta}** en tu inventario.`);
        const itemTienda = Object.values(TIENDA).find(i => i.n === nombreVenta);
        const precioVenta = itemTienda ? Math.floor(itemTienda.precio * 0.30) : 500;
        u.inv = u.inv.filter(i => i !== nombreVenta);
        if (nombreVenta === 'Brazo de Sukuna') u.tieneBrazo = false;
        if (u.equipado === nombreVenta) u.equipado = null;
        u.y += precioVenta;
        u.vecesVendido = (u.vecesVendido ?? 0) + 1;
        const misionVender = actualizarMision(u, 'vender');
        const logVender = verificarLogros(u);
        guardarDatos();
        let resVenta = `🏪 Vendiste **${nombreVenta}** por **$${precioVenta.toLocaleString()} Yenes** *(30% del precio base)*.\n💴 Saldo: **$${u.y.toLocaleString()}**`;
        if (misionVender) resVenta += `\n\n${misionVender}`;
        if (logVender)    resVenta += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logVender}`;
        return void msg.reply(resVenta);
    }

    // ==========================================
    // 💊 RECUPERAR HP
    // ==========================================
    if (cmd === 'recuperar') {
        const maxHpR = gU.hpBase + (u.dedos * 100);
        if (u.hp >= maxHpR) return void msg.reply("❤️ Ya tienes el HP al máximo.");
        const hpFaltante = maxHpR - u.hp;
        const costoFinal = Math.max(2000, Math.ceil(hpFaltante * 50));
        if (u.y < costoFinal) return void msg.reply(`❌ Necesitas **$${costoFinal.toLocaleString()} Yenes** para recuperar ${hpFaltante} HP.\nTienes: **$${u.y.toLocaleString()}**`);
        u.y  -= costoFinal;
        u.hp  = maxHpR;
        u.vecesRecuperado = (u.vecesRecuperado ?? 0) + 1;
        const logRec = verificarLogros(u);
        guardarDatos();
        let resRec = `💊 HP restaurado completamente.\n❤️ **${maxHpR.toLocaleString()}/${maxHpR.toLocaleString()} HP** — Costo: **-$${costoFinal.toLocaleString()}** | Saldo: $${u.y.toLocaleString()}`;
        if (logRec) resRec += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logRec}`;
        return void msg.reply(resRec);
    }

    // ==========================================
    // 📋 MISIÓN
    // ==========================================
    if (cmd === 'mision') {
        if (!u.misionActual) {
            u.misionActual = generarMision(u.misionesCumplidas ?? 0);
            guardarDatos();
        }
        const m = u.misionActual;
        const barLen = 10;
        const filled = Math.round((m.progreso / m.objetivo) * barLen);
        const barra  = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        const embedMis = new EmbedBuilder()
            .setTitle('📋 MISIÓN ACTIVA')
            .setDescription(`**${m.desc}**\n\n${barra} ${m.progreso}/${m.objetivo}`)
            .addFields(
                { name: '💴 Recompensa',         value: `$${m.recompY.toLocaleString()}`,    inline: true },
                { name: '✨ XP',                  value: m.recompXP.toLocaleString(),          inline: true },
                { name: '🏅 Misiones cumplidas',  value: `${u.misionesCumplidas ?? 0}`,        inline: true },
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'El progreso se actualiza automáticamente al usar comandos' });
        return void msg.reply({ embeds: [embedMis] });
    }

    // ==========================================
    // 🏆 LOGROS
    // ==========================================
    if (cmd === 'logros') {
        const desbloqueados = u.logrosDesbloqueados ?? [];
        const total    = LOGROS.length;
        const unlocked = desbloqueados.length;
        const pct      = Math.floor((unlocked / total) * 100);
        const barLen2  = 12;
        const filled2  = Math.round((unlocked / total) * barLen2);
        const barra2   = '█'.repeat(filled2) + '░'.repeat(barLen2 - filled2);
        const proximos = LOGROS.filter(l => !desbloqueados.includes(l.id)).slice(0, 5);
        const ultimos  = LOGROS.filter(l => desbloqueados.slice(-5).includes(l.id));
        const embedLog = new EmbedBuilder()
            .setTitle(`🏆 LOGROS DE ${u.n}`)
            .setDescription(`**${unlocked}/${total}** desbloqueados\n${barra2} ${pct}%`)
            .addFields(
                { name: '🎯 Próximos logros', value: proximos.map(l => `${l.icono} **${l.n}** — ${l.desc}`).join('\n') || '_¡Todos desbloqueados!_', inline: false },
                { name: '✅ Últimos obtenidos', value: ultimos.map(l => `${l.icono} ${l.n}`).join(', ') || '_Ninguno aún_', inline: false },
            )
            .setColor(0xFFD700);
        return void msg.reply({ embeds: [embedLog] });
    }

    // ==========================================
    // 📜 HISTORIAL
    // ==========================================
    if (cmd === 'historial') {
        if (historialEventos.length === 0) return void msg.reply("📜 El historial está vacío. ¡Empieza a luchar!");
        const embedHist = new EmbedBuilder()
            .setTitle('📜 HISTORIAL DE EVENTOS')
            .setDescription(historialEventos.join('\n'))
            .setColor(0x34495E)
            .setFooter({ text: 'Últimos 15 eventos del servidor' });
        return void msg.reply({ embeds: [embedHist] });
    }

    // ==========================================
    // 🔄 INTERCAMBIAR ITEM
    // ==========================================
    if (cmd === 'intercambiar') {
        const targetInter = msg.mentions.users.first();
        if (!targetInter) return void msg.reply("Uso: `!intercambiar @usuario [nombre del item a ofrecer]`");
        if (targetInter.id === uid) return void msg.reply("❌ No puedes intercambiar contigo mismo.");
        const itemOfrecido = args.slice(1).join(' ');
        if (!itemOfrecido) return void msg.reply("❌ Especifica qué item quieres ofrecer. Uso: `!intercambiar @usuario [item]`");
        if (!u.inv.includes(itemOfrecido)) return void msg.reply(`❌ No tienes **${itemOfrecido}** en tu inventario.`);
        if (intercambiosActivos.has(targetInter.id)) return void msg.reply(`❌ <@${targetInter.id}> ya tiene una propuesta de intercambio pendiente.`);
        intercambiosActivos.set(targetInter.id, {
            solicitanteId:   uid,
            solicitanteName: u.n,
            itemOfrecido,
            expira: Date.now() + 5 * 60 * 1000,
        });
        setTimeout(() => {
            const entry = intercambiosActivos.get(targetInter.id);
            if (entry && entry.solicitanteId === uid) intercambiosActivos.delete(targetInter.id);
        }, 5 * 60 * 1000);
        return void msg.reply(`🔄 **${u.n}** le ofrece **${itemOfrecido}** a <@${targetInter.id}>.\n✅ <@${targetInter.id}> usa \`!aceptar_intercambio [item a dar]\` para confirmar (expira en 5 min).`);
    }

    if (cmd === 'aceptar_intercambio') {
        const propuesta = intercambiosActivos.get(uid);
        if (!propuesta) return void msg.reply("❌ No tienes ninguna propuesta de intercambio pendiente.");
        if (Date.now() > propuesta.expira) {
            intercambiosActivos.delete(uid);
            return void msg.reply("❌ La propuesta de intercambio expiró.");
        }
        const itemDar = args.join(' ');
        if (!itemDar) return void msg.reply("❌ Indica qué item vas a dar. Uso: `!aceptar_intercambio [item]`");
        if (!u.inv.includes(itemDar)) return void msg.reply(`❌ No tienes **${itemDar}** en tu inventario.`);
        if (!db.has(propuesta.solicitanteId)) return void msg.reply("❌ El solicitante ya no existe en la base de datos.");
        const solicitante = db.get(propuesta.solicitanteId)!;
        if (!solicitante.inv.includes(propuesta.itemOfrecido)) {
            intercambiosActivos.delete(uid);
            return void msg.reply(`❌ **${propuesta.solicitanteName}** ya no tiene **${propuesta.itemOfrecido}**. Intercambio cancelado.`);
        }
        solicitante.inv = solicitante.inv.filter(i => i !== propuesta.itemOfrecido);
        solicitante.inv.push(itemDar);
        u.inv = u.inv.filter(i => i !== itemDar);
        u.inv.push(propuesta.itemOfrecido);
        u.vecesIntercambio = (u.vecesIntercambio ?? 0) + 1;
        solicitante.vecesIntercambio = (solicitante.vecesIntercambio ?? 0) + 1;
        intercambiosActivos.delete(uid);
        const logInter = verificarLogros(u);
        verificarLogros(solicitante);
        db.set(propuesta.solicitanteId, solicitante);
        guardarDatos();
        agregarHistorial(`🔄 **${u.n}** y **${propuesta.solicitanteName}** intercambiaron objetos`);
        let resInter = `✅ ¡Intercambio completado!\n📦 **${u.n}** recibió: **${propuesta.itemOfrecido}**\n📦 **${propuesta.solicitanteName}** recibió: **${itemDar}**`;
        if (logInter) resInter += `\n\n🏆 **LOGROS:**\n${logInter}`;
        return void msg.reply(resInter);
    }

    // ==========================================
    // 🤝 PACTAR
    // ==========================================
    if (cmd === 'pactar') {
        const target = msg.mentions.users.first();
        if (!target) return void msg.reply("🎯 Menciona al usuario con quien pactar.");
        if (target.id === uid) return void msg.reply("❌ No puedes pactarte contigo mismo.");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id)!;
        u.pactadoCon = target.id;
        vU.pactadoCon = uid;
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`🤝 Pacto establecido con **${target.username}**.`);
    }

    // ==========================================
    // 🎲 COMPRAR REROLL DE CLAN
    // ==========================================
    if (cmd === 'comprar_reroll') {
        const costo = 150000;
        if (u.y < costo) return void msg.reply(`❌ Necesitas **$${costo.toLocaleString()} Yenes**.`);
        const clanesIds = Object.values(CLANES).map(c => c.id);
        const clanActual = clanesIds.find(id => msg.member!.roles.cache.has(id));
        try {
            if (clanActual) await msg.member!.roles.remove(clanActual);
            const nuevoClanId = clanesIds[Math.floor(Math.random() * clanesIds.length)];
            await msg.member!.roles.add(nuevoClanId);
            u.y -= costo;
            u.vecesReroll = (u.vecesReroll ?? 0) + 1;
            verificarLogros(u);
            guardarDatos();
            const nuevoClan = Object.values(CLANES).find(c => c.id === nuevoClanId)!;
            return void msg.reply(`🎲 Nuevo clan: **${nuevoClan.n}** ${nuevoClan.emoji}`);
        } catch {
            return void msg.reply("❌ No tengo permisos para gestionar roles.");
        }
    }

    // ==========================================
    // 🛠️ COMANDOS DE DIOS (ADMINS)
    // ==========================================
    const esAdmin = msg.member.permissions.has('Administrator');

    if (cmd === 'setup_maldiciones') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupMaldiciones = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal de spawn de maldiciones: <#${msg.channel.id}>`);
    }

    if (cmd === 'setup_callejon') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupCallejon = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal del callejón: <#${msg.channel.id}>`);
    }

    if (cmd === 'setup_trabajo') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupTrabajo = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal de trabajo asignado: <#${msg.channel.id}>\nSolo se podrá usar \`!trabajar\` aquí.`);
    }

    if (cmd === 'setup_combate') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupCombate = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal de combate asignado: <#${msg.channel.id}>\nSolo se podrán usar técnicas aquí.`);
    }

    if (cmd === 'setup_tienda') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupTienda = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal de tienda asignado: <#${msg.channel.id}>\n\`!tienda\` y \`!comprar\` solo funcionarán aquí.`);
    }

    if (cmd === 'setup_perfil') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        config.setupPerfil = msg.channel.id;
        guardarConfig();
        return void msg.reply(`✅ Canal de perfil asignado: <#${msg.channel.id}>\n\`!perfil\`, \`!inventario\` y \`!ranking\` solo funcionarán aquí.`);
    }

    if (cmd === 'quitar_canal') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const zona = args[0]?.toLowerCase();
        const zonas: Record<string, keyof Config> = {
            'trabajo':    'setupTrabajo',
            'combate':    'setupCombate',
            'tienda':     'setupTienda',
            'perfil':     'setupPerfil',
            'maldiciones':'setupMaldiciones',
            'callejon':   'setupCallejon',
        };
        const clave = zonas[zona ?? ''];
        if (!clave) return void msg.reply("❌ Zonas válidas: `trabajo`, `combate`, `tienda`, `perfil`, `maldiciones`, `callejon`.");
        (config as unknown as Record<string, unknown>)[clave] = null;
        guardarConfig();
        return void msg.reply(`✅ Restricción de canal para **${zona}** eliminada. El comando funcionará en cualquier canal.`);
    }

    if (cmd === 'ver_canales') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const fmt = (v: string | null) => v ? `<#${v}>` : '_(sin restricción)_';
        const embed = new EmbedBuilder()
            .setTitle("📋 CANALES CONFIGURADOS")
            .addFields(
                { name: '👾 Spawn Maldiciones', value: fmt(config.setupMaldiciones), inline: true },
                { name: '🎁 Callejón',           value: fmt(config.setupCallejon),   inline: true },
                { name: '💼 Trabajo',             value: fmt(config.setupTrabajo),    inline: true },
                { name: '⚔️ Combate',             value: fmt(config.setupCombate),    inline: true },
                { name: '🛒 Tienda',              value: fmt(config.setupTienda),     inline: true },
                { name: '📋 Perfil/Ranking',      value: fmt(config.setupPerfil),     inline: true },
            )
            .setColor(0x2C2F33)
            .setFooter({ text: 'Usa !quitar_canal [zona] para eliminar una restricción.' });
        return void msg.reply({ embeds: [embed] });
    }

    if (cmd === 'quitar_objeto') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        if (!target) return void msg.reply("Uso: `!quitar_objeto @usuario [nombre del objeto]`");
        const nombreItem = args.slice(1).join(' ');
        if (!db.has(target.id)) return void msg.reply("Usuario no encontrado.");
        const vU = db.get(target.id)!;
        if (!vU.inv.includes(nombreItem)) return void msg.reply(`❌ **${target.username}** no tiene **${nombreItem}**.`);
        vU.inv = vU.inv.filter(i => i !== nombreItem);
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ Se eliminó **${nombreItem}** del inventario de **${target.username}**.`);
    }

    if (cmd === 'add_yenes') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1] ?? '');
        if (!target || isNaN(cantidad)) return void msg.reply("Uso: `!add_yenes @usuario [cantidad]`");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id)!;
        vU.y += cantidad;
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ +$${cantidad.toLocaleString()} a **${target.username}**.`);
    }

    if (cmd === 'remove_yenes') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1] ?? '');
        if (!target || isNaN(cantidad)) return void msg.reply("Uso: `!remove_yenes @usuario [cantidad]`");
        if (!db.has(target.id)) return void msg.reply("Usuario no encontrado.");
        const vU = db.get(target.id)!;
        vU.y = Math.max(0, vU.y - cantidad);
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ -$${cantidad.toLocaleString()} a **${target.username}**.`);
    }

    if (cmd === 'add_xp') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1] ?? '');
        if (!target || isNaN(cantidad)) return void msg.reply("Uso: `!add_xp @usuario [cantidad]`");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id)!;
        vU.xp += cantidad;
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ +${cantidad.toLocaleString()} XP a **${target.username}**.`);
    }

    if (cmd === 'remove_xp') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1] ?? '');
        if (!target || isNaN(cantidad)) return void msg.reply("Uso: `!remove_xp @usuario [cantidad]`");
        if (!db.has(target.id)) return void msg.reply("Usuario no encontrado.");
        const vU = db.get(target.id)!;
        vU.xp = Math.max(0, vU.xp - cantidad);
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ -${cantidad.toLocaleString()} XP a **${target.username}**.`);
    }

    if (cmd === 'quitar_sellado') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.members?.first();
        if (!target) return void msg.reply("Uso: `!quitar_sellado @usuario`");
        if (!db.has(target.id)) return void msg.reply("Usuario no encontrado.");
        const vU = db.get(target.id)!;
        try {
            if (target.roles.cache.has(ROL_GOKUMONKYO)) await target.roles.remove(ROL_GOKUMONKYO);
            if (vU.rolesSellado.length > 0) await target.roles.add(vU.rolesSellado);
        } catch { }
        vU.sellado = null;
        vU.rolesSellado = [];
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ Sello eliminado de **${target.user.username}**.`);
    }

    if (cmd === 'set_hp') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const valor = parseInt(args[1] ?? '');
        if (!target || isNaN(valor)) return void msg.reply("Uso: `!set_hp @usuario [valor]`");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id)!;
        const gV = getGrado(vU.xp);
        const maxHp = gV.hpBase + (vU.dedos * 100);
        vU.hp = Math.max(0, Math.min(maxHp, valor));
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`✅ HP de **${target.username}** ajustado a **${vU.hp}/${maxHp}**.`);
    }

    if (cmd === 'reiniciar') {
        if (!esAdmin) return void msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        if (!target) return void msg.reply("Uso: `!reiniciar @usuario`");
        db.set(target.id, usuarioBase(target.username));
        guardarDatos();
        return void msg.reply(`✅ Datos de **${target.username}** reiniciados a valores iniciales.`);
    }

    // ==========================================
    // ❓ AYUDA
    // ==========================================
    if (cmd === 'ayuda' || cmd === 'comandos' || cmd === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("📖 GUÍA DE COMANDOS — SHINJUKU SHOWDOWN")
            .setColor(0x2C2F33)
            .addFields(
                { name: "👤 Perfil & Progreso", value:
                    "`!perfil` — Tu ficha\n`!inventario` — Tus objetos\n`!clan` — Info de tu clan\n`!ranking xp|yenes|dedos|hp|kills` — Top 10",
                    inline: false },
                { name: "⚔️ Combate", value:
                    "`![técnica] @usuario` — Atacar (cada técnica tiene cooldown)\n`!retar @usuario` — Desafiar a duelo\n`!aceptar` — Aceptar un reto\n`!exorcizar` — Atacar boss activo\n`!maldiciones` — Bosses activos\n`!meditar` — Recuperar energía (1x/2h)",
                    inline: false },
                { name: "💰 Economía", value:
                    "`!trabajar` — Ganar yenes (1x/1h)\n`!diario` — Recompensa diaria\n`!robar @usuario` — Intentar robar (cd 2h)\n`!donar @usuario [cantidad]` — Transferir yenes\n`!tienda` — Ver tienda\n`!comprar [item]` — Comprar ítem\n`!vender [item]` — Vender ítem (30% del precio)\n`!recuperar` — Restaurar HP con yenes\n`!comer_dedo` — Comprar dedo ($100k)\n`!comprar_reroll` — Cambiar clan ($150k)",
                    inline: false },
                { name: "🎒 Inventario & Equipamiento", value:
                    "`!tecnicas` — Ver técnicas de tu clan\n`!equipar [nombre]` — Equipar objeto\n`!recoger` — Recoger ítem del callejón\n`!usar_sello pequeño|estandar|eterno @usuario` — Sellar",
                    inline: false },
                { name: "🎯 Misiones & Logros", value:
                    "`!mision` — Ver tu misión activa\n`!logros` — Ver tus logros (100 en total)\n`!historial` — Ver últimos eventos del servidor",
                    inline: false },
                { name: "🤝 Social", value:
                    "`!pactar @usuario` — Formar pacto\n`!intercambiar @usuario [item]` — Proponer intercambio\n`!aceptar_intercambio [item]` — Aceptar intercambio\n`!estadisticas` — Ver tus kills y stats de combate",
                    inline: false },
                { name: "🛠️ Admin", value:
                    "`!setup_maldiciones` · `!setup_callejon`\n`!add_xp/yenes @user [n]` · `!remove_xp/yenes @user [n]`\n`!set_hp @user [valor]` · `!quitar_objeto @user [item]`\n`!quitar_sellado @user` · `!reiniciar @user`",
                    inline: false }
            )
            .setFooter({ text: "Usa las técnicas de tu clan. 120 técnicas disponibles." });
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🏛️ CLAN INFO
    // ==========================================
    if (cmd === 'clan') {
        const clanEntry = Object.values(CLANES).find(c => msg.member!.roles.cache.has(c.id));
        if (!clanEntry) return void msg.reply("❌ No perteneces a ningún clan. Un admin debe asignarte uno.");

        const miembrosDelClan = msg.guild!.members.cache.filter(m => m.roles.cache.has(clanEntry.id));
        const tecnnicasClan = Object.entries(TECNICAS).filter(([, t]) => t.clan === clanEntry.id);
        const tecnicasLista = tecnnicasClan.slice(0, 8).map(([tecCmd]) => `\`${tecCmd}\``).join(', ') +
            (tecnnicasClan.length > 8 ? ` y ${tecnnicasClan.length - 8} más...` : '');

        const embed = new EmbedBuilder()
            .setTitle(`${clanEntry.emoji} CLAN ${clanEntry.n.toUpperCase()}`)
            .addFields(
                { name: '👥 Miembros',     value: `${miembrosDelClan.size}`,  inline: true },
                { name: '⚔️ Técnicas',     value: `${tecnnicasClan.length}`,  inline: true },
                { name: '📋 Comandos',     value: tecnicasLista,              inline: false }
            )
            .setColor(0x2C2F33);
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 👾 MALDICIONES ACTIVAS
    // ==========================================
    if (cmd === 'maldiciones') {
        if (bossesActivos.size === 0) return void msg.reply("🕊️ No hay maldiciones activas en ningún canal ahora mismo.");
        const lista = Array.from(bossesActivos.entries()).map(([chanId, boss]) =>
            `📍 <#${chanId}> — **${boss.s.n}** ❤️ ${boss.hpActual.toLocaleString()} HP`
        ).join('\n');
        const embed = new EmbedBuilder()
            .setTitle("👾 MALDICIONES ACTIVAS")
            .setDescription(lista)
            .setColor(0xFF0000)
            .setFooter({ text: "Usa !exorcizar en el canal correspondiente." });
        return void msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 💼 TRABAJAR
    // ==========================================
    if (cmd === 'trabajar') {
        const errCanal = checkCanal(config.setupTrabajo, msg.channel.id, 'Trabajo');
        if (errCanal) return void msg.reply(errCanal);
        const cooldown = 60 * 60 * 1000;
        const lastTrabajo = u.trabajarCooldown ?? 0;
        if (Date.now() - lastTrabajo < cooldown) {
            const restante = Math.ceil((cooldown - (Date.now() - lastTrabajo)) / 60000);
            return void msg.reply(`⏳ Debes esperar **${restante} minuto(s)** para volver a trabajar.`);
        }
        const trabajos = [
            { desc: "Patrullaste el barrio de Shinjuku",  yenes: 500  },
            { desc: "Exorcizaste fantasmas menores",       yenes: 1200 },
            { desc: "Completaste una misión de Grado 4",   yenes: 2500 },
            { desc: "Entrenaste en el Colegio Jujutsu",    yenes: 800  },
            { desc: "Investigaste una maldición errante",  yenes: 3000 },
            { desc: "Vendiste objetos malditos",           yenes: 4500 },
            { desc: "Completaste una misión especial",     yenes: 6000 },
        ];
        const trabajo = trabajos[Math.floor(Math.random() * trabajos.length)];
        u.y += trabajo.yenes;
        u.trabajarCooldown = Date.now();
        u.vecesTrabajado = (u.vecesTrabajado ?? 0) + 1;
        const misionTrab = actualizarMision(u, 'trabajar');
        const logTrab    = verificarLogros(u);
        guardarDatos();
        const embedTrab = new EmbedBuilder()
            .setTitle("💼 ¡MISIÓN COMPLETADA!")
            .setDescription(`${trabajo.desc}.\n💴 Ganaste: **$${trabajo.yenes.toLocaleString()} Yenes**\n💴 Saldo: **$${u.y.toLocaleString()}**`)
            .setColor(0x00CC88);
        await msg.reply({ embeds: [embedTrab] });
        const extraTrab = [misionTrab, logTrab ? `🏆 **LOGROS:**\n${logTrab}` : ''].filter(Boolean).join('\n\n');
        if (extraTrab) void msg.channel.send(extraTrab);
        return;
    }

    // ==========================================
    // 💸 DONAR YENES
    // ==========================================
    if (cmd === 'donar') {
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1] ?? '');
        if (!target || isNaN(cantidad) || cantidad <= 0) return void msg.reply("Uso: `!donar @usuario [cantidad]`");
        if (target.id === uid) return void msg.reply("❌ No puedes donarte a ti mismo.");
        if (u.y < cantidad) return void msg.reply(`❌ No tienes suficientes yenes. Tienes $${u.y.toLocaleString()}.`);
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id)!;
        u.y -= cantidad;
        vU.y += cantidad;
        db.set(target.id, vU);
        guardarDatos();
        return void msg.reply(`💸 Donaste **$${cantidad.toLocaleString()} Yenes** a **${target.username}**.\n💴 Tu saldo: $${u.y.toLocaleString()}`);
    }

    // ==========================================
    // ☝️ COMER DEDO
    // ==========================================
    if (cmd === 'comer_dedo') {
        const precioDedo = 100000;
        if (u.y < precioDedo) return void msg.reply(`❌ Cuesta $${precioDedo.toLocaleString()} Yenes.`);
        if (u.dedos >= 20) return void msg.reply("⚠️ Has alcanzado el límite de 20 recipientes.");

        u.y -= precioDedo;
        u.dedos++;
        u.xp += 15000;

        if (u.dedos >= 20) {
            const msg20 = u.tieneBrazo
                ? `👑 **¡RELIQUIA DE SUKUNA COMPLETA!** **${u.n}** reunió los 20 dedos. ¡Daño x3 activo!`
                : `👑 **¡20 DEDOS ACUMULADOS!** **${u.n}** ha reunido los 20 dedos de Sukuna.`;
            void msg.channel.send(msg20);
            try { await msg.member.roles.add(ROL_REY_MALDICIONES); } catch (e) { console.error("Error rol:", e); }
        }

        const logDedo = verificarLogros(u);
        guardarDatos();
        let resDedo = `☝️ Asimilaste el dedo **${u.dedos}/20**. Tus estadísticas aumentan.`;
        if (logDedo) resDedo += `\n\n🏆 **LOGROS DESBLOQUEADOS:**\n${logDedo}`;
        return void msg.reply(resDedo);
    }

    // ==========================================
    // 🎁 RECOMPENSA DIARIA
    // ==========================================
    if (cmd === 'diario') {
        const cd24h = 24 * 60 * 60 * 1000;
        const ultimo = u.ultimoDiario ?? 0;
        const espera = cd24h - (Date.now() - ultimo);
        if (espera > 0) {
            const horas = Math.floor(espera / 3_600_000);
            const mins  = Math.ceil((espera % 3_600_000) / 60_000);
            return void msg.reply(`⏳ Ya reclamaste tu recompensa hoy. Vuelve en **${horas}h ${mins}m**.`);
        }
        const yenesDiario = Math.floor(Math.random() * 3000 + 2000 + gU.dmgM * 500);
        const xpDiario    = Math.floor(Math.random() * 500 + 200);
        u.y             += yenesDiario;
        u.xp            += xpDiario;
        u.ultimoDiario   = Date.now();
        u.vecesDiario    = (u.vecesDiario ?? 0) + 1;
        const misionDiario = actualizarMision(u, 'diario');
        const logDiario    = verificarLogros(u);
        guardarDatos();
        await msg.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("🎁 RECOMPENSA DIARIA")
                .setDescription(`**${u.n}** reclamó su recompensa.\n💴 +**$${yenesDiario.toLocaleString()} Yenes**\n✨ +**${xpDiario} XP**\n\n_Vuelve mañana para la siguiente._`)
                .setColor(0xFFD700)
        ]});
        const extraDiario = [misionDiario, logDiario ? `🏆 **LOGROS:**\n${logDiario}` : ''].filter(Boolean).join('\n\n');
        if (extraDiario) void msg.channel.send(extraDiario);
        return;
    }

    // ==========================================
    // 🦹 ROBAR YENES
    // ==========================================
    if (cmd === 'robar') {
        const target = msg.mentions.users.first();
        if (!target) return void msg.reply("🎯 Menciona a quien quieres robar. Uso: `!robar @usuario`");
        if (target.id === uid) return void msg.reply("❌ No puedes robarte a ti mismo.");
        const cd2h = 2 * 60 * 60 * 1000;
        if (!u.cooldowns) u.cooldowns = {};
        const ultimoRobo = u.cooldowns['robar'] ?? 0;
        const esperaRobo = cd2h - (Date.now() - ultimoRobo);
        if (esperaRobo > 0) {
            return void msg.reply(`⏳ Debes esperar **${formatCooldown(esperaRobo)}** para volver a robar.`);
        }
        if (!db.has(target.id)) return void msg.reply("❌ Ese usuario no tiene datos registrados.");
        const vU = db.get(target.id)!;
        if (vU.y < 500) return void msg.reply("💸 Ese usuario no tiene suficientes yenes para robar (mínimo $500).");
        const diferenciaXP = u.xp - vU.xp;
        const tasaExito = Math.min(0.65, Math.max(0.20, 0.40 + diferenciaXP / 200000));
        u.cooldowns['robar'] = Date.now();
        if (Math.random() < tasaExito) {
            const robado = Math.floor(vU.y * (Math.random() * 0.10 + 0.05));
            vU.y -= robado;
            u.y  += robado;
            u.vecesRobadoExito = (u.vecesRobadoExito ?? 0) + 1;
            db.set(target.id, vU);
            const misionRobar = actualizarMision(u, 'robar');
            const logRobar    = verificarLogros(u);
            guardarDatos();
            await msg.reply({ embeds: [
                new EmbedBuilder()
                    .setTitle("🦹 ¡ROBO EXITOSO!")
                    .setDescription(`**${u.n}** le robó **$${robado.toLocaleString()} Yenes** a **${target.username}**.\n💴 Tu saldo: $${u.y.toLocaleString()}\n📊 Probabilidad de éxito: ${Math.floor(tasaExito * 100)}%`)
                    .setColor(0x8B0000)
            ]});
            const extraRobar = [misionRobar, logRobar ? `🏆 **LOGROS:**\n${logRobar}` : ''].filter(Boolean).join('\n\n');
            if (extraRobar) void msg.channel.send(extraRobar);
            return;
        } else {
            const multa = Math.floor(u.y * 0.05);
            u.y = Math.max(0, u.y - multa);
            guardarDatos();
            return void msg.reply({ embeds: [
                new EmbedBuilder()
                    .setTitle("🚨 ¡TE ATRAPARON!")
                    .setDescription(`**${u.n}** intentó robarle a **${target.username}** pero fue atrapado.\n💴 Multa: **-$${multa.toLocaleString()} Yenes**\n💴 Tu saldo: $${u.y.toLocaleString()}`)
                    .setColor(0xFF6600)
            ]});
        }
    }

    // ==========================================
    // ⚔️ RETAR A DUELO
    // ==========================================
    if (cmd === 'retar') {
        const target = msg.mentions.users.first();
        if (!target) return void msg.reply("🎯 Menciona a quien quieres retar. Uso: `!retar @usuario`");
        if (target.id === uid) return void msg.reply("❌ No puedes retarte a ti mismo.");
        if (target.bot) return void msg.reply("❌ No puedes retar a un bot.");
        if (retosActivos.has(target.id)) return void msg.reply("⚔️ Ese usuario ya tiene un reto pendiente.");
        retosActivos.set(target.id, { retadorId: uid, retadorName: u.n, expira: Date.now() + 60_000 });
        setTimeout(() => {
            if (retosActivos.get(target.id)?.retadorId === uid) retosActivos.delete(target.id);
        }, 60_000);
        return void msg.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("⚔️ ¡DESAFÍO DE HECHICERO!")
                .setDescription(`**${u.n}** reta a **${target.username}** a un duelo.\n\n**${target.username}**, usa \`!aceptar\` en los próximos **60 segundos**.\n\nSi ignoras el reto, expira automáticamente.`)
                .setColor(0xFF0000)
                .setFooter({ text: "El duelo se resuelve con técnicas normales. ¡Sin cuartel!" })
        ]});
    }

    if (cmd === 'aceptar') {
        const reto = retosActivos.get(uid);
        if (!reto) return void msg.reply("❌ No tienes ningún reto pendiente.");
        if (Date.now() > reto.expira) {
            retosActivos.delete(uid);
            return void msg.reply("⌛ El reto ya expiró.");
        }
        retosActivos.delete(uid);
        return void msg.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("⚔️ ¡DUELO ACEPTADO!")
                .setDescription(`**${u.n}** aceptó el duelo contra **${reto.retadorName}**.\n\n🔥 ¡Que comience el combate! Usen \`![técnica] @rival\` para atacarse.`)
                .setColor(0xFF4500)
        ]});
    }

    // ==========================================
    // 📊 ESTADÍSTICAS
    // ==========================================
    if (cmd === 'estadisticas' || cmd === 'stats') {
        const errCanal = checkCanal(config.setupPerfil, msg.channel.id, 'Perfil');
        if (errCanal) return void msg.reply(errCanal);
        return void msg.reply({ embeds: [
            new EmbedBuilder()
                .setAuthor({ name: `Estadísticas: ${u.n}`, iconURL: msg.author.displayAvatarURL() })
                .setTitle("📊 ESTADÍSTICAS DE COMBATE")
                .addFields(
                    { name: '⚔️ Kills PvP',          value: `${u.kills    ?? 0}`,    inline: true },
                    { name: '👾 Bosses Exorcizados',  value: `${u.bossKills ?? 0}`,   inline: true },
                    { name: '🎌 Técnicas Usadas',     value: `${u.tecUsadas ?? 0}`,   inline: true },
                    { name: '💴 Yenes Actuales',      value: `$${u.y.toLocaleString()}`, inline: true },
                    { name: '✨ XP Total',            value: u.xp.toLocaleString(),   inline: true },
                    { name: '☝️ Dedos',               value: `${u.dedos}/20`,         inline: true },
                )
                .setColor(0x2C2F33)
        ]});
    }

    // ==========================================
    // ⚔️ MOTOR DE COMBATE CENTRAL
    // ==========================================
    const tech = TECNICAS_NORM.get(quitarAcentos(cmd));
    if (tech) {
        const errCanal = checkCanal(config.setupCombate, msg.channel.id, 'Combate');
        if (errCanal) return void msg.reply(errCanal);

        if (u.sellado && Date.now() < u.sellado) {
            return void msg.reply("⛓️ Estás sellado. No puedes usar técnicas.");
        }

        if (u.hp <= 0) {
            const maxHpU = gU.hpBase + (u.dedos * 100);
            u.hp = Math.ceil(maxHpU * 0.10);
            guardarDatos();
            return void msg.reply("💀 Estás inconsciente. Tu HP ha sido restaurado al 10%. Espera a recuperarte antes de atacar.");
        }

        const equip = u.equipado ? EQUIPAMIENTO[u.equipado] : null;

        if (tech.clan && !msg.member.roles.cache.has(tech.clan) && !equip?.sinClan) {
            return void msg.reply("❌ Tu linaje no permite usar esta técnica.");
        }

        const reqGrado = GRADOS.find(g => g.n === tech.g);
        if (!reqGrado || u.xp < reqGrado.xp) return void msg.reply(`❌ Requieres el rango de **${tech.g}**.`);

        const costoEnergia = Math.ceil(tech.c * costoMultiplicador);
        if (u.en < costoEnergia) return void msg.reply("🪫 Sin Energía Maldita.");

        // --- ⏱️ COOLDOWN DE TÉCNICA ---
        if (!u.cooldowns) u.cooldowns = {};
        const cdMs = getCooldownMs(tech);
        const ultimoUso = u.cooldowns[cmd] ?? 0;
        const tiempoEspera = cdMs - (Date.now() - ultimoUso);
        if (tiempoEspera > 0) {
            return void msg.reply(`⏳ **${tech.n}** en cooldown. Espera **${formatCooldown(tiempoEspera)}**.`);
        }
        u.cooldowns[cmd] = Date.now();
        u.tecUsadas = (u.tecUsadas ?? 0) + 1;
        const misionTec = actualizarMision(u, 'tecnicas');

        // --- ✅ TÉCNICA DE CURACIÓN (RCT / d negativo) ---
        if (tech.d < 0) {
            const maxHp = gU.hpBase + (u.dedos * 100);
            const curacion = Math.ceil(Math.abs(tech.d) * gU.dmgM);
            u.hp = Math.min(maxHp, u.hp + curacion);
            u.en -= costoEnergia;
            const logRct = verificarLogros(u);
            guardarDatos();
            const embed = new EmbedBuilder()
                .setTitle(`💚 ${tech.n}`)
                .setDescription(
                    `**${u.n}** invirtió su Energía Maldita.\n` +
                    `💚 Curación: **+${curacion.toLocaleString()} HP**\n` +
                    `❤️ HP: **${Math.ceil(u.hp).toLocaleString()}/${maxHp.toLocaleString()}**\n` +
                    `⚡ Consumo: **${costoEnergia} EN**`
                )
                .setColor(0x00FF88);
            if (tech.gif) embed.setImage(tech.gif);
            await msg.reply({ embeds: [embed] });
            const extraRct = [misionTec, logRct ? `🏆 **LOGROS:**\n${logRct}` : ''].filter(Boolean).join('\n\n');
            if (extraRct) void msg.channel.send(extraRct);
            return;
        }

        // --- 🛡️ TÉCNICA DEFENSIVA/BUFF (sin objetivo) ---
        if (tech.def || tech.buff) {
            u.en -= costoEnergia;
            const logBuff = verificarLogros(u);
            guardarDatos();
            const color = tech.buff ? 0xFFD700 : 0x4169E1;
            const tipo = tech.buff ? '✨ PODER ACTIVADO' : '🛡️ DEFENSA ACTIVADA';
            const embed = new EmbedBuilder()
                .setTitle(`${tipo}: ${tech.n}`)
                .setDescription(
                    `**${u.n}** activó **${tech.n}**.\n` +
                    `⚡ Consumo: **${costoEnergia} EN**\n` +
                    `⚡ Energía restante: **${Math.floor(u.en)}**`
                )
                .setColor(color);
            if (tech.gif) embed.setImage(tech.gif);
            await msg.reply({ embeds: [embed] });
            const extraBuff = [misionTec, logBuff ? `🏆 **LOGROS:**\n${logBuff}` : ''].filter(Boolean).join('\n\n');
            if (extraBuff) void msg.channel.send(extraBuff);
            return;
        }

        // --- ⚔️ TÉCNICA DE ATAQUE ---
        const targetUser = msg.mentions.users.first();
        if (!targetUser) return void msg.reply("🎯 Menciona a tu oponente.");
        if (!db.has(targetUser.id)) db.set(targetUser.id, usuarioBase(targetUser.username));
        const v = db.get(targetUser.id)!;
        const gV = getGrado(v.xp);

        if (v.sellado && Date.now() < v.sellado) {
            return void msg.reply("🛡️ Ese usuario está dentro del Reino de Prisión.");
        }

        // --- CHOQUE DE DOMINIOS ---
        if (tech.dom) {
            const tiempoActual = Date.now();
            if (tiempoActual - v.lastDom < 10000) {
                const ganador = u.xp >= v.xp ? u : v;
                void msg.channel.send(`🌌 **¡CHOQUE DE DOMINIOS!** El dominio de **${ganador.n}** se sobrepone.`);
                if (ganador === v) {
                    u.en -= costoEnergia;
                    guardarDatos();
                    return void msg.reply(`🌌 Tu dominio fue neutralizado por **${v.n}**. Perdiste **${costoEnergia} EN**.`);
                }
            }
            u.lastDom = Date.now();
        }

        let danoFinal = tech.d * gU.dmgM * (1 + (u.dedos * 0.10));

        // --- BUFFS DE EQUIPAMIENTO ---
        if (equip) {
            if (u.equipado === 'Nube Itinerante') {
                const targetMember = msg.guild?.members.cache.get(targetUser.id);
                const esZenin = targetMember?.roles.cache.has(CLANES.ZENIN.id) ?? false;
                danoFinal *= esZenin ? (equip.dmgZeninBonus ?? 1) : (equip.dmgBonus ?? 1);
            }
            // Gafas de Maki: el dmgBossBonus solo aplica en !exorcizar, no en PvP
        }

        if (u.equipado === 'Brazo de Sukuna') danoFinal *= 3;

        // --- PACTO: daño compartido ---
        if (v.pactadoCon && db.has(v.pactadoCon)) {
            const pactadoU = db.get(v.pactadoCon)!;
            pactadoU.hp = Math.max(0, pactadoU.hp - Math.ceil(danoFinal / 2));
            db.set(v.pactadoCon, pactadoU);
        }

        v.hp -= Math.ceil(danoFinal);
        u.en -= costoEnergia;

        const maxHpV = gV.hpBase + (v.dedos * 100);
        let resCombate = "";
        if (v.hp <= 0) {
            v.hp = maxHpV;
            const premio = 25000 * gU.dmgM;
            u.y  += premio;
            u.xp += 5000;
            u.kills = (u.kills ?? 0) + 1;
            resCombate = `\n💀 **¡EXORCIZADO!** Premio: **$${premio.toLocaleString()}** | **+5000 XP**`;
            agregarHistorial(`⚔️ **${u.n}** derrotó a **${targetUser.username}**`);
        }

        if (u.dedos >= 20) {
            try { await msg.member.roles.add(ROL_REY_MALDICIONES); } catch { }
        }

        const misionKill = resCombate ? actualizarMision(u, 'kills') : null;
        const logAtaque  = verificarLogros(u);
        guardarDatos();

        const hpDefensor = Math.max(0, Math.ceil(v.hp));
        const bEmbed = new EmbedBuilder()
            .setTitle(tech.n)
            .setDescription(
                `**${u.n}** atacó a **${targetUser.username}**.\n` +
                `💥 Daño: **${Math.ceil(danoFinal).toLocaleString()}**\n` +
                `❤️ HP de ${targetUser.username}: **${hpDefensor.toLocaleString()}/${maxHpV.toLocaleString()}**\n` +
                `⚡ Consumo: **${costoEnergia} EN**${resCombate}`
            )
            .setColor(hpDefensor < maxHpV * 0.20 ? 0x000000 : 0xFF0000);

        if (tech.gif) bEmbed.setImage(tech.gif);
        if (costoMultiplicador < 1) bEmbed.setFooter({ text: "👁️ Seis Ojos activos." });

        await msg.reply({ embeds: [bEmbed] });
        const extraAtaque = [misionTec, misionKill, logAtaque ? `🏆 **LOGROS:**\n${logAtaque}` : ''].filter(Boolean).join('\n\n');
        if (extraAtaque) void msg.channel.send(extraAtaque);
        return;
    }
  } catch (e) {
    console.error("❌ Error no capturado en handler de mensajes:", e);
    try { await msg.reply("❌ Ocurrió un error interno. Inténtalo de nuevo."); } catch { }
  }
});

// ==========================================
// 🚀 CARGA DE DATOS AL INICIO (ANTES DE READY)
// ==========================================
cargarDatos();

// ==========================================
// ⏰ REGEN PASIVA (cada 60 segundos)
// ==========================================
setInterval(() => {
    db.forEach((u) => {
        const gU = getGrado(u.xp);
        const maxHp = gU.hpBase + (u.dedos * 100);
        const maxEn = gU.enBase + (u.dedos * 500);
        const regenEN = u.equipado === 'Brazo de Sukuna' ? 2 : 1;
        if (u.hp < maxHp) u.hp = Math.min(maxHp, u.hp + 10);
        if (u.en < maxEn) u.en = Math.min(maxEn, u.en + (5 * regenEN));
    });
    guardarDatos();
}, 60000);

// ==========================================
// 🚀 ARRANQUE — 🚫 DEFENSA DE SERVIDOR
// ==========================================
client.on(Events.GuildCreate, async (guild) => {
    if (guild.id !== GUILD_AUTORIZADO) {
        console.warn(`⚠️ Servidor no autorizado detectado: ${guild.name} (${guild.id}). Saliendo...`);
        await guild.leave();
    }
});

client.once('ready', (c) => {
    console.log("-----------------------------------------");
    console.log("🏯 SHINJUKU ETERNITY ENGINE v10.0: ONLINE");
    console.log(`🤖 Sesión iniciada como: ${c.user.tag}`);
    console.log("-----------------------------------------");

    // Salir de cualquier servidor no autorizado al arrancar
    for (const [id, guild] of c.guilds.cache) {
        if (id !== GUILD_AUTORIZADO) {
            console.warn(`⚠️ Saliendo del servidor no autorizado: ${guild.name} (${id})`);
            void guild.leave();
        }
    }

    // ⏰ SPAWN DE BOSSES (cada 30 minutos)
    setInterval(() => {
        if (!config.setupMaldiciones) return;
        const canal = client.channels.cache.get(config.setupMaldiciones);
        if (!canal || !(canal instanceof TextChannel)) return;

        if (bossesActivos.has(canal.id)) return;

        const boss = spawnBossAleatorio();
        bossesActivos.set(canal.id, { s: boss, hpActual: boss.hp });

        void canal.send({ embeds: [
            new EmbedBuilder()
                .setTitle(`🚨 ¡MALDICIÓN DETECTADA! — ${boss.n}`)
                .setDescription(
                    `❤️ **HP:** ${boss.hp.toLocaleString()}\n` +
                    `💴 **Recompensa:** $${boss.y.toLocaleString()}\n` +
                    `✨ **XP:** ${boss.xp.toLocaleString()}\n\n` +
                    `Usa \`!exorcizar\` para atacarla.`
                )
                .setColor(0xFF0000)
        ]});
    }, 30 * 60 * 1000);

    // ⏰ SPAWN DEL CALLEJÓN (cada 15 minutos)
    setInterval(() => {
        if (!config.setupCallejon) return;
        const canal = client.channels.cache.get(config.setupCallejon);
        if (!canal || !(canal instanceof TextChannel)) return;

        if (config.itemCallejonActual) return;

        const item = spawnItemCallejon();
        config.itemCallejonActual = item;
        config.itemCallejonExpira = Date.now() + 10 * 60 * 1000;
        guardarConfig();

        void canal.send({ embeds: [
            new EmbedBuilder()
                .setTitle("🎁 ¡OBJETO EN EL CALLEJÓN!")
                .setDescription(`Apareció **${item}** en el callejón.\nUsa \`!recoger\` para tomarlo.\n⏳ Desaparece en **10 minutos**.`)
                .setColor(0x9B59B6)
        ]});
    }, 15 * 60 * 1000);
});

// ==========================================
// 🛡️ DEFENSA ANTI-CRASH (Railway / producción)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error("⚠️ Promesa rechazada sin manejar:", reason);
    console.error("   En:", promise);
});

process.on('uncaughtException', (err) => {
    console.error("💥 Excepción no capturada:", err.message);
    console.error(err.stack);
});

client.on('error', (err) => {
    console.error("🔌 Error de cliente Discord:", err.message);
});

client.on('warn', (info) => {
    console.warn("⚠️ Advertencia Discord:", info);
});

client.login(process.env['DISCORD_TOKEN']).catch(err => {
    console.error("❌ ERROR AL INICIAR:", (err as Error).message);
});

// ==========================================
// 🌐 SERVIDOR DE SALUD (para Railway / Replit)
// ==========================================
const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 8080;
http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', bot: client.user?.tag ?? 'offline' }));
}).listen(PORT, () => {
    console.log(`🌐 Health server en puerto ${PORT}`);
});
