import { ThumbsUpIcon, ThumbsDownIcon } from "./Icons";
import { useThumb } from "../utils/thumbs";

/** Rate a title: thumbs up steers recommendations, thumbs down hides lookalikes. */
export default function ThumbsButtons({ type, id }) {
  const [value, toggle] = useThumb(type, id);
  return (
    <>
      <button
        type="button"
        className={`icon-action${value === 1 ? " is-on" : ""}`}
        onClick={() => toggle(1)}
        aria-pressed={value === 1}
        aria-label="I like this"
        title={value === 1 ? "Rated: I like this" : "I like this"}
      >
        <ThumbsUpIcon />
      </button>
      <button
        type="button"
        className={`icon-action${value === -1 ? " is-on" : ""}`}
        onClick={() => toggle(-1)}
        aria-pressed={value === -1}
        aria-label="Not for me"
        title={value === -1 ? "Rated: not for me" : "Not for me"}
      >
        <ThumbsDownIcon />
      </button>
    </>
  );
}
