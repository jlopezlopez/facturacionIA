const ModuloClientes = {
    listaClientes: [],
    campoOrden: "id",
    direccionOrden: "desc",

    async inicializar() {
        document.getElementById("th-id").onclick = () => this.cambiarOrden("id");
        document.getElementById("th-razon").onclick = () => this.cambiarOrden("razonsocial");
        document.getElementById("btn-nuevo-cliente").onclick = () => this.abrirModalAlta();
        document.getElementById("form-cliente").onsubmit = (e) => this.guardarFichaFormulario(e);
        await this.cargarClientesServidor();
    },

    async cargarClientesServidor() {
        try {
            const r = await fetch("http://127.0.0.1:8000/clientes/", {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
            });
            this.listaClientes = await r.json();
            this.renderizarTabla();
        } catch (err) { console.error("Error cargando clientes del taller", err); }
    },

    cambiarOrden(campo) {
        if (this.campoOrden === campo) {
            this.direccionOrden = this.direccionOrden === "asc" ? "desc" : "asc";
        } else {
            this.campoOrden = campo;
            this.direccionOrden = "asc";
        }
        this.renderizarTabla();
    },

    // Reemplaza la función renderizarTabla dentro de ModuloClientes por esta versión:
renderizarTabla() {
    let clientes = [...this.listaClientes];
    clientes.sort((a, b) => {
        let valA = a[this.campoOrden];
        let valB = b[this.campoOrden];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return this.direccionOrden === "asc" ? -1 : 1;
        if (valA > valB) return this.direccionOrden === "asc" ? 1 : -1;
        return 0;
    });

    const tbody = document.getElementById("tbody-clientes");
    tbody.innerHTML = "";

    clientes.forEach(c => {
        const dir = `${c.calle || ''} ${c.numero || ''} ${c.piso || ''} (${c.poblacion || ''}) (${c.cp || c.CP || ''})`.trim() || "---";
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-slate-50 text-xs";
        tr.innerHTML = `
            <td class="p-3 font-bold text-blue-950">#${c.id}</td>
            <td class="p-3 font-semibold text-sm text-slate-900">${c.razonsocial}</td>
            <td class="p-3 font-mono">${c.nif || c.NIF}</td>
            <td class="p-3">${c.telefono || '---'}</td>
            <td class="p-3 text-slate-700">${dir}</td>
            <td class="p-3 italic text-slate-400 max-w-xs truncate">${c.observaciones || '---'}</td>
            <td class="p-3 text-center space-x-1 whitespace-nowrap bg-slate-50/50">
                <button class="btn-ver-presupuestos bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded">📋 Presupuestos</button>
                <button class="btn-ver-facturas bg-blue-900 hover:bg-blue-950 text-white font-bold px-2 py-1 rounded">💵 Facturas</button>
            </td>
            <td class="p-3 text-center space-x-1 whitespace-nowrap">
                <button class="btn-editar-cli bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded">✏️ Editar</button>
            </td>
        `;

        // Acción 1: Redirigir al módulo de presupuestos filtrando por el cliente
        tr.querySelector(".btn-ver-presupuestos").onclick = () => {
            navegarA("presupuestos", { cliente_id: c.id, razonsocial: c.razonsocial });
        };

        // Acción 2: Redirigir al módulo de facturas filtrando por el cliente
        tr.querySelector(".btn-ver-facturas").onclick = () => {
            navegarA("facturas", { cliente_id: c.id, razonsocial: c.razonsocial });
        };

        // Acción 3: Editar ficha
        tr.querySelector(".btn-editar-cli").onclick = () => this.abrirModalEditar(c);

        tbody.appendChild(tr);
    });
}

    abrirModalAlta() {
        document.getElementById("modal-cliente-titulo").textContent = "➕ Alta de Nuevo Cliente";
        document.getElementById("cliente-id-input").value = "";
        document.getElementById("form-cliente").reset();
        document.getElementById("modal-cliente").classList.remove("hidden");
    },

    abrirModalEditar(c) {
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
    },

    async guardarFichaFormulario(e) {
        e.preventDefault();
        const id = document.getElementById("cliente-id-input").value;
        const rawCp = document.getElementById("c-cp").value.trim();

        // Enviar propiedades en minúsculas para coincidir exactamente con el esquema del backend
        const datos = {
            nif: document.getElementById("c-nif").value.trim(),
            razonsocial: document.getElementById("c-razonsocial").value.trim(),
            calle: document.getElementById("c-calle").value.trim() || null,
            numero: document.getElementById("c-numero").value.trim() || null,
            piso: document.getElementById("c-piso").value.trim() || null,
            poblacion: document.getElementById("c-poblacion").value.trim() || null,
            provincia: document.getElementById("c-provincia").value.trim() || null,
            cp: rawCp !== "" ? parseInt(rawCp, 10) : null,
            telefono: document.getElementById("c-telefono").value.trim() || null,
            observaciones: document.getElementById("c-observaciones").value.trim() || null
        };

        const url = id ? `http://127.0.0.1:8000/clientes/${id}` : `http://127.0.0.1:8000/clientes/`;
        const method = id ? "PUT" : "POST";

        try {
            const r = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token_taller")}` },
                body: JSON.stringify(datos)
            });
            if (!r.ok) throw new Error();
            document.getElementById("modal-cliente").classList.add("hidden");
            await this.cargarClientesServidor();
        } catch {
            alert("Error al procesar la ficha. Revisa que los campos cumplan las reglas o que el NIF no esté repetido.");
        }
    }
};