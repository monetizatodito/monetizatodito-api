#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

def size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except Exception:
        return 0

def run(cmd: list[str]) -> None:
    # Fail fast with helpful stderr
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or f"Command failed: {' '.join(cmd)}")

def gs_with_options(inp: str, outp: str, dpi: int, jpegq: int, grayscale: bool) -> None:
    args = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        "-dAutoRotatePages=/None",

        # Downsampling
        "-dDownsampleColorImages=true",
        "-dDownsampleGrayImages=true",
        "-dDownsampleMonoImages=true",
        "-dColorImageDownsampleType=/Average",
        "-dGrayImageDownsampleType=/Average",
        "-dMonoImageDownsampleType=/Subsample",
        f"-dColorImageResolution={dpi}",
        f"-dGrayImageResolution={dpi}",
        f"-dMonoImageResolution={dpi}",

        # JPEG encode (forzar)
        "-dAutoFilterColorImages=false",
        "-dAutoFilterGrayImages=false",
        "-dEncodeColorImages=true",
        "-dEncodeGrayImages=true",
        "-dColorImageFilter=/DCTEncode",
        "-dGrayImageFilter=/DCTEncode",
        f"-dJPEGQ={jpegq}",
    ]

    if grayscale:
        args += ["-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray"]

    args += [
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        f"-sOutputFile={outp}",
        inp
    ]
    run(args)

def gs_preset(inp: str, outp: str, preset: str) -> None:
    run([
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS=/{preset}",
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        f"-sOutputFile={outp}",
        inp
    ])

def qpdf_linearize(inp: str, outp: str) -> None:
    run(["qpdf", "--linearize", inp, outp])

def compress_to_target(inp: str, out_final: str, target_kb: int) -> None:
    """ Búsqueda en DPI+JPEGQ. Selecciona el más cercano al target
        (preferencia <= target; si no hay, el menor > target). """
    target_bytes = max(1024, int(target_kb) * 1024)
    orig = size(inp)

    # Si ya es menor/igual, no inflar.
    if orig <= target_bytes:
        shutil.copyfile(inp, out_final)
        return

    dpis = [144, 120, 96, 84, 72, 64, 56, 48]
    best_under = None  # (path, size)
    best_over  = None  # (path, size)

    with tempfile.TemporaryDirectory() as td:
        for dpi in dpis:
            lo, hi = 30, 92
            for _ in range(6):  # ~6 iteraciones basta
                mid = (lo + hi) // 2
                outp = os.path.join(td, f"dpi{dpi}-q{mid}.pdf")
                try:
                    gs_with_options(inp, outp, dpi=dpi, jpegq=mid, grayscale=False)
                    s = size(outp)
                    if s <= target_bytes:
                        if not best_under or s > best_under[1]:
                            best_under = (outp, s)
                        lo = mid + 1
                    else:
                        if not best_over or s < best_over[1]:
                            best_over = (outp, s)
                        hi = mid - 1
                except Exception:
                    hi = mid - 1

        chosen = best_under if best_under else best_over
        if not chosen:
            # último recurso: preset 'ebook'
            tmp = os.path.join(td, "fallback.pdf")
            gs_preset(inp, tmp, "ebook")
            shutil.copyfile(tmp, out_final)
            return

        shutil.copyfile(chosen[0], out_final)

def main():
    ap = argparse.ArgumentParser(description="PDF compressor (Ghostscript + qpdf)")
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--preset", choices=["screen","ebook","printer","prepress","default"])
    ap.add_argument("--target-kb", type=int)
    ap.add_argument("--profile", choices=["high","recommended","smallest","custom"])
    ap.add_argument("--dpi", type=int, default=72)
    ap.add_argument("--q", type=int, default=40)
    ap.add_argument("--grayscale", action="store_true")
    ap.add_argument("--linearize", action="store_true")

    args = ap.parse_args()
    inp  = os.path.abspath(args.input)
    outp = os.path.abspath(args.output)

    os.makedirs(os.path.dirname(outp), exist_ok=True)

    # Decide estrategia
    tmp_out = outp + ".tmp.pdf"
    orig_sz = size(inp)

    try:
        if args.target_kb:
            compress_to_target(inp, tmp_out, args.target_kb)

        elif args.profile:
            # Mapas de perfiles (objetivos aproximados como fracción del original)
            # high ≈ 85%, recommended ≈ 50% (closest), smallest ≈ 40% (under/aggresive)
            if args.profile == "custom":
                gs_with_options(inp, tmp_out, dpi=args.dpi, jpegq=args.q, grayscale=args.grayscale)
            else:
                target_factor = {"high": 0.85, "recommended": 0.50, "smallest": 0.40}[args.profile]
                target_kb = max(1, int((orig_sz * target_factor) / 1024))
                compress_to_target(inp, tmp_out, target_kb)

        elif args.preset:
            gs_preset(inp, tmp_out, args.preset)

        else:
            # Fallback recomendado
            compress_to_target(inp, tmp_out, int(max(1, orig_sz*0.5/1024)))

        # Linealizar (a veces raspa 0.5–5%)
        if args.linearize:
            qpdf_linearize(tmp_out, outp)
        else:
            shutil.copyfile(tmp_out, outp)

        final_sz = size(outp)
        # No inflar: si quedó mayor que el original, entrega el original
        if final_sz >= orig_sz:
            shutil.copyfile(inp, outp)
            final_sz = orig_sz

        # Métricas a stdout (por si quieres registrarlas)
        info = {
            "original": orig_sz,
            "final": final_sz,
            "ratio": round(final_sz / orig_sz, 6) if orig_sz else 1.0,
            "saved": orig_sz - final_sz
        }
        print(json.dumps(info))

    finally:
        # Limpia temporales
        try:
            if os.path.exists(tmp_out):
                os.remove(tmp_out)
        except Exception:
            pass

if __name__ == "__main__":
    sys.exit(main())
