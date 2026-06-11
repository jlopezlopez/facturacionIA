const API_URL = "http://127.0.0.1:8000";
let datosGlobales = { clientes: [] };

// Control de ordenación activa
let ordenActual = "id"; 
let direccionOrden = "desc"; 

// NAVEGACIÓN
function cambiarPestana(pestana) {
    ["clientes", "presupuestos", "facturas"].forEach(p => {
        document.getElementById(`sec-${p}`).classList.add("hidden");
        document.getElementById(`nav-${p}`).className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition text-slate-300 hover:bg-slate-800 hover:text-white";
    });
    document.getElementById(`sec-${pestana}`).classList.remove("hidden");
    document.getElementById(`nav-${pestana}`).className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition bg-slate-800 text-white";
    if(pestana === "clientes") cargarClientes();
}

// AUTENTICACIÓN
document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.append("username", document.getElementById("login-usuario").value);
    params.append("password", document.getElementById("login-password").value);
    try {
        const r = await fetch(`${API_URL}/auth/login`, { method: "POST", body: params });
        if (!r.ok) throw new Error();
        const d = await r.json();
        localStorage.setItem("token_taller", d.access_token);
        localStorage.setItem("usuario_nombre", document.getElementById("login-usuario").value);
        comprobarSesion();
    } catch { alert("Credenciales incorrectas"); }
});

document.getElementById("btn-logout").addEventListener("click", () => { localStorage.clear(); comprobarSesion(); });

function comprobarSesion() {
    const token = localStorage.getItem("token_taller");
    if(token) {
        document.getElementById("vista-login").classList.add("hidden");
        document.getElementById("vista-dashboard").classList.remove("hidden");
        document.getElementById("usuario-sesion").textContent = localStorage.getItem("usuario_nombre");
        cambiarPestana("clientes");
    } else {
        document.getElementById("vista-dashboard").classList.add("hidden");
        document.getElementById("vista-login").classList.remove("hidden");
    }
}

// CLIENTES: DATOS Y RENDERIZADO
async function cargarClientes() {
    try {
        const r = await fetch(`${API_URL}/clientes/`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` } });
        datosGlobales.clientes = await r.json();
        procesarYRenderizarClientes();
    } catch (err) { console.error("Error al pedir clientes", err); }
}

// Función que gestiona la ordenación y pinta el resultado
function ordenarPor(campo) {
    if (ordenActual === campo) {
        direccionOrden = direccionOrden === "asc" ? "desc" : "asc";
    } else {
        ordenActual = campo;
        direccionOrden = "asc";
    }
    procesarYRenderizarClientes();
}

function procesarYRenderizarClientes() {
    // Al aplicar la ordenación trabajamos sobre una copia del array
    let clientesOrdenados = [...datosGlobales.clientes];
    
    clientesOrdenados.sort((a, b) => {
        let valA = a[ordenActual];
        let valB = b[ordenActual];
        
        // Convertimos a minúsculas si estamos ordenando por texto (string)
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        
        if (valA < valB) return direccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return direccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    const tbody = document.getElementById("tbody-clientes");
    tbody.innerHTML = "";
    
    clientesOrdenados.forEach(c => {
        let parteCalle = c.calle ? c.calle : "";
        if (c.numero) parteCalle += `, Nº ${c.numero}`;
        if (c.piso) parteCalle += `, ${c.piso}`;
        
        let parteUbicacion = [];
        if (c.poblacion) parteUbicacion.push(c.poblacion);
        if (c.provincia) parteUbicacion.push(c.provincia);
        let textoUbicacion = parteUbicacion.length > 0 ? ` (${parteUbicacion.join(", ")})` : "";
        
        let textoCP = c.CP ? ` (${c.CP})` : (c.cp ? ` (${c.cp})` : "");
        
        const direccionCompleta = `${parteCalle}${textoUbicacion}${textoCP}`.trim() || "---";
        const obs = c.observaciones ? c.observaciones : "---";

        tbody.innerHTML += `<tr>
            <td class="p-3 font-bold text-blue-900">#${c.id}</td>
            <td class="p-3 font-semibold text-slate-900">${c.razonsocial}</td>
            <td class="p-3 font-mono text-xs">${c.NIF}</td>
            <td class="p-3 text-xs">${c.telefono || '---'}</td>
            <td class="p-3 text-xs text-slate-700 font-medium">${direccionCompleta}</td>
            <td class="p-3 text-xs text-slate-500 italic max-w-xs truncate" title="${obs}">${obs}</td>
            <td class="p-3 text-center space-x-1 whitespace-nowrap">
                <button onclick="verHistorial(${c.id}, '${c.razonsocial}')" class="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded font-semibold hover:bg-blue-100">👁️ Docs</button>
                <button onclick="abrirModalEditar(${c.id})" class="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded hover:bg-slate-200 font-semibold">✏️ Editar</button>
                <button onclick="eliminarCliente(${c.id})" class="text-xs text-red-600 font-bold px-2 py-1 bg-red-50 hover:bg-red-100 rounded">🗑️ Borrar</button>
            </td>
        </tr>`;
    });
}

document.getElementById("btn-nuevo-cliente").addEventListener("click", () => {
    document.getElementById("modal-cliente-titulo").textContent = "➕ Alta de Nuevo Cliente";
    document.getElementById("cliente-id-input").value = ""; 
    document.getElementById("form-cliente").reset();
    document.getElementById("modal-cliente").classList.remove("hidden");
});

function abrirModalEditar(id) {
    const cl = datosGlobales.clientes.find(c => c.id === id);
    if (!cl) return;
    
    document.getElementById("modal-cliente-titulo").textContent = "✏️ Modificar Ficha de Cliente";
    document.getElementById("cliente-id-input").value = cl.id; 
    
    document.getElementById("c-razonsocial").value = cl.razonsocial || "";
    document.getElementById("c-NIF").value = cl.NIF || "";
    document.getElementById("c-telefono").value = cl.telefono || "";
    document.getElementById("c-calle").value = cl.calle || "";
    document.getElementById("c-numero").value = cl.numero || "";
    document.getElementById("c-piso").value = cl.piso || "";
    document.getElementById("c-poblacion").value = cl.poblacion || "";
    document.getElementById("c-provincia").value = cl.provincia || "";
    document.getElementById("c-cp").value = cl.CP || cl.cp || ""; 
    document.getElementById("c-observaciones").value = cl.observaciones || ""; 
    
    document.getElementById("modal-cliente").classList.remove("hidden");
}

document.getElementById("form-cliente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("cliente-id-input").value;
    const rawCp = document.getElementById("c-cp").value.trim();
    
    const datos = {
        NIF: document.getElementById("c-NIF").value.trim(),
        razonsocial: document.getElementById("c-razonsocial").value.trim(),
        calle: document.getElementById("c-calle").value.trim() || null,
        numero: document.getElementById("c-numero").value.trim() || null,
        piso: document.getElementById("c-piso").value.trim() || null,
        poblacion: document.getElementById("c-poblacion").value.trim() || null,
        provincia: document.getElementById("c-provincia").value.trim() || null,
        CP: rawCp !== "" ? parseInt(rawCp, 10) : null,
        cp: rawCp !== "" ? parseInt(rawCp, 10) : null, 
        telefono: document.getElementById("c-telefono").value.trim() || null,
        observaciones: document.getElementById("c-observaciones").value.trim() || null
    };

    const url = id ? `${API_URL}/clientes/${id}` : `${API_URL}/clientes/`; 
    const method = id ? "PUT" : "POST"; 

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
            },
            body: JSON.stringify(datos)
        });
        if (!response.ok) throw new Error();
        document.getElementById("modal-cliente").classList.add("hidden");
        cargarClientes();
    } catch { 
        alert("Error al procesar la ficha. Revisa que los campos cumplan las reglas o que el NIF no esté repetido."); 
    }
});

async function eliminarCliente(id) {
    if (!confirm("¿Seguro que deseas eliminar este cliente?")) return;
    try {
        await fetch(`${API_URL}/clientes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });
        cargarClientes();
    } catch { alert("Error al borrar."); }
}

// LOGICA HISTORIAL DE DOCUMENTOS RESTAURADA
async function verHistorial(id, razonsocial) {
    document.getElementById("historial-titulo").textContent = `Documentos de: ${razonsocial}`;
    document.getElementById("seccion-historial").classList.remove("hidden");
    document.getElementById("historial-presupuestos").innerHTML = `<tr><td colspan="4" class="p-2 text-center text-slate-400">Sin datos</td></tr>`;
    document.getElementById("historial-facturas").innerHTML = `<tr><td colspan="4" class="p-2 text-center text-slate-400">Sin datos</td></tr>`;
}

comprobarSesion();