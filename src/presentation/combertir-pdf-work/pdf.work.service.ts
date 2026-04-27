import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export class ConvertPdfWordService {
  async convertirPdfAWord(inputPath: string, outputDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfFileName = path.basename(inputPath, path.extname(inputPath)); // Nombre sin extensión
      const odtPath = path.join(outputDir, `${pdfFileName}.odt`);
      const docxPath = path.join(outputDir, `${pdfFileName}.docx`);

      // Paso 1: PDF → ODT
      const convertToOdtCommand = `libreoffice --headless --convert-to odt "${inputPath}" --outdir "${outputDir}"`;
      console.log('Ejecutando comando para ODT:', convertToOdtCommand);

      exec(convertToOdtCommand, (errorOdt, stdoutOdt, stderrOdt) => {
        console.log('STDOUT ODT:', stdoutOdt);
        console.log('STDERR ODT:', stderrOdt);

        if (errorOdt) {
          console.error('Error convirtiendo a ODT:', errorOdt);
          return reject(new Error('Error al convertir PDF a ODT.'));
        }

        if (!fs.existsSync(odtPath)) {
          console.error('Archivo ODT no encontrado:', odtPath);
          return reject(new Error('No se generó el archivo ODT.'));
        }

        // Paso 2: ODT → DOCX
        const convertToDocxCommand = `libreoffice --headless --convert-to docx "${odtPath}" --outdir "${outputDir}"`;
        console.log('Ejecutando comando para DOCX:', convertToDocxCommand);

        exec(convertToDocxCommand, (errorDocx, stdoutDocx, stderrDocx) => {
          console.log('STDOUT DOCX:', stdoutDocx);
          console.log('STDERR DOCX:', stderrDocx);

          if (errorDocx) {
            console.error('Error convirtiendo a DOCX:', errorDocx);
            return reject(new Error('Error al convertir ODT a DOCX.'));
          }

          if (!fs.existsSync(docxPath)) {
            console.error('Archivo DOCX no encontrado:', docxPath);
            return reject(new Error('No se generó el archivo DOCX.'));
          }

          // Opcional: Borrar el ODT temporal
          fs.unlinkSync(odtPath);

          console.log('Conversión exitosa, archivo generado en:', docxPath);
          resolve(docxPath);
        });
      });
    });
  }
}
