// Función auxiliar para obtener fecha hoy en formato YYYY-MM-DD
function hoy() {
  return new Date().toISOString().slice(0, 10);
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

  <div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
  <input type="date" id="selectorFecha" class="form-control form-control-sm" style="width: 160px;" />
  <input type="text" id="busquedaPaciente" class="form-control form-control-sm" placeholder="Buscar paciente por nombre o DNI..." style="flex: 1; max-width: 800px;" />
</div>
<div id="resultadosBusqueda" class="mt-2"></div>


    <div id="calendar" style="height: 600px; overflow-y: auto; border: 1px solid #ddd;"></div>
  `;

  await cargarTodosPacientes();
  await cargarTodosTurnos();

  const selectorFecha = document.getElementById("selectorFecha");
  selectorFecha.value = new Date().toISOString().slice(0, 10);

  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    initialDate: selectorFecha.value,
    slotDuration: "00:15:00",
    allDaySlot: false,
    height: "600",
    expandRows: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridDay,timeGridWeek",
    },
    slotLabelInterval: "01:00",
    nowIndicator: true,
    slotMinTime: "07:00:00",
    slotMaxTime: "22:00:00",
    eventOverlap: false,
    events: async function (info, successCallback, failureCallback) {
      const fecha = selectorFecha.value;
      const eventos = await obtenerEventosDelDia(fecha);
      successCallback(eventos);
    },
  });

  calendar.render();

  const inputBusqueda = document.getElementById("busquedaPaciente");
  const resultadosBusqueda = document.getElementById("resultadosBusqueda");

  let busquedaId = 0; // id para controlar búsquedas asincrónicas

  inputBusqueda.addEventListener("input", async (e) => {
    const texto = e.target.value.trim().toLowerCase();

    // Incrementamos el id para la búsqueda actual
    const currentId = ++busquedaId;

    // Limpiamos resultados inmediatamente
    resultadosBusqueda.innerHTML = "";

    if (texto === "") {
      return;
    }

    try {
      const pacientesEncontrados = [];
      const pacientesSnapshot = await getDocs(collection(db, "pacientes"));

      // Si ya hay una búsqueda más nueva, cancelamos esta
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

      if (currentId !== busquedaId) return;

      if (pacientesEncontrados.length === 0) {
        resultadosBusqueda.innerHTML = "<p>No se encontraron pacientes.</p>";
        return;
      }

      let html = "<ul class='list-group'>";
      const fechaHoy = new Date().toISOString().slice(0, 10);

      for (const paciente of pacientesEncontrados) {
        const turnosSnap = await getDocs(collection(db, "turnos"));
        if (currentId !== busquedaId) return;

        const turnos = [];
        turnosSnap.forEach((docu) => {
          const t = docu.data();
          if (t.pacienteId === paciente.id && t.fecha >= fechaHoy) {
            turnos.push(t);
          }
        });

        html += `<li class="list-group-item">
        <strong>${paciente.apellido}, ${paciente.nombre}</strong> - DNI: ${paciente.dni}<br/>
        <em>Próximos turnos:</em>
        <ul>`;

        if (turnos.length === 0) {
          html += "<li>No tiene próximos turnos.</li>";
        } else {
          turnos.forEach((t) => {
            html += `<li>${t.fecha} ${t.hora} - ${
              t.tipoConsulta || "Consulta"
            }</li>`;
          });
        }

        html += "</ul></li>";
      }
      html += "</ul>";

      if (currentId === busquedaId) {
        resultadosBusqueda.innerHTML = html;
      }
    } catch (error) {
      console.error("Error en búsqueda:", error);
      if (currentId === busquedaId) {
        resultadosBusqueda.innerHTML =
          "<p class='text-danger'>Error al buscar pacientes.</p>";
      }
    }
  });

  selectorFecha.addEventListener("change", (e) => {
    calendar.gotoDate(e.target.value);
    calcularEstadisticas(e.target.value);
  });

  calcularEstadisticas(selectorFecha.value);
}
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
      <button class="btn btn-sm btn-secondary ver-ficha" data-id="${
        p.id
      }">Ver ficha</button>
    </td>
  `;
    tablaPacientes.appendChild(fila);
  });

  // Botones "Ver ficha"
  agregarEventosVerFicha();

  // Actualizar controles de paginación
  mostrarControlesPaginacion(totalPaginas);
}
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

function agregarEventosVerFicha() {
  document.querySelectorAll(".ver-ficha").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const pacienteId = e.target.dataset.id;
      if (!pacienteId) return;

      const pacienteRef = doc(db, "pacientes", pacienteId);
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists()) {
        alert("Paciente no encontrado");
        return;
      }
      const paciente = pacienteSnap.data();

      // Mostrar datos
      document.getElementById("fichaApellido").textContent =
        paciente.apellido || "-";
      document.getElementById("fichaNombre").textContent =
        paciente.nombre || "-";
      document.getElementById("fichaDNI").textContent = paciente.dni || "-";
      document.getElementById("fichaTelefono").textContent =
        paciente.telefono || "-";
      document.getElementById("fichaDireccion").textContent =
        paciente.direccion || "-";
      document.getElementById("fichaObraSocial").textContent =
        paciente.obraSocial || "-";
      document.getElementById("fichaGenero").textContent =
        paciente.genero || "-";
      document.getElementById("fichaFechaNacimiento").textContent =
        paciente.fechaNacimiento || "-";

      // Vaciar listas
      const ulTurnos = document.getElementById("fichaTurnos");
      const ulPagos = document.getElementById("fichaPagos");
      const ulNotas = document.getElementById("fichaNotas");
      const ulArchivos = document.getElementById("fichaArchivos");
      ulTurnos.innerHTML = "";
      ulPagos.innerHTML = "";
      ulNotas.innerHTML = "";
      ulArchivos.innerHTML = "";

      // Cargar turnos
      const turnosSnap = await getDocs(collection(db, "turnos"));
      turnosSnap.forEach((docu) => {
        const turno = docu.data();
        if (turno.pacienteId === pacienteId) {
          const li = document.createElement("li");
          li.classList.add("list-group-item");
          li.textContent = `${turno.fecha} ${turno.hora} - ${
            turno.tipoConsulta || "-"
          } - Asistió: ${turno.asistio ? "Sí" : "No"} - Monto: $${
            turno.montoAbonado?.toFixed(2) || "0.00"
          }`;
          ulTurnos.appendChild(li);
        }
      });

      // Cargar pagos
      const cajaSnap = await getDocs(collection(db, "caja"));
      cajaSnap.forEach((docu) => {
        const pago = docu.data();
        if (pago.pacienteNombre === paciente.apellido + " " + paciente.nombre) {
          const li = document.createElement("li");
          li.classList.add("list-group-item");
          li.textContent = `${pago.fecha} - $${pago.monto.toFixed(2)} - ${
            pago.tipoConsulta || "-"
          }`;
          ulPagos.appendChild(li);
        }
      });

      // Mostrar modal
      const modalFicha = new bootstrap.Modal(
        document.getElementById("modalFichaPaciente")
      );
      modalFicha.show();
    });
  });
}

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
      #formPaciente .form-control {
        padding: 8px 10px;
      }
      #formPaciente .col-md-4,
      #formPaciente .col-md-6 {
        margin-bottom: 15px;
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
      .col-lg-8 {
        /* Mantener igual, nada que cambiar */
      }
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
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="mb-0">Mis Pacientes</h2>
          <div class="d-flex gap-2">
            <input type="text" class="form-control" id="buscadorPacientes" placeholder="Buscar paciente..." />
            <button class="btn btn-primary" id="btnNuevoPaciente">Nuevo Paciente</button>
          </div>
        </div>

        <div class="collapse mb-4" id="formularioPaciente">
          <form id="formPaciente" class="row g-3">
            <div class="col-md-4">
              <label for="apellido" class="form-label">Apellido *</label>
              <input type="text" class="form-control" id="apellido" required />
            </div>
            <div class="col-md-4">
              <label for="nombre" class="form-label">Nombre *</label>
              <input type="text" class="form-control" id="nombre" required />
            </div>
            <div class="col-md-4">
              <label for="dni" class="form-label">DNI *</label>
              <input type="text" class="form-control" id="dni" required />
            </div>

            <div class="col-md-4">
              <label for="fechaNacimiento" class="form-label">Fecha de Nacimiento</label>
              <input type="date" class="form-control" id="fechaNacimiento" />
            </div>
            <div class="col-md-4">
              <label for="telefono" class="form-label">Teléfono *</label>
              <input type="tel" class="form-control" id="telefono" required />
            </div>
            <div class="col-md-4">
              <label for="direccion" class="form-label">Dirección</label>
              <input type="text" class="form-control" id="direccion" />
            </div>

            <div class="col-md-6">
              <label for="genero" class="form-label">Género</label>
              <select class="form-select" id="genero">
                <option value="" selected>Seleccionar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="col-md-6">
              <label for="obraSocial" class="form-label">Obra Social</label>
              <input type="text" class="form-control" id="obraSocial" />
            </div>

            <div class="col-12">
              <button type="submit" class="btn btn-success">Guardar Paciente</button>
            </div>
          </form>
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
      </div>

      <div class="col-lg-3">
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

  document.getElementById("btnNuevoPaciente").addEventListener("click", () => {
    const collapse = document.getElementById("formularioPaciente");
    collapse.classList.toggle("show");
  });

  const formPaciente = document.getElementById("formPaciente");
  formPaciente.addEventListener("submit", async (e) => {
    e.preventDefault();
    const paciente = {
      apellido: document.getElementById("apellido").value.trim(),
      nombre: document.getElementById("nombre").value.trim(),
      dni: document.getElementById("dni").value.trim(),
      telefono: document.getElementById("telefono").value.trim(),
      direccion: document.getElementById("direccion").value.trim(),
      obraSocial: document.getElementById("obraSocial").value.trim(),
      genero: document.getElementById("genero").value,
      fechaNacimiento: document.getElementById("fechaNacimiento").value,
      fechaIngreso: new Date().toISOString().slice(0, 10),
    };

    try {
      await addDoc(collection(db, "pacientes"), paciente);
      alert("Paciente guardado correctamente");
      formPaciente.reset();
      document.getElementById("formularioPaciente").classList.remove("show");
      paginaActual = 1;
      cargarPacientes();
    } catch (error) {
      alert("Error al guardar paciente: " + error.message);
    }
  });
  // Funcionalidad del buscador
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

    // Ordenar por fecha y hora
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
 <td>${t.montoAbonado ? `$${t.montoAbonado.toFixed(2)}` : "-"}</td>
<td>
  <div class="d-flex justify-content-end gap-1 flex-wrap">
    ${
      !t.asistio && !t.cancelado && !t.ausente
        ? `
      <button class="btn btn-sm btn-success btn-asistio" data-id="${t.id}" title="Marcar como asistió">✔️</button>
      <button class="btn btn-sm btn-warning btn-cancelar" data-id="${t.id}" title="Marcar como cancelado">⚠️</button>
      <button class="btn btn-sm btn-secondary btn-ausente" data-id="${t.id}" title="Marcar como ausente">❌</button>
      `
        : ""
    }
    <button class="btn btn-sm btn-info btn-editar" data-id="${
      t.id
    }" title="Editar turno">✏️</button>
    <button class="btn btn-sm btn-danger btn-eliminar" data-id="${
      t.id
    }" title="Eliminar turno">🗑️</button>
  </div>
</td>

  `;
      tablaTurnos.appendChild(fila);
    }

    // Eventos botones
    document.querySelectorAll(".btn-asistio").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const turnoId = e.target.dataset.id;
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
        cargarTurnosPaginados(pagina); // recargar página actual
      });
    });

    document.querySelectorAll(".btn-cancelar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const turnoId = e.target.dataset.id;
        if (!confirm("¿Marcar este turno como cancelado?")) return;
        await updateDoc(doc(db, "turnos", turnoId), { cancelado: true });
        alert("Turno cancelado.");
        cargarTurnosPaginados(pagina);
      });
    });
    document.querySelectorAll(".btn-ausente").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const turnoId = e.target.dataset.id;
        if (!confirm("¿Marcar este turno como ausente?")) return;
        await updateDoc(doc(db, "turnos", turnoId), { ausente: true });
        alert("Turno marcado como ausente.");
        cargarTurnosPaginados(pagina);
      });
    });
    document.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const turnoId = e.target.dataset.id;
        if (!confirm("¿Eliminar este turno?")) return;

        try {
          await deleteDoc(doc(db, "turnos", turnoId));
          alert("Turno eliminado.");

          // ✅ Recalcular la página actual según el botón activo
          const btnActivo = document.querySelector(
            "#paginacionTurnos .btn-primary"
          );
          const paginaActual = btnActivo ? parseInt(btnActivo.textContent) : 1;

          // 🔁 Volver a cargar la página actual
          cargarTurnosPaginados(paginaActual);
        } catch (error) {
          alert("Error al eliminar turno: " + error.message);
        }
      });
    });

    // Paginación
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

async function obtenerEventosDelDia(fecha) {
  const eventos = [];
  try {
    const snapshot = await getDocs(collection(db, "turnos"));
    snapshot.forEach((doc) => {
      const turno = doc.data();
      if (turno.fecha === fecha) {
        const start = new Date(`${turno.fecha}T${turno.hora}`);
        const duracionMinutos = Number(turno.duracionMinutos);
        const minutosFinal = isNaN(duracionMinutos) ? 15 : duracionMinutos;
        const end = new Date(start.getTime() + minutosFinal * 60000);

        eventos.push({
          title:
            turno.pacienteNombre +
            (turno.tipoConsulta ? " - " + turno.tipoConsulta : ""),
          start,
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
        <input type="text" id="tipoConsulta" class="form-control" />
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
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tablaTurnos"></tbody>
      <div id="paginacionTurnos" class="my-3 d-flex justify-content-center align-items-center"></div>

    </table>
  `;

  cargarPacientesSelect();
  cargarTurnosPaginados();
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-editar")) {
      const turnoId = e.target.dataset.id;

      try {
        const docSnap = await getDoc(doc(db, "turnos", turnoId));
        if (!docSnap.exists()) return alert("Turno no encontrado");

        const t = docSnap.data();

        document.getElementById("editarTurnoId").value = turnoId;
        document.getElementById("editarFecha").value = t.fecha;
        document.getElementById("editarHora").value = t.hora;
        document.getElementById("editarMonto").value = t.montoAbonado || 0;

        const modal = new bootstrap.Modal(
          document.getElementById("modalEditarTurno")
        );
        modal.show();
      } catch (err) {
        alert("Error al cargar turno para editar");
      }
    }
  });

  document
    .getElementById("formEditarTurno")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("editarTurnoId").value;
      const fecha = document.getElementById("editarFecha").value;
      const hora = document.getElementById("editarHora").value;
      const monto =
        parseFloat(document.getElementById("editarMonto").value) || 0;

      try {
        await updateDoc(doc(db, "turnos", id), {
          fecha,
          hora,
          montoAbonado: monto,
        });

        alert("Turno actualizado.");
        bootstrap.Modal.getInstance(
          document.getElementById("modalEditarTurno")
        ).hide();
        cargarTurnosPaginados(1);
      } catch (err) {
        alert("Error al actualizar turno.");
      }
    });

  document
    .getElementById("formEditarTurno")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("turnoIdEditar").value;
      const fecha = document.getElementById("fechaEditar").value;
      const hora = document.getElementById("horaEditar").value;
      const tipo = document.getElementById("tipoConsultaEditar").value.trim();
      const duracion = parseInt(
        document.getElementById("duracionEditar").value,
        10
      );

      const contenedorMonto = document.getElementById("contenedorMontoEditar");
      const inputMonto = document.getElementById("montoEditar");

      try {
        const updateData = {
          fecha,
          hora,
          tipoConsulta: tipo,
          duracionMinutos: duracion,
        };

        if (contenedorMonto.style.display === "block") {
          const montoVal = parseFloat(inputMonto.value);
          if (isNaN(montoVal) || montoVal < 0) {
            alert("Monto inválido");
            return;
          }
          updateData.montoAbonado = montoVal;
        }

        await updateDoc(doc(db, "turnos", id), updateData);

        alert("Turno actualizado.");
        bootstrap.Modal.getInstance(
          document.getElementById("modalEditarTurno")
        ).hide();
        cargarTurnosPaginados(1);
      } catch (err) {
        alert("Error al actualizar turno.");
      }
    });

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
      // 🔒 Verificar si ya hay un turno en ese horario
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

    const resumenIngresos = document.getElementById("resumenIngresos");
    const resumenEgresos = document.getElementById("resumenEgresos");
    const resumenSaldo = document.getElementById("resumenSaldo");
    const resumenCantidad = document.getElementById("resumenCantidad"); // NUEVO

    if (resumenIngresos)
      resumenIngresos.textContent = "$" + ingresos.toFixed(2);
    if (resumenEgresos) resumenEgresos.textContent = "$" + egresos.toFixed(2);
    if (resumenSaldo)
      resumenSaldo.textContent = "$" + (ingresos - egresos).toFixed(2);

    if (resumenCantidad)
      resumenCantidad.textContent = cajaMovimientosFiltrados.length; // NUEVO

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
      <!-- Columna principal -->
      <div class="col-lg-8">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h1 class="mb-0">Caja diaria</h1>
          <button class="btn btn-primary" id="btnNuevoMovimiento">Nuevo Movimiento</button>
        </div>

        <!-- Caja: filtros + movimientos -->
        <div class="card mb-4">
          <div class="card-body">
            <!-- Filtros por fecha -->
            <div class="row g-2 mb-3">
              <div class="col-md-5">
                <label for="filtroDesde" class="form-label">Desde</label>
                <input type="date" id="filtroDesde" class="form-control" />
              </div>
              <div class="col-md-5">
                <label for="filtroHasta" class="form-label">Hasta</label>
                <input type="date" id="filtroHasta" class="form-control" />
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-outline-secondary w-100" id="btnAplicarFiltros">Filtrar</button>
              </div>
            </div>

            <!-- Formulario oculto -->
            <div class="collapse mb-3" id="formularioCaja">
              <form id="formCaja" class="row g-3">
                <div class="col-md-4">
                  <label for="fechaCaja" class="form-label">Fecha *</label>
                  <input type="date" id="fechaCaja" class="form-control" value="${hoy()}" required />
                </div>
                <div class="col-md-4">
                  <label for="montoCaja" class="form-label">Monto *</label>
                  <input type="number" id="montoCaja" class="form-control" required />
                </div>
                <div class="col-md-4">
                  <label for="detalleCaja" class="form-label">Detalle</label>
                  <input type="text" id="detalleCaja" class="form-control" />
                </div>
                <div class="col-md-6">
                  <label for="pacienteCaja" class="form-label">Paciente</label>
                  <input type="text" id="pacienteCaja" class="form-control" />
                </div>
                <div class="col-md-6">
                  <label for="tipoConsultaCaja" class="form-label">Tipo de Consulta</label>
                  <input type="text" id="tipoConsultaCaja" class="form-control" />
                </div>
                <div class="col-12">
                  <button type="submit" class="btn btn-success">Agregar Movimiento</button>
                </div>
              </form>
            </div>

            <!-- Tabla de movimientos -->
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

      <!-- Columna lateral con estadísticas centrada y con menos margen -->
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

  document
    .getElementById("btnNuevoMovimiento")
    .addEventListener("click", () => {
      document.getElementById("formularioCaja").classList.toggle("show");
    });

  document.getElementById("btnAplicarFiltros").addEventListener("click", () => {
    const desde = document.getElementById("filtroDesde").value;
    const hasta = document.getElementById("filtroHasta").value;
    cargarCaja(desde, hasta);
  });

  const formCaja = document.getElementById("formCaja");
  formCaja.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fecha = document.getElementById("fechaCaja").value;
    const monto = parseFloat(document.getElementById("montoCaja").value);
    const pacienteNombre = document.getElementById("pacienteCaja").value.trim();
    const tipoConsulta = document
      .getElementById("tipoConsultaCaja")
      .value.trim();
    const detalle = document.getElementById("detalleCaja").value.trim();

    if (!fecha || isNaN(monto)) {
      alert("Ingrese fecha y monto válido.");
      return;
    }

    try {
      await addDoc(collection(db, "caja"), {
        fecha,
        monto,
        pacienteNombre: pacienteNombre || "-",
        tipoConsulta: tipoConsulta || "-",
        detalle: detalle || "-",
      });
      alert("Movimiento agregado.");
      formCaja.reset();
      document.getElementById("fechaCaja").value = hoy();
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

    document
      .querySelectorAll("#sidebar a.nav-link")
      .forEach((l) => l.classList.remove("active"));
    e.target.classList.add("active");
    const seccion = e.target.dataset.section;
    if (seccion === "inicio") mostrarInicio();
    else if (seccion === "pacientes") mostrarGestionPacientes();
    else if (seccion === "turnos") mostrarAgendaTurnos();
    else if (seccion === "caja") mostrarCaja();
  });
});
