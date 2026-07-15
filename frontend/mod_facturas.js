const API_URL = "http://127.0.0.1:8000";
const ModuloFacturas = {
    facturasTotales: [],
    facturaActiva: null,
    conceptosActivos: [],

    async inicializar(filtro = null) {
        document.getElementById("pdf-btn-add-concepto").onclick = () => this.agregarConceptoLinea();
        document.getElementById("btn-guardar-cambios-factura").onclick = () => this.guardarFacturaEnServidor();
        
        // 1. Descargar el listado completo de facturas reales de la BD
        await this.descargarFacturasServidor();

        // 2. Aplicar filtros dependiendo de la acción del usuario
        if (filtro && filtro.cliente_id) {
            document.getElementById("titulo-modulo-facturas").textContent = `Facturas de: ${filtro.razonsocial}`;
            this.facturasTotales = this.facturasTotales.filter(f => f.cliente_id === filtro.cliente_id);
        } else {
            document.getElementById("titulo-modulo-facturas").textContent = "Historial General de Facturas";
        }
        
        this.renderizarTablaListado();
    },

    async descargarFacturasServidor() {
        try {
            const r = await fetch("${API_URL}/facturas/", {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
            });
            if (!r.ok) throw new Error();
            this.facturasTotales = await r.json();
        } catch (err) {
            console.error("Error al conectar con la base de datos de facturas", err);
            this.facturasTotales = [];
        }
    },

    renderizarTablaListado() {
        const tbody = document.getElementById("tbody-facturas-lista");
        tbody.innerHTML = "";

        if (this.facturasTotales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">No se han encontrado facturas en el registro.</td></tr>`;
            return;
        }

        this.facturasTotales.forEach(f => {
            const tr = document.createElement("tr");
            tr.className = "border-b hover:bg-blue-50/50 transition text-slate-700 text-xs";
            
            // Tratamiento de importes del backend
            const totalFactura = f.total || f.total_factura || 0;

            tr.innerHTML = `
                <td class="p-3 font-bold text-blue-900">${f.numero}</td>
                <td class="p-3">${f.fecha || '---'}</td>
                <td class="p-3 font-semibold text-slate-900">${f.cliente_razonsocial || f.razonsocial || '---'}</td>
                <td class="p-3 font-mono text-slate-500">${f.cliente_nif || f.nif || '---'}</td>
                <td class="p-3 text-slate-500">${f.cliente_telefono || f.telefono || '---'}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${f.pagada ? 'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}">${f.pagada ? 'COBRADA':'PENDIENTE'}</span></td>
                <td class="p-3 text-right font-mono font-bold text-sm text-slate-950">${parseFloat(totalFactura).toFixed(2)} €</td>
            `;
            
            // Al pulsar sobre la fila se descarga de forma fidedigna la información de la BD
            tr.onclick = () => this.desplegarFolioPDFReal(f.id);
            tbody.appendChild(tr);
        });
    },

    async desplegarFolioPDFReal(facturaId) {
        try {
            // Petición al endpoint específico para traer la factura completa junto a sus conceptos relacionales
            const r = await fetch(`${API_URL}/facturas/${facturaId}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
            });
            if (!r.ok) throw new Error("No se ha podido recuperar la factura seleccionada.");
            
            const f = await r.json();
            this.facturaActiva = f;

            // Cambiar de sub-pantalla en la interfaz modular
            document.getElementById("facturas-sub-lista").classList.add("hidden");
            document.getElementById("facturas-sub-detalle").classList.remove("hidden");

            // Rellenar datos en caliente de la Base de Datos al Folio impreso
            document.getElementById("pdf-numero-factura").textContent = `Nº: ${f.numero}`;
            document.getElementById("pdf-fecha-factura").textContent = `Fecha: ${f.fecha || '---'}`;
            document.getElementById("pdf-cliente-nombre").textContent = f.cliente_razonsocial || f.razonsocial;
            document.getElementById("pdf-cliente-nif").textContent = `NIF: ${f.cliente_nif || f.nif || '---'}`;
            
            const direccionObra = `${f.cliente_calle || ''} ${f.cliente_numero || ''} (${f.cliente_poblacion || ''})`.trim();
            document.getElementById("pdf-cliente-direccion").textContent = direccionObra || "Dirección fiscal del cliente";
            document.getElementById("check-factura-pagada").checked = f.pagada;

            // Asignar los conceptos devueltos por el backend
            this.conceptosActivos = f.conceptos || [];
            this.calcularYRenderizarConceptos();

        } catch (err) {
            alert(err.message);
        }
    },

    calcularYRenderizarConceptos() {
        const tbody = document.getElementById("pdf-tbody-conceptos");
        tbody.innerHTML = "";
        let baseImponible = 0;

        this.conceptosActivos.forEach((c, index) => {
            // Mapeo seguro si la propiedad viene como precio o precio_unitario
            const cantidad = parseFloat(c.cantidad || 0);
            const precio = parseFloat(c.precio_unitario || c.precio || 0);
            const subtotal = cantidad * precio;
            baseImponible += subtotal;

            const tr = document.createElement("tr");
            tr.className = "border-b text-xs";
            tr.innerHTML = `
                <td class="p-2 text-slate-800 font-medium">${c.descripcion}</td>
                <td class="p-2 text-right font-mono">${cantidad}</td>
                <td class="p-2 text-right font-mono">${precio.toFixed(2)} €</td>
                <td class="p-2 text-right font-mono font-bold">${subtotal.toFixed(2)} €</td>
                <td class="p-2 text-center"><button class="text-rose-600 font-bold hover:underline">Eliminar</button></td>
            `;
            
            tr.querySelector("button").onclick = () => {
                this.conceptosActivos.splice(index, 1);
                this.calcularYRenderizarConceptos();
            };
            tbody.appendChild(tr);
        });

        const iva = baseImponible * 0.21;
        const total = baseImponible + iva;

        document.getElementById("pdf-calculo-base").textContent = `${baseImponible.toFixed(2)} €`;
        document.getElementById("pdf-calculo-iva").textContent = `${iva.toFixed(2)} €`;
        document.getElementById("pdf-calculo-total").textContent = `${total.toFixed(2)} €`;
    },

    agregarConceptoLinea() {
        const desc = document.getElementById("pdf-nuevo-desc").value.trim();
        const cant = parseFloat(document.getElementById("pdf-nuevo-cant").value);
        const precio = parseFloat(document.getElementById("pdf-nuevo-precio").value);

        if (!desc || isNaN(precio)) { 
            alert("Introduce la descripción y el precio del concepto."); 
            return; 
        }

        this.conceptosActivos.push({
            descripcion: desc,
            cantidad: cant,
            precio_unitario: precio // Guardado conforme al estándar del backend
        });
        
        document.getElementById("pdf-nuevo-desc").value = "";
        document.getElementById("pdf-nuevo-cant").value = "1";
        document.getElementById("pdf-nuevo-precio").value = "";

        this.calcularYRenderizarConceptos();
    },

    async guardarFacturaEnServidor() {
        const payload = {
            pagada: document.getElementById("check-factura-pagada").checked,
            conceptos: this.conceptosActivos
        };

        try {
            const r = await fetch(`${API_URL}/facturas/${this.facturaActiva.id}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${localStorage.getItem("token_taller")}` 
                },
                body: JSON.stringify(payload)
            });

            if (!r.ok) throw new Error();
            
            alert("¡Cambios de la factura (Conceptos e IVA) guardados con éxito en la base de datos!");
            
            // Volver a la lista
            document.getElementById("facturas-sub-detalle").classList.add("hidden");
            document.getElementById("facturas-sub-lista").classList.remove("hidden");
            
            await this.inicializar(); // Recargar listado completo limpio
        } catch {
            alert("No se ha podido actualizar la factura. Verifique la conexión con la API.");
        }
    }
};