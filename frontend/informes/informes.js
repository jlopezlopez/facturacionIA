const API_URL = "http://127.0.0.1:8000";

let datosInformeActual = null;

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

    select.onchange = () => cargarInformeAnual();
}

export async function cargarInformeAnual() {
    const select = document.getElementById("select-anio-informe");
    const anio = select ? select.value : new Date().getFullYear();
    const token = localStorage.getItem("token_taller");

    if (!token) {
        console.error("No hay token de sesión activo ('token_taller').");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/informes/informe-anual?anio=${anio}`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) throw new Error(`Error en la petición: ${response.status}`);

        const data = await response.json();
        datosInformeActual = data;
        renderizarTablaInforme(data.meses);

    } catch (error) {
        console.error("Error al cargar el informe:", error);
    }
}

function renderizarTablaInforme(meses) {
    const tbody = document.getElementById("tbody-informe-anual");
    if (!tbody) return;

    tbody.innerHTML = "";

    let totalAnualBase = 0;
    let totalAnualIva = 0;
    let totalAnualConIva = 0;

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
            qBase += m.base;
            qIva += m.iva;
            qTotal += m.total;
            qFacturas += m.facturas;

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

    document.getElementById("total-anual-base").innerText = `${totalAnualBase.toFixed(2)} €`;
    document.getElementById("total-anual-iva").innerText = `${totalAnualIva.toFixed(2)} €`;
    document.getElementById("total-anual-con-iva").innerText = `${totalAnualConIva.toFixed(2)} €`;
}

export function exportarExcel() {
    if (!datosInformeActual || !datosInformeActual.meses) return alert("No hay datos cargados.");
    if (typeof XLSX === "undefined") return alert("Cargando librería Excel, reintenta en un momento...");

    const filasExcel = [["Mes", "Nº Facturas", "Base Imponible (€)", "IVA (€)", "Total (€)"]];
    const meses = datosInformeActual.meses;
    const trimestres = [
        { nombre: "TRIMESTRE 1 (Q1)", meses: meses.slice(0, 3) },
        { nombre: "TRIMESTRE 2 (Q2)", meses: meses.slice(3, 6) },
        { nombre: "TRIMESTRE 3 (Q3)", meses: meses.slice(6, 9) },
        { nombre: "TRIMESTRE 4 (Q4)", meses: meses.slice(9, 12) }
    ];

    let totalAnualBase = 0, totalAnualIva = 0, totalAnualConIva = 0, totalAnualFacturas = 0;

    trimestres.forEach(t => {
        let qBase = 0, qIva = 0, qTotal = 0, qFacturas = 0;
        filasExcel.push([`--- ${t.nombre} ---`, "", "", "", ""]);

        t.meses.forEach(m => {
            qBase += m.base; qIva += m.iva; qTotal += m.total; qFacturas += m.facturas;
            filasExcel.push([m.nombre, m.facturas, m.base, m.iva, m.total]);
        });

        filasExcel.push([`TOTAL ${t.nombre}`, qFacturas, qBase, qIva, qTotal]);
        filasExcel.push([]);

        totalAnualBase += qBase; totalAnualIva += qIva; totalAnualConIva += qTotal; totalAnualFacturas += qFacturas;
    });

    filasExcel.push(["RESUMEN ANUAL TOTAL", totalAnualFacturas, totalAnualBase, totalAnualIva, totalAnualConIva]);

    const worksheet = XLSX.utils.aoa_to_sheet(filasExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Informe_${datosInformeActual.anio}`);
    XLSX.writeFile(workbook, `Informe_Facturacion_${datosInformeActual.anio}.xlsx`);
}

export function exportarPDF() {
    const contenedorTabla = document.getElementById("contenedor-informe-anual");
    if (!contenedorTabla) return alert("No se encontró la tabla.");
    if (typeof html2pdf === "undefined") return alert("Cargando librería PDF, reintenta en un momento...");

    const select = document.getElementById("select-anio-informe");
    const anio = select ? select.value : new Date().getFullYear();

    html2pdf().set({
        margin: 10,
        filename: `Informe_Facturacion_${anio}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(contenedorTabla).save();
}

export async function inicializarModuloInformes() {
    inicializarSelectorAnios();

    const btnExcel = document.getElementById("btn-exportar-excel");
    if (btnExcel) btnExcel.onclick = exportarExcel;

    const btnPdf = document.getElementById("btn-exportar-pdf");
    if (btnPdf) btnPdf.onclick = exportarPDF;

    await cargarInformeAnual();
}