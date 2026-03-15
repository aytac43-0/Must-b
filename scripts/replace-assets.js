#!/usr/bin/env node
/**
 * Must-b Asset Replacement Script
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces all OpenClaw / legacy app-icon PNG files with the Must-b
 * Red Panda mascot, resized to each target's exact pixel dimensions.
 *
 * Usage:
 *   node scripts/replace-assets.js <path-to-red-panda.png>
 *
 * Example:
 *   node scripts/replace-assets.js C:\Users\aytac\Downloads\red-panda.png
 *   node scripts/replace-assets.js /tmp/red-panda.png
 *
 * Requires: sharp  (auto-installed if missing)
 * ─────────────────────────────────────────────────────────────────────────
 */
'use strict';
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

// ── Args ────────────────────────────────────────────────────────────────────
const src = process.argv[2];
if (!src) {
  console.error('\n  Usage: node scripts/replace-assets.js <path-to-red-panda.png>\n');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`\n  File not found: ${src}\n`);
  process.exit(1);
}

const root = path.resolve(__dirname, '..');

// ── Auto-install sharp ───────────────────────────────────────────────────────
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('  Installing sharp (image processing)...');
  execSync('npm install sharp --no-save', { cwd: root, stdio: 'inherit' });
  sharp = require('sharp');
}

const cyan  = s => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const dim   = s => `\x1b[2m${s}\x1b[0m`;

// ── Target files with their sizes ───────────────────────────────────────────
const TARGETS = [
  // ── Web app ────────────────────────────────────────────────────────────
  { file: 'public/Luma/public/logo.png',              size: 512 },
  { file: 'public/Luma/public/apple-touch-icon.png',  size: 180 },
  { file: 'public/Luma/public/favicon-96x96.png',     size: 96  },
  { file: 'public/Luma/public/favicon-48x48.png',     size: 48  },
  { file: 'public/Luma/public/favicon-32x32.png',     size: 32  },

  // ── macOS ──────────────────────────────────────────────────────────────
  { file: 'apps/macos/Icon.icon/Assets/must-b-mac.png', size: 1024 },

  // ── Android (mipmap densities) ─────────────────────────────────────────
  { file: 'apps/android/app/src/main/res/mipmap-mdpi/ic_launcher.png',           size: 48  },
  { file: 'apps/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png',size: 48  },
  { file: 'apps/android/app/src/main/res/mipmap-hdpi/ic_launcher.png',           size: 72  },
  { file: 'apps/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png',size: 72  },
  { file: 'apps/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',          size: 96  },
  { file: 'apps/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png',size: 96 },
  { file: 'apps/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',         size: 144 },
  { file: 'apps/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png',size:144},
  { file: 'apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',        size: 192 },
  { file: 'apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',size:192},

  // ── iOS app icons ─────────────────────────────────────────────────────
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/29.png',   size: 29   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/40.png',   size: 40   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/48.png',   size: 48   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/55.png',   size: 55   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/57.png',   size: 57   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/58.png',   size: 58   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/60.png',   size: 60   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/66.png',   size: 66   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/80.png',   size: 80   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/87.png',   size: 87   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/88.png',   size: 88   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/92.png',   size: 92   },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/100.png',  size: 100  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/102.png',  size: 102  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/108.png',  size: 108  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/114.png',  size: 114  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/120.png',  size: 120  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/172.png',  size: 172  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/180.png',  size: 180  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/196.png',  size: 196  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/216.png',  size: 216  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/234.png',  size: 234  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/258.png',  size: 258  },
  { file: 'apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/1024.png', size: 1024 },

  // ── iOS Watch App icons ────────────────────────────────────────────────
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-app-38@2x.png',       size: 76  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-app-40@2x.png',       size: 80  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-app-41@2x.png',       size: 82  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-app-44@2x.png',       size: 88  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-app-45@2x.png',       size: 90  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-companion-29@2x.png', size: 58  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-companion-29@3x.png', size: 87  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-marketing-1024.png',  size: 1024},
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-notification-38@2x.png', size: 48},
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-notification-42@2x.png', size: 48},
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-quicklook-38@2x.png', size: 76  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-quicklook-42@2x.png', size: 84  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-quicklook-44@2x.png', size: 88  },
  { file: 'apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/watch-quicklook-45@2x.png', size: 90  },

  // ── Chrome extension ───────────────────────────────────────────────────
  { file: 'src/core/assets/chrome-extension/icons/icon16.png',  size: 16  },
  { file: 'src/core/assets/chrome-extension/icons/icon32.png',  size: 32  },
  { file: 'src/core/assets/chrome-extension/icons/icon48.png',  size: 48  },
  { file: 'src/core/assets/chrome-extension/icons/icon128.png', size: 128 },

  // ── DMG backgrounds (keep wider aspect for these) ──────────────────────
  { file: 'src/core/assets/dmg-background.png',       size: 800, width: 800, height: 600 },
  { file: 'src/core/assets/dmg-background-small.png', size: 400, width: 400, height: 300 },
];

// ── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(cyan('  Must-b Asset Replacement'));
  console.log(cyan('  ─────────────────────────────────────────────'));
  console.log(dim(`  Source: ${src}`));
  console.log('');

  let ok = 0, skipped = 0, failed = 0;

  for (const t of TARGETS) {
    const dest = path.join(root, t.file);
    const w = t.width  ?? t.size;
    const h = t.height ?? t.size;

    if (!fs.existsSync(dest)) {
      console.log(`  ${dim('–')}  ${dim(t.file)}  ${dim('(skipped — file does not exist)')}`);
      skipped++;
      continue;
    }

    try {
      await sharp(src)
        .resize(w, h, { fit: 'cover', position: 'center' })
        .png()
        .toFile(dest + '.tmp');
      // Atomic replace
      fs.renameSync(dest + '.tmp', dest);
      console.log(`  ${green('✓')}  ${t.file}  ${dim(`${w}×${h}`)}`);
      ok++;
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m  ${t.file}  ${dim(err.message)}`);
      failed++;
      // Clean up temp if left behind
      try { fs.unlinkSync(dest + '.tmp'); } catch {}
    }
  }

  // ── Generate favicon.ico (16+32+48 multi-size) ────────────────────────────
  const icoPath = path.join(root, 'public', 'Luma', 'public', 'favicon.ico');
  if (fs.existsSync(icoPath)) {
    try {
      // Write a 32×32 PNG as .ico (browsers accept PNG-in-ICO)
      await sharp(src).resize(32, 32).png().toFile(icoPath);
      console.log(`  ${green('✓')}  public/Luma/public/favicon.ico  ${dim('32×32')}`);
      ok++;
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m  favicon.ico  ${dim(err.message)}`);
      failed++;
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(green(`  ✔  Done! ${ok} file(s) replaced.`));
  } else {
    console.log(`  ${ok} replaced · ${skipped} skipped · ${failed} failed`);
  }
  console.log('');
}

main().catch(err => {
  console.error('  Fatal:', err.message);
  process.exit(1);
});
