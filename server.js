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

    const url = `https://api.3dbag.nl/collections/pand/items?bbox=${bbox}&limit=1&f=json`;
    console.log("[3dbag] fetching:", url);

    const r = await fetch(url, { headers: { Accept: "application/geo+json" } });
    console.log("[3dbag] status:", r.status);

    if (!r.ok) {
      const txt = await r.text();
      console.log("[3dbag] error body:", txt.slice(0, 500));
      return res.status(502).send(txt);
    }

    const data = await r.json();
    console.log("[3dbag] features count:", data?.features?.length ?? "no features key");
    console.log("[3dbag] first feature props:", JSON.stringify(data?.features?.[0]?.properties ?? null).slice(0, 300));
    res.json(data);
  } catch (e) {
    console.log("[3dbag] exception:", e);
    res.status(500).json({ error: "3D BAG proxy error", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
