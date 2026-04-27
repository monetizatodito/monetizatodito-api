# avtivar el entorno virtual

source venv/bin/activate

# arrancar pm3 con el archico .sh congigurado

pm2 start ./start-app.sh --name api-mosanmultiverso

# elimir venv del disco

# este es un archivo simbolico que hice para elecutar las actualizaciones delm repo

ln -s /root/scripts/deploy-api-mosan.sh /usr/local/bin/deploy-api

# actualizo mi vm con

deploy-api

# archivo start-app.sh

#vamos hacer un cambio

source /root/api-mosanmultiverso/venv/bin/activate
node /root/api-mosanmultiverso/dist/app.js

# NO ME ESTA COGIENDO EL ARCHIVO TXT

# tener en cuenta eso

# Markdown → PDF Pro (Next.js 15 + Express + Shiki/Puppeteer + Python/Pandoc)

Herramienta profesional para convertir **Markdown** a **PDF** con:

- **Previsualización en vivo** (Shiki)
- **Editor Monaco** (VSCode en el navegador)
- **Temas**: github-dark/light, monokai, dracula, nord
- **Portada (título/autor/fecha/logo opcional)**
- **TOC (índice)**, **numeración de páginas**, tamaño y márgenes
- **Dos motores**: rápido (Shiki→Puppeteer) y editorial (Pandoc/LaTeX)

## Estructura

pdf2docx==0.5.8
PyPDF2==3.0.1
pypandoc==1.11

requirements.txt

# inatalar esto en el serividor para que funcione comprimir pdf

sudo apt-get update
sudo apt-get install -y ghostscript

# inatalar esto en el serividor para que funcione word apdf

RUN apt-get update && \
 apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer libreoffice-calc \
 fonts-dejavu-core fonts-liberation ca-certificates && \
 rm -rf /var/lib/apt/lists/\*

docker exec -i api-mosan-multiverso-db bash -lc "psql -h localhost -p 5432 -U mosanmultiverso -d db_mosan_multiverso" <<'SQL'
SET client_min_messages TO WARNING;
SET session_replication_role = replica;

DROP TABLE IF EXISTS diagnostic_question_post CASCADE;
DROP TABLE IF EXISTS article_feedback CASCADE;
DROP TABLE IF EXISTS telemetry_event CASCADE;
DROP TABLE IF EXISTS decision_tree CASCADE;
DROP TABLE IF EXISTS article_step CASCADE;
DROP TABLE IF EXISTS diagnostic_article CASCADE;
DROP TABLE IF EXISTS diagnostic_question_tag CASCADE;
DROP TABLE IF EXISTS tag CASCADE;
DROP TABLE IF EXISTS model CASCADE;
DROP TABLE IF EXISTS brand CASCADE;
DROP TABLE IF EXISTS component_spec CASCADE;
DROP TABLE IF EXISTS fridge_type CASCADE;
DROP TABLE IF EXISTS diagnostic_question CASCADE;

SET session_replication_role = DEFAULT;
SQL
