#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/extract_word_catalogs.py
Engenharia Reversa de Documentos Microsoft Word (.doc OLE2 e .docx OpenXML)
Especializada para Catálogos de Balcão de Cilindros e Contatos de Ignição.
"""

from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import docx

# Add scripts directory to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from webp_studio_converter import convert_bytes_to_studio_webp

CONVERTED_DOCX_DIR = SCRIPT_DIR / ".converted_docx"
PUBLIC_IMAGES_DIR = PROJECT_ROOT / "public" / "catalog-images" / "ignicao"
OUTPUT_SEED_JSON = PROJECT_ROOT / "src" / "data" / "catalog-master-seed.json"


def is_ole2_doc(file_path: Path) -> bool:
    """Verifica magic bytes D0 CF 11 E0 (OLE2/CFBF)."""
    try:
        with open(file_path, "rb") as f:
            header = f.read(4)
            return header == b"\xd0\xcf\x11\xe0"
    except Exception:
        return False


def is_zip_docx(file_path: Path) -> bool:
    """Verifica magic bytes 50 4B 03 04 (ZIP/OpenXML)."""
    try:
        with open(file_path, "rb") as f:
            header = f.read(4)
            return header == b"\x50\x4b\x03\x04"
    except Exception:
        return False


def convert_doc_to_docx_windows(doc_path: Path, output_docx_path: Path) -> bool:
    """
    Converte arquivo .doc binário para .docx via Microsoft Word COM ou fallback.
    """
    output_docx_path.parent.mkdir(parents=True, exist_ok=True)
    doc_path_abs = str(doc_path.resolve())
    out_path_abs = str(output_docx_path.resolve())

    # 1º Cascata: win32com.client Word.Application
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False
        doc = word.Documents.Open(doc_path_abs, ReadOnly=True)
        # wdFormatXMLDocument = 16
        doc.SaveAs2(out_path_abs, FileFormat=16)
        doc.Close(False)
        word.Quit()
        if output_docx_path.exists() and output_docx_path.stat().st_size > 0:
            print(f"[*] Convertido via Word COM: {output_docx_path.name} ({output_docx_path.stat().st_size} bytes)")
            return True
    except Exception as e:
        print(f"[!] Falha no Word COM ({e}), tentando PowerShell...")

    # 2º Cascata: PowerShell Word COM
    try:
        ps_cmd = (
            f"$w = New-Object -ComObject Word.Application; "
            f"$w.Visible = $false; $w.DisplayAlerts = $false; "
            f"$d = $w.Documents.Open('{doc_path_abs}', $true); "
            f"$d.SaveAs2('{out_path_abs}', 16); "
            f"$d.Close($false); $w.Quit()"
        )
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=30)
        if output_docx_path.exists() and output_docx_path.stat().st_size > 0:
            print(f"[*] Convertido via PowerShell COM: {output_docx_path.name}")
            return True
    except Exception as e:
        print(f"[!] Falha no PowerShell COM ({e})")

    # 3º Cascata: LibreOffice headless
    try:
        soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
        if soffice_bin:
            subprocess.run(
                [soffice_bin, "--headless", "--convert-to", "docx", doc_path_abs, "--outdir", str(output_docx_path.parent)],
                check=True, timeout=60
            )
            converted = output_docx_path.parent / (doc_path.stem + ".docx")
            if converted.exists():
                if converted != output_docx_path:
                    shutil.move(str(converted), str(output_docx_path))
                print(f"[*] Convertido via LibreOffice: {output_docx_path.name}")
                return True
    except Exception as e:
        print(f"[!] Falha no LibreOffice ({e})")

    return False


def clean_box_number(raw_cx: str) -> Tuple[str, str]:
    """
    Extrai boxNumber e internalCode da coluna CX.
    Exemplo:
      '28' -> ('28', '')
      '01' -> ('01', '')
      '67 \n\n 2430' -> ('67', '2430')
      'Cx 10' -> ('10', '')
    """
    lines = [l.strip() for l in raw_cx.splitlines() if l.strip()]
    if not lines:
        return "", ""
    first = lines[0]
    first_clean = re.sub(r"^(?:cx\.?|caixa)\s*", "", first, flags=re.IGNORECASE).strip()
    
    internal = ""
    if len(lines) > 1:
        # Linha subsequente pode ser código interno
        internal = " ".join(lines[1:]).strip()
    elif "/" in first_clean and not re.search(r"[a-zA-Z]", first_clean):
        parts = [p.strip() for p in first_clean.split("/")]
        first_clean = parts[0]
        if len(parts) > 1:
            internal = parts[1]

    return first_clean, internal


def parse_ignition_text(desc_raw: str, table_category: str) -> Dict[str, Any]:
    """
    Analisa a descrição bruta de um item de ignição e extrai com precisão:
    - commercialCodeRaw e commercialCode
    - brand
    - crossReferenceCodes
    - oemCodes
    - ignitionSpecs: pieceType, transponder, keyProfile, connection, terminalCount, plugGender, features
    - vehicleMakes e vehicleModels
    - cleanDescription e cleanApplication
    """
    lines = [l.strip() for l in desc_raw.splitlines() if l.strip()]
    full_text = " ".join(lines)

    # Identificação de Códigos
    codes_found: List[str] = []
    oem_codes: List[str] = []
    cross_codes: List[str] = []

    # Procura códigos conhecidos por regex
    # 1. Padrão A.xxx ou A-xxx ou Axxx (Almap / Amparo)
    almap_matches = re.findall(r"\bA[-.]?\s*(\d+(?:/\d+)?)\b", full_text, flags=re.IGNORECASE)
    for m in almap_matches:
        codes_found.append(f"A-{m}")

    # 2. Padrão Marília IM-xxxxx ou IM – xxxxx
    im_matches = re.findall(r"\bIM\s*[-–—]?\s*(\d{4,6})\b", full_text, flags=re.IGNORECASE)
    for m in im_matches:
        codes_found.append(f"IM-{m}")

    # 3. Padrão Universal UNI-xxxxx
    uni_matches = re.findall(r"\bUNI\s*[-–—]?\s*(\d{4,6})\b", full_text, flags=re.IGNORECASE)
    for m in uni_matches:
        codes_found.append(f"UNI-{m}")

    # 4. Padrão Facobrás / Unifap F.xxxx, F-xxxx, FB-xxxx, FAxxxx
    f_matches = re.findall(r"\bF[B]?[-.]?\s*(\d{4,5})\b", full_text, flags=re.IGNORECASE)
    for m in f_matches:
        codes_found.append(f"F-{m}")

    fa_matches = re.findall(r"\bFA\s*(\d{4})\b", full_text, flags=re.IGNORECASE)
    for m in fa_matches:
        cross_codes.append(f"FA{m}")

    # 5. Padrão FI-xxxx (Fiat/DPaula)
    fi_matches = re.findall(r"\bFI\s*[-–—]?\s*(\d{4,6})\b", full_text, flags=re.IGNORECASE)
    for m in fi_matches:
        codes_found.append(f"FI-{m}")

    # 6. Códigos numéricos de 5 dígitos (ex: 40999, 41410, 41408, 41409, 41404, 41406, 20807, 20630, 06154)
    # ou em parênteses como (30314), (30259)
    paren_codes = re.findall(r"\((\d{4,6})\)", full_text)
    for pc in paren_codes:
        cross_codes.append(pc)

    num_5_matches = re.findall(r"\b(\d{5})\b", full_text)
    for n5 in num_5_matches:
        if n5 not in codes_found and n5 not in cross_codes:
            codes_found.append(n5)

    # 7. OEM codes com formato pontuado (ex: 211.905.865.3, ZBA-953.849.A, 357.905.865, 7.323.210, 067904-9)
    # Deve conter dígitos obrigatoriamente
    oem_candidates = re.findall(
        r"\b(?:[0-9A-Z]{3}[-.][0-9A-Z]{3}[-.][0-9A-Z]{3}(?:[-.][0-9A-Z]{1,2})?|\d{1,2}\.\d{3}\.\d{3}|\d{6}-\d|[A-Z]{3}-\d{3}\.\d{3}\.[A-Z])\b",
        full_text,
        flags=re.IGNORECASE
    )
    for om in oem_candidates:
        if any(char.isdigit() for char in om):
            if om not in codes_found and om not in cross_codes and om not in oem_codes:
                oem_codes.append(om)

    # Definir Código Principal e Marca
    primary_code = ""
    primary_code_raw = ""
    brand = "Universal"

    # Se a primeira linha contiver um código evidente
    if lines:
        first_line = lines[0].strip()
        first_line_clean = re.sub(r"\s+", " ", first_line)
        # Se começar com código como A.118, IM – 11100, 40999, F-1164
        m_start = re.match(r"^([A-Z0-9\.\-\/\s–—]+?)(?:\s+(?:Rural|Corcel|Escort|Uno|Palio|Sedan|Corsa|Gol|Omega|Vectra|Astra|Kombi|Excêntrico|CHAVE|CAPA|Trava).*|$)", first_line, flags=re.IGNORECASE)
        if m_start:
            candidate = m_start.group(1).strip()
            # normalizar
            candidate_norm = re.sub(r"[\s–—]+", "-", candidate).replace(".", "-")
            candidate_norm = re.sub(r"-+", "-", candidate_norm).strip("-")
            if re.match(r"^[A-Z0-9\-\/]{2,15}$", candidate_norm, flags=re.IGNORECASE):
                primary_code_raw = candidate
                primary_code = candidate_norm.upper()

    if not primary_code and codes_found:
        primary_code = codes_found[0]
        primary_code_raw = codes_found[0]

    if not primary_code:
        # Fallback de identificação
        primary_code = "IGN-" + re.sub(r"[^A-Z0-9]", "", full_text[:12]).upper()
        primary_code_raw = primary_code

    # Brand heuristics
    p_upper = primary_code.upper()
    if p_upper.startswith("A-") or p_upper.startswith("A.") or p_upper.startswith("A1") or p_upper.startswith("A2"):
        brand = "Almap / Amparo"
    elif p_upper.startswith("IM-"):
        brand = "Marília"
    elif p_upper.startswith("UNI-"):
        brand = "Universal Automotive"
    elif p_upper.startswith("F-") or p_upper.startswith("FB-"):
        brand = "Facobrás"
    elif p_upper.startswith("FI-"):
        brand = "Fiat / DPaula"
    elif p_upper in ["40999", "41410", "41408", "41409", "41404", "41406", "20807", "20630"]:
        brand = "Universal / Kostal"
    elif p_upper == "06154":
        brand = "DNI"

    # Determinar Códigos Cruzados
    for c in codes_found:
        c_clean = c.replace(".", "-").upper()
        if c_clean != primary_code and c_clean not in cross_codes:
            cross_codes.append(c_clean)

    # Classificação das Especificações de Ignição
    txt_lower = full_text.lower()

    # Subtipo da peça
    piece_type = "Cilindro de Ignição"
    if "chave geral" in txt_lower or "chave geral" in table_category.lower():
        piece_type = "Chave Geral"
    elif "trava da direção" in txt_lower or "trava de direção" in txt_lower:
        piece_type = "Trava de Direção"
    elif "excêntrico" in txt_lower or "excentrico" in txt_lower:
        piece_type = "Excêntrico de Ignição"
    elif "capa igniçao" in txt_lower or "capa ignição" in txt_lower or "borboleta blazer" in txt_lower:
        piece_type = "Capa / Borboleta de Ignição"
    elif "contato" in table_category.lower() or "comutador" in table_category.lower() or "terminais" in txt_lower or "saídas" in txt_lower:
        piece_type = "Comutador / Contato de Ignição"

    # Transponder (Chip)
    transponder = "Não se Aplica"
    if piece_type in ["Cilindro de Ignição", "Trava de Direção"]:
        if "transponde" in txt_lower or "chip" in txt_lower or "alojamento" in txt_lower:
            transponder = "Com Transponder (Chip)"
        else:
            transponder = "Sem Transponder"

    # Perfil da Chave
    key_profile = "Não se Aplica"
    if piece_type in ["Cilindro de Ignição", "Trava de Direção", "Chave Geral"]:
        if "pantograf" in txt_lower or "laser" in txt_lower or "snake" in txt_lower:
            key_profile = "Chave Pantográfica"
        elif "borboleta" in txt_lower:
            key_profile = "Chave Borboleta"
        elif "prego" in txt_lower or "tibbe" in txt_lower:
            key_profile = "Chave Prego (Ford Tibbe)"
        else:
            key_profile = "Chave Comum (Yale / Dente)"

    # Conexão Elétrica do Comutador
    connection = "Não se Aplica"
    if piece_type in ["Comutador / Contato de Ignição", "Chave Geral"]:
        if "chicote" in txt_lower or "fios" in txt_lower:
            connection = "Com Chicote"
        else:
            connection = "Sem Chicote (Pino Seco)"

    # Contagem de Terminais / Pinos
    terminal_count = "Não Informado"
    term_match = re.search(r"\(?(\d+)\s*(?:terminais|terminas|saídas|saidas|pinos)\)?", txt_lower)
    if term_match:
        n_term = term_match.group(1)
        if "pino" in txt_lower:
            terminal_count = f"{n_term} Pinos"
        elif "saída" in txt_lower or "saida" in txt_lower:
            terminal_count = f"{n_term} Saídas"
        else:
            terminal_count = f"{n_term} Terminais"
    elif "6terminais" in txt_lower:
        terminal_count = "6 Terminais"
    elif "1 pino" in txt_lower:
        terminal_count = "1 Pino"
    elif "2 pinos" in txt_lower:
        terminal_count = "2 Pinos"

    # Plug Gender (Macho vs Fêmea)
    plug_gender = "Não se Aplica"
    if "macho" in txt_lower:
        plug_gender = "Macho"
    elif "femea" in txt_lower or "fêmea" in txt_lower:
        plug_gender = "Fêmea"

    # Features e Especificações Especiais
    features: List[str] = []
    if "borboleta" in txt_lower:
        features.append("Borboleta")
    if "anti-furto" in txt_lower or "antifurto" in txt_lower:
        features.append("Anti-Furto")
    if "pino longo" in txt_lower:
        features.append("Pino Longo")
    if "sem mola" in txt_lower:
        features.append("Sem Mola")
    if "valeo" in txt_lower:
        features.append("Sistema Valeo")
    if "disco branco" in txt_lower:
        features.append("Disco Branco")
    if "disco cinza" in txt_lower:
        features.append("Disco Cinza")
    if "trava plástica" in txt_lower or "trava plastica" in txt_lower:
        features.append("Trava Plástica")
    if "direçao ajustavel" in txt_lower or "direção ajustável" in txt_lower or "ajustavel" in txt_lower:
        features.append("Direção Ajustável")
    if "completo" in txt_lower:
        features.append("Conjunto Completo")

    # Montadoras
    makes_map = {
        "VW": ["vw", "volkswagen", "sedan", "fusca", "brasília", "brasilia", "variant", "kombi", "gol", "passat", "voyage", "parati", "saveiro", "santana", "quantum", "golf", "polo", "fox", "bora", "new beetle", "audi a3", "constellation"],
        "Ford": ["ford", "corcel", "belina", "del rey", "rural", "pampa", "escort", "verona", "fiesta", "ka", "courrier", "currier", "f-1000", "zetec"],
        "GM / Chevrolet": ["gm", "chevrolet", "chevette", "monza", "kadett", "kadet", "ipanema", "opala", "caravan", "omega", "ómega", "vectra", "calibra", "astra", "zafira", "corsa", "celta", "prisma", "meriva", "montana", "blazer", "s10", "silverado", "c-10", "d-10", "c-14", "veraneio"],
        "Fiat": ["fiat", "uno", "prêmio", "premio", "elba", "fiorino", "tempra", "tipo", "palio", "siena", "strada", "brava", "doblò", "doblo", "idea"],
        "Universal": ["universal", "caminhão", "todos"]
    }

    vehicle_makes: List[str] = []
    for make, keywords in makes_map.items():
        if any(kw in txt_lower for kw in keywords):
            vehicle_makes.append(make)
    if not vehicle_makes:
        vehicle_makes.append("Universal")

    # Aplicação textual limpa
    # Remove as primeiras linhas de código da descrição para formar o texto de aplicação
    app_lines = []
    for line in lines:
        cleaned_line = line.strip()
        # Se for linha de código puro, pula
        if cleaned_line in [primary_code_raw, primary_code] or any(cleaned_line == cc for cc in cross_codes) or any(cleaned_line == oc for oc in oem_codes):
            continue
        if re.match(r"^[A-Z0-9\.\-\/\s–—]+$", cleaned_line) and len(cleaned_line) < 12 and not any(w in cleaned_line.lower() for w in ["sedan", "kombi", "gol", "uno", "corsa"]):
            continue
        app_lines.append(cleaned_line)

    clean_application = " — ".join(app_lines) if app_lines else full_text
    clean_description = f"{piece_type} {primary_code} ({brand})"
    if app_lines:
        clean_description += f" — {app_lines[0]}"

    return {
        "commercialCode": primary_code,
        "commercialCodeRaw": primary_code_raw or primary_code,
        "brand": brand,
        "crossReferenceCodes": cross_codes,
        "oemCodes": oem_codes,
        "ignitionSpecs": {
            "pieceType": piece_type,
            "transponder": transponder,
            "keyProfile": key_profile,
            "connection": connection,
            "terminalCount": terminal_count,
            "plugGender": plug_gender,
            "features": features,
        },
        "vehicleMakes": vehicle_makes,
        "cleanDescription": clean_description,
        "cleanApplication": clean_application,
    }


def generate_search_tokens(
    product_id: str,
    box_number: str,
    internal_code: str,
    commercial_code: str,
    cross_codes: List[str],
    oem_codes: List[str],
    makes: List[str],
    desc: str,
    app: str,
    specs: Dict[str, Any]
) -> List[str]:
    """
    Gera tokens de busca em minúsculas com e sem pontuação para indexação sub-50ms.
    """
    tokens = set()

    def add_token(t: str):
        if not t:
            return
        t_clean = t.strip().lower()
        if t_clean:
            tokens.add(t_clean)
            # Sem pontuação
            t_alnum = re.sub(r"[^a-z0-9]", "", t_clean)
            if t_alnum and t_alnum != t_clean:
                tokens.add(t_alnum)

    add_token(product_id)
    add_token(commercial_code)
    for cc in cross_codes:
        add_token(cc)
    for oc in oem_codes:
        add_token(oc)

    # Caixa e prefixos
    if box_number:
        add_token(box_number)
        add_token(f"cx {box_number}")
        add_token(f"cx{box_number}")
        add_token(f"caixa {box_number}")
        add_token(f"caixa{box_number}")
        # Sem zero à esquerda
        box_int = re.sub(r"^0+", "", box_number)
        if box_int and box_int != box_number:
            add_token(box_int)
            add_token(f"cx {box_int}")
            add_token(f"cx{box_int}")
            add_token(f"caixa {box_int}")
            add_token(f"caixa{box_int}")

    if internal_code:
        add_token(internal_code)

    for m in makes:
        add_token(m)

    add_token(specs.get("pieceType", ""))
    add_token(specs.get("transponder", ""))
    add_token(specs.get("keyProfile", ""))
    add_token(specs.get("connection", ""))
    add_token(specs.get("terminalCount", ""))
    add_token(specs.get("plugGender", ""))
    for f in specs.get("features", []):
        add_token(f)

    # Palavras-chave da descrição e aplicação
    words = re.findall(r"[a-zA-Z0-9áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]+", f"{desc} {app}")
    for w in words:
        if len(w) >= 2:
            add_token(w)

    return sorted(list(tokens))


def extract_catalogs() -> Dict[str, Any]:
    """
    Pipeline mestre de extração de catálogos Word.
    """
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    print("================================================================================")
    print("[*] INICIANDO ENGENHARIA REVERSA DE CATALOGOS WORD (.DOC / .DOCX)")
    print("================================================================================")

    PUBLIC_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    CONVERTED_DOCX_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_SEED_JSON.parent.mkdir(parents=True, exist_ok=True)

    # 1. Localizar arquivos .doc / .docx
    candidate_files = []
    for p in PROJECT_ROOT.glob("*.doc*"):
        if p.is_file() and not p.name.startswith("~$"):
            candidate_files.append(p)

    print(f"[*] Arquivos Word encontrados na raiz: {[f.name for f in candidate_files]}")

    processed_docx_files: List[Path] = []
    for cand in candidate_files:
        if cand.suffix.lower() == ".doc":
            out_docx = CONVERTED_DOCX_DIR / f"{cand.stem}.docx"
            print(f"[*] Verificando e convertendo .doc binário: {cand.name}")
            if not out_docx.exists() or out_docx.stat().st_size == 0:
                success = convert_doc_to_docx_windows(cand, out_docx)
                if not success:
                    print(f"[!] ERRO CRÍTICO: Não foi possível converter {cand.name} para .docx!")
                    sys.exit(1)
            else:
                print(f"[*] Cache .docx existente: {out_docx.name}")
            processed_docx_files.append(out_docx)
        elif cand.suffix.lower() == ".docx":
            processed_docx_files.append(cand)

    if not processed_docx_files:
        print("[!] Nenhum arquivo .doc ou .docx disponível!")
        sys.exit(1)

    products: List[Dict[str, Any]] = []
    image_audit_passed = 0
    image_audit_failed = 0

    nsmap = {
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "v": "urn:schemas-microsoft-com:vml"
    }

    total_cylinders = 0
    total_switches = 0
    total_steering_locks = 0
    total_accessories = 0

    for docx_path in processed_docx_files:
        print(f"\n[*] Processando catálogo: {docx_path.name}")
        doc = docx.Document(str(docx_path))
        rels = doc.part.rels

        # Mapeamento de títulos de parágrafo para categorias de tabela
        # No nosso documento temos:
        # P[0]: 'CILINDRO DE IGNIÇÃO' -> Table 0
        # P[2]: 'CONTATO DE IGNIÇÃO' -> Table 1
        # P[7]: 'CHAVE GERAL' -> Table 2
        table_categories = [
            "Cilindro de Ignição",
            "Contato / Comutador de Ignição",
            "Chave Geral"
        ]

        with zipfile.ZipFile(docx_path) as z:
            for ti, tbl in enumerate(doc.tables):
                t_cat = table_categories[ti] if ti < len(table_categories) else "Ignição Automotiva"
                print(f"  -> Tabela {ti} [{t_cat}]: {len(tbl.rows)} linhas")

                for ri, row in enumerate(tbl.rows):
                    if ri == 0:
                        # Cabeçalho da tabela (FIGURA | DESCRIÇÃO | CX)
                        continue

                    # Slots esquerdo e direito
                    slots = [
                        ("left", 0, 1, 2),
                        ("right", 3, 4, 5)
                    ]

                    for side, img_col, desc_col, cx_col in slots:
                        if img_col >= len(row.cells):
                            continue

                        desc_raw = row.cells[desc_col].text.strip() if desc_col < len(row.cells) else ""
                        cx_raw = row.cells[cx_col].text.strip() if cx_col < len(row.cells) else ""

                        # Localizar imagem no slot
                        tc = row.cells[img_col]._tc
                        blips = tc.xpath(
                            './/*[local-name()="blip"]/@*[local-name()="embed"] | .//*[local-name()="imagedata"]/@*[local-name()="id"]'
                        )

                        # Se não há descrição nem cx nem imagem, slot vazio
                        if not desc_raw and not cx_raw and not blips:
                            continue

                        box_number, internal_code = clean_box_number(cx_raw)
                        parsed = parse_ignition_text(desc_raw, t_cat)

                        # Contagem por tipo
                        ptype = parsed["ignitionSpecs"]["pieceType"]
                        if ptype == "Cilindro de Ignição":
                            total_cylinders += 1
                        elif ptype == "Comutador / Contato de Ignição":
                            total_switches += 1
                        elif ptype == "Trava de Direção":
                            total_steering_locks += 1
                        else:
                            total_accessories += 1

                        # ID único do produto 100% lowercase
                        prod_slug = f"ign-t{ti}-r{ri:02d}-{side}"
                        prod_id = prod_slug

                        # Extrair e converter imagem
                        image_urls: List[str] = []
                        if blips:
                            for b_idx, b_id in enumerate(blips):
                                if b_id in rels:
                                    target_ref = rels[b_id].target_ref
                                    # target_ref usually "media/imageX.jpeg"
                                    zip_entry = f"word/{target_ref}" if not target_ref.startswith("word/") else target_ref
                                    try:
                                        img_bytes = z.read(zip_entry)
                                        out_img_name = f"{prod_slug}.webp" if b_idx == 0 else f"{prod_slug}_{b_idx+1}.webp"
                                        out_img_path = PUBLIC_IMAGES_DIR / out_img_name.lower()

                                        # Executa conversão WebP Studio com fundo #FFFFFF, Smart Trim e Auditoria
                                        res = convert_bytes_to_studio_webp(img_bytes, out_img_path)
                                        if res.success and res.audit_passed:
                                            image_audit_passed += 1
                                            image_urls.append(f"/catalog-images/ignicao/{out_img_name.lower()}")
                                        else:
                                            image_audit_failed += 1
                                            print(f"    [!] Falha na auditoria da imagem {out_img_name}: {res.audit_message}")
                                            if out_img_path.exists():
                                                image_urls.append(f"/catalog-images/ignicao/{out_img_name.lower()}")
                                    except KeyError:
                                        print(f"    [!] Entrada zip não encontrada: {zip_entry}")

                        # Se não tem imagem no word
                        primary_img = image_urls[0] if image_urls else "/placeholder-ignition.webp"

                        # Flag de revisão de descrição
                        needs_review = False
                        if not desc_raw and box_number:
                            needs_review = True
                            parsed["cleanDescription"] = f"[Identificação Visual] {t_cat} — Caixa {box_number}"
                            parsed["cleanApplication"] = f"Peça física armazenada na Caixa {box_number} (Aguardando conferência de aplicação)"

                        # Geração de Search Tokens
                        tokens = generate_search_tokens(
                            product_id=prod_id,
                            box_number=box_number,
                            internal_code=internal_code,
                            commercial_code=parsed["commercialCode"],
                            cross_codes=parsed["crossReferenceCodes"],
                            oem_codes=parsed["oemCodes"],
                            makes=parsed["vehicleMakes"],
                            desc=parsed["cleanDescription"],
                            app=parsed["cleanApplication"],
                            specs=parsed["ignitionSpecs"]
                        )

                        product_obj = {
                            "id": prod_id,
                            "commercialCode": parsed["commercialCode"],
                            "commercialCodeRaw": parsed["commercialCodeRaw"],
                            "brand": parsed["brand"],
                            "boxNumber": box_number,
                            "internalCode": internal_code,
                            "category": t_cat,
                            "subCategory": parsed["ignitionSpecs"]["pieceType"],
                            "description": parsed["cleanDescription"],
                            "application": parsed["cleanApplication"],
                            "vehicleMakes": parsed["vehicleMakes"],
                            "vehicleModels": [],
                            "crossReferenceCodes": parsed["crossReferenceCodes"],
                            "oemCodes": parsed["oemCodes"],
                            "ignitionSpecs": parsed["ignitionSpecs"],
                            "searchTokens": tokens,
                            "images": image_urls if image_urls else [primary_img],
                            "primaryImage": primary_img,
                            "price": None,
                            "needsDescriptionReview": needs_review,
                            "sourceDocument": docx_path.name,
                            "tableIndex": ti,
                            "rowIndex": ri,
                            "slotSide": side.upper(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }

                        products.append(product_obj)

    # Master Seed Data
    master_seed = {
        "catalogMetadata": {
            "name": "Catálogo Interno de Balcão — Cilindros & Contatos de Ignição",
            "version": "1.0.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalItems": len(products),
            "totalImages": image_audit_passed,
            "categories": [
                "Cilindro de Ignição",
                "Contato / Comutador de Ignição",
                "Trava de Direção",
                "Chave Geral",
                "Excêntrico de Ignição",
                "Capa / Borboleta de Ignição"
            ],
            "stats": {
                "cylinders": total_cylinders,
                "switches": total_switches,
                "steeringLocks": total_steering_locks,
                "accessories": total_accessories,
                "auditedImagesPassed": image_audit_passed,
                "auditedImagesFailed": image_audit_failed,
            }
        },
        "sourceDocuments": [
            {
                "filename": "CILINDRO E CONTATO DE IGNIÇÃO.doc",
                "format": "Microsoft Word 97-2003 (.doc OLE2 / OpenXML .docx)",
                "totalExtracted": len(products)
            }
        ],
        "products": products
    }

    OUTPUT_SEED_JSON.write_text(json.dumps(master_seed, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n================================================================================")
    print("[+] EXTRACAO CONCLUIDA COM SUCESSO!")
    print("================================================================================")
    print(f"[*] Total de Produtos Extraidos: {len(products)}")
    print(f"[*] Cilindros de Ignicao: {total_cylinders}")
    print(f"[*] Contatos / Comutadores de Partida: {total_switches}")
    print(f"[*] Travas de Direcao: {total_steering_locks}")
    print(f"[*] Outros (Excentricos / Chaves Gerais / Capas): {total_accessories}")
    print(f"[*] Fotos WebP Studio Auditadas (#FFFFFF Puro): {image_audit_passed} (Falhas: {image_audit_failed})")
    print(f"[*] Arquivo Seed Salvo em: {OUTPUT_SEED_JSON}")
    print("================================================================================\n")

    return master_seed


if __name__ == "__main__":
    extract_catalogs()
