const API_URL = "http://127.0.0.1:8000";

let todasPresupuestos = [];
let presupuestoSeleccionado = null;
let conceptosPresupuesto = [];

// 🆕 NUEVO: Variables para controlar el orden de los presupuestos
let presupuestoCampoOrden = "fecha";      // Ordenación por defecto inicial
let presupuestoDireccionOrden = "desc";   // Dirección por defecto inicial (más recientes primero)

// Función de entrada que invoca el enrutador central de app.js
export async function inicializar(filtro) {
    document.getElementById("btn-volver-listado").onclick = () => mostrarOcultarVistasPresupuestos(true);
    document.getElementById("pdf-btn-add-concepto").onclick = agregarConceptoLinea;

    // Forzamos a que limpie cualquier onclick previo de app.js y asigne el correcto:
    const btnGuardar = document.getElementById("btn-guardar-cambios-presupuesto");
    if (btnGuardar) {
        btnGuardar.onclick = null;
        btnGuardar.onclick = enviarActualizacionServidorP;
    }

    const btnBorrar = document.getElementById("btn-borrar-presupuesto");
    if (btnBorrar) {
        btnBorrar.onclick = () => {
            if (!presupuestoSeleccionado) {
                alert("No hay ningún presupuesto seleccionado para eliminar.");
                return;
            }
            eliminarPresupuesto(presupuestoSeleccionado.id);
        };
    }

    // Asignar evento al botón "Pasar a Factura"
    const btnPasarFactura = document.getElementById("btn-pasarFactura");
    if (btnPasarFactura) {
        btnPasarFactura.onclick = convertirPresupuestoAFactura;
    }

    // CORRECCIÓN 1: ID corregido a 'btn-imprimirPresupuesto-pdf' para coincidir con presupuestos.html
    const btnPdf = document.getElementById("btn-imprimirPresupuesto-pdf");
    if (btnPdf) {
        btnPdf.onclick = () => {
            if (!presupuestoSeleccionado) {
                alert("No hay datos de presupuesto para imprimir.");
                return;
            }

            // 1. Calculamos los totales
            let baseImponible = 0;
            let filasConceptosHtml = "";

            conceptosPresupuesto.forEach((c, index) => {
                const cant = parseFloat(c.cantidad || 0);
                const pr = parseFloat(c.precio_unitario || c.preciounidad || c.precio || 0);
                const desc = parseFloat(c.descuento || 0);
                const subtotal = (cant * pr) * (1 - (desc / 100));
                baseImponible += subtotal;

                filasConceptosHtml += `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                        <td style="padding: 10px 5px; text-align: left; color: #334155;">${index + 1}</td>
                        <td style="padding: 10px 5px; text-align: left; font-weight: 500; color: #1e293b;">${c.descripcion}</td>
                        <td style="padding: 10px 5px; text-align: right; color: #334155;">${cant.toFixed(1)}</td>
                        <td style="padding: 10px 5px; text-align: right; color: #334155;">${pr.toFixed(2)} €</td>
                        <td style="padding: 10px 5px; text-align: right; color: #334155; ">${desc > 0 ? desc + '%' : '0%'}</td>
                        <td style="padding: 10px 5px; text-align: right; font-weight: 700; color: #0f172a;">${subtotal.toFixed(2)} €</td>
                    </tr>
                `;
            });

            const porcentajeIva = parseFloat(presupuestoSeleccionado.iva || 21);
            const totalIva = baseImponible * (porcentajeIva / 100);
            const totalPresupuesto = baseImponible + totalIva;

            const htmlPresupuestoClasica = `
                <div style="width: 690px; background: white; color: #000000; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 25px;">
                        <div style="font-size: 13px; line-height: 1.5; color: #1e293b; text-align: left;">
                            <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Talleres Moreno SCP</h3>
                            <p style="margin: 2px 0;">Polígono Industrial Metalúrgico, Nave 14</p>
                            <p style="margin: 2px 0;">Añora, Córdoba</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">CIF:</span> B12345678</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Teléfono:</span> +34 600 000 000</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Email:</span> info@tu-taller.com</p>
                        </div>
                        <div style="text-align: right;">
                            <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 1px;">Presupuesto</h1>
                            <p style="margin: 2px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Número: ${presupuestoSeleccionado.numero}</p>
                            <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #475569;">Fecha: ${presupuestoSeleccionado.fecha || '---'}</p>
                        </div>
                    </div>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 30px; font-size: 13px; line-height: 1.6; color: #334155; text-align: left;">
                        <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">Cliente:</h3>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Razón Social:</span> ${presupuestoSeleccionado.razonsocial || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">NIF/DNI:</span> ${presupuestoSeleccionado.NIF || presupuestoSeleccionado.cliente_nif || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Dirección:</span> ${[presupuestoSeleccionado.calle, presupuestoSeleccionado.cliente_numero, presupuestoSeleccionado.poblacion].filter(Boolean).join(" ") || '---'}</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background-color: #1e3a8a; color: white; font-size: 12px; text-transform: uppercase; font-weight: 700;">
                                <th style="padding: 10px 5px; text-align: left; width: 6%;">Item</th>
                                <th style="padding: 10px 5px; text-align: left; width: 50%;">Descripción</th>
                                <th style="padding: 10px 5px; text-align: right; width: 10%;">Cant.</th>
                                <th style="padding: 10px 5px; text-align: right; width: 14%;">Precio U.</th>
                                <th style="padding: 10px 5px; text-align: right; width: 10%;">Dto. %</th>
                                <th style="padding: 10px 5px; text-align: right; width: 10%;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasConceptosHtml}
                        </tbody>
                    </table>
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <div style="width: 40%; font-size: 13px; line-height: 1.8; color: #1e293b;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 4px 0;">
                                <span>Base Imponible:</span>
                                <span style="font-weight: 600; font-family: monospace;">${baseImponible.toFixed(2)} €</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 4px 0;">
                                <span>I.V.A. (${porcentajeIva}%):</span>
                                <span style="font-weight: 600; font-family: monospace;">${totalIva.toFixed(2)} €</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800; color: #0f172a;">
                                <span>TOTAL:</span>
                                <span style="font-family: monospace;">${totalPresupuesto.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const opciones = {
                margin: 15,
                filename: `Presupuesto_${presupuestoSeleccionado.numero}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opciones).from(htmlPresupuestoClasica).save().catch(err => {
                console.error("Error al exportar PDF:", err);
            });
        };
    }

    const clienteId = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;
    await cargarPresupuestosServidor(clienteId);

    if (filtro && (filtro.nombre || filtro.razonsocial)) {
        document.getElementById("titulo-modulo-presupuestos").textContent = `Presupuestos de: ${filtro.nombre || filtro.razonsocial}`;
    } else {
        document.getElementById("titulo-modulo-presupuestos").textContent = "Historial General de Presupuestos";
    }

    renderizarListadoTabla();

    // ---------------- LÓGICA DEL MODAL ----------------
    const btnNuevoPresupuesto = document.getElementById("btn-nuevo-presupuesto-cliente");
    const modal = document.getElementById("modal-nuevo-presupuesto");
    const btnCerrar = document.getElementById("btn-cerrar-modal");
    const btnCancelar = document.getElementById("btn-cancelar-presupuesto");
    const formPresupuesto = document.getElementById("form-nuevo-presupuesto");

    if (btnNuevoPresupuesto && modal) {

        const obtenerSiguienteNumeroPresupuesto = async (añoActual) => {
            try {
                const response = await fetch(`${API_URL}/facturacion/presupuestos/detallados`, {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
                });

                if (!response.ok) return `PREP-${añoActual}-1`;

                const presupuestos = await response.json();
                let maxNumero = 0;
                const prefijoBuscado = `PREP-${añoActual}-`;

                presupuestos.forEach(f => {
                    const numStr = f.numero || f.numeropresupuesto || "";
                    if (numStr.startsWith(prefijoBuscado)) {
                        const partes = numStr.split("-");
                        const secuencial = parseInt(partes[partes.length - 1], 10);
                        if (!isNaN(secuencial) && secuencial > maxNumero) {
                            maxNumero = secuencial;
                        }
                    }
                });

                return `PREP-${añoActual}-${maxNumero + 1}`;
            } catch (err) {
                console.error("Error al obtener el número correlativo:", err);
                return `PREP-${añoActual}-1`;
            }
        };

        // --- ABRIR MODAL Y PROPONER VALORES ---
        btnNuevoPresupuesto.onclick = async () => {
            const clienteIdFiltro = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;
            const contenedorSelectCliente = document.getElementById("contenedor-modal-cliente");
            const selectCliente = document.getElementById("modal-cliente-id");

            if (clienteIdFiltro) {
                if (contenedorSelectCliente) contenedorSelectCliente.classList.add("hidden");
            } else {
                if (contenedorSelectCliente) contenedorSelectCliente.classList.remove("hidden");

                if (selectCliente) {
                    selectCliente.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
                    selectCliente.required = true;

                    try {
                        const response = await fetch(`${API_URL}/clientes`, {
                            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
                        });

                        if (response.ok) {
                            const clientes = await response.json();
                            clientes.forEach(c => {
                                const nombre = c.razonsocial || c.nombre || "Sin nombre";
                                const nifStr = c.nif || c.NIF || "";
                                selectCliente.innerHTML += `<option value="${c.id}">${nombre} ${nifStr ? `(${nifStr})` : ''}</option>`;
                            });
                        }
                    } catch (err) {
                        console.error("Error al conectar con el endpoint de clientes:", err);
                    }
                }
            }

            // Proponer fecha actual en YYYY-MM-DD
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById("modal-fecha").value = hoy;

            // Obtener siguiente número
            const añoActual = new Date().getFullYear();
            document.getElementById("modal-num-presupuesto").value = "Cargando...";

            const numSugerido = await obtenerSiguienteNumeroPresupuesto(añoActual);
            document.getElementById("modal-num-presupuesto").value = numSugerido;

            // CORRECCIÓN 2: Aseguramos la apertura del modal al final del proceso
            modal.classList.remove("hidden");
        };

        // --- CERRAR MODAL ---
        const cerrarModal = () => {
            modal.classList.add("hidden");
            if (formPresupuesto) formPresupuesto.reset();
        };

        if (btnCerrar) btnCerrar.onclick = cerrarModal;
        if (btnCancelar) btnCancelar.onclick = cerrarModal;

        // --- ENVIAR FORMULARIO AL BACKEND ---
        if (formPresupuesto) {
            formPresupuesto.onsubmit = async (e) => {
                e.preventDefault();

                const clienteIdFiltro = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;
                const selectCliente = document.getElementById("modal-cliente-id");
                const clienteIdFinal = clienteIdFiltro || (selectCliente ? selectCliente.value : null);

                if (!clienteIdFinal) {
                    alert("Por favor, seleccione un cliente válido para emitir el presupuesto.");
                    return;
                }

                const numPresupuesto = document.getElementById("modal-num-presupuesto").value.trim();
                const fechaPresupuesto = document.getElementById("modal-fecha").value;
                const ivaPresupuesto = parseFloat(document.getElementById("modal-iva").value);

                if (!numPresupuesto) {
                    alert("Por favor, introduce un número de presupuesto válido.");
                    return;
                }

                const nuevaPresupuestoBody = {
                    numeropresupuesto: numPresupuesto,
                    fecha: fechaPresupuesto,
                    iva: ivaPresupuesto,
                    numerocliente: parseInt(clienteIdFinal),
                    aceptado: false,
                    conceptos: []
                };

                try {
                    const response = await fetch(`${API_URL}/facturacion/presupuestos`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
                        },
                        body: JSON.stringify(nuevaPresupuestoBody)
                    });

                    if (!response.ok) {
                        if (response.status === 401) {
                            throw new Error("Su sesión ha expirado o no está autorizado. Inicie sesión de nuevo.");
                        }
                        const errorDetail = await response.text();
                        throw new Error(`Error del servidor: ${errorDetail || response.statusText}`);
                    }

                    const presupuestoCreado = await response.json();
                    alert(`Presupuesto ${presupuestoCreado.numero || numPresupuesto} creado con éxito.`);

                    cerrarModal();

                    if (typeof inicializar === "function") {
                        await inicializar(filtro);
                    }

                } catch (error) {
                    console.error("Error al registrar el presupuesto:", error);
                    alert("No se pudo crear el presupuesto: " + error.message);
                }
            };
        }
    }

    window.alternarOrdenPresupuestos = alternarOrdenPresupuestos;
}

// 🌐 Carga las presupuestos reales directamente desde el API de FastAPI
async function cargarPresupuestosServidor(clienteId = null) {
    try {
        let url = `${API_URL}/facturacion/presupuestos/detallados`;

        // CORRECCIÓN: Cambiamos 'cliente_id' por 'numerocliente' para que FastAPI entienda el filtro
        if (clienteId) {
            url += `?numerocliente=${clienteId}`;
        }

        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (r.ok) {
            todasPresupuestos = await r.json();

            // FILTRO EXTRA DE SEGURIDAD EN FRONTEND:
            // Por si acaso el backend devuelve todas las presupuestos ignorando el query parameter,
            // nos aseguramos de filtrar en local usando el campo real 'numerocliente'
            if (clienteId) {
                todasPresupuestos = todasPresupuestos.filter(f => String(f.numerocliente) === String(clienteId));
            }
        } else {
            todasPresupuestos = [];
        }
    } catch (err) {
        console.error("Error cargando presupuestoz desde el servidor:", err);
        todasPresupuestos = [];
    }
}

// 🆕 NUEVO: Controla el clic del usuario en las cabeceras de la tabla
export function alternarOrdenPresupuestos(campo) {
    if (presupuestoCampoOrden === campo) {
        presupuestoDireccionOrden = presupuestoDireccionOrden === "asc" ? "desc" : "asc";
    } else {
        presupuestoCampoOrden = campo;
        presupuestoDireccionOrden = "asc"; // Al cambiar de columna, empezamos ordenando de manera ascendente
    }
    renderizarListadoTabla();
}

function renderizarListadoTabla() {
    const tbody = document.getElementById("tbody-presupuestos-lista");
    tbody.innerHTML = "";

    if (todasPresupuestos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No se registran presupuestos en este tramo.</td></tr>`;
        return;
    }

    // 🆕 NUEVO: Ordenar una copia del array antes de renderizar
    let copia = [...todasPresupuestos];
    copia.sort((a, b) => {
        let valA = a[presupuestoCampoOrden];
        let valB = b[presupuestoCampoOrden];

        // Normalizar en caso de nulos o indefinidos
        if (valA === undefined || valA === null) valA = "";
        if (valB === undefined || valB === null) valB = "";

        // Si ordenamos por fecha, hacemos una comparación de tipo fecha/tiempo
        if (presupuestoCampoOrden === "fecha" && valA && valB) {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            return presupuestoDireccionOrden === "asc" ? dateA - dateB : dateB - dateA;
        }

        // Si es una cadena de texto (ej: el número de presupuesto "FACT-2026-001")
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return presupuestoDireccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return presupuestoDireccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    // Pintar la tabla con la copia ya ordenada
    copia.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition border-b cursor-pointer";
        const total = f.total || f.total_presupuesto || 0;
        const clienteNombre = f.cliente_razonsocial || f.razonsocial || f.cliente_nombre || '---';

        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">#${f.numero}</td>
            <td class="p-3 text-xs">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-800">${clienteNombre}</td>
            <td class="p-3 text-xs">
                <span class="${f.aceptado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} px-2.5 py-1 rounded-full font-bold">
                    ${f.aceptado ? 'ACEPTADA' : 'PENDIENTE'}
                </span>
            </td>
            <td class="p-3 text-right font-mono font-bold text-slate-950">${parseFloat(total).toFixed(2)} €</td>
        `;

        tr.onclick = () => cargarDetallePresupuestoPDF(f.id);
        tbody.appendChild(tr);
    });
}

function mostrarOcultarVistasPresupuestos(mostrarLista) {
    if (mostrarLista) {
        document.getElementById("sub-vista-lista-presupuestos").classList.remove("hidden");
        document.getElementById("sub-vista-detalle-presupuestos").classList.add("hidden");
    } else {
        document.getElementById("sub-vista-lista-presupuestos").classList.add("hidden");
        document.getElementById("sub-vista-detalle-presupuestos").classList.remove("hidden");
    }
}

// 🌐 Trae los detalles completos y los conceptos reales de una presupuesto seleccionada
async function cargarDetallePresupuestoPDF(presupuestoId) {
    try {
        const r = await fetch(`${API_URL}/facturacion/presupuestos/${presupuestoId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (!r.ok) throw new Error("No se pudo obtener la presupuesto");

        presupuestoSeleccionado = await r.json();
        mostrarOcultarVistasPresupuestos(false);

        // Rellenamos datos del folio blanco de la presupuesto
        document.getElementById("pdf-numero-presupuesto").textContent = `Nº: ${presupuestoSeleccionado.numero}`;
        document.getElementById("pdf-fecha-presupuesto").textContent = `Fecha: ${presupuestoSeleccionado.fecha || '---'}`;
        document.getElementById("pdf-cliente-nombre").textContent = presupuestoSeleccionado.razonsocial || presupuestoSeleccionado.cliente_nombre || '---';
        document.getElementById("pdf-cliente-nif").textContent = `NIF: ${presupuestoSeleccionado.NIF || presupuestoSeleccionado.cliente_nif || '---'}`;

        const direccion = `${presupuestoSeleccionado.calle || ''} ${presupuestoSeleccionado.cliente_numero || ''}`.trim();
        document.getElementById("pdf-cliente-direccion").textContent = direccion || "No especificada";
        document.getElementById("check-presupuesto-aceptado").checked = presupuestoSeleccionado.aceptado;

        // Se cargan los conceptos asociados reales
        conceptosPresupuesto = presupuestoSeleccionado.conceptos || [];

        calcularYRenderizarConceptosPDF();
    } catch (err) {
        console.error("Error al cargar el detalle de la presupuesto:", err);
        alert("No se pudo descargar el desglose de la presupuesto.");
    }
}

function calcularYRenderizarConceptosPDF() {
    const tbody = document.getElementById("pdf-tbody-conceptos");
    tbody.innerHTML = "";

    let baseImponible = 0;

    conceptosPresupuesto.forEach((c, index) => {
        const cant = parseFloat(c.cantidad || 0);
        const pr = parseFloat(c.precio_unitario || c.preciounidad || c.precio || 0);
        const desc = parseFloat(c.descuento || 0);

        const subtotal = (cant * pr) * (1 - (desc / 100));
        baseImponible += subtotal;

        const tr = document.createElement("tr");
        tr.className = "border-b text-slate-700 text-xs";
        tr.innerHTML = `
            <td class="p-2.5 font-medium">${c.descripcion}</td>
            <td class="p-2.5 text-right font-mono">${cant}</td>
            <td class="p-2.5 text-right font-mono">${pr.toFixed(2)} €</td>
            <td class="p-2.5 text-right font-mono text-rose-600 font-semibold">${desc > 0 ? desc + ' %' : '0 %'}</td>
            <td class="p-2.5 text-right font-mono font-bold">${subtotal.toFixed(2)} €</td>
            <td class="columna-accion p-2.5 text-center">
                <button class="text-rose-600 font-bold hover:underline">Eliminar</button>
            </td>
        `;

        tr.querySelector("button").onclick = () => {
            conceptosPresupuesto.splice(index, 1);
            calcularYRenderizarConceptosPDF();
        };

        tbody.appendChild(tr);
    });

    const porcentajeIva = (presupuestoSeleccionado && presupuestoSeleccionado.iva !== undefined) ? parseFloat(presupuestoSeleccionado.iva) : 21;

    const etiquetaIvaUI = document.getElementById("presupuesto-iva-porcentaje");
    if (etiquetaIvaUI) {
        etiquetaIvaUI.textContent = `I.V.A. (${porcentajeIva}%):`;
    }

    const totalIva = baseImponible * (porcentajeIva / 100);
    const totalPresupuesto = baseImponible + totalIva;

    document.getElementById("pdf-calculo-base").textContent = `${baseImponible.toFixed(2)} €`;
    document.getElementById("pdf-calculo-iva").textContent = `${totalIva.toFixed(2)} €`;
    document.getElementById("pdf-calculo-total").textContent = `${totalPresupuesto.toFixed(2)} €`;
}

function agregarConceptoLinea() {
    const descInput = document.getElementById("pdf-nuevo-desc");
    const cantInput = document.getElementById("pdf-nuevo-cant");
    const precioInput = document.getElementById("pdf-nuevo-precio");
    const descInputForm = document.getElementById("pdf-nuevo-descuento");

    if (!descInput.value.trim() || !precioInput.value) {
        alert("Por favor, rellene la descripción y el precio del concepto.");
        return;
    }

    const descuentoValor = descInputForm ? parseFloat(descInputForm.value) || 0 : 0;

    conceptosPresupuesto.push({
        descripcion: descInput.value.trim(),
        cantidad: parseFloat(cantInput.value),
        precio_unitario: parseFloat(precioInput.value),
        descuento: descuentoValor
    });

    // Resetear inputs de la UI
    descInput.value = "";
    cantInput.value = "1";
    precioInput.value = "";
    if (descInputForm) descInputForm.value = "0";

    calcularYRenderizarConceptosPDF();
}

// 💾 Envía los datos actualizados de forma real al backend mediante un PUT request
async function enviarActualizacionServidorP() {
    if (!presupuestoSeleccionado) {
        alert("No hay ninguna presupuesto activa seleccionada.");
        return;
    }

    // Adaptamos el array de conceptos para enviar al backend con las propiedades correctas
    const conceptosProcesados = conceptosPresupuesto.map(c => ({
        descripcion: c.descripcion,
        cantidad: parseFloat(c.cantidad),
        precio_unitario: parseFloat(c.precio_unitario || c.preciounidad || c.precio),
        descuento: parseFloat(c.descuento || 0)
    }));

    const payload = {
        aceptado: document.getElementById("check-presupuesto-aceptado").checked,
        conceptos: conceptosProcesados
    };

    try {
        const url = `${API_URL}/facturacion/presupuestos/${presupuestoSeleccionado.id}`;
        const r = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
            },
            body: JSON.stringify(payload)
        });

        if (!r.ok) {
            const errorValidacion = await r.json();
            throw new Error(errorValidacion.detail?.[0]?.msg || "Fallo de actualización");
        }

        alert("¡Presupuesto, conceptos guardados con éxito en la base de datos!");
        mostrarOcultarVistasPresupuestos(true);
        await cargarPresupuestosServidor();
        renderizarListadoTabla();
    } catch (err) {
        console.error("Error al guardar la presupuesto en el servidor:", err);
        alert(`No se pudo actualizar la presupuesto en el servidor. Detalle: ${err.message}`);
    }
}

async function eliminarPresupuesto(presupuestoId, filaElemento = null) {
    const idNum = parseInt(presupuestoId, 10);
    if (isNaN(idNum)) {
        alert("ID de presupuesto no válido para eliminar.");
        return;
    }

    // 🛑 VALIDACIÓN: Verificar si el presupuesto ya está aceptado/facturado
    if (presupuestoSeleccionado.aceptado) {
        alert("Este presupuesto ya ha sido aceptado y convertido en factura previamente. No puede ser borrado");
        return;
    }

    const confirmar = confirm("¿Estás seguro de que deseas eliminar este presupuesto? Esta acción no se puede deshacer.");
    if (!confirmar) return;

    try {
        const response = await fetch(`${API_URL}/facturacion/presupuestos/${idNum}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok || response.status === 204) {
            alert("Presupuesto eliminado correctamente.");

            // Volver a la vista de lista si estábamos en el detalle
            mostrarOcultarVistasPresupuestos(true);

            // Recargar la tabla desde el servidor
            await cargarPresupuestosServidor();
            renderizarListadoTabla();
        } else {
            if (response.status === 401) {
                throw new Error("Sesión expirada. Por favor, inicia sesión de nuevo.");
            }
            const errorTxt = await response.text();
            throw new Error(errorTxt || "Error al eliminar la presupuesto.");
        }
    } catch (error) {
        console.error("Error al borrar presupuesto:", error);
        alert("No se pudo eliminar la presupuesto: " + error.message);
    }
}

async function convertirPresupuestoAFactura() {
    if (!presupuestoSeleccionado || !presupuestoSeleccionado.id) {
        alert("Por favor, selecciona un presupuesto antes de convertirlo a factura.");
        return;
    }

    // 🛑 VALIDACIÓN 1: Bloqueo si el presupuesto ya fue aceptado/facturado
    if (presupuestoSeleccionado.aceptado) {
        alert("Este presupuesto ya ha sido aceptado y convertido en factura previamente.");
        return;
    }

    try {
        const token = localStorage.getItem("token_taller");
        const añoActual = new Date().getFullYear();

        // 1. Obtener el siguiente número correlativo sugerido
        const responseFacturas = await fetch(`${API_URL}/facturacion/facturas/detalladas`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        let maxNumero = 0;
        const prefijoBuscado = `FACT-${añoActual}-`;

        if (responseFacturas.ok) {
            const facturas = await responseFacturas.json();
            facturas.forEach(f => {
                const numStr = f.numero || f.numerofactura || "";
                if (numStr.startsWith(prefijoBuscado)) {
                    const partes = numStr.split("-");
                    const secuencial = parseInt(partes[partes.length - 1], 10);
                    if (!isNaN(secuencial) && secuencial > maxNumero) {
                        maxNumero = secuencial;
                    }
                }
            });
        }

        const numeroSugerido = `${prefijoBuscado}${maxNumero + 1}`;

        // 2. Proponer el número al usuario y permitirle editarlo
        const numeroConfirmado = prompt(
            `Introduce el número para la nueva factura generada a partir del presupuesto "${presupuestoSeleccionado.numero}":`,
            numeroSugerido
        );

        // Si el usuario le da a "Cancelar" en el prompt, cancelamos la operación
        if (numeroConfirmado === null) return;

        const numeroFinal = numeroConfirmado.trim();
        if (!numeroFinal) {
            alert("El número de factura no puede estar vacío.");
            return;
        }

        // 3. Llamada a la API de conversión
        const urlEndpoint = `${API_URL}/facturacion/presupuestos/${presupuestoSeleccionado.id}/facturar?nuevo_numero_factura=${encodeURIComponent(numeroFinal)}`;

        const responseConversion = await fetch(urlEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!responseConversion.ok) {
            const errDetail = await responseConversion.text();
            throw new Error(errDetail || "Error en el servidor al generar la factura.");
        }

        // 4. Actualizar la variable local y la interfaz
        presupuestoSeleccionado.aceptado = true;
        actualizarEstadoBotonFacturar(true);

        alert(`¡Éxito! Presupuesto convertido a Factura con número: ${numeroFinal}`);

    } catch (error) {
        console.error("Error al transformar el presupuesto:", error);
        alert("Ocurrió un error al intentar facturar el presupuesto: " + error.message);
    }
}