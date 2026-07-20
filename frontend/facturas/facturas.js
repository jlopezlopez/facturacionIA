const API_URL = "http://127.0.0.1:8000";

let todasFacturas = [];
let facturaSeleccionada = null;
let conceptosFactura = [];

// 🆕 NUEVO: Variables para controlar el orden de las facturas
let facturaCampoOrden = "fecha";      // Ordenación por defecto inicial
let facturaDireccionOrden = "desc";   // Dirección por defecto inicial (más recientes primero)

// Función de entrada que invoca el enrutador central de app.js
export async function inicializar(filtro) {
    document.getElementById("btn-volver-listado").onclick = () => mostrarOcultarVistas(true);
    document.getElementById("pdf-btn-add-concepto").onclick = agregarConceptoLinea;

    // Forzamos a que limpie cualquier onclick previo de app.js y asigne el correcto:
    const btnGuardar = document.getElementById("btn-guardar-cambios-factura");
    if (btnGuardar) {
        btnGuardar.onclick = null; // Eliminamos la referencia a app.js
        btnGuardar.onclick = enviarActualizacionServidor; // Asignamos la función real de facturas.js
    }

    const btnPdf = document.getElementById("btn-imprimir-pdf");
    if (btnPdf) {
        btnPdf.onclick = () => {
            if (!facturaSeleccionada) {
                alert("No hay datos de factura para imprimir.");
                return;
            }

            // 1. Calculamos los totales
            let baseImponible = 0;
            let filasConceptosHtml = "";

            conceptosFactura.forEach((c, index) => {
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

            const porcentajeIva = parseFloat(facturaSeleccionada.iva || 21);
            const totalIva = baseImponible * (porcentajeIva / 100);
            const totalFactura = baseImponible + totalIva;

            // 2. Creamos la estructura HTML en una variable de texto (sin meterla en el documento)
            const htmlFacturaClasica = `
                <div style="width: 690px; background: white; color: #000000; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
                    <!-- Cabecera de la factura -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 25px;">
                        <!-- Bloque izquierdo: Tus Datos -->
                        <div style="font-size: 13px; line-height: 1.5; color: #1e293b; text-align: left;">
                            <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Talleres Moreno SCP</h3>
                            <p style="margin: 2px 0;">Polígono Industrial Metalúrgico, Nave 14</p>
                            <p style="margin: 2px 0;">Añora, Córdoba</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">CIF:</span> B12345678</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Teléfono:</span> +34 600 000 000</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Email:</span> info@tu-taller.com</p>
                        </div>

                        <!-- Bloque derecho: Título y Números -->
                        <div style="text-align: right;">
                            <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 1px;">Factura</h1>
                            <p style="margin: 2px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Número: ${facturaSeleccionada.numero}</p>
                            <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #475569;">Fecha: ${facturaSeleccionada.fecha || '---'}</p>
                        </div>
                    </div>

                    <!-- Datos del Cliente -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 30px; font-size: 13px; line-height: 1.6; color: #334155; text-align: left;">
                        <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">Cliente:</h3>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Razón Social:</span> ${facturaSeleccionada.razonsocial || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">NIF/DNI:</span> ${facturaSeleccionada.NIF || facturaSeleccionada.cliente_nif || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Dirección:</span> ${[facturaSeleccionada.calle, facturaSeleccionada.cliente_numero, facturaSeleccionada.poblacion].filter(Boolean).join(" ") || '---'}</p>
                    </div>

                    <!-- Tabla de Conceptos (Estilo Clásico) -->
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

                    <!-- Bloque de Totales -->
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
                                <span style="font-family: monospace;">${totalFactura.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 3. Configuración del PDF
            const opciones = {
                margin: 15,
                filename: `Factura_${facturaSeleccionada.numero}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // 4. Generamos el PDF pasándole directamente la cadena HTML de la factura clásica
            html2pdf()
                .set(opciones)
                .from(htmlFacturaClasica)
                .save()
                .catch(err => {
                    console.error("Error al exportar PDF:", err);
                });
        };
    }

    const clienteId = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;

    await cargarFacturasServidor(clienteId);

    if (filtro && (filtro.nombre || filtro.razonsocial)) {
        document.getElementById("titulo-modulo-facturas").textContent = `Facturas de: ${filtro.nombre || filtro.razonsocial}`;
    } else {
        document.getElementById("titulo-modulo-facturas").textContent = "Historial General de Facturas";
    }

    renderizarListadoTabla();

    // En facturas.js (dentro de tu función de inicialización) 
    // Dar de alta una nueva factura para el cliente.

 // En facturas.js (dentro de tu función de inicialización) 
    // Dar de alta una nueva factura (vía cliente o vía listado general)

    const btnNuevaFactura = document.getElementById("btn-nueva-factura-cliente");
    const modal = document.getElementById("modal-nueva-factura");
    const btnCerrar = document.getElementById("btn-cerrar-modal");
    const btnCancelar = document.getElementById("btn-cancelar-factura");
    const formFactura = document.getElementById("form-nueva-factura");

    if (btnNuevaFactura && modal) {
        // --- 1. ABRIR MODAL Y PROPONER VALORES ---
        btnNuevaFactura.onclick = async () => {
            // Evaluamos de forma segura si disponemos de un ID de cliente previo
            const clienteId = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null; 
            
            // Buscamos un contenedor para el select de clientes en tu modal (si se requiere renderizado dinámico)
            const contenedorSelectCliente = document.getElementById("contenedor-modal-cliente");
            const selectCliente = document.getElementById("modal-cliente-id");

            if (clienteId) {
                // CASO A: Venimos desde la vista de un cliente. Ocultamos el selector si existe en el HTML.
                if (contenedorSelectCliente) {
                    contenedorSelectCliente.classList.add("hidden");
                }
            } else {
                // CASO B: Venimos del Historial General. Es obligatorio poder seleccionar el cliente.
                if (contenedorSelectCliente && selectCliente) {
                    contenedorSelectCliente.classList.remove("hidden");
                    selectCliente.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
                    selectCliente.required = true; // Forzamos validación nativa HTML5

                    try {
                        // Consultamos los clientes del taller en tu backend
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
                        } else {
                            console.error("No se pudieron cargar los clientes para el desplegable.");
                        }
                    } catch (err) {
                        console.error("Error al conectar con el endpoint de clientes:", err);
                    }
                } else {
                    // Salvaguarda por si ejecutas el código antes de añadir el <select> en tu HTML
                    alert("Para crear facturas desde el listado general, necesitas incorporar el elemento select con id 'modal-cliente-id' en tu HTML.");
                    return;
                }
            }

            // Proponer fecha actual en formato local YYYY-MM-DD
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById("modal-fecha").value = hoy;

            // Proponer un número correlativo orientativo
            const añoActual = new Date().getFullYear();
            const sugerenciaCodigo = Date.now().toString().slice(-4);
            document.getElementById("modal-num-factura").value = `FACT-${añoActual}-${sugerenciaCodigo}`;
            
            // Mostrar modal quitando la clase hidden
            modal.classList.remove("hidden");
        };

        // --- 2. CERRAR MODAL ---
        const cerrarModal = () => {
            modal.classList.add("hidden");
            formFactura.reset();
        };

        btnCerrar.onclick = cerrarModal;
        btnCancelar.onclick = cerrarModal;

        // --- 3. ENVIAR FORMULARIO AL BACKEND ---
        formFactura.onsubmit = async (e) => {
            e.preventDefault(); // Evitamos que la página se recargue

            // Si venimos de filtro usamos ese ID, si no, rescatamos el valor del desplegable del modal
            const clienteIdFiltro = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;
            const selectCliente = document.getElementById("modal-cliente-id");
            const clienteIdFinal = clienteIdFiltro || (selectCliente ? selectCliente.value : null);

            if (!clienteIdFinal) {
                alert("Por favor, seleccione un cliente válido para emitir la factura.");
                return;
            }

            const numFactura = document.getElementById("modal-num-factura").value.trim();
            const fechaFactura = document.getElementById("modal-fecha").value;
            const ivaFactura = parseFloat(document.getElementById("modal-iva").value);

            if (!numFactura) {
                alert("Por favor, introduce un número de factura válido.");
                return;
            }

            // Construimos el JSON exacto para tu API
            const nuevaFacturaBody = {
                numerofactura: numFactura,
                fecha: fechaFactura,
                iva: ivaFactura,
                numerocliente: parseInt(clienteIdFinal), // Mantenemos tu conversión estricta a entero
                pagado: false,
                conceptos: []
            };

            try {
                const response = await fetch(`${API_URL}/facturacion/facturas`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
                    },
                    body: JSON.stringify(nuevaFacturaBody)
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Su sesión ha expirado o no está autorizado. Inicie sesión de nuevo.");
                    }
                    const errorDetail = await response.text();
                    throw new Error(`Error del servidor: ${errorDetail || response.statusText}`);
                }

                const facturaCreada = await response.json();
                alert(`Factura ${facturaCreada.numero || numFactura} creada con éxito.`);
                
                cerrarModal();

                // Refrescar listado en pantalla utilizando el estado del filtro actual
                if (typeof inicializar === "function") {
                    await inicializar(filtro);
                }

            } catch (error) {
                console.error("Error al registrar la factura:", error);
                alert("No se pudo crear la factura: " + error.message);
            }
        };
    }

    // Al final de tu función inicializar(filtro) en facturas.js, añade esto:
    window.alternarOrdenFacturas = alternarOrdenFacturas;
}

// 🌐 Carga las facturas reales directamente desde el API de FastAPI
async function cargarFacturasServidor(clienteId = null) {
    try {
        let url = `${API_URL}/facturacion/facturas/detallados`;

        // CORRECCIÓN: Cambiamos 'cliente_id' por 'numerocliente' para que FastAPI entienda el filtro
        if (clienteId) {
            url += `?numerocliente=${clienteId}`;
        }

        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (r.ok) {
            todasFacturas = await r.json();

            // FILTRO EXTRA DE SEGURIDAD EN FRONTEND:
            // Por si acaso el backend devuelve todas las facturas ignorando el query parameter,
            // nos aseguramos de filtrar en local usando el campo real 'numerocliente'
            if (clienteId) {
                todasFacturas = todasFacturas.filter(f => String(f.numerocliente) === String(clienteId));
            }
        } else {
            todasFacturas = [];
        }
    } catch (err) {
        console.error("Error cargando facturas desde el servidor:", err);
        todasFacturas = [];
    }
}

// 🆕 NUEVO: Controla el clic del usuario en las cabeceras de la tabla
export function alternarOrdenFacturas(campo) {
    if (facturaCampoOrden === campo) {
        facturaDireccionOrden = facturaDireccionOrden === "asc" ? "desc" : "asc";
    } else {
        facturaCampoOrden = campo;
        facturaDireccionOrden = "asc"; // Al cambiar de columna, empezamos ordenando de manera ascendente
    }
    renderizarListadoTabla();
}

function renderizarListadoTabla() {
    const tbody = document.getElementById("tbody-facturas-lista");
    tbody.innerHTML = "";

    if (todasFacturas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No se registran facturas en este tramo.</td></tr>`;
        return;
    }

    // 🆕 NUEVO: Ordenar una copia del array antes de renderizar
    let copia = [...todasFacturas];
    copia.sort((a, b) => {
        let valA = a[facturaCampoOrden];
        let valB = b[facturaCampoOrden];

        // Normalizar en caso de nulos o indefinidos
        if (valA === undefined || valA === null) valA = "";
        if (valB === undefined || valB === null) valB = "";

        // Si ordenamos por fecha, hacemos una comparación de tipo fecha/tiempo
        if (facturaCampoOrden === "fecha" && valA && valB) {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            return facturaDireccionOrden === "asc" ? dateA - dateB : dateB - dateA;
        }

        // Si es una cadena de texto (ej: el número de factura "FACT-2026-001")
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return facturaDireccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return facturaDireccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    // Pintar la tabla con la copia ya ordenada
    copia.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition border-b cursor-pointer";
        const total = f.total || f.total_factura || 0;
        const clienteNombre = f.cliente_razonsocial || f.razonsocial || f.cliente_nombre || '---';

        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">#${f.numero}</td>
            <td class="p-3 text-xs">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-800">${clienteNombre}</td>
            <td class="p-3 text-xs">
                <span class="${f.pagado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} px-2.5 py-1 rounded-full font-bold">
                    ${f.pagado ? 'COBRADA' : 'PENDIENTE'}
                </span>
            </td>
            <td class="p-3 text-right font-mono font-bold text-slate-950">${parseFloat(total).toFixed(2)} €</td>
        `;

        tr.onclick = () => cargarDetalleFacturaPDF(f.id);
        tbody.appendChild(tr);
    });
}

function mostrarOcultarVistas(mostrarLista) {
    if (mostrarLista) {
        document.getElementById("sub-vista-lista").classList.remove("hidden");
        document.getElementById("sub-vista-detalle").classList.add("hidden");
    } else {
        document.getElementById("sub-vista-lista").classList.add("hidden");
        document.getElementById("sub-vista-detalle").classList.remove("hidden");
    }
}

// 🌐 Trae los detalles completos y los conceptos reales de una factura seleccionada
async function cargarDetalleFacturaPDF(facturaId) {
    try {
        const r = await fetch(`${API_URL}/facturacion/facturas/${facturaId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (!r.ok) throw new Error("No se pudo obtener la factura");

        facturaSeleccionada = await r.json();
        mostrarOcultarVistas(false);

        // Rellenamos datos del folio blanco de la factura
        document.getElementById("pdf-numero-factura").textContent = `Nº: ${facturaSeleccionada.numero}`;
        document.getElementById("pdf-fecha-factura").textContent = `Fecha: ${facturaSeleccionada.fecha || '---'}`;
        document.getElementById("pdf-cliente-nombre").textContent = facturaSeleccionada.razonsocial || facturaSeleccionada.cliente_nombre || '---';
        document.getElementById("pdf-cliente-nif").textContent = `NIF: ${facturaSeleccionada.NIF || facturaSeleccionada.cliente_nif || '---'}`;

        const direccion = `${facturaSeleccionada.calle || ''} ${facturaSeleccionada.cliente_numero || ''}`.trim();
        document.getElementById("pdf-cliente-direccion").textContent = direccion || "No especificada";
        document.getElementById("check-factura-pagada").checked = facturaSeleccionada.pagada;

        // Se cargan los conceptos asociados reales
        conceptosFactura = facturaSeleccionada.conceptos || [];

        calcularYRenderizarConceptosPDF();
    } catch (err) {
        console.error("Error al cargar el detalle de la factura:", err);
        alert("No se pudo descargar el desglose de la factura.");
    }
}

function calcularYRenderizarConceptosPDF() {
    const tbody = document.getElementById("pdf-tbody-conceptos");
    tbody.innerHTML = "";

    let baseImponible = 0;

    conceptosFactura.forEach((c, index) => {
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
            conceptosFactura.splice(index, 1);
            calcularYRenderizarConceptosPDF();
        };

        tbody.appendChild(tr);
    });

    const porcentajeIva = (facturaSeleccionada && facturaSeleccionada.iva !== undefined) ? parseFloat(facturaSeleccionada.iva) : 21;

    const etiquetaIvaUI = document.getElementById("factura-iva-porcentaje");
    if (etiquetaIvaUI) {
        etiquetaIvaUI.textContent = `I.V.A. (${porcentajeIva}%):`;
    }

    const totalIva = baseImponible * (porcentajeIva / 100);
    const totalFactura = baseImponible + totalIva;

    document.getElementById("pdf-calculo-base").textContent = `${baseImponible.toFixed(2)} €`;
    document.getElementById("pdf-calculo-iva").textContent = `${totalIva.toFixed(2)} €`;
    document.getElementById("pdf-calculo-total").textContent = `${totalFactura.toFixed(2)} €`;
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

    conceptosFactura.push({
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
async function enviarActualizacionServidor() {
    if (!facturaSeleccionada) {
        alert("No hay ninguna factura activa seleccionada.");
        return;
    }

    // Adaptamos el array de conceptos para enviar al backend con las propiedades correctas
    const conceptosProcesados = conceptosFactura.map(c => ({
        descripcion: c.descripcion,
        cantidad: parseFloat(c.cantidad),
        precio_unitario: parseFloat(c.precio_unitario || c.preciounidad || c.precio),
        descuento: parseFloat(c.descuento || 0)
    }));

    const payload = {
        pagada: document.getElementById("check-factura-pagada").checked,
        conceptos: conceptosProcesados
    };

    try {
        const url = `${API_URL}/facturacion/facturas/${facturaSeleccionada.id}`;
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

        alert("¡Factura, conceptos y estado de cobro guardados con éxito en la base de datos!");
        mostrarOcultarVistas(true);
        await cargarFacturasServidor();
        renderizarListadoTabla();
    } catch (err) {
        console.error("Error al guardar la factura en el servidor:", err);
        alert(`No se pudo actualizar la factura en el servidor. Detalle: ${err.message}`);
    }
}