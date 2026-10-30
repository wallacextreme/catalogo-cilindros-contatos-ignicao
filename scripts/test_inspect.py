import docx
from pathlib import Path

docx_files = list(Path('scripts/.converted_docx').glob('*.docx'))
if not docx_files:
    print('No docx found!')
    exit(1)

docx_path = docx_files[0]
doc = docx.Document(str(docx_path))
rels = doc.part.rels

count = 0
for ti, tbl in enumerate(doc.tables):
    for ri, r in enumerate(tbl.rows):
        if ri == 0:
            continue
        for side, img_col, desc_col, cx_col in [('LEFT', 0, 1, 2), ('RIGHT', 3, 4, 5)]:
            if img_col >= len(r.cells):
                continue
            tc = r.cells[img_col]._tc
            blips = tc.xpath('.//*[local-name()="blip"]/@*[local-name()="embed"] | .//*[local-name()="imagedata"]/@*[local-name()="id"]')
            desc = r.cells[desc_col].text.strip().replace('\n', ' ') if desc_col < len(r.cells) else ''
            cx = r.cells[cx_col].text.strip().replace('\n', ' / ') if cx_col < len(r.cells) else ''
            
            # Resolve image parts
            img_parts = []
            for b in blips:
                if b in rels:
                    img_parts.append(rels[b].target_ref)
                else:
                    img_parts.append(f'unknown:{b}')
            
            if desc or cx or blips:
                count += 1
                print(f'T{ti} R{ri:02d} {side}: cx=[{cx:10}] imgs={img_parts} desc=[{desc[:45]}]')

print(f'\nTotal non-empty slots: {count}')
