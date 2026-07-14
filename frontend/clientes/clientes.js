let clientes = [];
let campoOrden = "id";
let direccion = "desc";

export async function inicializar(parametro) {
    await cargarDatos();
    
    document.getElementById("th-id").onclick = () => alternarOrden("id");
    document.getElementById("th-razon").onclick = () => alternarOrden("razonsocial");
    document.getElementById("btn-nuevo-cliente").onclick = () => mostrarModalNuevo();
    
    // Vincular envío de formulario, cancelaciones, etc.
}

async function cargarDatos() {
    const r = await fetch("http://127.0.0.1:8000/clientes/", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token_taller")}` }
    });
    clientes = await r.json();
    pintarTabla();
}

function alternarOrden(campo) {
    if(campoOrden === campo) direccion = direccion === "asc" ? "desc" : "asc";
    else { campoOrden = campo; direccion = "asc"; }
    pintarTabla();
}

function pintarTabla() {
    // Código de ordenación .sort()
    const tbody = document.getElementById("tbody-clientes");
    tbody.innerHTML = "";
    
    clientes.forEach(c => {
        // Formateo de dirección ...
        const dir = `${c.calle || ''} ${c.numero || ''} (${c.poblacion || ''}) (${c.cp || c.CP || ''})`;
        
        // Crear fila
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="p-3 font-bold">#${c.id}</td>
            <td class="p-3 font-semibold">${c.razonsocial}</td>
            <td class="p-3 font-mono text-xs">${c.NIF}</td>
            <td class="p-3 text-xs">${c.telefono || '---'}</td>
            <td class="p-3 text-xs">${dir}</td>
            <td class="p-3 text-xs italic">${c.observaciones || '---'}</td>
            <td class="p-3 text-center space-x-1 whitespace-nowrap">
                <button class="btn-docs bg-blue-900 text-white text-xs px-2 py-1 rounded">👁️ Ver Facturas</button>
                <button class="bg-slate-100 text-xs px-2 py-1 rounded">✏️ Editar</button>
            </td>
        `;
        
        // ¡ESTA ES LA CLAVE DE LA NUEVA NAVEGACIÓN!
        // Al pulsar "Ver Facturas", viajamos al módulo de facturas pasando el ID del cliente seleccionado
        tr.querySelector(".btn-docs").onclick = () => {
            window.navegarA("facturas", { filtrarClienteId: c.id, nombre: c.razonsocial });
        };
        
        tbody.appendChild(tr);
    });
}

function mostrarModalNuevo() { /* ... */ }