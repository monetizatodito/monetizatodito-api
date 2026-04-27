# convertir_pdf_a_word.py
from pdf2docx import Converter
import sys

def convertir_pdf_a_word(pdf_path, word_path):
    cv = Converter(pdf_path)
    cv.convert(word_path, start=0, end=None)
    cv.close()

if __name__ == "__main__":
    pdf_file = sys.argv[1]
    word_file = sys.argv[2]
    convertir_pdf_a_word(pdf_file, word_file)
    print("Conversión completada.")
