import manifest from "./data/image-manifest.json";
import ImageViewer, { type ImageManifest } from "./viewer";

export default function Home() {
  return <ImageViewer manifest={manifest as ImageManifest} />;
}
