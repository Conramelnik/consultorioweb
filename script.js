// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Config Firebase (tu configuración)
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

// --- Gestión de Pacientes ---
async function cargarPacientes() {
  const tablaPacientes = document.getElementById("tablaPacientes");
  if (!tablaPacientes) return;
  tablaPacientes.innerHTML = "";
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
    `;
    tablaPacientes.appendChild(fila);
  });
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

// --- Gestión de Turnos ---
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

async function cargarTurnos() {
  const tablaTurnos = document.getElementById("tablaTurnos");
  if (!tablaTurnos) return;
  tablaTurnos.innerHTML = "";
  const turnosSnapshot = await getDocs(collection(db, "turnos"));
  turnosSnapshot.forEach((doc) => {
    const t = doc.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${t.fecha}</td>
      <td>${t.hora}</td>
      <td>${t.pacienteNombre}</td>
      <td>${t.tipoConsulta}</td>
      <td>${t.asistio ? "Sí" : "No"}</td>
      <td>${t.montoAbonado ? `$${t.montoAbonado.toFixed(2)}` : "-"}</td>
      <td>
        <button class="btn btn-sm btn-success btn-asistio" data-id="${
          doc.id
        }">Marcar Asistencia</button>
      </td>
    `;
    tablaTurnos.appendChild(fila);
  });

  document.querySelectorAll(".btn-asistio").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const turnoId = e.target.dataset.id;
      const monto = prompt(
        "Ingrese monto abonado por el paciente (0 si no abonó):",
        "0"
      );
      if (monto === null) return;
      const montoNum = parseFloat(monto);
      if (isNaN(montoNum) || montoNum < 0) {
        alert("Monto inválido.");
        return;
      }
      const asistio = confirm("¿El paciente asistió al turno?");
      try {
        // Actualizo turno
        await updateDoc(doc(db, "turnos", turnoId), {
          asistio,
          montoAbonado: montoNum,
        });
        // Si asistió y monto > 0, guardo ingreso en caja con detalle
        if (asistio && montoNum > 0) {
          // Traer turno para detalle
          const turnoDoc = await getDocs(collection(db, "turnos"));
          const turnoRef = doc(db, "turnos", turnoId);
          const turnoSnap = await turnoRef.get();
          const turnoData = turnoSnap.exists() ? turnoSnap.data() : null;

          await addDoc(collection(db, "caja"), {
            fecha: new Date().toISOString().slice(0, 10),
            monto: montoNum,
            pacienteNombre: turnoData?.pacienteNombre || "-",
            tipoConsulta: turnoData?.tipoConsulta || "-",
            turnoId,
          });
        }
        alert("Turno actualizado y caja actualizada.");
        cargarTurnos();
      } catch (error) {
        alert("Error al actualizar turno y caja: " + error.message);
      }
    });
  });
}

function mostrarAgendaTurnos() {
  mainContent.innerHTML = `
    <h2>Agenda de Turnos</h2>
    <form id="formTurno" class="row g-3 mb-4">
      <div class="col-md-6">
        <label for="pacienteSelect" class="form-label">Paciente *</label>
        <select id="pacienteSelect" class="form-select" required>
          <option value="" disabled selected>Seleccionar paciente</option>
        </select>
      </div>
      <div class="col-md-3">
        <label for="fechaTurno" class="form-label">Fecha *</label>
        <input type="date" id="fechaTurno" class="form-control" required />
      </div>
      <div class="col-md-3">
        <label for="horaTurno" class="form-label">Hora *</label>
        <input type="time" id="horaTurno" class="form-control" required />
      </div>
      <div class="col-md-6">
        <label for="tipoConsulta" class="form-label">Tipo de Consulta *</label>
        <select id="tipoConsulta" class="form-select" required>
          <option value="" disabled selected>Seleccionar tipo</option>
          <option value="Consulta">Consulta</option>
          <option value="Control Ortodoncia">Control Ortodoncia</option>
          <option value="Extracción">Extracción</option>
          <option value="Arreglo">Arreglo</option>
          <option value="Limpieza">Limpieza</option>
        </select>
      </div>
      <div class="col-md-6 align-self-end">
        <button type="submit" class="btn btn-primary">Agendar Turno</button>
      </div>
    </form>

    <h3>Turnos agendados</h3>
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Paciente</th>
          <th>Consulta</th>
          <th>Asistió</th>
          <th>Monto abonado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tablaTurnos"></tbody>
    </table>
  `;

  cargarPacientesSelect();

  const formTurno = document.getElementById("formTurno");
  formTurno.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById("pacienteSelect").value;
    const pacienteNombre =
      document.getElementById("pacienteSelect").selectedOptions[0].textContent;
    const fecha = document.getElementById("fechaTurno").value;
    const hora = document.getElementById("horaTurno").value;
    const tipoConsulta = document.getElementById("tipoConsulta").value;

    if (!pacienteId || !fecha || !hora || !tipoConsulta) {
      alert("Complete todos los campos");
      return;
    }

    try {
      await addDoc(collection(db, "turnos"), {
        pacienteId,
        pacienteNombre,
        fecha,
        hora,
        tipoConsulta,
        asistio: false,
        montoAbonado: 0,
      });
      alert("Turno agendado correctamente");
      formTurno.reset();
      cargarTurnos();
    } catch (error) {
      alert("Error al agendar turno: " + error.message);
    }
  });

  cargarTurnos();
}

// --- Caja ---
function mostrarCaja() {
  mainContent.innerHTML = `
    <h2>Caja</h2>
    <form id="formCaja" class="row g-3 mb-4">
      <div class="col-md-6">
        <label for="fechaCaja" class="form-label">Fecha *</label>
        <input type="date" id="fechaCaja" class="form-control" required />
      </div>
      <div class="col-md-6">
        <label for="montoCaja" class="form-label">Monto *</label>
        <input type="number" id="montoCaja" class="form-control" min="0" step="0.01" required />
      </div>
      <div class="col-12">
        <button type="submit" class="btn btn-success">Agregar Ingreso</button>
      </div>
    </form>

    <table class="table table-striped">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Monto</th>
          <th>Paciente</th>
          <th>Tipo Consulta</th>
        </tr>
      </thead>
      <tbody id="tablaCaja"></tbody>
      <tfoot>
        <tr>
          <th>Total</th>
          <th id="totalCaja">$0.00</th>
          <th></th>
          <th></th>
        </tr>
      </tfoot>
    </table>
  `;

  const inputFecha = document.getElementById("fechaCaja");
  inputFecha.valueAsDate = new Date();

  cargarCaja();

  const formCaja = document.getElementById("formCaja");
  formCaja.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fecha = inputFecha.value;
    const monto = parseFloat(document.getElementById("montoCaja").value);

    if (!fecha || isNaN(monto) || monto <= 0) {
      alert("Por favor, completá todos los campos correctamente.");
      return;
    }

    try {
      await addDoc(collection(db, "caja"), {
        fecha,
        monto,
        pacienteNombre: null,
        tipoConsulta: null,
      });
      alert("Ingreso agregado correctamente.");
      formCaja.reset();
      inputFecha.valueAsDate = new Date();
      cargarCaja();
    } catch (error) {
      alert("Error al agregar ingreso: " + error.message);
    }
  });
}

async function cargarCaja() {
  const tablaCaja = document.getElementById("tablaCaja");
  const totalCaja = document.getElementById("totalCaja");

  tablaCaja.innerHTML = "";
  let total = 0;

  try {
    const querySnapshot = await getDocs(collection(db, "caja"));
    let ingresos = [];
    querySnapshot.forEach((doc) => {
      ingresos.push({ id: doc.id, ...doc.data() });
    });

    ingresos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    ingresos.forEach((ingreso) => {
      total += parseFloat(ingreso.monto);
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${ingreso.fecha}</td>
        <td>$${parseFloat(ingreso.monto).toFixed(2)}</td>
        <td>${ingreso.pacienteNombre || "-"}</td>
        <td>${ingreso.tipoConsulta || "-"}</td>
      `;
      tablaCaja.appendChild(fila);
    });

    totalCaja.textContent = `$${total.toFixed(2)}`;
  } catch (error) {
    alert("Error al cargar caja: " + error.message);
  }
}

// --- Navegación ---
document.querySelectorAll("#sidebar a.nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll("#sidebar a.nav-link")
      .forEach((l) => l.classList.remove("active"));
    e.target.classList.add("active");
    const section = e.target.dataset.section;
    if (section === "pacientes") mostrarGestionPacientes();
    else if (section === "turnos") mostrarAgendaTurnos();
    else if (section === "caja") mostrarCaja();
  });
});

// Inicializo en Pacientes
mostrarGestionPacientes();
