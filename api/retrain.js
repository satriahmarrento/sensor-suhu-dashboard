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

  const scriptPath = path.resolve(__dirname, '..', '..', 'ml', 'run_pipeline.py');
  const workingDir = path.resolve(__dirname, '..', '..');

  console.log(`Running retraining script at: ${scriptPath} (CWD: ${workingDir})`);

  return new Promise((resolve) => {
    exec(`python "${scriptPath}"`, { cwd: workingDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Retrain error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        json(res, 500, { success: false, error: error.message, details: stderr });
        return resolve();
      }
      console.log(`Retrain success: ${stdout}`);
      json(res, 200, { success: true });
      return resolve();
    });
  });
};
