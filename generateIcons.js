import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname);
const PUBLIC_DIR = path.resolve(ROOT, 'client', 'public');

async function run() {
  console.log('Checking for sharp dependency...');
  let hasSharp = false;
  try {
    await import('sharp');
    hasSharp = true;
  } catch (e) {
    console.log('sharp not found.');
  }

  if (!hasSharp) {
    console.log('Installing sharp using pnpm...');
    try {
      execSync('pnpm add -D sharp', { stdio: 'inherit', cwd: ROOT });
    } catch (installError) {
      console.error('Failed to install sharp via pnpm. Trying npm...');
      execSync('npm install --no-save sharp', { stdio: 'inherit', cwd: ROOT });
    }
  }

  const sharp = (await import('sharp')).default;

  const svgPath = path.resolve(PUBLIC_DIR, 'favicon.svg');
  const out192 = path.resolve(PUBLIC_DIR, 'icon-192.png');
  const out512 = path.resolve(PUBLIC_DIR, 'icon-512.png');

  if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found at ' + svgPath);
    process.exit(1);
  }

  console.log('Generating transparent icon-192.png...');
  await sharp(svgPath)
    .resize(192, 192)
    .png()
    .toFile(out192);

  console.log('Generating transparent icon-512.png...');
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(out512);

  console.log('Successfully generated transparent icons!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
