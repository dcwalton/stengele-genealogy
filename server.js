const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'server-data');
const DIST_DIR = path.join(__dirname, 'dist', 'genealogy', 'browser');

app.use(express.json({ limit: '10mb' }));

/** Converts a user-supplied name into a safe file name (without extension). */
function cleanName(raw) {
  const base = path.basename(String(raw || ''), path.extname(String(raw || '')));
  const name = base.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_').trim();
  return name || 'imported';
}

function dataFile(name) {
  const file = path.join(DATA_DIR, `${cleanName(name)}.json`);
  if (!file.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid name');
  }
  return file;
}

function isValidGenealogy(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.indis) &&
    Array.isArray(data.fams)
  );
}

// GET /api/genealogies - lists stored genealogy names.
app.get('/api/genealogies', (req, res) => {
  fs.readdir(DATA_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to list genealogies.' });
    }
    const names = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort((a, b) => a.localeCompare(b));
    res.json(names);
  });
});

// GET /api/genealogy/:name - returns one stored genealogy.
app.get('/api/genealogy/:name', (req, res) => {
  fs.readFile(dataFile(req.params.name), 'utf8', (err, contents) => {
    if (err) {
      return res.status(404).json({ error: 'No genealogy data stored under that name.' });
    }
    try {
      res.json(JSON.parse(contents));
    } catch {
      res.status(500).json({ error: 'Stored genealogy data is corrupted.' });
    }
  });
});

// PUT /api/genealogy/:name - creates or replaces a stored genealogy.
app.put('/api/genealogy/:name', (req, res) => {
  const data = req.body;
  if (!isValidGenealogy(data)) {
    return res.status(400).json({ error: 'Invalid genealogy data: expected { indis: [], fams: [] }.' });
  }
  let file;
  try {
    file = dataFile(req.params.name);
  } catch {
    return res.status(400).json({ error: 'Invalid name.' });
  }
  const tmpFile = file + '.tmp';
  fs.writeFile(tmpFile, JSON.stringify(data), (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to write genealogy data.' });
    }
    fs.rename(tmpFile, file, (renameErr) => {
      if (renameErr) {
        return res.status(500).json({ error: 'Failed to store genealogy data.' });
      }
      res.json({ ok: true });
    });
  });
});

// DELETE /api/genealogy/:name - removes a stored genealogy.
app.delete('/api/genealogy/:name', (req, res) => {
  let file;
  try {
    file = dataFile(req.params.name);
  } catch {
    return res.status(400).json({ error: 'Invalid name.' });
  }
  fs.unlink(file, (err) => {
    if (err) {
      return res.status(404).json({ error: 'No genealogy stored under that name.' });
    }
    res.json({ ok: true });
  });
});

// Serve the built Angular app.
app.use(express.static(DIST_DIR));
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Genealogy server listening on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
