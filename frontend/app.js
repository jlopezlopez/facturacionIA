const API_URL = "http://127.0.0.1:8000";

// ESTADOS GLOBALES DE LA APLICACIÓN
let globalClientes = [];
let globalFacturas = [];
let globalPresupuestos = [];

let clienteCampoOrden = "id";
let clienteDireccionOrden = "desc";

let facturaActiva = null;
let facturaConceptosActivos = [];

let presupuestoActivo = null;
let presupuestoConceptosActivos = [];

// =========================================================================
// ENRUTADOR CENTRAL DE INTERFAZ (Modificado para sincronía perfecta y modularidad)
// =========================================================================
async function navegarA(seccion, parametros = null) {
    ["clientes", "facturas", "presupuestos"].forEach(s => {
        const view = document.getElementById(`mod-view-${s}`);
        if (view) view.classList.add("hidden");
        const btn = document.getElementById(`nav-${s}`);
        if (btn) btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition";
    });

    const contenedorSeccion = document.getElementById(`mod-view-${seccion}`);
    if (contenedorSeccion) {
        contenedorSeccion.classList.remove("hidden");
    }

    const btnActivo = document.getElementById(`nav-${seccion}`);
    if (btnActivo) btnActivo.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-white transition";

    // Inicializaciones de datos reales
    if (seccion === "clientes") {
        inicializarModuloClientes();
    }

    if (seccion === "facturas") {
        // 🚀 CARGA DINÁMICA: Si el contenedor de facturas en index.html está vacío, inyecta facturas.html
        if (contenedorSeccion && contenedorSeccion.innerHTML.trim() === "") {
            try {
                const respuesta = await fetch('facturas/facturas.html');
                const html = await respuesta.text();
                contenedorSeccion.innerHTML = html;
            } catch (error) {
                console.error("Error al cargar la plantilla de facturas.html:", error);
                contenedorSeccion.innerHTML = "<p class='text-red-500 p-4'>Error al cargar el módulo de facturas.</p>";
                return;
            }
        }

        // Ejecutamos la inicialización cruzada mapeando los parámetros de clientes.js
        inicializarModuloFacturas(parametros);
    }

    if (seccion === "presupuestos") {
            // 🚀 CARGA DINÁMICA: Si el contenedor de presupuestos en index.html está vacío, inyecta presupuestos.html
        if (contenedorSeccion && contenedorSeccion.innerHTML.trim() === "") {
            try {
                const respuesta = await fetch('presupuestos/presupuestos.html');
                const html = await respuesta.text();
                contenedorSeccion.innerHTML = html;
            } catch (error) {
                console.error("Error al cargar la plantilla de presupuestos.html:", error);
                contenedorSeccion.innerHTML = "<p class='text-red-500 p-4'>Error al cargar el módulo de presupuestos.</p>";
                return;
            }
        }
        inicializarModuloPresupuestos(parametros);
    }
}

// ==========================================
// MÓDULO A: GESTIÓN DE CLIENTES
// ==========================================
async function inicializarModuloClientes() {
    document.getElementById("th-id").onclick = () => alternarOrdenClientes("id");
    document.getElementById("th-razon").onclick = () => alternarOrdenClientes("razonsocial");
    document.getElementById("th-nif").onclick = () => alternarOrdenClientes("NIF");
    document.getElementById("btn-nuevo-cliente").onclick = () => abrirModalAltaCliente();
    document.getElementById("form-cliente").onsubmit = (e) => guardarFichaClienteServidor(e);

    await cargarClientesDeBD();
}

async function cargarClientesDeBD() {
    try {
        const r = await fetch(`${API_URL}/clientes/`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });
        globalClientes = await r.json();
        renderizarTablaClientes();
    } catch (err) { console.error("Error cargando fichas de clientes", err); }
}

function alternarOrdenClientes(campo) {
    if (clienteCampoOrden === campo) {
        clienteDireccionOrden = clienteDireccionOrden === "asc" ? "desc" : "asc";
    } else {
        clienteCampoOrden = campo;
        clienteDireccionOrden = "asc";
    }
    renderizarTablaClientes();
}

function renderizarTablaClientes() {
    let copia = [...globalClientes];
    copia.sort((a, b) => {
        let valA = a[clienteCampoOrden];
        let valB = b[clienteCampoOrden];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return clienteDireccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return clienteDireccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    const tbody = document.getElementById("tbody-clientes");
    tbody.innerHTML = "";

    copia.forEach(c => {
        const dir = `${c.calle || ''} ${c.numero || ''} ${c.piso || ''} (${c.poblacion || ''}) (${c.cp || c.CP || ''})`.trim() || "---";
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-slate-50 text-xs";
        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-950">#${c.id}</td>
            <td class="p-3 font-semibold text-sm text-slate-900">${c.razonsocial}</td>
            <td class="p-3 font-mono">${c.nif || c.NIF || '---'}</td>
            <td class="p-3">${c.telefono || '---'}</td>
            <td class="p-3 text-slate-700">${dir}</td>
            <td class="p-3 italic text-slate-400 max-w-xs truncate">${c.observaciones || '---'}</td>
            <td class="p-3 text-center space-x-1 bg-slate-50/50 whitespace-nowrap">
                <button class="btn-goto-pres bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded">📋 Presupuestos</button>
                <button class="btn-goto-fac bg-blue-900 hover:bg-blue-950 text-white font-bold px-2 py-1 rounded">💵 Facturas</button>
            </td>
            <td class="p-3 text-center whitespace-nowrap">
                <button class="btn-edit bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded">✏️ Editar</button>
                <button class="btn-borrar bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded"> 🗑️ Borrar</button>
            </td>
        `;

        tr.querySelector(".btn-goto-pres").onclick = () => navegarA("presupuestos", { cliente_id: c.id, razonsocial: c.razonsocial });
        tr.querySelector(".btn-goto-fac").onclick = () => navegarA("facturas", { cliente_id: c.id, razonsocial: c.razonsocial });
        tr.querySelector(".btn-edit").onclick = () => abrirModalModificarCliente(c);
        tr.querySelector(".btn-borrar").onclick = () => {
            eliminarCliente(c.id, tr);
        };
        tbody.appendChild(tr);
    });
}

function abrirModalAltaCliente() {
    document.getElementById("modal-cliente-titulo").textContent = "➕ Alta de Nuevo Cliente";
    document.getElementById("cliente-id-input").value = "";
    document.getElementById("form-cliente").reset();
    document.getElementById("modal-cliente").classList.remove("hidden");
}

function abrirModalModificarCliente(c) {
    document.getElementById("modal-cliente-titulo").textContent = "✏️ Modificar Ficha de Cliente";
    document.getElementById("cliente-id-input").value = c.id;
    document.getElementById("c-razonsocial").value = c.razonsocial || "";
    document.getElementById("c-nif").value = c.nif || c.NIF || "";
    document.getElementById("c-telefono").value = c.telefono || "";
    document.getElementById("c-calle").value = c.calle || "";
    document.getElementById("c-numero").value = c.numero || "";
    document.getElementById("c-piso").value = c.piso || "";
    document.getElementById("c-poblacion").value = c.poblacion || "";
    document.getElementById("c-provincia").value = c.provincia || "";
    document.getElementById("c-cp").value = c.cp || c.CP || "";
    document.getElementById("c-observaciones").value = c.observaciones || "";
    document.getElementById("modal-cliente").classList.remove("hidden");
}

async function guardarFichaClienteServidor(e) {
    e.preventDefault();

    const id = document.getElementById("cliente-id-input").value;
    const rawCp = document.getElementById("c-cp").value.trim();

    const datos = {
        NIF: document.getElementById("c-nif").value.trim(),
        razonsocial: document.getElementById("c-razonsocial").value.trim(),
        calle: document.getElementById("c-calle").value.trim() || null,
        numero: document.getElementById("c-numero").value.trim() || null,
        piso: document.getElementById("c-piso").value.trim() || null,
        poblacion: document.getElementById("c-poblacion").value.trim() || null,
        provincia: document.getElementById("c-provincia").value.trim() || null,
        CP: rawCp !== "" ? parseInt(rawCp, 10) : null,
        telefono: document.getElementById("c-telefono").value.trim() || null,
        observaciones: document.getElementById("c-observaciones").value.trim() || null
    };

    const url = id ? `${API_URL}/clientes/${id}` : `${API_URL}/clientes/`;
    const method = id ? "PUT" : "POST";

    try {
        const r = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
            },
            body: JSON.stringify(datos)
        });

        if (!r.ok) {
            const errorValidacion = await r.json();
            console.error("Fallo de validación detectado por FastAPI:", errorValidacion);
            alert(`El servidor rechazó los datos: ${errorValidacion.detail?.[0]?.msg || 'Error de formato'}`);
            return;
        }

        document.getElementById("modal-cliente").classList.add("hidden");
        await cargarClientesDeBD();
        alert("¡Operación realizada con éxito en la base de datos!");

    } catch (err) {
        console.error("Error de red o conexión:", err);
        alert("No se pudo conectar con el servidor. Revisa la consola.");
    }
}

// Función para eliminar un cliente mediante la API
async function eliminarCliente(clienteId, filaElemento = null) {
    // 1. Confirmación de seguridad
    const confirmar = confirm("¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.");
    if (!confirmar) return;

    try {
        // 2. Llamada a la API (DELETE /clientes/{cliente_id})
        const response = await fetch(`${API_URL}/clientes/${clienteId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`,
                "Content-Type": "application/json"
            }
        });

        // 3. Gestión de la respuesta
        if (response.ok) {
            alert("Cliente eliminado correctamente.");

            // Opción A: Si pasaste la fila de la tabla por parámetro, la borramos del DOM visualmente
            if (filaElemento) {
                filaElemento.remove();
            } else {
                // Opción B: Recargar el listado por completo
                if (typeof inicializarClientes === "function") {
                    inicializarClientes();
                }
            }
        } else {
            if (response.status === 401) {
                throw new Error("Sesión expirada. Por favor, vuelve a iniciar sesión.");
            }
            const errorTxt = await response.text();
            throw new Error(errorTxt || "Error al intentar eliminar el cliente.");
        }

    } catch (error) {
        console.error("Error al borrar cliente:", error);
        alert("Hubo un problema: " + error.message);
    }
}


// ==========================================
// MÓDULO B: FACTURAS Y FOLIO DIGITAL (PDF)
// ==========================================
async function inicializarModuloFacturas(filtro = null) {
    // 1. Normalización del filtro para que sea compatible con app.js, clientes.js y facturas.js
    const datosFiltro = filtro ? {
        cliente_id: filtro.cliente_id || filtro.id || filtro.filtrarClienteId,
        razonsocial: filtro.razonsocial || filtro.nombre
    } : null;

    // 2. Cargamos el JavaScript modular externo (facturas.js) para delegar el control
    try {
        const moduloFacturas = await import("./facturas/facturas.js");

        // 3. Forzamos a que se muestre el listado inicializando las sub-vistas
        const subVistaLista = document.getElementById("sub-vista-lista");
        const subVistaDetalle = document.getElementById("sub-vista-detalle");
        if (subVistaLista) subVistaLista.classList.remove("hidden");
        if (subVistaDetalle) subVistaDetalle.classList.add("hidden");

        // 4. Dejar que facturas.js maneje la llamada al backend con el filtro unificado
        await moduloFacturas.inicializar(datosFiltro);

    } catch (error) {
        console.warn("No se pudo iniciar de forma modular externa, aplicando fallback nativo:", error);

        // FALLBACK NATIVO (Por seguridad, si el import falla)
        document.getElementById("pdf-btn-add-concepto").onclick = () => agregarConceptoLineaFactura();
        document.getElementById("btn-guardar-cambios-factura").onclick = () => guardarFacturaEnServidor();

        const btnVolver = document.getElementById("btn-volver-listado");
        if (btnVolver) btnVolver.onclick = () => cerrarDetalleFactura();

        document.getElementById("sub-vista-detalle").classList.add("hidden");
        document.getElementById("sub-vista-lista").classList.remove("hidden");

        const clienteId = datosFiltro ? datosFiltro.cliente_id : null;
        await cargarFacturasDeBD(clienteId);

        if (datosFiltro && clienteId) {
            document.getElementById("titulo-modulo-facturas").textContent = `Facturas de: ${datosFiltro.razonsocial || 'Cliente'}`;
            globalFacturas = globalFacturas.filter(f => {
                const fClienteId = f.cliente_id || f.CLIENTE_ID || f.id_cliente;
                return String(fClienteId) === String(clienteId);
            });
        } else {
            document.getElementById("titulo-modulo-facturas").textContent = "Historial General de Facturas";
        }

        renderizarTablaFacturas();
    }
}

async function cargarFacturasDeBD(clienteId = null) {
    try {
        let url = `${API_URL}/facturacion/facturas/detallados`;

        // Si el backend soporta filtrar directamente en la URL, lo dejamos.
        // Si no, no pasa nada, porque luego filtraremos en el frontend.
        if (clienteId) {
            url += `?numerocliente=${clienteId}`;
        }

        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        // Guardamos las facturas en la variable global
        globalFacturas = r.ok ? await r.json() : [];
    } catch (err) {
        console.error("Error en fetch de facturas:", err);
        globalFacturas = [];
    }
}

// (El resto del código se mantiene exactamente idéntico al tuyo sin modificaciones adicionales)
function renderizarTablaFacturas() {
    const tbody = document.getElementById("tbody-facturas-lista");
    tbody.innerHTML = "";

    if (globalFacturas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">No se registran facturas en este tramo.</td></tr>`;
        return;
    }

    globalFacturas.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-blue-50/50 text-xs text-slate-700 transition";
        const total = f.total || f.total_factura || 0;
        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">${f.numero}</td>
            <td class="p-3">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-900">${f.cliente_razonsocial || f.razonsocial || '---'}</td>
            <td class="p-3 font-mono">${f.cliente_nif || f.nif || '---'}</td>
            <td class="p-3">${f.cliente_telefono || f.telefono || '---'}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${f.pagada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${f.pagada ? 'COBRADA' : 'PENDIENTE'}</span></td>
            <td class="p-3 text-right font-mono font-bold text-sm text-slate-950">${parseFloat(total).toFixed(2)} €</td>
        `;
        tr.onclick = () => abrirFolioFacturaReal(f.id);
        tbody.appendChild(tr);
    });
}

async function abrirFolioFacturaReal(id) {
    try {
        const url = `${API_URL}/facturacion/facturas/${id}`;
        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (!r.ok) throw new Error();
        facturaActiva = await r.json();

        // ✨ Cambiados a los IDs reales de tu HTML
        document.getElementById("sub-vista-lista").classList.add("hidden");
        document.getElementById("sub-vista-detalle").classList.remove("hidden");

        document.getElementById("pdf-numero-factura").textContent = `Nº: ${facturaActiva.numero}`;
        document.getElementById("pdf-fecha-factura").textContent = `Fecha: ${facturaActiva.fecha || '---'}`;
        document.getElementById("pdf-cliente-nombre").textContent = facturaActiva.razonsocial || '---';
        document.getElementById("pdf-cliente-nif").textContent = `NIF: ${facturaActiva.NIF || '---'}`;
        document.getElementById("pdf-cliente-direccion").textContent = `${facturaActiva.calle || ''} ${facturaActiva.cliente_numero || ''}`.trim() || "Dirección Fiscal";
        document.getElementById("check-factura-pagada").checked = facturaActiva.pagada;

        facturaConceptosActivos = facturaActiva.conceptos || [];
        calcularYRenderizarConceptosFactura();
    } catch {
        alert("No se pudo descargar el desglose de la factura.");
    }
}

function calcularYRenderizarConceptosFactura() {
    const tbody = document.getElementById("pdf-tbody-conceptos");
    tbody.innerHTML = "";
    let base = 0;

    facturaConceptosActivos.forEach((c, index) => {
        const cant = parseFloat(c.cantidad || 0);
        const pr = parseFloat(c.precio_unitario || c.preciounidad || c.precio || 0);
        const desc = parseFloat(c.descuento || 0);

        const sub = (cant * pr) * (1 - (desc / 100));
        base += sub;

        const etiquetaDescuento = desc > 0 ? ` <span class="text-rose-600 text-[10px] font-bold">(-${desc}%)</span>` : '';

        const tr = document.createElement("tr");
        tr.className = "border-b text-xs";
        tr.innerHTML = `
            <td class="p-2 text-slate-800 font-medium">${c.descripcion}${etiquetaDescuento}</td>
            <td class="p-2 text-right font-mono">${cant}</td>
            <td class="p-2 text-right font-mono">${pr.toFixed(2)} €</td>
            <td class="p-2 text-right font-mono font-bold">${sub.toFixed(2)} €</td>
            <td class="p-2 text-center"><button class="text-rose-600 font-bold hover:underline">Eliminar</button></td>
        `;

        tr.querySelector("button").onclick = () => {
            facturaConceptosActivos.splice(index, 1);
            calcularYRenderizarConceptosFactura();
        };
        tbody.appendChild(tr);
    });

    const porcentajeIva = (facturaActiva && facturaActiva.iva !== undefined) ? parseFloat(facturaActiva.iva) : 21;

    const etiquetaIvaUI = document.getElementById("factura-iva-porcentaje");
    if (etiquetaIvaUI) {
        etiquetaIvaUI.textContent = `I.V.A. (${porcentajeIva}%):`;
    }

    const iva = base * (porcentajeIva / 100);
    const tot = base + iva;

    document.getElementById("pdf-calculo-base").textContent = `${base.toFixed(2)} €`;
    document.getElementById("pdf-calculo-iva").textContent = `${iva.toFixed(2)} €`;
    document.getElementById("pdf-calculo-total").textContent = `${tot.toFixed(2)} €`;
}

function agregarConceptoLineaFactura() {
    const d = document.getElementById("pdf-nuevo-desc").value.trim();
    const c = parseFloat(document.getElementById("pdf-nuevo-cant").value);
    const p = parseFloat(document.getElementById("pdf-nuevo-precio").value);

    const inputDesc = document.getElementById("pdf-nuevo-descuento");
    const desc = inputDesc ? parseFloat(inputDesc.value) || 0 : 0;

    if (!d || isNaN(p)) return;

    facturaConceptosActivos.push({
        descripcion: d,
        cantidad: c,
        precio_unitario: p,
        descuento: desc
    });

    document.getElementById("pdf-nuevo-desc").value = "";
    document.getElementById("pdf-nuevo-cant").value = "1";
    document.getElementById("pdf-nuevo-precio").value = "";
    if (inputDesc) inputDesc.value = "0";

    calcularYRenderizarConceptosFactura();
}

async function guardarFacturaEnServidor() {
    const payload = {
        pagada: document.getElementById("check-factura-pagada").checked,
        conceptos: facturaConceptosActivos
    };
    try {
        await fetch(`${API_URL}/facturacion/facturas/${facturaActiva.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token_taller")}` },
            body: JSON.stringify(payload)
        });
        alert("Factura guardada con éxito.");
        cerrarDetalleFactura();
    } catch { alert("Error al actualizar la factura."); }
}

function cerrarDetalleFactura() {
    // ✨ Cambiados a los IDs reales de tu HTML
    document.getElementById("sub-vista-detalle").classList.add("hidden");
    document.getElementById("sub-vista-lista").classList.remove("hidden");
    inicializarModuloFacturas();
}

// ==========================================
// MÓDULO C: PRESUPUESTOS Y MEDICIONES
// ==========================================

async function inicializarModuloPresupuestos(filtro = null) {
    // 1. Normalización del filtro para que sea compatible con app.js, clientes.js y presupuestos.js
    const datosFiltro = filtro ? {
        cliente_id: filtro.cliente_id || filtro.id || filtro.filtrarClienteId,
        razonsocial: filtro.razonsocial || filtro.nombre
    } : null;

    // 2. Cargamos el JavaScript modular externo (presupuestos.js) para delegar el control
    try {
        const moduloPresupuestos = await import("./presupuestos/presupuestos.js");

        // 3. Forzamos a que se muestre el listado inicializando las sub-vistas
        const subVistaLista = document.getElementById("sub-vista-lista");
        const subVistaDetalle = document.getElementById("sub-vista-detalle");
        if (subVistaLista) subVistaLista.classList.remove("hidden");
        if (subVistaDetalle) subVistaDetalle.classList.add("hidden");

        // 4. Dejar que presupuestos.js maneje la llamada al backend con el filtro unificado
        await moduloPresupuestos.inicializar(datosFiltro);

    } catch (error) {
        console.warn("No se pudo iniciar de forma modular externa, aplicando fallback nativo:", error);

        // FALLBACK NATIVO (Por seguridad, si el import falla)
        document.getElementById("pdf-btn-add-concepto").onclick = () => agregarConceptoLineaPresupuesto();
        document.getElementById("btn-guardar-cambios-presupuesto").onclick = () => guardarPresupuestoEnServidor();

        const btnVolver = document.getElementById("btn-volver-listado");
        if (btnVolver) btnVolver.onclick = () => cerrarDetallePresupuesto();

        document.getElementById("sub-vista-detalle").classList.add("hidden");
        document.getElementById("sub-vista-lista").classList.remove("hidden");

        const clienteId = datosFiltro ? datosFiltro.cliente_id : null;
        await cargarPresupuestosDeBD(clienteId);

        if (datosFiltro && clienteId) {
            document.getElementById("titulo-modulo-presupuestos").textContent = `Presupuestos de: ${datosFiltro.razonsocial || 'Cliente'}`;
            globalPresupuestos = globalPresupuestos.filter(f => {
                const fClienteId = f.cliente_id || f.CLIENTE_ID || f.id_cliente;
                return String(fClienteId) === String(clienteId);
            });
        } else {
            document.getElementById("titulo-modulo-presupuestos").textContent = "Historial General de Presupuestos";
        }

        renderizarTablaPresupuestos();
    }
}

async function cargarPresupuestosDeBD(clienteId = null) {
    try {
        let url = `${API_URL}/facturacion/presupuestos/detallados`;

        // Si el backend soporta filtrar directamente en la URL, lo dejamos.
        // Si no, no pasa nada, porque luego filtraremos en el frontend.
        if (clienteId) {
            url += `?numerocliente=${clienteId}`;
        }

        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        // Guardamos los presupuestos en la variable global
        globalPresupuestos = r.ok ? await r.json() : [];
    } catch (err) {
        console.error("Error en fetch de presupuestos:", err);
        globalPresupuestos = [];
    }
}

// (El resto del código se mantiene exactamente idéntico al tuyo sin modificaciones adicionales)
function renderizarTablaPresupuestos() {
    const tbody = document.getElementById("tbody-presupuestos-lista");
    tbody.innerHTML = "";

    if (globalPresupuestos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">No se registran presupuestos en este tramo.</td></tr>`;
        return;
    }

    globalPresupuestos.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-blue-50/50 text-xs text-slate-700 transition";
        const total = f.total || f.total_presupuesto || 0;
        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">${f.numero}</td>
            <td class="p-3">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-900">${f.cliente_razonsocial || f.razonsocial || '---'}</td>
            <td class="p-3 font-mono">${f.cliente_nif || f.nif || '---'}</td>
            <td class="p-3">${f.cliente_telefono || f.telefono || '---'}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${f.aceptado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${f.aceptado ? 'ACEPTADO' : 'PENDIENTE'}</span></td>
            <td class="p-3 text-right font-mono font-bold text-sm text-slate-950">${parseFloat(total).toFixed(2)} €</td>
        `;
        tr.onclick = () => abrirFolioPresupuestoReal(f.id);
        tbody.appendChild(tr);
    });
}

async function abrirFolioPresupuestoReal(id) {
    try {
        const url = `${API_URL}/facturacion/presupuestos/${id}`;
        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (!r.ok) throw new Error();
        presupuestoActivo = await r.json();

        // ✨ Cambiados a los IDs reales de tu HTML
        document.getElementById("sub-vista-lista").classList.add("hidden");
        document.getElementById("sub-vista-detalle").classList.remove("hidden");

        document.getElementById("pdf-numero-presupuesto").textContent = `Nº: ${presupuestoActivo.numero}`;
        document.getElementById("pdf-fecha-presupuesto").textContent = `Fecha: ${presupuestoActivo.fecha || '---'}`;
        document.getElementById("pdf-cliente-nombre").textContent = presupuestoActivo.razonsocial || '---';
        document.getElementById("pdf-cliente-nif").textContent = `NIF: ${presupuestoActivo.NIF || '---'}`;
        document.getElementById("pdf-cliente-direccion").textContent = `${presupuestoActivo.calle || ''} ${presupuestoActivo.cliente_numero || ''}`.trim() || "Dirección Fiscal";
        document.getElementById("check-presupuesto-pasado").checked = presupuestoActivo.pasado;

        presupuestoConceptosActivos = presupuestoActiva.conceptos || [];
        calcularYRenderizarConceptosPresupuesto();
    } catch {
        alert("No se pudo descargar el desglose del presupuesto.");
    }
}

function calcularYRenderizarConceptosPresupuesto() {
    const tbody = document.getElementById("pdf-tbody-conceptos");
    tbody.innerHTML = "";
    let base = 0;

    presupuestoConceptosActivos.forEach((c, index) => {
        const cant = parseFloat(c.cantidad || 0);
        const pr = parseFloat(c.precio_unitario || c.preciounidad || c.precio || 0);
        const desc = parseFloat(c.descuento || 0);

        const sub = (cant * pr) * (1 - (desc / 100));
        base += sub;

        const etiquetaDescuento = desc > 0 ? ` <span class="text-rose-600 text-[10px] font-bold">(-${desc}%)</span>` : '';

        const tr = document.createElement("tr");
        tr.className = "border-b text-xs";
        tr.innerHTML = `
            <td class="p-2 text-slate-800 font-medium">${c.descripcion}${etiquetaDescuento}</td>
            <td class="p-2 text-right font-mono">${cant}</td>
            <td class="p-2 text-right font-mono">${pr.toFixed(2)} €</td>
            <td class="p-2 text-right font-mono font-bold">${sub.toFixed(2)} €</td>
            <td class="p-2 text-center"><button class="text-rose-600 font-bold hover:underline">Eliminar</button></td>
        `;

        tr.querySelector("button").onclick = () => {
            presupuestoConceptosActivos.splice(index, 1);
            calcularYRenderizarConceptosPresupuesto();
        };
        tbody.appendChild(tr);
    });

    const porcentajeIva = (presupuestoActivo && presupuestoActivo.iva !== undefined) ? parseFloat(presupuestoActivo.iva) : 21;

    const etiquetaIvaUI = document.getElementById("presupuesto-iva-porcentaje");
    if (etiquetaIvaUI) {
        etiquetaIvaUI.textContent = `I.V.A. (${porcentajeIva}%):`;
    }

    const iva = base * (porcentajeIva / 100);
    const tot = base + iva;

    document.getElementById("pdf-calculo-base").textContent = `${base.toFixed(2)} €`;
    document.getElementById("pdf-calculo-iva").textContent = `${iva.toFixed(2)} €`;
    document.getElementById("pdf-calculo-total").textContent = `${tot.toFixed(2)} €`;
}

function agregarConceptoLineaPresupuesto() {
    const d = document.getElementById("pdf-nuevo-desc").value.trim();
    const c = parseFloat(document.getElementById("pdf-nuevo-cant").value);
    const p = parseFloat(document.getElementById("pdf-nuevo-precio").value);

    const inputDesc = document.getElementById("pdf-nuevo-descuento");
    const desc = inputDesc ? parseFloat(inputDesc.value) || 0 : 0;

    if (!d || isNaN(p)) return;

    presupuestoConceptosActivos.push({
        descripcion: d,
        cantidad: c,
        precio_unitario: p,
        descuento: desc
    });

    document.getElementById("pdf-nuevo-desc").value = "";
    document.getElementById("pdf-nuevo-cant").value = "1";
    document.getElementById("pdf-nuevo-precio").value = "";
    if (inputDesc) inputDesc.value = "0";

    calcularYRenderizarConceptosPresupuesto();
}

async function guardarPresupuestoEnServidor() {
    const payload = {
        pasado: document.getElementById("check-presupuesto-pasado").checked,
        conceptos: presupuestoConceptosActivos
    };
    try {
        await fetch(`${API_URL}/facturacion/presupuestos/${presupuestoActivo.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token_taller")}` },
            body: JSON.stringify(payload)
        });
        alert("Presupuesto guardado con éxito.");
        cerrarDetallePresupuesto();
    } catch { alert("Error al actualizar el presupuesto."); }
}

function cerrarDetallePresupuesto() {
    // ✨ Cambiados a los IDs reales de tu HTML
    document.getElementById("sub-vista-detalle").classList.add("hidden");
    document.getElementById("sub-vista-lista").classList.remove("hidden");
    inicializarModuloPresupuestos();
}


// ==========================================
// SESIÓN DE ACCESO GENERAL
// ==========================================
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
    } catch { alert("Credenciales incorrectas."); }
});

document.getElementById("btn-logout").addEventListener("click", () => { localStorage.clear(); comprobarSesion(); });

function comprobarSesion() {
    const token = localStorage.getItem("token_taller");
    if (token) {
        document.getElementById("vista-login").classList.add("hidden");
        document.getElementById("vista-dashboard").classList.remove("hidden");
        document.getElementById("usuario-sesion").textContent = localStorage.getItem("usuario_nombre");
        navegarA("clientes");
    } else {
        document.getElementById("vista-dashboard").classList.add("hidden");
        document.getElementById("vista-login").classList.remove("hidden");
    }
}

comprobarSesion();