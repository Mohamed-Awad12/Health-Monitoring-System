import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const compressibleExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".xml",
]);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

const main = async () => {
  const files = await walk(distDir);

  await Promise.all(
    files.map(async (filePath) => {
      if (!compressibleExtensions.has(path.extname(filePath))) {
        return;
      }

      const fileBuffer = await readFile(filePath);
      const fileStats = await stat(filePath);

      if (fileStats.size < 1024) {
        return;
      }

      const gzipBuffer = gzipSync(fileBuffer, { level: 9 });
      const brotliBuffer = brotliCompressSync(fileBuffer, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      });

      if (gzipBuffer.length < fileBuffer.length) {
        await writeFile(`${filePath}.gz`, gzipBuffer);
      }

      if (brotliBuffer.length < fileBuffer.length) {
        await writeFile(`${filePath}.br`, brotliBuffer);
      }
    })
  );
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to generate compressed build artifacts", error);
  process.exit(1);
});
