# convertir_word_a_pdf.py
import sys
import subprocess
import os

def convertir_word_a_pdf(input_path, output_path):
    # Crea el dir de salida si no existe
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # LibreOffice escribe el PDF en --outdir, el nombre sale del baseName
    outdir = os.path.dirname(output_path)
    # Nota: respetamos mayúsculas/minúsculas de Linux
    cmd = [
        "libreoffice",
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to", "pdf",
        "--outdir", outdir,
        input_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice error: {result.stderr}")

    # Construye el nombre esperado
    base = os.path.splitext(os.path.basename(input_path))[0]
    generated_pdf = os.path.join(outdir, f"{base}.pdf")

    if not os.path.exists(generated_pdf):
        raise FileNotFoundError(f"No se generó el PDF: {generated_pdf}")

    # Si el nombre deseado difiere (por ejemplo, quieres un nombre limpio):
    if os.path.abspath(generated_pdf) != os.path.abspath(output_path):
        # renombra
        if os.path.exists(output_path):
            os.remove(output_path)
        os.replace(generated_pdf, output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python convertir_word_a_pdf.py <input_path> <output_path>")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2]
    convertir_word_a_pdf(inp, out)
    print("Conversión a PDF completada.")
