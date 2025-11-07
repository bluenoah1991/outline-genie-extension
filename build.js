const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src');
const outDir = path.resolve('out');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

fs.mkdirSync(outDir, { recursive: true });

const files = [
  'readability.js',
  'content.js',
  'sidepanel.html',
  'sidepanel.js',
  'background.js',
  'styles.css',
  'manifest.json'
];

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ ${file}`);
  }
});

const iconsDir = path.join(process.cwd(), 'icons');
const outIconsDir = path.join(outDir, 'icons');
if (fs.existsSync(iconsDir)) {
  fs.mkdirSync(outIconsDir, { recursive: true });
  fs.readdirSync(iconsDir).forEach(file => {
    fs.copyFileSync(path.join(iconsDir, file), path.join(outIconsDir, file));
  });
  console.log('✓ icons/');
}

console.log('构建完成!');