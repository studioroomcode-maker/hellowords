/**
 * fix-vercel-fonts.js
 *
 * Vercel ignores files with "node_modules" in the path.
 * This script:
 * 1. Finds all .ttf files in dist/assets/
 * 2. Copies them to dist/fonts/ (flat directory)
 * 3. Replaces all long asset paths in the JS bundle with /fonts/filename.ttf
 * 4. Ensures vercel.json excludes /fonts/ from SPA rewrites
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const fontsDir = path.join(distDir, 'fonts');
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');

// Step 1: Create fonts directory
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Step 2: Find all .ttf files recursively in dist/assets
function findTTFFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTTFFiles(fullPath));
    } else if (entry.name.endsWith('.ttf')) {
      results.push(fullPath);
    }
  }
  return results;
}

const assetsDir = path.join(distDir, 'assets');
const ttfFiles = findTTFFiles(assetsDir);
console.log(`Found ${ttfFiles.length} .ttf files in dist/assets/`);

// Step 3: Copy each .ttf to dist/fonts/ and collect path mappings
const pathMap = {};
for (const ttfPath of ttfFiles) {
  const fileName = path.basename(ttfPath);
  const destPath = path.join(fontsDir, fileName);
  fs.copyFileSync(ttfPath, destPath);

  // Build the URL path mapping (what's in the JS bundle -> what we want)
  const relativePath = '/' + path.relative(distDir, ttfPath).replace(/\\/g, '/');
  const newPath = '/fonts/' + fileName;
  pathMap[relativePath] = newPath;
}

console.log(`Copied ${Object.keys(pathMap).length} fonts to dist/fonts/`);

// Also handle SpaceMono from assets/fonts
const localFontsDir = path.join(assetsDir, 'fonts');
if (fs.existsSync(localFontsDir)) {
  const localFonts = fs.readdirSync(localFontsDir).filter(f => f.endsWith('.ttf'));
  for (const f of localFonts) {
    const src = path.join(localFontsDir, f);
    // Find the hashed version if it exists
    const existingInFonts = fs.readdirSync(fontsDir).find(ff => ff.startsWith(f.replace('.ttf', '')));
    if (!existingInFonts) {
      fs.copyFileSync(src, path.join(fontsDir, f));
      console.log(`  Copied local font: ${f}`);
    }
  }
}

// Step 4: Replace paths in JS bundle(s)
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
console.log(`Processing ${jsFiles.length} JS bundle(s)...`);

for (const jsFile of jsFiles) {
  const jsPath = path.join(jsDir, jsFile);
  let content = fs.readFileSync(jsPath, 'utf-8');
  let replacements = 0;

  for (const [oldPath, newPath] of Object.entries(pathMap)) {
    if (content.includes(oldPath)) {
      content = content.split(oldPath).join(newPath);
      replacements++;
    }
  }

  if (replacements > 0) {
    fs.writeFileSync(jsPath, content, 'utf-8');
    console.log(`  ${jsFile}: ${replacements} font path(s) replaced`);
  }
}

// Step 4b: Replace paths in ALL HTML files (they contain inline @font-face)
function findHTMLFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'fonts' && entry.name !== '_expo') {
      results.push(...findHTMLFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = findHTMLFiles(distDir);
console.log(`Processing ${htmlFiles.length} HTML file(s)...`);

for (const htmlPath of htmlFiles) {
  let content = fs.readFileSync(htmlPath, 'utf-8');
  let replacements = 0;

  for (const [oldPath, newPath] of Object.entries(pathMap)) {
    if (content.includes(oldPath)) {
      content = content.split(oldPath).join(newPath);
      replacements++;
    }
  }

  if (replacements > 0) {
    fs.writeFileSync(htmlPath, content, 'utf-8');
    const name = path.relative(distDir, htmlPath);
    console.log(`  ${name}: ${replacements} font path(s) replaced`);
  }
}

// Step 5: Ensure vercel.json has correct rewrites
const vercelJsonPath = path.join(distDir, 'vercel.json');
const vercelConfig = {
  rewrites: [
    { source: "/((?!assets|_expo|fonts|favicon).*)", destination: "/index.html" }
  ]
};
fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2) + '\n');
console.log('Updated vercel.json with font exclusion');

console.log('\nDone! Ready for: vercel deploy dist --prod');
