// Генерация PNG-иконок PWA без внешних зависимостей (чистый Node + zlib).
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");

const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++)
		c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}
function mix(c1, c2, t) {
	return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function paint(size) {
	const px = Buffer.alloc(size * size * 4);
	const cx = size * 0.5;
	const cy = size * 0.55;
	const r = size * 0.33;
	const top = [27, 16, 64];
	const bottom = [11, 6, 32];
	const gold = [
		[255, 246, 207],
		[255, 215, 102],
		[240, 166, 58],
		[192, 122, 20],
	];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let col = mix(top, bottom, y / size);
			// звёзды
			const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
			if (h > 0.9985 && y < size * 0.5) col = [255, 255, 255];
			// колобок
			const d = Math.hypot(x - cx, y - cy) / r;
			if (d < 1.02) {
				const t = Math.min(1, d);
				let c;
				if (t < 0.45) c = mix(gold[0], gold[1], t / 0.45);
				else if (t < 0.8) c = mix(gold[1], gold[2], (t - 0.45) / 0.35);
				else c = mix(gold[2], gold[3], (t - 0.8) / 0.2);
				col = d > 1 ? mix(col, c, Math.max(0, 1 - (d - 1) / 0.02)) : c;
				const nx = (x - cx) / size;
				const ny = (y - cy) / size;
				// глаза
				for (const ex of [-0.085, 0.085]) {
					const de = Math.hypot(nx - ex, ny + 0.055);
					if (de < 0.045) col = [255, 255, 255];
					if (de < 0.021) col = [90, 52, 19];
					if (Math.hypot(nx - ex - 0.008, ny + 0.062) < 0.007)
						col = [255, 255, 255];
				}
				// щёки
				for (const ex of [-0.12, 0.12]) {
					if (Math.hypot(nx - ex, ny - 0.03) < 0.035)
						col = mix(col, [247, 142, 94], 0.5);
				}
				// нос
				if (Math.hypot(nx, ny + 0.005) < 0.016) col = [217, 123, 46];
				// улыбка
				const ds = Math.hypot(nx, ny - 0.02);
				if (Math.abs(ds - 0.115) < 0.011 && ny > 0.055) col = [122, 74, 18];
			}
			const i = (y * size + x) * 4;
			px[i] = col[0];
			px[i + 1] = col[1];
			px[i + 2] = col[2];
			px[i + 3] = 255;
		}
	}
	return px;
}

function encodePng(size, px) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
	}
	return Buffer.concat([
		sig,
		chunk("IHDR", ihdr),
		chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

for (const size of [192, 512]) {
	const png = encodePng(size, paint(size));
	fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
	console.log(`icon-${size}.png: ${png.length} bytes`);
}
