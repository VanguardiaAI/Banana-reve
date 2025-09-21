# Backend de Persistencia para Banana Reve

## Instalación

1. Instalar Python 3.8 o superior
2. Ejecutar el script de inicio:
   ```bash
   ./start-backend.sh
   ```

## Uso

El backend se ejecuta en http://localhost:8000 y proporciona los siguientes endpoints:

### Álbumes
- `GET /api/albums` - Listar todos los álbumes
- `POST /api/albums` - Crear nuevo álbum
- `GET /api/albums/{id}` - Obtener álbum específico
- `PUT /api/albums/{id}` - Actualizar álbum
- `DELETE /api/albums/{id}` - Eliminar álbum

### Imágenes
- `POST /api/images/upload` - Subir imagen desde archivo
- `POST /api/images/base64` - Guardar imagen desde base64
- `GET /api/images/{filename}` - Obtener imagen

## Estructura de archivos

- Las imágenes se guardan en `/backend/uploads/`
- Los metadatos de álbumes se guardan en `/backend/data/albums.json`

## Iniciar frontend y backend

Para ejecutar la aplicación completa:

1. En una terminal, iniciar el backend:
   ```bash
   ./start-backend.sh
   ```

2. En otra terminal, iniciar el frontend:
   ```bash
   npm install
   npm run dev
   ```

El frontend estará disponible en http://localhost:5173 y se comunicará automáticamente con el backend.