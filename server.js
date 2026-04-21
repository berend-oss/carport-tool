const express = require("express");

const app = express();
const PORT = 3000;

// Zorgt dat index.html automatisch wordt geserveerd
app.use(express.static(__dirname));

// PVGIS proxy (lost CORS op)
app.get("/pvgis", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "lat/lon ontbreekt" });
    }

    const url =
      `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}` +
      `&lon=${lon}&peakpower=1&loss=14&angle=35&aspect=0&outputformat=json`;

    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).send(txt);
    }

    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "PVGIS proxy error", details: String(e) });
  }
});

// 3D BAG proxy (lost CORS op)
app.get("/3dbag", async (req, res) => {
  try {
    const { bbox } = req.query;
    if (!bbox) return res.status(400).json({ error: "bbox ontbreekt" });

    const url = `https://api.3dbag.nl/collections/pand/items?bbox=${encodeURIComponent(bbox)}&limit=1&f=json`;
    const r = await fetch(url, { headers: { Accept: "application/geo+json" } });
    if (!r.ok) return res.status(502).send(await r.text());

    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "3D BAG proxy error", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
