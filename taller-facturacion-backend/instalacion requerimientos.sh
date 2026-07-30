# Crear entorno virtual
python -m venv venv

# Activar el entorno (En Windows: venv\Scripts\activate)
source venv/bin/activate

#uvicorn app.main:app --reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Instalar dependencias
pip install -r requirements.txt