from pydantic import BaseModel
from typing import List
from datetime import date

# Para el resumen general del mes
class ResumenMesResponse(BaseModel):
    mes_actual: str
    total_facturado_sin_iva: float
    total_facturado_con_iva: float
    facturas_emitidas: int

# Para saber qué presupuestos de estructuras/cerramientos siguen pendientes
class PresupuestosPendientesResponse(BaseModel):
    total_presupuestos_pendientes: int
    importe_estimado_sin_iva: float

# Estructura compacta para listar documentos de un cliente específico
class DocumentoCorto(BaseModel):
    id: int
    numero: str
    fecha: date
    total_sin_iva: float
    estado: str # 'Pagado'/'Pendiente' para facturas, 'Aceptado'/'Pendiente' para presupuestos