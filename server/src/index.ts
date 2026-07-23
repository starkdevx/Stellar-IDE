import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { compileQueue } from './compileQueue';
import { statsTracker } from './statsTracker';

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

// Sanitize logs to prevent internal server path leaks (CWE-200)
function sanitizeLogs(rawLogs: string): string {
  if (!rawLogs) return '';
  return rawLogs
    .replace(/\/home\/[^\/]+\/[^\s\)\"]+/g, (match) => {
      if (match.includes('.cargo')) return '[cargo-registry]';
      return '[workspace]';
    })
    .replace(new RegExp(WORKSPACE_DIR.replace(/\\/g, '\\\\'), 'g'), '[workspace]');
}

// Queue Stats endpoint for monitoring
app.get('/api/queue/stats', (req: express.Request, res: express.Response) => {
  res.json(compileQueue.getStats());
});

// Session activity tracking endpoint
app.post('/api/activity/session', (req: express.Request, res: express.Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
  statsTracker.recordVisit(clientIp);
  res.json({ success: true });
});

// Deploy activity tracking endpoint
app.post('/api/activity/deploy', (req: express.Request, res: express.Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
  statsTracker.recordDeploy(clientIp);
  res.json({ success: true });
});

// Interaction activity tracking endpoint
app.post('/api/activity/interact', (req: express.Request, res: express.Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
  statsTracker.recordInteraction(clientIp);
  res.json({ success: true });
});

// Admin stats endpoint
app.get('/api/admin/stats', (req: express.Request, res: express.Response) => {
  res.json(statsTracker.getStats());
});

// Compile endpoint
app.post('/api/compile', async (req: express.Request, res: express.Response) => {
  const { files, projectName = "hello-world" } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();

  if (!files || typeof files !== 'object') {
    return res.status(400).json({ error: 'Invalid payload: "files" object is required' });
  }

  // Ensure cargo and stellar binaries in ~/.cargo/bin are included in PATH for exec
  const cargoBinPath = path.join(process.env.HOME || '/home/ubuntu', '.cargo/bin');
  const customPath = `${cargoBinPath}:/root/.cargo/bin:/usr/local/cargo/bin:${process.env.PATH || ''}:/usr/local/bin:/usr/bin:/bin`;
  const execOptions = {
    cwd: WORKSPACE_DIR,
    env: { ...process.env, PATH: customPath }
  };

  // Enqueue task into sequential FIFO queue
  const enqueueResult = compileQueue.enqueue(projectName, () => {
    return new Promise<void>((resolve) => {
      try {
        // Clean existing src directory to isolate project compilations
        const srcDir = path.join(CONTRACT_DIR, 'src');
        if (fs.existsSync(srcDir)) {
          fs.rmSync(srcDir, { recursive: true, force: true });
        }

        // Write files to workspace safely
        for (const [relPath, content] of Object.entries(files)) {
          if (typeof content !== 'string') {
            res.status(400).json({ error: `Invalid content for file ${relPath}` });
            return resolve();
          }

          // Check if it is a safe path (e.g. src/lib.rs, Cargo.toml)
          const safePath = getSafePath(relPath);
          
          // Ensure target directory exists
          fs.mkdirSync(path.dirname(safePath), { recursive: true });
          fs.writeFileSync(safePath, content, 'utf8');
        }

        // Run stellar build command (fallback to cargo build if stellar CLI is missing)
        const buildCmd = 'stellar contract build';
        
        exec(buildCmd, execOptions, (error, stdout, stderr) => {
          let logs = `Stdout:\n${stdout}\n\nStderr:\n${stderr}`;
          
          const finishTask = () => {
            resolve();
          };

          const proceedWithWasm = () => {
            const wasmPath = path.join(WORKSPACE_DIR, 'target/wasm32v1-none/release/hello_world.wasm');
            
            if (!fs.existsSync(wasmPath)) {
              res.status(500).json({
                success: false,
                logs,
                error: 'WASM output file not found after successful compilation.'
              });
              statsTracker.recordCompilation(clientIp, false);
              return finishTask();
            }

            // Command to get contract interface JSON (static paths)
            const interfaceCmd = `stellar contract info interface --wasm ${wasmPath} --output json-formatted`;

            exec(interfaceCmd, execOptions, (infoErr, infoStdout, infoStderr) => {
              let abi = [];
              if (!infoErr) {
                try {
                  abi = JSON.parse(infoStdout.trim());
                } catch {}
              }

              const wasmBuffer = fs.readFileSync(wasmPath);
              const wasmBase64 = wasmBuffer.toString('base64');

              res.json({
                success: true,
                logs: sanitizeLogs(logs + (infoStderr ? `\n\nABI Spec:\n${infoStderr}` : '')),
                abi,
                wasm: wasmBase64
              });
              statsTracker.recordCompilation(clientIp, true);
              finishTask();
            });
          };

          if (error) {
            // Fallback to cargo build --target wasm32v1-none --release
            const fallbackCmd = 'cargo build --target wasm32v1-none --release';
            exec(fallbackCmd, execOptions, (fallbackErr, fbStdout, fbStderr) => {
              logs += `\n\nFallback Cargo Build Stdout:\n${fbStdout}\n\nStderr:\n${fbStderr}`;
              if (fallbackErr) {
                res.status(422).json({
                  success: false,
                  logs: sanitizeLogs(logs),
                  error: `Compilation failed: ${fallbackErr.message}`
                });
                statsTracker.recordCompilation(clientIp, false);
                return finishTask();
              }
              proceedWithWasm();
            });
          } else {
            proceedWithWasm();
          }
        });

      } catch (err: any) {
        console.error('Compile error:', err);
        res.status(500).json({ error: err.message });
        resolve();
      }
    });
  });

  if (!enqueueResult.success) {
    return res.status(429).json({ error: enqueueResult.error });
  }
});

// Start Express server on 0.0.0.0 to accept external network traffic
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Stellar Soroban compiler server running at http://0.0.0.0:${PORT}`);
});
