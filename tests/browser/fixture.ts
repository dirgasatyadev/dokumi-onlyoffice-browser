import { randomFillSync } from 'node:crypto'

import { zipSync } from 'fflate'

const encoder = new TextEncoder()
const xml = (value: string) => encoder.encode(value)

const pixel = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
))

export function createGoldenDocx(media = pixel, marker = 'GOLDEN_BASE') {
  const safeMarker = marker.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return zipSync({
    '[Content_Types].xml': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Default Extension="png" ContentType="image/png"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
        <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
        <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
      </Types>`),
    '_rels/.rels': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`),
    'word/styles.xml': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
      </w:styles>`),
    'word/header1.xml': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>HEADER DOKUMI</w:t></w:r></w:p></w:hdr>`),
    'word/footer1.xml': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>FOOTER 2026</w:t></w:r></w:p></w:ftr>`),
    'word/media/pixel.png': media,
    'word/_rels/document.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pixel.png"/>
        <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>`),
    'word/document.xml': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <w:body>
          <w:p><w:r><w:t>Halo {{nama_lengkap}} — 東京, Ελληνικά, emoji 😀 — ${safeMarker}</w:t></w:r></w:p>
          <w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="4000"/></w:tblGrid>
            <w:tr><w:tc><w:p><w:r><w:t>Kolom A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Nilai 42</w:t></w:r></w:p></w:tc></w:tr>
          </w:tbl>
          <w:p><w:r><w:drawing><wp:inline><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Pixel"/>
            <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
              <pic:nvPicPr><pic:cNvPr id="1" name="pixel.png"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
            </pic:pic></a:graphicData></a:graphic>
          </wp:inline></w:drawing></w:r></w:p>
          <w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/>
            <w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
          </w:sectPr>
        </w:body>
      </w:document>`),
  }, { level: 6 })
}

export function createGoldenCorpus() {
  const markers = [
    'GOLDEN_01_BASIC', 'GOLDEN_02_UNICODE', 'GOLDEN_03_EMOJI', 'GOLDEN_04_PLACEHOLDER', 'GOLDEN_05_TABLE',
    'GOLDEN_06_HEADER', 'GOLDEN_07_FOOTER', 'GOLDEN_08_IMAGE', 'GOLDEN_09_DATE', 'GOLDEN_10_NUMBER',
    'GOLDEN_11_BOOLEAN', 'GOLDEN_12_SELECT', 'GOLDEN_13_LONG_TEXT', 'GOLDEN_14_MULTILINGUAL', 'GOLDEN_15_RTL',
    'GOLDEN_16_CJK', 'GOLDEN_17_ACCENTS', 'GOLDEN_18_SYMBOLS', 'GOLDEN_19_RECOVERY', 'GOLDEN_20_REVISION',
  ]
  return markers.map((marker) => ({ marker, name: `${marker.toLowerCase()}.docx`, source: createGoldenDocx(pixel, marker) }))
}

export function createNearLimitDocx() {
  const padding = new Uint8Array(47 * 1024 * 1024)
  randomFillSync(padding)
  const largePng = new Uint8Array(pixel.byteLength + padding.byteLength)
  largePng.set(pixel)
  largePng.set(padding, pixel.byteLength)
  return createGoldenDocx(largePng)
}
