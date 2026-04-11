type ZipEntry = {
  path: string;
  content: string;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const encoder = new TextEncoder();

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function getDosDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const year = Math.max(date.getFullYear(), 1980);

  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      Math.floor((date.getSeconds() & 0x3f) / 2),
    date: (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
  };
}

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatParts(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function createZipBlob(entries: ZipEntry[], timestamp = Date.now()) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { date: dosDate, time: dosTime } = getDosDateTime(timestamp);
  let localOffset = 0;

  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBytes = encoder.encode(normalizedPath);
    const contentBytes = encoder.encode(entry.content);
    const crc32 = calculateCrc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localHeaderView = new DataView(localHeader.buffer);

    writeUint32(localHeaderView, 0, 0x04034b50);
    writeUint16(localHeaderView, 4, 20);
    writeUint16(localHeaderView, 6, 0);
    writeUint16(localHeaderView, 8, 0);
    writeUint16(localHeaderView, 10, dosTime);
    writeUint16(localHeaderView, 12, dosDate);
    writeUint32(localHeaderView, 14, crc32);
    writeUint32(localHeaderView, 18, contentBytes.length);
    writeUint32(localHeaderView, 22, contentBytes.length);
    writeUint16(localHeaderView, 26, nameBytes.length);
    writeUint16(localHeaderView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralHeaderView = new DataView(centralHeader.buffer);

    writeUint32(centralHeaderView, 0, 0x02014b50);
    writeUint16(centralHeaderView, 4, 20);
    writeUint16(centralHeaderView, 6, 20);
    writeUint16(centralHeaderView, 8, 0);
    writeUint16(centralHeaderView, 10, 0);
    writeUint16(centralHeaderView, 12, dosTime);
    writeUint16(centralHeaderView, 14, dosDate);
    writeUint32(centralHeaderView, 16, crc32);
    writeUint32(centralHeaderView, 20, contentBytes.length);
    writeUint32(centralHeaderView, 24, contentBytes.length);
    writeUint16(centralHeaderView, 28, nameBytes.length);
    writeUint16(centralHeaderView, 30, 0);
    writeUint16(centralHeaderView, 32, 0);
    writeUint16(centralHeaderView, 34, 0);
    writeUint16(centralHeaderView, 36, 0);
    writeUint32(centralHeaderView, 38, 0);
    writeUint32(centralHeaderView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = concatParts(centralParts);
  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);

  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return new Blob(
    [...localParts, centralDirectory, endOfCentralDirectory].map(toBlobPart),
    {
    type: 'application/zip',
    }
  );
}
