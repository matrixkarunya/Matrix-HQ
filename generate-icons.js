const sharp = require("sharp");
const fs = require("fs");

const NAVY = { r: 5, g: 7, b: 15, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function make(out, size, logoSize, background) {
  // trim() removes any empty transparent margin around the logo itself
  const logo = await sharp("logo-transparent.png")
    .trim()
    .resize(logoSize, logoSize, { fit: "contain", background: CLEAR })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);

  console.log("created", out);
}

(async () => {
  fs.mkdirSync("public/icons", { recursive: true });

  await make("public/icons/icon-512.png", 512, 490, CLEAR);
  await make("public/icons/icon-192.png", 192, 184, CLEAR);
  await make("public/icons/icon-maskable-512.png", 512, 380, NAVY);
  await make("public/icons/apple-touch-icon.png", 180, 150, NAVY);
})();