export function detectVideoContainer(buffer: Buffer): 'mov' | 'matroska' | null {
  if (buffer.length >= 12 && ['ftyp', 'moov', 'wide', 'mdat'].includes(buffer.subarray(4, 8).toString('ascii'))) {
    return 'mov';
  }
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'matroska';
  }
  return null;
}
