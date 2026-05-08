import { useEffect, useMemo, useRef, useState } from "react";
import type { DiffFile } from "../../core/types";
import {
  allocateImageId,
  deleteImage,
  imageIdToFgColor,
  placeholderRow,
  rgbToHex,
  transmitImage,
} from "../../core/kittyGraphics";
import type { AppTheme } from "../themes";

const IMAGE_PANEL_ROWS = 18;
const IMAGE_PANEL_MAX_COLUMNS = 64;
const IMAGE_PANEL_MIN_COLUMNS = 24;
const IMAGE_PANEL_HORIZONTAL_PADDING = 2;

/** Pick a cell-grid size that fits the available pane width and is consistent across mounts. */
function pickPanelSize(width: number) {
  const usableWidth = Math.max(IMAGE_PANEL_MIN_COLUMNS, width - IMAGE_PANEL_HORIZONTAL_PADDING);
  const columns = Math.min(IMAGE_PANEL_MAX_COLUMNS, usableWidth);
  return { columns, rows: IMAGE_PANEL_ROWS };
}

/** Title above each image panel naming whether this is the before/after side. */
function panelLabel(side: "before" | "after", file: DiffFile) {
  if (side === "before") {
    return file.previousPath ? `before — ${file.previousPath}` : "before";
  }
  return `after — ${file.path}`;
}

interface ImagePanelProps {
  filePath: string;
  label: string;
  width: number;
  theme: AppTheme;
}

/** One side (before or after) — transmits the image once and renders the placeholder grid. */
function ImagePanel({ filePath, label, width, theme }: ImagePanelProps) {
  const imageIdRef = useRef<number | null>(null);
  const [transmitted, setTransmitted] = useState(false);
  const { columns, rows } = useMemo(() => pickPanelSize(width), [width]);

  useEffect(() => {
    const id = allocateImageId();
    imageIdRef.current = id;
    const ok = transmitImage({ imageId: id, filePath, columns, rows });
    setTransmitted(ok);

    return () => {
      const ownedId = imageIdRef.current;
      if (ownedId !== null) {
        deleteImage(ownedId);
        imageIdRef.current = null;
      }
    };
  }, [filePath, columns, rows]);

  const placeholderRows = useMemo(() => {
    const id = imageIdRef.current;
    if (!transmitted || id === null) {
      return [];
    }
    const built: string[] = [];
    for (let row = 0; row < rows; row++) {
      built.push(placeholderRow(row, columns, id));
    }
    return built;
  }, [transmitted, columns, rows]);

  const fgHex = useMemo(() => {
    const id = imageIdRef.current;
    return id === null ? theme.text : rgbToHex(imageIdToFgColor(id));
  }, [transmitted, theme.text]);

  return (
    <box style={{ width: "100%", flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
      <text>
        <span fg={theme.muted}>{label}</span>
      </text>
      {!transmitted ? (
        <text>
          <span fg={theme.muted}>(image transmit failed — file unreadable?)</span>
        </text>
      ) : (
        placeholderRows.map((rowText, rowIndex) => (
          <text key={`row-${rowIndex}`}>
            <span fg={fgHex} bg={theme.panel}>
              {rowText}
            </span>
          </text>
        ))
      )}
    </box>
  );
}

interface ImageDiffViewProps {
  file: DiffFile;
  width: number;
  theme: AppTheme;
}

/** Render a binary image diff as before/after kitty-graphics panels. */
export function ImageDiffView({ file, width, theme }: ImageDiffViewProps) {
  const blobs = file.imageBlobs;
  if (!blobs) {
    return null;
  }

  return (
    <box style={{ width: "100%", flexDirection: "column", paddingBottom: 1 }}>
      {blobs.left ? (
        <ImagePanel filePath={blobs.left} label={panelLabel("before", file)} width={width} theme={theme} />
      ) : (
        <box style={{ paddingLeft: 1, paddingRight: 1 }}>
          <text>
            <span fg={theme.muted}>(no before — added file)</span>
          </text>
        </box>
      )}
      {blobs.right ? (
        <ImagePanel filePath={blobs.right} label={panelLabel("after", file)} width={width} theme={theme} />
      ) : (
        <box style={{ paddingLeft: 1, paddingRight: 1 }}>
          <text>
            <span fg={theme.muted}>(no after — deleted file)</span>
          </text>
        </box>
      )}
    </box>
  );
}
