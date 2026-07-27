const API_URL = "http://127.0.0.1:8000";

let todasAlbaranes = [];
let albaranSeleccionado = null;
let conceptosAlbaran = [];

// 🆕 NUEVO: Variables para controlar el orden de las albaranes
let albaranCampoOrden = "fecha";      // Ordenación por defecto inicial
let albaranDireccionOrden = "desc";   // Dirección por defecto inicial (más recientes primero)

// Función de entrada que invoca el enrutador central de app.js
export async function inicializar(filtro) {
    document.getElementById("btn-volver-listado").onclick = () => mostrarOcultarVistas(true);
    document.getElementById("pdf-btn-add-concepto").onclick = agregarConceptoLinea;

    // Forzamos a que limpie cualquier onclick previo de app.js y asigne el correcto:
    const btnGuardar = document.getElementById("btn-guardar-cambios-albaran");
    if (btnGuardar) {
        btnGuardar.onclick = null; // Eliminamos la referencia a app.js
        btnGuardar.onclick = enviarActualizacionServidor; // Asignamos la función real de albaranes.js
    }

    const btnBorrar = document.getElementById("btn-borrar-albaran");
    if (btnBorrar) {
        btnBorrar.onclick = () => {
            if (!albaranSeleccionado) {
                alert("No hay ninguna albaran seleccionada para eliminar.");
                return;
            }
            eliminarAlbaran(albaranSeleccionado.id);
        };
    }
    const btnPdf = document.getElementById("btn-imprimir-pdf");
    if (btnPdf) {
        btnPdf.onclick = () => {
            if (!albaranSeleccionado) {
                alert("No hay datos de albaran para imprimir.");
                return;
            }

            // 1. Calculamos los totales
            let baseImponible = 0;
            let filasConceptosHtml = "";

            conceptosAlbaran.forEach((c, index) => {
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

            const porcentajeIva = parseFloat(albaranSeleccionado.iva || 21);
            const totalIva = baseImponible * (porcentajeIva / 100);
            const totalAlbaran = baseImponible + totalIva;

            // 2. Creamos la estructura HTML en una variable de texto (sin meterla en el documento)
            const htmlAlbaranClasica = `
                <div style="width: 690px; background: white; color: #000000; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
                    <!-- Cabecera de la albaran -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 25px;">
                        <!-- Bloque izquierdo: Tus Datos -->
                        <div style="font-size: 13px; line-height: 1.5; color: #1e293b; text-align: left;">
                            <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Talleres Moreno López S.L.</h3>
                            <p style="margin: 2px 0;">La Fragua</p>
                            <p style="margin: 2px 0;">C/ San Antonio, 3</p>
                            <p style="margin: 2px 0;">14450 Añora, Córdoba</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">NIF:</span> B-14787246</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Teléfono:</span> +34 696 906 255, 647 698 915, 957 15 12 54</p>
                            <p style="margin: 2px 0;"><span style="font-weight: 600;">Email:</span> lafraguaforja@gmail.com</p>
                        </div>

                        <!-- Bloque derecho: Título y Números -->
                        <div style="text-align: right;">
                            <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 1px;">Albaran</h1>
                            <p style="margin: 2px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Número: ${albaranSeleccionado.numero}</p>
                            <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #475569;">Fecha: ${albaranSeleccionado.fecha || '---'}</p>
                        </div>
                    </div>

                    <!-- Datos del Cliente -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 30px; font-size: 13px; line-height: 1.6; color: #334155; text-align: left;">
                        <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">Cliente:</h3>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Razón Social:</span> ${albaranSeleccionado.razonsocial || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">NIF/DNI:</span> ${albaranSeleccionado.NIF || albaranSeleccionado.cliente_nif || '---'}</p>
                        <p style="margin: 3px 0;"><span style="font-weight: 700; color: #0f172a;">Dirección:</span> ${[albaranSeleccionado.calle, albaranSeleccionado.cliente_numero, albaranSeleccionado.poblacion].filter(Boolean).join(" ") || '---'}</p>
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
                                <!-- <span>Base Imponible:</span> -->
                                <span>Total:</span>
                                <span style="font-weight: 600; font-family: monospace;">${baseImponible.toFixed(2)} €</span>
                            </div>
                            <!-- 
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 4px 0;">
                                <span>I.V.A. (${porcentajeIva}%):</span>
                                <span style="font-weight: 600; font-family: monospace;">${totalIva.toFixed(2)} €</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800; color: #0f172a;">
                                <span>TOTAL:</span>
                                <span style="font-family: monospace;">${totalAlbaran.toFixed(2)} €</span>
                            </div>
                            -->
                        </div>
                    </div>
                </div>
            `;

            // 3. Configuración del PDF
            const opciones = {
                margin: 15,
                filename: `Albaran_${albaranSeleccionado.numero}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // 4. Generamos el PDF pasándole directamente la cadena HTML de la albaran clásica
            html2pdf()
                .set(opciones)
                .from(htmlAlbaranClasica)
                .save()
                .catch(err => {
                    console.error("Error al exportar PDF:", err);
                });
        };
    }

    const clienteId = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;

    await cargarAlbaranesServidor(clienteId);

    if (filtro && (filtro.nombre || filtro.razonsocial)) {
        document.getElementById("titulo-modulo-albaranes").textContent = `Albaranes de: ${filtro.nombre || filtro.razonsocial}`;
    } else {
        document.getElementById("titulo-modulo-albaranes").textContent = "Historial General de Albaranes";
    }

    renderizarListadoTabla();

    // En albaranes.js (dentro de tu función de inicialización) 
    // Dar de alta una nueva albaran para el cliente.

    // En albaranes.js (dentro de tu función de inicialización) 
    // Dar de alta una nueva albaran (vía cliente o vía listado general)

    const btnNuevaAlbaran = document.getElementById("btn-nueva-albaran-cliente");
    const modal = document.getElementById("modal-nueva-albaran");
    const btnCerrar = document.getElementById("btn-cerrar-modal");
    const btnCancelar = document.getElementById("btn-cancelar-albaran");
    const formAlbaran = document.getElementById("form-nueva-albaran");

    if (btnNuevaAlbaran && modal) {
        // --- FUNCIÓN AUXILIAR: Obtiene el número correlativo más alto + 1 ---
        const obtenerSiguienteNumeroAlbaran = async (añoActual) => {
            try {
                // Consultamos las albaranes existentes
                const response = await fetch(`${API_URL}/albaran/albaran/detallados`, {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
                });

                if (!response.ok) return `ALB-${añoActual}-1`;

                const albaranes = await response.json();

                // Buscamos el sufijo numérico más alto del año en curso
                let maxNumero = 0;
                const prefijoBuscado = `ALB-${añoActual}-`;

                albaranes.forEach(f => {
                    // Soportamos f.numero o f.numeroalbaran según devuelva tu backend
                    const numStr = f.numero || f.numeroalbaran || "";

                    // Verificamos si la albaran empieza por "ALB-2026-"
                    if (numStr.startsWith(prefijoBuscado)) {
                        // Extraemos la parte numérica final
                        const partes = numStr.split("-");
                        const secuencial = parseInt(partes[partes.length - 1], 10);
                        if (!isNaN(secuencial) && secuencial > maxNumero) {
                            maxNumero = secuencial;
                        }
                    }
                });

                // Retornamos el siguiente número
                return `ALB-${añoActual}-${maxNumero + 1}`;

            } catch (err) {
                console.error("Error al obtener el número correlativo:", err);
                // Fallback en caso de error de red
                return `ALB-${añoActual}-1`;
            }
        };

        // --- 1. ABRIR MODAL Y PROPONER VALORES ---
        btnNuevaAlbaran.onclick = async () => {
            // Evaluamos de forma segura si disponemos de un ID de cliente previo
            const clienteId = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;

            const contenedorSelectCliente = document.getElementById("contenedor-modal-cliente");
            const selectCliente = document.getElementById("modal-cliente-id");

            if (clienteId) {
                // CASO A: Venimos desde la vista de un cliente. Ocultamos el selector si existe.
                if (contenedorSelectCliente) {
                    contenedorSelectCliente.classList.add("hidden");
                }
            } else {
                // CASO B: Venimos del Historial General. Cargamos clientes en el desplegable.
                if (contenedorSelectCliente && selectCliente) {
                    contenedorSelectCliente.classList.remove("hidden");
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
                        } else {
                            console.error("No se pudieron cargar los clientes para el desplegable.");
                        }
                    } catch (err) {
                        console.error("Error al conectar con el endpoint de clientes:", err);
                    }
                } else {
                    alert("Para crear albaranes desde el listado general, necesitas incorporar el elemento select con id 'modal-cliente-id' en tu HTML.");
                    return;
                }
            }

            // Proponer fecha actual en formato local YYYY-MM-DD
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById("modal-fecha").value = hoy;

            // 🆕 NUEVO: Obtener el número correlativo real desde la base de datos
            const añoActual = new Date().getFullYear();
            document.getElementById("modal-num-albaran").value = "Cargando..."; // Feedback visual rápido

            const numSugerido = await obtenerSiguienteNumeroAlbaran(añoActual);
            document.getElementById("modal-num-albaran").value = numSugerido;

            // Mostrar modal quitando la clase hidden
            modal.classList.remove("hidden");
        };

        // --- 2. CERRAR MODAL ---
        const cerrarModal = () => {
            modal.classList.add("hidden");
            formAlbaran.reset();
        };

        btnCerrar.onclick = cerrarModal;
        btnCancelar.onclick = cerrarModal;

        // --- 3. ENVIAR FORMULARIO AL BACKEND ---
        formAlbaran.onsubmit = async (e) => {
            e.preventDefault();

            const clienteIdFiltro = filtro ? (filtro.cliente_id || filtro.id || filtro.filtrarClienteId) : null;
            const selectCliente = document.getElementById("modal-cliente-id");
            const clienteIdFinal = clienteIdFiltro || (selectCliente ? selectCliente.value : null);

            if (!clienteIdFinal) {
                alert("Por favor, seleccione un cliente válido para emitir la albaran.");
                return;
            }

            const numAlbaran = document.getElementById("modal-num-albaran").value.trim();
            const fechaAlbaran = document.getElementById("modal-fecha").value;
            const ivaAlbaran = parseFloat(document.getElementById("modal-iva").value);

            if (!numAlbaran) {
                alert("Por favor, introduce un número de albaran válido.");
                return;
            }

            const nuevaAlbaranBody = {
                numeroalbaran: numAlbaran,
                fecha: fechaAlbaran,
                iva: ivaAlbaran,
                numerocliente: parseInt(clienteIdFinal),
                aceptado: false,
                conceptos: []
            };

            try {
                const response = await fetch(`${API_URL}/albaran/albaran`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token_taller")}`
                    },
                    body: JSON.stringify(nuevaAlbaranBody)
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Su sesión ha expirado o no está autorizado. Inicie sesión de nuevo.");
                    }
                    const errorDetail = await response.text();
                    throw new Error(`Error del servidor: ${errorDetail || response.statusText}`);
                }

                const albaranCreada = await response.json();
                alert(`Albaran ${albaranCreada.numero || numAlbaran} creada con éxito.`);

                cerrarModal();

                if (typeof inicializar === "function") {
                    await inicializar(filtro);
                }

            } catch (error) {
                console.error("Error al registrar la albaran:", error);
                alert("No se pudo crear la albaran: " + error.message);
            }
        };
    }

    // Al final de tu función inicializar(filtro) en albaranes.js, añade esto:
    window.alternarOrdenAlbaranes = alternarOrdenAlbaranes;
}

// 🌐 Carga las albaranes reales directamente desde el API de FastAPI
async function cargarAlbaranesServidor(clienteId = null) {
    try {
        let url = `${API_URL}/albaran/albaran/detallados`;

        // CORRECCIÓN: Cambiamos 'cliente_id' por 'numerocliente' para que FastAPI entienda el filtro
        if (clienteId) {
            url += `?numerocliente=${clienteId}`;
        }

        const r = await fetch(url, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (r.ok) {
            todasAlbaranes = await r.json();

            // FILTRO EXTRA DE SEGURIDAD EN FRONTEND:
            // Por si acaso el backend devuelve todas las albaranes ignorando el query parameter,
            // nos aseguramos de filtrar en local usando el campo real 'numerocliente'
            if (clienteId) {
                todasAlbaranes = todasAlbaranes.filter(f => String(f.numerocliente) === String(clienteId));
            }
        } else {
            todasAlbaranes = [];
        }
    } catch (err) {
        console.error("Error cargando albaranes desde el servidor:", err);
        todasAlbaranes = [];
    }
}

// 🆕 NUEVO: Controla el clic del usuario en las cabeceras de la tabla
export function alternarOrdenAlbaranes(campo) {
    if (albaranCampoOrden === campo) {
        albaranDireccionOrden = albaranDireccionOrden === "asc" ? "desc" : "asc";
    } else {
        albaranCampoOrden = campo;
        albaranDireccionOrden = "asc"; // Al cambiar de columna, empezamos ordenando de manera ascendente
    }
    renderizarListadoTabla();
}

function renderizarListadoTabla() {
    const tbody = document.getElementById("tbody-albaranes-lista");
    tbody.innerHTML = "";

    if (todasAlbaranes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No se registran albaranes en este tramo.</td></tr>`;
        return;
    }

    // 🆕 NUEVO: Ordenar una copia del array antes de renderizar
    let copia = [...todasAlbaranes];
    copia.sort((a, b) => {
        let valA = a[albaranCampoOrden];
        let valB = b[albaranCampoOrden];

        // Normalizar en caso de nulos o indefinidos
        if (valA === undefined || valA === null) valA = "";
        if (valB === undefined || valB === null) valB = "";

        // Si ordenamos por fecha, hacemos una comparación de tipo fecha/tiempo
        if (albaranCampoOrden === "fecha" && valA && valB) {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            return albaranDireccionOrden === "asc" ? dateA - dateB : dateB - dateA;
        }

        // Si es una cadena de texto (ej: el número de albaran "ALB-2026-001")
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return albaranDireccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return albaranDireccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    // Pintar la tabla con la copia ya ordenada
    copia.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition border-b cursor-pointer";
        const total = f.total || f.total_albaran || 0;
        const clienteNombre = f.cliente_razonsocial || f.razonsocial || f.cliente_nombre || '---';

        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">#${f.numero}</td>
            <td class="p-3 text-xs">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-800">${clienteNombre}</td>
            <td class="p-3 text-xs">
                <span class="${f.aceptado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} px-2.5 py-1 rounded-full font-bold">
                    ${f.aceptado ? 'ACEPTADO' : 'PENDIENTE'}
                </span>
            </td>
            <td class="p-3 text-right font-mono font-bold text-slate-950">${parseFloat(total).toFixed(2)} €</td>
        `;

        tr.onclick = () => cargarDetalleAlbaranPDF(f.id);
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

// 🌐 Trae los detalles completos y los conceptos reales de una albaran seleccionada
async function cargarDetalleAlbaranPDF(albaranId) {
    try {
        const r = await fetch(`${API_URL}/albaran/albaran/${albaranId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
        });

        if (!r.ok) throw new Error("No se pudo obtener la albaran");

        albaranSeleccionado = await r.json();
        mostrarOcultarVistas(false);

        // Rellenamos datos del folio blanco de la albaran
        document.getElementById("pdf-numero-albaran").textContent = `Nº: ${albaranSeleccionado.numero}`;
        document.getElementById("pdf-fecha-albaran").textContent = `Fecha: ${albaranSeleccionado.fecha || '---'}`;
        document.getElementById("pdf-cliente-nombre").textContent = albaranSeleccionado.razonsocial || albaranSeleccionado.cliente_nombre || '---';
        document.getElementById("pdf-cliente-nif").textContent = `NIF: ${albaranSeleccionado.NIF || albaranSeleccionado.cliente_nif || '---'}`;

        const direccion = `${albaranSeleccionado.calle || ''} ${albaranSeleccionado.cliente_numero || ''}`.trim();

        // 1. Línea superior: Calle + Número + Piso
        const linea1 = [
            [albaranSeleccionado.calle, albaranSeleccionado.cliente_numero].filter(Boolean).join(" "),
            albaranSeleccionado.piso || albaranSeleccionado.cliente_piso // Por si la variable del piso se llama piso o cliente_piso
        ].filter(Boolean).join(", "); // Añade una coma antes del piso si existe (Ej: "Calle Mayor 14, 2ºA")

        // 2. Línea inferior: Código Postal + Población + Provincia
        const linea2 = [
            albaranSeleccionado.cp || albaranSeleccionado.cliente_cp,
            albaranSeleccionado.poblacion || albaranSeleccionado.cliente_poblacion,
            albaranSeleccionado.provincia || albaranSeleccionado.cliente_provincia
        ].filter(Boolean).join(" "); // Une CP, Población y Provincia con espacios

        // 3. Unimos ambas líneas con un salto de línea HTML (<br>)
        const direccionCompleta = [linea1, linea2].filter(Boolean).join("<br>");

        // 4. Inyectamos en el DOM (usamos innerHTML para interpretar el <br>)
        const elDireccion = document.getElementById("pdf-cliente-direccion");
        if (elDireccion) {
            elDireccion.innerHTML = direccionCompleta || "No especificada";
        }

      //  const direccion = `${albaranSeleccionado.calle || ''} ${albaranSeleccionado.cliente_numero || ''}`.trim();
      // document.getElementById("pdf-cliente-direccion").textContent = direccion || "No especificada";
        document.getElementById("check-albaran-aceptado").checked = albaranSeleccionado.aceptado;

        // Se cargan los conceptos asociados reales
        conceptosAlbaran = albaranSeleccionado.conceptos || [];

        calcularYRenderizarConceptosPDF();
    } catch (err) {
        console.error("Error al cargar el detalle de la albaran:", err);
        alert("No se pudo descargar el desglose de la albaran.");
    }
}

function calcularYRenderizarConceptosPDF() {
    const tbody = document.getElementById("pdf-tbody-conceptos");
    tbody.innerHTML = "";

    let baseImponible = 0;

    conceptosAlbaran.forEach((c, index) => {
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
            conceptosAlbaran.splice(index, 1);
            calcularYRenderizarConceptosPDF();
        };

        tbody.appendChild(tr);
    });

    const porcentajeIva = (albaranSeleccionado && albaranSeleccionado.iva !== undefined) ? parseFloat(albaranSeleccionado.iva) : 21;

    const etiquetaIvaUI = document.getElementById("albaran-iva-porcentaje");
    if (etiquetaIvaUI) {
        etiquetaIvaUI.textContent = `I.V.A. (${porcentajeIva}%):`;
    }

    const totalIva = baseImponible * (porcentajeIva / 100);
    const totalAlbaran = baseImponible + totalIva;

    document.getElementById("pdf-calculo-base").textContent = `${baseImponible.toFixed(2)} €`;
    document.getElementById("pdf-calculo-iva").textContent = `${totalIva.toFixed(2)} €`;
    document.getElementById("pdf-calculo-total").textContent = `${totalAlbaran.toFixed(2)} €`;
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

    conceptosAlbaran.push({
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
    if (!albaranSeleccionado) {
        alert("No hay ninguna albaran activa seleccionada.");
        return;
    }

    // Adaptamos el array de conceptos para enviar al backend con las propiedades correctas
    const conceptosProcesados = conceptosAlbaran.map(c => ({
        descripcion: c.descripcion,
        cantidad: parseFloat(c.cantidad),
        precio_unitario: parseFloat(c.precio_unitario || c.preciounidad || c.precio),
        descuento: parseFloat(c.descuento || 0)
    }));

    const payload = {
        aceptado: document.getElementById("check-albaran-aceptado").checked,
        conceptos: conceptosProcesados
    };

    try {
        const url = `${API_URL}/albaran/albaran/${albaranSeleccionado.id}`;
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

        alert("¡Albaran, conceptos y estado de cobro guardados con éxito en la base de datos!");
        mostrarOcultarVistas(true);
        await cargarAlbaranesServidor();
        renderizarListadoTabla();
    } catch (err) {
        console.error("Error al guardar la albaran en el servidor:", err);
        alert(`No se pudo actualizar la albaran en el servidor. Detalle: ${err.message}`);
    }
}

async function eliminarAlbaran(albaranId, filaElemento = null) {
    const idNum = parseInt(albaranId, 10);
    if (isNaN(idNum)) {
        alert("ID de albaran no válido para eliminar.");
        return;
    }

    const confirmar = confirm("¿Estás seguro de que deseas eliminar esta albaran? Esta acción no se puede deshacer.");
    if (!confirmar) return;

    try {
        const response = await fetch(`${API_URL}/albaran/albaran/${idNum}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token_taller")}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok || response.status === 204) {
            alert("Albaran eliminada correctamente.");
            
            // Volver a la vista de lista si estábamos en el detalle
            mostrarOcultarVistas(true);
            
            // Recargar la tabla desde el servidor
            await cargarAlbaranesServidor();
            renderizarListadoTabla();
        } else {
            if (response.status === 401) {
                throw new Error("Sesión expirada. Por favor, inicia sesión de nuevo.");
            }
            const errorTxt = await response.text();
            throw new Error(errorTxt || "Error al eliminar la albaran.");
        }
    } catch (error) {
        console.error("Error al borrar albaran:", error);
        alert("No se pudo eliminar la albaran: " + error.message);
    }
}