import { useState } from "react";
import { imgUrl } from "../utils/api";
import { useTitleLogo } from "../utils/useTitleLogo";

/**
 * Renders a title's logo artwork when TMDB has one, otherwise the plain title.
 * The heading element and its class stay the same either way, so layout and
 * screen readers get the title text in both cases.
 */
export default function TitleArt({
  type,
  id,
  apiKey,
  title,
  as: Tag = "h1",
  className = "",
  size = "w500",
}) {
  const logo = useTitleLogo(type, id, apiKey);
  const [failed, setFailed] = useState(false);
  const showLogo = logo && !failed;

  return (
    <Tag
      className={`${className}${showLogo ? " title-art--logo" : ""}`}
      aria-label={title}
    >
      {showLogo ? (
        <img
          className="title-art"
          src={imgUrl(logo, size)}
          alt={title}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        title
      )}
    </Tag>
  );
}
