#!/usr/bin/env python3
import sys
import os
import pypandoc

def main():
    if len(sys.argv) < 3:
        print("Uso: convert_md_to_pdf.py IN.md OUT.pdf [flags...]", file=sys.stderr)
        sys.exit(1)

    in_md = sys.argv[1]
    out_pdf = sys.argv[2]
    args = sys.argv[3:]

    # defaults
    title = ''
    author = ''
    date = ''
    pagesize = 'A4'
    marginTop = '18mm'
    marginRight = '14mm'
    marginBottom = '18mm'
    marginLeft = '14mm'
    toc = True
    highlight = 'monokai'

    # watermark defaults (NUEVO)
    wm_path = ''      # ruta absoluta o relativa a la imagen (PNG/JPG)
    wm_width = '0.70' # fracción del ancho de página (0.0–1.0)
    wm_angle = '-25'  # grados de rotación

    # parse flags
    it = iter(args)
    for a in it:
        if a == '--title':
            title = next(it, '')
        elif a == '--author':
            author = next(it, '')
        elif a == '--date':
            date = next(it, '')
        elif a == '--pagesize':
            pagesize = next(it, 'A4')
        elif a == '--marginTop':
            marginTop = next(it, '18mm')
        elif a == '--marginRight':
            marginRight = next(it, '14mm')
        elif a == '--marginBottom':
            marginBottom = next(it, '18mm')
        elif a == '--marginLeft':
            marginLeft = next(it, '14mm')
        elif a == '--toc':
            toc = (next(it, 'true').lower() == 'true')
        elif a == '--highlight':
            highlight = next(it, 'monokai')
        # ---- NUEVO: watermark ----
        elif a == '--wmPath':
            wm_path = next(it, '')
        elif a == '--wmWidth':
            wm_width = next(it, '0.70')
        elif a == '--wmAngle':
            wm_angle = next(it, '-25')

    meta = []
    if title: meta += ['-V', f'title={title}']
    if author: meta += ['-V', f'author={author}']
    if date: meta += ['-V', f'date={date}']

    extra = [
        '--standalone',
        '--pdf-engine=xelatex',
        f'--highlight-style={highlight}',
        '-V', f'geometry:margin={marginTop} {marginRight} {marginBottom} {marginLeft}',
    ]
    if toc:
        extra += ['--toc', '--toc-depth=3']

    # pagesize
    if pagesize.lower() == 'letter':
        extra += ['-V', 'papersize=letter']
    else:
        extra += ['-V', 'papersize=a4']

    # header LaTeX para watermark (si se proporciona imagen)
    if wm_path:
        header_path = os.path.join(os.path.dirname(__file__), 'header_wm.tex')
        extra += [
            '-H', header_path,
            '-V', f'wmpath={wm_path}',
            '-V', f'wmwidth={wm_width}',
            '-V', f'wmangle={wm_angle}',
        ]

    try:
        pypandoc.convert_file(
            in_md,
            to='pdf',
            format='md',
            outputfile=out_pdf,
            extra_args=extra + meta
        )
    except RuntimeError as e:
        sys.stderr.write(str(e))
        sys.exit(2)

if __name__ == '__main__':
    main()
