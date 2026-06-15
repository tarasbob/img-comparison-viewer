"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

export type ManifestImage = {
  index: number;
  resultId: string;
  fileName: string;
  relativePath: string;
  url: string;
  kind: "primary";
};

export type ManifestDataset = {
  id: string;
  label: string;
  sourceFolder: string;
  resultCount: number;
  imageCount: number;
  videoCount: number;
  images: ManifestImage[];
};

export type ImageManifest = {
  generatedAt: string | null;
  datasets: ManifestDataset[];
};

type ImageViewerProps = {
  manifest: ImageManifest;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function shuffleImages(images: ManifestImage[]) {
  const shuffledImages = [...images];

  for (let index = shuffledImages.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledImages[index], shuffledImages[swapIndex]] = [shuffledImages[swapIndex], shuffledImages[index]];
  }

  return shuffledImages;
}

export default function ImageViewer({ manifest }: ImageViewerProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(manifest.datasets[0]?.id ?? "");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [loadedImageUrl, setLoadedImageUrl] = useState("");
  const [randomizedImagesByDataset, setRandomizedImagesByDataset] = useState<
    Record<string, ManifestImage[]> | null
  >(null);

  const selectedDataset = useMemo(
    () => manifest.datasets.find((dataset) => dataset.id === selectedDatasetId) ?? manifest.datasets[0],
    [manifest.datasets, selectedDatasetId]
  );

  const filteredImages = useMemo(() => {
    const images = selectedDataset
      ? (randomizedImagesByDataset?.[selectedDataset.id] ?? selectedDataset.images)
      : [];
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return images;
    }

    return images.filter((image) =>
      normalize(`${image.resultId} ${image.fileName} ${image.relativePath} ${image.kind}`).includes(
        normalizedQuery
      )
    );
  }, [query, randomizedImagesByDataset, selectedDataset]);

  const boundedIndex = Math.min(selectedIndex, Math.max(filteredImages.length - 1, 0));
  const currentImage = filteredImages[boundedIndex];
  const currentPosition = filteredImages.length > 0 ? boundedIndex + 1 : 0;
  const isCurrentImageLoaded = Boolean(currentImage && loadedImageUrl === currentImage.url);

  const nearbyImages = useMemo(() => {
    if (filteredImages.length === 0) {
      return [];
    }

    const start = Math.max(0, boundedIndex - 4);
    const end = Math.min(filteredImages.length, boundedIndex + 5);

    return filteredImages.slice(start, end).map((image, offset) => ({
      image,
      index: start + offset
    }));
  }, [boundedIndex, filteredImages]);

  const goToIndex = useCallback(
    (index: number) => {
      if (filteredImages.length === 0) {
        return;
      }

      const wrappedIndex = (index + filteredImages.length) % filteredImages.length;
      setSelectedIndex(wrappedIndex);
    },
    [filteredImages.length]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRandomizedImagesByDataset(
        Object.fromEntries(manifest.datasets.map((dataset) => [dataset.id, shuffleImages(dataset.images)]))
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [manifest.datasets]);

  useEffect(() => {
    if (!currentImage || filteredImages.length < 2) {
      return;
    }

    const neighborUrls = [
      filteredImages[(boundedIndex + 1) % filteredImages.length]?.url,
      filteredImages[(boundedIndex - 1 + filteredImages.length) % filteredImages.length]?.url
    ].filter(Boolean);

    for (const url of neighborUrls) {
      const image = new Image();
      image.src = url;
    }
  }, [boundedIndex, currentImage, filteredImages]);

  useEffect(() => {
    if (!currentImage) {
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled) {
        setLoadedImageUrl(currentImage.url);
      }
    };
    image.src = currentImage.url;

    if (image.complete) {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setLoadedImageUrl(currentImage.url);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [currentImage]);

  function handleDatasetChange(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setSelectedIndex(0);
    setQuery("");
  }

  function handleJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextPosition = Number(formData.get("position"));

    if (Number.isFinite(nextPosition)) {
      goToIndex(Math.round(nextPosition) - 1);
    }
  }

  async function enterFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        goToIndex(boundedIndex - 1);
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        goToIndex(boundedIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [boundedIndex, goToIndex]);

  if (!selectedDataset) {
    return (
      <main className="emptyShell">
        <div className="emptyCard">
          <p className="eyebrow">No images yet</p>
          <h1>Run the asset sync script to generate the viewer manifest.</h1>
          <code>npm run sync-assets</code>
        </div>
      </main>
    );
  }

  return (
    <main className="viewerShell">
      <section className="topBar" aria-label="Image viewer controls">
        <div className="brandBlock">
          <p className="eyebrow">Image comparison viewer</p>
          <h1>{selectedDataset.label}</h1>
        </div>

        <div className="datasetSwitcher" aria-label="Choose image folder">
          {manifest.datasets.map((dataset) => (
            <button
              className={dataset.id === selectedDataset.id ? "datasetButton active" : "datasetButton"}
              key={dataset.id}
              onClick={() => handleDatasetChange(dataset.id)}
              type="button"
            >
              <span>{dataset.label}</span>
              <small>
                {formatNumber(dataset.imageCount)} images / {formatNumber(dataset.resultCount)} folders
              </small>
            </button>
          ))}
        </div>

        <div className="utilityControls">
          <label className="searchBox">
            <span>Find</span>
            <input
              aria-label="Search by result ID or filename"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Result ID..."
              type="search"
              value={query}
            />
          </label>

          <form className="jumpForm" onSubmit={handleJumpSubmit}>
            <label htmlFor="jump-to-image">Jump</label>
            <input
              id="jump-to-image"
              key={`${selectedDataset.id}-${query}-${currentPosition}`}
              min="1"
              max={Math.max(filteredImages.length, 1)}
              name="position"
              type="number"
              defaultValue={currentPosition || 1}
            />
          </form>
        </div>
      </section>

      <section className="imageStage" aria-live="polite">
        {currentImage ? (
          <>
            <img alt="" aria-hidden="true" className="stageBackdrop" src={currentImage.url} />
            {!isCurrentImageLoaded ? (
              <div className="loadingCard" role="status">
                Loading full image...
              </div>
            ) : null}
            <div
              className={isCurrentImageLoaded ? "heroImage loaded" : "heroImage"}
              key={currentImage.url}
              role="img"
              aria-label={`${currentImage.resultId} ${currentImage.fileName}`}
              style={isCurrentImageLoaded ? { backgroundImage: `url(${currentImage.url})` } : undefined}
            />
          </>
        ) : (
          <div className="emptyCard compact">
            <p className="eyebrow">No matches</p>
            <h2>No images match your search.</h2>
            <button className="secondaryButton" onClick={() => setQuery("")} type="button">
              Clear search
            </button>
          </div>
        )}

        <button
          aria-label="Previous image"
          className="navButton previous"
          disabled={filteredImages.length < 2}
          onClick={() => goToIndex(boundedIndex - 1)}
          type="button"
        >
          {"<"}
        </button>
        <button
          aria-label="Next image"
          className="navButton next"
          disabled={filteredImages.length < 2}
          onClick={() => goToIndex(boundedIndex + 1)}
          type="button"
        >
          {">"}
        </button>
      </section>

      <section className="bottomBar" aria-label="Current image details">
        <div className="imageMeta">
          <p>
            <strong>
              {formatNumber(currentPosition)} / {formatNumber(filteredImages.length)}
            </strong>
            <span>{query ? `Filtered from ${formatNumber(selectedDataset.imageCount)} images` : "Current folder"}</span>
          </p>
          {currentImage ? (
            <p className="pathLine">
              <span className="pill">{currentImage.kind}</span>
              <span>{currentImage.relativePath}</span>
            </p>
          ) : null}
        </div>

        <div className="filmstrip" aria-label="Nearby images">
          {nearbyImages.map(({ image, index }) => (
            <button
              aria-label={`Go to image ${index + 1}`}
              className={index === boundedIndex ? "thumb active" : "thumb"}
              key={`${image.url}-${index}`}
              onClick={() => goToIndex(index)}
              type="button"
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>

        <div className="quickActions">
          {currentImage ? (
            <a className="secondaryButton" href={currentImage.url} target="_blank" rel="noreferrer">
              Open image
            </a>
          ) : null}
          <button className="secondaryButton" onClick={enterFullscreen} type="button">
            Fullscreen
          </button>
        </div>
      </section>
    </main>
  );
}
