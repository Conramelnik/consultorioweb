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

let calendar;

async function mostrarInicio() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Inicio - Agenda</h1>
    <div class="d-flex align-items-center mb-3 gap-2">
      <button id="btnVerSemana" class="btn btn-outline-primary btn-sm">Ver Semana</button>
      <button id="btnVerDia" class="btn btn-outline-primary btn-sm">Ver Día</button>
      <input type="date" id="selectorFecha" class="form-control form-control-sm" style="width: 160px;" />
    </div>

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
<div class="mb-3">
  <input type="text" id="busquedaPaciente" class="form-control form-control-sm" placeholder="Buscar paciente por nombre o DNI..." />
</div>
<div id="resultadosBusqueda" class="mt-2"></div>

    <div id="calendar" style="height: 600px; overflow-y: auto; border: 1px solid #ddd;"></div>
  `;
  await cargarTodosPacientes();
  await cargarTodosTurnos();

  const selectorFecha = document.getElementById("selectorFecha");
  selectorFecha.value = new Date().toISOString().slice(0, 10);

  // Inicializar calendario
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    initialDate: selectorFecha.value,
    slotDuration: "00:15:00",
    allDaySlot: false,
    height: "600",
    expandRows: true,
    headerToolbar: false,
    slotLabelInterval: "01:00",
    nowIndicator: true,
    slotMinTime: "07:00:00",
    slotMaxTime: "22:00:00",
    eventOverlap: false, // 👈 ESTA ES LA LÍNEA CLAVE

    // 👇 Esta parte carga eventos dinámicamente desde Firestore
    events: async function (info, successCallback, failureCallback) {
      const fecha = selectorFecha.value;
      const eventos = await obtenerEventosDelDia(fecha);
      successCallback(eventos);
    },
  });

  calendar.render();
  const inputBusqueda = document.getElementById("busquedaPaciente");
  const resultadosBusqueda = document.getElementById("resultadosBusqueda");

  inputBusqueda.addEventListener("input", async (e) => {
    const texto = e.target.value.trim().toLowerCase();
    resultadosBusqueda.innerHTML = "";

    if (texto.length < 3) {
      resultadosBusqueda.innerHTML = "";
      return;
    }
    const pacientesEncontrados = [];
    const pacientesSnapshot = await getDocs(collection(db, "pacientes"));
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

    if (pacientesEncontrados.length === 0) {
      resultadosBusqueda.innerHTML = "<p>No se encontraron pacientes.</p>";
      return;
    }

    let html = "<ul class='list-group'>";
    for (const paciente of pacientesEncontrados) {
      const turnosSnap = await getDocs(collection(db, "turnos"));
      const turnos = [];
      turnosSnap.forEach((docu) => {
        const t = docu.data();
        if (t.pacienteId === paciente.id) {
          turnos.push(t);
        }
      });

      html += `<li class="list-group-item">
        <strong>${paciente.apellido}, ${paciente.nombre}</strong> - DNI: ${paciente.dni}<br/>
        <em>Turnos:</em>
        <ul>`;
      if (turnos.length === 0) {
        html += "<li>No tiene turnos.</li>";
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
    resultadosBusqueda.innerHTML = html;
  });

  // Eventos botones y selector
  document.getElementById("btnVerSemana").addEventListener("click", () => {
    calendar.changeView("timeGridWeek");
  });

  document.getElementById("btnVerDia").addEventListener("click", () => {
    calendar.changeView("timeGridDay");
  });

  selectorFecha.addEventListener("change", (e) => {
    calendar.gotoDate(e.target.value);
    calcularEstadisticas(e.target.value);
  });

  // Mostrar estadísticas para la fecha inicial
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
    pacientes.forEach((p) => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
    <td>${p.apellido}</td>
    <td>${p.nombre}</td>
    <td>${p.dni}</td>
    <td>${p.telefono || "-"}</td>
    <td>${p.direccion || "-"}</td>
    <td>${p.obraSocial || "-"}</td>
    <td>${p.genero || "-"}</td>
    <td>${p.fechaNacimiento || "-"}</td>
    <td>${p.fechaIngreso || "-"}</td>
    <td>
      <button class="btn btn-sm btn-secondary ver-ficha" data-id="${
        p.id
      }">Ver ficha</button>
    </td>
  `;
      tablaPacientes.appendChild(fila);
    });

    // Botones "Ver ficha"
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

        // Llenar modal
        document.getElementById("fichaNombreCompleto").textContent =
          paciente.apellido + ", " + paciente.nombre;
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

        // Cargar turnos del paciente
        const turnosSnap = await getDocs(collection(db, "turnos"));
        turnosSnap.forEach((docu) => {
          const turno = docu.data();
          if (turno.pacienteId === pacienteId) {
            const li = document.createElement("li");
            li.classList.add("list-group-item");
            li.textContent = `${turno.fecha} ${turno.hora} - ${
              turno.tipoConsulta
            } - Asistió: ${turno.asistio ? "Sí" : "No"} - Monto: $${
              turno.montoAbonado?.toFixed(2) || "0.00"
            }`;
            ulTurnos.appendChild(li);
          }
        });

        // Cargar pagos del paciente
        const cajaSnap = await getDocs(collection(db, "caja"));
        cajaSnap.forEach((docu) => {
          const pago = docu.data();
          if (
            pago.pacienteNombre ===
            paciente.apellido + " " + paciente.nombre
          ) {
            const li = document.createElement("li");
            li.classList.add("list-group-item");
            li.textContent = `${pago.fecha} - $${pago.monto.toFixed(2)} - ${
              pago.tipoConsulta || "-"
            }`;
            ulPagos.appendChild(li);
          }
        });

        // Notas y archivos: por ahora vacío

        // Mostrar modal Bootstrap
        const modalFicha = new bootstrap.Modal(
          document.getElementById("modalFichaPaciente")
        );
        modalFicha.show();
      });
    });
  } catch (error) {
    alert("Error al cargar pacientes: " + error.message);
  }
}

function mostrarGestionPacientes() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Gestión de Pacientes</h1>
    <form id="formPaciente" class="row g-3 mb-4">
      <div class="col-md-6">
        <label for="apellido" class="form-label">Apellido *</label>
        <input type="text" class="form-control" id="apellido" required />
      </div>
      <div class="col-md-6">
        <label for="nombre" class="form-label">Nombre *</label>
        <input type="text" class="form-control" id="nombre" required />
      </div>
      <div class="col-md-4">
        <label for="dni" class="form-label">DNI *</label>
        <input type="text" class="form-control" id="dni" required />
      </div>
      <div class="col-md-4">
        <label for="telefono" class="form-label">Número de Teléfono *</label>
        <input type="tel" class="form-control" id="telefono" required />
      </div>
      <div class="col-md-4">
        <label for="genero" class="form-label">Género</label>
        <select class="form-select" id="genero">
          <option value="" selected>Seleccionar</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
      <div class="col-md-6">
        <label for="direccion" class="form-label">Dirección</label>
        <input type="text" class="form-control" id="direccion" />
      </div>
      <div class="col-md-6">
        <label for="obraSocial" class="form-label">Obra Social</label>
        <input type="text" class="form-control" id="obraSocial" />
      </div>
      <div class="col-md-6">
        <label for="fechaNacimiento" class="form-label">Fecha de Nacimiento</label>
        <input type="date" class="form-control" id="fechaNacimiento" />
      </div>
      <div class="col-12">
        <button type="submit" class="btn btn-primary">Guardar Paciente</button>
      </div>
    </form>

    <table class="table table-striped">
      <thead>
        <tr>
          <th>Apellido</th>
          <th>Nombre</th>
          <th>DNI</th>
          <th>Teléfono</th>
          <th>Dirección</th>
          <th>Obra Social</th>
          <th>Género</th>
          <th>Fecha Nac.</th>
          <th>Fecha Ing.</th>
        </tr>
      </thead>
      <tbody id="tablaPacientes"></tbody>
    </table>
  `;

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
      fechaIngreso: new Date().toISOString().slice(0, 10), // <--- esta línea es la que tenés que agregar
    };

    try {
      await addDoc(collection(db, "pacientes"), paciente);
      alert("Paciente guardado correctamente");
      formPaciente.reset();
      cargarPacientes();
    } catch (error) {
      alert("Error al guardar paciente: " + error.message);
    }
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
        <td>${t.asistio ? "Sí" : t.cancelado ? "Cancelado" : "No"}</td>
        <td>${t.montoAbonado ? `$${t.montoAbonado.toFixed(2)}` : "-"}</td>
       <td>
  ${
    t.asistio
      ? '<span class="text-success fw-bold">Asistió</span>'
      : t.cancelado
      ? '<span class="text-warning fw-bold">Cancelado</span>'
      : `
        <button class="btn btn-sm btn-success btn-asistio" data-id="${t.id}">Asistió</button>
        <button class="btn btn-sm btn-warning btn-cancelar" data-id="${t.id}">Cancelado</button>
        <button class="btn btn-sm btn-danger btn-eliminar" data-id="${t.id}">Eliminar</button>
      `
  }
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

// --- GESTIÓN CAJA ---

async function cargarCaja() {
  const tablaCaja = document.getElementById("tablaCaja");
  if (!tablaCaja) return;
  tablaCaja.innerHTML = "";
  try {
    const cajaSnap = await getDocs(collection(db, "caja"));
    cajaSnap.forEach((doc) => {
      const pago = doc.data();
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${pago.fecha}</td>
        <td>$${pago.monto.toFixed(2)}</td>
        <td>${pago.pacienteNombre || "-"}</td>
        <td>${pago.tipoConsulta || "-"}</td>
        <td>${pago.detalle || "-"}</td>
      `;
      tablaCaja.appendChild(fila);
    });
  } catch (error) {
    alert("Error al cargar caja: " + error.message);
  }
}

function mostrarCaja() {
  mainContent.innerHTML = `
    <h1 class="mb-4">Caja</h1>
    <form id="formCaja" class="row g-3 mb-4">
      <div class="col-md-4">
        <label for="fechaCaja" class="form-label">Fecha *</label>
        <input type="date" id="fechaCaja" class="form-control" value="${hoy()}" required />
      </div>
      <div class="col-md-4">
        <label for="montoCaja" class="form-label">Monto *</label>
        <input type="number" id="montoCaja" class="form-control" min="0" step="0.01" required />
      </div>
      <div class="col-md-4">
        <label for="detalleCaja" class="form-label">Detalle</label>
        <input type="text" id="detalleCaja" class="form-control" placeholder="Concepto o descripción" />
      </div>
      <div class="col-md-6">
        <label for="pacienteCaja" class="form-label">Paciente (opcional)</label>
        <input type="text" id="pacienteCaja" class="form-control" placeholder="Nombre del paciente" />
      </div>
      <div class="col-md-6">
        <label for="tipoConsultaCaja" class="form-label">Tipo de Consulta (opcional)</label>
        <input type="text" id="tipoConsultaCaja" class="form-control" placeholder="Ej: Consulta, Pago turno, Otro" />
      </div>
      <div class="col-12">
        <button type="submit" class="btn btn-primary">Agregar Movimiento</button>
      </div>
    </form>

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
  `;

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

    if (!fecha || isNaN(monto) || monto < 0) {
      alert("Complete fecha y monto válido.");
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
      alert("Movimiento agregado a caja.");
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
