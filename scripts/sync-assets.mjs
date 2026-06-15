import { copyFile, cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDatasetDir = path.join(rootDir, "public", "datasets");
const manifestPath = path.join(rootDir, "app", "data", "image-manifest.json");

const datasets = [
  {
    id: "output",
    label: "Version Psi",
    sourceDir: path.join(rootDir, "output")
  },
  {
    id: "output_41288611",
    label: "Version Xi",
    sourceDir: path.join(rootDir, "output_41288611")
  }
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function toPublicUrl(datasetId, relativePath) {
  const encodedPath = relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/datasets/${datasetId}/${encodedPath}`;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getPrimaryImageEntries(dataset) {
  if (!(await pathExists(dataset.sourceDir))) {
    throw new Error(`Missing source folder: ${dataset.sourceDir}`);
  }

  const entries = await readdir(dataset.sourceDir, { withFileTypes: true });
  const resultDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(collator.compare);

  const imageEntries = [];

  for (const resultId of resultDirs) {
    const imagePath = path.join(dataset.sourceDir, resultId, "image.png");

    if (await pathExists(imagePath)) {
      imageEntries.push({
        resultId,
        sourcePath: imagePath,
        relativePath: path.join(resultId, "image.png")
      });
    }
  }

  return imageEntries;
}

async function copyDataset(dataset, imageEntries) {
  const destinationDir = path.join(publicDatasetDir, dataset.id);

  await rm(destinationDir, { recursive: true, force: true });
  await mkdir(destinationDir, { recursive: true });

  for (const imageEntry of imageEntries) {
    const destinationPath = path.join(destinationDir, imageEntry.relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(imageEntry.sourcePath, destinationPath);
  }
}

async function buildDatasetManifest(dataset, imageEntries) {
  const images = imageEntries.map(({ resultId, relativePath }, index) => {
    const parts = relativePath.split(path.sep);

    return {
      index,
      resultId,
      fileName: "image.png",
      relativePath: parts.join("/"),
      url: toPublicUrl(dataset.id, relativePath),
      kind: "primary"
    };
  });

  return {
    id: dataset.id,
    label: dataset.label,
    sourceFolder: path.basename(dataset.sourceDir),
    resultCount: images.length,
    imageCount: images.length,
    videoCount: 0,
    images
  };
}

async function main() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    datasets: []
  };

  for (const dataset of datasets) {
    console.log(`Copying primary image.png files from ${dataset.label}...`);
    const imageEntries = await getPrimaryImageEntries(dataset);
    await copyDataset(dataset, imageEntries);
    manifest.datasets.push(await buildDatasetManifest(dataset, imageEntries));
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(manifestPath, { force: true });
  await cp(`${manifestPath}.tmp`, manifestPath);
  await rm(`${manifestPath}.tmp`, { force: true });

  for (const dataset of manifest.datasets) {
    console.log(
      `${dataset.label}: ${dataset.imageCount.toLocaleString()} images across ${dataset.resultCount.toLocaleString()} result folders`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
