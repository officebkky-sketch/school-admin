import fs from 'fs';
import path from 'path';

const projectRoot = 'C:\\Users\\bkky9\\OneDrive\\Desktop\\school-admin-multischool';
const printPagePath = path.join(projectRoot, 'src', 'pages', 'BoardSelectionPrint.tsx');
const img15Path = path.join(projectRoot, 'src', 'assets', 'saraban', 'garuda-1.5cm.png');
const img30Path = path.join(projectRoot, 'src', 'assets', 'saraban', 'garuda-3cm.png');

function run() {
  try {
    console.log('Reading image files...');
    const img15Base64 = fs.readFileSync(img15Path).toString('base64');
    const img30Base64 = fs.readFileSync(img30Path).toString('base64');
    
    const dataUri15 = `data:image/png;base64,${img15Base64}`;
    const dataUri30 = `data:image/png;base64,${img30Base64}`;
    
    console.log('Reading BoardSelectionPrint.tsx...');
    let content = fs.readFileSync(printPagePath, 'utf8');
    
    console.log('Patching imports to base64 constants...');
    
    // ค้นหาส่วนของ import
    const target1 = "import garuda15mm from '../assets/saraban/garuda-1.5cm.png';";
    const target2 = "import garuda30mm from '../assets/saraban/garuda-3cm.png';";
    
    const replacement1 = `const garuda15mm = "${dataUri15}";`;
    const replacement2 = `const garuda30mm = "${dataUri30}";`;
    
    if (content.includes(target1)) {
      content = content.replace(target1, replacement1);
      console.log('Patched garuda-1.5cm import.');
    } else {
      console.log('Warning: target1 not found in file (already patched?).');
    }
    
    if (content.includes(target2)) {
      content = content.replace(target2, replacement2);
      console.log('Patched garuda-3cm import.');
    } else {
      console.log('Warning: target2 not found in file (already patched?).');
    }
    
    console.log('Writing back to BoardSelectionPrint.tsx...');
    fs.writeFileSync(printPagePath, content, 'utf8');
    console.log('Successfully updated BoardSelectionPrint.tsx with base64 embedded garuda images!');
    
  } catch (err) {
    console.error('Error patching file:', err);
  }
}

run();
