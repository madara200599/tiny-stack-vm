// Tiny stack VM for make.fun's tiny-stack-vm-01 ISA (kit's ISA.md).
// `node /bot/main.ts` answers every instance under /input/<id>/ by running
// its bytecode program on its input bytes, writing /output/<id>/stdout.bin
// and /output/<id>/exit.txt. Written from the ISA spec in this session:
// 32-bit wrapping ints, 256-value data stack, 64-deep call stack, 256 words
// of memory; traps end the program with their own exit code and keep the
// output written so far. Steps cap 1,000,000, output cap 65,536 bytes.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Per-opcode shape, in opcode order: [imm bytes, pops, pushes] as one digit
// each. Drives the checks the ISA orders before execution: unknown opcode,
// cut-off immediate, stack underflow, stack overflow.
const OPS = [0, 1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 48, 49, 50, 51, 52, 64, 65, 80, 81, 82, 83];
const SH = '000101401010012022023033021021021021021021021011021021021011021021021021021021200210210200000011020010010001010';
const K = new Uint8Array(256);
const IM = new Uint8Array(256);
const PO = new Uint8Array(256);
const PU = new Uint8Array(256);
OPS.forEach((o, i) => {
  K[o] = 1;
  IM[o] = +SH[i * 3];
  PO[o] = +SH[i * 3 + 1];
  PU[o] = +SH[i * 3 + 2];
});

function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length;
  const S = new Int32Array(256);
  const C = new Int32Array(64);
  const M = new Int32Array(256);
  const o = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, st = 0;
  const done = (code: number) => ({ out: o.slice(0, ol), code });
  for (;;) {
    // Step limit first, then pc, then opcode, then the immediate's fit.
    if (st === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc];
    if (!K[op]) return done(5);
    const im = IM[op];
    if (pc + im >= n) return done(9);
    st++;
    const nx = pc + 1 + im;
    const pops = PO[op];
    if (sp < pops) return done(2);
    if (sp - pops + PU[op] > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0x00: return done(0); // HALT
      case 0x01: S[sp++] = (p[nx - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 0x02: // PUSH32, little-endian signed
        S[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24);
        break;
      case 0x03: sp--; break; // POP
      case 0x04: S[sp] = S[sp - 1]; sp++; break; // DUP
      case 0x05: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; } // SWAP
      case 0x06: S[sp] = S[sp - 2]; sp++; break; // OVER
      case 0x07: { // ROT: (a b c -- b c a)
        const a = S[sp - 3];
        S[sp - 3] = S[sp - 2];
        S[sp - 2] = S[sp - 1];
        S[sp - 1] = a;
        break;
      }
      case 0x17: S[sp - 1] = -S[sp - 1] | 0; break; // NEG
      case 0x1b: S[sp - 1] = ~S[sp - 1]; break; // NOT
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = S[sp - 1];
        const a = S[sp - 2];
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b); // low 32 bits, exact
        else if (op === 0x13) {
          if (b === 0) return done(4);
          r = a === -2147483648 && b === -1 ? a : ((a / b) | 0);
        } else if (op === 0x14) {
          if (b === 0) return done(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return done(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return done(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        sp -= 2;
        S[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: { // JMP / JZ / JNZ
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (op !== 0x30) {
          const v = S[--sp];
          take = op === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33: // CALL: 64 return addresses held already traps
        if (cp === 64) return done(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34: // RET
        if (cp === 0) return done(8);
        pc = C[--cp];
        break;
      case 0x40: { // LOAD
        const a = S[sp - 1];
        if (a < 0 || a >= 256) return done(6);
        S[sp - 1] = M[a];
        break;
      }
      case 0x41: { // STORE: (v addr --), addr on top
        const a = S[sp - 1];
        if (a < 0 || a >= 256) return done(6);
        M[a] = S[sp - 2];
        sp -= 2;
        break;
      }
      case 0x50: { // PRINT: decimal ASCII, no newline; over the cap traps
        const v = S[sp - 1];
        const u = v < 0 ? -v : v;
        let d = 1;
        let t = u;
        while (t >= 10) {
          t = (t / 10) | 0;
          d++;
        }
        const len = d + (v < 0 ? 1 : 0);
        if (ol + len > 65536) return done(11);
        sp--;
        let q = ol + len;
        t = u;
        do {
          o[--q] = 48 + (t % 10);
          t = (t / 10) | 0;
        } while (t > 0);
        if (v < 0) o[--q] = 45;
        ol += len;
        break;
      }
      case 0x51: // PUTC: one byte, low 8 bits
        if (ol + 1 > 65536) return done(11);
        o[ol++] = S[--sp] & 255;
        break;
      case 0x52: // IN: -1 once the input is used up
        S[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 0x53: // EXIT: low byte of the popped value
        return done(S[--sp] & 255);
      default:
        return done(5); // unreachable: K[op] was checked above
    }
  }
}

for (const id of readdirSync(IN).sort()) {
  const prog = new Uint8Array(readFileSync(join(IN, id, 'program.bin')));
  const input = new Uint8Array(readFileSync(join(IN, id, 'input.bin')));
  const r = run(prog, input);
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), r.out);
  writeFileSync(join(OUT, id, 'exit.txt'), `${r.code}\n`);
}
