const { exec } = require('child_process');
const path = require('path');

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (process.env.VERCEL) {
    return json(res, 403, {
      success: false,
      error: "ML retraining not supported on live Vercel environment. Vercel serverless functions are read-only and lack Python. Please run retraining locally ('python ml/run_pipeline.py') and commit the updated ml-results.json and ml_plots/ to Git."
    });
  }

  const scriptPath = path.resolve(__dirname, '..', '..', 'ml', 'run_pipeline.py');
  const workingDir = path.resolve(__dirname, '..', '..');

  console.log(`Running retraining script at: ${scriptPath} (CWD: ${workingDir})`);

  return new Promise((resolve) => {
    exec(`python "${scriptPath}"`, { cwd: workingDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Retrain error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        let errorMsg = error.message;
        if (error.message.includes("not found") || error.message.includes("ENOENT") || error.code === 127) {
          errorMsg = "Python command not found. Please ensure Python is installed and added to the PATH on your local machine.";
        }
        json(res, 500, { success: false, error: errorMsg, details: stderr });
        return resolve();
      }
      console.log(`Retrain success: ${stdout}`);
      json(res, 200, { success: true });
      return resolve();
    });
  });
};
