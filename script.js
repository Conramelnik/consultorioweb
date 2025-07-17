// Función auxiliar para obtener fecha hoy en formato YYYY-MM-DD
function hoy() {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
}

// Import Firebase
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

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAQwEe9C-ruCZ6TX612zA6FhkxZUJ2rVoc",
  authDomain: "consultoriosapp-f7f08.firebaseapp.com",
  projectId: "consultoriosapp-f7f08",
  storageBucket: "consultoriosapp-f7f08.firebasestorage.app",
  messagingSenderId: "729983357456",
  appId: "1:729983357456:web:61f5805927509dfeefb095",
};

// Inicializar app y firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referencias globales
const mainContent = document.getElementById("mainContent");
let listaPacientes = [];
let listaTurnos = [];
let paginaActualTurnos = 1;
const turnosPorPagina = 20;
let turnosFiltrados = [];

let pacientesGlobalFiltrados = []; // pacientes filtrados
// Variable global para controlar si estamos editando un paciente
let pacienteEditandoId = null;
let calendar;

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
        <button class="btn btn-sm btn-secondary ver-ficha me-2" data-id="${p.id}">Ver ficha</button>
       <button class="btn btn-sm btn-primary editar-paciente" data-id="${p.id}" title="Editar">
  <i class="bi bi-pencil"></i>
</button>
<button class="btn btn-sm btn-danger eliminar-paciente" data-id="${p.id}" title="Eliminar">
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
  document.getElementById("modalFechaNacimiento").value = paciente?.fechaNacimiento || "";

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
      /* Estilos generales */
      table.table tbody tr {
        height: 50px;
      }
      table.table th,
      table.table td {
        padding: 12px 15px;
        vertical-align: middle;
      }
      #buscadorPacientes {
        max-width: 300px;
      }
      #btnNuevoPaciente {
        white-space: nowrap;
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
      }
      /* Espacio horizontal entre columnas */
      .row {
        column-gap: 30px;
      }
      /* Ajuste ancho columnas */
      .col-lg-3 {
        max-width: 220px; /* Más angosta que el 4 normal */
        flex: 0 0 220px;
      }
      /* Alineación botón ver ficha */
      .text-end {
        text-align: right !important;
      }
    </style>

    <div class="row">
      <div class="col-lg-8">
        <div id="tituloPacientes" class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="mb-0">Mis Pacientes</h2>
        </div>

        <div id="contenedorBuscadorBtn" class="d-flex gap-2 mb-3">
          <input type="text" class="form-control" id="buscadorPacientes" placeholder="Buscar paciente..." />
          <button class="btn btn-primary" id="btnNuevoPaciente">Nuevo Paciente</button>
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

        <div id="paginacionPacientes" class="d-flex justify-content-center mb-3">
          <!-- Aquí va la paginación dinámica -->
        </div>

        <!-- CONTENEDOR PARA LA FICHA EXPANDIDA -->
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
  `;

  // Evento para abrir modal de nuevo paciente
  document.getElementById("btnNuevoPaciente").addEventListener("click", () => {
    abrirModalPaciente(); // Abre el modal con formulario vacío para nuevo paciente
  });

  // Buscador de pacientes
  const inputBuscador = document.getElementById("buscadorPacientes");
  inputBuscador.addEventListener("input", () => {
    const texto = inputBuscador.value.trim().toLowerCase();

    if (texto === "") {
      pacientesGlobalFiltrados = pacientesGlobal;
    } else {
      pacientesGlobalFiltrados = pacientesGlobal.filter((p) => {
        const nombreCompleto = (p.nombre + " " + p.apellido).toLowerCase();
        const nombreInvertido = (p.apellido + " " + p.nombre).toLowerCase();
        const dni = p.dni?.toString().toLowerCase() || "";

        return (
          nombreCompleto.includes(texto) ||
          nombreInvertido.includes(texto) ||
          dni.includes(texto)
        );
      });
    }

    paginaActual = 1;
    mostrarPagina(paginaActual);
  });

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

async function cargarTurnosPaginados(pagina = 1, porPagina = 20) {
  const tablaTurnos = document.getElementById("tablaTurnos");
  const paginacion = document.getElementById("paginacionTurnos");
  if (!tablaTurnos || !paginacion) return;

  tablaTurnos.innerHTML = "";
  paginacion.innerHTML = "";

  try {
    const turnosSnapshot = await getDocs(collection(db, "turnos"));
    const turnos = [];
    const hoyFecha = new Date();
    turnosSnapshot.forEach((doc) => {
      const t = doc.data();
      const turnoFecha = new Date(`${t.fecha}T${t.hora}`);
      if (turnoFecha >= hoyFecha || t.fecha === hoy()) {
        turnos.push({ id: doc.id, ...t });
      }
    });

    turnos.sort((a, b) => {
      const fechaA = `${a.fecha}T${a.hora}`;
      const fechaB = `${b.fecha}T${b.hora}`;
      return fechaA.localeCompare(fechaB);
    });

    const totalPaginas = Math.ceil(turnos.length / porPagina);
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
        <td>${t.montoAbonado ? `$${t.montoAbonado.toFixed(2)}` : "-"}</td>
        <td>
          <div class="d-flex justify-content-end gap-4 flex-wrap">
            <div class="d-flex gap-2">
              ${
                !t.asistio && !t.cancelado && !t.ausente
                  ? `
                    <button class="btn btn-sm btn-success btn-asistio" data-id="${t.id}" title="Marcar como asistió">
                      <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-warning btn-cancelar" data-id="${t.id}" title="Marcar como cancelado">
                      <i class="bi bi-x-octagon"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary btn-ausente" data-id="${t.id}" title="Marcar como ausente">
                      <i class="bi bi-person-x"></i>
                    </button>
                  `
                  : ""
              }
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-info btn-editar" data-id="${
                t.id
              }" title="Editar turno">
                <i class="bi bi-pencil"></i>
              </button>
              ${
                t.asistio
                  ? `<button class="btn btn-sm btn-outline-danger" disabled title="No se puede eliminar un turno asistido">
                      <i class="bi bi-trash" style="text-decoration: line-through; opacity: 0.5;"></i>
                    </button>`
                  : `<button class="btn btn-sm btn-danger btn-eliminar" data-id="${t.id}" title="Eliminar turno">
                      <i class="bi bi-trash"></i>
                    </button>`
              }
            </div>
          </div>
        </td>
      `;
      tablaTurnos.appendChild(fila);
    }

    // Eventos botones (usando .closest)
    document.querySelectorAll(".btn-asistio").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const boton = e.target.closest(".btn-asistio");
        if (!boton) return;
        const turnoId = boton.dataset.id;
        const monto = prompt("Monto abonado:", "0");
        if (monto === null) return;
        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum < 0) {
          alert("Monto inválido.");
          return;
        }

        const turnoDocRef = doc(db, "turnos", turnoId);
        const turnoSnap = await getDoc(turnoDocRef);
        const turno = turnoSnap.data();

        await updateDoc(turnoDocRef, {
          asistio: true,
          montoAbonado: montoNum,
        });

        if (montoNum > 0) {
          await addDoc(collection(db, "caja"), {
            fecha: hoy(),
            monto: montoNum,
            pacienteNombre: turno.pacienteNombre,
            tipoConsulta: turno.tipoConsulta || "-",
            detalle: "Pago turno",
          });
        }

        alert("Asistencia registrada.");
        cargarTurnosPaginados(pagina);
      });
    });

    document.querySelectorAll(".btn-cancelar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const boton = e.target.closest(".btn-cancelar");
        if (!boton) return;
        const turnoId = boton.dataset.id;
        if (!confirm("¿Marcar este turno como cancelado?")) return;
        await updateDoc(doc(db, "turnos", turnoId), { cancelado: true });
        alert("Turno cancelado.");
        cargarTurnosPaginados(pagina);
      });
    });

    document.querySelectorAll(".btn-ausente").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const boton = e.target.closest(".btn-ausente");
        if (!boton) return;
        const turnoId = boton.dataset.id;
        if (!confirm("¿Marcar este turno como ausente?")) return;
        await updateDoc(doc(db, "turnos", turnoId), { ausente: true });
        alert("Turno marcado como ausente.");
        cargarTurnosPaginados(pagina);
      });
    });

    document.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const boton = e.target.closest(".btn-eliminar");
        if (!boton) return;
        const turnoId = boton.dataset.id;
        if (!confirm("¿Eliminar este turno?")) return;

        try {
          await deleteDoc(doc(db, "turnos", turnoId));
          alert("Turno eliminado.");

          const btnActivo = document.querySelector(
            "#paginacionTurnos .btn-primary"
          );
          const paginaActual = btnActivo ? parseInt(btnActivo.textContent) : 1;
          cargarTurnosPaginados(paginaActual);
        } catch (error) {
          alert("Error al eliminar turno: " + error.message);
        }
      });
    });

    for (let i = 1; i <= totalPaginas; i++) {
      const btn = document.createElement("button");
      btn.className = `btn btn-sm mx-1 ${
        i === pagina ? "btn-primary" : "btn-outline-primary"
      }`;
      btn.textContent = i;
      btn.addEventListener("click", () => cargarTurnosPaginados(i));
      paginacion.appendChild(btn);
    }
  } catch (error) {
    alert("Error al cargar turnos: " + error.message);
  }
}

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

function mostrarAgendaTurnos() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Gestión de Turnos</h1>
    <form id="formTurno" class="row g-3 mb-4">
      <div class="col-md-4">
        <label for="fechaTurno" class="form-label">Fecha *</label>
        <input type="date" id="fechaTurno" class="form-control" required />
      </div>
      <div class="col-md-4">
        <label for="horaTurno" class="form-label">Hora *</label>
        <input type="time" id="horaTurno" class="form-control" required />
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

  // Botón editar - con estado
  document.addEventListener("click", async (e) => {
    const btnEditar = e.target.closest(".btn-editar");
    if (btnEditar) {
      const turnoId = btnEditar.dataset.id;

      try {
        const docSnap = await getDoc(doc(db, "turnos", turnoId));
        if (!docSnap.exists()) return alert("Turno no encontrado");

        const t = docSnap.data();

        document.getElementById("editarTurnoId").value = turnoId;
        document.getElementById("editarFecha").value = t.fecha;
        document.getElementById("editarHora").value = t.hora;
        document.getElementById("editarMonto").value = t.montoAbonado || 0;

        // Setear el estado actual del turno
        let estado = "";
        if (t.asistio) estado = "asistio";
        else if (t.cancelado) estado = "cancelado";
        else if (t.ausente) estado = "ausente";

        document.getElementById("editarEstado").value = estado;

        const modal = new bootstrap.Modal(
          document.getElementById("modalEditarTurno")
        );
        modal.show();
      } catch (err) {
        alert("Error al cargar turno para editar");
      }
    }
  });

  // Formulario de edición
  document
    .getElementById("formEditarTurno")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("editarTurnoId").value;
      const fecha = document.getElementById("editarFecha").value;
      const hora = document.getElementById("editarHora").value;
      const monto =
        parseFloat(document.getElementById("editarMonto").value) || 0;
      const estado = document.getElementById("editarEstado").value;

      const dataUpdate = {
        fecha,
        hora,
        montoAbonado: monto,
        asistio: false,
        cancelado: false,
        ausente: false,
      };

      if (estado === "asistio") dataUpdate.asistio = true;
      else if (estado === "cancelado") dataUpdate.cancelado = true;
      else if (estado === "ausente") dataUpdate.ausente = true;

      try {
        // 1) Actualizar turno
        await updateDoc(doc(db, "turnos", id), dataUpdate);

        // 2) Buscar el turno actualizado para obtener pacienteId y nombre (necesario para caja)
        const turnoDoc = await getDoc(doc(db, "turnos", id));
        if (!turnoDoc.exists())
          throw new Error("Turno no encontrado después de actualizar");

        const turnoData = turnoDoc.data();

        // 3) Buscar si ya existe un movimiento en caja vinculado a este turno
        const cajaQuery = query(
          collection(db, "caja"),
          where("turnoId", "==", id)
        );
        const cajaSnapshot = await getDocs(cajaQuery);

        if (cajaSnapshot.empty) {
          // 4) No existe movimiento caja: crear uno nuevo
          await addDoc(collection(db, "caja"), {
            turnoId: id,
            pacienteId: turnoData.pacienteId || "",
            pacienteNombre: turnoData.pacienteNombre || "",
            fecha,
            hora,
            monto,
            tipo: "Ingreso",
            detalle: `Pago turno ${fecha} ${hora}`,
            fechaCreacion: new Date().toISOString(),
          });
        } else {
          // 5) Existe movimiento caja: actualizarlo
          const cajaDoc = cajaSnapshot.docs[0];
          await updateDoc(doc(db, "caja", cajaDoc.id), {
            fecha,
            hora,
            monto,
            pacienteNombre: turnoData.pacienteNombre || "",
            pacienteId: turnoData.pacienteId || "",
            detalle: `Pago turno ${fecha} ${hora}`,
          });
        }

        alert("Turno y caja actualizados correctamente.");

        bootstrap.Modal.getInstance(
          document.getElementById("modalEditarTurno")
        ).hide();

        cargarTurnosPaginados();
        cargarCaja(); // <-- Recarga caja para actualizar valores en pantalla
      } catch (err) {
        alert("Error al actualizar turno y caja: " + err.message);
      }
    });

  // Formulario para agregar turnos
  document.getElementById("formTurno").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fecha = document.getElementById("fechaTurno").value;
    const hora = document.getElementById("horaTurno").value;
    const pacienteId = document.getElementById("pacienteSelect").value;
    const tipoConsulta = document.getElementById("tipoConsulta").value.trim();
    const duracion = parseInt(
      document.getElementById("duracionTurno").value,
      10
    );

    if (!fecha || !hora || !pacienteId || isNaN(duracion) || duracion <= 0) {
      alert(
        "Complete todos los campos obligatorios y ponga una duración válida."
      );
      return;
    }

    try {
      // Verificar duplicado
      const turnosSnapshot = await getDocs(collection(db, "turnos"));
      let yaExiste = false;
      turnosSnapshot.forEach((doc) => {
        const t = doc.data();
        if (t.fecha === fecha && t.hora === hora) {
          yaExiste = true;
        }
      });
      if (yaExiste) {
        alert("Ya hay un turno registrado en ese horario. Elegí otro.");
        return;
      }

      const pacienteDoc = await getDoc(doc(db, "pacientes", pacienteId));
      if (!pacienteDoc.exists()) {
        alert("Paciente no encontrado.");
        return;
      }

      const pacienteData = pacienteDoc.data();

      await addDoc(collection(db, "turnos"), {
        fecha,
        hora,
        pacienteId,
        pacienteNombre: pacienteData.apellido + " " + pacienteData.nombre,
        tipoConsulta,
        asistio: false,
        montoAbonado: 0,
        duracionMinutos: duracion,
      });

      alert("Turno agregado.");
      cargarTurnosPaginados();
      e.target.reset();
    } catch (error) {
      alert("Error al agregar turno: " + error.message);
    }
  });
}

let cajaMovimientosFiltrados = [];
let cajaPaginaActual = 1;
const cajaPorPagina = 10;

// --- GESTIÓN CAJA ---

// Función auxiliar para obtener lunes y sábado de la semana de una fecha YYYY-MM-DD
function calcularSemana(fechaStr) {
  const fecha = new Date(fechaStr);
  const diaSemana = fecha.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffLunes = (diaSemana + 6) % 7; // días a restar para llegar lunes
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - diffLunes);
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);

  // Formatear a YYYY-MM-DD
  function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return { desde: formatDate(lunes), hasta: formatDate(sabado) };
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

    // ---- AGREGADO: ordenar por fecha descendente (más recientes primero) ----
    cajaMovimientosFiltrados.sort((a, b) => {
      const fechaHoraA = new Date(a.fecha + "T" + (a.hora || "00:00"));
      const fechaHoraB = new Date(b.fecha + "T" + (b.hora || "00:00"));
      return fechaHoraB - fechaHoraA;
    });
    // -------------------------------------------------------------------------

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
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${pago.fecha}</td>
      <td class="fw-bold ${pago.monto >= 0 ? "text-success" : "text-danger"}">
        $${pago.monto.toFixed(2)}
      </td>
      <td>${pago.pacienteNombre || "-"}</td>
      <td>${pago.tipoConsulta || "-"}</td>
      <td>${pago.detalle || "-"}</td>
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

function mostrarCaja() {
  mainContent.innerHTML = `
    <div class="row">
      <div class="col-lg-8">
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
                    <label for="montoCajaModal" class="form-label">Monto *</label>
                    <input type="number" id="montoCajaModal" class="form-control" required />
                    <div class="invalid-feedback">Por favor ingrese un monto válido.</div>
                  </div>
                  <div class="mb-3">
                    <label for="pacienteCajaModal" class="form-label">Paciente</label>
                    <input type="text" id="pacienteCajaModal" class="form-control" />
                  </div>
                  <div class="mb-3">
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
              <table class="table table-striped">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Paciente</th>
                    <th>Tipo Consulta</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody id="tablaCaja"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-3 mx-auto" style="max-width: 300px; padding-left: 10px; padding-right: 10px;">
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

  // Abrir modal al clickear el botón
  document
    .getElementById("btnNuevoMovimiento")
    .addEventListener("click", () => {
      const modal = new bootstrap.Modal(
        document.getElementById("modalNuevoMovimiento")
      );
      modal.show();
    });

  // Botones filtros
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

  // Formulario modal submit
  const formCajaModal = document.getElementById("formCajaModal");
  formCajaModal.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validación Bootstrap nativa
    if (!formCajaModal.checkValidity()) {
      formCajaModal.classList.add("was-validated");
      return;
    }

    const fecha = document.getElementById("fechaCajaModal").value;
    const monto = parseFloat(document.getElementById("montoCajaModal").value);
    const pacienteNombre = document
      .getElementById("pacienteCajaModal")
      .value.trim();
    const tipoConsulta = document
      .getElementById("tipoConsultaCajaModal")
      .value.trim();
    const detalle = document.getElementById("detalleCajaModal").value.trim();

    try {
      await addDoc(collection(db, "caja"), {
        fecha,
        monto,
        pacienteNombre: pacienteNombre || "-",
        tipoConsulta: tipoConsulta || "-",
        detalle: detalle || "-",
      });
      alert("Movimiento agregado.");
      formCajaModal.reset();
      formCajaModal.classList.remove("was-validated");
      // Cerrar modal
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
  });
});
