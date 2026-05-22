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
    return json(res, 405, { error: "Metode tidak diizinkan" });
  }

  if (process.env.VERCEL) {
    return json(res, 403, {
      success: false,
      error: "Pelatihan ulang ML tidak didukung di lingkungan Vercel langsung. Fungsi serverless Vercel bersifat read-only dan tidak memiliki Python. Silakan jalankan pelatihan ulang secara lokal ('python ml/run_pipeline.py') dan commit ml-results.json serta ml_plots/ yang diperbarui ke Git."
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
          errorMsg = "Perintah Python tidak ditemukan. Pastikan Python sudah terinstal dan ditambahkan ke PATH di mesin lokal Anda.";
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
