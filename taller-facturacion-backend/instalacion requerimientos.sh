# Crear entorno virtual
python -m venv venv

# Activar el entorno (En Windows: venv\Scripts\activate)
source venv/bin/activate

uvicorn app.main:app --reload

# Instalar dependencias
pip install -r requirements.txt