/**
 * 🏯 JUJUTSU KAISEN: SHINJUKU SHOWDOWN - ETERNITY ENGINE
 * @developer Orlas (José Orlando)
 * @version 9.0 - EXPANSIÓN DE CLANES
 * SISTEMAS INCLUIDOS:
 * - 120 Técnicas Totales (7 Clanes).
 * - Identificación por Roles Reales.
 * - Pasiva Seis Ojos (99% reducción EN).
 * - Choque de Dominios (Prioridad por XP).
 * - Tienda, Economía y Sistema de Dedos (1-20).
 * - Eventos de Bosses Aleatorios.
 * - Sistema Gokumonkyō 3 variantes (Pequeño/Estándar/Eterno).
 * - Spawn Autónomo (Maldiciones c/30min, Callejón c/15min).
 * - Sistema de Equipamiento con Buffs reales.
 * - Comandos de Dios (Admins).
 * - Mejoras God: !meditar, !pactar, Reliquia de Sukuna.
 */

require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// 💾 SISTEMA DE BASE DE DATOS LOCAL
// ==========================================
let db = new Map();
const DB_PATH = './shinjuku_data.json';
const CONFIG_PATH = './shinjuku_config.json';
let config = { setupMaldiciones: null, setupCallejon: null, itemCallejonActual: null, itemCallejonExpira: null };

const usuarioBase = (nombre) => ({
    n: nombre, hp: 200, en: 200, y: 5000, xp: 0, dedos: 0,
    inv: [], lastDom: 0, sellado: null, rolesSellado: [],
    equipado: null, meditarCooldown: 0, pactadoCon: null, tieneBrazo: false
});

const cargarDatos = () => {
    if (fs.existsSync(DB_PATH)) {
        try {
            db = new Map(Object.entries(JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))));
            console.log("✅ Datos cargados correctamente.");
        } catch (e) { console.error("Error leyendo BD."); }
    }
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
        } catch (e) { console.error("Error leyendo Config."); }
    }
};

const guardarDatos = () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(Object.fromEntries(db), null, 4));
};

const guardarConfig = () => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
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
};

const ROL_MIEMBRO         = "1482429543883997347";
const ROL_GOKUMONKYO      = "1482489278562045964";
const ROL_REY_MALDICIONES = "1482429120469139526";

const GRADOS = [
    { n: "Grado 4",        xp: 0,      dmgM: 1.0,  hpBase: 200,   enBase: 200   },
    { n: "Grado 3",        xp: 5000,   dmgM: 2.5,  hpBase: 600,   enBase: 700   },
    { n: "Grado 2",        xp: 20000,  dmgM: 6.0,  hpBase: 1500,  enBase: 1800  },
    { n: "Grado 1",        xp: 60000,  dmgM: 12.0, hpBase: 4000,  enBase: 5000  },
    { n: "Grado Especial", xp: 150000, dmgM: 30.0, hpBase: 12000, enBase: 15000 }
];

const getGrado = (xp) => GRADOS.slice().reverse().find(g => xp >= g.xp) || GRADOS[0];

// ==========================================
// ⚔️ DICCIONARIO: 120 TÉCNICAS (7 CLANES)
// ==========================================
const TECNICAS = {
    // --- LINAJE GOJO (20) ---
    '!azul':             { n: "Azul (Laplace)",          d: 150,  c: 100,  g: "Grado 3",        clan: CLANES.GOJO.id },
    '!rojo':             { n: "Rojo (Inversión)",         d: 350,  c: 250,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!purpura':          { n: "Púrpura Imaginario",       d: 1200, c: 900,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!vacio':            { n: "Vacío Infinito",           d: 6000, c: 5000, g: "Grado Especial",  clan: CLANES.GOJO.id, dom: true },
    '!infinito':         { n: "Mugen (Barrera)",          d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.GOJO.id, def: true },
    '!seisojos':         { n: "Despertar Seis Ojos",      d: 0,    c: 0,    g: "Grado Especial",  clan: CLANES.GOJO.id, buff: true },
    '!teleport':         { n: "Salto Espacial",           d: 50,   c: 80,   g: "Grado 3",        clan: CLANES.GOJO.id },
    '!rct_gojo':         { n: "Técnica Inversa",          d: -400, c: 800,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!vuelo':            { n: "Levitación",               d: 10,   c: 30,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!brillo':           { n: "Brillo Maldito",           d: 80,   c: 50,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!destello_gojo':    { n: "Kokusen",                  d: 600,  c: 400,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!laplace_max':      { n: "Azul Máximo",              d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!inversion_max':    { n: "Rojo Máximo",              d: 1000, c: 750,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!purpura_200':      { n: "Púrpura 200%",             d: 3000, c: 2500, g: "Grado Especial",  clan: CLANES.GOJO.id },
    '!barrera_simple':   { n: "Dominio Simple",           d: 0,    c: 150,  g: "Grado 3",        clan: CLANES.GOJO.id },
    '!caida':            { n: "Caída Libre",              d: 120,  c: 90,   g: "Grado 4",        clan: CLANES.GOJO.id },
    '!puño_gojo':        { n: "Puño con Infinito",        d: 300,  c: 150,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!aura_gojo':        { n: "Presencia Abrumadora",     d: 0,    c: 500,  g: "Grado 1",        clan: CLANES.GOJO.id },
    '!percepcion':       { n: "Lectura de Alma",          d: 0,    c: 100,  g: "Grado 2",        clan: CLANES.GOJO.id },
    '!infinito_exp':     { n: "Expansión de Mugen",       d: 0,    c: 1000, g: "Grado Especial",  clan: CLANES.GOJO.id },

    // --- CLAN SUKUNA (20) ---
    '!desmantelar':      { n: "Kai",                      d: 160,  c: 80,   g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!partir':           { n: "Hachi",                    d: 400,  c: 200,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!santuario':        { n: "Santuario Malévolo",       d: 6500, c: 4500, g: "Grado Especial",  clan: CLANES.SUKUNA.id, dom: true },
    '!fuga':             { n: "Abierto: Fuga",            d: 2000, c: 1200, g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!mahoraga':         { n: "Invocación: Mahoraga",     d: 1500, c: 2000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!corte_mundo':      { n: "Corte del Mundo",          d: 9999, c: 8000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!telaraña':         { n: "Escala de Araña",          d: 450,  c: 300,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!boxeo':            { n: "Taijutsu Heian",           d: 200,  c: 50,   g: "Grado 4",        clan: CLANES.SUKUNA.id },
    '!nue':              { n: "Nue (Quimera)",            d: 350,  c: 250,  g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!agito':            { n: "Bestia Agito",             d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!rct_sukuna':       { n: "Regeneración del Rey",     d: -500, c: 1000, g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!cleave_max':       { n: "Hachi Concentrado",        d: 900,  c: 500,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!escision':         { n: "Escisión",                 d: 250,  c: 150,  g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!flecha_fuego':     { n: "Lluvia de Fuego",          d: 1100, c: 800,  g: "Grado 1",        clan: CLANES.SUKUNA.id },
    '!corte_invisible':  { n: "Tajo Indetectable",        d: 600,  c: 400,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!adaptacion':       { n: "Giro de Rueda",            d: 0,    c: 1500, g: "Grado Especial",  clan: CLANES.SUKUNA.id, def: true },
    '!aura_rey':         { n: "Sed de Sangre",            d: 100,  c: 300,  g: "Grado 2",        clan: CLANES.SUKUNA.id },
    '!intimidacion':     { n: "Miedo Primordial",         d: 0,    c: 200,  g: "Grado 3",        clan: CLANES.SUKUNA.id },
    '!tajo_divino':      { n: "Corte a los Dioses",       d: 4000, c: 3000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },
    '!regen_absoluta':   { n: "Restauración de Alma",     d: -2000,c: 4000, g: "Grado Especial",  clan: CLANES.SUKUNA.id },

    // --- FAMILIA ZENIN (20) ---
    '!proyeccion':       { n: "Proyección 24 FPS",        d: 300,  c: 180,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!sombras_10':       { n: "Diez Sombras",             d: 450,  c: 350,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!toji_slash':       { n: "Tajo Físico",              d: 350,  c: 0,    g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!dominio_simple':   { n: "Dominio Simple",           d: 0,    c: 150,  g: "Grado 3",        clan: CLANES.ZENIN.id, def: true },
    '!sapo':             { n: "Invocación: Sapo",         d: 150,  c: 100,  g: "Grado 4",        clan: CLANES.ZENIN.id },
    '!lobo':             { n: "Perro Divino",             d: 250,  c: 150,  g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!nue_zenin':        { n: "Nue",                      d: 280,  c: 200,  g: "Grado 3",        clan: CLANES.ZENIN.id },
    '!serpiente':        { n: "Gran Serpiente",           d: 400,  c: 250,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!elefante':         { n: "Elefante Máximo",          d: 600,  c: 400,  g: "Grado 1",        clan: CLANES.ZENIN.id },
    '!conejo':           { n: "Escape de Conejos",        d: 50,   c: 100,  g: "Grado 4",        clan: CLANES.ZENIN.id, def: true },
    '!mahoraga_zenin':   { n: "General Divino",           d: 1500, c: 2000, g: "Grado Especial",  clan: CLANES.ZENIN.id },
    '!espada_zenin':     { n: "Katana Maldita",           d: 200,  c: 50,   g: "Grado 4",        clan: CLANES.ZENIN.id },
    '!nube':             { n: "Nube Itinerante",          d: 800,  c: 0,    g: "Grado 1",        clan: CLANES.ZENIN.id },
    '!lanza':            { n: "Lanza del Cielo",          d: 1200, c: 0,    g: "Grado Especial",  clan: CLANES.ZENIN.id },
    '!cadena':           { n: "Cadena de Mil Millas",     d: 500,  c: 0,    g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!percepcion_toji':  { n: "Sentidos Agudizados",      d: 0,    c: 0,    g: "Grado Especial",  clan: CLANES.ZENIN.id, buff: true },
    '!corte_rapido':     { n: "Iaijutsu",                 d: 350,  c: 100,  g: "Grado 2",        clan: CLANES.ZENIN.id },
    '!barrera_zenin':    { n: "Arte Secreto",             d: 0,    c: 300,  g: "Grado 1",        clan: CLANES.ZENIN.id, def: true },
    '!taijutsu_zenin':   { n: "Artes Marciales",          d: 180,  c: 0,    g: "Grado 4",        clan: CLANES.ZENIN.id },
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
    '!armadura':         { n: "Corteza de Hanami",        d: 0,    c: 400,  g: "Grado 2",        clan: CLANES.MALDICION.id, def: true },
    '!regen_maldita':    { n: "Curación de Maldición",   d: -400, c: 300,  g: "Grado 2",        clan: CLANES.MALDICION.id },
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
    '!detente':          { n: "¡Alto!",                   d: 0,    c: 180,  g: "Grado 3",        clan: CLANES.INUMAKI.id, def: true },
    '!dormir':           { n: "¡Duerme!",                 d: 100,  c: 200,  g: "Grado 3",        clan: CLANES.INUMAKI.id },
    '!explotar_voz':     { n: "¡Explota!",                d: 600,  c: 400,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!encogete':         { n: "¡Enógete!",                d: 400,  c: 300,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!aplastado':        { n: "¡Aplástate!",              d: 800,  c: 600,  g: "Grado 1",        clan: CLANES.INUMAKI.id },
    '!voz_maldita':      { n: "Onda de Voz Maldita",      d: 350,  c: 250,  g: "Grado 2",        clan: CLANES.INUMAKI.id },
    '!grito_inumaki':    { n: "Grito Inumaki",            d: 1300, c: 1000, g: "Grado 1",        clan: CLANES.INUMAKI.id },
    '!morir':            { n: "¡Muere!",                  d: 4500, c: 3500, g: "Grado Especial",  clan: CLANES.INUMAKI.id },
    '!dominio_inumaki':  { n: "Eco del Alma",             d: 5200, c: 4200, g: "Grado Especial",  clan: CLANES.INUMAKI.id, dom: true }
};

// ==========================================
// 🛒 TIENDA Y ARTÍCULOS
// ==========================================
const TIENDA = {
    'dedo':                { n: "Dedo de Sukuna",           precio: 100000, desc: "+500 EN y +10% Daño permanentemente." },
    'gokumonkyo_pequeño':  { n: "Gokumonkyō (Pequeño)",    precio: 50000,  desc: "Sella a un usuario por 10 minutos.", duracion: 10 * 60 * 1000 },
    'gokumonkyo_estandar': { n: "Gokumonkyō (Estándar)",   precio: 120000, desc: "Sella a un usuario por 30 minutos.", duracion: 30 * 60 * 1000 },
    'gokumonkyo_eterno':   { n: "Gokumonkyō (Eterno)",     precio: 250000, desc: "Sella a un usuario por 1 hora.",     duracion: 60 * 60 * 1000 }
};

// ==========================================
// 🎒 EQUIPAMIENTO Y EFECTOS
// ==========================================
const EQUIPAMIENTO = {
    'Gafas de Maki':    { desc: "Atacar sin clan. +20% daño a Bosses.",         sinClan: true,  dmgBossBonus: 1.20 },
    'Nube Itinerante':  { desc: "+50% daño general (+75% contra Zenin).",       dmgBonus: 1.50, dmgZeninBonus: 1.75 },
    'Lanza Invertida':  { desc: "El daño ignora la defensa del enemigo.",       ignoraDef: true },
    'Brazo de Sukuna':  { desc: "Regeneración de Energía Maldita x2/minuto.",  regenX2: true }
};

// ==========================================
// 👾 SPAWN DE BOSSES (aleatorio en mensajes)
// ==========================================
const SPAWNS = [
    { n: "Maldición de Grado 4",        hp: 300,   y: 2000,    xp: 200,    prob: 0.10  },
    { n: "Maldición de Grado 1",        hp: 5000,  y: 30000,   xp: 4000,   prob: 0.04  },
    { n: "BOSS: Toji Fushiguro",        hp: 20000, y: 200000,  xp: 25000,  prob: 0.01  },
    { n: "BOSS: Rey de las Maldiciones",hp: 80000, y: 1000000, xp: 100000, prob: 0.002 }
];

// ==========================================
// 🎁 ITEMS DEL CALLEJÓN
// ==========================================
const ITEMS_CALLEJON = {
    comun:    ["Katana Maldita", "Sello Explosivo", "Poción de Energía"],
    raro:     ["Gafas de Maki", "Nube Itinerante", "Lanza Invertida"],
    especial: ["Gokumonkyō (Pequeño)", "Gokumonkyō (Estándar)", "Gokumonkyō (Eterno)", "Brazo de Sukuna"]
};

// ==========================================
// ⚙️ MOTOR DE EVENTOS
// ==========================================
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;

    if (!db.has(uid)) {
        db.set(uid, usuarioBase(msg.author.username));
    }
    const u = db.get(uid);
    const gU = getGrado(u.xp);

    // --- 👁️ LÓGICA DE SEIS OJOS ---
    let costoMultiplicador = 1.0;
    if (msg.member.roles.cache.has(CLANES.GOJO.id) && gU.n === "Grado Especial") {
        costoMultiplicador = 0.01;
    }

    // --- 👾 SPAWN ALEATORIO ---
    SPAWNS.forEach(s => {
        if (Math.random() < s.prob) {
            msg.channel.send({ embeds: [
                new EmbedBuilder()
                    .setTitle(`🚨 ALERTA: ${s.n}`)
                    .setDescription(`❤️ HP: ${s.hp} | 💴 Yenes: $${s.y.toLocaleString()}\nUsa \`!exorcizar\` en este canal.`)
                    .setColor(0x000000)
            ]});
        }
    });

    if (!msg.content.startsWith('!')) return;
    const args = msg.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ==========================================
    // 📋 PERFIL
    // ==========================================
    if (cmd === 'perfil') {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Hechicero: ${u.n}`, iconURL: msg.author.displayAvatarURL() })
            .addFields(
                { name: '🎖️ Grado',    value: gU.n,                                              inline: true },
                { name: '💴 Yenes',    value: `$${u.y.toLocaleString()}`,                        inline: true },
                { name: '✨ XP',       value: `${u.xp.toLocaleString()}`,                        inline: true },
                { name: '❤️ HP',       value: `${Math.floor(u.hp)}/${gU.hpBase+(u.dedos*100)}`, inline: true },
                { name: '⚡ Energía',  value: `${Math.floor(u.en)}/${gU.enBase+(u.dedos*500)}`, inline: true },
                { name: '☝️ Dedos',    value: `${u.dedos}/20`,                                   inline: true },
                { name: '🎒 Equipado', value: u.equipado || 'Ninguno',                           inline: true },
                { name: '⛓️ Estado',   value: (u.sellado && Date.now() < u.sellado) ? '🔒 Sellado' : '✅ Libre', inline: true }
            )
            .setColor(gU.n === "Grado Especial" ? 0xFFD700 : 0xFFFFFF);
        return msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🛒 TIENDA
    // ==========================================
    if (cmd === 'tienda') {
        const embed = new EmbedBuilder()
            .setTitle("🛒 TIENDA DEL MERCADO MALDITO")
            .setDescription("Usa `!comer_dedo` para comprar Dedos de Sukuna.\nUsa `!comprar [item]` para el resto.")
            .addFields(
                { name: "☝️ Dedo de Sukuna — $100,000",         value: "```+500 EN y +10% Daño permanentemente```",  inline: false },
                { name: "⛓️ Gokumonkyō (Pequeño) — $50,000",    value: "```Sella a un usuario por 10 minutos```",    inline: false },
                { name: "⛓️ Gokumonkyō (Estándar) — $120,000",  value: "```Sella a un usuario por 30 minutos```",   inline: false },
                { name: "⛓️ Gokumonkyō (Eterno) — $250,000",    value: "```Sella a un usuario por 1 hora```",       inline: false },
                { name: "🎲 Reroll de Clan — $150,000",          value: "```Usa !comprar_reroll para cambiar clan```",inline: false }
            )
            .setColor(0x2C2F33)
            .setFooter({ text: `Tu saldo: $${u.y.toLocaleString()} Yenes` });
        return msg.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🛍️ COMPRAR ITEM
    // ==========================================
    if (cmd === 'comprar') {
        const itemKey = args.join('_').toLowerCase();
        const item = TIENDA[itemKey];
        if (!item) return msg.reply("❌ Item no encontrado. Usa `!tienda` para ver los disponibles.");
        if (itemKey === 'dedo') return msg.reply("☝️ Para comprar dedos usa `!comer_dedo`.");
        if (u.y < item.precio) return msg.reply(`❌ Necesitas **$${item.precio.toLocaleString()} Yenes**. Tienes $${u.y.toLocaleString()}.`);
        u.y -= item.precio;
        u.inv.push(item.n);
        guardarDatos();
        return msg.reply(`✅ Compraste **${item.n}**. Añadido a tu inventario.\n💴 Saldo restante: $${u.y.toLocaleString()}`);
    }

    // ==========================================
    // ⛓️ USAR SELLO (Gokumonkyō)
    // ==========================================
    if (cmd === 'usar_sello') {
        const variante = args[0]?.toLowerCase();
        const variantesMap = {
            'pequeño':  'gokumonkyo_pequeño',
            'estandar': 'gokumonkyo_estandar',
            'eterno':   'gokumonkyo_eterno'
        };
        const itemKey = variantesMap[variante];
        if (!itemKey) return msg.reply("❌ Variantes disponibles: `pequeño`, `estandar`, `eterno`.");

        const item = TIENDA[itemKey];
        if (!u.inv.includes(item.n)) return msg.reply(`❌ No tienes **${item.n}** en tu inventario.`);

        const target = msg.mentions.members.first();
        if (!target) return msg.reply("🎯 Menciona al usuario que deseas sellar.");

        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.user.username));
        const vU = db.get(target.id);

        if (vU.sellado && Date.now() < vU.sellado) return msg.reply("⚠️ Ese usuario ya está dentro del Reino de Prisión.");

        const rolesSalvados = [];
        if (target.roles.cache.has(ROL_MIEMBRO)) rolesSalvados.push(ROL_MIEMBRO);
        Object.values(CLANES).forEach(c => {
            if (target.roles.cache.has(c.id)) rolesSalvados.push(c.id);
        });

        try {
            const rolesAQuitar = [ROL_MIEMBRO, ...Object.values(CLANES).map(c => c.id)]
                .filter(r => target.roles.cache.has(r));
            if (rolesAQuitar.length > 0) await target.roles.remove(rolesAQuitar);
            await target.roles.add(ROL_GOKUMONKYO);
        } catch (e) {
            return msg.reply("❌ No tengo permisos suficientes para gestionar roles.");
        }

        vU.sellado = Date.now() + item.duracion;
        vU.rolesSellado = rolesSalvados;
        db.set(target.id, vU);
        u.inv = u.inv.filter(i => i !== item.n);
        guardarDatos();

        const durTexto = variante === 'pequeño' ? '10 minutos' : variante === 'estandar' ? '30 minutos' : '1 hora';
        msg.channel.send({ embeds: [
            new EmbedBuilder()
                .setTitle("⛓️ REINO DE PRISIÓN ACTIVADO")
                .setDescription(`**${target.user.username}** ha sido sellado dentro del Gokumonkyō.\n⏳ Duración: **${durTexto}**\nSus poderes y accesos han sido suspendidos.`)
                .setColor(0x4B0082)
        ]});

        setTimeout(async () => {
            try {
                if (target.roles.cache.has(ROL_GOKUMONKYO)) await target.roles.remove(ROL_GOKUMONKYO);
                if (vU.rolesSellado.length > 0) await target.roles.add(vU.rolesSellado);
                vU.sellado = null;
                vU.rolesSellado = [];
                db.set(target.id, vU);
                guardarDatos();
                msg.channel.send(`🔓 El sello sobre **${target.user.username}** ha expirado. Sus poderes han sido restaurados.`);
            } catch (e) { console.error("Error restaurando roles:", e); }
        }, item.duracion);

        return;
    }

    // ==========================================
    // 🎒 EQUIPAR
    // ==========================================
    if (cmd === 'equipar') {
        const nombreItem = args.join(' ');
        if (!u.inv.includes(nombreItem)) return msg.reply(`❌ No tienes **${nombreItem}** en tu inventario.`);
        if (!EQUIPAMIENTO[nombreItem]) return msg.reply("❌ Ese objeto no es equipable directamente.");
        u.equipado = nombreItem;
        guardarDatos();
        return msg.reply(`✅ Has equipado **${nombreItem}**.\n📋 Efecto: ${EQUIPAMIENTO[nombreItem].desc}`);
    }

    // ==========================================
    // 🛒 RECOGER ITEM DEL CALLEJÓN
    // ==========================================
    if (cmd === 'recoger') {
        if (!config.itemCallejonActual) return msg.reply("🕳️ No hay ningún objeto disponible en el callejón ahora mismo.");
        if (Date.now() > config.itemCallejonExpira) {
            config.itemCallejonActual = null;
            config.itemCallejonExpira = null;
            guardarConfig();
            return msg.reply("⌛ El objeto ya expiró. Espera el próximo spawn.");
        }
        const itemRecogido = config.itemCallejonActual;
        u.inv.push(itemRecogido);
        if (itemRecogido === "Brazo de Sukuna") u.tieneBrazo = true;
        config.itemCallejonActual = null;
        config.itemCallejonExpira = null;
        guardarConfig();
        guardarDatos();
        return msg.reply(`🎁 ¡Recogiste **${itemRecogido}**! Fue añadido a tu inventario.`);
    }

    // ==========================================
    // 🧘 MEDITAR
    // ==========================================
    if (cmd === 'meditar') {
        const cooldown = 2 * 60 * 60 * 1000;
        const tiempoEspera = cooldown - (Date.now() - (u.meditarCooldown || 0));
        if (tiempoEspera > 0) {
            const restante = Math.ceil(tiempoEspera / 60000);
            return msg.reply(`⏳ Debes esperar **${restante} minuto(s)** para meditar de nuevo.`);
        }
        const maxEn = gU.enBase + (u.dedos * 500);
        u.en = Math.min(maxEn, u.en + 100);
        u.meditarCooldown = Date.now();
        guardarDatos();
        return msg.reply(`🧘 Has meditado en silencio. Recuperaste **+100 de Energía Maldita**.`);
    }

    // ==========================================
    // 🤝 PACTAR
    // ==========================================
    if (cmd === 'pactar') {
        const target = msg.mentions.users.first();
        if (!target) return msg.reply("🎯 Menciona al usuario con quien deseas pactar.");
        if (target.id === uid) return msg.reply("❌ No puedes pactarte contigo mismo.");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id);
        u.pactadoCon = target.id;
        vU.pactadoCon = uid;
        db.set(target.id, vU);
        guardarDatos();
        return msg.reply(`🤝 Pacto establecido con **${target.username}**. Sus HP se combinarán en la próxima batalla.`);
    }

    // ==========================================
    // 🎲 COMPRAR REROLL DE CLAN
    // ==========================================
    if (cmd === 'comprar_reroll') {
        const costo = 150000;
        if (u.y < costo) return msg.reply(`❌ Necesitas **$${costo.toLocaleString()} Yenes** para el reroll.`);
        const clanesIds = Object.values(CLANES).map(c => c.id);
        const clanActual = clanesIds.find(id => msg.member.roles.cache.has(id));
        try {
            if (clanActual) await msg.member.roles.remove(clanActual);
            const nuevoClanId = clanesIds[Math.floor(Math.random() * clanesIds.length)];
            await msg.member.roles.add(nuevoClanId);
            u.y -= costo;
            guardarDatos();
            const nuevoClan = Object.values(CLANES).find(c => c.id === nuevoClanId);
            return msg.reply(`🎲 Tu linaje ha cambiado.\nNuevo clan: **${nuevoClan.n}** ${nuevoClan.emoji}`);
        } catch (e) {
            return msg.reply("❌ No tengo permisos para gestionar roles.");
        }
    }

    // ==========================================
    // 🛠️ COMANDOS DE DIOS (ADMINISTRADORES)
    // ==========================================
    const esAdmin = msg.member.permissions.has('Administrator');

    if (cmd === 'setup_maldiciones') {
        if (!esAdmin) return msg.reply("❌ Solo administradores.");
        config.setupMaldiciones = msg.channel.id;
        guardarConfig();
        return msg.reply(`✅ Canal de spawn de maldiciones: <#${msg.channel.id}>`);
    }

    if (cmd === 'setup_callejon') {
        if (!esAdmin) return msg.reply("❌ Solo administradores.");
        config.setupCallejon = msg.channel.id;
        guardarConfig();
        return msg.reply(`✅ Canal del callejón configurado: <#${msg.channel.id}>`);
    }

    if (cmd === 'quitar_objeto') {
        if (!esAdmin) return msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        if (!target) return msg.reply("Uso: `!quitar_objeto @usuario [nombre del objeto]`");
        const nombreItem = args.slice(1).join(' ');
        if (!db.has(target.id)) return msg.reply("Usuario no encontrado en la base de datos.");
        const vU = db.get(target.id);
        if (!vU.inv.includes(nombreItem)) return msg.reply(`❌ **${target.username}** no tiene **${nombreItem}**.`);
        vU.inv = vU.inv.filter(i => i !== nombreItem);
        db.set(target.id, vU);
        guardarDatos();
        return msg.reply(`✅ Se eliminó **${nombreItem}** del inventario de **${target.username}**.`);
    }

    if (cmd === 'add_yenes') {
        if (!esAdmin) return msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1]);
        if (!target || isNaN(cantidad)) return msg.reply("Uso: `!add_yenes @usuario [cantidad]`");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id);
        vU.y += cantidad;
        db.set(target.id, vU);
        guardarDatos();
        return msg.reply(`✅ Se añadieron **$${cantidad.toLocaleString()}** a **${target.username}**.`);
    }

    if (cmd === 'add_xp') {
        if (!esAdmin) return msg.reply("❌ Solo administradores.");
        const target = msg.mentions.users.first();
        const cantidad = parseInt(args[1]);
        if (!target || isNaN(cantidad)) return msg.reply("Uso: `!add_xp @usuario [cantidad]`");
        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const vU = db.get(target.id);
        vU.xp += cantidad;
        db.set(target.id, vU);
        guardarDatos();
        return msg.reply(`✅ Se añadieron **${cantidad.toLocaleString()} XP** a **${target.username}**.`);
    }

    // ==========================================
    // ⚔️ MOTOR DE COMBATE CENTRAL
    // ==========================================
    const tech = TECNICAS[`!${cmd}`];
    if (tech) {

        if (u.sellado && Date.now() < u.sellado) {
            return msg.reply("⛓️ Estás sellado. No puedes usar técnicas hasta que el Velo se levante.");
        }

        const equip = u.equipado ? EQUIPAMIENTO[u.equipado] : null;

        if (tech.clan && !msg.member.roles.cache.has(tech.clan) && !equip?.sinClan) {
            return msg.reply("❌ Tu linaje no permite usar esta técnica.");
        }

        const reqGrado = GRADOS.find(g => g.n === tech.g);
        if (u.xp < reqGrado.xp) return msg.reply(`❌ Requieres el rango de **${tech.g}**.`);

        const target = msg.mentions.users.first();
        if (!target) return msg.reply("🎯 Menciona a tu oponente.");

        if (!db.has(target.id)) db.set(target.id, usuarioBase(target.username));
        const v = db.get(target.id);
        const gV = getGrado(v.xp);

        if (v.sellado && Date.now() < v.sellado) {
            return msg.reply("🛡️ No puedes atacar a este usuario, está dentro del Reino de Prisión.");
        }

        let costoEnergia = Math.ceil(tech.c * costoMultiplicador);
        if (u.en < costoEnergia) return msg.reply("🪫 Te has quedado sin Energía Maldita.");

        // --- CHOQUE DE DOMINIOS ---
        if (tech.dom) {
            const tiempoActual = Date.now();
            if (tiempoActual - v.lastDom < 10000) {
                const ganador = u.xp >= v.xp ? u : v;
                msg.channel.send(`🌌 **¡CHOQUE DE DOMINIOS!**\nLos dominios colapsan. El dominio de **${ganador.n}** se sobrepone gracias a su refinamiento (XP superior).`);
                if (ganador === v) {
                    u.en -= costoEnergia;
                    guardarDatos();
                    return;
                }
            }
            u.lastDom = Date.now();
        }

        let danoFinal = tech.d * gU.dmgM * (1 + (u.dedos * 0.10));

        // --- BUFFS DE EQUIPAMIENTO ---
        if (equip) {
            if (u.equipado === 'Nube Itinerante') {
                const targetMember = msg.guild.members.cache.get(target.id);
                const esZenin = targetMember?.roles.cache.has(CLANES.ZENIN.id);
                danoFinal *= esZenin ? equip.dmgZeninBonus : equip.dmgBonus;
            }
            if (u.equipado === 'Gafas de Maki') {
                danoFinal *= equip.dmgBossBonus;
            }
        }

        // --- BRAZO DE SUKUNA: daño x3 ---
        if (u.tieneBrazo) {
            danoFinal *= 3;
        }

        // --- PACTO: daño compartido al aliado del objetivo ---
        if (v.pactadoCon && db.has(v.pactadoCon)) {
            const pactadoU = db.get(v.pactadoCon);
            pactadoU.hp -= Math.ceil(danoFinal / 2);
            db.set(v.pactadoCon, pactadoU);
        }

        v.hp -= Math.ceil(danoFinal);
        u.en -= costoEnergia;

        let resCombate = "";
        if (v.hp <= 0) {
            v.hp = gV.hpBase + (v.dedos * 100);
            let premio = 25000 * gU.dmgM;
            u.y += premio;
            u.xp += 5000;
            resCombate = `\n💀 **¡EXORCIZADO!**\nPremio: **$${premio.toLocaleString()}** | **+5000 XP**`;
        }

        if (u.dedos >= 20) {
            try { await msg.member.roles.add(ROL_REY_MALDICIONES); } catch (e) {}
        }

        guardarDatos();

        const bEmbed = new EmbedBuilder()
            .setTitle(tech.n)
            .setDescription(`**${u.n}** atacó a **${target.username}**.\n💥 Daño: **${Math.ceil(danoFinal).toLocaleString()}**\n⚡ Consumo: **${costoEnergia} EN**${resCombate}`)
            .setColor(v.hp < 100 ? 0x000000 : 0xFF0000);

        if (tech.gif) bEmbed.setImage(tech.gif);
        if (costoMultiplicador < 1) bEmbed.setFooter({ text: "👁️ Seis Ojos: Reducción masiva de coste activada." });

        return msg.reply({ embeds: [bEmbed] });
    }

    // ==========================================
    // 🤚 COMER DEDO 
    // ==========================================
        if (cmd === 'comer_dedo') {
            const precioDedo = 100000;
            if (u.y < precioDedo) return msg.reply(`❌ Cuesta $${precioDedo.toLocaleString()} Yenes.`);
            if (u.dedos >= 20) return msg.reply("⚠️ Has alcanzado el límite de 20 recipientes.");

            u.y -= precioDedo;
            u.dedos++;
            u.xp += 15000;

            if (u.dedos >= 20) {
                let mensajeSukuna = `👑 **¡20 DEDOS ACUMULADOS!** **${u.n}** ha reunido los 20 dedos de Sukuna.`;
                if (u.tieneBrazo) mensajeSukuna = `👑 **¡RELIQUIA DE SUKUNA COMPLETA!** **${u.n}** ha reunido los 20 dedos, ¡el daño se multiplica x3!`;

                msg.channel.send(mensajeSukuna);
                try { await msg.member.roles.add(ROL_REY_MALDICIONES); } catch (e) { console.error("Error rol:", e); }
            }

            guardarDatos();
            return msg.reply(`☝️ Asimilaste el dedo **${u.dedos}/20**. Tus estadísticas aumentan permanentemente.`);
        }
    }); // <--- ESTE CIERRE TERMINA EL EVENTO DE MENSAJES

    // ==========================================
    // ⏰ SISTEMAS PASIVOS Y ARRANQUE
    // ==========================================

    setInterval(() => {
        db.forEach((u) => {
            const gU = getGrado(u.xp);
            const maxHp = gU.hpBase + (u.dedos * 100);
            const maxEn = gU.enBase + (u.dedos * 500);
            const regenEN = u.tieneBrazo ? 2 : 1;
            if (u.hp < maxHp) u.hp = Math.min(maxHp, u.hp + 10);
            if (u.en < maxEn) u.en = Math.min(maxEn, u.en + (5 * regenEN));
        });
        guardarDatos();
    }, 60000);

    client.once('ready', (c) => {
        cargarDatos();
        console.log("-----------------------------------------");
        console.log("🏯 SHINJUKU ETERNITY ENGINE: ONLINE");
        console.log(`🤖 Sesión iniciada como: ${c.user.tag}`);
        console.log("-----------------------------------------");
    });

    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error("❌ ERROR AL INICIAR:", err.message);
    });