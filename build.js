// build.js - Simple build script to prepare Chrome extension for the Web Store
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const MANIFEST_DEV = path.join(__dirname, 'manifest.json');
const MANIFEST_PROD = path.join(__dirname, 'manifest.store.json');
const MANIFEST_BACKUP = path.join(__dirname, 'manifest.backup.json');
const OUTPUT_ZIP = path.join(__dirname, 'linkmail-extension.zip');

// Files to include in the zip
const filesToInclude = [
  'manifest.json',
  'background.js',
  'assets/',
  'backend/',
  'content/',
  'generate/',
  'history/',
  'profile/',
  'send/',
  'styles/',
  'templates/',
  'utils/',
  'vendor/',
  'scripts/'
];

// Create web store build
function createWebStoreBuild() {
  try {
    console.log('Creating Web Store build...');

    // Backup the development manifest
    fs.copyFileSync(MANIFEST_DEV, MANIFEST_BACKUP);
    console.log('✓ Development manifest backed up');

    // Replace with production manifest
    fs.copyFileSync(MANIFEST_PROD, MANIFEST_DEV);
    console.log('✓ Production manifest applied');

    // Create zip file (requires zip command-line tool)
    const includePattern = filesToInclude.join(' ');

    // Remove existing zip if it exists
    if (fs.existsSync(OUTPUT_ZIP)) {
      fs.unlinkSync(OUTPUT_ZIP);
    }

    try {
      // Try using zip command (works on macOS/Linux)
      execSync(`zip -r "${OUTPUT_ZIP}" ${includePattern}`, { stdio: 'inherit' });
    } catch (zipError) {
      console.error('Failed to create zip with zip command. Trying alternative method...');
      // Alternatively use a Node.js zip library if needed
      console.error('Please install a zip utility or manually zip the files.');
      throw zipError;
    }

    console.log(`✓ Package created: ${OUTPUT_ZIP}`);

    // Restore the development manifest
    fs.copyFileSync(MANIFEST_BACKUP, MANIFEST_DEV);
    fs.unlinkSync(MANIFEST_BACKUP);
    console.log('✓ Development manifest restored');

    console.log('\nBuild completed successfully! 🎉');
    console.log(`You can now upload ${OUTPUT_ZIP} to the Chrome Web Store.`);

  } catch (error) {
    console.error('Error during build:', error);

    // Attempt to restore manifest if it was backed up
    if (fs.existsSync(MANIFEST_BACKUP)) {
      fs.copyFileSync(MANIFEST_BACKUP, MANIFEST_DEV);
      fs.unlinkSync(MANIFEST_BACKUP);
      console.log('✓ Development manifest restored');
    }
  }
}

// Run the build
createWebStoreBuild();
