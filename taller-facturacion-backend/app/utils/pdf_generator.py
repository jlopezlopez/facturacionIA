import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generar_pdf_documento(tipo: str, cabecera: dict, cliente: dict, conceptos: list) -> io.BytesIO:
    """
    Genera un PDF en memoria para Facturas o Presupuestos.
    tipo: 'FACTURA' o 'PRESUPUESTO'
    cabecera: dict con {'numero': str, 'fecha': date, 'iva_porcentaje': float}
    cliente: dict con {'razonsocial': str, 'NIF': str, 'direccion': str, 'telefono': str}
    conceptos: lista de tuplas/dict con la información de las líneas
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # --- Estilos Personalizados ---
    style_titulo = ParagraphStyle(
        'TituloDoc',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1A365D"), # Azul corporativo oscuro
        spaceAfter=15
    )
    
    style_texto_normal = ParagraphStyle(
        'TextoNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748")
    )
    
    style_texto_negrita = ParagraphStyle(
        'TextoNegrita',
        parent=style_texto_normal,
        fontName='Helvetica-Bold'
    )

    style_tabla_cabecera = ParagraphStyle(
        'TablaCabecera',
        parent=style_texto_normal,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )

    # --- 1. CABECERA PRINCIPAL (Datos del Taller y Tipo de Documento) ---
    datos_taller = """<b>TALLER MECÁNICO S.L.</b><br/>
    Cádiz, España<br/>
    CIF: B12345678<br/>
    Teléfono: +34 600 000 000<br/>
    Email: info@tu-taller.com
    """
    
    datos_documento = f"""<b>{tipo}</b><br/><br/>
    <b>Número:</b> {cabecera['numero']}<br/>
    <b>Fecha:</b> {cabecera['fecha']}<br/>
    """
    
    tabla_top = Table(
        [[Paragraph(datos_taller, style_texto_normal), Paragraph(datos_documento, style_titulo)]], 
        colWidths=[300, 230]
    )
    tabla_top.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT')
    ]))
    story.append(tabla_top)
    story.append(Spacer(1, 20))
    
    # --- 2. DATOS DEL CLIENTE ---
    dir_cliente = f"{cliente.get('calle', '')} {cliente.get('numero', '')} {cliente.get('piso', '')}".strip()
    pob_cliente = f"{cliente.get('poblacion', '')} ({cliente.get('provincia', '')})".strip()
    
    info_cliente_html = f"""<b>CLIENTE:</b><br/>
    <b>Razón Social:</b> {cliente.get('razonsocial', 'N/A')}<br/>
    <b>NIF/DNI:</b> {cliente.get('NIF', 'N/A')}<br/>
    <b>Dirección:</b> {dir_cliente} - {pob_cliente}<br/>
    <b>Teléfono:</b> {cliente.get('telefono', 'N/A')}
    """
    
    tabla_cliente = Table([[Paragraph(info_cliente_html, style_texto_normal)]], colWidths=[530])
    tabla_cliente.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
    ]))
    story.append(tabla_cliente)
    story.append(Spacer(1, 20))
    
    # --- 3. TABLA DE CONCEPTOS (LÍNEAS DE DETALLE) ---
    # Encabezados de la tabla
    tabla_datos = [[
        Paragraph("Item", style_tabla_cabecera),
        Paragraph("Descripción", style_tabla_cabecera),
        Paragraph("Cant.", style_tabla_cabecera),
        Paragraph("Precio U.", style_tabla_cabecera),
        Paragraph("Dto. %", style_tabla_cabecera),
        Paragraph("Total", style_tabla_cabecera)
    ]]
    
    subtotal = 0.0
    
    # Agregar cada concepto del documento
    for idx, con in enumerate(conceptos, start=1):
        cant = con['cantidad']
        precio = con['preciounidad']
        dto = con['descuento']
        
        # Cálculo de totales por línea
        total_linea = (cant * precio) * (1 - (dto / 100.0))
        subtotal += total_linea
        
        tabla_datos.append([
            Paragraph(str(idx), style_texto_normal),
            Paragraph(con['descripcion'], style_texto_normal),
            Paragraph(f"{cant}", style_texto_normal),
            Paragraph(f"{precio:.2f} €", style_texto_normal),
            Paragraph(f"{dto:.1f}%", style_texto_normal),
            Paragraph(f"{total_linea:.2f} €", style_texto_normal)
        ])
    
    # Dibujar la tabla de conceptos
    t_conceptos = Table(tabla_datos, colWidths=[35, 235, 50, 70, 50, 90])
    t_conceptos.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(t_conceptos)
    story.append(Spacer(1, 15))
    
    # --- 4. BLOQUE DE TOTALES ---
    iva_porcentaje = cabecera['iva_porcentaje']
    cuota_iva = subtotal * (iva_porcentaje / 100.0)
    total_general = subtotal + cuota_iva
    
    tabla_totales_datos = [
        [Paragraph("Subtotal:", style_texto_normal), Paragraph(f"{subtotal:.2f} €", style_texto_normal)],
        [Paragraph(f"I.V.A. ({iva_porcentaje}%):", style_texto_normal), Paragraph(f"{cuota_iva:.2f} €", style_texto_normal)],
        [Paragraph("TOTAL DOCUMENTO:", style_texto_negrita), Paragraph(f"<b>{total_general:.2f} €</b>", style_texto_negrita)]
    ]
    
    t_totales = Table(tabla_totales_datos, colWidths=[120, 100])
    t_totales.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('LINEABOVE', (0,2), (1,2), 1, colors.HexColor("#1A365D")), # Línea superior sobre el Total
    ]))
    
    # Empujamos los totales al lado derecho usando otra tabla contenedora vacía a la izquierda
    t_contenedor_totales = Table([["", t_totales]], colWidths=[310, 220])
    t_contenedor_totales.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    story.append(t_contenedor_totales)
    
    # Construir documento
    doc.build(story)
    buffer.seek(0)
    return buffer