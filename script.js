// Función auxiliar para obtener la fecha de hoy en formato YYYY-MM-DD
export function hoy() {
  const now = new Date();
  now.setDate(now.getDate() + 1); // sumo 1 día
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAQwEe9C-ruCZ6TX612zA6FhkxZUJ2rVoc",
  authDomain: "consultoriosapp-f7f08.firebaseapp.com",
  projectId: "consultoriosapp-f7f08",
  storageBucket: "consultoriosapp-f7f08.firebasestorage.app",
  messagingSenderId: "729983357456",
  appId: "1:729983357456:web:61f5805927509dfeefb095",
};

// Inicializar app y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Referencias globales
export const mainContent = document.getElementById("mainContent");

export let listaPacientes = [];
export let listaTurnos = [];
export let paginaActualTurnos = 1;
export const turnosPorPagina = 20;
export let turnosFiltrados = [];

export let pacientesGlobalFiltrados = []; // pacientes filtrados

// Variable global para controlar si estamos editando un paciente
export let pacienteEditandoId = null;

export let calendar;

async function mostrarInicio() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Inicio - Agenda</h1>

    <div id="estadisticas" class="mb-4 d-flex gap-3 flex-wrap">
      <div class="card flex-fill border-primary text-center p-3">
        <h5 class="text-primary">Turnos del día</h5>
        <p id="turnosDia" class="fs-4 mb-0">-</p>
      </div>
      <div class="card flex-fill border-success text-center p-3">
        <h5 class="text-success">Pacientes atendidos</h5>
        <p id="pacientesAtendidos" class="fs-4 mb-0">-</p>
      </div>
      <div class="card flex-fill border-warning text-center p-3">
        <h5 class="text-warning">Pacientes restantes</h5>
        <p id="pacientesRestantes" class="fs-4 mb-0">-</p>
      </div>
      <div class="card flex-fill border-info text-center p-3">
        <h5 class="text-info">Ingresos del día</h5>
        <p id="ingresosDia" class="fs-4 mb-0">$ -</p>
      </div>
    </div>

    <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
      <button id="btnHoy" class="btn btn-sm btn-outline-primary">Hoy</button>
      <button id="btnSemana" class="btn btn-sm btn-outline-primary">Semana</button>
      <label for="fechaDesde" class="mb-0">Desde:</label>
      <input type="date" id="fechaDesde" class="form-control form-control-sm" style="width: 150px;" />
      <label for="fechaHasta" class="mb-0">Hasta:</label>
      <input type="date" id="fechaHasta" class="form-control form-control-sm" style="width: 150px;" />
      <button id="btnFiltrar" class="btn btn-sm btn-primary">Filtrar</button>
      <input type="text" id="busquedaPaciente" class="form-control form-control-sm" placeholder="Buscar paciente por nombre o DNI..." style="flex: 1; max-width: 400px;" />
    </div>

    <div id="resultadosBusqueda" class="mt-2"></div>
    <div id="calendar" style="height: 600px; overflow-y: auto; border: 1px solid #ddd;"></div>
  `;

  await cargarTodosPacientes();
  await cargarTodosTurnos();

  const fechaDesde = document.getElementById("fechaDesde");
  const fechaHasta = document.getElementById("fechaHasta");
  const btnHoy = document.getElementById("btnHoy");
  const btnSemana = document.getElementById("btnSemana");
  const btnFiltrar = document.getElementById("btnFiltrar");
  const inputBusqueda = document.getElementById("busquedaPaciente");
  const resultadosBusqueda = document.getElementById("resultadosBusqueda");

  const hoyStr = hoy();

  fechaDesde.value = hoyStr;
  fechaHasta.value = hoyStr;

  function actualizarCalendarioYEstadisticas(desde, hasta) {
    if (calendar) {
      calendar.gotoDate(desde);
      if (desde === hasta) {
        calendar.changeView("timeGridDay");
      } else {
        calendar.changeView("timeGridWeek");
      }
    }
    calcularEstadisticas(desde, hasta);
  }

  btnHoy.addEventListener("click", () => {
    const hoyStr = hoy();

    fechaDesde.value = hoyStr;
    fechaHasta.value = hoyStr;
    calendar.changeView("timeGridDay");
    actualizarCalendarioYEstadisticas(hoyStr, hoyStr);
  });

  btnSemana.addEventListener("click", () => {
    const hoy = new Date();
    const desdeStr = hoy.toISOString().slice(0, 10);
    const hasta = new Date(hoy);
    hasta.setDate(hoy.getDate() + 6);
    const hastaStr = hasta.toISOString().slice(0, 10);

    fechaDesde.value = desdeStr;
    fechaHasta.value = hastaStr;
    calendar.changeView("timeGridWeek");
    actualizarCalendarioYEstadisticas(desdeStr, hastaStr);
  });

  btnFiltrar.addEventListener("click", () => {
    if (!fechaDesde.value || !fechaHasta.value) {
      alert("Por favor, complete las fechas Desde y Hasta.");
      return;
    }
    actualizarCalendarioYEstadisticas(fechaDesde.value, fechaHasta.value);
  });

  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    initialDate: hoyStr,
    slotDuration: "00:15:00",
    allDaySlot: false,
    height: "600",
    expandRows: true,
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "", // eliminamos botones today, day, week
    },
    slotLabelInterval: "01:00",
    nowIndicator: true,
    slotMinTime: "07:00:00",
    slotMaxTime: "22:00:00",
    eventOverlap: false,

    events: async function (info, successCallback) {
      const eventos = await obtenerEventosEnRango(info.startStr, info.endStr);
      successCallback(eventos);
    },

    dateClick: function (info) {
      const fecha = info.dateStr.slice(0, 10);
      const hora = info.date.toTimeString().slice(0, 5);

      document.getElementById("turnoRapidoFecha").value = fecha;
      document.getElementById("turnoRapidoHora").value = hora;
      document.getElementById("turnoRapidoFechaTexto").textContent = fecha;
      document.getElementById("turnoRapidoHoraTexto").textContent = hora;
      document.getElementById("formTurnoRapido").reset();

      const modal = new bootstrap.Modal(
        document.getElementById("modalTurnoRapido")
      );
      modal.show();
    },

    eventMouseEnter: function (info) {
      const horaInicio = info.event.start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const horaFin =
        info.event.end?.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }) || "";
      const texto = `${horaInicio} - ${horaFin} | ${info.event.title}`;

      info.el._tooltip = new bootstrap.Tooltip(info.el, {
        title: texto,
        placement: "top",
        trigger: "manual",
        container: "body",
      });

      info.el._tooltip.show();
    },

    eventMouseLeave: function (info) {
      if (info.el._tooltip) {
        info.el._tooltip.hide();
        info.el._tooltip.dispose();
        delete info.el._tooltip;
      }
    },
  });

  calendar.render();

  // Buscador (lo dejé igual que lo tenías)
  let busquedaId = 0;
  inputBusqueda.addEventListener("input", async (e) => {
    const texto = e.target.value.trim().toLowerCase();
    const currentId = ++busquedaId;
    resultadosBusqueda.innerHTML = "";

    if (texto === "") return;

    try {
      const pacientesEncontrados = [];
      const turnosEncontradosSinPaciente = [];
      const pacientesSnapshot = await getDocs(collection(db, "pacientes"));
      const turnosSnapshot = await getDocs(collection(db, "turnos"));
      if (currentId !== busquedaId) return;

      pacientesSnapshot.forEach((doc) => {
        const p = doc.data();
        const nombreCompleto = (p.nombre + " " + p.apellido).toLowerCase();
        const nombreInvertido = (p.apellido + " " + p.nombre).toLowerCase();
        const dni = p.dni?.toString().toLowerCase() || "";

        if (
          nombreCompleto.includes(texto) ||
          nombreInvertido.includes(texto) ||
          dni.includes(texto)
        ) {
          pacientesEncontrados.push({ id: doc.id, ...p });
        }
      });

      turnosSnapshot.forEach((doc) => {
        const t = doc.data();
        if (
          (!t.pacienteId || t.pacienteId === null) &&
          t.pacienteNombre?.toLowerCase().includes(texto)
        ) {
          turnosEncontradosSinPaciente.push({ id: doc.id, ...t });
        }
      });

      if (currentId !== busquedaId) return;

      if (
        pacientesEncontrados.length === 0 &&
        turnosEncontradosSinPaciente.length === 0
      ) {
        resultadosBusqueda.innerHTML =
          "<p>No se encontraron pacientes ni turnos.</p>";
        return;
      }

      let html = "<ul class='list-group'>";
      const fechaHoy = new Date().toISOString().slice(0, 10);

      for (const paciente of pacientesEncontrados) {
        const turnos = [];
        turnosSnapshot.forEach((docu) => {
          const t = docu.data();
          if (t.pacienteId === paciente.id && t.fecha >= fechaHoy) {
            turnos.push(t);
          }
        });

        html += `<li class="list-group-item">
          <strong>${paciente.apellido}, ${paciente.nombre}</strong> - DNI: ${paciente.dni}<br/>
          <em>Próximos turnos:</em>
          <ul>`;
        html +=
          turnos.length === 0
            ? "<li>No tiene próximos turnos.</li>"
            : turnos
                .map(
                  (t) =>
                    `<li>${t.fecha} ${t.hora} - ${
                      t.tipoConsulta || "Consulta"
                    }</li>`
                )
                .join("");
        html += "</ul></li>";
      }

      if (turnosEncontradosSinPaciente.length > 0) {
        html += `<li class="list-group-item list-group-item-warning">
          <strong>"Paciente no registrado (sin ficha creada)"</strong>
          <ul>`;
        turnosEncontradosSinPaciente.forEach((t) => {
          html += `<li>${t.fecha} ${t.hora} - ${
            t.pacienteNombre || "Consulta"
          } - ${t.tipoConsulta || "Consulta"}</li>`;
        });
        html += "</ul></li>";
      }

      html += "</ul>";
      resultadosBusqueda.innerHTML = html;
    } catch (error) {
      console.error("Error en búsqueda:", error);
      resultadosBusqueda.innerHTML =
        "<p class='text-danger'>Error al buscar pacientes.</p>";
    }
  });

  calcularEstadisticas(hoyStr, hoyStr);
}

document
  .getElementById("formTurnoRapido")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const nombre = document.getElementById("turnoRapidoNombre").value.trim();
    const fecha = document.getElementById("turnoRapidoFecha").value;
    const hora = document.getElementById("turnoRapidoHora").value;
    const duracion = parseInt(
      document.getElementById("turnoRapidoDuracion").value
    );
    const tipo = document.getElementById("turnoRapidoTipo").value.trim();

    if (!nombre) {
      alert("Debe ingresar el nombre del paciente.");
      return;
    }

    try {
      await addDoc(collection(db, "turnos"), {
        fecha,
        hora,
        pacienteNombre: nombre,
        tipoConsulta: tipo || "Consulta",
        duracionMinutos: duracion,
        pacienteId: null,
        asistio: false,
        montoAbonado: 0,
      });

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("modalTurnoRapido")
      );
      modal.hide();

      alert("Turno guardado correctamente.");
      calendar.refetchEvents();

      if (typeof cargarTurnosPaginados === "function") {
        cargarTurnosPaginados();
      }
    } catch (error) {
      console.error("Error al guardar turno rápido:", error);
      alert("Ocurrió un error al guardar el turno.");
    }
  });

async function calcularEstadisticas(fechaSeleccionada) {
  const hoy = fechaSeleccionada;

  try {
    // 1. Cargar turnos del día
    const turnosSnapshot = await getDocs(collection(db, "turnos"));
    const turnosDelDia = [];
    turnosSnapshot.forEach((doc) => {
      const turno = doc.data();
      if (turno.fecha === hoy) turnosDelDia.push(turno);
    });

    // 2. Pacientes atendidos y restantes
    const pacientesAtendidos = turnosDelDia.filter(
      (t) => t.asistio === true
    ).length;
    const pacientesRestantes = turnosDelDia.length - pacientesAtendidos;

    // 3. Ingresos del día
    const cajaSnapshot = await getDocs(collection(db, "caja"));
    let ingresosDia = 0;
    cajaSnapshot.forEach((doc) => {
      const mov = doc.data();
      if (mov.fecha === hoy && mov.monto) ingresosDia += mov.monto;
    });

    // Actualizar HTML
    document.getElementById("turnosDia").textContent = turnosDelDia.length;
    document.getElementById("pacientesAtendidos").textContent =
      pacientesAtendidos;
    document.getElementById("pacientesRestantes").textContent =
      pacientesRestantes;
    document.getElementById(
      "ingresosDia"
    ).textContent = `$ ${ingresosDia.toLocaleString("es-AR")}`;
  } catch (error) {
    console.error("Error calculando estadísticas:", error);
  }
}

// --- GESTIÓN PACIENTES ---
// Carga todos los pacientes y guarda en listaPacientes
async function cargarTodosPacientes() {
  listaPacientes = [];
  const snapshot = await getDocs(collection(db, "pacientes"));
  snapshot.forEach((doc) => {
    listaPacientes.push({ id: doc.id, ...doc.data() });
  });
}

// Carga todos los turnos y guarda en listaTurnos
async function cargarTodosTurnos() {
  listaTurnos = [];
  const snapshot = await getDocs(collection(db, "turnos"));
  snapshot.forEach((doc) => {
    listaTurnos.push({ id: doc.id, ...doc.data() });
  });
}
const PACIENTES_POR_PAGINA = 20;
let paginaActual = 1;
let pacientesGlobal = []; // guardamos los pacientes cargados para paginar

async function cargarPacientes() {
  const tablaPacientes = document.getElementById("tablaPacientes");
  if (!tablaPacientes) return;
  tablaPacientes.innerHTML = "";

  try {
    const querySnapshot = await getDocs(collection(db, "pacientes"));
    let pacientes = [];
    querySnapshot.forEach((doc) => {
      pacientes.push({ id: doc.id, ...doc.data() });
    });
    pacientes.sort((a, b) => a.apellido.localeCompare(b.apellido));

    pacientesGlobal = pacientes;
    pacientesGlobalFiltrados = pacientes; // lista usada para mostrar/paginar
    mostrarPagina(paginaActual);

    // Actualizar estadísticas
    actualizarEstadisticasPacientes(pacientes);
  } catch (error) {
    alert("Error al cargar pacientes: " + error.message);
  }
}

function mostrarPagina(pagina) {
  const tablaPacientes = document.getElementById("tablaPacientes");
  tablaPacientes.innerHTML = "";

  const totalPaginas = Math.ceil(
    pacientesGlobalFiltrados.length / PACIENTES_POR_PAGINA
  );

  if (pagina < 1) pagina = 1;
  if (pagina > totalPaginas) pagina = totalPaginas;

  paginaActual = pagina;

  // índice inicial y final para el slice
  const inicio = (pagina - 1) * PACIENTES_POR_PAGINA;
  const fin = inicio + PACIENTES_POR_PAGINA;
  const pacientesPagina = pacientesGlobalFiltrados.slice(inicio, fin);

  pacientesPagina.forEach((p) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${p.apellido}</td>
      <td>${p.nombre}</td>
      <td>${p.dni}</td>
      <td>${p.telefono || "-"}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-secondary ver-ficha me-2" data-id="${
          p.id
        }">Ver ficha</button>
       <button class="btn btn-sm btn-primary editar-paciente" data-id="${
         p.id
       }" title="Editar">
  <i class="bi bi-pencil"></i>
</button>
<button class="btn btn-sm btn-danger eliminar-paciente" data-id="${
      p.id
    }" title="Eliminar">
  <i class="bi bi-trash"></i>
</button>

      </td>
    `;
    tablaPacientes.appendChild(fila);
  });

  // Botones "Ver ficha"
  agregarEventosVerFicha();

  // Agregar eventos para los botones "Editar" y "Eliminar"
  agregarEventosEditarPaciente();
  agregarEventosEliminarPaciente();

  // Actualizar controles de paginación
  mostrarControlesPaginacion(totalPaginas);
}
// Evento para botón Editar
function agregarEventosEditarPaciente() {
  const botonesEditar = document.querySelectorAll(".editar-paciente");

  botonesEditar.forEach((boton) => {
    boton.addEventListener("click", async () => {
      const id = boton.getAttribute("data-id");

      try {
        const docRef = doc(db, "pacientes", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const paciente = docSnap.data();
          abrirModalPaciente(id, paciente); // Abre el modal con los datos
        } else {
          console.error("No se encontró el paciente con ID:", id);
        }
      } catch (error) {
        console.error("Error al obtener paciente:", error);
      }
    });
  });
}

// Evento para botón Eliminar
function agregarEventosEliminarPaciente() {
  document.querySelectorAll(".eliminar-paciente").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      if (confirm("¿Estás seguro que quieres eliminar este paciente?")) {
        try {
          await deleteDoc(doc(db, "pacientes", id));
          alert("Paciente eliminado");
          cargarPacientes(); // recargar la tabla
        } catch (error) {
          alert("Error al eliminar paciente: " + error.message);
        }
      }
    });
  });
}

// Referencia al modal y formulario del modal (estos IDs son los que pusiste en el modal)
// Referencia al modal y formulario del modal (estos IDs son los que pusiste en el modal)
const modalPacienteEl = document.getElementById("modalPaciente");
const modalPaciente = new bootstrap.Modal(modalPacienteEl);
const formModalPaciente = document.getElementById("formModalPaciente");

// Función para abrir modal y cargar datos si es edición o nuevo paciente
function abrirModalPaciente(id = null, paciente = null) {
  pacienteEditandoId = id; // null = nuevo paciente, id para editar

  // Cambiar título del modal según acción
  const tituloModal = modalPacienteEl.querySelector(".modal-title");
  tituloModal.textContent = id ? "Editar Paciente" : "Nuevo Paciente";

  // Cargar datos en inputs o limpiar formulario
  document.getElementById("modalApellido").value = paciente?.apellido || "";
  document.getElementById("modalNombre").value = paciente?.nombre || "";
  document.getElementById("modalDNI").value = paciente?.dni || "";
  document.getElementById("modalTelefono").value = paciente?.telefono || "";
  document.getElementById("modalDireccion").value = paciente?.direccion || "";
  document.getElementById("modalObraSocial").value = paciente?.obraSocial || "";
  document.getElementById("modalGenero").value = paciente?.genero || "";
  document.getElementById("modalFechaNacimiento").value =
    paciente?.fechaNacimiento || "";

  // Quitar validaciones previas si existían
  formModalPaciente.classList.remove("was-validated");

  // Abrir modal
  modalPaciente.show();
}

// Listener para el submit del formulario del modal para crear o editar paciente
// Función auxiliar para marcar error y mostrar mensaje en un input
function marcarError(inputEl, mensaje) {
  inputEl.classList.add("is-invalid");
  let feedback = inputEl.nextElementSibling;
  if (feedback && feedback.classList.contains("invalid-feedback")) {
    feedback.textContent = mensaje;
  }
}

// Limpiar errores previos
function limpiarErrores(form) {
  form.querySelectorAll(".is-invalid").forEach((el) => {
    el.classList.remove("is-invalid");
  });
}

// Listener para el submit del formulario del modal para crear o editar paciente
formModalPaciente.addEventListener("submit", async (e) => {
  e.preventDefault();
  limpiarErrores(formModalPaciente);

  // Campos
  const apellidoEl = document.getElementById("modalApellido");
  const nombreEl = document.getElementById("modalNombre");
  const dniEl = document.getElementById("modalDNI");
  const telefonoEl = document.getElementById("modalTelefono");
  const direccionEl = document.getElementById("modalDireccion");

  const apellido = apellidoEl.value.trim();
  const nombre = nombreEl.value.trim();
  const dni = dniEl.value.trim();
  const telefono = telefonoEl.value.trim();
  const direccion = direccionEl.value.trim();

  let valido = true;

  // Validaciones

  // Apellido obligatorio, solo letras y espacios, max 30
  if (!apellido) {
    marcarError(apellidoEl, "Apellido es obligatorio.");
    valido = false;
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]{1,30}$/.test(apellido)) {
    marcarError(apellidoEl, "Apellido solo letras y máximo 30 caracteres.");
    valido = false;
  }

  // Nombre obligatorio, solo letras y espacios, max 30
  if (!nombre) {
    marcarError(nombreEl, "Nombre es obligatorio.");
    valido = false;
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]{1,30}$/.test(nombre)) {
    marcarError(nombreEl, "Nombre solo letras y máximo 30 caracteres.");
    valido = false;
  }

  // DNI obligatorio, solo números, max 15 (por si hay guiones o espacios)
  if (!dni) {
    marcarError(dniEl, "DNI es obligatorio.");
    valido = false;
  } else if (!/^\d{1,15}$/.test(dni)) {
    marcarError(dniEl, "DNI solo números, hasta 15 dígitos.");
    valido = false;
  }

  // Teléfono opcional, si hay debe ser solo números, max 20
  if (telefono && !/^\d{1,20}$/.test(telefono)) {
    marcarError(telefonoEl, "Teléfono solo números, máximo 20 dígitos.");
    valido = false;
  }

  // Dirección opcional, max 40 caracteres
  if (direccion.length > 40) {
    marcarError(direccionEl, "Dirección máximo 40 caracteres.");
    valido = false;
  }

  if (!valido) {
    return; // Si falla alguna validación no continua
  }

  // Verificar que no exista otro paciente con el mismo DNI (excepto el que editamos)
  try {
    const pacientesSnapshot = await getDocs(collection(db, "pacientes"));
    let dniRepetido = false;
    pacientesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.dni === dni &&
        doc.id !== pacienteEditandoId // No comparar con el mismo paciente que editamos
      ) {
        dniRepetido = true;
      }
    });
    if (dniRepetido) {
      marcarError(dniEl, "Ya existe un paciente con ese DNI.");
      return;
    }
  } catch (error) {
    alert("Error verificando DNI: " + error.message);
    return;
  }

  // Si todo OK crear objeto paciente y guardar en Firestore
  const paciente = {
    apellido,
    nombre,
    dni,
    telefono,
    direccion,
    obraSocial: document.getElementById("modalObraSocial").value.trim(),
    genero: document.getElementById("modalGenero").value,
    fechaNacimiento: document.getElementById("modalFechaNacimiento").value,
  };

  try {
    if (pacienteEditandoId) {
      await updateDoc(doc(db, "pacientes", pacienteEditandoId), paciente);
      alert("Paciente actualizado correctamente");
    } else {
      paciente.fechaIngreso = new Date().toISOString().slice(0, 10);
      await addDoc(collection(db, "pacientes"), paciente);
      alert("Paciente guardado correctamente");
    }

    formModalPaciente.reset();
    formModalPaciente.classList.remove("was-validated");
    modalPaciente.hide();
    pacienteEditandoId = null;
    cargarPacientes();
  } catch (error) {
    alert("Error al guardar paciente: " + error.message);
  }
});

// Función para actualizar estadísticas de pacientes
function actualizarEstadisticasPacientes(pacientes) {
  document.getElementById("estadisticaTotal").textContent = pacientes.length;
  const masculino = pacientes.filter((p) => p.genero === "Masculino").length;
  const femenino = pacientes.filter((p) => p.genero === "Femenino").length;
  const otro = pacientes.filter((p) => p.genero === "Otro").length;

  document.getElementById("estadisticaMasculino").textContent = masculino;
  document.getElementById("estadisticaFemenino").textContent = femenino;
  document.getElementById("estadisticaOtro").textContent = otro;
}

function mostrarControlesPaginacion(totalPaginas) {
  // Creamos o reemplazamos div con controles (lo insertamos abajo de la tabla)
  let controles = document.getElementById("controlesPaginacion");
  if (!controles) {
    controles = document.createElement("div");
    controles.id = "controlesPaginacion";
    controles.className = "d-flex justify-content-center gap-2 my-3";
    const tabla = document.querySelector("table");
    tabla.parentNode.insertBefore(controles, tabla.nextSibling);
  }
  controles.innerHTML = "";

  // Botón anterior
  const btnPrev = document.createElement("button");
  btnPrev.className = "btn btn-sm btn-outline-primary";
  btnPrev.textContent = "Anterior";
  btnPrev.disabled = paginaActual === 1;
  btnPrev.addEventListener("click", () => {
    if (paginaActual > 1) {
      mostrarPagina(paginaActual - 1);
    }
  });
  controles.appendChild(btnPrev);

  // Texto página actual
  const spanPagina = document.createElement("span");
  spanPagina.className = "align-self-center";
  spanPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
  controles.appendChild(spanPagina);

  // Botón siguiente
  const btnNext = document.createElement("button");
  btnNext.className = "btn btn-sm btn-outline-primary";
  btnNext.textContent = "Siguiente";
  btnNext.disabled = paginaActual === totalPaginas;
  btnNext.addEventListener("click", () => {
    if (paginaActual < totalPaginas) {
      mostrarPagina(paginaActual + 1);
    }
  });
  controles.appendChild(btnNext);
}

// Función para agregar eventos "Ver ficha" y manejar mostrar/ocultar elementos
function agregarEventosVerFicha() {
  document.querySelectorAll(".ver-ficha").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pacienteId = e.target.dataset.id;
      if (!pacienteId) return;

      // Abre ficha.html en pestaña nueva con el ID del paciente
      window.open(`ficha.html?id=${pacienteId}`, "_blank");
    });
  });
}

// Función para mostrar la gestión de pacientes con IDs para ocultar/mostrar elementos
function mostrarGestionPacientes() {
  mainContent.innerHTML = `
    <style>
      #seccionPacientes {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
      }
      #seccionPacientes .row {
        column-gap: 30px;
      }
      #seccionPacientes .col-lg-3 {
        max-width: 220px;
        flex: 0 0 220px;
      }
      #seccionPacientes .text-end {
        text-align: right !important;
      }
      #seccionPacientes #buscadorPacientes {
        max-width: 300px;
      }
      #seccionPacientes #btnNuevoPaciente {
        white-space: nowrap;
      }
      #seccionPacientes #filtroPacientesNuevosContainer {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
        flex-wrap: wrap;
      }
      #seccionPacientes #filtroPacientesNuevosFechas label {
        margin-right: 5px;
      }
      #seccionPacientes #filtroPacientesNuevosFechas input {
        margin-right: 15px;
        max-width: 140px;
      }
    </style>

    <div id="seccionPacientes">
      <div class="row">
        <div class="col-lg-8">
          <div id="tituloPacientes" class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="mb-0">Mis Pacientes</h2>
            <div class="dropdown">
              <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                + Nuevo
              </button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="#" id="opcionNuevoPaciente">Nuevo Paciente</a></li>
                <li><a class="dropdown-item" href="#" id="opcionNuevoPresupuesto">Nuevo Presupuesto</a></li>
              </ul>
            </div>
          </div>

          <div id="contenedorBuscadorBtn" class="d-flex gap-2 mb-3">
            <input type="text" class="form-control" id="buscadorPacientes" placeholder="Buscar paciente..." />
          </div>

          <div id="filtroPacientesNuevosContainer">
            <button class="btn btn-outline-secondary" id="btnFiltrarNuevos">Ver pacientes nuevos</button>
            <div id="filtroPacientesNuevosFechas">
              <label for="fechaDesde">Desde:</label>
              <input type="date" id="fechaDesde" />
              <label for="fechaHasta">Hasta:</label>
              <input type="date" id="fechaHasta" />
            </div>
          </div>

          <table class="table table-striped">
            <thead>
              <tr>
                <th>Apellido</th>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="tablaPacientes"></tbody>
          </table>

          <div id="paginacionPacientes" class="d-flex justify-content-center mb-3"></div>
          <div id="contenedorFichaPaciente" style="display:none; margin-top: 1rem;"></div>
        </div>

        <div id="estadisticasPacientes" class="col-lg-3">
          <div class="card mb-3">
            <div class="card-body">
              <h5 class="card-title">Pacientes totales</h5>
              <p id="estadisticaTotal" class="card-text fw-bold">0</p>
            </div>
          </div>
          <div class="card mb-3">
            <div class="card-body">
              <h5 class="card-title">Balance de género</h5>
              <ul class="list-group list-group-flush">
                <li class="list-group-item">Masculino: <span id="estadisticaMasculino">0</span></li>
                <li class="list-group-item">Femenino: <span id="estadisticaFemenino">0</span></li>
                <li class="list-group-item">Otro: <span id="estadisticaOtro">0</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Variables y elementos
  const inputBuscador = document.getElementById("buscadorPacientes");
  const btnFiltrarNuevos = document.getElementById("btnFiltrarNuevos");
  const fechaDesde = document.getElementById("fechaDesde");
  const fechaHasta = document.getElementById("fechaHasta");
  const opcionNuevoPaciente = document.getElementById("opcionNuevoPaciente");
  const opcionNuevoPresupuesto = document.getElementById("opcionNuevoPresupuesto");

  let filtroNuevosActivo = false;

  opcionNuevoPaciente.addEventListener("click", (e) => {
    e.preventDefault();
    abrirModalPaciente();
  });

  opcionNuevoPresupuesto.addEventListener("click", (e) => {
    e.preventDefault();
    abrirModalPresupuesto();
  });

  inputBuscador.addEventListener("input", () => {
    filtrarPacientes();
  });

  fechaDesde.addEventListener("change", () => {
    if (filtroNuevosActivo) filtrarPacientes();
  });

  fechaHasta.addEventListener("change", () => {
    if (filtroNuevosActivo) filtrarPacientes();
  });

  btnFiltrarNuevos.addEventListener("click", () => {
    filtroNuevosActivo = !filtroNuevosActivo;

    btnFiltrarNuevos.classList.toggle("btn-outline-secondary", !filtroNuevosActivo);
    btnFiltrarNuevos.classList.toggle("btn-secondary", filtroNuevosActivo);

    if (filtroNuevosActivo) {
      const hoy = new Date();
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      fechaDesde.value = primerDia.toISOString().split("T")[0];
      fechaHasta.value = ultimoDia.toISOString().split("T")[0];
    }

    filtrarPacientes();
  });

  function filtrarPacientes() {
    const texto = inputBuscador.value.trim().toLowerCase();
    const desdeVal = fechaDesde.value;
    const hastaVal = fechaHasta.value;

    pacientesGlobalFiltrados = pacientesGlobal.filter((p) => {
      const nombreCompleto = (p.nombre + " " + p.apellido).toLowerCase();
      const nombreInvertido = (p.apellido + " " + p.nombre).toLowerCase();
      const dni = p.dni?.toString().toLowerCase() || "";

      const coincideTexto =
        nombreCompleto.includes(texto) ||
        nombreInvertido.includes(texto) ||
        dni.includes(texto);

      if (!coincideTexto) return false;

      if (filtroNuevosActivo) {
        const fechaIngreso = p.fechaIngreso || "";
        if (!fechaIngreso) return false;
        if (desdeVal && fechaIngreso < desdeVal) return false;
        if (hastaVal && fechaIngreso > hastaVal) return false;
      }

      return true;
    });

    paginaActual = 1;
    mostrarPagina(paginaActual);
  }

  cargarPacientes();
}


function mostrarFormularioEdicion(id, paciente) {
  pacienteEditandoId = id;

  // Cargar datos en inputs del modal
  document.getElementById("modalApellido").value = paciente.apellido || "";
  document.getElementById("modalNombre").value = paciente.nombre || "";
  document.getElementById("modalDni").value = paciente.dni || "";
  document.getElementById("modalTelefono").value = paciente.telefono || "";
  document.getElementById("modalDireccion").value = paciente.direccion || "";
  document.getElementById("modalObraSocial").value = paciente.obraSocial || "";
  document.getElementById("modalGenero").value = paciente.genero || "";
  document.getElementById("modalFechaNacimiento").value =
    paciente.fechaNacimiento || "";

  // Cambiar el texto del botón
  document.getElementById("btnGuardarPaciente").textContent = "Guardar Cambios";

  // Abrir el modal
  const modal = new bootstrap.Modal(
    document.getElementById("modalFormularioPaciente")
  );
  modal.show();

  // Enfocar el primer campo
  document.getElementById("modalApellido").focus();
}
async function mostrarPresupuestosPaciente(pacienteId) {
  const contenedor = document.getElementById("listaPresupuestos");
  contenedor.innerHTML = "<p>Cargando presupuestos...</p>";

  try {
    const presupuestosRef = collection(db, "presupuestos");
    const q = query(presupuestosRef, where("pacienteId", "==", pacienteId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      contenedor.innerHTML = "<p>No hay presupuestos registrados.</p>";
      return;
    }

    let html = "";
    querySnapshot.forEach((doc) => {
      const p = doc.data();
      html += `
        <div class="card mb-2">
          <div class="card-body">
            <h5 class="card-title">${p.tratamiento}</h5>
            <p class="card-text">Fecha: ${p.fecha}</p>
            <p class="card-text">Monto: $${p.importe}</p>
            <p class="card-text">Cuotas: ${p.cuotas} x $${p.montoCuota}</p>
          </div>
        </div>
      `;
    });

    contenedor.innerHTML = html;
  } catch (error) {
    contenedor.innerHTML = "<p>Error al cargar los presupuestos.</p>";
    console.error("Error obteniendo presupuestos:", error);
  }
}

// Referencias modal y formulario Presupuesto
const modalPresupuestoEl = document.getElementById("modalPresupuesto");
const modalPresupuesto = new bootstrap.Modal(modalPresupuestoEl);
const formModalPresupuesto = document.getElementById("formModalPresupuesto");
const listaPacientesDatalist = document.getElementById("listaPacientes");
const inputPaciente = document.getElementById("presupuestoPaciente");

const inputFecha = document.getElementById("presupuestoFecha");
const selectTratamiento = document.getElementById("presupuestoTratamiento");
const selectCuotas = document.getElementById("presupuestoCuotas");
const inputMontoPorCuota = document.getElementById("montoPorCuota");
const inputTotalPresupuesto = document.getElementById("totalPresupuesto");

let pacientesParaDatalist = []; // lista local para validar paciente al guardar

// Cargar pacientes para autocompletar datalist
async function cargarPacientesDatalist() {
  pacientesParaDatalist = [];
  listaPacientesDatalist.innerHTML = "";

  const snapshot = await getDocs(collection(db, "pacientes"));
  snapshot.forEach((doc) => {
    const p = { id: doc.id, ...doc.data() };
    pacientesParaDatalist.push(p);
    const option = document.createElement("option");
    option.value = p.nombre + " " + p.apellido; // Mostrar nombre completo
    listaPacientesDatalist.appendChild(option);
  });
}

// Validar paciente ingresado (que exista en la lista)
function obtenerPacienteSeleccionado() {
  const texto = inputPaciente.value.trim().toLowerCase();
  return pacientesParaDatalist.find(
    (p) => (p.nombre + " " + p.apellido).toLowerCase() === texto
  );
}

// Actualizar monto por cuota según total y cuotas
function actualizarMontoPorCuota() {
  const total = parseFloat(inputTotalPresupuesto.value) || 0;
  const cuotas = parseInt(selectCuotas.value) || 1;
  const montoCuota = cuotas > 0 ? total / cuotas : 0;
  inputMontoPorCuota.value = montoCuota.toFixed(2);
}

// Eventos para actualizar monto por cuota cuando cambian cuotas o total
selectCuotas.addEventListener("change", actualizarMontoPorCuota);
inputTotalPresupuesto.addEventListener("input", actualizarMontoPorCuota);

// Evento submit formulario presupuesto
formModalPresupuesto.addEventListener("submit", async (e) => {
  e.preventDefault();
  formModalPresupuesto.classList.add("was-validated");

  // Validar paciente
  const pacienteSeleccionado = obtenerPacienteSeleccionado();
  if (!pacienteSeleccionado) {
    inputPaciente.classList.add("is-invalid");
    return;
  } else {
    inputPaciente.classList.remove("is-invalid");
  }

  // Validar tratamiento
  if (!selectTratamiento.value) {
    selectTratamiento.classList.add("is-invalid");
    return;
  } else {
    selectTratamiento.classList.remove("is-invalid");
  }

  // Validar fecha
  if (!inputFecha.value) {
    inputFecha.classList.add("is-invalid");
    return;
  } else {
    inputFecha.classList.remove("is-invalid");
  }

  // Validar monto total
  const total = parseFloat(inputTotalPresupuesto.value);
  if (isNaN(total) || total <= 0) {
    inputTotalPresupuesto.classList.add("is-invalid");
    return;
  } else {
    inputTotalPresupuesto.classList.remove("is-invalid");
  }

  // Crear objeto presupuesto
  const presupuesto = {
    pacienteId: pacienteSeleccionado.id,
    pacienteNombre:
      pacienteSeleccionado.nombre + " " + pacienteSeleccionado.apellido,
    fechaCreacion: inputFecha.value,
    tratamiento: selectTratamiento.value,
    cuotas: parseInt(selectCuotas.value),
    montoPorCuota: parseFloat(inputMontoPorCuota.value),
    lineas: [], // ya no hay líneas
    total: total,
    estado: "Pendiente",
  };

  try {
    await addDoc(collection(db, "presupuestos"), presupuesto);
    alert("Presupuesto guardado correctamente");
    formModalPresupuesto.reset();
    inputMontoPorCuota.value = "0";
    modalPresupuesto.hide();
  } catch (error) {
    alert("Error guardando presupuesto: " + error.message);
  }
});

// Inicialización
cargarPacientesDatalist();
actualizarMontoPorCuota();

// --- GESTIÓN TURNOS ---

async function cargarPacientesSelect() {
  const pacienteSelect = document.getElementById("pacienteSelect");
  if (!pacienteSelect) return;
  pacienteSelect.innerHTML = `<option value="" disabled selected>Seleccionar paciente</option>`;
  const pacientesSnapshot = await getDocs(collection(db, "pacientes"));
  pacientesSnapshot.forEach((doc) => {
    const p = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = `${p.apellido} ${p.nombre}`;
    pacienteSelect.appendChild(option);
  });
}

// Función para cargar y mostrar los turnos filtrados y paginados
async function cargarTurnosPaginados(
  pagina = 1,
  porPagina = 20,
  filtroDiaSemana = ""
) {
  const tablaTurnos = document.getElementById("tablaTurnos");
  const paginacion = document.getElementById("paginacionTurnos");
  if (!tablaTurnos || !paginacion) return;

  tablaTurnos.innerHTML = "";
  paginacion.innerHTML = "";

  const busqueda = document
    .getElementById("inputBusquedaPaciente")
    .value.trim()
    .toLowerCase();
  const fechaDesde = document.getElementById("inputFechaDesde").value;
  const fechaHasta = document.getElementById("inputFechaHasta").value;
  const estado = document.getElementById("selectEstado").value;
  const pago = document.getElementById("selectPago").value;

  const formatDate = (date) => date.toISOString().split("T")[0];

  try {
    const snapshot = await getDocs(collection(db, "turnos"));
    let turnos = [];

    snapshot.forEach((doc) => {
      const t = { id: doc.id, ...doc.data() };
      const pacienteLower = t.pacienteNombre.toLowerCase();

      if (busqueda !== "") {
        if (pacienteLower.includes(busqueda)) {
          turnos.push(t);
        }
      } else {
        let cumpleFecha = true;
        if (filtroDiaSemana === "hoy") {
          const hoy = formatDate(new Date());
          cumpleFecha = t.fecha === hoy;
        } else if (filtroDiaSemana === "semana") {
          const hoy = new Date();
          const dia = hoy.getDay();
          const lunes = new Date(hoy);
          lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1));
          const sabado = new Date(lunes);
          sabado.setDate(lunes.getDate() + 5);
          cumpleFecha =
            t.fecha >= formatDate(lunes) && t.fecha <= formatDate(sabado);
        } else {
          if (fechaDesde && t.fecha < fechaDesde) cumpleFecha = false;
          if (fechaHasta && t.fecha > fechaHasta) cumpleFecha = false;
        }

        let cumpleEstado = true;
        switch (estado) {
          case "asistio":
            cumpleEstado = t.asistio === true;
            break;
          case "cancelado":
            cumpleEstado = t.cancelado === true;
            break;
          case "ausente":
            cumpleEstado = t.ausente === true;
            break;
          case "pendiente":
            cumpleEstado = !t.asistio && !t.cancelado && !t.ausente;
            break;
          default:
            cumpleEstado = true;
        }

        let cumplePago = true;
        switch (pago) {
          case "pagado":
            cumplePago = t.estadoPago === "pagado";
            break;
          case "pendiente":
            cumplePago =
              (t.estadoPago === "pendiente" || !t.estadoPago) &&
              (!t.montoAbonado || t.montoAbonado <= 0);
            break;
          default:
            cumplePago = true;
        }

        if (cumpleFecha && cumpleEstado && cumplePago) {
          turnos.push(t);
        }
      }
    });

    turnos.sort((a, b) =>
      `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`)
    );

    const totalPaginas = Math.ceil(turnos.length / porPagina);
    if (pagina > totalPaginas && totalPaginas > 0) pagina = totalPaginas; // Ajuste si página supera total

    const desde = (pagina - 1) * porPagina;
    const hasta = desde + porPagina;
    const turnosPagina = turnos.slice(desde, hasta);

    for (const t of turnosPagina) {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${t.fecha}</td>
        <td>${t.hora}</td>
        <td>${t.pacienteNombre}</td>
        <td>${t.tipoConsulta || "-"}</td>
        <td>
          ${
            t.asistio
              ? '<span class="text-success fw-bold">Asistió</span>'
              : t.cancelado
              ? '<span class="text-warning fw-bold">Cancelado</span>'
              : t.ausente
              ? '<span class="text-secondary fw-bold">Ausente</span>'
              : "-"
          }
        </td>
        <td>
          ${
            (t.estadoPago === "pendiente" || !t.estadoPago) &&
            (!t.montoAbonado || t.montoAbonado <= 0)
              ? '<span class="badge bg-warning text-dark">Pago pendiente</span>'
              : t.montoAbonado && t.montoAbonado > 0
              ? `$${t.montoAbonado.toFixed(2)}`
              : "-"
          }
        </td>
        <td>
          <div class="d-flex justify-content-end gap-4 flex-wrap">
            <div class="d-flex gap-2">
              ${
                !t.asistio && !t.cancelado && !t.ausente
                  ? `
                    <button class="btn btn-sm btn-success btn-asistio" data-id="${t.id}" title="Marcar como asistió"><i class="bi bi-check-circle"></i></button>
                    <button class="btn btn-sm btn-warning btn-cancelar" data-id="${t.id}" title="Marcar como cancelado"><i class="bi bi-x-octagon"></i></button>
                    <button class="btn btn-sm btn-secondary btn-ausente" data-id="${t.id}" title="Marcar como ausente"><i class="bi bi-person-x"></i></button>
                  `
                  : ""
              }
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-info btn-editar" data-id="${
                t.id
              }" title="Editar turno"><i class="bi bi-pencil"></i></button>
              ${
                t.asistio
                  ? `<button class="btn btn-sm btn-outline-danger" disabled title="No se puede eliminar un turno asistido"><i class="bi bi-trash" style="text-decoration: line-through; opacity: 0.5;"></i></button>`
                  : `<button class="btn btn-sm btn-danger btn-eliminar" data-id="${t.id}" title="Eliminar turno"><i class="bi bi-trash"></i></button>`
              }
            </div>
          </div>
        </td>
      `;
      tablaTurnos.appendChild(fila);
    }

    // Crear paginación
    if (totalPaginas > 1) {
      // Botón "Anterior"
      const btnAnterior = document.createElement("button");
      btnAnterior.textContent = "Anterior";
      btnAnterior.className = "btn btn-sm btn-primary me-2";
      btnAnterior.disabled = pagina === 1;
      btnAnterior.addEventListener("click", () => {
        cargarTurnosPaginados(pagina - 1, porPagina, filtroDiaSemana);
      });
      paginacion.appendChild(btnAnterior);

      // Botones numéricos
      for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className =
          "btn btn-sm me-1 " +
          (i === pagina ? "btn-primary" : "btn-outline-primary");
        btn.disabled = i === pagina;
        btn.addEventListener("click", () => {
          cargarTurnosPaginados(i, porPagina, filtroDiaSemana);
        });
        paginacion.appendChild(btn);
      }

      // Botón "Siguiente"
      const btnSiguiente = document.createElement("button");
      btnSiguiente.textContent = "Siguiente";
      btnSiguiente.className = "btn btn-sm btn-primary ms-2";
      btnSiguiente.disabled = pagina === totalPaginas;
      btnSiguiente.addEventListener("click", () => {
        cargarTurnosPaginados(pagina + 1, porPagina, filtroDiaSemana);
      });
      paginacion.appendChild(btnSiguiente);
    }

    // ⬇️ Event listener para botón "Editar"
    document.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const docSnap = await getDoc(doc(db, "turnos", id));
        if (docSnap.exists()) {
          const t = docSnap.data();

          document.getElementById("editarTurnoId").value = id;
          document.getElementById("editarFecha").value = t.fecha || "";
          document.getElementById("editarHora").value = t.hora || "";

          // Estado del turno (de booleanos a select)
          if (t.asistio) {
            document.getElementById("editarEstado").value = "asistio";
          } else if (t.cancelado) {
            document.getElementById("editarEstado").value = "cancelado";
          } else if (t.ausente) {
            document.getElementById("editarEstado").value = "ausente";
          } else {
            document.getElementById("editarEstado").value = "";
          }

          // Estado de pago y campos relacionados
          const pagoEstado = t.estadoPago || "";
          const inputEstadoPago = document.getElementById("editarPagoEstado");
          const inputMonto = document.getElementById("editarMonto");
          const inputDetalle = document.getElementById("editarDetalle");
          const divMonto = document.getElementById("editarDivMonto");
          const divDetalle = document.getElementById("editarDivDetalle");

          inputEstadoPago.value = pagoEstado;
          inputMonto.value = t.montoAbonado || "";
          inputDetalle.value = t.detalleDeuda || "";

          function actualizarCamposPago(estado) {
            if (estado === "pagado") {
              divMonto.style.display = "block";
              divDetalle.style.display = "none";
              inputDetalle.value = "";
            } else if (estado === "pendiente") {
              divMonto.style.display = "none";
              divDetalle.style.display = "block";
              inputMonto.value = "";
            } else {
              divMonto.style.display = "none";
              divDetalle.style.display = "none";
              inputMonto.value = "";
              inputDetalle.value = "";
            }
          }

          actualizarCamposPago(pagoEstado);

          inputEstadoPago.onchange = function () {
            actualizarCamposPago(this.value);
          };

          new bootstrap.Modal(
            document.getElementById("modalEditarTurno")
          ).show();
        }
      });
    });

    // ⬇️ Event listeners para botones de marcar estado del turno
    document.querySelectorAll(".btn-asistio").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await updateDoc(doc(db, "turnos", id), {
            asistio: true,
            cancelado: false,
            ausente: false,
          });
          cargarTurnosPaginados(pagina, porPagina, filtroDiaSemana);
        } catch (error) {
          alert("Error al marcar asistió: " + error.message);
        }
      });
    });

    document.querySelectorAll(".btn-cancelar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await updateDoc(doc(db, "turnos", id), {
            asistio: false,
            cancelado: true,
            ausente: false,
          });
          cargarTurnosPaginados(pagina, porPagina, filtroDiaSemana);
        } catch (error) {
          alert("Error al marcar cancelado: " + error.message);
        }
      });
    });

    document.querySelectorAll(".btn-ausente").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await updateDoc(doc(db, "turnos", id), {
            asistio: false,
            cancelado: false,
            ausente: true,
          });
          cargarTurnosPaginados(pagina, porPagina, filtroDiaSemana);
        } catch (error) {
          alert("Error al marcar ausente: " + error.message);
        }
      });
    });

    // ⬇️ Event listener para botón "Eliminar"
    document.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (confirm("¿Seguro que querés eliminar este turno?")) {
          try {
            await deleteDoc(doc(db, "turnos", id));
            cargarTurnosPaginados(pagina, porPagina, filtroDiaSemana);
          } catch (error) {
            alert("Error al eliminar turno: " + error.message);
          }
        }
      });
    });
  } catch (err) {
    alert("Error al cargar turnos: " + err.message);
  }
}

// ⬇️ Manejador del formulario para guardar cambios del turno
document
  .getElementById("formEditarTurno")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editarTurnoId").value;
    const fecha = document.getElementById("editarFecha").value;
    const hora = document.getElementById("editarHora").value;
    const estado = document.getElementById("editarEstado").value;
    const estadoPago = document.getElementById("editarPagoEstado").value;
    const montoAbonado =
      parseFloat(document.getElementById("editarMonto").value) || 0;
    const detalleDeuda = document.getElementById("editarDetalle").value.trim();

    const datosEstado = {
      asistio: false,
      cancelado: false,
      ausente: false,
    };
    if (estado === "asistio") datosEstado.asistio = true;
    else if (estado === "cancelado") datosEstado.cancelado = true;
    else if (estado === "ausente") datosEstado.ausente = true;

    const datos = {
      fecha,
      hora,
      estadoPago,
      montoAbonado: estadoPago === "pagado" ? montoAbonado : 0,
      detalleDeuda: estadoPago === "pendiente" ? detalleDeuda : "",
      ...datosEstado,
    };

    try {
      await updateDoc(doc(db, "turnos", id), datos);
      // Cerrar modal correctamente
      const modalElement = document.getElementById("modalEditarTurno");
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance.hide();

      cargarTurnosPaginados(); // Recargar lista
      alert("Turno actualizado correctamente.");
    } catch (error) {
      console.error("Error al actualizar el turno:", error);
      alert("No se pudo actualizar el turno.");
    }
  });

// Quitar backdrop y scroll lock al cerrar modal
document
  .getElementById("modalEditarTurno")
  .addEventListener("hidden.bs.modal", () => {
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((bd) => bd.remove());
    document.body.classList.remove("modal-open");
  });

// Referencia al modal de Bootstrap
const modalPagoTurno = new bootstrap.Modal(
  document.getElementById("modalPagoTurno")
);

// Mostrar/Ocultar campos según estado de pago seleccionado
document
  .getElementById("selectEstadoPago")
  .addEventListener("change", function () {
    const estado = this.value;
    document.getElementById("divMontoPago").style.display =
      estado === "pagado" ? "block" : "none";
    document.getElementById("divDetallePago").style.display =
      estado === "pendiente" ? "block" : "none";
  });

// Abrir modal para pago cuando clickeás "Asistió"
document.addEventListener("click", async (e) => {
  if (e.target.closest(".btn-asistio")) {
    const id = e.target.closest(".btn-asistio").getAttribute("data-id");
    if (!id) return;

    try {
      const docTurno = await getDoc(doc(db, "turnos", id));
      if (!docTurno.exists()) {
        alert("Turno no encontrado");
        return;
      }
      const turno = docTurno.data();

      document.getElementById("pagoPacienteNombre").textContent =
        turno.pacienteNombre || "-";
      document.getElementById("pagoFecha").textContent = turno.fecha || "-";
      document.getElementById("pagoTipoConsulta").textContent =
        turno.tipoConsulta || "-";

      document.getElementById("selectEstadoPago").value =
        turno.estadoPago || "";
      document.getElementById("inputMontoPago").value =
        turno.montoAbonado || "";
      document.getElementById("textareaDetallePago").value =
        turno.detalleDeuda || "";
      document.getElementById("idTurnoPago").value = id;

      // Mostrar campos según estado actual
      const estado = turno.estadoPago || "";
      document.getElementById("divMontoPago").style.display =
        estado === "pagado" ? "block" : "none";
      document.getElementById("divDetallePago").style.display =
        estado === "pendiente" ? "block" : "none";

      modalPagoTurno.show();
    } catch (error) {
      alert("Error al cargar turno: " + error.message);
    }
  }
});

// Manejar submit del formulario de pago
document
  .getElementById("formPagoTurno")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const idTurno = document.getElementById("idTurnoPago").value;
    const estadoPago = document.getElementById("selectEstadoPago").value;
    const montoPago =
      parseFloat(document.getElementById("inputMontoPago").value) || 0;
    const detallePago = document
      .getElementById("textareaDetallePago")
      .value.trim();

    if (!estadoPago) {
      alert("Seleccioná un estado de pago.");
      return;
    }

    if (estadoPago === "pagado" && montoPago <= 0) {
      alert("Ingresá un monto válido mayor a cero.");
      return;
    }

    try {
      // Actualizar turno con datos de pago y marcar asistió
      await updateDoc(doc(db, "turnos", idTurno), {
        asistio: true,
        cancelado: false,
        ausente: false,
        estadoPago,
        montoAbonado: estadoPago === "pagado" ? montoPago : 0,
        detalleDeuda: estadoPago === "pendiente" ? detallePago : "",
      });

      // Si el pago es pagado y monto > 0, agregar registro en caja
      if (estadoPago === "pagado" && montoPago > 0) {
        const turnoDoc = await getDoc(doc(db, "turnos", idTurno));
        const turnoData = turnoDoc.data();

        await addDoc(collection(db, "caja"), {
          fecha: turnoData.fecha,
          hora: turnoData.hora || "00:00",
          tipo: "ingreso",
          concepto: `Pago de consulta`,
          monto: montoPago,
          turnoId: idTurno,
          pacienteNombre: turnoData.pacienteNombre || "",
          tipoConsulta: turnoData.tipoConsulta || "",
          detalle: "Pago de consulta",
          creadoEn: new Date().toISOString(),
        });
      }
      modalPagoTurno.hide();
      cargarTurnosPaginados();
      alert("Pago registrado y turno marcado como asistido.");
    } catch (error) {
      alert("Error al guardar pago: " + error.message);
    }
  });

async function obtenerEventosEnRango(fechaInicio, fechaFin) {
  const eventos = [];
  try {
    const snapshot = await getDocs(collection(db, "turnos"));
    const pacientesSnap = await getDocs(collection(db, "pacientes"));

    // Mapa rápido de pacientes por id
    const mapaPacientes = {};
    pacientesSnap.forEach((doc) => {
      mapaPacientes[doc.id] = doc.data();
    });

    // Parseo fechas límite como objetos Date para comparar
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    snapshot.forEach((doc) => {
      const turno = doc.data();

      // Parsear la fecha+hora del turno a Date
      const turnoFecha = new Date(`${turno.fecha}T${turno.hora}`);

      // Verificar que el turno esté dentro del rango (inclusive)
      if (turnoFecha >= inicio && turnoFecha <= fin) {
        const duracionMinutos = Number(turno.duracionMinutos);
        const minutosFinal = isNaN(duracionMinutos) ? 15 : duracionMinutos;
        const end = new Date(turnoFecha.getTime() + minutosFinal * 60000);

        // Nombre a mostrar
        let nombrePacienteMostrar = "Consulta";
        if (turno.pacienteId && mapaPacientes[turno.pacienteId]) {
          const p = mapaPacientes[turno.pacienteId];
          nombrePacienteMostrar = p.apellido + ", " + p.nombre;
        } else if (turno.nombre) {
          nombrePacienteMostrar = turno.nombre;
        } else if (turno.pacienteNombre) {
          nombrePacienteMostrar = turno.pacienteNombre;
        }

        eventos.push({
          title:
            nombrePacienteMostrar +
            (turno.tipoConsulta ? " - " + turno.tipoConsulta : ""),
          start: turnoFecha,
          end,
          extendedProps: {
            pacienteId: turno.pacienteId,
            asistio: turno.asistio,
            tipoConsulta: turno.tipoConsulta,
          },
        });
      }
    });
  } catch (error) {
    console.error("Error al obtener eventos:", error);
  }
  return eventos;
}

async function mostrarAgendaTurnos() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Gestión de Turnos</h1>

    <!-- Formulario para agendar turno -->
    <div class="border rounded p-3 mb-4">
      <form id="formTurno" class="row g-3">
        <div class="col-md-4">
          <label for="fechaTurno" class="form-label">Fecha *</label>
          <input type="date" id="fechaTurno" class="form-control" required />
        </div>
        <div class="col-md-2">
          <label for="horaTurno" class="form-label">Hora *</label>
          <select id="horaTurno" class="form-select" required>
            <option value="" disabled selected>Hora</option>
          </select>
        </div>
        <div class="col-md-2">
          <label for="minutosTurno" class="form-label">Minutos *</label>
          <select id="minutosTurno" class="form-select" required>
            <option value="" disabled selected>Minutos</option>
          </select>
        </div>
        <div class="col-md-4">
          <label for="pacienteSelect" class="form-label">Paciente *</label>
          <select id="pacienteSelect" class="form-select" required>
            <option value="" disabled selected>Cargando pacientes...</option>
          </select>
        </div>
        <div class="col-md-6">
          <label for="tipoConsulta" class="form-label">Tipo de Consulta</label>
          <select id="tipoConsulta" class="form-select">
            <option value="" disabled selected>Seleccionar tipo</option>
            <option value="Consulta general">Consulta general</option>
            <option value="Control ortodoncia">Control ortodoncia</option>
            <option value="Extracción">Extracción</option>
            <option value="Reconstrucción">Reconstrucción</option>
            <option value="Limpieza">Limpieza</option>
          </select>
        </div>
        <div class="col-md-6">
          <label for="duracionTurno" class="form-label">Duración (minutos)</label>
          <select id="duracionTurno" class="form-select">
            <option value="15" selected>15</option>
            <option value="30">30</option>
            <option value="45">45</option>
            <option value="60">60</option>
          </select>
        </div>
        <div class="col-md-6 d-flex align-items-end">
          <button type="submit" class="btn btn-primary">Agregar Turno</button>
        </div>
      </form>
    </div>

    <!-- Filtros -->
    <div class="border rounded p-3 mb-4">
      <form id="formFiltrosTurnos" class="row g-3 align-items-center">
        <div class="col-md-3">
          <label for="inputBusquedaPaciente" class="form-label">Buscar paciente</label>
          <input
            type="text"
            id="inputBusquedaPaciente"
            class="form-control"
            placeholder="Nombre, apellido o DNI"
            autocomplete="off"
          />
        </div>
        <div class="col-md-2">
          <label for="inputFechaDesde" class="form-label">Fecha desde</label>
          <input type="date" id="inputFechaDesde" class="form-control" />
        </div>
        <div class="col-md-2">
          <label for="inputFechaHasta" class="form-label">Fecha hasta</label>
          <input type="date" id="inputFechaHasta" class="form-control" />
        </div>
        <div class="col-md-2 d-flex flex-column">
          <label class="form-label">Rango</label>
          <div>
            <button type="button" id="btnHoy" class="btn btn-outline-primary me-2">Hoy</button>
            <button type="button" id="btnSemana" class="btn btn-outline-primary">Semana</button>
          </div>
        </div>
<div class="col-md-2">
  <label for="selectEstado" class="form-label">Estado</label>
  <select id="selectEstado" class="form-select">
    <option value="todos" selected>Todos</option>
    <option value="asistio">Asistió</option>
    <option value="cancelado">Cancelado</option>
    <option value="ausente">Ausente</option>
    <option value="pendiente">Pendiente</option>
  </select>
</div>
<div class="col-md-1">
  <label for="selectPago" class="form-label">Pago</label>
  <select id="selectPago" class="form-select">
    <option value="todos" selected>Todos</option>
    <option value="pagado">Pagado</option>
    <option value="pendiente">Pendiente</option>
  </select>
</div>


      </form>
    </div>

    <table class="table table-striped">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Paciente</th>
          <th>Tipo Consulta</th>
          <th>Asistió</th>
          <th>Monto abonado</th>
          <th style="text-align: right; padding-right: 3rem;">Acciones</th>
        </tr>
      </thead>
      <tbody id="tablaTurnos"></tbody>
    </table>
    <div id="paginacionTurnos" class="my-3 d-flex justify-content-center align-items-center"></div>
  `;

  cargarPacientesSelect();
  cargarTurnosPaginados();

  const horaTurno = document.getElementById("horaTurno");
  const minutosTurno = document.getElementById("minutosTurno");
  const fechaTurno = document.getElementById("fechaTurno");

  // Horas y minutos fijos
  const horas = Array.from({ length: 15 }, (_, i) =>
    (i + 7).toString().padStart(2, "0")
  );
  const minutos = ["00", "15", "30", "45"];

  fechaTurno.addEventListener("change", async () => {
    const fecha = fechaTurno.value;
    if (!fecha) return;

    const turnosSnapshot = await getDocs(collection(db, "turnos"));
    const horasDisponibles = new Set(horas);

    // Limpiar minutos hasta que se elija hora
    minutosTurno.innerHTML = `<option value="" disabled selected>Minutos</option>`;

    turnosSnapshot.forEach((doc) => {
      const t = doc.data();
      if (t.fecha !== fecha) return;

      const inicio = new Date(`${t.fecha}T${t.hora}`);
      const duracion = Number(t.duracionMinutos) || 15;
      const fin = new Date(inicio.getTime() + duracion * 60000);

      // Marcar como ocupadas las horas completas si tienen minutos solapados
      let bloque = new Date(inicio);
      while (bloque < fin) {
        const h = bloque.getHours().toString().padStart(2, "0");
        horasDisponibles.add(h); // Nos aseguramos de que estén todas (en caso de errores previos)
        bloque = new Date(bloque.getTime() + 15 * 60000);
      }
    });

    // Renderizar las horas disponibles (en todas las horas va a filtrar después los minutos)
    horaTurno.innerHTML = `<option value="" disabled selected>Hora</option>`;
    horas.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      horaTurno.appendChild(opt);
    });
  });

  horaTurno.addEventListener("change", async () => {
    const horaSeleccionada = horaTurno.value;
    const fecha = fechaTurno.value;
    if (!horaSeleccionada || !fecha) return;

    const turnosSnapshot = await getDocs(collection(db, "turnos"));
    const minutosOcupados = new Set();

    turnosSnapshot.forEach((doc) => {
      const t = doc.data();
      if (t.fecha !== fecha) return;

      const duracion = Number(t.duracionMinutos) || 15;
      const inicio = new Date(`${t.fecha}T${t.hora}`);
      const fin = new Date(inicio.getTime() + duracion * 60000);

      let bloque = new Date(inicio);
      while (bloque < fin) {
        const h = bloque.getHours().toString().padStart(2, "0");
        const m = bloque.getMinutes().toString().padStart(2, "0");
        if (h === horaSeleccionada) {
          minutosOcupados.add(m);
        }
        bloque = new Date(bloque.getTime() + 15 * 60000);
      }
    });

    // Renderizar minutos disponibles
    minutosTurno.innerHTML = `<option value="" disabled selected>Minutos</option>`;
    minutos.forEach((m) => {
      if (!minutosOcupados.has(m)) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        minutosTurno.appendChild(opt);
      }
    });

    if (minutosTurno.options.length === 1) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sin minutos disponibles";
      minutosTurno.appendChild(opt);
    }
  });

  document.getElementById("formTurno").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const fecha = fechaTurno.value;
      const hora = horaTurno.value;
      const minuto = minutosTurno.value;
      const pacienteId = document.getElementById("pacienteSelect").value;
      const tipoConsulta = document.getElementById("tipoConsulta").value;
      const duracion = parseInt(
        document.getElementById("duracionTurno").value,
        10
      );

      if (!fecha || !hora || !minuto || !pacienteId || isNaN(duracion)) {
        alert("Completá todos los campos obligatorios.");
        return;
      }

      const horaCompleta = `${hora}:${minuto}`;

      // Validar superposición al guardar (doble chequeo)
      const turnosSnapshot = await getDocs(collection(db, "turnos"));
      const inicioNuevo = new Date(`${fecha}T${horaCompleta}`);
      const finNuevo = new Date(inicioNuevo.getTime() + duracion * 60000);

      let superpuesto = false;
      turnosSnapshot.forEach((doc) => {
        const t = doc.data();
        if (t.fecha !== fecha) return;

        const inicioExistente = new Date(`${t.fecha}T${t.hora}`);
        const duracionExistente = Number(t.duracionMinutos) || 15;
        const finExistente = new Date(
          inicioExistente.getTime() + duracionExistente * 60000
        );

        if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
          superpuesto = true;
        }
      });

      if (superpuesto) {
        alert("Ese horario se superpone con otro turno.");
        return;
      }

      const pacienteDoc = await getDoc(doc(db, "pacientes", pacienteId));
      if (!pacienteDoc.exists()) {
        alert("Paciente no encontrado.");
        return;
      }

      const paciente = pacienteDoc.data();

      await addDoc(collection(db, "turnos"), {
        fecha,
        hora: horaCompleta,
        pacienteId,
        pacienteNombre: `${paciente.apellido} ${paciente.nombre}`,
        tipoConsulta,
        duracionMinutos: duracion,
        asistio: false,
        cancelado: false,
        ausente: false,
        montoAbonado: 0,
      });

      alert("Turno guardado correctamente.");
      e.target.reset();
      cargarTurnosPaginados();
    } catch (error) {
      console.error("Error al agregar el turno:", error);
      alert("Error al agregar el turno: " + error.message);
    }
  });

  // --- FILTROS ---
  // Reemplazamos este bloque por el siguiente:

  // Variables de filtros (ya declaradas anteriormente en esta misma sección)
  // const inputBusquedaPaciente, inputFechaDesde, inputFechaHasta, selectEstado, selectPago,
  // btnHoy, btnSemana ya están declarados.

  function formatearFecha(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function obtenerLunes(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function obtenerSabadoSemana(lunes) {
    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    return sabado;
  }

  function activarBoton(btnActivo) {
    [btnHoy, btnSemana].forEach((btn) => {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline-primary");
    });
    if (btnActivo) {
      btnActivo.classList.remove("btn-outline-primary");
      btnActivo.classList.add("btn-primary");
    }
  }

  btnHoy.addEventListener("click", () => {
    const hoyDate = new Date();
    const hoyStr = formatearFecha(hoyDate);
    inputFechaDesde.value = hoyStr;
    inputFechaHasta.value = hoyStr;
    activarBoton(btnHoy);
    cargarTurnosPaginados(1, 20, "dia");
  });

  btnSemana.addEventListener("click", () => {
    const hoyDate = new Date();
    const lunes = obtenerLunes(hoyDate);
    const sabado = obtenerSabadoSemana(lunes);
    inputFechaDesde.value = formatearFecha(lunes);
    inputFechaHasta.value = formatearFecha(sabado);
    activarBoton(btnSemana);
    cargarTurnosPaginados(1, 20, "semana");
  });

  // Actualizar tabla al cambiar filtros manuales
  const actualizarTurnos = () => cargarTurnosPaginados(1, 20, "");
  inputBusquedaPaciente.addEventListener("input", actualizarTurnos);
  inputFechaDesde.addEventListener("change", () => {
    activarBoton(null);
    actualizarTurnos();
  });
  inputFechaHasta.addEventListener("change", () => {
    activarBoton(null);
    actualizarTurnos();
  });
  selectEstado.addEventListener("change", () =>
    cargarTurnosPaginados(1, 20, "")
  );
  selectPago.addEventListener("change", () => cargarTurnosPaginados(1, 20, ""));

  // Al cargar la página, activar botón "Hoy" y cargar turnos
  btnHoy.click();
}

let cajaMovimientosFiltrados = [];
let cajaPaginaActual = 1;
const cajaPorPagina = 10;

// --- GESTIÓN CAJA ---

let pacientesGlobalCaja = []; // lista de pacientes cargada para autocompletar en Caja

// Función auxiliar para obtener lunes y sábado de la semana de una fecha YYYY-MM-DD
function calcularSemana(fechaStr) {
  const fecha = new Date(fechaStr);
  const diaSemana = fecha.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffLunes = (diaSemana + 6) % 7; // días a restar para llegar lunes
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - diffLunes);
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);

  function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return { desde: formatDate(lunes), hasta: formatDate(sabado) };
}

// Nueva función para cargar pacientes para el datalist en caja
async function cargarPacientesCaja() {
  pacientesGlobalCaja = [];
  try {
    const pacientesSnap = await getDocs(collection(db, "pacientes"));
    pacientesSnap.forEach((doc) => {
      const p = doc.data();
      pacientesGlobalCaja.push({
        id: doc.id,
        nombreCompleto: (p.apellido + " " + p.nombre).toLowerCase().trim(),
        apellido: p.apellido.toLowerCase().trim(),
        nombre: p.nombre.toLowerCase().trim(),
        display: p.apellido + ", " + p.nombre,
      });
    });
  } catch (error) {
    alert("Error al cargar pacientes para Caja: " + error.message);
  }
}

async function cargarCaja(filtroDesde = "", filtroHasta = "") {
  try {
    const cajaSnap = await getDocs(collection(db, "caja"));
    let ingresos = 0;
    let egresos = 0;

    cajaMovimientosFiltrados = [];

    cajaSnap.forEach((doc) => {
      const pago = doc.data();
      if (
        (!filtroDesde || pago.fecha >= filtroDesde) &&
        (!filtroHasta || pago.fecha <= filtroHasta)
      ) {
        cajaMovimientosFiltrados.push(pago);

        if (pago.monto >= 0) ingresos += pago.monto;
        else egresos += Math.abs(pago.monto);
      }
    });

    // Ordenar por fecha y hora ascendente
    cajaMovimientosFiltrados.sort((a, b) => {
      const fechaHoraA = new Date(a.fecha + "T" + (a.hora || "00:00"));
      const fechaHoraB = new Date(b.fecha + "T" + (b.hora || "00:00"));
      return fechaHoraA - fechaHoraB;
    });

    // Actualizar resumen estadístico
    const resumenIngresos = document.getElementById("resumenIngresos");
    const resumenEgresos = document.getElementById("resumenEgresos");
    const resumenSaldo = document.getElementById("resumenSaldo");
    const resumenCantidad = document.getElementById("resumenCantidad");

    if (resumenIngresos)
      resumenIngresos.textContent = "$" + ingresos.toFixed(2);
    if (resumenEgresos) resumenEgresos.textContent = "$" + egresos.toFixed(2);
    if (resumenSaldo)
      resumenSaldo.textContent = "$" + (ingresos - egresos).toFixed(2);
    if (resumenCantidad)
      resumenCantidad.textContent = cajaMovimientosFiltrados.length;

    cajaPaginaActual = 1;
    mostrarPaginaCaja();
  } catch (error) {
    alert("Error al cargar caja: " + error.message);
  }
}

function mostrarPaginaCaja() {
  const tablaCaja = document.getElementById("tablaCaja");
  if (!tablaCaja) return;

  tablaCaja.innerHTML = "";

  const inicio = (cajaPaginaActual - 1) * cajaPorPagina;
  const fin = inicio + cajaPorPagina;
  const paginaItems = cajaMovimientosFiltrados.slice(inicio, fin);

  paginaItems.forEach((pago) => {
    // Mostrar tipoMovimiento (Ingreso/Egreso)
    const tipoMovimiento =
      pago.tipoMovimiento || (pago.monto >= 0 ? "Ingreso" : "Egreso");

    // Para egresos ocultamos paciente y tipoConsulta (o mostrar '-')
    const pacienteMostrar =
      tipoMovimiento === "Ingreso" ? pago.pacienteNombre || "-" : "-";
    const tipoConsultaMostrar =
      tipoMovimiento === "Ingreso" ? pago.tipoConsulta || "-" : "-";

    // Color del monto según tipo
    const montoClase =
      tipoMovimiento === "Ingreso" ? "text-success" : "text-danger";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="text-center">${pago.fecha || "-"}</td>
      <td class="text-center">${pago.hora || "--:--"}</td>
      <td class="fw-bold text-center ${montoClase}">
        $${Math.abs(pago.monto).toFixed(2)}
      </td>
      <td class="text-center">${pacienteMostrar}</td>
      <td class="text-center">${tipoConsultaMostrar}</td>
      <td class="text-center">${pago.detalle || "-"}</td>
      <td class="text-center">${tipoMovimiento}</td>
    `;
    tablaCaja.appendChild(fila);
  });

  mostrarControlesPaginacionCaja();
}

function mostrarControlesPaginacionCaja() {
  let paginacionDiv = document.getElementById("paginacionCaja");
  if (paginacionDiv) paginacionDiv.remove();

  paginacionDiv = document.createElement("div");
  paginacionDiv.id = "paginacionCaja";
  paginacionDiv.className =
    "d-flex justify-content-between align-items-center mt-2";

  const totalPaginas = Math.ceil(
    cajaMovimientosFiltrados.length / cajaPorPagina
  );

  const btnAnterior = document.createElement("button");
  btnAnterior.textContent = "Anterior";
  btnAnterior.className = "btn btn-secondary";
  btnAnterior.disabled = cajaPaginaActual === 1;
  btnAnterior.onclick = () => {
    if (cajaPaginaActual > 1) {
      cajaPaginaActual--;
      mostrarPaginaCaja();
    }
  };

  const spanPagina = document.createElement("span");
  spanPagina.textContent = `Página ${cajaPaginaActual} de ${totalPaginas}`;

  const btnSiguiente = document.createElement("button");
  btnSiguiente.textContent = "Siguiente";
  btnSiguiente.className = "btn btn-secondary";
  btnSiguiente.disabled = cajaPaginaActual >= totalPaginas;
  btnSiguiente.onclick = () => {
    if (cajaPaginaActual < totalPaginas) {
      cajaPaginaActual++;
      mostrarPaginaCaja();
    }
  };

  paginacionDiv.appendChild(btnAnterior);
  paginacionDiv.appendChild(spanPagina);
  paginacionDiv.appendChild(btnSiguiente);

  const tablaResponsive = document.querySelector(".table-responsive");
  if (tablaResponsive) tablaResponsive.appendChild(paginacionDiv);
}

async function mostrarCaja() {
  // Primero cargar pacientes para autocompletar
  await cargarPacientesCaja();

  mainContent.innerHTML = `
    <div class="row">
      <div class="col-lg-9">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h1 class="mb-0">Caja diaria</h1>
          <button class="btn btn-primary" id="btnNuevoMovimiento">Nuevo Movimiento</button>
        </div>

        <!-- Modal Nuevo Movimiento -->
        <div class="modal fade" id="modalNuevoMovimiento" tabindex="-1" aria-labelledby="modalNuevoMovimientoLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <form id="formCajaModal" class="needs-validation" novalidate>
                <div class="modal-header">
                  <h5 class="modal-title" id="modalNuevoMovimientoLabel">Nuevo Movimiento</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                  <div class="mb-3">
                    <label for="fechaCajaModal" class="form-label">Fecha *</label>
                    <input type="date" id="fechaCajaModal" class="form-control" value="${hoy()}" required />
                    <div class="invalid-feedback">Por favor ingrese una fecha válida.</div>
                  </div>
                  <div class="mb-3">
                    <label for="horaCajaModal" class="form-label">Hora</label>
                    <input type="time" id="horaCajaModal" class="form-control" />
                  </div>
                  <div class="mb-3">
                    <label for="tipoMovimientoCajaModal" class="form-label">Tipo de Movimiento *</label>
                    <select id="tipoMovimientoCajaModal" class="form-select" required>
                      <option value="Ingreso" selected>Ingreso</option>
                      <option value="Egreso">Egreso</option>
                    </select>
                    <div class="invalid-feedback">Seleccione el tipo de movimiento.</div>
                  </div>
                  <div class="mb-3">
                    <label for="montoCajaModal" class="form-label">Monto *</label>
                    <input type="number" id="montoCajaModal" class="form-control" required min="0.01" step="0.01" />
                    <div class="invalid-feedback">Por favor ingrese un monto válido mayor a cero.</div>
                  </div>
                  <div class="mb-3 ingreso-only position-relative">
                    <label for="pacienteCajaModal" class="form-label">Paciente</label>
                    <input type="text" id="pacienteCajaModal" class="form-control" autocomplete="off" />
                    <div id="listaCoincidenciasCaja" class="list-group position-absolute w-100" style="z-index: 1050; max-height: 200px; overflow-y: auto; display: none;"></div>
                  </div>
                  <div class="mb-3 ingreso-only">
                    <label for="tipoConsultaCajaModal" class="form-label">Tipo de Consulta</label>
                    <input type="text" id="tipoConsultaCajaModal" class="form-control" />
                  </div>
                  <div class="mb-3">
                    <label for="detalleCajaModal" class="form-label">Detalle</label>
                    <input type="text" id="detalleCajaModal" class="form-control" />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                  <button type="submit" class="btn btn-primary">Agregar Movimiento</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <div class="row g-2 mb-3 align-items-end">
              <div class="col-md-3 d-flex gap-1">
                <button class="btn btn-outline-primary w-100" id="btnHoy">Hoy</button>
                <button class="btn btn-outline-primary w-100" id="btnSemana">Semana</button>
              </div>
              <div class="col-md-3">
                <label for="filtroDesde" class="form-label">Desde</label>
                <input type="date" id="filtroDesde" class="form-control" />
              </div>
              <div class="col-md-3">
                <label for="filtroHasta" class="form-label">Hasta</label>
                <input type="date" id="filtroHasta" class="form-control" />
              </div>
              <div class="col-md-3 d-flex justify-content-end">
                <button class="btn btn-outline-secondary w-100" id="btnAplicarFiltros">Filtrar</button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-striped" style="table-layout: fixed; width: 100%;">
                <thead>
                  <tr>
                    <th width="12%" class="text-center">Fecha</th>
                    <th width="8%" class="text-center">Hora</th>
                    <th width="12%" class="text-center">Monto</th>
                    <th width="20%" class="text-center">Paciente</th>
                    <th width="20%" class="text-center">Tipo Consulta</th>
                    <th width="20%" class="text-center">Detalle</th>
                    <th width="8%" class="text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody id="tablaCaja"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-3 mx-auto" style="max-width: 250px; padding-left: 10px; padding-right: 10px;">
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">Movimientos</h5>
            <p id="resumenCantidad" class="fw-bold">0</p>
          </div>
        </div>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">Ingresos</h5>
            <p id="resumenIngresos" class="fw-bold text-success">$0.00</p>
          </div>
        </div>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">Egresos</h5>
            <p id="resumenEgresos" class="fw-bold text-danger">$0.00</p>
          </div>
        </div>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">Saldo Neto</h5>
            <p id="resumenSaldo" class="fw-bold">$0.00</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Variables para autocompletado paciente
  let pacienteSeleccionadoId = null;
  const inputPaciente = document.getElementById("pacienteCajaModal");
  const contenedorCoincidencias = document.getElementById(
    "listaCoincidenciasCaja"
  );

  // Función para filtrar pacientes y mostrar lista debajo del input
  function filtrarPacientesCaja(texto) {
    const textoLower = texto.toLowerCase().trim();
    if (!textoLower) {
      contenedorCoincidencias.style.display = "none";
      pacienteSeleccionadoId = null;
      return;
    }

    const coincidencias = pacientesGlobalCaja.filter((p) =>
      p.display.toLowerCase().includes(textoLower)
    );

    if (coincidencias.length === 0) {
      contenedorCoincidencias.style.display = "none";
      pacienteSeleccionadoId = null;
      return;
    }

    contenedorCoincidencias.innerHTML = coincidencias
      .map(
        (p) =>
          `<button type="button" class="list-group-item list-group-item-action" data-id="${p.id}">${p.display}</button>`
      )
      .join("");

    contenedorCoincidencias.style.display = "block";

    // Agregar evento click a cada botón para seleccionar paciente
    Array.from(contenedorCoincidencias.children).forEach((btn) => {
      btn.addEventListener("click", () => {
        inputPaciente.value = btn.textContent;
        pacienteSeleccionadoId = btn.getAttribute("data-id");
        contenedorCoincidencias.style.display = "none";
      });
    });
  }

  // Evento para filtrar mientras escribís
  inputPaciente.addEventListener("input", (e) => {
    pacienteSeleccionadoId = null; // reset cuando cambias texto
    filtrarPacientesCaja(e.target.value);
  });

  // Opcional: ocultar la lista al hacer click fuera del input y lista
  document.addEventListener("click", (e) => {
    if (
      e.target !== inputPaciente &&
      !contenedorCoincidencias.contains(e.target)
    ) {
      contenedorCoincidencias.style.display = "none";
    }
  });

  // Eventos botones y filtros
  document
    .getElementById("btnNuevoMovimiento")
    .addEventListener("click", () => {
      const modal = new bootstrap.Modal(
        document.getElementById("modalNuevoMovimiento")
      );
      modal.show();
      actualizarCamposMovimiento(); // <-- actualizar visibilidad campos al abrir
    });

  document.getElementById("btnHoy").addEventListener("click", () => {
    const hoyFecha = hoy();
    document.getElementById("filtroDesde").value = hoyFecha;
    document.getElementById("filtroHasta").value = hoyFecha;
    cargarCaja(hoyFecha, hoyFecha);
  });

  document.getElementById("btnSemana").addEventListener("click", () => {
    const hoyFecha = new Date();
    const diaSemana = hoyFecha.getDay();
    const lunes = new Date(hoyFecha);
    lunes.setDate(hoyFecha.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    const desde = lunes.toISOString().split("T")[0];
    const hasta = sabado.toISOString().split("T")[0];
    document.getElementById("filtroDesde").value = desde;
    document.getElementById("filtroHasta").value = hasta;
    cargarCaja(desde, hasta);
  });

  document.getElementById("btnAplicarFiltros").addEventListener("click", () => {
    const desde = document.getElementById("filtroDesde").value;
    const hasta = document.getElementById("filtroHasta").value;
    cargarCaja(desde, hasta);
  });

  document
    .getElementById("tipoMovimientoCajaModal")
    .addEventListener("change", actualizarCamposMovimiento);

  document
    .getElementById("formCajaModal")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const formCajaModal = e.target;
      if (!formCajaModal.checkValidity()) {
        formCajaModal.classList.add("was-validated");
        return;
      }

      const tipoMovimiento = document.getElementById(
        "tipoMovimientoCajaModal"
      ).value;
      const pacienteInputValue = inputPaciente.value.trim();
      let pacienteId = pacienteSeleccionadoId;
      let pacienteNombreGuardar = pacienteInputValue || "-";

      if (tipoMovimiento === "Ingreso" && !pacienteInputValue) {
        alert("Debe seleccionar un paciente para un ingreso.");
        return;
      }

      if (!pacienteId && pacienteInputValue) {
        // Intentar buscar paciente por texto exacto (por seguridad)
        const pacienteEncontrado = pacientesGlobalCaja.find(
          (p) => p.display.toLowerCase() === pacienteInputValue.toLowerCase()
        );
        if (pacienteEncontrado) {
          pacienteId = pacienteEncontrado.id;
          pacienteNombreGuardar = pacienteEncontrado.display;
        } else {
          alert("Debe seleccionar un paciente válido de la lista.");
          return;
        }
      }

      const fecha = document.getElementById("fechaCajaModal").value;
      const hora = document.getElementById("horaCajaModal").value || "--:--";
      let monto = parseFloat(document.getElementById("montoCajaModal").value);
      const tipoConsultaInput = document
        .getElementById("tipoConsultaCajaModal")
        .value.trim();
      const detalle = document.getElementById("detalleCajaModal").value.trim();

      if (tipoMovimiento === "Egreso") {
        monto = -Math.abs(monto);
      } else {
        monto = Math.abs(monto);
      }

      try {
        await addDoc(collection(db, "caja"), {
          fecha,
          hora,
          monto,
          tipoMovimiento,
          pacienteId,
          pacienteNombre: pacienteNombreGuardar,
          tipoConsulta: tipoConsultaInput || "-",
          detalle: detalle || "-",
        });
        alert("Movimiento agregado.");
        formCajaModal.reset();
        formCajaModal.classList.remove("was-validated");
        pacienteSeleccionadoId = null;

        const modalInstance = bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoMovimiento")
        );
        modalInstance.hide();

        cargarCaja();
      } catch (error) {
        alert("Error al agregar movimiento: " + error.message);
      }
    });

  cargarCaja();
}

function actualizarCamposMovimiento() {
  const tipo = document.getElementById("tipoMovimientoCajaModal").value;
  const ingresoFields = document.querySelectorAll(".ingreso-only");

  ingresoFields.forEach((el) => {
    el.style.display = tipo === "Ingreso" ? "block" : "none";
  });
}

// --- MANEJO DEL SIDEBAR ---
// Iniciar mostrando Inicio
// --- MANEJO DEL SIDEBAR ---
// Iniciar mostrando Inicio
mostrarInicio();

document.querySelectorAll("#sidebar a.nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();

    // 🔴 Limpiar búsqueda si estás viniendo de la sección Inicio
    const inputBusqueda = document.getElementById("busquedaPaciente");
    const resultadosBusqueda = document.getElementById("resultadosBusqueda");
    if (inputBusqueda) inputBusqueda.value = "";
    if (resultadosBusqueda) resultadosBusqueda.innerHTML = "";

    // Marcar como activo
    document
      .querySelectorAll("#sidebar a.nav-link")
      .forEach((l) => l.classList.remove("active"));
    e.target.classList.add("active");

    // Mostrar sección
    const seccion = e.target.dataset.section;
    if (seccion === "inicio") mostrarInicio();
    else if (seccion === "pacientes") mostrarGestionPacientes();
    else if (seccion === "turnos") mostrarAgendaTurnos();
    else if (seccion === "caja") mostrarCaja();
    else if (seccion === "presupuestos") mostrarPresupuestos(); // <-- Agregado aquí
  });
});

function mostrarEstadisticas() {
  const mainContent = document.getElementById("mainContent");
  mainContent.innerHTML = `
    <div class="container py-4">
      <h2 class="mb-4 text-primary">Estadísticas del Consultorio</h2>

      <!-- Filtros de Fecha -->
      <div class="mb-3 d-flex gap-2 align-items-center flex-wrap">
        <label for="fechaDesde" class="form-label mb-0">Desde:</label>
        <input type="date" id="fechaDesde" class="form-control" style="max-width: 180px;">
        <label for="fechaHasta" class="form-label mb-0">Hasta:</label>
        <input type="date" id="fechaHasta" class="form-control" style="max-width: 180px;">
        <button id="btnFiltrarEstadisticas" class="btn btn-primary">Filtrar</button>
      </div>

      <!-- Pestañas Bootstrap -->
      <ul class="nav nav-tabs" id="estadisticasTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="tab-resumen" data-bs-toggle="tab" data-bs-target="#contenido-resumen" type="button" role="tab">Resumen</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="tab-turnos" data-bs-toggle="tab" data-bs-target="#contenido-turnos" type="button" role="tab">Turnos</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="tab-ingresos" data-bs-toggle="tab" data-bs-target="#contenido-ingresos" type="button" role="tab">Ingresos</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="tab-pacientes" data-bs-toggle="tab" data-bs-target="#contenido-pacientes" type="button" role="tab">Pacientes</button>
        </li>
      </ul>

      <div class="tab-content pt-3" id="estadisticasTabsContent">
        <!-- Resumen -->
        <div class="tab-pane fade show active" id="contenido-resumen" role="tabpanel">
          <div class="row g-4 mb-5">
            <div class="col-md-3">
              <div class="card border-start-primary shadow h-100 py-2">
                <div class="card-body d-flex align-items-center">
                  <div class="me-3">
                    <i class="fas fa-calendar fa-2x text-primary"></i>
                  </div>
                  <div>
                    <div class="fw-bold text-primary text-uppercase mb-1">Turnos Totales</div>
                    <div class="h5 mb-0 fw-bold text-gray-800" id="estadisticaTurnosTotales">-</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-3">
              <div class="card border-start-success shadow h-100 py-2">
                <div class="card-body d-flex align-items-center">
                  <div class="me-3">
                    <i class="fas fa-user fa-2x text-success"></i>
                  </div>
                  <div>
                    <div class="fw-bold text-success text-uppercase mb-1">Pacientes Totales</div>
                    <div class="h5 mb-0 fw-bold text-gray-800" id="estadisticaPacientes">-</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-3">
              <div class="card border-start-info shadow h-100 py-2">
                <div class="card-body d-flex align-items-center">
                  <div class="me-3">
                    <i class="fas fa-dollar-sign fa-2x text-info"></i>
                  </div>
                  <div>
                    <div class="fw-bold text-info text-uppercase mb-1">Ingresos Totales</div>
                    <div class="h5 mb-0 fw-bold text-gray-800" id="estadisticaIngresosTotales">-</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-3">
              <div class="card border-start-warning shadow h-100 py-2">
                <div class="card-body d-flex align-items-center">
                  <div class="me-3">
                    <i class="fas fa-exclamation-triangle fa-2x text-warning"></i>
                  </div>
                  <div>
                    <div class="fw-bold text-warning text-uppercase mb-1">Turnos Cancelados</div>
                    <div class="h5 mb-0 fw-bold text-gray-800" id="estadisticaTurnosCancelados">-</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
<!-- Turnos -->
<div class="tab-pane fade" id="contenido-turnos" role="tabpanel">
  <div class="row g-4">
    <div class="col-md-6">
      <div class="card shadow-sm rounded-3 h-100 border-primary">
        <div class="card-header bg-primary text-white fw-bold rounded-top">
          Turnos por Tipo
        </div>
        <div class="card-body d-flex justify-content-center align-items-center" style="height: 320px;">
          <canvas id="graficoTurnosPorTipo" style="max-width: 90%; height: 100%;"></canvas>
        </div>
      </div>
    </div>

    <div class="col-md-6">
      <div class="card shadow-sm rounded-3 h-100 border-success">
        <div class="card-header bg-success text-white fw-bold rounded-top">
          Asistencia y Cancelaciones
        </div>
        <div class="card-body d-flex justify-content-center align-items-center" style="height: 320px;">
          <canvas id="graficoAsistencia" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
    </div>
  </div>
</div>




        <!-- Ingresos -->
        <div class="tab-pane fade" id="contenido-ingresos" role="tabpanel">
          <div class="row mb-4">
            <div class="col-md-6 mb-4">
              <div class="card shadow">
                <div class="card-header bg-primary text-white fw-bold">Ingresos Mensuales</div>
                <div class="card-body">
                  <canvas id="graficoIngresosMensuales" height="200"></canvas>
                </div>
              </div>
            </div>
            <div class="col-md-6 mb-4">
              <div class="card shadow">
                <div class="card-header bg-danger text-white fw-bold">Egresos Mensuales</div>
                <div class="card-body">
                  <canvas id="graficoEgresosMensuales" height="200"></canvas>
                </div>
              </div>
            </div>
          </div>

          <div class="row mb-4">
            <div class="col-md-6 mb-4">
              <div class="card shadow h-100">
                <div class="card-header bg-info text-white fw-bold">Comparativa Ingresos vs Egresos</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 380px;">
                  <canvas id="graficoComparativaIngresosEgresos" style="max-height: 100%; max-width: 100%;"></canvas>
                </div>
              </div>
            </div>
            <div class="col-md-6 mb-4">
              <div class="card shadow h-100">
                <div class="card-header bg-success text-white fw-bold">Ingresos por Tipo de Consulta</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 380px;">
                  <canvas id="graficoIngresosPorConsulta" style="max-height: 100%; max-width: 100%;"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>

    <!-- Pacientes -->
<div class="tab-pane fade" id="contenido-pacientes" role="tabpanel">
  <div class="row g-4 mb-4">
    <div class="col-md-3">
      <div class="card border-start-success shadow h-100 py-2">
        <div class="card-body d-flex align-items-center">
          <div class="me-3">
            <i class="fas fa-user-check fa-2x text-success"></i>
          </div>
          <div>
            <div class="fw-bold text-success text-uppercase mb-1">Pacientes Activos</div>
            <div class="h4 mb-0 fw-bold text-gray-800" id="estadisticaPacientesActivos">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-md-3">
      <div class="card border-start-primary shadow h-100 py-2">
        <div class="card-body d-flex align-items-center">
          <div class="me-3">
            <i class="fas fa-user-plus fa-2x text-primary"></i>
          </div>
          <div>
            <div class="fw-bold text-primary text-uppercase mb-1">Pacientes Nuevos (Mes)</div>
            <div class="h4 mb-0 fw-bold text-gray-800" id="estadisticaPacientesNuevos">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-md-3">
      <div class="card border-start-danger shadow h-100 py-2">
        <div class="card-body d-flex align-items-center">
          <div class="me-3">
            <i class="fas fa-exclamation-circle fa-2x text-danger"></i>
          </div>
          <div>
            <div class="fw-bold text-danger text-uppercase mb-1">Pacientes con Deuda</div>
            <div class="h4 mb-0 fw-bold text-gray-800" id="estadisticaPacientesConDeuda">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-md-3">
      <div class="card border-start-secondary shadow h-100 py-2">
        <div class="card-body d-flex align-items-center">
          <div class="me-3">
            <i class="fas fa-clock fa-2x text-secondary"></i>
          </div>
          <div>
            <div class="fw-bold text-secondary text-uppercase mb-1">Pacientes Inactivos</div>
            <div class="h4 mb-0 fw-bold text-gray-800" id="estadisticaPacientesInactivos">-</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="row g-4">
    <div class="col-md-6">
      <div class="card shadow-sm rounded-3 h-100 border-info">
        <div class="card-header bg-info text-white fw-bold rounded-top">
          Pacientes por Género
        </div>
        <div class="card-body d-flex justify-content-center align-items-center" style="height: 320px;">
          <canvas id="graficoPacientesGenero" style="max-width: 90%; height: 100%;"></canvas>
        </div>
      </div>
    </div>

    <div class="col-md-6">
      <div class="card shadow-sm rounded-3 h-100 border-primary">
        <div class="card-header bg-primary text-white fw-bold rounded-top">
          Pacientes por Rango Etario
        </div>
        <div class="card-body d-flex justify-content-center align-items-center" style="height: 320px;">
          <canvas id="graficoPacientesEdad" style="max-width: 90%; height: 100%;"></canvas>
        </div>
      </div>
    </div>
  </div>

 <div class="card shadow-sm rounded-3 border-success mt-4">
  <div class="card-header bg-success text-white fw-bold rounded-top">
    Evolución de Pacientes Nuevos por Mes
  </div>
  <div class="card-body d-flex justify-content-center align-items-center" style="height: 400px;">
    <canvas id="graficoEvolucionPacientes" style="max-width: 95%; height: 100%;"></canvas>
  </div>
</div>



  `;

  // Carga datos inicial sin filtros
  cargarEstadisticasConFiltros();

  // Listener del botón filtrar
  document
    .getElementById("btnFiltrarEstadisticas")
    .addEventListener("click", () => {
      cargarEstadisticasConFiltros();
    });
}

async function cargarEstadisticasConFiltros() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;

  const pacientesSnapshot = await getDocs(collection(db, "pacientes"));
  const turnosSnapshot = await getDocs(collection(db, "turnos"));
  const cajaSnapshot = await getDocs(collection(db, "caja"));

  // Colores para gráficos
  const colores = [
    "#4e73df",
    "#1cc88a",
    "#36b9cc",
    "#f6c23e",
    "#e74a3b",
    "#858796",
  ];

  // Filtrar turnos por fecha
  let turnosFiltrados = [];
  turnosSnapshot.forEach((doc) => {
    const turno = doc.data();
    if ((!desde || turno.fecha >= desde) && (!hasta || turno.fecha <= hasta)) {
      turnosFiltrados.push(turno);
    }
  });

  // Filtrar caja ingresos y egresos según fecha y tipoMovimiento (igual que en Caja)
  let cajaFiltradaIngresos = [];
  let cajaFiltradaEgresos = [];

  cajaSnapshot.forEach((doc) => {
    const mov = doc.data();
    if ((!desde || mov.fecha >= desde) && (!hasta || mov.fecha <= hasta)) {
      if (mov.monto >= 0) {
        cajaFiltradaIngresos.push(mov);
      } else {
        cajaFiltradaEgresos.push(mov);
      }
    }
  });

  // Totales pacientes sin filtro
  const totalPacientes = pacientesSnapshot.size;

  // Resumen calculado
  const totalTurnos = turnosFiltrados.length;
  const turnosCancelados = turnosFiltrados.filter((t) => t.cancelado).length;

  // Sumar montos (tomar valor absoluto para egresos, porque en caja son negativos)
  const totalIngresos = cajaFiltradaIngresos.reduce(
    (acc, mov) => acc + mov.monto,
    0
  );
  const totalEgresos = cajaFiltradaEgresos.reduce(
    (acc, mov) => acc + Math.abs(mov.monto),
    0
  );

  // Actualizar resumen en HTML
  document.getElementById("estadisticaTurnosTotales").innerText = totalTurnos;
  document.getElementById("estadisticaPacientes").innerText = totalPacientes;
  document.getElementById("estadisticaIngresosTotales").innerText =
    "$ " + totalIngresos.toLocaleString();
  document.getElementById("estadisticaTurnosCancelados").innerText =
    turnosCancelados;

  // --- GRÁFICOS ---

  // Turnos por Tipo
  let turnosPorTipo = {};
  turnosFiltrados.forEach((t) => {
    if (t.tipoConsulta) {
      turnosPorTipo[t.tipoConsulta] = (turnosPorTipo[t.tipoConsulta] || 0) + 1;
    }
  });
  const tipos = Object.keys(turnosPorTipo);
  const cantidades = Object.values(turnosPorTipo);
  if (window.chartTurnosPorTipo) window.chartTurnosPorTipo.destroy();
  window.chartTurnosPorTipo = new Chart(
    document.getElementById("graficoTurnosPorTipo"),
    {
      type: "doughnut",
      data: {
        labels: tipos,
        datasets: [
          { data: cantidades, backgroundColor: colores.slice(0, tipos.length) },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    }
  );

  // Asistencia y Cancelaciones
  let countAsistio = 0,
    countAusente = 0,
    countCancelado = 0;
  turnosFiltrados.forEach((t) => {
    if (t.cancelado) countCancelado++;
    else if (t.asistio) countAsistio++;
    else if (t.ausente) countAusente++;
  });
  if (window.chartAsistencia) window.chartAsistencia.destroy();
  window.chartAsistencia = new Chart(
    document.getElementById("graficoAsistencia"),
    {
      type: "bar",
      data: {
        labels: ["Asistió", "Ausente", "Cancelado"],
        datasets: [
          {
            label: "Cantidad",
            data: [countAsistio, countAusente, countCancelado],
            backgroundColor: ["#1cc88a", "#f6c23e", "#e74a3b"],
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, precision: 0 } },
      },
    }
  );

  // Ingresos Mensuales (igual que Caja)
  let ingresosPorMes = {};
  cajaFiltradaIngresos.forEach((mov) => {
    const mes = mov.fecha.substring(0, 7);
    ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + mov.monto;
  });

  // Egresos Mensuales (usar valor absoluto)
  let egresosPorMes = {};
  cajaFiltradaEgresos.forEach((mov) => {
    const mes = mov.fecha.substring(0, 7);
    egresosPorMes[mes] = (egresosPorMes[mes] || 0) + Math.abs(mov.monto);
  });

  // Meses combinados y ordenados
  const mesesSet = new Set([
    ...Object.keys(ingresosPorMes),
    ...Object.keys(egresosPorMes),
  ]);
  const mesesOrdenados = Array.from(mesesSet).sort();

  const montosPorMes = mesesOrdenados.map((m) => ingresosPorMes[m] || 0);
  const egresosMontosPorMes = mesesOrdenados.map((m) => egresosPorMes[m] || 0);

  if (window.chartIngresosMensuales) window.chartIngresosMensuales.destroy();
  window.chartIngresosMensuales = new Chart(
    document.getElementById("graficoIngresosMensuales"),
    {
      type: "bar",
      data: {
        labels: mesesOrdenados,
        datasets: [
          {
            label: "Ingresos ($)",
            data: montosPorMes,
            backgroundColor: "#4e73df",
          },
        ],
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } },
    }
  );

  if (window.chartEgresosMensuales) window.chartEgresosMensuales.destroy();
  window.chartEgresosMensuales = new Chart(
    document.getElementById("graficoEgresosMensuales"),
    {
      type: "bar",
      data: {
        labels: mesesOrdenados,
        datasets: [
          {
            label: "Egresos ($)",
            data: egresosMontosPorMes,
            backgroundColor: "#e74a3b",
          },
        ],
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } },
    }
  );

  if (window.chartComparativaIngresosEgresos)
    window.chartComparativaIngresosEgresos.destroy();
  window.chartComparativaIngresosEgresos = new Chart(
    document.getElementById("graficoComparativaIngresosEgresos"),
    {
      type: "bar",
      data: {
        labels: mesesOrdenados,
        datasets: [
          {
            label: "Ingresos",
            data: montosPorMes,
            backgroundColor: "rgba(78, 115, 223, 0.7)",
          },
          {
            label: "Egresos",
            data: egresosMontosPorMes,
            backgroundColor: "rgba(231, 74, 59, 0.7)",
          },
        ],
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } },
    }
  );

  // Ingresos por Tipo de Consulta
  let ingresosPorConsulta = {};
  cajaFiltradaIngresos.forEach((mov) => {
    const tipo = mov.tipoConsulta || "Sin Tipo de Consulta";
    ingresosPorConsulta[tipo] = (ingresosPorConsulta[tipo] || 0) + mov.monto;
  });

  const consultas = Object.keys(ingresosPorConsulta);
  const ingresos = Object.values(ingresosPorConsulta);
  if (window.chartIngresosPorConsulta)
    window.chartIngresosPorConsulta.destroy();
  window.chartIngresosPorConsulta = new Chart(
    document.getElementById("graficoIngresosPorConsulta"),
    {
      type: "pie",
      data: {
        labels: consultas,
        datasets: [
          {
            data: ingresos,
            backgroundColor: colores.slice(0, consultas.length),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    }
  );

  // --- ESTADÍSTICAS Y GRÁFICOS DE PACIENTES ---

  // Pacientes activos (con fechaIngreso)
  const pacientesActivos = pacientesSnapshot.docs.filter(
    (doc) => doc.data().fechaIngreso && doc.data().fechaIngreso.trim() !== ""
  ).length;
  document.getElementById("estadisticaPacientesActivos").innerText =
    pacientesActivos;

  // Pacientes por género
  let pacientesPorGenero = {};
  pacientesSnapshot.forEach((doc) => {
    const paciente = doc.data();
    const gen = paciente.genero || "Sin definir";
    pacientesPorGenero[gen] = (pacientesPorGenero[gen] || 0) + 1;
  });
  const generos = Object.keys(pacientesPorGenero);
  const cantidadesGenero = Object.values(pacientesPorGenero);
  if (window.chartPacientesGenero) window.chartPacientesGenero.destroy();
  window.chartPacientesGenero = new Chart(
    document.getElementById("graficoPacientesGenero"),
    {
      type: "doughnut",
      data: {
        labels: generos,
        datasets: [
          {
            data: cantidadesGenero,
            backgroundColor: colores.slice(0, generos.length),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    }
  );

  // Pacientes por rango etario
  function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }
  let edadesRango = {
    "0-10": 0,
    "11-20": 0,
    "21-40": 0,
    "41-60": 0,
    "60+": 0,
    "Sin datos": 0,
  };
  pacientesSnapshot.forEach((doc) => {
    const paciente = doc.data();
    const edad = calcularEdad(paciente.fechaNacimiento);
    if (edad === null) edadesRango["Sin datos"]++;
    else if (edad <= 10) edadesRango["0-10"]++;
    else if (edad <= 20) edadesRango["11-20"]++;
    else if (edad <= 40) edadesRango["21-40"]++;
    else if (edad <= 60) edadesRango["41-60"]++;
    else edadesRango["60+"]++;
  });
  const etiquetasEdades = Object.keys(edadesRango);
  const cantidadesEdades = Object.values(edadesRango);
  if (window.chartPacientesEdad) window.chartPacientesEdad.destroy();
  window.chartPacientesEdad = new Chart(
    document.getElementById("graficoPacientesEdad"),
    {
      type: "bar",
      data: {
        labels: etiquetasEdades,
        datasets: [
          {
            label: "Cantidad de Pacientes",
            data: cantidadesEdades,
            backgroundColor: "#36b9cc",
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, precision: 0 } },
      },
    }
  );

  // Pacientes nuevos (mes filtro o mes actual)
  const mesFiltro = desde
    ? desde.substring(0, 7)
    : new Date().toISOString().substring(0, 7);
  const pacientesNuevos = pacientesSnapshot.docs.filter((doc) => {
    const paciente = doc.data();
    if (!paciente.fechaIngreso) return false;
    return paciente.fechaIngreso.startsWith(mesFiltro);
  }).length;
  document.getElementById("estadisticaPacientesNuevos").innerText =
    pacientesNuevos;

  // Pacientes con deuda
  let deudaPorPaciente = {};
  cajaSnapshot.forEach((doc) => {
    const mov = doc.data();
    if (!mov.pacienteId) return;
    deudaPorPaciente[mov.pacienteId] =
      (deudaPorPaciente[mov.pacienteId] || 0) +
      mov.monto * (mov.tipoMovimiento === "Egreso" ? -1 : 1);
  });
  const pacientesConDeuda = Object.values(deudaPorPaciente).filter(
    (saldo) => saldo < 0
  ).length;
  document.getElementById("estadisticaPacientesConDeuda").innerText =
    pacientesConDeuda;

  // Pacientes inactivos: sin turnos últimos 3 meses
  const hoy = new Date();
  const fechaLimite = new Date(
    hoy.getFullYear(),
    hoy.getMonth() - 3,
    hoy.getDate()
  );
  let turnosPorPaciente = {};
  turnosSnapshot.forEach((doc) => {
    const t = doc.data();
    if (!t.pacienteId) return;
    if (!turnosPorPaciente[t.pacienteId]) turnosPorPaciente[t.pacienteId] = [];
    turnosPorPaciente[t.pacienteId].push(t.fecha);
  });
  let pacientesInactivosCount = 0;
  pacientesSnapshot.forEach((doc) => {
    const pacienteId = doc.id;
    const fechasTurnos = turnosPorPaciente[pacienteId] || [];
    const activo = fechasTurnos.some((f) => new Date(f) >= fechaLimite);
    if (!activo) pacientesInactivosCount++;
  });
  document.getElementById("estadisticaPacientesInactivos").innerText =
    pacientesInactivosCount;

  // Evolución pacientes nuevos últimos 12 meses
  let pacientesPorMes = {};
  pacientesSnapshot.forEach((doc) => {
    const paciente = doc.data();
    if (!paciente.fechaIngreso) return;
    const mes = paciente.fechaIngreso.substring(0, 7);
    pacientesPorMes[mes] = (pacientesPorMes[mes] || 0) + 1;
  });
  const mesesUltimos12 = [];
  const fechaBase = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(fechaBase.getFullYear(), fechaBase.getMonth() - i, 1);
    mesesUltimos12.push(d.toISOString().substring(0, 7));
  }
  const cantidadesPorMes = mesesUltimos12.map((m) => pacientesPorMes[m] || 0);
  if (window.chartEvolucionPacientes) window.chartEvolucionPacientes.destroy();
  window.chartEvolucionPacientes = new Chart(
    document.getElementById("graficoEvolucionPacientes"),
    {
      type: "line",
      data: {
        labels: mesesUltimos12,
        datasets: [
          {
            label: "Pacientes Nuevos",
            data: cantidadesPorMes,
            fill: false,
            borderColor: "#1cc88a",
            backgroundColor: "#1cc88a",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, precision: 0, stepSize: 1 } },
      },
    }
  );
}


// Listener para capturar clicks en el Sidebar
document.querySelectorAll("[data-section]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.getAttribute("data-section");

    if (section === "estadisticas") {
      mostrarEstadisticas();
    } else if (section === "pacientes") {
      mostrarGestionPacientes();
    } else if (section === "turnos") {
      mostrarAgendaTurnos();
    } else if (section === "caja") {
      mostrarCaja();
    } else {
      mostrarInicio();
    }

    // Marcar como activo el link
    document
      .querySelectorAll("#sidebar .nav-link")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// Inicializa los tooltips de Bootstrap para todos los elementos que tengan atributo 'title'
document.addEventListener("DOMContentLoaded", function () {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[title]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
});
