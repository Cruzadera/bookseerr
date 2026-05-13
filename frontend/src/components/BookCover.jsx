import { useState } from "react";

export default function BookCover({ coverUrl, title, format }) {
  const normalizedCoverUrl = `${coverUrl || ""}`.trim();
  const safeTitle = `${title || "Book"}`.trim();
  const formatValue = `${format || "unknown"}`.toUpperCase();
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <div className="result-cover">
      {normalizedCoverUrl && !imageBroken ? (
        <img
          src={normalizedCoverUrl}
          alt={safeTitle}
          loading="lazy"
          onError={() => setImageBroken(true)}
        />
      ) : null}

      {!normalizedCoverUrl || imageBroken ? (
        <span className="result-cover-fallback" aria-hidden="true">
          {(safeTitle.charAt(0) || "?").toUpperCase()}
        </span>
      ) : null}

      <span className="result-cover-format">{formatValue}</span>
    </div>
  );
}