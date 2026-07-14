const API_URL = "http://127.0.0.1:8000";

let todasFacturas = [];
let facturaSeleccionada = null;
let conceptosFactura = [];

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
            // 1. Seleccionamos el folio blanco de la factura
            const elementoFactura = document.getElementById("sub-vista-detalle");

            if (!elementoFactura) {
                alert("No se encontró el contenedor de la factura.");
                return;
            }

            // 🆕 1. Guardamos las clases originales del contenedor para no perder su diseño web
            const clasesOriginales = elementoFactura.className;
            
            // 🆕 2. Le quitamos cualquier borde, redondeo o sombra (Tailwind)
            elementoFactura.classList.remove(
                "border", "border-gray-200", "border-slate-200", 
                "rounded", "rounded-md", "rounded-lg", "rounded-xl", 
                "shadow", "shadow-md", "shadow-sm"
            );

            // 2. Ocultamos temporalmente los botones de control y el formulario de añadir conceptos
            const selectoresOcultar = [
                "#btn-volver-listado",
                "#btn-imprimir-pdf",
                "#btn-guardar-cambios-factura",
                "#pdf-btn-add-concepto",
                // Si tienes la zona de agregar conceptos envuelta en un contenedor, puedes ocultarlo entero:
                ".no-print", 
                "input[type='text']", 
                "input[type='number']",
                // OCULTAMOS LA COLUMNA DE ACCIÓN EN CABECERA Y FILAS:
                ".columna-accion",
                ".factura-pagada",
                // OCULTAMOS EL CHECKBOX DE PAGADO (Y subimos al contenedor gris que lo envuelve):
                "#check-factura-pagada"
            ];
            
            // Buscamos y aplicamos un display: none temporal
            const elementosAOcultar = elementoFactura.querySelectorAll(selectoresOcultar.join(", "));
            elementosAOcultar.forEach(el => {
                el.dataset.originalDisplay = el.style.display; // Guardamos el estado original
                el.style.setProperty("display", "none", "important");
            });

            // 3. Ajustes de diseño para que el PDF luzca impecable en papel virtual DIN A4
            const opciones = {
                margin:       5, // Márgenes limpios de 10mm alrededor de la factura
                filename:     `Factura_${facturaSeleccionada ? facturaSeleccionada.numero : 'Taller'}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 3,        // Multiplicador de resolución (se verá nítido incluso al hacer zoom)
                    useCORS: true,   // Evita problemas de carga de imágenes externas si las hubiera
                    letterRendering: true
                },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } // DIN A4 Vertical estándar
            };

            // 4. Generamos y descargamos el PDF
            html2pdf()
                .set(opciones)
                .from(elementoFactura)
                .save()
                .then(() => {
                    // 5. Una vez generado, devolvemos los botones e inputs a su estado original en pantalla
                    elementosAOcultar.forEach(el => {
                        el.style.display = el.dataset.originalDisplay || "";
                    });
                    // 🆕 3. Restauramos los bordes y sombras del diseño web
                    elementoFactura.className = clasesOriginales;
                })
                .catch(err => {
                    console.error("Error al generar el PDF:", err);
                    // Si falla, nos aseguramos de restaurar la pantalla igualmente
                    elementosAOcultar.forEach(el => {
                        el.style.display = el.dataset.originalDisplay || "";
                    });
                    // 🆕 3. Restauramos los bordes y sombras del diseño web
                    elementoFactura.className = clasesOriginales;
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

function renderizarListadoTabla() {
    const tbody = document.getElementById("tbody-facturas-lista");
    tbody.innerHTML = "";

    if (todasFacturas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No se registran facturas en este tramo.</td></tr>`;
        return;
    }

    todasFacturas.forEach(f => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition border-b cursor-pointer";
        const total = f.total || f.total_factura || 0;
        const nif = f.cliente_nif || f.NIF || f.nif || '---';
        const clienteNombre = f.cliente_razonsocial || f.razonsocial || f.cliente_nombre || '---';

        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-900">#${f.numero}</td>
            <td class="p-3 text-xs">${f.fecha || '---'}</td>
            <td class="p-3 font-semibold text-slate-800">${clienteNombre}</td>
            <td class="p-3 text-xs">
                <span class="${f.pagada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} px-2.5 py-1 rounded-full font-bold">
                    ${f.pagada ? 'COBRADA' : 'PENDIENTE'}
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

    if(!descInput.value.trim() || !precioInput.value) { 
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