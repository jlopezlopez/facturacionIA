const API_URL = "http://127.0.0.1:8000";

let datosInformeActual = null;
let modoInformeActual = "mensual"; // 'mensual' o 'clientes'

export function inicializarSelectorAnios() {
    const select = document.getElementById("select-anio-informe");
    if (!select) return;

    const anioActual = new Date().getFullYear();
    select.innerHTML = "";

    for (let i = anioActual; i >= anioActual - 5; i--) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        if (i === anioActual) option.selected = true;
        select.appendChild(option);
    }

    select.onchange = () => cargarInformeSegunModo();
}

export function cambiarModoInforme(modo) {
    modoInformeActual = modo;
    const btnMensual = document.getElementById("btn-tab-mensual");
    const btnClientes = document.getElementById("btn-tab-clientes");
    const contMensual = document.getElementById("contenedor-informe-anual");
    const contClientes = document.getElementById("contenedor-informe-clientes");
    const titulo = document.getElementById("titulo-informe");
    const subtitulo = document.getElementById("subtitulo-informe");

    if (modo === "mensual") {
        btnMensual.className = "px-3 py-1.5 text-xs font-bold rounded-md bg-white text-blue-900 shadow-sm";
        btnClientes.className = "px-3 py-1.5 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900";
        contMensual.classList.remove("hidden");
        contClientes.classList.add("hidden");
        titulo.innerText = "Informe Anual de Facturación";
        subtitulo.innerText = "Resumen trimestral y desglose mensual de ingresos";
    } else {
        btnClientes.className = "px-3 py-1.5 text-xs font-bold rounded-md bg-white text-blue-900 shadow-sm";
        btnMensual.className = "px-3 py-1.5 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900";
        contClientes.classList.remove("hidden");
        contMensual.classList.add("hidden");
        titulo.innerText = "Informe de Facturación por Cliente";
        subtitulo.innerText = "Desglose acumulado de facturas emitidas por cliente";
    }

    cargarInformeSegunModo();
}

function cargarInformeSegunModo() {
    if (modoInformeActual === "mensual") {
        cargarInformeAnual();
    } else {
        cargarInformeClientes();
    }
}

export async function cargarInformeAnual() {
    const select = document.getElementById("select-anio-informe");
    const anio = select ? select.value : new Date().getFullYear();
    const token = localStorage.getItem("token_taller");

    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/informes/informe-anual?anio=${anio}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const data = await response.json();
        datosInformeActual = data;
        renderizarTablaInforme(data.meses);
    } catch (error) {
        console.error("Error al cargar informe anual:", error);
    }
}

export async function cargarInformeClientes() {
    const select = document.getElementById("select-anio-informe");
    const anio = select ? select.value : new Date().getFullYear();
    const token = localStorage.getItem("token_taller");

    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/informes/informe-clientes?anio=${anio}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const data = await response.json();
        datosInformeActual = data;
        renderizarTablaClientes(data.clientes);
    } catch (error) {
        console.error("Error al cargar informe por clientes:", error);
    }
}

function renderizarTablaInforme(meses) {
    const tbody = document.getElementById("tbody-informe-anual");
    if (!tbody) return;
    tbody.innerHTML = "";

    let totalAnualBase = 0, totalAnualIva = 0, totalAnualConIva = 0;

    const trimestres = [
        { nombre: "TRIMESTRE 1 (Q1)", meses: meses.slice(0, 3) },
        { nombre: "TRIMESTRE 2 (Q2)", meses: meses.slice(3, 6) },
        { nombre: "TRIMESTRE 3 (Q3)", meses: meses.slice(6, 9) },
        { nombre: "TRIMESTRE 4 (Q4)", meses: meses.slice(9, 12) }
    ];

    trimestres.forEach(t => {
        let qBase = 0, qIva = 0, qTotal = 0, qFacturas = 0;

        const trHeader = document.createElement("tr");
        trHeader.className = "bg-slate-200/60 font-black text-slate-700 uppercase text-xs";
        trHeader.innerHTML = `<td colspan="5" class="p-2.5 pl-4 tracking-wider">${t.nombre}</td>`;
        tbody.appendChild(trHeader);

        t.meses.forEach(m => {
            qBase += m.base; qIva += m.iva; qTotal += m.total; qFacturas += m.facturas;

            const trMes = document.createElement("tr");
            trMes.className = "border-b border-slate-100 hover:bg-slate-50 transition";
            trMes.innerHTML = `
                <td class="p-3 pl-6 font-medium text-slate-800">${m.nombre}</td>
                <td class="p-3 text-center text-slate-500">${m.facturas}</td>
                <td class="p-3 text-right font-mono text-slate-700">${m.base.toFixed(2)} €</td>
                <td class="p-3 text-right font-mono text-slate-500">${m.iva.toFixed(2)} €</td>
                <td class="p-3 text-right font-mono font-bold text-slate-900">${m.total.toFixed(2)} €</td>
            `;
            tbody.appendChild(trMes);
        });

        const trTotalQ = document.createElement("tr");
        trTotalQ.className = "bg-blue-50/70 border-b-2 border-slate-200 font-bold text-blue-950";
        trTotalQ.innerHTML = `
            <td class="p-3 pl-4">TOTAL ${t.nombre}</td>
            <td class="p-3 text-center">${qFacturas}</td>
            <td class="p-3 text-right font-mono">${qBase.toFixed(2)} €</td>
            <td class="p-3 text-right font-mono">${qIva.toFixed(2)} €</td>
            <td class="p-3 text-right font-mono text-blue-700">${qTotal.toFixed(2)} €</td>
        `;
        tbody.appendChild(trTotalQ);

        totalAnualBase += qBase;
        totalAnualIva += qIva;
        totalAnualConIva += qTotal;
    });

    actualizarTarjetasGlobales(totalAnualBase, totalAnualIva, totalAnualConIva);
}

function renderizarTablaClientes(clientes) {
    const tbody = document.getElementById("tbody-informe-clientes");
    if (!tbody) return;
    tbody.innerHTML = "";

    let totalAnualBase = 0, totalAnualIva = 0, totalAnualConIva = 0;

    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">No hay facturas registradas en este año.</td></tr>`;
        actualizarTarjetasGlobales(0, 0, 0);
        return;
    }

    clientes.forEach(c => {
        totalAnualBase += c.base;
        totalAnualIva += c.iva;
        totalAnualConIva += c.total;

        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${c.razonsocial}</td>
            <td class="p-3 font-mono text-slate-500 text-xs">${c.nif}</td>
            <td class="p-3 text-center text-slate-600">${c.facturas}</td>
            <td class="p-3 text-right font-mono text-slate-700">${c.base.toFixed(2)} €</td>
            <td class="p-3 text-right font-mono text-slate-500">${c.iva.toFixed(2)} €</td>
            <td class="p-3 text-right font-mono font-bold text-emerald-700">${c.total.toFixed(2)} €</td>
        `;
        tbody.appendChild(tr);
    });

    actualizarTarjetasGlobales(totalAnualBase, totalAnualIva, totalAnualConIva);
}

function actualizarTarjetasGlobales(base, iva, total) {
    document.getElementById("total-anual-base").innerText = `${base.toFixed(2)} €`;
    document.getElementById("total-anual-iva").innerText = `${iva.toFixed(2)} €`;
    document.getElementById("total-anual-con-iva").innerText = `${total.toFixed(2)} €`;
}

export function exportarExcel() {
    if (!datosInformeActual) return alert("No hay datos cargados.");
    if (typeof XLSX === "undefined") return alert("Cargando librería Excel...");

    const anio = datosInformeActual.anio;

    if (modoInformeActual === "mensual") {
        // Exportación mensual
        const filasExcel = [["Mes", "Nº Facturas", "Base Imponible (€)", "IVA (€)", "Total (€)"]];
        datosInformeActual.meses.forEach(m => filasExcel.push([m.nombre, m.facturas, m.base, m.iva, m.total]));
        const ws = XLSX.utils.aoa_to_sheet(filasExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Informe_${anio}`);
        XLSX.writeFile(wb, `Informe_Facturacion_${anio}.xlsx`);
    } else {
        // Exportación por clientes
        const filasExcel = [["Cliente / Razón Social", "NIF", "Nº Facturas", "Base Imponible (€)", "IVA (€)", "Total Facturado (€)"]];
        datosInformeActual.clientes.forEach(c => filasExcel.push([c.razonsocial, c.nif, c.facturas, c.base, c.iva, c.total]));
        const ws = XLSX.utils.aoa_to_sheet(filasExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Clientes_${anio}`);
        XLSX.writeFile(wb, `Informe_Clientes_${anio}.xlsx`);
    }
}

export function exportarPDF() {
    const contenedor = modoInformeActual === "mensual" 
        ? document.getElementById("contenedor-informe-anual") 
        : document.getElementById("contenedor-informe-clientes");

    if (!contenedor) return alert("No se encontró la tabla.");
    if (typeof html2pdf === "undefined") return alert("Cargando librería PDF...");

    const select = document.getElementById("select-anio-informe");
    const anio = select ? select.value : new Date().getFullYear();

    html2pdf().set({
        margin: 10,
        filename: `Informe_${modoInformeActual}_${anio}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(contenedor).save();
}

export async function inicializarModuloInformes(parametros = null) {
    inicializarSelectorAnios();

    // Asignación de eventos a los botones de la vista
    const btnMensual = document.getElementById("btn-tab-mensual");
    if (btnMensual) btnMensual.onclick = () => cambiarModoInforme("mensual");

    const btnClientes = document.getElementById("btn-tab-clientes");
    if (btnClientes) btnClientes.onclick = () => cambiarModoInforme("clientes");

    const btnExcel = document.getElementById("btn-exportar-excel");
    if (btnExcel) btnExcel.onclick = exportarExcel;

    const btnPdf = document.getElementById("btn-exportar-pdf");
    if (btnPdf) btnPdf.onclick = exportarPDF;

    // Detectamos si se solicitó un modo específico desde app.js (ej: 'clientes' o 'mensual')
    const modoInicial = (parametros && parametros.modo) ? parametros.modo : "mensual";
    
    // Cambiamos la pestaña y cargamos los datos correspondientes
    cambiarModoInforme(modoInicial);
}