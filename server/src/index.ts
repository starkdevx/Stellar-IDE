import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Next.js frontend
app.use(cors({
  origin: '*', // In production, replace with specific frontend domain
}));

app.use(express.json());

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.resolve(process.cwd(), '../test-build');
const CONTRACT_DIR = path.resolve(WORKSPACE_DIR, 'contracts/hello-world');

// Secure path validation to prevent directory traversal
function getSafePath(relativePath: string): string {
  // Normalize and resolve absolute path
  const resolvedPath = path.resolve(CONTRACT_DIR, relativePath);
  
  // Enforce boundary check with trailing slash/separator to prevent partial matching bypasses
  if (!resolvedPath.startsWith(CONTRACT_DIR + path.sep)) {
    throw new Error('Directory traversal attempt detected');
  }
  return resolvedPath;
}

// Compile endpoint
app.post('/api/compile', async (req: express.Request, res: express.Response) => {
  const { files } = req.body;

  if (!files || typeof files !== 'object') {
    return res.status(400).json({ error: 'Invalid payload: "files" object is required' });
  }

  try {
    // Clean existing src directory to isolate project compilations
    const srcDir = path.join(CONTRACT_DIR, 'src');
    if (fs.existsSync(srcDir)) {
      fs.rmSync(srcDir, { recursive: true, force: true });
    }

    // Write files to workspace safely
    for (const [relPath, content] of Object.entries(files)) {
      if (typeof content !== 'string') {
        return res.status(400).json({ error: `Invalid content for file ${relPath}` });
      }

      // Check if it is a safe path (e.g. src/lib.rs, Cargo.toml)
      const safePath = getSafePath(relPath);
      
      // Ensure target directory exists
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, content, 'utf8');
    }

    // Run stellar build command (static command, no dynamic arguments to prevent command injection)
    const buildCmd = 'stellar contract build';
    
    exec(buildCmd, { cwd: WORKSPACE_DIR }, (error, stdout, stderr) => {
      const logs = `Stdout:\n${stdout}\n\nStderr:\n${stderr}`;
      
      if (error) {
        return res.status(422).json({
          success: false,
          logs,
          error: error.message
        });
      }

      // After successful build, extract the ABI interface JSON
      const wasmPath = path.join(WORKSPACE_DIR, 'target/wasm32v1-none/release/hello_world.wasm');
      
      if (!fs.existsSync(wasmPath)) {
        return res.status(500).json({
          success: false,
          logs,
          error: 'WASM output file not found after successful compilation.'
        });
      }

      // Command to get contract interface JSON (static paths)
      const interfaceCmd = `stellar contract info interface --wasm ${wasmPath} --output json-formatted`;

      exec(interfaceCmd, { cwd: WORKSPACE_DIR }, (infoErr, infoStdout, infoStderr) => {
        if (infoErr) {
          return res.status(500).json({
            success: false,
            logs: logs + `\n\nABI Extraction Stdout:\n${infoStdout}\n\nABI Extraction Stderr:\n${infoStderr}`,
            error: 'Failed to extract contract ABI: ' + infoErr.message
          });
        }

        try {
          const abi = JSON.parse(infoStdout.trim());
          const wasmBuffer = fs.readFileSync(wasmPath);
          const wasmBase64 = wasmBuffer.toString('base64');

          return res.json({
            success: true,
            logs: logs + `\n\nABI Extraction Logs:\n${infoStderr}`,
            abi,
            wasm: wasmBase64
          });
        } catch (parseErr: any) {
          return res.status(500).json({
            success: false,
            logs: logs + `\n\nABI Raw Output:\n${infoStdout}`,
            error: 'Failed to parse ABI JSON: ' + parseErr.message
          });
        }
      });
    });

  } catch (err: any) {
    console.error('Compile error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Start Express server on 0.0.0.0 to accept external network traffic
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Stellar Soroban compiler server running at http://0.0.0.0:${PORT}`);
});
