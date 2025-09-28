const HBInit = require("haxball-headless");

// === BLOQUE 0: CONFIGURACIÓN INICIAL ===
const NombreHost = "🏆OFIS AFAHAX 🏆"; 
const Contraseña = "ofi12hax";
const ClaveParaSerAdmin = "ArseIndep";
const MensajeDeBienvenida = "👋 Bienvenido a AFAHAX";
const ColorMensaje = "FFD700";

const room = HBInit({
  roomName: NombreHost,
  maxPlayers: 30,
  public: true,
  password: Contraseña
});

room.setDefaultStadium("Classic");
room.setScoreLimit(3);
room.setTimeLimit(5);

// Wrapper onPlayerJoin
const onJoin0 = room.onPlayerJoin;
room.onPlayerJoin = function(player) {
  if (onJoin0) onJoin0(player);
  room.sendAnnouncement(MensajeDeBienvenida, player.id, parseInt(ColorMensaje, 16), "bold");
};
// fin de bloque (0)


// === BLOQUE 1: ADMINISTRACIÓN Y CHAT CENTRAL ===
let mainAdmin = null;
let auxAdmins = [];
let auxKey = null;
let auxKeyUsed = false;
let auxKeyExpireTimeout = null;

const adminPassword = ClaveParaSerAdmin;

const chatColors = {
  mainAdmin: 0xFFD700,
  auxAdmin: 0x87CEFA,
  player: 0xDDDDDD
};

// Anti-spam
let messageTimestamps = {};
const SPAM_LIMIT = 5;
const KICK_THRESHOLD = 3;
let spamWarnings = {};

// 🔐 Claves auxiliares
function generarClaveAleatoria() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function enviarClaveADiscord(clave) {
  const webhook = "https://discord.com/api/webhooks/1419530158225887374/HaZL59fUpQnpLzjPMcbC1V3IQRXtzSNGGBUzSwkLgsjXIW2VvV_6dDNIIw1lpcMffKDN";
  const payload = { content: `🔐 Nueva clave auxiliar generada: \`${clave}\`` };
  fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

function generarYEnviarNuevaClave() {
  auxKey = generarClaveAleatoria();
  auxKeyUsed = false;
  if (auxKeyExpireTimeout) clearTimeout(auxKeyExpireTimeout);
  enviarClaveADiscord(auxKey);
}
generarYEnviarNuevaClave();

// Helpers permisos
function esMainAdmin(player) {
  return mainAdmin && player.name === mainAdmin;
}
function esAuxAdmin(player) {
  return auxAdmins.includes(player.id);
}
function esAdmin(player) {
  return esMainAdmin(player) || esAuxAdmin(player);
}

// Login
function manejarLogin(player, message) {
  if (!message.toLowerCase().startsWith("!login ")) return false;
  const claveIngresada = message.split(" ")[1];

  if (claveIngresada === adminPassword) {
    room.setPlayerAdmin(player.id, true);
    mainAdmin = player.name;
    room.sendAnnouncement("✅ Admin principal activado.", player.id, chatColors.mainAdmin, "bold");
    return true;
  }

  if (claveIngresada === auxKey && !auxKeyUsed) {
    room.setPlayerAdmin(player.id, true);
    auxAdmins.push(player.id);
    auxKeyUsed = true;
    generarYEnviarNuevaClave();

    auxKeyExpireTimeout = setTimeout(() => {
      auxAdmins = auxAdmins.filter(id => id !== player.id);
      room.setPlayerAdmin(player.id, false);
    }, 10 * 60 * 1000);

    room.sendAnnouncement("✅ Admin auxiliar activado (10 min).", player.id, chatColors.auxAdmin, "bold");
    return true;
  }

  room.sendAnnouncement("❌ Clave incorrecta.", player.id, 0xFF0000, "bold");
  return true;
}

// Anti-spam
function manejarSpam(player, msg) {
  const now = Date.now();
  if (!messageTimestamps[player.id]) messageTimestamps[player.id] = [];
  messageTimestamps[player.id].push(now);

  messageTimestamps[player.id] = messageTimestamps[player.id].filter(ts => now - ts < 5000);

  if (messageTimestamps[player.id].length > SPAM_LIMIT) {
    spamWarnings[player.id] = (spamWarnings[player.id] || 0) + 1;
    if (spamWarnings[player.id] >= KICK_THRESHOLD) {
      room.kickPlayer(player.id, "Exceso de spam", false);
      spamWarnings[player.id] = 0;
      return true;
    } else {
      room.sendAnnouncement(`⚠️ Advertencia ${spamWarnings[player.id]}/${KICK_THRESHOLD}`, player.id, 0xFFA500);
      return true;
    }
  }
  return false;
}

// Chat central
const prevChat1 = room.onPlayerChat;
room.onPlayerChat = function(player, message) {
  if (!message.trim()) return false;

  if (manejarLogin(player, message)) return false;
  if (manejarSpam(player, message)) return false;

  const msg = message.toLowerCase().trim();

  // Bloque 2: camisetas
  if (typeof manejarSetCamis === "function" && manejarSetCamis(player, msg)) return false;
  if (typeof manejarSwapCamis === "function" && manejarSwapCamis(player, msg)) return false;

  // Bloque 3: grabaciones
  if (typeof manejarCortarRec === "function" && manejarCortarRec(player, msg)) return false;
  if (typeof manejarRecofis === "function" && manejarRecofis(player, msg)) return false;
  if (typeof manejarCancelarReco === "function" && manejarCancelarReco(player, msg)) return false;
  if (typeof manejarListaRec === "function" && manejarListaRec(player, msg)) return false;
  if (typeof manejarBorrarRec === "function" && manejarBorrarRec(player, msg)) return false;

  // Bloque 4: goles
  if (typeof manejarGA === "function" && manejarGA(player, msg)) return false;
  if (typeof manejarGC === "function" && manejarGC(player, msg)) return false;

  // Mensaje normal
  let color = chatColors.player;
  if (esMainAdmin(player)) color = chatColors.mainAdmin;
  else if (esAuxAdmin(player)) color = chatColors.auxAdmin;

  room.sendAnnouncement(`💬 ${player.name}: ${message}`, null, color);
  return false;
};
// fin de bloque (1)


// === BLOQUE 2: CAMISETAS (con permisos) ===
function hexToInt(h) {
  try { return parseInt(h.replace(/^#/, ''), 16); }
  catch (e) { return 0; }
}

// Base de camisetas (ejemplo resumido)
const camisetas = {
  "t21c": {
    local: {
      name: "The 21 Club",
      angle: 90, textColor: "FFFFFF",
      layers: ["191919","212121","292929"],
      cmdRed: "/colors red 90 FFFFFF 191919 212121 292929",
      cmdBlue:"/colors blue 90 FFFFFF 191919 212121 292929"
    },
    visitante: {
      name: "The 21 Club",
      angle: 90, textColor: "FFFFFF",
      layers: ["191919","212121","292929"],
      cmdRed: "/colors red 90 FFFFFF 191919 212121 292929",
      cmdBlue:"/colors blue 90 FFFFFF 191919 212121 292929"
    }
  },

  "nch": {
    local: {
      name: "Nueva Chicago",
      angle: 0, textColor: "FFFFFF",
      layers: ["000000","145400","000000"],
      cmdRed: "/colors red 00 FFFFFF 000000 145400 000000",
      cmdBlue:"/colors blue 00 FFFFFF 000000 145400 000000"
    },
    visitante: {
      name: "Nueva Chicago",
      angle: 60, textColor: "0E3300",
      layers: ["FFFFFF","F2F2F2","DEDEDE"],
      cmdRed: "/colors red 60 0E3300 FFFFFF F2F2F2 DEDEDE",
      cmdBlue:"/colors blue 60 0E3300 FFFFFF F2F2F2 DEDEDE"
    }
  },

"cat": {
    local: {
      name: "Club Atletico Tarzanito",
      angle: 180, textColor: "7FCFFF",
      layers: ["44708A","558BAB","44708A"],
      cmdRed: "/colors red 180 7FCFFF 44708A 558BAB 44708A",
      cmdBlue:"/colors blue 180 7FCFFF 44708A 558BAB 44708A"
    },
    visitante: {
      name: "Club Atletico Tarzanito",
      angle: 60, textColor: "19D9FF",
      layers: ["FFFFFF"],
      cmdRed: "/colors red 180 19D9FF FFFFFF",
      cmdBlue:"/colors blue 180 19D9FF FFFFFF"
    }
  },

  "ubers": {
    local: {
      name: "Ubers",
      angle: 0, textColor: "ADAD2B",
      layers: ["FFFFFF","000000","FFFFFF"],
      cmdRed: "/colors red 0 ADAD2B FFFFFF 000000 FFFFFF",
      cmdBlue:"/colors blue 0 ADAD2B FFFFFF 000000 FFFFFF"
    },
    visitante: {
      name: "Ubers",
      angle: 0, textColor: "ADAD2B",
      layers: ["000000","000000","000000"],
      cmdRed: "/colors red 0 ADAD2B 000000 000000 000000",
      cmdBlue:"/colors blue 0 ADAD2B 000000 000000 000000"
    }
  },

  "ars": {
    local: {
      name: "Arsenal de Sarandí",
      angle: 50, textColor: "FFFFFF",
      layers: ["0D9EDB","DB0000","0D9EDB"],
      cmdRed: "/colors red 50 FFFFFF 0D9EDB DB0000 0D9EDB",
      cmdBlue:"/colors blue 50 FFFFFF 0D9EDB DB0000 0D9EDB"
    },
    visitante: {
      name: "Arsenal de Sarandí",
      angle: 60, textColor: "D1D1D1",
      layers: ["D61500","B80000"],
      cmdRed: "/colors red 60 D1D1D1 D61500 B80000",
      cmdBlue:"/colors blue 60 D1D1D1 D61500 B80000"
    },
    alternativa: {
      name: "Arsenal de Sarandí (Alternativa)",
      angle: 51, textColor: "D6D6D6",
      layers: ["121111","0A0A0A"],
      cmdRed: "/colors red 51 D6D6D6 121111 0A0A0A",
      cmdBlue:"/colors blue 51 D6D6D6 121111 0A0A0A"
    }
  },

  "cam": {
    local: {
      name: "Camcel",
      angle: 60, textColor: "000000",
      layers: ["FF0000","D90303","FF0000"],
      cmdRed: "/colors red 60 000000 FF0000 D90303 FF0000",
      cmdBlue:"/colors blue 60 000000 FF0000 D90303 FF0000"
    },
    visitante: {
      name: "Camcel",
      angle: 60, textColor: "FF9100",
      layers: ["FF0000","D90303","FF0000"],
      cmdRed: "/colors red 60 FF9100 FF0000 D90303 FF0000",
      cmdBlue:"/colors blue 60 FF9100 FF0000 D90303 FF0000"
    },
    alternativa: {
      name: "Camcel",
      angle: 60, textColor: "FF0000",
      layers: ["000000","0D0D0D","000000"],
      cmdRed: "/colors red 60 FF0000 000000 0D0D0D 000000",
      cmdBlue:"/colors blue 60 FF0000 000000 0D0D0D 000000"
    }
  },

  "QADN": {
    local: {
      name: "Quilmes Argentino del Norte",
      angle: 55, textColor: "FFCA38",
      layers: ["FFFFFF","00284A","FFFFFF"],
      cmdRed: "/colors red 55 FFCA38 FFFFFF 00284A FFFFFF",
      cmdBlue:"/colors blue 55 FFCA38 FFFFFF 00284A FFFFFF"
    },
    visitante: {
      name: "Quilmes Argentino del Norte",
      angle: 55, textColor: "FFC43B",
      layers: ["000000","00284A","000000"],
      cmdRed: "/colors red 55 FFC43B 000000 00284A 000000",
      cmdBlue:"/colors blue 55 FFC43B 000000 00284A 000000"
    }
  },

  "pal": {
    local: {
      name: "Palmeiras",
      angle: 90, textColor: "FFFFFF",
      layers: ["0D4D00","297702","0B3301"],
      cmdRed: "/colors red 90 FFFFFF 0D4D00 297702 0B3301",
      cmdBlue:"/colors blue 90 FFFFFF 0D4D00 297702 0B3301"
    },
    visitante: {
      name: "Palmeiras",
      angle: 90, textColor: "FFFFFF",
      layers: ["020D00","404040","000000"],
      cmdRed: "/colors red 90 FFFFFF 020D00 404040 000000",
      cmdBlue:"/colors blue 90 FFFFFF 020D00 404040 000000"
    }
  },

"tsc": {
    local: {
      name: "Team Tosco",
      angle: 180, textColor: "FFFFFF",
      layers: ["91561C","91561C","000000"],
      cmdRed: "/colors red 1 91561C 000000 91561C",
      cmdBlue:"/colors blue 1 91561C 000000 91561C"
    },
    visitante: {
      name: "Team Tosco",
      angle: 60, textColor: "91561C",
      layers: ["91561C","000000"],
      cmdRed: "/colors red 60 91561C 000000",
      cmdBlue:"/colors blue 60 91561C 000000"
    }
  },

  "ind": {
    local: {
      name: "Independiente (Local)",
      angle: 60, textColor: "FFFFFF",
      layers: ["FF0F0F"],
      cmdRed: "/colors red 60 FFFFFF FF0F0F",
      cmdBlue:"/colors blue 60 FFFFFF FF0F0F"
    },
    visitante: {
      name: "Independiente (Visitante)",
      angle: 60, textColor: "FF1900",
      layers: ["F0F0F0","D9D9D9","F0F0F0"],
      cmdRed: "/colors red 60 FF1900 F0F0F0 D9D9D9 F0F0F0",
      cmdBlue:"/colors blue 60 FF1900 F0F0F0 D9D9D9 F0F0F0"
    }
  }
};
// Estado global
if (!globalThis.equiposAsignados) globalThis.equiposAsignados = {
  red: { club: null, variante: null },
  blue: { club: null, variante: null }
};

function aplicarCamisetaALado(teamName, config) {
  const teamIndex = teamName === "red" ? 1 : 2;
  try {
    if (typeof room.setTeamColors === "function") {
      const angle = parseInt(config.angle || 0);
      const textColor = hexToInt(config.textColor || "FFFFFF");
      const layersInt = (config.layers || []).map(hexToInt);
      room.setTeamColors(teamIndex, angle, textColor, layersInt);
      return true;
    }
  } catch (err) {
    console.error("setTeamColors error:", err);
  }
  try {
    const cmd = teamName === "red" ? config.cmdRed : config.cmdBlue;
    if (cmd) room.sendChat(cmd);
    return false;
  } catch (e) {
    console.error("Fallback sendChat error:", e);
    return false;
  }
}

// --- comando !setcamis ---
function manejarSetCamis(player, msg) {
  if (!msg.startsWith("!setcamis ")) return false;
  if (!esAdmin(player)) {
    room.sendAnnouncement("⛔ Solo administradores pueden usar este comando.", player.id, 0xFF0000);
    return true;
  }
  const parts = msg.trim().split(/\s+/);
  if (parts.length < 4) {
    room.sendAnnouncement("❌ Uso: !setcamis <club> <variante> <red|blue|both>", player.id, 0xFF0000);
    return true;
  }

  const club = parts[1].toLowerCase();
  const variante = parts[2].toLowerCase();
  const lado = parts[3].toLowerCase();

  const clubObj = camisetas[club];
  if (!clubObj) {
    room.sendAnnouncement("❌ Club no encontrado.", player.id, 0xFF0000);
    return true;
  }
  const cfg = clubObj[variante];
  if (!cfg) {
    room.sendAnnouncement("❌ Variante no encontrada.", player.id, 0xFF0000);
    return true;
  }

  if (lado === "red" || lado === "both") {
    aplicarCamisetaALado("red", cfg);
    globalThis.equiposAsignados.red = { club, variante };
  }
  if (lado === "blue" || lado === "both") {
    aplicarCamisetaALado("blue", cfg);
    globalThis.equiposAsignados.blue = { club, variante };
  }

  room.sendAnnouncement(`✅ Camisetas aplicadas: ${club} (${variante}) → ${lado}`, null, 0x32CD32, "bold");
  return true;
}

// --- comando !swapcamis ---
function manejarSwapCamis(player, msg) {
  if (msg !== "!swapcamis") return false;
  if (!esAdmin(player)) {
    room.sendAnnouncement("⛔ Solo administradores pueden usar este comando.", player.id, 0xFF0000);
    return true;
  }

  const redTeam = globalThis.equiposAsignados.red;
  const blueTeam = globalThis.equiposAsignados.blue;

  if (!redTeam.club || !blueTeam.club) {
    room.sendAnnouncement("❌ No hay camisetas asignadas en ambos equipos para hacer swap.", player.id, 0xFF0000);
    return true;
  }

  const temp = { ...redTeam };
  globalThis.equiposAsignados.red = { ...blueTeam };
  globalThis.equiposAsignados.blue = { ...temp };

  const cfgRed = camisetas[globalThis.equiposAsignados.red.club][globalThis.equiposAsignados.red.variante];
  const cfgBlue = camisetas[globalThis.equiposAsignados.blue.club][globalThis.equiposAsignados.blue.variante];

  aplicarCamisetaALado("red", cfgRed);
  aplicarCamisetaALado("blue", cfgBlue);

  room.sendAnnouncement(`🔄 Camisetas intercambiadas: ahora red = ${globalThis.equiposAsignados.red.club}, blue = ${globalThis.equiposAsignados.blue.club}`, null, 0x00BFFF, "bold");
  return true;
}
// fin de bloque (2)
// === BLOQUE 3: GRABACIONES PROGRAMADAS ===
let grabacionActiva = null;
let grabacionTimer = null;
let grabacionProgramada = null;
let recPendientes = [];

const webhookRec = "https://discord.com/api/webhooks/1420529862967431270/uOvuHP1tyWCfmWa-PJV72v2iY1d3AirTDI6keq7eg7gdvQ9mVZ4Z20d8aZqTpcGKH7MN";

function manejarRecofis(player, msg) {
  if (!msg.startsWith("!recofis ")) return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("⛔ Solo el admin principal puede programar grabaciones.", player.id, 0xFF0000);
    return true;
  }

  const partes = msg.split("::");
  const horaStr = msg.split(" ")[1];
  if (!horaStr || !horaStr.includes(":")) {
    room.sendAnnouncement("❌ Uso: !recofis HH:MM ::Equipo1 - Equipo2:: ::Competición::", player.id, 0xFF0000);
    return true;
  }

  const [hh, mm] = horaStr.split(":").map(n => parseInt(n));
  const ahora = new Date();
  const target = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm);

  if (target <= ahora) {
    room.sendAnnouncement("⚠️ Esa hora ya pasó.", player.id, 0xFF0000);
    return true;
  }

  const equipos = partes[1] ? partes[1].trim() : "Partido";
  const torneo = partes[2] ? partes[2].trim() : "Amistoso";

  recPendientes.push({ hora: horaStr, equipos, torneo });

  const delay = target - ahora;
  if (grabacionProgramada) clearTimeout(grabacionProgramada);
  grabacionProgramada = setTimeout(() => {
    iniciarGrabacion(equipos, torneo);
    recPendientes = recPendientes.filter(r => r.hora !== horaStr);
    grabacionProgramada = null;
  }, delay);

  room.sendAnnouncement(`📅 Grabación programada ${horaStr} (${equipos} | ${torneo})`, null, 0x00FF00);
  return true;
}

function iniciarGrabacion(equipos, torneo) {
  if (grabacionActiva) return;
  grabacionActiva = { data: room.startRecording(), equipos, torneo, inicio: Date.now() };
  grabacionTimer = setTimeout(() => finalizarGrabacion(), 25 * 60 * 1000);
  room.sendAnnouncement(`🎥 Grabación iniciada: ${equipos} (${torneo})`, null, 0x87CEFA);
}

function finalizarGrabacion() {
  if (!grabacionActiva) return;
  const recData = room.stopRecording();
  clearTimeout(grabacionTimer);

  const scores = room.getScores();
  const red = scores ? scores.red : 0;
  const blue = scores ? scores.blue : 0;

  const nombre = `${grabacionActiva.equipos} ${red}-${blue} ${grabacionActiva.torneo}.hbr2`;

  const blob = new Blob([recData], { type: "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, nombre);

  fetch(webhookRec, { method: "POST", body: formData });
  room.sendAnnouncement("💾 Grabación finalizada y subida a Discord.", null, 0x00FF00);
  grabacionActiva = null;
}

function manejarCortarRec(player, msg) {
  if (msg !== "!cortarec") return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("⛔ Solo el admin principal puede cortar grabaciones.", player.id, 0xFF0000);
    return true;
  }
  if (!grabacionActiva) {
    room.sendAnnouncement("❌ No hay grabación en curso.", player.id, 0xFF0000);
    return true;
  }
  finalizarGrabacion();
  room.sendAnnouncement("✂️ Grabación cortada manualmente.", null, 0xFF69B4);
  return true;
}

function manejarCancelarReco(player, msg) {
  if (msg !== "!cancelareco") return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("⛔ Solo el admin principal puede cancelar grabaciones.", player.id, 0xFF0000);
    return true;
  }
  if (!grabacionProgramada) {
    room.sendAnnouncement("⚠️ No hay grabación programada.", player.id, 0xFF0000);
    return true;
  }
  clearTimeout(grabacionProgramada);
  grabacionProgramada = null;
  recPendientes = [];
  room.sendAnnouncement("❌ Grabación programada cancelada.", null, 0xFF0000);
  return true;
}

function manejarListaRec(player, msg) {
  if (msg !== "!listarec") return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("⛔ Solo el admin principal puede ver la lista de grabaciones.", player.id, 0xFF0000);
    return true;
  }
  if (recPendientes.length === 0) {
    room.sendAnnouncement("📋 No hay grabaciones programadas.", player.id, 0xAAAAAA);
  } else {
    const lista = recPendientes.map(r => `${r.hora} → ${r.equipos} (${r.torneo})`).join("\n");
    room.sendAnnouncement("📋 Grabaciones pendientes:\n" + lista, player.id, 0x87CEFA);
  }
  return true;
}

function manejarBorrarRec(player, msg) {
  if (msg !== "!borrarrec") return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("⛔ Solo el admin principal puede borrar grabaciones.", player.id, 0xFF0000);
    return true;
  }
  recPendientes = [];
  room.sendAnnouncement("🗑️ Grabaciones pendientes eliminadas.", null, 0xFFA500);
  return true;
}
// fin de bloque (3)


// === BLOQUE 4: GOLES, ASISTENCIAS Y GA/GC ===
const WEBHOOK_EVENTOS = "https://discord.com/api/webhooks/1385541535474647040/axTPeW54aDK20qnG5dI3504Oa3sb1WWNlt3K_6o6b-0UlI53BkAEt7al0RWxucWY1ejV";

function enviarEventoDiscord(embed) {
  fetch(WEBHOOK_EVENTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  }).catch(e => console.error("Error webhook evento:", e));
}

let ultimoTouch = null;
let penultimoTouch = null;
let statsJugadores = {};
let ultimoGolEquipo = null;

// Helpers
function getNombreJugador(id) {
  const p = room.getPlayer(id);
  return p ? p.name : "Jugador desconocido";
}

function getNombreEquipoSeguro(team) {
  if (globalThis.equiposAsignados) {
    if (team === 1 && globalThis.equiposAsignados.red.club) return globalThis.equiposAsignados.red.club;
    if (team === 2 && globalThis.equiposAsignados.blue.club) return globalThis.equiposAsignados.blue.club;
  }
  return team === 1 ? "Red" : "Blue";
}

function formatearTiempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${seg.toString().padStart(2, "0")}`;
}

// Eventos
room.onPlayerBallKick = (player) => {
  penultimoTouch = ultimoTouch;
  ultimoTouch = { id: player.id, team: player.team, ts: Date.now() };

  if (!statsJugadores[player.id]) {
    statsJugadores[player.id] = { goles: 0, asistencias: 0, toques: 0, gc: 0 };
  }
  statsJugadores[player.id].toques++;
};

room.onTeamGoal = (team) => {
  ultimoGolEquipo = team;
  const scores = room.getScores();
  const minuto = formatearTiempo(Math.floor(scores.time));
  const ahora = Date.now();

  // Goleador
  let goleador = "Jugador desconocido";
  if (ultimoTouch && (ahora - ultimoTouch.ts) < 10000 && ultimoTouch.team === team) {
    goleador = getNombreJugador(ultimoTouch.id);
    statsJugadores[ultimoTouch.id].goles++;
  }

  // Asistencia
  let asistencia = "Sin asistencia";
  if (penultimoTouch && (ahora - penultimoTouch.ts) < 10000 && penultimoTouch.team === team && penultimoTouch.id !== ultimoTouch?.id) {
    asistencia = getNombreJugador(penultimoTouch.id);
    statsJugadores[penultimoTouch.id].asistencias = (statsJugadores[penultimoTouch.id].asistencias || 0) + 1;
  }

  // GC (Gol concedido)
  const rivalTeam = team === 1 ? 2 : 1;
  room.getPlayerList().forEach(p => {
    if (p.team === rivalTeam) {
      if (!statsJugadores[p.id]) {
        statsJugadores[p.id] = { goles: 0, asistencias: 0, toques: 0, gc: 0 };
      }
      statsJugadores[p.id].gc++;
    }
  });

  // Embed Discord
  const embed = {
    title: `⚽ Gol de ${getNombreEquipoSeguro(team)}`,
    description: `**Goleador:** ${goleador}\n**Asistencia:** ${asistencia}\n⏱️ Minuto: ${minuto}`,
    color: team === 1 ? 0xFF0000 : 0x0000FF,
    footer: { text: `${getNombreEquipoSeguro(1)} ${scores.red} - ${scores.blue} ${getNombreEquipoSeguro(2)}` }
  };
  enviarEventoDiscord(embed);
};
// fin de bloque (4)


// === BLOQUE 5: REINICIO Y ESTADÍSTICAS DEL HOST ===
const inicioHost = Date.now();
let ultimaConexion = null;

const webhookHost = "https://discord.com/api/webhooks/1419529114259558462/B0uvgGvTaBgxn4TMzq1o8Wqx2l2ht2pvm2Mj3ZbmWayyPd5gC0QgTMeNRR4VZ86e6sRB";

(function anunciarHostEncendido() {
  try {
    const payload = { content: "🟢 El host ha sido iniciado correctamente." };
    fetch(webhookHost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Error al anunciar host:", err);
  }
})();

setInterval(() => {
  const uptime = Math.floor((Date.now() - inicioHost) / (1000 * 60 * 60));
  console.log(`⏱️ Host en línea por ${uptime} horas.`);
}, 60 * 60 * 1000);

const prevJoin5 = room.onPlayerJoin;
room.onPlayerJoin = function (player) {
  ultimaConexion = new Date();
  if (typeof prevJoin5 === "function") prevJoin5(player);
};

function manejarReiniciarHost(player, msg) {
  if (msg !== "!reiniciarhost") return false;
  if (!esMainAdmin(player)) {
    room.sendAnnouncement("❌ Solo el admin principal puede reiniciar el host.", player.id, 0xFF0000);
    return true;
  }
  room.sendAnnouncement("♻️ Reiniciando host...", null, 0xFFA500);
  setTimeout(() => location.reload(), 2000);
  return true;
}

function manejarStats(player, msg) {
  if (msg !== "!stats") return false;
  if (!esAdmin(player)) {
    room.sendAnnouncement("⛔ Solo administradores pueden ver las stats.", player.id, 0xFF0000);
    return true;
  }

  const memoria = (performance.memory && performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
  const uptimeMin = Math.floor((Date.now() - inicioHost) / (1000 * 60));
  const ultima = ultimaConexion ? ultimaConexion.toLocaleString() : "Nunca";

  room.sendAnnouncement(`📊 Stats:\n🖥️ Memoria: ${memoria || "N/A"} MB\n⏱️ Uptime: ${uptimeMin} min\n👤 Última conexión: ${ultima}`, player.id, 0x87CEFA);
  return true;
}
// fin de bloque (5)
// === BLOQUE 6: ESTÉTICA Y PRESENTACIÓN ===

// 📢 LINKS Y REDES
const links = {
  discord: "https://discord.gg/tu-liga",
  youtube: "https://youtube.com/tu-liga",
  twitch: "https://twitch.tv/tu-liga"
};

// 🎨 BIENVENIDA ESTILIZADA
function mensajeBienvenida(player) {
  room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━", player.id, 0xAAAAAA, "bold");
  room.sendAnnouncement("👋 Bienvenido/a a", player.id, 0x00FF00, "bold");
  room.sendAnnouncement("🏆 AFAHAX OFICIAL 🏆", player.id, 0xFFD700, "bold");
  room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━", player.id, 0xAAAAAA, "bold");
  room.sendAnnouncement("📹 Partidos oficiales grabados", player.id, 0x87CEFA, "italic");
  room.sendAnnouncement("🔑 Usa !login <clave> para acceder como admin", player.id, 0xFF69B4, "normal");
  room.sendAnnouncement(`🌐 Discord: ${links.discord}`, player.id, 0x00FFFF, "italic");
  room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━", player.id, 0xAAAAAA, "bold");
}

// Sobrescribir onPlayerJoin para incluir bienvenida estilizada
const prevJoin6 = room.onPlayerJoin;
room.onPlayerJoin = function (player) {
  if (typeof prevJoin6 === "function") prevJoin6(player);
  mensajeBienvenida(player);
};

// 🕒 ANUNCIOS AUTOMÁTICOS
const anuncios = [
  "⚽ ¡Sigue la liga en vivo en Twitch!",
  "📹 Todas las grabaciones oficiales se suben a Discord.",
  "🌐 Únete a nuestra comunidad: " + links.discord,
  "🏆 Vive el mejor Haxball competitivo en OFIS AFAHAX."
];
let indiceAnuncio = 0;

setInterval(() => {
  room.sendAnnouncement(anuncios[indiceAnuncio], null, 0xFFA500, "bold");
  indiceAnuncio = (indiceAnuncio + 1) % anuncios.length;
}, 10 * 60 * 1000); // cada 10 min
// fin de bloque (6)


// === BLOQUE 7: FIRMAS (!firmo) ===
const firmasWebhook = "https://discord.com/api/webhooks/1419176136079839232/M6itrY1-j-bzfCgzSJkpXidOizkBatDPT108oiMdGS2E6lfvBYsjvaz3HZWI70frCpUm";

// Guardado en memoria
if (!globalThis.firmasStore) globalThis.firmasStore = [];

function enviarFirmaDiscord(jugador, discordName, sala) {
  const payload = {
    content: `**Firma**\nJugador: ${jugador}\nDiscord: ${discordName}\nSala: ${sala}`
  };
  try {
    fetch(firmasWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (err) {
    console.error("Error enviando firma a Discord:", err);
  }
}

function manejarFirmo(player, message) {
  if (typeof message !== "string") return false;
  if (message.trim().toLowerCase() !== "!firmo") return false;

  const jugador = player.name;
  const sala = NombreHost || "Sala desconocida";
  const discordName = "No encontrado en AFAHAX";
  const ip = player.conn || "IP no disponible";
  const auth = player.auth || "auth no disponible";
  const timestamp = Date.now();

  // guardar localmente
  globalThis.firmasStore.push({ jugador, auth, ip, sala, timestamp });

  // enviar a Discord
  enviarFirmaDiscord(jugador, discordName, sala);

  // notificar en la sala
  room.sendAnnouncement(`✅ ${jugador}, tu firma fue registrada y enviada a Discord.`, player.id, 0x00FF00);

  return true;
}

// Instalamos handler
if (!room._firmasHandlerInstalled) {
  const prevOnPlayerChat7 = room.onPlayerChat;
  room.onPlayerChat = function (player, message) {
    try {
      if (typeof message === "string" && message.trim().toLowerCase() === "!firmo") {
        if (manejarFirmo(player, message)) return false;
      }
    } catch (err) {
      console.error("Error en handler de firmas:", err);
    }
    if (typeof prevOnPlayerChat7 === "function") {
      return prevOnPlayerChat7(player, message);
    }
    return true;
  };
  room._firmasHandlerInstalled = true;
}
// fin de bloque (7)


// === BLOQUE 8: LIVE CHAT (Haxball → Discord) ===
const webhookLiveChat = "https://discord.com/api/webhooks/1419529257402630144/Qcefosqda_o5Z9m1YWM_Tl-YQ1tFa0UsGFhEamQfxh9gfpkQsv7GTGExKvyZJgZzW5T6";

function enviarChatADiscord(player, message) {
  const payload = { content: `💬 **${player.name}**: ${message}` };
  try {
    fetch(webhookLiveChat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Error enviando chat a Discord:", err);
  }
}

if (!room._liveChatHandlerInstalled) {
  const prevOnPlayerChat8 = room.onPlayerChat;
  room.onPlayerChat = function (player, message) {
    try {
      if (typeof message === "string" && message.trim().length > 0) {
        enviarChatADiscord(player, message);
      }
    } catch (err) {
      console.error("Error en LiveChat handler:", err);
    }
    if (typeof prevOnPlayerChat8 === "function") {
      return prevOnPlayerChat8(player, message);
    }
    return true;
  };
  room._liveChatHandlerInstalled = true;
}
// fin de bloque (8)
// === BLOQUE 9: Notificación de inicio en Discord (con link real) ===
const webhookInicio = "https://discord.com/api/webhooks/1419529114259558462/B0uvgGvTaBgxn4TMzq1o8Wqx2l2ht2pvm2Mj3ZbmWayyPd5gC0QgTMeNRR4VZ86e6sRB";

function notificarInicio(linkSala) {
  const payload = {
    content: "@everyone",
    embeds: [
      {
        title: "🚀 ¡Sala iniciada!",
        color: 0x32CD32,
        fields: [
          { name: "📛 Nombre", value: NombreHost, inline: true },
          { name: "🔑 Contraseña", value: Contraseña ? Contraseña : "Sin contraseña", inline: true },
          { name: "🔗 Link", value: linkSala }
        ],
        footer: { text: "AFAHAX Bot" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  fetch(webhookInicio, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Error enviando notificación de inicio:", err));
}

room.onRoomLink = function (link) {
  notificarInicio(link);
};
// fin de bloque (9)


// === BLOQUE 10: COMANDOS DE PARTIDO (!go y !lt) ===
function comandoGo(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden usar !go", player.id, 0xFF0000);
    return;
  }
  if (!grabacionActiva) {
    room.sendAnnouncement("⚠️ No hay grabación oficial en curso.", player.id, 0xFFA500);
    return;
  }

  try {
    const blob = new Blob([grabacionActiva.data], { type: "application/octet-stream" });
    const formData = new FormData();
    formData.append("file", blob, grabacionActiva.nombre);
    fetch(webhookRec, { method: "POST", body: formData });
  } catch (err) {
    console.error("Error guardando rec antes de GO:", err);
  }

  grabacionActiva.data = [];
  grabacionActiva.startTime = Date.now();

  room.sendAnnouncement("🔄 ¡Grabación oficial reiniciada con !go!", null, 0x32CD32, "bold");
}

function comandoLt(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden usar !lt", player.id, 0xFF0000);
    return;
  }

  room.sendAnnouncement("📶 Iniciando Lag Test de 30 segundos...", null, 0x1E90FF, "bold");
  room.startGame();

  setTimeout(() => {
    room.stopGame();
    enviarAvisoDiscord("📶 Lag Test finalizado", "Verifiquen su ping y estabilidad antes de continuar.", 0x1E90FF);
    room.sendAnnouncement("✅ Lag Test completado.", null, 0x32CD32, "bold");
  }, 30 * 1000);
}

const prevOnPlayerChat10 = room.onPlayerChat;
room.onPlayerChat = function (player, message) {
  const msg = message.toLowerCase();
  if (msg === "!go") { comandoGo(player); return false; }
  if (msg === "!lt") { comandoLt(player); return false; }
  if (typeof prevOnPlayerChat10 === "function") return prevOnPlayerChat10(player, message);
  return true;
};
// fin de bloque (10)


// === BLOQUE 11: COMANDOS DE PARTIDO BÁSICOS ===
function comandoP(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden pausar/reanudar.", player.id, 0xFF0000);
    return;
  }
  const scores = room.getScores();
  if (!scores) return;
  room.pauseGame(!scores.isPaused);
}

function comandoStart(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden iniciar el partido.", player.id, 0xFF0000);
    return;
  }
  room.startGame();
  room.sendAnnouncement("▶️ Partido iniciado manualmente.", null, 0x32CD32, "bold");
  enviarAvisoDiscord("▶️ Partido iniciado", "El administrador ha forzado el inicio.", 0x32CD32);
}

function comandoStop(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden detener el partido.", player.id, 0xFF0000);
    return;
  }
  room.stopGame();
  room.sendAnnouncement("⏹️ Partido finalizado manualmente.", null, 0xFF0000, "bold");
  enviarAvisoDiscord("⏹️ Partido detenido", "El administrador ha finalizado el partido.", 0xFF0000);
}

function comandoSwap(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden usar swap.", player.id, 0xFF0000);
    return;
  }
  const jugadores = room.getPlayerList().filter(p => p.team === 1 || p.team === 2);
  jugadores.forEach(p => room.setPlayerTeam(p.id, p.team === 1 ? 2 : 1));
  room.sendAnnouncement("🔄 Equipos intercambiados.", null, 0x00BFFF, "bold");
  enviarAvisoDiscord("🔄 Equipos intercambiados", "Todos los jugadores cambiaron de lado.", 0x00BFFF);
}

function comandoClear(player) {
  if (!esAdmin(player)) {
    room.sendAnnouncement("❌ Solo administradores pueden vaciar la cancha.", player.id, 0xFF0000);
    return;
  }
  const jugadores = room.getPlayerList().filter(p => p.team !== 0);
  jugadores.forEach(p => room.setPlayerTeam(p.id, 0));
  room.sendAnnouncement("🧹 Cancha vaciada (todos a espectadores).", null, 0xAAAAAA, "bold");
  enviarAvisoDiscord("🧹 Cancha vaciada", "Todos los jugadores fueron movidos a espectadores.", 0xAAAAAA);
}

const prevOnPlayerChat11 = room.onPlayerChat;
room.onPlayerChat = function (player, message) {
  const msg = message.trim().toLowerCase();

  if (msg === "!p") { comandoP(player); return false; }
  if (msg === "!start") { comandoStart(player); return false; }
  if (msg === "!stop") { comandoStop(player); return false; }
  if (msg === "!swap") { comandoSwap(player); return false; }
  if (msg === "!clear") { comandoClear(player); return false; }

  if (typeof prevOnPlayerChat11 === "function") return prevOnPlayerChat11(player, message);
  return true;
};
// fin de bloque (11)
// === BLOQUE 12: SISTEMA DE PERMISOS ===

// ✅ Verificar si un jugador es admin principal o auxiliar
function esAdmin(player) {
  if (player.admin) return true;
  if (player.name === mainAdmin) return true;
  if (auxAdmins.includes(player.id)) return true;
  return false;
}
// fin de bloque (12)


// === BLOQUE 13: CONEXIÓN DE PERMISOS CON COMANDOS ===
const prevOnPlayerChat13 = room.onPlayerChat;
room.onPlayerChat = function (player, message) {
  const msg = message.trim().toLowerCase();

  // --- Pausa (!p) ---
  if (msg === "!p") {
    if (!esAdmin(player)) {
      room.sendAnnouncement("❌ Solo administradores pueden pausar/reanudar.", player.id, 0xFF0000);
      return false;
    }
    comandoP(player);
    return false;
  }

  // --- Inicio partido (!start) ---
  if (msg === "!start") {
    if (!esAdmin(player)) {
      room.sendAnnouncement("❌ Solo administradores pueden iniciar el partido.", player.id, 0xFF0000);
      return false;
    }
    comandoStart(player);
    return false;
  }

  // --- Stop (!stop) ---
  if (msg === "!stop") {
    if (!esAdmin(player)) {
      room.sendAnnouncement("❌ Solo administradores pueden detener el partido.", player.id, 0xFF0000);
      return false;
    }
    comandoStop(player);
    return false;
  }

  // --- Swap (!swap) ---
  if (msg === "!swap") {
    if (!esAdmin(player)) {
      room.sendAnnouncement("❌ Solo administradores pueden usar swap.", player.id, 0xFF0000);
      return false;
    }
    comandoSwap(player);
    return false;
  }

  // --- Clear (!clear) ---
  if (msg === "!clear") {
    if (!esAdmin(player)) {
      room.sendAnnouncement("❌ Solo administradores pueden vaciar la cancha.", player.id, 0xFF0000);
      return false;
    }
    comandoClear(player);
    return false;
  }

  if (typeof prevOnPlayerChat13 === "function") return prevOnPlayerChat13(player, message);
  return true;
};
// fin de bloque (13)

